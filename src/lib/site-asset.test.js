import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSiteAssetPayload, siteAssetUrlForEdit, siteMonitorSchedulesForAsset } from './site-asset.js';

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

test('site asset URLs must match the public monitor supported HTTP rules', () => {
  const client = { id: 'client-1', name: 'Cliente Exemplo' };
  for (const url of ['ftp://cliente.example', 'https://user:secret@cliente.example', 'https://cliente.example:8443', 'http://localhost']) {
    assert.throws(() => buildSiteAssetPayload({ name: 'Site', url }, client), /URL|dominios publicos/i, url);
  }
});
