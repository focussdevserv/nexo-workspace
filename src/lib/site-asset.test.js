import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSiteAssetPayload, siteAssetUrlForEdit, siteMonitorIntervalForAsset, siteMonitorScheduleControlsDisabled, siteMonitorScheduleState, siteMonitorSchedulesForAsset } from './site-asset.js';

test('site asset payload keeps display name separate and normalizes a bare domain', () => {
  const client = { id: 'client-1', name: 'Cliente Exemplo' };
  const draft = { name: 'Site principal', url: 'cliente.example', type: 'Site', dnsProvider: ' Cloudflare ', autoRenew: 'yes' };
  assert.deepEqual(buildSiteAssetPayload(draft, client), { name: 'Site principal', url: 'https://cliente.example/', clientId: 'client-1', client: 'Cliente Exemplo', type: 'Site', renewalDate: '', dnsProvider: 'Cloudflare', autoRenew: true });
});

test('site asset payload requires an address so monitoring cannot probe a display label by mistake', () => {
  assert.throws(() => buildSiteAssetPayload({ name: 'Site principal', url: ' ' }, { id: 'client-1' }), /dominio ou endereco/i);
});

test('site asset payload requires a workspace client before saving', () => {
  assert.throws(() => buildSiteAssetPayload({ name: 'Site principal', url: 'https://cliente.example' }, null), /cliente cadastrado/i);
});

test('editing a legacy asset never mistakes its display label for a monitor URL', () => {
  assert.equal(siteAssetUrlForEdit({ name: 'Site principal' }), '');
  assert.equal(siteAssetUrlForEdit({ name: 'Site principal', domain: 'cliente.example' }), 'cliente.example');
});

test('removing a site can find every schedule linked by numeric or string asset ID', () => {
  const schedules = [
    { id: 'monitor-1', siteAssetId: 42 },
    { id: 'monitor-2', siteAssetId: '42' },
    { id: 'monitor-other', siteAssetId: '420' },
    { id: 'monitor-unlinked' },
  ];
  assert.deepEqual(siteMonitorSchedulesForAsset('42', schedules).map(({ id }) => id), ['monitor-1', 'monitor-2']);
  assert.deepEqual(siteMonitorSchedulesForAsset(null, schedules), []);
});

test('monitoring state considers every schedule linked to an asset before reporting paused or saved interval', () => {
  const schedules = [
    { id: 'monitor-1', siteAssetId: 42, enabled: false, intervalMinutes: 15 },
    { id: 'monitor-2', siteAssetId: '42', enabled: true, intervalMinutes: 30 },
    { id: 'monitor-other', siteAssetId: '420', enabled: true, intervalMinutes: 15 },
  ];
  const state = siteMonitorScheduleState('42', schedules, 15);
  assert.equal(state.enabled, true);
  assert.equal(state.intervalNeedsSave, true);
  assert.deepEqual(state.enabledSchedules.map(({ id }) => id), ['monitor-2']);
  assert.equal(siteMonitorScheduleState('42', schedules, 30).intervalNeedsSave, false);
  const changedInterval = siteMonitorScheduleState(42, schedules, 5);
  assert.equal(changedInterval.intervalNeedsSave, true);
  assert.deepEqual(changedInterval.schedules.map(({ id }) => id), ['monitor-1', 'monitor-2']);
});

test('monitor interval defaults to an enabled schedule when stale or paused duplicates exist', () => {
  const schedules = [
    { id: 'paused', siteAssetId: 'site-1', enabled: false, intervalMinutes: 60 },
    { id: 'active', siteAssetId: 'site-1', enabled: true, intervalMinutes: 30 },
    { id: 'other', siteAssetId: 'site-2', enabled: true, intervalMinutes: 5 },
  ];
  assert.equal(siteMonitorIntervalForAsset('site-1', schedules), 30);
  assert.equal(siteMonitorIntervalForAsset('site-2', schedules), 5);
  assert.equal(siteMonitorIntervalForAsset('missing', schedules), 15);
});

test('all site schedule controls are disabled while any schedule mutation is in flight', () => {
  assert.equal(siteMonitorScheduleControlsDisabled({ busyId: 'asset-1' }), true);
  assert.equal(siteMonitorScheduleControlsDisabled({ loading: true }), true);
  assert.equal(siteMonitorScheduleControlsDisabled({ hasError: true }), true);
  assert.equal(siteMonitorScheduleControlsDisabled({}), false);
});

test('site asset URLs must match the public monitor supported HTTP rules', () => {
  const client = { id: 'client-1', name: 'Cliente Exemplo' };
  for (const url of ['ftp://cliente.example', 'https://user:secret@cliente.example', 'https://cliente.example:8443', 'http://localhost', 'http://127.0.0.1', 'http://127.1', 'http://10.0.0.5', 'http://172.20.0.1', 'http://192.168.1.25', 'http://169.254.1.1', 'http://100.64.0.1', 'http://192.0.2.12', 'http://198.51.100.7', 'http://203.0.113.8', 'http://[::1]', 'http://[fc00::1]', 'http://[fe80::1]', 'http://[ff02::1]']) {
    assert.throws(() => buildSiteAssetPayload({ name: 'Site', url }, client), /URL|dominios publicos/i, url);
  }
  assert.equal(buildSiteAssetPayload({ name: 'Site', url: 'https://203.0.114.8' }, client).url, 'https://203.0.114.8/');
});
