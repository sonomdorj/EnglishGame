import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WEEKDAYS, MONTHS, isLeap, daysInMonth, isValidDate, weekdayIndex, weekday, parseDate, parseDMY, formatDate, formatFull } from '../../dates.js';

test('WEEKDAYS and MONTHS', () => {
  assert.equal(WEEKDAYS.length, 7);
  assert.equal(WEEKDAYS[0], 'Monday');
  assert.equal(WEEKDAYS[6], 'Sunday');
  assert.equal(MONTHS.length, 12);
  assert.equal(MONTHS[0], 'January');
  assert.equal(MONTHS[11], 'December');
});

test('isLeap: 4, 100 and 400 rules', () => {
  for (const y of [1904, 1996, 2000, 2024, 2096]) assert.equal(isLeap(y), true, String(y));
  for (const y of [1900, 1901, 2023, 2100, 2099]) assert.equal(isLeap(y), false, String(y));
});

test('daysInMonth', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => daysInMonth(2023, m)),
    [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(1900, 2), 28);
  assert.equal(daysInMonth(2000, 2), 29);
});

test('isValidDate: range and bad parts', () => {
  assert.equal(isValidDate(1, 1, 1900), true);
  assert.equal(isValidDate(31, 12, 2099), true);
  assert.equal(isValidDate(29, 2, 2024), true);
  assert.equal(isValidDate(31, 12, 1899), false);
  assert.equal(isValidDate(1, 1, 2100), false);
  assert.equal(isValidDate(29, 2, 2023), false);
  assert.equal(isValidDate(31, 4, 2023), false);
  assert.equal(isValidDate(0, 1, 2000), false);
  assert.equal(isValidDate(1, 0, 2000), false);
  assert.equal(isValidDate(1, 13, 2000), false);
  assert.equal(isValidDate(1.5, 1, 2000), false);
  assert.equal(isValidDate('1', 1, 2000), false);
  assert.equal(isValidDate(NaN, 1, 2000), false);
});

test('weekday matches the JS calendar for every day 1900-2099', () => {
  let n = 0;
  for (let y = 1900; y <= 2099; y++) {
    for (let m = 1; m <= 12; m++) {
      for (let d = 1; d <= daysInMonth(y, m); d++) {
        const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
        const want = (js + 6) % 7;                           // 0 = Monday
        if (weekdayIndex(d, m, y) !== want) assert.fail(`${d}-${m}-${y}`);
        n++;
      }
    }
  }
  assert.equal(n, 73049);
});

test('weekday: known dates', () => {
  assert.equal(weekday(1, 1, 1900), 'Monday');
  assert.equal(weekday(1, 1, 2000), 'Saturday');
  assert.equal(weekday(17, 11, 2017), 'Friday');
  assert.equal(weekday(31, 12, 2099), 'Thursday');
});

test('weekdayIndex throws on a bad date', () => {
  assert.throws(() => weekdayIndex(30, 2, 2000), RangeError);
  assert.throws(() => weekday(1, 1, 1800), /Bad date: 1-1-1800/);
});

test('parseDate', () => {
  assert.deepEqual(parseDate('17 November 2017'), { d: 17, m: 11, y: 2017 });
  assert.deepEqual(parseDate('  1   January 1900 '), { d: 1, m: 1, y: 1900 });
  assert.throws(() => parseDate('17 Novem 2017'), RangeError);
  assert.throws(() => parseDate('30 February 2000'), RangeError);
  assert.throws(() => parseDate('17 november 2017'), RangeError); // month name is case sensitive
  assert.throws(() => parseDate(''), RangeError);
});

test('parseDMY', () => {
  assert.deepEqual(parseDMY('14-3-1978'), { d: 14, m: 3, y: 1978 });
  assert.deepEqual(parseDMY('01-01-2000'), { d: 1, m: 1, y: 2000 });
  assert.throws(() => parseDMY('3-14-1978'), RangeError);
  assert.throws(() => parseDMY('14/3/1978'), RangeError);
});

test('formatDate and formatFull', () => {
  assert.equal(formatDate({ d: 5, m: 6, y: 2001 }), '5 June 2001');
  assert.equal(formatFull({ d: 17, m: 11, y: 2017 }), 'Friday, 17 November 2017');
  for (const s of ['1 January 1900', '29 February 2024', '31 December 2099']) assert.equal(formatDate(parseDate(s)), s);
});
