import { clearCookie, deleteSession, json } from './_lib/auth.js';

export async function POST(req: Request) {
  await deleteSession(req);
  return json({}, 200, { 'Set-Cookie': clearCookie });
}
