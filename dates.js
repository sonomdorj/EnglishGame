// Date engine. Valid range: 1 January 1900 to 31 December 2099.
// Does not use the JS Date object. 1 January 1900 was a Monday.

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export function isLeap(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y, m) {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

export function isValidDate(d, m, y) {
  return [d, m, y].every(Number.isInteger) &&
    y >= 1900 && y <= 2099 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

// 0 = Monday ... 6 = Sunday
export function weekdayIndex(d, m, y) {
  if (!isValidDate(d, m, y)) throw new RangeError(`Bad date: ${d}-${m}-${y}`);
  let days = 0;
  for (let yy = 1900; yy < y; yy++) days += isLeap(yy) ? 366 : 365;
  for (let mm = 1; mm < m; mm++) days += daysInMonth(y, mm);
  days += d - 1;
  return days % 7;
}

export function weekday(d, m, y) {
  return WEEKDAYS[weekdayIndex(d, m, y)];
}

// "17 November 2017" -> { d: 17, m: 11, y: 2017 }
export function parseDate(str) {
  const [d, mon, y] = str.trim().split(/\s+/);
  const m = MONTHS.indexOf(mon) + 1;
  const out = { d: Number(d), m, y: Number(y) };
  if (!isValidDate(out.d, out.m, out.y)) throw new RangeError(`Bad date: ${str}`);
  return out;
}

// "14-3-1978" (day-month-year) -> { d, m, y }
export function parseDMY(str) {
  const [d, m, y] = str.split('-').map(Number);
  if (!isValidDate(d, m, y)) throw new RangeError(`Bad date: ${str}`);
  return { d, m, y };
}

export function formatDate({ d, m, y }) {
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatFull(date) {
  return `${weekday(date.d, date.m, date.y)}, ${formatDate(date)}`;
}
