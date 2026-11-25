export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

export function isoFromDate(d: Date): string {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

export function todayISO(): string {
  return isoFromDate(new Date());
}

export function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function addDaysISO(dateStr: string, n: number): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}

export function daysApart(from: string, to: string): number {
  const a = from.split('-').map(Number);
  const b = to.split('-').map(Number);
  const da = new Date(a[0], a[1] - 1, a[2]);
  const db = new Date(b[0], b[1] - 1, b[2]);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/* Weeks run Saturday to Friday. */
export function saturdayOf(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setDate(d.getDate() - ((d.getDay() + 1) % 7));
  return isoFromDate(d);
}

export function weekdayOf(dateStr: string): number {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day).getDay();
}

export function nextMonthKey(monthKey: string): string {
  let [y, mo] = monthKey.split('-').map(Number);
  mo += 1;
  if (mo > 12) {
    mo = 1;
    y += 1;
  }
  return y + '-' + pad(mo);
}

export function prevMonthKey(monthKey: string): string {
  let [y, mo] = monthKey.split('-').map(Number);
  mo -= 1;
  if (mo < 1) {
    mo = 12;
    y -= 1;
  }
  return y + '-' + pad(mo);
}

export function lastDayOf(monthKey: string): string {
  return monthKey + '-' + pad(daysInMonth(monthKey));
}

/* First and last day of a month, the range an entry's date may take. */
export function monthRange(monthKey: string): { start: string; end: string } {
  return { start: monthKey + '-01', end: lastDayOf(monthKey) };
}

/* Today when it falls in the month, otherwise the month's first day. */
export function defaultDateIn(monthKey: string): string {
  const today = todayISO();
  return today.slice(0, 7) === monthKey ? today : monthKey + '-01';
}
