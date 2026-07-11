import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getNextThemeChange,
  getScheduledTheme,
  getStoredThemePreference,
  resolveTheme,
} from './theme';

test('uses light at 6am and dark at 6pm', () => {
  assert.equal(getScheduledTheme(new Date(2026, 6, 12, 6)), 'light');
  assert.equal(getScheduledTheme(new Date(2026, 6, 12, 17, 59)), 'light');
  assert.equal(getScheduledTheme(new Date(2026, 6, 12, 18)), 'dark');
  assert.equal(getScheduledTheme(new Date(2026, 6, 12, 5, 59)), 'dark');
});

test('an explicit preference overrides the schedule', () => {
  const evening = new Date(2026, 6, 12, 20);
  assert.equal(resolveTheme('light', evening), 'light');
  assert.equal(resolveTheme('dark', new Date(2026, 6, 12, 10)), 'dark');
});

test('invalid stored values return to auto mode', () => {
  assert.equal(getStoredThemePreference(null), 'auto');
  assert.equal(getStoredThemePreference('dim'), 'auto');
});

test('auto mode schedules its next boundary', () => {
  assert.deepEqual(
    getNextThemeChange(new Date(2026, 6, 12, 17, 30)),
    new Date(2026, 6, 12, 18)
  );
  assert.deepEqual(
    getNextThemeChange(new Date(2026, 6, 12, 20)),
    new Date(2026, 6, 13, 6)
  );
});

test('auto resolution restores the schedule after an override', () => {
  const morning = new Date(2026, 6, 12, 9);
  assert.equal(resolveTheme('dark', morning), 'dark');
  assert.equal(resolveTheme('auto', morning), 'light');
});

test('valid explicit preferences remain valid', () => {
  assert.equal(getStoredThemePreference('light'), 'light');
  assert.equal(getStoredThemePreference('dark'), 'dark');
  assert.equal(getStoredThemePreference('auto'), 'auto');
});
