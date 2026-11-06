import { error, json, readJsonBody, serverError, CORS_HEADERS } from '../../_lib/http.js';
import { requireUser } from '../../_lib/session.js';

export function formatReportMeta(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id || null,
    user_id: row.user_id || null,
    moduleType: row.module_type || 'prototype',
    module_type: row.module_type || 'prototype',
    reportTitle: row.report_title || '',
    report_title: row.report_title || '',
    productName: row.product_name || '',
    product_name: row.product_name || '',
    modelNumber: row.model_number || '',
    model_number: row.model_number || '',
    poNumber: row.po_number || '',
    po_number: row.po_number || '',
    factory: row.factory || '',
    verdict: row.verdict || '',
    photoCount: Number(row.photo_count) || 0,
    photo_count: Number(row.photo_count) || 0,
    thumbSmall: row.thumb_small || '',
    thumb_small: row.thumb_small || '',
    revision: Number(row.revision) || 1,
    createdAt: row.created_at || '',
    created_at: row.created_at || '',
    updatedAt: row.updated_at || '',
    updated_at: row.updated_at || '',
  };
}

export function extractPhotoCount(body) {
  if (typeof body.photoCount === 'number') return body.photoCount;
  if (typeof body.photo_count === 'number') return body.photo_count;

  let count = 0;
  const photoArrays = [
    body.prodPhotos,
    body.assemblyPhotos,
    body.watchoutPhotos,
    body.testingPhotos,
    body.checklistPhotos,
    body.comparisonPhotos,
  ];

  for (const arr of photoArrays) {
    if (Array.isArray(arr)) {
      count += arr.length;
    }
  }

  if (body.coverPhotos && typeof body.coverPhotos === 'object') {
    count += Object.values(body.coverPhotos).filter(Boolean).length;
  }

  return count;
}

