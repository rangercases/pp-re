import { error, json, readJsonBody, serverError, CORS_HEADERS } from '../../_lib/http.js';
import { requireUser } from '../../_lib/session.js';
import { extractPhotoCount, extractVerdict, formatReportMeta } from './index.js';

// A report owned by another account must be indistinguishable from a
// missing one, so every by-id handler funnels through this check.
function isOwnerOrAdmin(session, row) {
  if (session.user.role === 'admin') return true;
  return row.user_id != null && String(row.user_id) === String(session.user.id);
}

function extractId(params, request) {
  if (params && params.id) {
    return decodeURIComponent(String(params.id)).trim();
  }
  try {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    return lastPart ? decodeURIComponent(lastPart).trim() : '';
  } catch {
    return '';
  }
}

export async function onRequestGet({ request, env, params }) {
  try {
    if (!env || !env.DB) {
      return serverError(new Error('D1 database binding (env.DB) is not available'));
    }

    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const id = extractId(params, request);
    if (!id) {
      return error('Report ID is required', 400);
    }

    const row = await env.DB.prepare(
      `SELECT id, user_id, module_type, report_title, product_name, model_number,
              po_number, factory, verdict, photo_count, thumb_small, revision,
              created_at, updated_at
       FROM reports
       WHERE id = ? AND deleted_at IS NULL`
    ).bind(id).first();

    if (!row || !isOwnerOrAdmin(session, row)) {
      return error('Report not found', 404);
    }

    const url = new URL(request.url);
    const isMetaOnly = url.searchParams.get('meta') === '1';

    if (isMetaOnly) {
      return json({
        success: true,
        report: formatReportMeta(row),
        revision: Number(row.revision) || 1,
      });
    }

    // Retrieve chunks ordered by chunk_index
    const chunkRowsResult = await env.DB.prepare(
      `SELECT chunk_index, total_chunks, data
       FROM report_payload_chunks
       WHERE id = ?
       ORDER BY chunk_index ASC`
    ).bind(id).all();

    const chunkRows = chunkRowsResult.results || [];
    if (chunkRows.length === 0) {
      return json({
        success: true,
        report: formatReportMeta(row),
        revision: Number(row.revision) || 1,
      });
    }

    const fullJsonStr = chunkRows.map(c => c.data).join('');
    let parsedReport;
    try {
      parsedReport = JSON.parse(fullJsonStr);
    } catch (parseErr) {
      return serverError(new Error('Failed to deserialize report payload: ' + parseErr.message));
    }

    return json({
      success: true,
      report: parsedReport,
      revision: Number(row.revision) || 1,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestPatch({ request, env, params }) {
  try {
    if (!env || !env.DB) {
      return serverError(new Error('D1 database binding (env.DB) is not available'));
    }

    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const id = extractId(params, request);
    if (!id) {
      return error('Report ID is required', 400);
    }

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.body;

    // Check report existence
    const existing = await env.DB.prepare(
      `SELECT id, user_id, module_type, report_title, product_name, model_number,
              po_number, factory, verdict, photo_count, thumb_small, revision,
              created_at, updated_at
       FROM reports
       WHERE id = ? AND deleted_at IS NULL`
    ).bind(id).first();

    if (!existing || !isOwnerOrAdmin(session, existing)) {
      return error('Report not found', 404);
    }

    // Optimistic locking revision check
    const currentRev = Number(existing.revision) || 1;
    let expectedRev = null;
    if (body.expectedRevision !== undefined && body.expectedRevision !== null) {
      expectedRev = Number(body.expectedRevision);
    } else if (body.revision !== undefined && body.revision !== null) {
      expectedRev = Number(body.revision);
    }

    if (expectedRev !== null && !isNaN(expectedRev) && expectedRev !== currentRev) {
      return error(
        `Revision conflict. Server has revision ${currentRev}, provided ${expectedRev}.`,
        409
      );
    }

    const newRevision = currentRev + 1;
    const nowIso = new Date().toISOString();
    const updatedAt = body.updatedAt || body.updated_at || nowIso;

    // Extract metadata updates with fallbacks to existing
    const moduleType = (body.moduleType || body.module_type || existing.module_type || 'prototype').trim();
    const reportTitle = (body.reportTitle || body.report_title || existing.report_title || '').trim();
    const productName = (body.productName || body.product_name || body.desc || existing.product_name || '').trim();
    const modelNumber = (body.modelNumber || body.model_number || body.model || existing.model_number || '').trim();
    const poNumber = (body.poNumber || body.po_number || body.po || existing.po_number || '').trim();
    const factory = (body.factory !== undefined ? body.factory : existing.factory || '').trim();

    const extractedVerdict = extractVerdict(body);
    const verdict = extractedVerdict || existing.verdict || '';

    let photoCount = extractPhotoCount(body);
    if (photoCount === 0 && existing.photo_count) {
      photoCount = existing.photo_count;
    }

    const thumbSmall = body.thumbSmall !== undefined
      ? body.thumbSmall
      : (body.thumb_small !== undefined ? body.thumb_small : existing.thumb_small || '');

    // Prepare full report payload
    const reportPayload = (body.report && typeof body.report === 'object') ? { ...body.report } : { ...body };
    reportPayload.id = id;
    // The stored payload's owner fields always mirror the row owner.
    if (existing.user_id != null) {
      reportPayload.userId = String(existing.user_id);
      reportPayload.user_id = String(existing.user_id);
    }
    reportPayload.revision = newRevision;
    reportPayload.updatedAt = updatedAt;
    delete reportPayload.expectedRevision;

    const fullPayloadStr = JSON.stringify(reportPayload);
    const CHUNK_SIZE = 500000;
    const chunks = [];
    for (let i = 0; i < fullPayloadStr.length; i += CHUNK_SIZE) {
      chunks.push(fullPayloadStr.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    const totalChunks = chunks.length;

    // DB statements
    const statements = [
      env.DB.prepare(
        `UPDATE reports SET
           module_type = ?,
           report_title = ?,
           product_name = ?,
           model_number = ?,
           po_number = ?,
           factory = ?,
           verdict = ?,
           photo_count = ?,
           thumb_small = ?,
           revision = ?,
           updated_at = ?
         WHERE id = ?`
      ).bind(
        moduleType,
        reportTitle,
        productName,
        modelNumber,
        poNumber,
        factory,
        verdict,
        photoCount,
        thumbSmall,
        newRevision,
        updatedAt,
        id
      ),
      env.DB.prepare('DELETE FROM report_payload_chunks WHERE id = ?').bind(id),
    ];

    for (let idx = 0; idx < chunks.length; idx++) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO report_payload_chunks (id, chunk_index, total_chunks, data)
           VALUES (?, ?, ?, ?)`
        ).bind(id, idx, totalChunks, chunks[idx])
      );
    }

    if (typeof env.DB.batch === 'function') {
      await env.DB.batch(statements);
    } else {
      for (const stmt of statements) {
        await stmt.run();
      }
    }

    return json({
      success: true,
      id,
      revision: newRevision,
      message: 'Report updated',
    }, 200);
  } catch (err) {
    return serverError(err);
  }
}

export const onRequestPut = onRequestPatch;

export async function onRequestDelete({ request, env, params }) {
  try {
    if (!env || !env.DB) {
      return serverError(new Error('D1 database binding (env.DB) is not available'));
    }

    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const id = extractId(params, request);
    if (!id) {
      return error('Report ID is required', 400);
    }

    const existing = await env.DB.prepare(
      `SELECT id, user_id FROM reports WHERE id = ? AND deleted_at IS NULL`
    ).bind(id).first();

    if (!existing || !isOwnerOrAdmin(session, existing)) {
      return error('Report not found', 404);
    }

    const nowIso = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE reports SET deleted_at = ? WHERE id = ?`
    ).bind(nowIso, id).run();

    return json({
      success: true,
      id,
      message: 'Report deleted',
    }, 200);
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
