import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getMonthlyRunAt,
  getNextMonthlyRunAt,
  getZonedDateTimeUtc
} from '../src/lib/server/auctionSchedule.js';

test('monthly schedules clamp to the final day of short months', () => {
  const runAt = getMonthlyRunAt({
    year: 2027,
    month: 2,
    timezone: 'UTC',
    dayOfMonth: 31,
    localTime: '12:00'
  });

  assert.equal(runAt.toISOString(), '2027-02-28T12:00:00.000Z');
});

test('monthly schedules preserve local time across daylight saving changes', () => {
  const march = getMonthlyRunAt({
    year: 2027,
    month: 3,
    timezone: 'America/New_York',
    dayOfMonth: 15,
    localTime: '09:30'
  });
  const april = getNextMonthlyRunAt({
    after: march,
    timezone: 'America/New_York',
    dayOfMonth: 15,
    localTime: '09:30'
  });

  assert.equal(march.toISOString(), '2027-03-15T13:30:00.000Z');
  assert.equal(april.toISOString(), '2027-04-15T13:30:00.000Z');
});

test('monthly schedules roll December into January', () => {
  const december = new Date('2026-12-05T17:00:00.000Z');
  const january = getNextMonthlyRunAt({
    after: december,
    timezone: 'UTC',
    dayOfMonth: 5,
    localTime: '17:00'
  });

  assert.equal(january.toISOString(), '2027-01-05T17:00:00.000Z');
});

test('admin wall-clock schedule input is interpreted in the configured timezone', () => {
  const runAt = getZonedDateTimeUtc({
    localDateTime: '2027-01-05T12:00',
    timezone: 'America/New_York'
  });

  assert.equal(runAt.toISOString(), '2027-01-05T17:00:00.000Z');
});