export function extractVerdict(body) {
  if (body.verdict && typeof body.verdict === 'string') return body.verdict.trim();
  if (body.rating && typeof body.rating === 'string') return body.rating.trim();
  if (body.checks && typeof body.checks.rating === 'object' && body.checks.rating !== null) {
    const active = Object.keys(body.checks.rating).find(key => Boolean(body.checks.rating[key]));
    if (active) return active;
  }
  return '';
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env || !env.DB) {
      return serverError(new Error('D1 database binding (env.DB) is not available'));
    }

    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const url = new URL(request.url);
    const moduleType = url.searchParams.get('moduleType') || url.searchParams.get('module_type') || '';
    const search = url.searchParams.get('search') || url.searchParams.get('q') || '';
    const status = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const whereClauses = ['deleted_at IS NULL'];
    const bindParams = [];

    // Ownership scoping: a regular user only ever lists their own reports.
    // Admins list everything and may narrow the list with ?userId=.
    if (session.user.role === 'admin') {
      const userIdFilter = url.searchParams.get('userId') || url.searchParams.get('user_id');
      if (userIdFilter) {
        whereClauses.push('user_id = ?');
        bindParams.push(userIdFilter);
      }
    } else {
      whereClauses.push('user_id = ?');
      bindParams.push(session.user.id);
    }

    if (moduleType) {
      whereClauses.push('module_type = ?');
      bindParams.push(moduleType);
    }

    if (status) {
      whereClauses.push('verdict = ?');
      bindParams.push(status);
    }

    if (search) {
      const pattern = `%${search}%`;
      whereClauses.push(
        '(report_title LIKE ? OR product_name LIKE ? OR model_number LIKE ? OR po_number LIKE ? OR factory LIKE ?)'
      );
      bindParams.push(pattern, pattern, pattern, pattern, pattern);
    }

    const whereSql = whereClauses.join(' AND ');

    // Count total matching
    const countResult = await env.DB.prepare(
      `SELECT COUNT(*) AS total FROM reports WHERE ${whereSql}`
    ).bind(...bindParams).first();

    const total = countResult ? Number(countResult.total) : 0;

    // Fetch reports page
    const rowsResult = await env.DB.prepare(
      `SELECT id, user_id, module_type, report_title, product_name, model_number, po_number, factory, verdict, photo_count, thumb_small, revision, created_at, updated_at
       FROM reports
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...bindParams, limit, offset).all();

    const reports = (rowsResult.results || []).map(formatReportMeta);

    return json({
      success: true,
      reports,
      total,
      page,
      limit,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env || !env.DB) {
      return serverError(new Error('D1 database binding (env.DB) is not available'));
    }

    const session = await requireUser(env, request);
    if (session.error) return session.error;

    const parsed = await readJsonBody(request);
    if (!parsed.ok) {
      return parsed.response;
    }

    const body = parsed.body;

    // Validate required fields
    if (!body.id || typeof body.id !== 'string' || !body.id.trim()) {
      return error('Validation error: id is required', 400);
    }

    const reportTitle = (body.reportTitle || body.report_title || '').trim();
    const productName = (body.productName || body.product_name || body.desc || '').trim();

    if (!reportTitle && !productName) {
      return error('Validation error: reportTitle or productName is required', 400);
    }

    const id = body.id.trim();
    // The owner is always the session user; body.userId / body.user_id are
    // ignored so a client cannot file a report under someone else's account.
    // (Refined below for the resurrect-a-soft-deleted-report path.)
    let userId = session.user.id;
    const moduleType = (body.moduleType || body.module_type || 'prototype').trim();
    const modelNumber = (body.modelNumber || body.model_number || body.model || '').trim();
    const poNumber = (body.poNumber || body.po_number || body.po || '').trim();
    const factory = (body.factory || '').trim();
    const verdict = extractVerdict(body);
    const photoCount = extractPhotoCount(body);
    const thumbSmall = (body.thumbSmall || body.thumb_small || '').trim();
    const revision = 1;
    const nowIso = new Date().toISOString();
    const createdAt = body.createdAt || body.created_at || nowIso;
    const updatedAt = body.updatedAt || body.updated_at || nowIso;

    // Check if report already exists and is not soft-deleted
    const existing = await env.DB.prepare(
      'SELECT id, user_id, revision, deleted_at FROM reports WHERE id = ?'
    ).bind(id).first();

    if (existing && !existing.deleted_at) {
      return error('Report with this id already exists', 409);
    }

    // A soft-deleted report still belongs to its owner: someone else may not
    // resurrect the id under their own account.
    if (
      existing &&
      session.user.role !== 'admin' &&
      existing.user_id != null &&
      String(existing.user_id) !== String(session.user.id)
    ) {
      return error('Report not found', 404);
    }

    // Resurrecting a soft-deleted report keeps its original owner.
    if (existing && existing.user_id != null) {
      userId = existing.user_id;
    }
    body.userId = String(userId);
    body.user_id = String(userId);

    // Split full JSON payload into 500KB chunks
    const fullPayloadStr = JSON.stringify(body);
    const CHUNK_SIZE = 500000;
    const chunks = [];
    for (let i = 0; i < fullPayloadStr.length; i += CHUNK_SIZE) {
      chunks.push(fullPayloadStr.slice(i, i + CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    const totalChunks = chunks.length;

    // Statements
    const statements = [];

    // If report previously existed as soft-deleted, overwrite; else insert
    if (existing) {
      statements.push(
        env.DB.prepare(
          `UPDATE reports SET
             user_id = ?, module_type = ?, report_title = ?, product_name = ?, model_number = ?,
             po_number = ?, factory = ?, verdict = ?, photo_count = ?, thumb_small = ?,
             revision = ?, created_at = ?, updated_at = ?, deleted_at = NULL
           WHERE id = ?`
        ).bind(
          userId,
          moduleType,
          reportTitle || 'PROTOTYPE SAMPLE REVIEW REPORT',
          productName,
          modelNumber,
          poNumber,
          factory,
          verdict,
          photoCount,
          thumbSmall,
          revision,
          createdAt,
          updatedAt,
          id
        )
      );
      statements.push(
        env.DB.prepare('DELETE FROM report_payload_chunks WHERE id = ?').bind(id)
      );
    } else {
      statements.push(
        env.DB.prepare(
          `INSERT INTO reports (
             id, user_id, module_type, report_title, product_name, model_number,
             po_number, factory, verdict, photo_count, thumb_small, revision,
             created_at, updated_at, deleted_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
        ).bind(
          id,
          userId,
          moduleType,
          reportTitle || 'PROTOTYPE SAMPLE REVIEW REPORT',
          productName,
          modelNumber,
          poNumber,
          factory,
          verdict,
          photoCount,
          thumbSmall,
          revision,
          createdAt,
          updatedAt
        )
      );
    }

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
      revision: 1,
      message: 'Report created',
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
