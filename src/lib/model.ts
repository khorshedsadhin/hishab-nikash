import { daysApart, daysInMonth, addDaysISO, mondayOf, prevMonthKey, todayISO, uid } from './dates';
import { dayLabel, money, toBn } from './format';

export type CatKey = 'needs' | 'wants' | 'culture' | 'unexpected';

export interface Line {
  id: string;
  name: string;
  amount: number;
  repeat: boolean;
}

export interface LogEntry {
  id: string;
  date: string;
  name: string;
  cat: string;
  amount: number;
  lineId: string | null;
}

export interface Check {
  id: string;
  date: string;
  amount: number;
}

export interface Month {
  income: number;
  savingsTarget: number;
  budget: Record<string, Line[]>;
  log: LogEntry[];
  reflection: string;
  saved: number | null;
  cashStart: number | null;
  checks: Check[];
  loggedDays: string[];
  locked: boolean;
}

export interface State {
  activeMonth: string;
  months: Record<string, Month>;
}

export const CATEGORIES: { key: CatKey; label: string; tint: string }[] = [
  { key: 'needs', label: 'দরকারি', tint: 'var(--cat-needs)' },
  { key: 'wants', label: 'শখ', tint: 'var(--cat-wants)' },
  { key: 'culture', label: 'শেখা', tint: 'var(--cat-culture)' },
  { key: 'unexpected', label: 'অনাকাঙ্ক্ষিত', tint: 'var(--cat-unexpected)' }
];

export function catLabel(key: string): string {
  const c = CATEGORIES.find((x) => x.key === key);
  return c ? c.label : key;
}

export function makeNewMonth(fromMonth: Month): Month {
  const budget: Record<string, Line[]> = {};
  CATEGORIES.forEach((c) => {
    budget[c.key] = (fromMonth.budget[c.key] || [])
      .filter((l) => l.repeat)
      .map((l) => ({ id: uid(), name: l.name, amount: l.amount, repeat: true }));
  });
  return {
    income: fromMonth.income,
    savingsTarget: fromMonth.savingsTarget,
    budget,
    log: [],
    reflection: '',
    saved: null,
    cashStart: null,
    checks: [],
    loggedDays: [],
    locked: false
  };
}

export function blankMonth(): Month {
  const budget: Record<string, Line[]> = {};
  CATEGORIES.forEach((c) => {
    budget[c.key] = [];
  });
  return {
    income: 0,
    savingsTarget: 0,
    budget,
    log: [],
    reflection: '',
    saved: null,
    cashStart: null,
    checks: [],
    loggedDays: [],
    locked: false
  };
}

export function seed(): State {
  const key = todayISO().slice(0, 7);
  return { activeMonth: key, months: { [key]: blankMonth() } };
}

/* Old saves predate the reconcile fields and the per-line spend links. */
export function migrate(s: any): State {
  Object.keys(s.months).forEach((k) => {
    const m = s.months[k];
    if (!m.budget) m.budget = {};
    CATEGORIES.forEach((c) => {
      if (!Array.isArray(m.budget[c.key])) m.budget[c.key] = [];
    });
    if (!Array.isArray(m.log)) m.log = [];
    if (typeof m.reflection !== 'string') m.reflection = '';
    if (typeof m.saved !== 'number') m.saved = null;
    if (typeof m.cashStart !== 'number') m.cashStart = null;
    if (!Array.isArray(m.checks)) m.checks = [];
    if (!Array.isArray(m.loggedDays)) m.loggedDays = [];
    if (typeof m.locked !== 'boolean') m.locked = false;
    m.log.forEach((e: LogEntry) => {
      if (e.lineId === undefined) e.lineId = null;
      if (m.loggedDays.indexOf(e.date) < 0) m.loggedDays.push(e.date);
    });
  });
  return s as State;
}

/* --- reconcile: is the ledger telling the truth? --- */

function spentUpto(m: Month, date: string): number {
  return (m.log || []).reduce((s, e) => s + (e.date <= date ? (e.amount || 0) : 0), 0);
}

