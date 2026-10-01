import { hash } from '@node-rs/argon2';
import { sql } from './_lib/db.js';
import { createSession, json, readCredentials } from './_lib/auth.js';

export async function POST(req: Request) {
  const { username, password } = await readCredentials(req);
  if (!/^[a-z0-9_.]{3,32}$/.test(username)) return json({ error: 'username' }, 400);
  if (password.length < 8 || password.length > 256) return json({ error: 'password' }, 400);

  const passHash = await hash(password);
  const rows = await sql`
    insert into users (username, pass_hash) values (${username}, ${passHash})
    on conflict (username) do nothing returning id`;
  if (!rows.length) return json({ error: 'taken' }, 409);

  const cookie = await createSession(Number(rows[0].id));
  return json({ username }, 200, { 'Set-Cookie': cookie });
}
