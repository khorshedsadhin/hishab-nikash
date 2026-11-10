import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { money } from './format';
import {
  blankMonth, bookBalance, canClose, carryInto, derive, deriveMonth, expectedAt, headline, makeNewMonth,
  isBlank, migrate, reconRows, streak, tone, type Month, type State
} from './model';
import { reducer } from '@/state/store';

beforeEach(() => {
  vi.useFakeTimers();
  // 2026-09-15 is a Tuesday; its week runs Sat 12 to Fri 18.
  vi.setSystemTime(new Date(2026, 8, 15, 12));
});

afterEach(() => {
  vi.useRealTimers();
});

function september(): Month {
  const m = blankMonth();
  m.incomes = [{ id: 'I', name: 'income-a', amount: 15000, date: '2026-09-01', repeat: true }];
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
    expect(d.week).toEqual({
      start: '2026-09-12',
      end: '2026-09-18',
      days: ['2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'],
      // Fixed on Saturday: (13000 - 1000 spent - 1500 still owed) / 19 days * 7.
      budget: 3868,
      spent: 500,
      left: 3368,
      perDay: 553
    });
    expect(d.perDay).toBe(553);
    expect(d.todaySpent).toBe(300);
    expect(d.isCurrent).toBe(true);
    expect(tone(d)).toBe('good');
    expect(headline(d)).toBe('ঠিক পথে আছো।');
  });

  it('flags committed money that eats everything left', () => {
    const m = blankMonth();
    m.incomes = [{ id: 'I', name: '', amount: 3000, date: '2026-09-01', repeat: false }];
    m.budget.needs = [{ id: 'A', name: 'line-c', amount: 2500, repeat: true }];
    m.log = [{ id: 'e', date: '2026-09-02', name: '', cat: 'wants', amount: 1000, lineId: null }];
    const d = derive(m, '2026-09');
    expect(d.safeRemaining).toBe(-500);
    expect(d.week!.budget).toBe(0);
    expect(tone(d)).toBe('warn');
    expect(headline(d)).toBe('যা বাকি আছে পুরোটাই বাঁধা খরচে ধরা। নতুন কিছু কিনলে কোনো একটা বিল আটকে যাবে।');
  });

  it('keeps the week share fixed while spending inside the week', () => {
    const m = september();
    const before = derive(m, '2026-09').week!.budget;
    m.log.push({ id: 'e4', date: '2026-09-15', name: '', cat: 'wants', amount: 2000, lineId: null });
    const d = derive(m, '2026-09');
    expect(d.week!.budget).toBe(before);
    expect(d.week!.left).toBe(before - 2500);
  });

  it('cuts the week at the month start', () => {
    vi.setSystemTime(new Date(2026, 9, 2, 12));
    const m = blankMonth();
    m.incomes = [{ id: 'I', name: '', amount: 3100, date: '2026-10-01', repeat: false }];
    const week = derive(m, '2026-10').week!;
    expect(week.days).toEqual(['2026-10-01', '2026-10-02']);
    expect(week.budget).toBe(200);
    expect(week.perDay).toBe(100);
  });

  it('flags a week that went over its share', () => {
    const m = september();
    m.log.push({ id: 'e4', date: '2026-09-13', name: '', cat: 'wants', amount: 3500, lineId: null });
    expect(headline(derive(m, '2026-09'))).toBe('এই সপ্তাহের ভাগ থেকে ৳১৩২ বেশি গেছে।');
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
    aug.incomes = [{ id: 'I', name: '', amount: 1000, date: '2026-08-01', repeat: false }];
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

  it('uses cash in hand at the start instead of the carry when written', () => {
    const aug = blankMonth();
    aug.incomes = [{ id: 'I', name: '', amount: 5000, date: '2026-08-01', repeat: false }];
    const state: State = { activeMonth: '2026-09', months: { '2026-08': aug, '2026-09': september() } };
    expect(deriveMonth(state, '2026-09').carry).toBe(5000);

    state.months['2026-09'].cashStart = 2000;
    expect(deriveMonth(state, '2026-09').carry).toBe(2000);
    expect(deriveMonth(state, '2026-09').spendable).toBe(15000);

    state.months['2026-09'].cashStart = 0;
    expect(deriveMonth(state, '2026-09').carry).toBe(0);
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

  it('counts income only from the day it arrived', () => {
    const m = september();
    m.cashStart = 0;
    m.incomes.push({ id: 'J', name: 'income-b', amount: 4000, date: '2026-09-12', repeat: false });
    m.incomes.push({ id: 'K', name: 'income-c', amount: 9000, date: null, repeat: false });
    expect(expectedAt(m, '2026-09-11')).toBe(15000 - 1000);
    expect(expectedAt(m, '2026-09-12')).toBe(19000 - 1000);
    expect(derive(m, '2026-09').income).toBe(28000);
    expect(derive(m, '2026-09').received).toBe(19000);
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
    expect(n.incomes).toMatchObject([{ name: 'income-a', amount: 15000, date: null, repeat: true }]);
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

  it('adds a repeat spend on the same day to the existing entry', () => {
    const state: State = { activeMonth: '2026-09', months: { '2026-09': september() } };
    const next = reducer(state, { type: 'addSpend', date: '2026-09-15', cat: 'wants', amount: 20, pick: '', name: ' Entry-2 ' });
    expect(next.months['2026-09'].log).toHaveLength(3);
    expect(next.months['2026-09'].log[1]).toMatchObject({ id: 'e2', name: 'entry-2', amount: 320 });
  });

  it('keeps a same-named spend separate on another day or category', () => {
    let next: State = { activeMonth: '2026-09', months: { '2026-09': september() } };
    next = reducer(next, { type: 'addSpend', date: '2026-09-16', cat: 'wants', amount: 20, pick: '', name: 'entry-2' });
    next = reducer(next, { type: 'addSpend', date: '2026-09-15', cat: 'needs', amount: 20, pick: '', name: 'entry-2' });
    expect(next.months['2026-09'].log).toHaveLength(5);
  });

  it('folds the old learning category into wants', () => {
    const s = migrate({
      activeMonth: '2026-09',
      months: { '2026-09': {
        income: 1, savingsTarget: 0,
        budget: { wants: [{ id: 'B', name: 'line-b', amount: 10, repeat: false }], culture: [{ id: 'C', name: 'line-c', amount: 20, repeat: true }] },
        log: [{ id: 'a', date: '2026-09-03', cat: 'culture', amount: 5, lineId: 'C' }]
      } }
    });
    const m = s.months['2026-09'];
    expect(m.budget.wants.map((l) => l.id)).toEqual(['B', 'C']);
    expect(m.budget.culture).toBeUndefined();
    expect(m.log[0].cat).toBe('wants');
  });

  it('migrates old saves', () => {
    const s = migrate({
      activeMonth: '2026-09',
      months: { '2026-09': { income: 1, savingsTarget: 0, log: [{ id: 'a', date: '2026-09-03', cat: 'needs', amount: 5 }] } }
    });
    const m = s.months['2026-09'];
    expect(m.incomes).toEqual([{ id: 'income-2026-09', name: 'আয়', amount: 1, date: '2026-09-01', repeat: true }]);
    expect('income' in m).toBe(false);
    expect(m.closed).toBe(false);
    expect(m.log[0].lineId).toBeNull();
    expect(m.loggedDays).toEqual(['2026-09-03']);
    expect(m.budget.giving).toEqual([]);
    expect(m.saved).toBeNull();
    expect(m.cashStart).toBeNull();
    expect(m.reflection).toBe('');
    expect(m.locked).toBe(false);
  });
});

describe('lock', () => {
  function locked(): State {
    const m = september();
    m.locked = true;
    return { activeMonth: '2026-09', months: { '2026-09': m } };
  }

  it('refuses plan edits while locked', () => {
    const state = locked();
    expect(reducer(state, { type: 'updateLine', cat: 'needs', id: 'A', amount: 9999 })).toBe(state);
    expect(reducer(state, { type: 'setSavingsTarget', value: 1 })).toBe(state);
  });

  it('still takes spending while locked', () => {
    const next = reducer(locked(), { type: 'addSpend', date: '2026-09-16', cat: 'wants', amount: 50, pick: '', name: 'entry-4' });
    expect(next.months['2026-09'].log.at(-1)!).toMatchObject({ name: 'entry-4', amount: 50 });
  });

  it('takes plan edits again once unlocked', () => {
    const open = reducer(locked(), { type: 'setLocked', value: false });
    expect(open.months['2026-09'].locked).toBe(false);
    expect(reducer(open, { type: 'setSavingsTarget', value: 1 }).months['2026-09'].savingsTarget).toBe(1);
  });

  it('opens a new month unlocked', () => {
    const m = september();
    m.locked = true;
    expect(makeNewMonth(m).locked).toBe(false);
  });
});

describe('income', () => {
  it('adds a mid-month income and moves part of it to savings', () => {
    const state: State = { activeMonth: '2026-09', months: { '2026-09': september() } };
    const next = reducer(state, {
      type: 'addIncome', name: 'income-b', amount: 5000, date: '2026-09-15', repeat: false, toSavings: 2000
    });
    const m = next.months['2026-09'];
    expect(m.incomes.at(-1)).toMatchObject({ name: 'income-b', amount: 5000, date: '2026-09-15' });
    expect(m.savingsTarget).toBe(4000);
    expect(derive(m, '2026-09').spendable).toBe(16000);
  });

  it('refuses income changes while the plan is locked', () => {
    const m = september();
    m.locked = true;
    const state: State = { activeMonth: '2026-09', months: { '2026-09': m } };
    expect(reducer(state, {
      type: 'addIncome', name: '', amount: 100, date: '2026-09-15', repeat: false, toSavings: 0
    })).toBe(state);
    expect(reducer(state, { type: 'updateIncome', id: 'I', amount: 1 })).toBe(state);
    expect(reducer(state, { type: 'deleteIncome', id: 'I' })).toBe(state);
  });

  it('still marks an income as arrived while locked', () => {
    const m = september();
    m.locked = true;
    m.incomes[0].date = null;
    const next = reducer({ activeMonth: '2026-09', months: { '2026-09': m } }, { type: 'receiveIncome', id: 'I', date: '2026-09-05' });
    expect(next.months['2026-09'].incomes[0].date).toBe('2026-09-05');
  });

  it('marks an expected income as arrived', () => {
    const m = september();
    m.incomes[0].date = null;
    const next = reducer({ activeMonth: '2026-09', months: { '2026-09': m } }, { type: 'receiveIncome', id: 'I', date: '2026-09-05' });
    expect(next.months['2026-09'].incomes[0].date).toBe('2026-09-05');
  });
});

describe('close', () => {
  function withAugust(): State {
    const aug = blankMonth();
    aug.incomes = [{ id: 'I', name: 'income-a', amount: 10000, date: '2026-08-01', repeat: true }];
    aug.savingsTarget = 2000;
    aug.cashStart = 500;
    aug.log = [{ id: 'x', date: '2026-08-10', name: '', cat: 'needs', amount: 7000, lineId: null }];
    return { activeMonth: '2026-08', months: { '2026-08': aug } };
  }

  it('knows when a month can be closed', () => {
    const state = withAugust();
    state.months['2026-09'] = september();
    expect(canClose(state, '2026-08')).toBe(true);
    expect(canClose(state, '2026-09')).toBe(false);
    vi.setSystemTime(new Date(2026, 8, 28, 12));
    expect(canClose(state, '2026-09')).toBe(true);
    state.months['2026-08'].closed = true;
    expect(canClose(state, '2026-08')).toBe(false);
  });

  it('closes a month and starts the next from the counted cash', () => {
    const state = withAugust();
    expect(bookBalance(state, '2026-08', 2000)).toBe(1500);
    const next = reducer(state, {
      type: 'closeMonth', month: '2026-08', saved: 2000, cash: 1200, forward: 1200, fillGap: 300, reflection: 'note', nextSavingsTarget: 2500
    });
    const aug = next.months['2026-08'];
    expect(aug).toMatchObject({ saved: 2000, reflection: 'note', closed: true, locked: true });
    expect(aug.log.at(-1)).toMatchObject({ date: '2026-08-31', name: 'অজানা খরচ', amount: 300 });
    expect(aug.checks).toMatchObject([{ date: '2026-08-31', amount: 1200 }]);
    expect(expectedAt(aug, '2026-08-31')).toBe(1200);
    expect(next.activeMonth).toBe('2026-09');
    expect(next.months['2026-09']).toMatchObject({ cashStart: 1200, savingsTarget: 2500, closed: false });
    expect(next.months['2026-09'].incomes).toMatchObject([{ name: 'income-a', date: null }]);
  });

  it('keeps a locked next month plan and carries the ledger figure when cash is not counted', () => {
    const state = withAugust();
    const sep = september();
    sep.locked = true;
    state.months['2026-09'] = sep;
    const next = reducer(state, {
      type: 'closeMonth', month: '2026-08', saved: 2000, cash: null, forward: 1500, fillGap: 0, reflection: '', nextSavingsTarget: 9
    });
    expect(next.months['2026-09'].savingsTarget).toBe(2000);
    expect(next.months['2026-09'].cashStart).toBe(1500);
    expect(next.months['2026-08'].checks).toEqual([]);
  });
});

describe('undo', () => {
  function state(): State {
    const m = september();
    m.checks = [
      { id: 'c1', date: '2026-09-05', amount: 5000 },
      { id: 'c2', date: '2026-09-10', amount: 4000 }
    ];
    return { activeMonth: '2026-09', months: { '2026-09': m, '2026-08': blankMonth() } };
  }

  it('puts a deleted entry back in place', () => {
    const before = state();
    const entry = before.months['2026-09'].log[1];
    const gone = reducer(before, { type: 'deleteLog', id: entry.id });
    expect(reducer(gone, { type: 'restoreLog', month: '2026-09', entry, index: 1 })).toEqual(before);
  });

  it('puts a deleted check back in place', () => {
    const before = state();
    const check = before.months['2026-09'].checks[0];
    const gone = reducer(before, { type: 'deleteCheck', id: check.id });
    expect(reducer(gone, { type: 'restoreCheck', month: '2026-09', check, index: 0 })).toEqual(before);
  });

  it('puts a deleted income back in place', () => {
    const before = state();
    const income = before.months['2026-09'].incomes[0];
    const gone = reducer(before, { type: 'deleteIncome', id: income.id });
    expect(reducer(gone, { type: 'restoreIncome', month: '2026-09', income, index: 0 })).toEqual(before);
  });

  it('puts a deleted plan line back in place', () => {
    const before = state();
    const line = before.months['2026-09'].budget.needs[0];
    const gone = reducer(before, { type: 'deleteLine', cat: 'needs', id: line.id });
    expect(reducer(gone, { type: 'restoreLine', month: '2026-09', cat: 'needs', line, index: 0 })).toEqual(before);
  });

  it('puts a deleted month back and opens it', () => {
    const before = state();
    const gone = reducer(before, { type: 'deleteMonth' });
    expect(gone.activeMonth).toBe('2026-08');
    expect(reducer(gone, { type: 'restoreMonth', key: '2026-09', month: before.months['2026-09'] })).toEqual(before);
  });

  it('restores into the original month after switching months', () => {
    const before = state();
    const entry = before.months['2026-09'].log[0];
    let next = reducer(before, { type: 'deleteLog', id: entry.id });
    next = reducer(next, { type: 'selectMonth', key: '2026-08' });
    next = reducer(next, { type: 'restoreLog', month: '2026-09', entry, index: 0 });
    expect(next.months['2026-09'].log).toEqual(before.months['2026-09'].log);
    expect(next.months['2026-08'].log).toEqual([]);
  });

  it('ignores a restore into a month that is gone', () => {
    const gone = reducer(state(), { type: 'deleteMonth' });
    const entry = state().months['2026-09'].log[0];
    expect(reducer(gone, { type: 'restoreLog', month: '2026-09', entry, index: 0 })).toBe(gone);
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

describe('repeating lines', () => {
  it('keeps a repeating payment out of the week and the pace', () => {
    const m = september();
    m.log.push({ id: 'e4', date: '2026-09-13', name: 'line-a', cat: 'needs', amount: 1500, lineId: 'A' });
    const d = derive(m, '2026-09');
    expect(d.week!.spent).toBe(500);
    expect(d.flexSpent).toBe(500);
    expect(d.fixedByDay['2026-09-13']).toBe(1500);
    expect(d.flexByDay['2026-09-13']).toBeUndefined();
    expect(tone(d)).toBe('good');
  });

  it('counts paying past the line amount as day-to-day spending', () => {
    const m = september();
    m.log.push({ id: 'e4', date: '2026-09-13', name: 'line-a', cat: 'needs', amount: 2000, lineId: 'A' });
    const d = derive(m, '2026-09');
    expect(d.fixedByDay['2026-09-13']).toBe(1500);
    expect(d.flexByDay['2026-09-13']).toBe(500);
    expect(d.week!.spent).toBe(1000);
  });

  it('warns when day-to-day spending runs ahead of the month', () => {
    const m = september();
    m.log.push({ id: 'e4', date: '2026-09-02', name: '', cat: 'wants', amount: 5000, lineId: null });
    expect(tone(derive(m, '2026-09'))).toBe('warn');
  });
});

describe('isBlank', () => {
  it('is true only for a month with nothing in it', () => {
    expect(isBlank(blankMonth())).toBe(true);
    expect(isBlank(september())).toBe(false);
  });
});

describe('updateLog', () => {
  const state = (): State => ({ activeMonth: '2026-09', months: { '2026-08': blankMonth(), '2026-09': september() } });

  it('changes an entry in place', () => {
    const next = reducer(state(), { type: 'updateLog', id: 'e2', date: '2026-09-14', cat: 'needs', amount: 450, pick: 'A', name: '' });
    expect(next.months['2026-09'].log.find((e) => e.id === 'e2')).toEqual({
      id: 'e2', date: '2026-09-14', name: 'line-a', cat: 'needs', amount: 450, lineId: 'A'
    });
  });

  it('moves an entry to another month and drops its line link', () => {
    const next = reducer(state(), { type: 'updateLog', id: 'e1', date: '2026-08-31', cat: 'needs', amount: 1000, pick: 'A', name: '' });
    expect(next.months['2026-09'].log.some((e) => e.id === 'e1')).toBe(false);
    expect(next.months['2026-08'].log).toEqual([{ id: 'e1', date: '2026-08-31', name: 'line-a', cat: 'needs', amount: 1000, lineId: null }]);
    expect(next.months['2026-08'].loggedDays).toEqual(['2026-08-31']);
  });

  it('refuses a zero amount', () => {
    const s = state();
    expect(reducer(s, { type: 'updateLog', id: 'e2', date: '2026-09-15', cat: 'wants', amount: 0, pick: '', name: '' })).toBe(s);
  });

  it('undoes an add that merged into an existing entry', () => {
    const before = state();
    const m = before.months['2026-09'];
    const added = reducer(before, { type: 'addSpend', date: '2026-09-15', cat: 'wants', amount: 20, pick: '', name: 'entry-2' });
    const back = reducer(added, { type: 'restoreLogList', month: '2026-09', log: m.log, loggedDays: m.loggedDays });
    expect(back).toEqual(before);
  });
});
