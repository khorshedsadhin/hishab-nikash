const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

/* Indexed by Date#getDay(), Sunday first. */
export const BN_WEEKDAYS = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'];
export const BN_WEEKDAYS_LONG = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function toBn(s: string | number): string {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[+d]);
}

export function group(n: number): string {
  let s = String(Math.abs(Math.round(n)));
  let out = '';
  while (s.length > 3) {
    out = ',' + s.slice(-3) + out;
    s = s.slice(0, -3);
  }
  return s + out;
}

export function money(n: number): string {
  return (n < 0 ? '−৳' : '৳') + toBn(group(n));
}

export function monthLabel(monthKey: string): string {
  const parts = monthKey.split('-');
  return BN_MONTHS[Number(parts[1]) - 1] + ' ' + toBn(parts[0]);
}

export function dayLabel(dateStr: string): string {
  const parts = dateStr.split('-');
  return toBn(Number(parts[2])) + ' ' + BN_MONTHS[Number(parts[1]) - 1];
}

/* Reads Bangla or ASCII digits back as ASCII. */
export function fromBn(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

export function shortDay(dateStr: string): string {
  const parts = dateStr.split('-');
  return toBn(Number(parts[2])) + ' ' + BN_MONTHS[Number(parts[1]) - 1].slice(0, 3);
}
