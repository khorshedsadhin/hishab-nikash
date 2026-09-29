import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { money } from './format';
import {
  blankMonth, carryInto, derive, deriveMonth, headline, makeNewMonth, migrate, reconRows,
  streak, tone, type Month, type State
} from './model';
import { reducer } from '@/state/store';

beforeEach(() => {
  vi.useFakeTimers();
  // 2026-09-15 is a Tuesday; its week runs Mon 14 to Sun 20.
  vi.setSystemTime(new Date(2026, 8, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function september(): Month {
  const m = blankMonth();
  m.income = 15000;
  m.savingsTarget = 2000;
  m.budget.needs = [{ id: 'A', name: 'line-a', amount: 2500, repeat: true }];
  m.budget.wants = [{ id: 'B', name: 'line-b', amount: 1000, repeat: false }];
  m.log = [
    { id: 'e1', date: '2026-09-01', name: 'line-a', cat: 'needs', amount: 1000, lineId: 'A' },
    { id: 'e2', date: '2026-09-15', name: 'entry-2', cat: 'wants', amount: 300, lineId: null },
    { id: 'e3', date: '2026-09-14', name: 'entry-3', cat: 'needs', amount: 200, lineId: null }
  ];
  return m;
}

describe('format', () => {
  it('writes money in Bangla digits', () => {
    expect(money(1234567)).toBe('৳১,২৩৪,৫৬৭');
    expect(money(-500)).toBe('−৳৫০০');
    expect(money(12.6)).toBe('৳১৩');
  });
});

describe('derive', () => {
  it('computes the current month', () => {
    const d = derive(september(), '2026-09');
    expect(d.spendable).toBe(13000);
    expect(d.planned).toBe(3500);
    expect(d.repeating).toBe(2500);
    expect(d.buffer).toBe(9500);
    expect(d.actual).toBe(1500);
    expect(d.remaining).toBe(11500);
    expect(d.committedLeft).toBe(1500);
    expect(d.safeRemaining).toBe(10000);
    expect(d.perCategory.needs).toEqual({ planned: 2500, repeating: 2500, actual: 1200, committed: 1500, unlinked: 200 });
    expect(d.perCategory.wants).toEqual({ planned: 1000, repeating: 0, actual: 300, committed: 0, unlinked: 300 });
    expect(d.daysLeft).toBe(16);
    expect(d.expectedByNow).toBe(6500);
    expect(d.dailyAllowance).toBe(625);
    expect(d.weeklyAllowance).toBe(4375);
    expect(d.thisWeekSpent).toBe(500);
    expect(d.todaySpent).toBe(300);
    expect(d.isCurrent).toBe(true);
    expect(tone(d)).toBe('good');
    expect(headline(d)).toBe('আজ আরও ৳৩২৫ খরচ করা যায়।');
  });

  it('flags committed money that eats everything left', () => {
    const m = blankMonth();
    m.income = 3000;
    m.budget.needs = [{ id: 'A', name: 'line-c', amount: 2500, repeat: true }];
    m.log = [{ id: 'e', date: '2026-09-02', name: '', cat: 'wants', amount: 1000, lineId: null }];
    const d = derive(m, '2026-09');
    expect(d.safeRemaining).toBe(-500);
    expect(d.dailyAllowance).toBe(0);
    expect(d.weeklyAllowance).toBe(0);
    expect(tone(d)).toBe('warn');
    expect(headline(d)).toBe('যা বাকি আছে পুরোটাই বাঁধা খরচে ধরা। নতুন কিছু কিনলে কোনো একটা বিল আটকে যাবে।');
  });

  it('treats a future month as not started', () => {
    const d = derive(blankMonth(), '2026-10');
    expect(d.isFuture).toBe(true);
    expect(d.daysLeft).toBe(31);
    expect(headline(d)).toBe('মাস এখনো শুরু হয়নি।');
  });
});

describe('carry', () => {
  it('carries a past deficit one level into the next month', () => {
    const aug = blankMonth();
    aug.income = 1000;
    aug.log = [{ id: 'x', date: '2026-08-10', name: '', cat: 'needs', amount: 1200, lineId: null }];
    const state: State = { activeMonth: '2026-09', months: { '2026-08': aug, '2026-09': september() } };

    const past = derive(aug, '2026-08');
    expect(past.daysLeft).toBe(1);
    expect(tone(past)).toBe('bad');
    expect(headline(past)).toBe('মাস শেষ। ৳২০০ বেশি গেছে।');

    expect(carryInto(state, '2026-09')).toBe(-200);
    expect(deriveMonth(state, '2026-09').spendable).toBe(12800);
    // September is still running, so nothing carries into October yet.
    state.months['2026-10'] = blankMonth();
    expect(carryInto(state, '2026-10')).toBe(0);
  });
});

describe('reconcile', () => {
  it('compares cash in hand with the ledger', () => {
    const m = september();
    expect(reconRows({ ...m, checks: [{ id: 'c', date: '2026-09-10', amount: 1 }] })[0].expected).toBeNull();

    m.cashStart = 500;
    m.saved = 2000;
    m.checks = [
      { id: 'c1', date: '2026-09-10', amount: 12000 },
      { id: 'c2', date: '2026-09-15', amount: 12000 }
    ];
    const rows = reconRows(m);
    expect(rows.map((r) => r.check.id)).toEqual(['c2', 'c1']);
    expect(rows[1]).toMatchObject({ expected: 12500, gap: 500 });
    expect(rows[0]).toMatchObject({ expected: 12000, gap: 0 });
  });

  it('fills a gap as one unexpected entry', () => {
    const m = september();
    m.cashStart = 500;
    m.saved = 2000;
    m.checks = [{ id: 'c1', date: '2026-09-10', amount: 12000 }];
    const next = reducer({ activeMonth: '2026-09', months: { '2026-09': m } }, { type: 'fillGap', checkId: 'c1' });
    const added = next.months['2026-09'].log.at(-1)!;
    expect(added).toMatchObject({ date: '2026-09-10', name: 'অজানা খরচ', cat: 'unexpected', amount: 500, lineId: null });
    expect(next.months['2026-09'].loggedDays).toContain('2026-09-10');
  });
});

describe('months', () => {
  it('opens a new month with only repeating lines', () => {
    const n = makeNewMonth(september());
    expect(n.income).toBe(15000);
    expect(n.savingsTarget).toBe(2000);
    expect(n.budget.needs.map((l) => l.name)).toEqual(['line-a']);
    expect(n.budget.needs[0].id).not.toBe('A');
    expect(n.budget.wants).toEqual([]);
    expect(n.log).toEqual([]);
  });

  it('drops the plan link when a spend lands in another month', () => {
    const state: State = { activeMonth: '2026-09', months: { '2026-08': blankMonth(), '2026-09': september() } };
    const next = reducer(state, { type: 'addSpend', date: '2026-08-20', cat: 'needs', amount: 50, pick: 'A', name: '' });
    expect(next.months['2026-08'].log[0]).toMatchObject({ name: 'line-a', lineId: null });
  });

  it('migrates old saves', () => {
    const s = migrate({
      activeMonth: '2026-09',
      months: { '2026-09': { income: 1, savingsTarget: 0, log: [{ id: 'a', date: '2026-09-03', cat: 'needs', amount: 5 }] } }
    });
    const m = s.months['2026-09'];
    expect(m.log[0].lineId).toBeNull();
    expect(m.loggedDays).toEqual(['2026-09-03']);
    expect(m.budget.culture).toEqual([]);
    expect(m.saved).toBeNull();
    expect(m.cashStart).toBeNull();
    expect(m.reflection).toBe('');
  });
});

describe('streak', () => {
  it('warns after more than two blank days', () => {
    const m = blankMonth();
    m.loggedDays = ['2026-09-11'];
    expect(streak({ activeMonth: '2026-09', months: { '2026-09': m } })).toEqual({
      text: 'শেষ লেখা ৪ দিন আগে · ১১ সেপ্টেম্বর',
      warn: true
    });
  });
});
