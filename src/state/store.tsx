import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { nextMonthKey, todayISO, uid } from '@/lib/dates';
import {
  applyInverse, blankMonth, canEdit, closePlan, expectedAt, inverseOf, makeNewMonth,
  type EditKind, type CloseInput, type Loan, type Month, type State, type UndoStep
} from '@/lib/model';
import { load, save } from '@/lib/storage';
import { startSync, trackState } from '@/lib/sync';
import { undoToast } from '@/lib/undo';

export type Action =
  | { type: 'addSpend'; id?: string; date: string; cat: string; amount: number; pick: string; name: string }
  | { type: 'addCheck'; date: string; amount: number }
  | { type: 'updateLog'; id: string; date: string; cat: string; amount: number; pick: string; name: string }
  | { type: 'deleteLog'; id: string }
  | { type: 'deleteCheck'; id: string }
  | { type: 'markZeroDay' }
  | { type: 'fillGap'; checkId: string }
  | { type: 'addIncome'; id?: string; name: string; amount: number; date: string | null; repeat: boolean; toSavings: number; loanId?: string }
  | { type: 'addLoan'; loan: Loan }
  | { type: 'deleteLoan'; id: string }
  | { type: 'updateIncome'; id: string; name?: string; amount?: number }
  | { type: 'receiveIncome'; id: string; date: string | null }
  | { type: 'toggleIncomeRepeat'; id: string }
  | { type: 'deleteIncome'; id: string }
  | { type: 'closeMonth'; month: string; input: CloseInput; reflection: string }
  | { type: 'reopenMonth' }
  | { type: 'setSavingsTarget'; value: number }
  | { type: 'setCashStart'; value: number | null }
  | { type: 'setSaved'; value: number | null }
  | { type: 'setReflection'; value: string }
  | { type: 'addLine'; cat: string; id: string }
  | { type: 'updateLine'; cat: string; id: string; name?: string; amount?: number }
  | { type: 'deleteLine'; cat: string; id: string }
  | { type: 'toggleRepeat'; cat: string; id: string }
  | { type: 'setLocked'; value: boolean }
  | { type: 'selectMonth'; key: string }
  | { type: 'openNextMonth' }
  | { type: 'importState'; state: State }
  | { type: 'deleteMonth' }
  | { type: 'undo'; steps: UndoStep[] }
  | { type: 'mergeRemote'; months: Record<string, Month | null> };

/* Every action names its edit kind, so a new action cannot skip the lock by mistake.
   null means the policy does not apply: month lifecycle, navigation, undo and outside data. */
const EDIT_KIND: Record<Action['type'], EditKind | null> = {
  addSpend: 'fact',
  addCheck: 'fact',
  updateLog: 'fact',
  deleteLog: 'fact',
  deleteCheck: 'fact',
  markZeroDay: 'fact',
  fillGap: 'fact',
  addLoan: 'fact',
  deleteLoan: 'fact',
  receiveIncome: 'fact',
  setCashStart: 'fact',
  setSaved: 'fact',
  setReflection: 'fact',
  addIncome: 'plan',
  updateIncome: 'plan',
  toggleIncomeRepeat: 'plan',
  deleteIncome: 'plan',
  setSavingsTarget: 'plan',
  addLine: 'plan',
  updateLine: 'plan',
  deleteLine: 'plan',
  toggleRepeat: 'plan',
  closeMonth: null,
  reopenMonth: null,
  setLocked: null,
  selectMonth: null,
  openNextMonth: null,
  deleteMonth: null,
  importState: null,
  mergeRemote: null,
  undo: null
};

/* The month an action lands in: the active month, unless the action carries its own date. */
function touchedMonth(state: State, action: Action): Month | undefined {
  switch (action.type) {
    case 'addSpend':
    case 'updateLog':
      return state.months[action.date.slice(0, 7)];
    case 'addLoan':
      return state.months[action.loan.date.slice(0, 7)];
    case 'addIncome':
      return state.months[action.date ? action.date.slice(0, 7) : state.activeMonth];
    default:
      return state.months[state.activeMonth];
  }
}

/* The app always needs an active month, so dropping the last one leaves a blank current month. */
function dropMonth(state: State, key: string) {
  delete state.months[key];
  if (state.activeMonth !== key) return;
  const keys = Object.keys(state.months).sort();
  if (keys.length) {
    state.activeMonth = keys[keys.length - 1];
  } else {
    state.activeMonth = todayISO().slice(0, 7);
    state.months[state.activeMonth] = blankMonth();
  }
}

function markLogged(m: Month, date: string) {
  if (!m.loggedDays) m.loggedDays = [];
  if (m.loggedDays.indexOf(date) < 0) m.loggedDays.push(date);
}

