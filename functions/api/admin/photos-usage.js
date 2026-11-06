import { json, serverError } from '../../_lib/http.js';
import { requireAdmin } from '../../_lib/session.js';
import { r2BudgetBytes } from '../../_lib/r2budget.js';

// R2 photo storage usage (admin only), read from the same photo_objects
// ledger the upload budget guard enforces. A missing ledger table
// reports zeros rather than an error, so the admin panel line simply
// shows an empty bucket before the table is created.
export async function onRequestGet({ request, env }) {
  try {
    const session = await requireAdmin(env, request);
    if (session.error) return session.error;

    let objects = 0;
    let bytesUsed = 0;
    try {
      const row = await env.DB.prepare(
        'SELECT COUNT(*) AS objects, COALESCE(SUM(size_bytes), 0) AS bytes_used FROM photo_objects'
      ).first();
      if (row) {
        objects = Number(row.objects) || 0;
        bytesUsed = Number(row.bytes_used) || 0;
      }
    } catch {
      // Ledger table not created yet: report zeros.
    }

    const budgetBytes = r2BudgetBytes(env);
    const percentUsed = budgetBytes > 0 ? Math.round((bytesUsed / budgetBytes) * 100) : 0;
    return json({ ok: true, objects, bytesUsed, budgetBytes, percentUsed });
  } catch (error) {
    return serverError(error);
  }
}
