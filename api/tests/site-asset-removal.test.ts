import assert from 'node:assert/strict';
import test from 'node:test';
import { siteAssetScheduleIds } from '../src/monitoring/site-asset-removal.js';

test('site deletion plan includes only the linked schedules and compares IDs safely', () => {
  const schedules = [
    { id: 'schedule-1', data: { siteAssetId: 'site-1' } },
    { id: 'schedule-2', data: { siteAssetId: 'site-1' } },
    { id: 'schedule-other', data: { siteAssetId: 'site-10' } },
    { id: 'schedule-legacy', data: { siteAssetId: 1 } },
    { id: 'schedule-empty', data: null },
  ];
  assert.deepEqual(siteAssetScheduleIds('site-1', schedules), ['schedule-1', 'schedule-2']);
  assert.deepEqual(siteAssetScheduleIds('1', schedules), ['schedule-legacy']);
  assert.deepEqual(siteAssetScheduleIds('', schedules), []);
});