export function reducer(prev: State, action: Action): State {
  /* Imported state is already ingested by parseImport. */
  if (action.type === 'importState') return action.state;
  /* Undo only puts back an earlier state, so the month policy does not apply. */
  if (action.type === 'undo') return applyInverse(prev, action.steps);
  if (action.type === 'mergeRemote') {
    const state: State = { ...prev, months: { ...prev.months } };
    for (const k in action.months) {
      const month = action.months[k];
      if (month) state.months[k] = month;
      else dropMonth(state, k);
    }
    return state;
  }

  const kind = EDIT_KIND[action.type];
  if (kind && !canEdit(touchedMonth(prev, action), kind)) return prev;

  const state: State = structuredClone(prev);
  const m = state.months[state.activeMonth];

  switch (action.type) {
    case 'addSpend': {
      const target = state.months[action.date.slice(0, 7)];
      if (!target) return prev;
      let name = '';
      let lineId: string | null = null;
      if (action.pick) {
        lineId = action.pick;
        const line = (m.budget[action.cat] || []).find((l) => l.id === action.pick);
        name = line ? line.name : '';
      } else {
        name = action.name.trim();
      }
      /* A plan line belongs to one month, so the link goes stale if the entry
         lands somewhere other than the month whose plan was on screen. */
      if (target !== m) lineId = null;
      const same = target.log.find((e) =>
        e.date === action.date && e.cat === action.cat && e.lineId === lineId &&
        e.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (same) same.amount += action.amount;
      else target.log.push({ id: action.id ?? uid(), date: action.date, name, cat: action.cat, amount: action.amount, lineId });
      markLogged(target, action.date);
      break;
    }
    case 'addCheck':
      m.checks = (m.checks || []).filter((c) => c.date !== action.date);
      m.checks.push({ id: uid(), date: action.date, amount: action.amount });
      break;
    /* An edited entry may move to another month; there its plan-line link would be stale. */
    case 'updateLog': {
      const entry = m.log.find((e) => e.id === action.id);
      const target = state.months[action.date.slice(0, 7)];
      if (!entry || !target || action.amount <= 0) return prev;
      const line = action.pick ? (m.budget[action.cat] || []).find((l) => l.id === action.pick) : undefined;
      entry.date = action.date;
      entry.cat = action.cat;
      entry.amount = action.amount;
      entry.lineId = line && target === m ? line.id : null;
      entry.name = line ? line.name : action.name.trim();
      if (target !== m) {
        m.log = m.log.filter((e) => e.id !== action.id);
        target.log.push(entry);
      }
      markLogged(target, action.date);
      break;
    }
    case 'deleteLog':
      m.log = m.log.filter((e) => e.id !== action.id);
      break;
    case 'deleteCheck':
      m.checks = m.checks.filter((c) => c.id !== action.id);
      break;
    case 'markZeroDay':
      markLogged(m, todayISO());
      break;
    /* Writing the gap back as one entry is what makes the ledger honest again. */
    case 'fillGap': {
      const check = (m.checks || []).find((c) => c.id === action.checkId);
      if (!check) return prev;
      const exp = expectedAt(m, check.date);
      if (exp == null) return prev;
      const gap = exp - check.amount;
      if (gap <= 0) return prev;
      m.log.push({ id: uid(), date: check.date, name: 'অজানা খরচ', cat: 'unexpected', amount: gap, lineId: null });
      markLogged(m, check.date);
      break;
    }
    /* A loan is cash moving out, not a plan edit, so a locked month still takes it. */
    case 'addLoan': {
      const target = state.months[action.loan.date.slice(0, 7)];
      if (!target || action.loan.amount <= 0) return prev;
      target.loans.push({ ...action.loan, name: action.loan.name.trim() });
      break;
    }
    /* A repayment means nothing without its loan, so both go together, in any month. */
    case 'deleteLoan': {
      const owner = Object.values(state.months).find((x) => x.loans.some((l) => l.id === action.id));
      if (!owner) return prev;
      owner.loans = owner.loans.filter((l) => l.id !== action.id);
      Object.values(state.months).forEach((x) => {
        x.incomes = x.incomes.filter((i) => i.loanId !== action.id);
      });
      break;
    }
    case 'addIncome': {
      const target = action.date ? state.months[action.date.slice(0, 7)] : m;
      if (!target) return prev;
      target.incomes.push({
        id: action.id ?? uid(),
        name: action.name.trim(),
        amount: action.amount,
        date: action.date,
        /* A repayment is a one-off, never part of next month's plan. */
        repeat: action.loanId ? false : action.repeat,
        ...(action.loanId ? { loanId: action.loanId } : {})
      });
      if (action.toSavings > 0) target.savingsTarget += Math.min(action.toSavings, action.amount);
      break;
    }
    case 'updateIncome': {
      const income = m.incomes.find((x) => x.id === action.id);
      if (!income) return prev;
      if (action.name !== undefined) income.name = action.name;
      if (action.amount !== undefined) income.amount = action.amount;
      break;
    }
    case 'receiveIncome': {
      const income = m.incomes.find((x) => x.id === action.id);
      if (!income) return prev;
      income.date = action.date;
      break;
    }
    case 'toggleIncomeRepeat': {
      const income = m.incomes.find((x) => x.id === action.id);
      if (income) income.repeat = !income.repeat;
      break;
    }
    case 'deleteIncome':
      m.incomes = m.incomes.filter((x) => x.id !== action.id);
      break;
    /* Closing writes the month's last facts and starts the next month from the counted cash. */
    case 'closeMonth': {
      const target = state.months[action.month];
      if (!target) return prev;
      const plan = closePlan(prev, action.month, action.input);
      const at = plan.at;
      target.saved = plan.saved;
      target.reflection = action.reflection;
      if (plan.fillGap > 0) {
        target.log.push({ id: uid(), date: at, name: 'অজানা খরচ', cat: 'unexpected', amount: plan.fillGap, lineId: null });
        markLogged(target, at);
      }
      if (action.input.cash != null) {
        target.checks = (target.checks || []).filter((c) => c.date !== at);
        target.checks.push({ id: uid(), date: at, amount: plan.forward });
      }
      target.closed = true;
      target.locked = true;
      const nextKey = plan.next.key;
      if (!state.months[nextKey]) state.months[nextKey] = makeNewMonth(target);
      const next = state.months[nextKey];
      next.cashStart = plan.forward;
      next.savingsTarget = plan.next.savingsTarget;
      state.activeMonth = nextKey;
      break;
    }
    /* Reopen clears the closed mark only; the lock, saved, the close-day check
       and the next month's cashStart stay until the next close. */
    case 'reopenMonth':
      m.closed = false;
      break;
    case 'setSavingsTarget':
      m.savingsTarget = action.value;
      break;
    case 'setCashStart':
      m.cashStart = action.value;
      break;
    case 'setSaved':
      m.saved = action.value;
      break;
    case 'setReflection':
      m.reflection = action.value;
      break;
    case 'addLine':
      m.budget[action.cat].push({ id: action.id, name: '', amount: 0, repeat: false });
      break;
    case 'updateLine': {
      const line = m.budget[action.cat].find((l) => l.id === action.id);
      if (!line) return prev;
      if (action.name !== undefined) line.name = action.name;
      if (action.amount !== undefined) line.amount = action.amount;
      break;
    }
    case 'deleteLine':
      m.budget[action.cat] = m.budget[action.cat].filter((l) => l.id !== action.id);
      break;
    case 'toggleRepeat': {
      const line = m.budget[action.cat].find((l) => l.id === action.id);
      if (line) line.repeat = !line.repeat;
      break;
    }
    case 'setLocked':
      m.locked = action.value;
      break;
    case 'selectMonth':
      state.activeMonth = action.key;
      break;
    case 'deleteMonth':
      dropMonth(state, state.activeMonth);
      break;
    case 'openNextMonth': {
      const nextKey = nextMonthKey(state.activeMonth);
      if (!state.months[nextKey]) state.months[nextKey] = makeNewMonth(m);
      state.activeMonth = nextKey;
      break;
    }
  }
  return state;
}

const StoreContext = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const loaded = useRef(state);

  useEffect(() => startSync(loaded.current, (months) => dispatch({ type: 'mergeRemote', months })), []);

  /* Don't write on first render: an unreadable save stays on disk until the user changes something. */
  useEffect(() => {
    if (state !== loaded.current) save(state);
    trackState(state);
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}

/* Fixes the ids an action would otherwise pick inside the reducer, so the dry run
   that builds the inverse and the real dispatch create the same items. */
function withIds(action: Action): Action {
  if ((action.type === 'addSpend' || action.type === 'addIncome') && !action.id) return { ...action, id: uid() };
  return action;
}

/* Dry-runs an action and builds the undo for it. Null when the action changes nothing. */
export function undoable(before: State, action: Action): { action: Action; after: State; undo: Action } | null {
  const run = withIds(action);
  const after = reducer(before, run);
  const steps = after === before ? [] : inverseOf(before, after);
  if (!steps.length) return null;
  return { action: run, after, undo: { type: 'undo', steps } };
}

/* Runs an action and offers a 5-second undo that takes back exactly what it changed. */
export function useUndoable() {
  const { state, dispatch } = useStore();
  const latest = useRef(state);
  latest.current = state;
  return useCallback(
    (action: Action, text: string) => {
      const plan = undoable(latest.current, action);
      if (!plan) return;
      dispatch(plan.action);
      latest.current = plan.after;
      undoToast(text, () => dispatch(plan.undo));
    },
    [dispatch]
  );
}
