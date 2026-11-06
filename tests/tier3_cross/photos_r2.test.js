import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadPhotosHandlers,
  loadReportsHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture } from '../helpers/fixtures.js';

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// invokeFunction JSON-encodes object bodies, so photo calls (raw bytes)
// build their Request directly, exactly like the client's fetch() does.
async function invokePhoto(handler, { method, hash, cookie = null, body = null, contentType = null, query = '', env }) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  if (contentType) headers.set('content-type', contentType);
  const request = new Request(`http://localhost/api/photos/${hash}${query}`, {
    method,
    headers,
    body: body === null || method === 'GET' || method === 'HEAD' ? undefined : body,
  });
  return handler({ request, env, params: { hash } });
}

describe('Tier 3: Cross-Feature 6 — R2 Photo Storage (content-addressed, per-user)', () => {
  let db;
  let env;
  let photos;
  let reports;

  const photoBytes = new TextEncoder().encode('fake-jpeg-binary-content-for-r2-tests');
  let photoHash;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    photos = await loadPhotosHandlers();
    reports = await loadReportsHandlers();
    photoHash = await sha256Hex(photoBytes);
  });

  async function makeUser(email, role = 'user') {
    const user = await createDirectUser(env, { email, role });
    const { cookieValue } = await createDirectSession(env, user.id);
    return { user, cookie: cookieValue };
  }

  async function putPhoto(cookie, hash = photoHash, bytes = photoBytes) {
    return invokePhoto(photos.photoPut, {
      method: 'PUT',
      hash,
      cookie,
      body: bytes,
      contentType: 'image/jpeg',
      env,
    });
  }

  it('TC-C27: Photo PUT then GET round-trips the exact bytes and content type', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');

    const putRes = await putPhoto(a.cookie);
    const putJson = await readJson(putRes);
    assert.equal(putJson.status, 200);
    assert.equal(putJson.body.ok, true);
    assert.equal(putJson.body.hash, photoHash);

    const getRes = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      cookie: a.cookie,
      env,
    });
    assert.equal(getRes.status, 200);
    assert.equal(getRes.headers.get('content-type'), 'image/jpeg');
    assert.match(getRes.headers.get('cache-control') || '', /immutable/);
    const gotBytes = new Uint8Array(await getRes.arrayBuffer());
    assert.deepEqual([...gotBytes], [...photoBytes]);
  });

  it('TC-C28: PUT with a hash that does not match the body is rejected (400)', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');
    const otherHash = await sha256Hex(new TextEncoder().encode('different-content'));

    const res = await putPhoto(a.cookie, otherHash, photoBytes);
    const json = await readJson(res);
    assert.equal(json.status, 400);
    assert.equal(json.body.error, 'HASH_MISMATCH');

    // Nothing was stored under either hash
    const getRes = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: otherHash,
      cookie: a.cookie,
      env,
    });
    assert.equal(getRes.status, 404);
  });

  it('TC-C29: Malformed hash in the path is rejected (400) on PUT and GET', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');

    const putRes = await putPhoto(a.cookie, 'not-a-hash', photoBytes);
    assert.equal((await readJson(putRes)).status, 400);

    const getRes = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: 'ABCDEF0123',
      cookie: a.cookie,
      env,
    });
    assert.equal(getRes.status, 400);
  });

  it('TC-C30: Photos are private per user — B cannot read A\'s photo; admin needs ?user=', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');
    const b = await makeUser('photographer.b@sofacompany.com');
    const admin = await makeUser('admin@sofacompany.com', 'admin');
    await putPhoto(a.cookie);

    // User B's own prefix is empty -> 404
    const getB = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      cookie: b.cookie,
      env,
    });
    assert.equal(getB.status, 404);

    // Admin without the explicit owner param also reads only their own prefix
    const getAdminOwn = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      cookie: admin.cookie,
      env,
    });
    assert.equal(getAdminOwn.status, 404);

    // Admin with ?user=<A id> can read it
    const getAdminForA = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      cookie: admin.cookie,
      query: `?user=${a.user.id}`,
      env,
    });
    assert.equal(getAdminForA.status, 200);
    const gotBytes = new Uint8Array(await getAdminForA.arrayBuffer());
    assert.deepEqual([...gotBytes], [...photoBytes]);
  });

  it('TC-C31: All photo handlers reject anonymous callers (401)', async () => {
    const putRes = await invokePhoto(photos.photoPut, {
      method: 'PUT',
      hash: photoHash,
      body: photoBytes,
      contentType: 'image/jpeg',
      env,
    });
    assert.equal(putRes.status, 401);

    const getRes = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      env,
    });
    assert.equal(getRes.status, 401);

    const deleteRes = await invokePhoto(photos.photoDelete, {
      method: 'DELETE',
      hash: photoHash,
      env,
    });
    assert.equal(deleteRes.status, 401);
  });

  it('TC-C32: DELETE removes the caller\'s own object; a missing PHOTOS binding yields 503', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');
    await putPhoto(a.cookie);

    const delRes = await invokePhoto(photos.photoDelete, {
      method: 'DELETE',
      hash: photoHash,
      cookie: a.cookie,
      env,
    });
    assert.equal((await readJson(delRes)).status, 200);

    const getRes = await invokePhoto(photos.photoGet, {
      method: 'GET',
      hash: photoHash,
      cookie: a.cookie,
      env,
    });
    assert.equal(getRes.status, 404);

    // No R2 binding configured on the server -> graceful 503 contract
    const bareEnv = createTestEnv(db, { PHOTOS: undefined });
    const putBare = await invokePhoto(photos.photoPut, {
      method: 'PUT',
      hash: photoHash,
      cookie: a.cookie,
      body: photoBytes,
      contentType: 'image/jpeg',
      env: bareEnv,
    });
    const putBareJson = await readJson(putBare);
    assert.equal(putBareJson.status, 503);
    assert.equal(putBareJson.body.error, 'PHOTOS_NOT_CONFIGURED');
  });

  it('TC-C33: Sync round-trip — a report payload with an fasrep-r2:// marker is stored as the light marker payload', async () => {
    const a = await makeUser('photographer.a@sofacompany.com');
    const marker = `fasrep-r2://${photoHash}`;
    const fixture = createPrototypeReportFixture({
      id: 'r2_marker_report',
      prodPhotos: [{ id: 'p1', caption: 'Oak grain', url: marker }],
    });
    // Scrub the fixture's other inline mock photos: an externalized
    // client snapshot carries markers (or nothing), never data URLs.
    (function scrub(node) {
      if (Array.isArray(node)) {
        node.forEach(scrub);
        return;
      }
      if (node && typeof node === 'object') {
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'string' && node[key].startsWith('data:')) node[key] = '';
          else scrub(node[key]);
        }
      }
    })(fixture);

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      headers: { cookie: a.cookie },
      body: fixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    // The stored chunks hold the marker and no base64 photo blob
    const chunkRows = await db.prepare(
      'SELECT data FROM report_payload_chunks WHERE id = ? ORDER BY chunk_index ASC'
    ).bind('r2_marker_report').all();
    const storedPayload = chunkRows.results.map((r) => r.data).join('');
    assert.ok(storedPayload.includes(marker), 'stored payload must contain the fasrep-r2:// marker');
    assert.ok(!storedPayload.includes('data:image'), 'stored payload must not contain an inline data URL');

    // GET reassembles the identical marker payload for the client to rehydrate
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/r2_marker_report',
      params: { id: 'r2_marker_report' },
      headers: { cookie: a.cookie },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.prodPhotos[0].url, marker);
  });
});
