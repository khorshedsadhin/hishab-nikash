import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankMonth, type State } from './model';
import { mergeRemote, pack, unpack, type RemoteMonth } from './sync';
import { reducer } from '@/state/store';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function remote(month: string, updatedAt: string, income: number): RemoteMonth {
  const value = blankMonth();
  value.income = income;
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
    expect(taken['2026-09']?.income).toBe(100);
    expect(dirty).toEqual({});
  });

  it('takes the remote month when it is newer than the local edit', () => {
    const { taken, dirty } = mergeRemote([remote('2026-09', '2026-09-10T00:00:00.000Z', 100)], {
      '2026-09': '2026-09-09T00:00:00.000Z'
    });
    expect(taken['2026-09']?.income).toBe(100);
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
    value.income = 500;
    const next = reducer(state, { type: 'mergeRemote', months: { '2026-09': value } });
    expect(next.activeMonth).toBe('2026-08');
    expect(next.months['2026-08']).toBe(state.months['2026-08']);
    expect(next.months['2026-09'].income).toBe(500);
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
    m.income = 500;
    const next = reducer({ activeMonth: '2026-05', months: { '2026-05': m } }, { type: 'deleteMonth' });
    expect(next.activeMonth).toBe('2026-09');
    expect(next.months).toEqual({ '2026-09': blankMonth() });
  });
});
