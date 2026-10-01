import { migrate, type Month, type State } from './model';

const META_KEY = 'hishab-sync';
/* Marks months as dirty but older than any server copy, so the server wins on overlap. */
const EPOCH = '1970-01-01T00:00:00.000Z';

interface Meta {
  username: string | null;
  lastPull: string | null;
  /* month key -> when it was last edited locally and not yet pushed */
  dirty: Record<string, string>;
}

export interface RemoteMonth {
  month: string;
  updatedAt: string;
  /* null when the month was deleted */
  value: Month | null;
}

export interface SyncStatus {
  username: string | null;
  pending: boolean;
  error: boolean;
}

export async function pack(month: Month): Promise<string> {
  const gz = new Blob([JSON.stringify(month)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(gz).arrayBuffer());
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function unpack(data: string): Promise<Month> {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(text);
}

/* Last write wins per month: a local edit survives only if it is newer than the server copy. */
export function mergeRemote(remote: RemoteMonth[], dirty: Record<string, string>) {
  const taken: Record<string, Month | null> = {};
  const next = { ...dirty };
  for (const r of remote) {
    if (next[r.month] && next[r.month] > r.updatedAt) continue;
    taken[r.month] = r.value;
    delete next[r.month];
  }
  return { taken, dirty: next };
}

function blankMeta(): Meta {
  return { username: null, lastPull: null, dirty: {} };
}

function loadMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
    if (m && typeof m.dirty === 'object') return m;
  } catch {
    /* fall through to a logged-out state */
  }
  return blankMeta();
}

let meta = blankMeta();
let current: State | null = null;
/* JSON of each month as last seen, to tell which months an edit touched. */
let known: Record<string, string> = {};
let apply: (months: Record<string, Month | null>) => void = () => {};
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pushing = false;
let error = false;
let status: SyncStatus = { username: null, pending: false, error };
const listeners = new Set<() => void>();

function notify() {
  status = { username: meta.username, pending: Object.keys(meta.dirty).length > 0, error };
  listeners.forEach((l) => l());
}

function saveMeta() {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    /* storage full or blocked: sync still works for this session */
  }
  notify();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getStatus() {
  return status;
}

function snapshot(months: Record<string, Month>) {
  const out: Record<string, string> = {};
  for (const k in months) out[k] = JSON.stringify(months[k]);
  return out;
}

function endSession() {
  meta = blankMeta();
  saveMeta();
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch('/api/' + path, { ...init, headers: { 'Content-Type': 'application/json' } });
  if (res.status === 401 && path.startsWith('months')) endSession();
  return res;
}

export function trackState(state: State) {
  current = state;
  if (!meta.username) return;
  const now = new Date().toISOString();
  let changed = false;
  for (const k in known) {
    if (state.months[k]) continue;
    delete known[k];
    meta.dirty[k] = now;
    changed = true;
  }
  for (const k in state.months) {
    const json = JSON.stringify(state.months[k]);
    if (json === known[k]) continue;
    known[k] = json;
    meta.dirty[k] = now;
    changed = true;
  }
  if (changed) {
    saveMeta();
    schedulePush();
  }
}

async function pull() {
  if (!meta.username || !current) return;
  const res = await api('months' + (meta.lastPull ? '?since=' + encodeURIComponent(meta.lastPull) : ''));
  if (!res.ok) throw new Error('pull ' + res.status);
  const body: { months: { month: string; data: string | null; updatedAt: string }[] } = await res.json();
  const remote = await Promise.all(
    body.months.map(async (r) => ({ month: r.month, updatedAt: r.updatedAt, value: r.data ? await unpack(r.data) : null }))
  );

  const { taken, dirty } = mergeRemote(remote, meta.dirty);
  const kept: Record<string, Month> = {};
  for (const k in taken) if (taken[k]) kept[k] = taken[k];
  const months: Record<string, Month | null> = { ...taken, ...migrate({ months: kept }).months };
  for (const k in months) {
    if (months[k]) known[k] = JSON.stringify(months[k]);
    else delete known[k];
  }
  meta.dirty = dirty;
  for (const r of remote) if (!meta.lastPull || r.updatedAt > meta.lastPull) meta.lastPull = r.updatedAt;
  saveMeta();
  if (Object.keys(months).length) apply(months);
}

async function push() {
  if (!meta.username || !current || pushing) return;
  pushing = true;
  try {
    for (const k of Object.keys(meta.dirty)) {
      const editedAt = meta.dirty[k];
      const month = current.months[k];
      const res = month
        ? await api('months?month=' + k, { method: 'PUT', body: JSON.stringify({ data: await pack(month) }) })
        : await api('months?month=' + k, { method: 'DELETE' });
      if (!res.ok) throw new Error('push ' + res.status);
      if (meta.dirty[k] === editedAt) delete meta.dirty[k];
    }
    error = false;
  } catch {
    error = true;
  } finally {
    pushing = false;
    saveMeta();
  }
  if (!error && Object.keys(meta.dirty).length) schedulePush();
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => void push(), 2000);
}

async function syncNow() {
  try {
    await pull();
    await push();
  } catch {
    error = true;
    saveMeta();
  }
}

/* Returns a cleanup that detaches the window listeners. */
export function startSync(state: State, applyRemote: (months: Record<string, Month | null>) => void) {
  meta = loadMeta();
  current = state;
  known = snapshot(state.months);
  apply = applyRemote;
  notify();
  const onFocus = () => void syncNow();
  const onOnline = () => void push();
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  void syncNow();
  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
  };
}

/* Returns an error code from the API, or null on success. */
export async function signIn(kind: 'login' | 'signup', username: string, password: string): Promise<string | null> {
  let res: Response;
  try {
    res = await api(kind, { method: 'POST', body: JSON.stringify({ username, password }) });
  } catch {
    return 'network';
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return body.error || 'network';

  meta = { username: body.username, lastPull: null, dirty: {} };
  if (current) {
    known = snapshot(current.months);
    for (const k in current.months) meta.dirty[k] = EPOCH;
  }
  saveMeta();
  await syncNow();
  return null;
}

export async function signOut() {
  await api('logout', { method: 'POST' }).catch(() => {});
  endSession();
}
