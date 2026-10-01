import { verify } from '@node-rs/argon2';
import { sql } from './_lib/db.js';
import { createSession, json, readCredentials } from './_lib/auth.js';

const MAX_FAILS = 10;

export async function POST(req: Request) {
  const { username, password } = await readCredentials(req);
  const rows = await sql`
    select id, pass_hash, locked_until > now() as locked from users where username = ${username}`;
  const user = rows[0];
  if (!user) return json({ error: 'invalid' }, 401);
  if (user.locked) return json({ error: 'locked' }, 429);

  if (!(await verify(user.pass_hash, password))) {
    await sql`
      update users set
        failed = case when failed + 1 >= ${MAX_FAILS} then 0 else failed + 1 end,
        locked_until = case when failed + 1 >= ${MAX_FAILS} then now() + interval '15 minutes' else locked_until end
      where id = ${user.id}`;
    return json({ error: 'invalid' }, 401);
  }

  await sql`update users set failed = 0, locked_until = null where id = ${user.id}`;
  const cookie = await createSession(Number(user.id));
  return json({ username }, 200, { 'Set-Cookie': cookie });
}
