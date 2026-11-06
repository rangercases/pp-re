import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../../functions/_lib/auth.js';
import { createSession, sessionCookie } from '../../functions/_lib/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

/**
 * Creates an in-memory Cloudflare D1 mock database backed by Node.js native `node:sqlite` (DatabaseSync).
 */
export function createMockD1() {
  const sqlite = new DatabaseSync(':memory:');

  // Load base schema (auth, users, sessions, signup_codes)
  const schemaPath = path.resolve(projectRoot, 'db/schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    sqlite.exec(schemaSql);
  }

  // Load reports schema if present; else create per PROJECT.md interface contract
  const reportsSchemaPath = path.resolve(projectRoot, 'db/reports_schema.sql');
  if (fs.existsSync(reportsSchemaPath)) {
    const reportsSchemaSql = fs.readFileSync(reportsSchemaPath, 'utf8');
    sqlite.exec(reportsSchemaSql);
  } else {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id           TEXT PRIMARY KEY,
        user_id      TEXT,
        module_type  TEXT NOT NULL DEFAULT 'prototype',
        report_title TEXT,
        product_name TEXT,
        model_number TEXT,
        po_number    TEXT,
        factory      TEXT,
        verdict      TEXT,
        photo_count  INTEGER DEFAULT 0,
        thumb_small  TEXT,
        revision     INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_reports_module_type ON reports(module_type);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at);
      CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
      CREATE INDEX IF NOT EXISTS idx_reports_deleted_at ON reports(deleted_at);

      CREATE TABLE IF NOT EXISTS report_payload_chunks (
        id           TEXT NOT NULL,
        chunk_index  INTEGER NOT NULL,
        total_chunks INTEGER NOT NULL,
        data         TEXT NOT NULL,
        PRIMARY KEY (id, chunk_index)
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_id ON report_payload_chunks(id);
    `);
  }

  // Wrap prepared statement for Cloudflare D1 compatibility
  function wrapStatement(sql, boundArgs = []) {
    const stmt = sqlite.prepare(sql);

    const sanitize = (val) => (val === undefined ? null : val);

    return {
      bind(...args) {
        return wrapStatement(sql, args.map(sanitize));
      },

      async first(colName) {
        const row = stmt.get(...boundArgs);
        if (!row) return null;
        if (typeof colName === 'string') {
          return row[colName] !== undefined ? row[colName] : null;
        }
        return row;
      },

      async all() {
        const results = stmt.all(...boundArgs);
        return {
          results: results || [],
          meta: { changes: 0 },
          success: true,
        };
      },

      async run() {
        const res = stmt.run(...boundArgs);
        return {
          success: true,
          meta: {
            changes: Number(res.changes || 0),
            last_row_id: Number(res.lastInsertRowid || 0),
          },
        };
      },

      async raw() {
        return stmt.all(...boundArgs);
      },
    };
  }

  const d1 = {
    prepare(sql) {
      return wrapStatement(sql, []);
    },

    async batch(statements) {
      const results = [];
      for (const s of statements) {
        if (typeof s.run === 'function') {
          results.push(await s.run());
        }
      }
      return results;
    },

    async exec(sql) {
      sqlite.exec(sql);
      return { success: true };
    },

    _rawDb: sqlite,
  };

  return d1;
}

/**
 * Creates an in-memory Cloudflare R2 mock bucket backed by a Map.
 * Mirrors the subset of the R2 API the photos endpoint uses, preserving
 * httpMetadata.contentType across put/get/head.
 */
export function createMockR2() {
  const store = new Map();

  function toBytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice();
    }
    if (typeof value === 'string') return new TextEncoder().encode(value);
    throw new Error('Unsupported R2 put value type');
  }

  return {
    _store: store,

    async put(key, value, options = {}) {
      const bytes = toBytes(value);
      const contentType = options.httpMetadata && options.httpMetadata.contentType;
      store.set(key, { bytes, contentType });
      return { key, etag: 'mock-etag', httpMetadata: { contentType } };
    },

    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        key,
        body: entry.bytes.slice(),
        size: entry.bytes.byteLength,
        httpMetadata: { contentType: entry.contentType },
        async arrayBuffer() {
          return entry.bytes.slice().buffer;
        },
        async text() {
          return new TextDecoder().decode(entry.bytes);
        },
      };
    },

    async head(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        key,
        size: entry.bytes.byteLength,
        httpMetadata: { contentType: entry.contentType },
      };
    },

    async delete(key) {
      store.delete(key);
    },
  };
}

/**
 * Creates standard Cloudflare Pages Functions environment context.
 */
export function createTestEnv(mockDb, custom = {}) {
  return {
    DB: mockDb,
    PHOTOS: createMockR2(),
    DEV_MAIL_MODE: 'console',
    ...custom,
  };
}

/**
 * Invokes a Cloudflare Pages Function endpoint handler with standardized request context.
 */
export async function invokeFunction(handler, {
  method = 'GET',
  url = 'http://localhost/api/test',
  headers = {},
  body = null,
  params = {},
  env = null,
} = {}) {
  const reqHeaders = new Headers();

  // Set default origin to localhost to satisfy sameOrigin() check unless explicitly provided
  if (!('origin' in headers) && !('Origin' in headers)) {
    reqHeaders.set('origin', 'http://localhost');
  }

  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined && v !== null) {
      reqHeaders.set(k, String(v));
    }
  }

  let reqBody = null;
  if (body !== null && method !== 'GET' && method !== 'HEAD') {
    if (typeof body === 'object') {
      if (!reqHeaders.has('content-type')) {
        reqHeaders.set('content-type', 'application/json');
      }
      reqBody = JSON.stringify(body);
    } else {
      reqBody = String(body);
    }
  }

  const request = new Request(url, {
    method,
    headers: reqHeaders,
    body: reqBody,
  });

  return await handler({ request, env, params });
}

/**
 * Parses response into status, headers, and parsed JSON body.
 */
export async function readJson(response) {
  const status = response.status;
  const headers = {};
  for (const [k, v] of response.headers.entries()) {
    headers[k] = v;
  }
  let body = null;
  try {
    const text = await response.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    body = null;
  }
  return { status, headers, body };
}

/**
 * Helper to directly seed a test user into D1.
 */
export async function createDirectUser(env, { email, name = 'Test User', role = 'user', password = 'Password123!', isActive = 1 }) {
  const pwHash = await hashPassword(password);
  const now = Date.now();
  const res = await env.DB.prepare(
    `INSERT INTO users (email, name, role, password_hash, is_active, failed_logins, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
  ).bind(email.toLowerCase(), name, role, pwHash, isActive, now, now).run();

  const userId = res.meta && res.meta.last_row_id;
  return { id: userId, email: email.toLowerCase(), name, role, isActive };
}

/**
 * Helper to create an active session for a user and return the Cookie header string.
 */
export async function createDirectSession(env, userId, requestUrl = 'http://localhost') {
  const session = await createSession(env, userId);
  const fakeReq = new Request(requestUrl);
  const cookieHeader = sessionCookie(session.token, session.expiresAt, fakeReq);
  const cookieValue = cookieHeader.split(';')[0]; // "fasrep_session=token"
  return { session, cookieHeader, cookieValue };
}

/**
 * Dynamically loads Auth Pages Function endpoints.
 */
export async function loadAuthHandlers() {
  const [
    signupRequest,
    signupVerify,
    login,
    logout,
    me,
    state,
    password,
  ] = await Promise.all([
    import('../../functions/api/auth/signup/request.js'),
    import('../../functions/api/auth/signup/verify.js'),
    import('../../functions/api/auth/login.js'),
    import('../../functions/api/auth/logout.js'),
    import('../../functions/api/auth/me.js'),
    import('../../functions/api/auth/state.js'),
    import('../../functions/api/auth/password.js'),
  ]);

  return {
    signupRequest: signupRequest.onRequestPost,
    signupVerify: signupVerify.onRequestPost,
    login: login.onRequestPost,
    logout: logout.onRequestPost,
    me: me.onRequestGet,
    state: state.onRequestGet,
    password: password.onRequestPost,
  };
}

/**
 * Dynamically loads Admin Pages Function endpoints.
 */
export async function loadAdminHandlers() {
  const [usersIndex, usersId] = await Promise.all([
    import('../../functions/api/admin/users/index.js'),
    import('../../functions/api/admin/users/[id].js'),
  ]);

  return {
    usersGet: usersIndex.onRequestGet,
    usersPost: usersIndex.onRequestPost,
    userPatch: usersId.onRequestPatch,
  };
}

/**
 * Dynamically loads Admin Allowlist Pages Function endpoints.
 */
export async function loadAdminAllowlistHandlers() {
  const [allowlistIndex, allowlistEmail] = await Promise.all([
    import('../../functions/api/admin/allowlist/index.js'),
    import('../../functions/api/admin/allowlist/[email].js'),
  ]);

  return {
    allowlistGet: allowlistIndex.onRequestGet,
    allowlistPost: allowlistIndex.onRequestPost,
    allowlistDelete: allowlistEmail.onRequestDelete,
  };
}

/**
 * Dynamically loads the Admin Photos Usage Pages Function endpoint.
 */
export async function loadAdminPhotosUsageHandlers() {
  const photosUsage = await import('../../functions/api/admin/photos-usage.js');

  return {
    photosUsageGet: photosUsage.onRequestGet,
  };
}

/**
 * Dynamically loads Photos (R2) Pages Function endpoints.
 */
export async function loadPhotosHandlers() {
  const photos = await import('../../functions/api/photos/[hash].js');

  return {
    photoGet: photos.onRequestGet,
    photoPut: photos.onRequestPut,
    photoDelete: photos.onRequestDelete,
  };
}

/**
 * Dynamically loads Reports Pages Function endpoints.
 */
export async function loadReportsHandlers() {
  const [reportsIndex, reportsId] = await Promise.all([
    import('../../functions/api/reports/index.js'),
    import('../../functions/api/reports/[id].js'),
  ]);

  return {
    reportsGet: reportsIndex.onRequestGet,
    reportsPost: reportsIndex.onRequestPost,
    reportsOptions: reportsIndex.onRequestOptions,
    reportGet: reportsId.onRequestGet,
    reportPatch: reportsId.onRequestPatch,
    reportDelete: reportsId.onRequestDelete,
  };
}
