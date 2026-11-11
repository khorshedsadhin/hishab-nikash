import { addDaysISO, daysApart, daysInMonth, pad, prevMonthKey, saturdayOf, todayISO, uid } from './dates';
import { dayLabel, money, toBn } from './format';

export type CatKey = 'needs' | 'wants' | 'giving' | 'unexpected';

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

/* A null date means the income is expected but has not arrived yet. */
export interface Income {
  id: string;
  name: string;
  amount: number;
  date: string | null;
  repeat: boolean;
  /* Set when this income is money coming back from a loan. */
  loanId?: string;
}

/* Where the lent money came from: the spendable pool or the month's savings. */
export type LoanSource = 'spend' | 'savings';

export interface Loan {
  id: string;
  date: string;
  name: string;
  amount: number;
  from: LoanSource;
}

export interface Check {
  id: string;
  date: string;
  amount: number;
}

export interface Month {
  incomes: Income[];
  savingsTarget: number;
  budget: Record<string, Line[]>;
  log: LogEntry[];
  loans: Loan[];
  reflection: string;
  saved: number | null;
  cashStart: number | null;
  checks: Check[];
  loggedDays: string[];
  locked: boolean;
  /* Set by the month-end close; the next month starts from its counted cash. */
  closed: boolean;
}

export interface State {
  activeMonth: string;
  months: Record<string, Month>;
}

export const CATEGORIES: { key: CatKey; label: string; tint: string }[] = [
  { key: 'needs', label: 'দরকারি', tint: 'var(--cat-needs)' },
  { key: 'wants', label: 'ইচ্ছা', tint: 'var(--cat-wants)' },
  { key: 'giving', label: 'অন্যের জন্য', tint: 'var(--cat-giving)' },
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
  const incomes = (fromMonth.incomes || [])
    .filter((x) => x.repeat)
    .map((x) => ({ id: uid(), name: x.name, amount: x.amount, date: null, repeat: true }));
  return {
    incomes,
    savingsTarget: fromMonth.savingsTarget,
    budget,
    log: [],
    loans: [],
    reflection: '',
    saved: null,
    cashStart: null,
    checks: [],
    loggedDays: [],
    locked: false,
    closed: false
  };
}

export function blankMonth(): Month {
  const budget: Record<string, Line[]> = {};
  CATEGORIES.forEach((c) => {
    budget[c.key] = [];
  });
  return {
    incomes: [],
    savingsTarget: 0,
    budget,
    log: [],
    loans: [],
    reflection: '',
    saved: null,
    cashStart: null,
    checks: [],
    loggedDays: [],
    locked: false,
    closed: false
  };
}

export function seed(): State {
  const key = todayISO().slice(0, 7);
  return { activeMonth: key, months: { [key]: blankMonth() } };
}

export function incomeTotal(m: Month): number {
  return (m.incomes || []).reduce((s, x) => s + (x.amount || 0), 0);
}

export function receivedUpto(m: Month, date: string): number {
  return (m.incomes || []).reduce((s, x) => s + (x.date != null && x.date <= date ? (x.amount || 0) : 0), 0);
}

/* --- loans: money lent out, paid back later as income --- */

export function lentFrom(m: Month, from: LoanSource): number {
  return (m.loans || []).reduce((s, l) => s + (l.from === from ? l.amount : 0), 0);
}

/* Cash that left through loans by `date`, whichever pool it came from. */
function loanedUpto(m: Month, date: string): number {
  return (m.loans || []).reduce((s, l) => s + (l.date <= date ? l.amount : 0), 0);
}

/* The month's savings after loans taken out of them; never below zero. */
export function savingsHeld(m: Month): number {
  return Math.max(0, m.savingsTarget - lentFrom(m, 'savings'));
}

/* Paid back so far: every arrived income linked to the loan, in any month. */
export function loanReturned(state: State, loanId: string): number {
  let total = 0;
  Object.keys(state.months).forEach((k) => {
    (state.months[k].incomes || []).forEach((x) => {
      if (x.loanId === loanId && x.date != null) total += x.amount || 0;
    });
  });
  return total;
}

export interface LoanRow {
  loan: Loan;
  month: string;
  returned: number;
  left: number;
}

/* Every loan across all months, oldest first. */
export function loanRows(state: State): LoanRow[] {
  const rows: LoanRow[] = [];
  Object.keys(state.months).forEach((k) => {
    (state.months[k].loans || []).forEach((loan) => {
      const returned = loanReturned(state, loan.id);
      rows.push({ loan, month: k, returned, left: Math.max(0, loan.amount - returned) });
    });
  });
  return rows.sort((a, b) => (a.loan.date < b.loan.date ? -1 : a.loan.date > b.loan.date ? 1 : 0));
}

