import { migrateMonth, type Month, type State } from './model';
import { httpTransport, localMetaStore } from './sync-http';

export { pack, unpack } from './sync-http';

/* Marks months as dirty but older than any server copy, so the server wins on overlap. */
const EPOCH = '1970-01-01T00:00:00.000Z';

export interface SyncMeta {
  username: string | null;
  lastPull: string | null;
  /* Month key mapped to its last local edit time, for months not yet pushed. */
  dirty: Record<string, string>;
}

export interface RemoteMonth {
  month: string;
  updatedAt: string;
  /* Null when the month was deleted. */
  value: Month | null;
}

export interface SyncStatus {
  username: string | null;
  pending: boolean;
  error: boolean;
}

/* A failed call carries its HTTP status; 401 ends the session, 0 is a network failure. */
export type Reply<T> = { ok: true; value: T } | { ok: false; status: number };

export interface Transport {
  /* Every month row changed after `since`, or all rows when it is null. */
  pull(since: string | null): Promise<Reply<RemoteMonth[]>>;
  put(month: string, value: Month): Promise<Reply<null>>;
  remove(month: string): Promise<Reply<null>>;
  /* The signed-in username, or the API error code. */
  signIn(kind: 'login' | 'signup', username: string, password: string): Promise<{ username: string } | { error: string }>;
  signOut(): Promise<void>;
}

export interface MetaStore {
  load(): SyncMeta | null;
  save(meta: SyncMeta): void;
}

type Apply = (months: Record<string, Month | null>) => void;

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

function blankMeta(): SyncMeta {
  return { username: null, lastPull: null, dirty: {} };
}

function snapshot(months: Record<string, Month>) {
  const out: Record<string, string> = {};
  for (const k in months) out[k] = JSON.stringify(months[k]);
  return out;
}

/* Keeps local months and the server in step. Timers use the global setTimeout. */
export function createSyncEngine(transport: Transport, store: MetaStore) {
  let meta = blankMeta();
  let current: State | null = null;
  /* JSON of each month as last seen, to tell which months an edit touched. */
  let known: Record<string, string> = {};
  let apply: Apply = () => {};
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
    store.save(meta);
    notify();
  }

  function endSession() {
    meta = blankMeta();
    saveMeta();
  }

  /* Throws on failure, after ending the session on a 401. */
  function check<T>(reply: Reply<T>, what: string): T {
    if (reply.ok) return reply.value;
    if (reply.status === 401) endSession();
    throw new Error(what + ' ' + reply.status);
  }

  function track(state: State) {
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
    const remote = check(await transport.pull(meta.lastPull), 'pull');
    const { taken, dirty } = mergeRemote(remote, meta.dirty);
    const months: Record<string, Month | null> = {};
    for (const k in taken) {
      const value = taken[k];
      months[k] = value ? migrateMonth(k, value) : null;
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
        check(month ? await transport.put(k, month) : await transport.remove(k), 'push');
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

  async function sync() {
    try {
      await pull();
      await push();
    } catch {
      error = true;
      saveMeta();
    }
  }

  /* Loads the meta, then pulls and pushes once. */
  function start(state: State, applyRemote: Apply) {
    meta = store.load() || blankMeta();
    current = state;
    known = snapshot(state.months);
    apply = applyRemote;
    notify();
    return sync();
  }

  /* Returns an error code from the API, or null on success. */
  async function signIn(kind: 'login' | 'signup', username: string, password: string): Promise<string | null> {
    const res = await transport.signIn(kind, username, password);
    if ('error' in res) return res.error;
    meta = { username: res.username, lastPull: null, dirty: {} };
    if (current) {
      known = snapshot(current.months);
      for (const k in current.months) meta.dirty[k] = EPOCH;
    }
    saveMeta();
    await sync();
    return null;
  }

  async function signOut() {
    await transport.signOut();
    endSession();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { start, track, sync, push, signIn, signOut, subscribe, getStatus: () => status };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;

/* The app's engine, over HTTP with meta in localStorage. */
const engine = createSyncEngine(httpTransport, localMetaStore);

export const trackState = engine.track;
export const subscribe = engine.subscribe;
export const getStatus = engine.getStatus;
export const signIn = engine.signIn;
export const signOut = engine.signOut;

/* Pulls on window focus and pushes when back online. Returns a cleanup that detaches the listeners. */
export function startSync(state: State, applyRemote: Apply) {
  const onFocus = () => void engine.sync();
  const onOnline = () => void engine.push();
  window.addEventListener('focus', onFocus);
  window.addEventListener('online', onOnline);
  void engine.start(state, applyRemote);
  return () => {
    window.removeEventListener('focus', onFocus);
    window.removeEventListener('online', onOnline);
  };
}
