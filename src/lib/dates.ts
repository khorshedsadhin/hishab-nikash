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

export function mondayOf(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return isoFromDate(d);
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
