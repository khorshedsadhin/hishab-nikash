import type { Month } from './model';
import type { MetaStore, RemoteMonth, Reply, SyncMeta, Transport } from './sync';

const META_KEY = 'hishab-sync';

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

function api(path: string, init: RequestInit = {}) {
  return fetch('/api/' + path, { ...init, headers: { 'Content-Type': 'application/json' } });
}

/* A network failure comes back as status 0. */
async function monthsCall(path: string, init?: RequestInit): Promise<Reply<null>> {
  try {
    const res = await api(path, init);
    return res.ok ? { ok: true, value: null } : { ok: false, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/* Talks to the functions in api/: one gzipped row per month. */
export const httpTransport: Transport = {
  async pull(since) {
    let res: Response;
    try {
      res = await api('months' + (since ? '?since=' + encodeURIComponent(since) : ''));
    } catch {
      return { ok: false, status: 0 };
    }
    if (!res.ok) return { ok: false, status: res.status };
    const body: { months: { month: string; data: string | null; updatedAt: string }[] } = await res.json();
    const months: RemoteMonth[] = await Promise.all(
      body.months.map(async (r) => ({ month: r.month, updatedAt: r.updatedAt, value: r.data ? await unpack(r.data) : null }))
    );
    return { ok: true, value: months };
  },
  async put(month, value) {
    return monthsCall('months?month=' + month, { method: 'PUT', body: JSON.stringify({ data: await pack(value) }) });
  },
  remove(month) {
    return monthsCall('months?month=' + month, { method: 'DELETE' });
  },
  async signIn(kind, username, password) {
    let res: Response;
    try {
      res = await api(kind, { method: 'POST', body: JSON.stringify({ username, password }) });
    } catch {
      return { error: 'network' };
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: body.error || 'network' };
    return { username: body.username };
  },
  async signOut() {
    await api('logout', { method: 'POST' }).catch(() => {});
  }
};

export const localMetaStore: MetaStore = {
  load() {
    try {
      const m = JSON.parse(localStorage.getItem(META_KEY) || 'null');
      if (m && typeof m.dirty === 'object') return m as SyncMeta;
    } catch {
      /* fall through to a logged-out state */
    }
    return null;
  },
  save(meta) {
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch {
      /* storage full or blocked: sync still works for this session */
    }
  }
};
