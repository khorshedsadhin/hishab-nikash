import { createHash, randomBytes } from 'node:crypto';
import { sql } from './db.js';

const COOKIE = 'hishab_session';
const SESSION_DAYS = 90;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers });
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/* Returns the Set-Cookie header for a new session. */
export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  await sql`
    insert into sessions (token_hash, user_id, expires_at)
    values (decode(${tokenHash(token)}, 'hex'), ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

export function sessionToken(req: Request) {
  const cookies = req.headers.get('cookie') || '';
  const match = cookies.match(new RegExp('(?:^|;\s*)' + COOKIE + '=([^;]+)'));
  return match ? match[1] : null;
}

export async function deleteSession(req: Request) {
  const token = sessionToken(req);
  if (token) await sql`delete from sessions where token_hash = decode(${tokenHash(token)}, 'hex')`;
}

export async function requireUser(req: Request): Promise<{ id: number; username: string } | null> {
  const token = sessionToken(req);
  if (!token) return null;
  const rows = await sql`
    select u.id, u.username from sessions s join users u on u.id = s.user_id
    where s.token_hash = decode(${tokenHash(token)}, 'hex') and s.expires_at > now()`;
  return rows.length ? { id: Number(rows[0].id), username: rows[0].username } : null;
}

export async function readCredentials(req: Request) {
  const body = await req.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  return { username, password };
}
