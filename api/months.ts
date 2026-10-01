import { sql } from './_lib/db.js';
import { json, requireUser } from './_lib/auth.js';

const MAX_BYTES = 256 * 1024;

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: 'auth' }, 401);
  const since = new URL(req.url).searchParams.get('since') || '1970-01-01T00:00:00Z';
  const rows = await sql`
    select month, encode(data, 'base64') as data, updated_at from months
    where user_id = ${user.id} and updated_at > ${since}::timestamptz`;
  return json({
    months: rows.map((r) => ({ month: r.month, data: r.data && r.data.replace(/\n/g, ''), updatedAt: new Date(r.updated_at).toISOString() }))
  });
}

function monthParam(req: Request) {
  const month = new URL(req.url).searchParams.get('month') || '';
  return /^\d{4}-\d{2}$/.test(month) ? month : null;
}

export async function PUT(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: 'auth' }, 401);
  const month = monthParam(req);
  if (!month) return json({ error: 'month' }, 400);
  const body = await req.json().catch(() => null);
  const data = typeof body?.data === 'string' ? body.data : '';
  if (!data || data.length > (MAX_BYTES * 4) / 3) return json({ error: 'data' }, 400);

  const rows = await sql`
    insert into months (user_id, month, data, updated_at)
    values (${user.id}, ${month}, decode(${data}, 'base64'), now())
    on conflict (user_id, month) do update set data = excluded.data, updated_at = excluded.updated_at
    returning updated_at`;
  return json({ updatedAt: new Date(rows[0].updated_at).toISOString() });
}

export async function DELETE(req: Request) {
  const user = await requireUser(req);
  if (!user) return json({ error: 'auth' }, 401);
  const month = monthParam(req);
  if (!month) return json({ error: 'month' }, 400);

  const rows = await sql`
    insert into months (user_id, month, data, updated_at)
    values (${user.id}, ${month}, null, now())
    on conflict (user_id, month) do update set data = null, updated_at = excluded.updated_at
    returning updated_at`;
  return json({ updatedAt: new Date(rows[0].updated_at).toISOString() });
}