/* Old saves predate the reconcile fields, the per-line spend links and the income list. */
export function migrate(s: any): State {
  Object.keys(s.months).forEach((k) => {
    const m = s.months[k];
    if (!m.budget) m.budget = {};
    /* The old learning category was dropped; its spending counts as a want. */
    if (Array.isArray(m.budget.culture)) {
      m.budget.wants = (m.budget.wants || []).concat(m.budget.culture);
      delete m.budget.culture;
    }
    CATEGORIES.forEach((c) => {
      if (!Array.isArray(m.budget[c.key])) m.budget[c.key] = [];
    });
    if (!Array.isArray(m.log)) m.log = [];
    if (!Array.isArray(m.loans)) m.loans = [];
    if (typeof m.reflection !== 'string') m.reflection = '';
    if (typeof m.saved !== 'number') m.saved = null;
    if (typeof m.cashStart !== 'number') m.cashStart = null;
    if (!Array.isArray(m.checks)) m.checks = [];
    if (!Array.isArray(m.loggedDays)) m.loggedDays = [];
    if (typeof m.locked !== 'boolean') m.locked = false;
    if (typeof m.closed !== 'boolean') m.closed = false;
    /* A single income number becomes one income that arrived on the 1st, as it was assumed before. */
    if (!Array.isArray(m.incomes)) {
      const amount = typeof m.income === 'number' ? m.income : 0;
      m.incomes = amount > 0 ? [{ id: 'income-' + k, name: 'আয়', amount, date: k + '-01', repeat: true }] : [];
    }
    delete m.income;
    m.log.forEach((e: LogEntry) => {
      if (e.lineId === undefined) e.lineId = null;
      if (e.cat === 'culture') e.cat = 'wants';
      if (m.loggedDays.indexOf(e.date) < 0) m.loggedDays.push(e.date);
    });
  });
  return s as State;
}

/* --- reconcile: is the ledger telling the truth? --- */

/* Cash out by `date`: spending plus everything lent. */
function spentUpto(m: Month, date: string): number {
  return (m.log || []).reduce((s, e) => s + (e.date <= date ? (e.amount || 0) : 0), 0) + loanedUpto(m, date);
}

