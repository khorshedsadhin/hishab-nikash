import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankMonth, type Month, type State } from './model';
import { createSyncEngine, mergeRemote, pack, unpack, type MetaStore, type RemoteMonth, type SyncMeta, type Transport } from './sync';
import { parseImport } from './storage';
import { reducer } from '@/state/store';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function remote(month: string, updatedAt: string, savingsTarget: number): RemoteMonth {
  const value = blankMonth();
  value.savingsTarget = savingsTarget;
  return { month, updatedAt, value };
}

describe('sync', () => {
  it('packs and unpacks a month', async () => {
    const m = blankMonth();
    m.log = [{ id: 'e1', date: '2026-09-01', name: 'বাজার', cat: 'needs', amount: 450, lineId: null }];
    const data = await pack(m);
    expect(await unpack(data)).toEqual(m);
  });

  it('takes remote months that are not edited locally', () => {
    const { taken, dirty } = mergeRemote([remote('2026-09', '2026-09-10T00:00:00.000Z', 100)], {});
    expect(taken['2026-09']?.savingsTarget).toBe(100);
    expect(dirty).toEqual({});
  });

  it('takes the remote month when it is newer than the local edit', () => {
    const { taken, dirty } = mergeRemote([remote('2026-09', '2026-09-10T00:00:00.000Z', 100)], {
      '2026-09': '2026-09-09T00:00:00.000Z'
    });
    expect(taken['2026-09']?.savingsTarget).toBe(100);
    expect(dirty).toEqual({});
  });

  it('keeps a local edit newer than the remote month', () => {
    const local = { '2026-09': '2026-09-11T00:00:00.000Z' };
    const { taken, dirty } = mergeRemote([remote('2026-09', '2026-09-10T00:00:00.000Z', 100)], local);
    expect(taken).toEqual({});
    expect(dirty).toEqual(local);
  });

  it('leaves local-only months dirty for push', () => {
    const local = { '2026-08': '1970-01-01T00:00:00.000Z' };
    const { taken, dirty } = mergeRemote([remote('2026-09', '2026-09-10T00:00:00.000Z', 100)], local);
    expect(Object.keys(taken)).toEqual(['2026-09']);
    expect(dirty).toEqual(local);
  });

  it('merges remote months into state and keeps the active month', () => {
    const state: State = { activeMonth: '2026-08', months: { '2026-08': blankMonth(), '2026-09': blankMonth() } };
    const value = blankMonth();
    value.savingsTarget = 500;
    const next = reducer(state, { type: 'mergeRemote', months: { '2026-09': value } });
    expect(next.activeMonth).toBe('2026-08');
    expect(next.months['2026-08']).toBe(state.months['2026-08']);
    expect(next.months['2026-09'].savingsTarget).toBe(500);
  });

  it('takes a remote delete unless the local edit is newer', () => {
    const deleted: RemoteMonth = { month: '2026-09', updatedAt: '2026-09-10T00:00:00.000Z', value: null };
    expect(mergeRemote([deleted], {}).taken).toEqual({ '2026-09': null });
    expect(mergeRemote([deleted], { '2026-09': '2026-09-11T00:00:00.000Z' }).taken).toEqual({});
  });

  it('drops a month deleted remotely', () => {
    const state: State = { activeMonth: '2026-09', months: { '2026-08': blankMonth(), '2026-09': blankMonth() } };
    const next = reducer(state, { type: 'mergeRemote', months: { '2026-09': null } });
    expect(Object.keys(next.months)).toEqual(['2026-08']);
    expect(next.activeMonth).toBe('2026-08');
  });
});

describe('deleteMonth', () => {
  it('moves to the newest remaining month', () => {
    const state: State = {
      activeMonth: '2026-08',
      months: { '2026-07': blankMonth(), '2026-08': blankMonth(), '2026-09': blankMonth() }
    };
    const next = reducer(state, { type: 'deleteMonth' });
    expect(Object.keys(next.months).sort()).toEqual(['2026-07', '2026-09']);
    expect(next.activeMonth).toBe('2026-09');
  });

  it('leaves a blank current month when the last month is deleted', () => {
    const m = blankMonth();
    m.savingsTarget = 500;
    const next = reducer({ activeMonth: '2026-05', months: { '2026-05': m } }, { type: 'deleteMonth' });
    expect(next.activeMonth).toBe('2026-09');
    expect(next.months).toEqual({ '2026-09': blankMonth() });
  });
});