/* Assumes the month's income lands at the start and `saved` has already left. */
export function expectedAt(m: Month, date: string): number | null {
  if (m.cashStart == null) return null;
  return m.cashStart + m.income - spentUpto(m, date) - (m.saved || 0);
}

export interface ReconRow {
  check: Check;
  expected: number | null;
  gap: number | null;
}

export function reconRows(m: Month): ReconRow[] {
  return (m.checks || []).slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .map((c) => {
      const exp = expectedAt(m, c.date);
      return { check: c, expected: exp, gap: exp == null ? null : exp - c.amount };
    });
}

export function suggestedCashStart(state: State, monthKey: string): number | null {
  const pm = state.months[prevMonthKey(monthKey)];
  if (!pm || !pm.checks || !pm.checks.length) return null;
  const last = pm.checks.slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .pop()!;
  return last.amount;
}

export function savedTotal(state: State): number {
  return Object.keys(state.months).reduce((s, k) => s + (state.months[k].saved || 0), 0);
}

/* --- the money model --- */

export interface CategoryTotals {
  planned: number;
  repeating: number;
  actual: number;
  committed: number;
  unlinked: number;
}

export interface Derived {
  carry: number;
  spendable: number;
  planned: number;
  buffer: number;
  repeating: number;
  perCategory: Record<string, CategoryTotals>;
  lineActual: Record<string, number>;
  actual: number;
  remaining: number;
  committedLeft: number;
  safeRemaining: number;
  expectedByNow: number;
  dailyAllowance: number;
  weeklyAllowance: number;
  thisWeekSpent: number;
  todaySpent: number;
  byDay: Record<string, number>;
  dim: number;
  daysLeft: number;
  isCurrent: boolean;
  isFuture: boolean;
}

export function derive(m: Month, monthKey: string, carry = 0): Derived {
  const log = m.log || [];

  const lineActual: Record<string, number> = {};
  log.forEach((e) => {
    if (e.lineId) lineActual[e.lineId] = (lineActual[e.lineId] || 0) + (e.amount || 0);
  });

  const spendable = m.income - m.savingsTarget + carry;
  let planned = 0;
  let repeating = 0;
  let committedLeft = 0;
  const perCategory: Record<string, CategoryTotals> = {};

  CATEGORIES.forEach((c) => {
    const lines = m.budget[c.key] || [];
    let catPlanned = 0;
    let catRepeating = 0;
    let catCommitted = 0;
    let catLinked = 0;
    lines.forEach((l) => {
      catPlanned += l.amount;
      catLinked += lineActual[l.id] || 0;
      /* Only repeating lines are obligations — a one-off want is not money you owe. */
      if (l.repeat) {
        catRepeating += l.amount;
        catCommitted += Math.max(0, l.amount - (lineActual[l.id] || 0));
      }
    });
    const catActual = log.reduce((s, e) => s + (e.cat === c.key ? (e.amount || 0) : 0), 0);
    perCategory[c.key] = {
      planned: catPlanned,
      repeating: catRepeating,
      actual: catActual,
      committed: catCommitted,
      unlinked: catActual - catLinked
    };
    planned += catPlanned;
    repeating += catRepeating;
    committedLeft += catCommitted;
  });

  const buffer = spendable - planned;
  const actual = log.reduce((s, e) => s + (e.amount || 0), 0);
  const remaining = spendable - actual;
  const safeRemaining = remaining - committedLeft;

  const todayStr = todayISO();
  const todayMonthKey = todayStr.slice(0, 7);
  const isCurrent = monthKey === todayMonthKey;
  const dim = daysInMonth(monthKey);
  let elapsedDays: number;
  if (monthKey > todayMonthKey) {
    elapsedDays = 1;
  } else if (monthKey < todayMonthKey) {
    elapsedDays = dim;
  } else {
    elapsedDays = Number(todayStr.slice(8, 10));
  }
  const daysLeft = Math.max(1, dim - elapsedDays + 1);
  const expectedByNow = spendable * elapsedDays / dim;
  const dailyAllowance = safeRemaining <= 0 ? 0 : Math.round(safeRemaining / daysLeft);
  const weeklyAllowance = safeRemaining <= 0 ? 0 : Math.round(Math.min(safeRemaining, safeRemaining / daysLeft * 7));

  const byDay: Record<string, number> = {};
  log.forEach((e) => {
    byDay[e.date] = (byDay[e.date] || 0) + (e.amount || 0);
  });

  let thisWeekSpent = 0;
  if (isCurrent) {
    const weekStart = mondayOf(todayStr);
    const weekEnd = addDaysISO(weekStart, 6);
    thisWeekSpent = log.reduce((s, e) => s + (e.date >= weekStart && e.date <= weekEnd ? (e.amount || 0) : 0), 0);
  }

  return {
    carry,
    spendable,
    planned,
    buffer,
    repeating,
    perCategory,
    lineActual,
    actual,
    remaining,
    committedLeft,
    safeRemaining,
    expectedByNow,
    dailyAllowance,
    weeklyAllowance,
    thisWeekSpent,
    todaySpent: isCurrent ? (byDay[todayStr] || 0) : 0,
    byDay,
    dim,
    daysLeft,
    isCurrent,
    isFuture: monthKey > todayMonthKey
  };
}