/* Counts income from the day it arrived; assumes `saved` has already left. */
export function expectedAt(m: Month, date: string): number | null {
  if (m.cashStart == null) return null;
  return m.cashStart + receivedUpto(m, date) - spentUpto(m, date) - (m.saved || 0);
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

export interface Week {
  start: string;
  end: string;
  /* Dates of the week that fall inside this month. */
  days: string[];
  budget: number;
  spent: number;
  left: number;
  perDay: number;
}

export interface Derived {
  carry: number;
  income: number;
  received: number;
  spendable: number;
  planned: number;
  buffer: number;
  repeating: number;
  perCategory: Record<string, CategoryTotals>;
  lineActual: Record<string, number>;
  actual: number;
  /* Lent out of the spendable pool; savings loans are not here. */
  lent: number;
  remaining: number;
  committedLeft: number;
  safeRemaining: number;
  expectedByNow: number;
  week: Week | null;
  perDay: number;
  todaySpent: number;
  byDay: Record<string, number>;
  dim: number;
  elapsedDays: number;
  daysLeft: number;
  isCurrent: boolean;
  isFuture: boolean;
}

/* Money still owed to repeating lines, given what each had received by then. */
function committedFrom(m: Month, lineSpent: Record<string, number>): number {
  let total = 0;
  CATEGORIES.forEach((c) => {
    (m.budget[c.key] || []).forEach((l) => {
      if (l.repeat) total += Math.max(0, l.amount - (lineSpent[l.id] || 0));
    });
  });
  return total;
}

/* The week's share is fixed on its first day, so spending inside the week never moves the target. */
function weekOf(m: Month, monthKey: string, spendable: number, todayStr: string): Week {
  const dim = daysInMonth(monthKey);
  const first = monthKey + '-01';
  const last = lastDayOf(monthKey);
  const sat = saturdayOf(todayStr);
  const fri = addDaysISO(sat, 6);
  const start = sat < first ? first : sat;
  const end = fri > last ? last : fri;

  const before: Record<string, number> = {};
  let spentBefore = 0;
  let spent = 0;
  (m.loans || []).forEach((l) => {
    if (l.from !== 'spend') return;
    if (l.date < start) spentBefore += l.amount;
    else if (l.date <= end) spent += l.amount;
  });
  (m.log || []).forEach((e) => {
    if (e.date < start) {
      spentBefore += e.amount || 0;
      if (e.lineId) before[e.lineId] = (before[e.lineId] || 0) + (e.amount || 0);
    } else if (e.date <= end) {
      spent += e.amount || 0;
    }
  });

  const days: string[] = [];
  for (let dt = start; dt <= end; dt = addDaysISO(dt, 1)) days.push(dt);
  const safeAtStart = spendable - spentBefore - committedFrom(m, before);
  const daysLeftAtStart = dim - Number(start.slice(8, 10)) + 1;
  const budget = safeAtStart <= 0 ? 0 : Math.round(safeAtStart / daysLeftAtStart * days.length);
  return { start, end, days, budget, spent, left: budget - spent, perDay: Math.round(budget / days.length) };
}

export function derive(m: Month, monthKey: string, carry = 0): Derived {
  const log = m.log || [];

  const lineActual: Record<string, number> = {};
  log.forEach((e) => {
    if (e.lineId) lineActual[e.lineId] = (lineActual[e.lineId] || 0) + (e.amount || 0);
  });

  const income = incomeTotal(m);
  const spendable = income - m.savingsTarget + carry;
  let planned = 0;
  let repeating = 0;
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
  });

  const committedLeft = committedFrom(m, lineActual);
  const buffer = spendable - planned;
  const actual = log.reduce((s, e) => s + (e.amount || 0), 0);
  const lent = lentFrom(m, 'spend');
  const remaining = spendable - actual - lent;
  const safeRemaining = remaining - committedLeft;

  const todayStr = todayISO();
  const todayMonthKey = todayStr.slice(0, 7);
  const isCurrent = monthKey === todayMonthKey;
  const dim = daysInMonth(monthKey);
  let elapsedDays: number;
  if (monthKey > todayMonthKey) {
    elapsedDays = 0;
  } else if (monthKey < todayMonthKey) {
    elapsedDays = dim;
  } else {
    elapsedDays = Number(todayStr.slice(8, 10));
  }
  const daysLeft = Math.max(1, dim - Math.max(1, elapsedDays) + 1);
  const expectedByNow = spendable * elapsedDays / dim;

  const byDay: Record<string, number> = {};
  log.forEach((e) => {
    byDay[e.date] = (byDay[e.date] || 0) + (e.amount || 0);
  });

  const week = isCurrent ? weekOf(m, monthKey, spendable, todayStr) : null;
  const perDay = week ? week.perDay : Math.round(Math.max(0, spendable) / dim);

  return {
    carry,
    income,
    received: (m.incomes || []).reduce((s, x) => s + (x.date != null ? (x.amount || 0) : 0), 0),
    spendable,
    planned,
    buffer,
    repeating,
    perCategory,
    lineActual,
    actual,
    lent,
    remaining,
    committedLeft,
    safeRemaining,
    expectedByNow,
    week,
    perDay,
    todaySpent: isCurrent ? (byDay[todayStr] || 0) : 0,
    byDay,
    dim,
    elapsedDays,
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

/* --- month-end close --- */

export function lastDayOf(monthKey: string): string {
  return monthKey + '-' + pad(daysInMonth(monthKey));
}

/* The day the close is counted on: the month's last day, or today if it has not ended. */
export function closeDate(monthKey: string): string {
  const last = lastDayOf(monthKey);
  const today = todayISO();
  return today < last ? today : last;
}

/* Cash the ledger says should be left once `saved` has gone to savings. */
export function bookBalance(state: State, monthKey: string, saved: number): number {
  const m = state.months[monthKey];
  const at = closeDate(monthKey);
  return deriveMonth(state, monthKey).carry + receivedUpto(m, at) - spentUpto(m, at) - saved;
}

/* A month can be closed once it has ended, or in its last three days. */
export function canClose(state: State, monthKey: string): boolean {
  const m = state.months[monthKey];
  if (!m || m.closed) return false;
  const today = todayISO();
  const current = today.slice(0, 7);
  if (monthKey < current) return true;
  return monthKey === current && daysInMonth(monthKey) - Number(today.slice(8, 10)) < 3;
}

export type Tone = 'good' | 'warn' | 'bad';

/* Nothing planned and nothing written: the month still needs setting up. */
export function isBlank(m: Month): boolean {
  return incomeTotal(m) === 0 && (m.log || []).length === 0 && (m.loans || []).length === 0 &&
    CATEGORIES.every((c) => (m.budget[c.key] || []).every((l) => !l.amount));
}

export function tone(d: Derived): Tone {
  if (d.remaining <= 0) return 'bad';
  if (d.safeRemaining <= 0 || d.actual > d.expectedByNow || (d.week && d.week.left < 0)) return 'warn';
  return 'good';
}

export function headline(d: Derived): string {
  if (d.isFuture) return 'মাস এখনো শুরু হয়নি।';
  if (!d.isCurrent) {
    return 'মাস শেষ। ' + money(Math.abs(d.remaining)) + (d.remaining < 0 ? ' বেশি গেছে।' : ' বেঁচেছিল।');
  }
  if (d.remaining <= 0) return 'বাজেট শেষ। এখন খরচ করলে সেভিংসে হাত পড়বে।';
  if (d.safeRemaining <= 0) return 'যা বাকি আছে পুরোটাই বাঁধা খরচে ধরা। নতুন কিছু কিনলে কোনো একটা বিল আটকে যাবে।';
  if (d.week && d.week.left < 0) return 'এই সপ্তাহের ভাগ থেকে ' + money(-d.week.left) + ' বেশি গেছে।';
  if (d.actual > d.expectedByNow) return 'মাসের গতির চেয়ে খরচ একটু বেশি হচ্ছে।';
  return 'ঠিক পথে আছো।';
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