describe('ingest', () => {
  it('migrates an imported backup and rejects a foreign file', () => {
    const result = parseImport(JSON.stringify({ activeMonth: '2026-09', months: { '2026-09': { income: 1, savingsTarget: 0 } } }));
    if (!('state' in result)) throw new Error('expected a state');
    expect(result.state.months['2026-09'].incomes[0].amount).toBe(1);
    expect(result.state.months['2026-09'].log).toEqual([]);
    expect('error' in parseImport('{"a":1}')).toBe(true);
    expect('error' in parseImport('{"activeMonth":"2026-09","months":{"2026-09":1}}')).toBe(true);
  });
});

/* An in-memory server with the same rules as api/months.ts. */
function memoryServer() {
  const rows: Record<string, RemoteMonth> = {};
  const calls: string[] = [];
  const server = { rows, calls, failWith: null as number | null };
  const stamp = () => new Date().toISOString();
  const transport: Transport = {
    async pull(since) {
      calls.push('pull');
      if (server.failWith) return { ok: false, status: server.failWith };
      return { ok: true, value: Object.values(rows).filter((r) => !since || r.updatedAt > since).map((r) => structuredClone(r)) };
    },
    async put(month, value) {
      calls.push('put ' + month);
      if (server.failWith) return { ok: false, status: server.failWith };
      rows[month] = { month, updatedAt: stamp(), value: structuredClone(value) };
      return { ok: true, value: null };
    },
    async remove(month) {
      calls.push('delete ' + month);
      if (server.failWith) return { ok: false, status: server.failWith };
      rows[month] = { month, updatedAt: stamp(), value: null };
      return { ok: true, value: null };
    },
    async signIn(_kind, username) {
      calls.push('signIn');
      return { username };
    },
    async signOut() {
      calls.push('signOut');
    }
  };
  return { server, transport };
}

function memoryMeta(initial: SyncMeta | null): MetaStore & { saved: SyncMeta | null } {
  const store = {
    saved: initial ? structuredClone(initial) : null,
    load: () => (store.saved ? structuredClone(store.saved) : null),
    save: (meta: SyncMeta) => {
      store.saved = structuredClone(meta);
    }
  };
  return store;
}

function withTarget(savingsTarget: number): Month {
  const m = blankMonth();
  m.savingsTarget = savingsTarget;
  return m;
}

/* Wires an engine to the reducer the way StoreProvider does. */
function setup(state: State, meta: SyncMeta | null = { username: 'user-a', lastPull: null, dirty: {} }) {
  const { server, transport } = memoryServer();
  const metaStore = memoryMeta(meta);
  const engine = createSyncEngine(transport, metaStore);
  const app = { state };
  const edit = (next: State) => {
    app.state = next;
    engine.track(next);
  };
  const start = () => engine.start(app.state, (months) => edit(reducer(app.state, { type: 'mergeRemote', months })));
  return { server, metaStore, engine, app, edit, start };
}