/* One level deep and computed live, never frozen: editing an old entry updates
   what carried forward. Chaining would drag every past mistake along forever. */
export function carryInto(state: State, monthKey: string): number {
  const prevKey = prevMonthKey(monthKey);
  const pm = state.months[prevKey];
  if (!pm) return 0;
  if (prevKey >= todayISO().slice(0, 7)) return 0;
  return derive(pm, prevKey, 0).remaining;
}

/* Cash actually in hand at the start wins over the computed carry: part of the
   leftover may have been saved. 0 is a real answer, only null falls back. */
export function deriveMonth(state: State, monthKey: string): Derived {
  const m = state.months[monthKey];
  return derive(m, monthKey, m.cashStart ?? carryInto(state, monthKey));
}

export type Tone = 'good' | 'warn' | 'bad';

export function tone(d: Derived): Tone {
  if (d.remaining <= 0) return 'bad';
  if (d.safeRemaining <= 0 || d.actual > d.expectedByNow) return 'warn';
  return 'good';
}

export function headline(d: Derived): string {
  if (d.isFuture) return 'মাস এখনো শুরু হয়নি।';
  if (!d.isCurrent) {
    return 'মাস শেষ। ' + money(Math.abs(d.remaining)) + (d.remaining < 0 ? ' বেশি গেছে।' : ' বেঁচেছিল।');
  }
  if (d.remaining <= 0) return 'বাজেট শেষ। এখন খরচ করলে সেভিংসে হাত পড়বে।';
  if (d.safeRemaining <= 0) return 'যা বাকি আছে পুরোটাই বাঁধা খরচে ধরা। নতুন কিছু কিনলে কোনো একটা বিল আটকে যাবে।';
  if (d.todaySpent >= d.dailyAllowance) return 'আজকের ভাগ শেষ, ' + money(d.todaySpent) + ' খরচ হয়েছে।';
  return 'আজ আরও ' + money(d.dailyAllowance - d.todaySpent) + ' খরচ করা যায়।';
}

/* --- logging streak: a blank day must not read as a zero-spend day --- */

export function lastLoggedDate(state: State): string {
  let best = '';
  Object.keys(state.months).forEach((k) => {
    (state.months[k].loggedDays || []).forEach((dt) => {
      if (dt > best) best = dt;
    });
  });
  return best;
}

export function streak(state: State): { text: string; warn: boolean } {
  const last = lastLoggedDate(state);
  if (!last) return { text: 'এখনো কিছু লেখা হয়নি।', warn: true };
  const gap = daysApart(last, todayISO());
  if (gap <= 0) return { text: 'আজকের হিসাব লেখা হয়েছে।', warn: false };
  return { text: 'শেষ লেখা ' + toBn(gap) + ' দিন আগে · ' + dayLabel(last), warn: gap > 2 };
}
