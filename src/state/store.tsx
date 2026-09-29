import { createContext, useContext, useEffect, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { nextMonthKey, todayISO, uid } from '@/lib/dates';
import { expectedAt, makeNewMonth, migrate, type Month, type State } from '@/lib/model';
import { load, save } from '@/lib/storage';

export type Action =
  | { type: 'addSpend'; date: string; cat: string; amount: number; pick: string; name: string }
  | { type: 'addCheck'; date: string; amount: number }
  | { type: 'deleteLog'; id: string }
  | { type: 'deleteCheck'; id: string }
  | { type: 'markZeroDay' }
  | { type: 'fillGap'; checkId: string }
  | { type: 'setIncome'; value: number }
  | { type: 'setSavingsTarget'; value: number }
  | { type: 'setCashStart'; value: number | null }
  | { type: 'setSaved'; value: number | null }
  | { type: 'setReflection'; value: string }
  | { type: 'addLine'; cat: string; id: string }
  | { type: 'updateLine'; cat: string; id: string; name?: string; amount?: number }
  | { type: 'deleteLine'; cat: string; id: string }
  | { type: 'toggleRepeat'; cat: string; id: string }
  | { type: 'selectMonth'; key: string }
  | { type: 'openNextMonth' }
  | { type: 'importState'; state: State };

function markLogged(m: Month, date: string) {
  if (!m.loggedDays) m.loggedDays = [];
  if (m.loggedDays.indexOf(date) < 0) m.loggedDays.push(date);
}

export function reducer(prev: State, action: Action): State {
  if (action.type === 'importState') return migrate(action.state);

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
      target.log.push({ id: uid(), date: action.date, name, cat: action.cat, amount: action.amount, lineId });
      markLogged(target, action.date);
      break;
    }
    case 'addCheck':
      m.checks = (m.checks || []).filter((c) => c.date !== action.date);
      m.checks.push({ id: uid(), date: action.date, amount: action.amount });
      break;
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
    case 'setIncome':
      m.income = action.value;
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
    case 'selectMonth':
      state.activeMonth = action.key;
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

  /* Don't write on first render: an unreadable save stays on disk until the user changes something. */
  useEffect(() => {
    if (state !== loaded.current) save(state);
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