describe('sync engine', () => {
  const later = (ms: number) => new Date(Date.now() + ms).toISOString();

  it('pushes an edit 2 seconds after it is made', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    await t.start();
    t.edit({ ...t.app.state, months: { '2026-09': withTarget(300) } });
    expect(t.engine.getStatus().pending).toBe(true);

    await vi.advanceTimersByTimeAsync(1999);
    expect(t.server.calls).not.toContain('put 2026-09');
    await vi.advanceTimersByTimeAsync(1);
    expect(t.server.calls).toContain('put 2026-09');
    expect(t.server.rows['2026-09'].value?.savingsTarget).toBe(300);
    expect(t.engine.getStatus().pending).toBe(false);
    expect(t.metaStore.saved?.dirty).toEqual({});
  });

  it('pushes a local delete as a DELETE', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-08': blankMonth(), '2026-09': blankMonth() } });
    await t.start();
    t.edit(reducer({ ...t.app.state, activeMonth: '2026-08' }, { type: 'deleteMonth' }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.server.calls).toContain('delete 2026-08');
    expect(t.server.rows['2026-08'].value).toBeNull();
  });

  it('replaces a local month with a newer remote copy', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    await t.start();
    t.edit({ ...t.app.state, months: { '2026-09': withTarget(300) } });
    t.server.rows['2026-09'] = { month: '2026-09', updatedAt: later(60_000), value: withTarget(700) };

    await t.engine.sync();
    expect(t.app.state.months['2026-09'].savingsTarget).toBe(700);
    expect(t.engine.getStatus().pending).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.server.calls).not.toContain('put 2026-09');
  });

  it('keeps a local edit newer than the remote copy', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    await t.start();
    t.server.rows['2026-09'] = { month: '2026-09', updatedAt: later(-60_000), value: withTarget(700) };
    t.edit({ ...t.app.state, months: { '2026-09': withTarget(300) } });

    await t.engine.sync();
    expect(t.app.state.months['2026-09'].savingsTarget).toBe(300);
    expect(t.server.rows['2026-09'].value?.savingsTarget).toBe(300);
  });

  it('migrates pulled months', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    const old = { savingsTarget: 0, income: 1, log: [] } as unknown as Month;
    t.server.rows['2026-08'] = { month: '2026-08', updatedAt: later(60_000), value: old };
    await t.start();
    const m = t.app.state.months['2026-08'];
    expect(m.incomes).toEqual([{ id: 'income-2026-08', name: 'আয়', amount: 1, date: '2026-08-01', repeat: true }]);
    expect(m.budget.needs).toEqual([]);
  });

  it('on login, uploads local-only months and lets the server copy win on overlap', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-08': withTarget(100), '2026-09': withTarget(200) } }, null);
    await t.start();
    expect(t.server.calls).toEqual([]);
    t.server.rows['2026-09'] = { month: '2026-09', updatedAt: later(-86_400_000), value: withTarget(900) };
    t.server.rows['2026-10'] = { month: '2026-10', updatedAt: later(-86_400_000), value: withTarget(50) };

    expect(await t.engine.signIn('login', 'user-a', 'secret')).toBeNull();
    expect(t.engine.getStatus().username).toBe('user-a');
    expect(t.app.state.months['2026-09'].savingsTarget).toBe(900);
    expect(t.app.state.months['2026-10'].savingsTarget).toBe(50);
    expect(t.server.rows['2026-08'].value?.savingsTarget).toBe(100);
    expect(t.server.calls).not.toContain('put 2026-09');
    expect(t.engine.getStatus().pending).toBe(false);
  });

  it('ends the session on a 401', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    t.server.failWith = 401;
    await t.start();
    expect(t.engine.getStatus().username).toBeNull();
    expect(t.metaStore.saved).toEqual({ username: null, lastPull: null, dirty: {} });
  });

  it('keeps months dirty and sets error when a push fails', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    await t.start();
    t.server.failWith = 500;
    t.edit({ ...t.app.state, months: { '2026-09': withTarget(300) } });
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.engine.getStatus()).toEqual({ username: 'user-a', pending: true, error: true });
    expect(Object.keys(t.metaStore.saved?.dirty || {})).toEqual(['2026-09']);

    t.server.failWith = null;
    await t.engine.push();
    expect(t.engine.getStatus()).toEqual({ username: 'user-a', pending: false, error: false });
    expect(t.server.rows['2026-09'].value?.savingsTarget).toBe(300);
  });

  it('notifies subscribers and signs out', async () => {
    const t = setup({ activeMonth: '2026-09', months: { '2026-09': blankMonth() } });
    const seen: (string | null)[] = [];
    t.engine.subscribe(() => seen.push(t.engine.getStatus().username));
    await t.start();
    await t.engine.signOut();
    expect(t.server.calls).toContain('signOut');
    expect(seen.at(-1)).toBeNull();
    expect(t.metaStore.saved?.username).toBeNull();
  });
});
