import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPublicSite, isPublicIpv4Address } from '../src/monitoring/site-check.js';

test('only globally routable IPv4 addresses are eligible for checks', () => {
  assert.equal(isPublicIpv4Address('8.8.8.8'), true);
  assert.equal(isPublicIpv4Address('1.1.1.1'), true);
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '224.0.0.1']) {
    assert.equal(isPublicIpv4Address(address), false, address);
  }
});

test('rejects local and private targets before opening a connection', async () => {
  await assert.rejects(checkPublicSite('http://127.0.0.1'), /host_not_public/);
  await assert.rejects(checkPublicSite('http://10.0.0.2'), /host_not_public/);
  await assert.rejects(checkPublicSite('http://localhost'), /host_not_public/);
});

test('accepts only HTTP and HTTPS URLs without credentials or custom ports', async () => {
  await assert.rejects(checkPublicSite('ftp://example.com'), /invalid_url/);
  await assert.rejects(checkPublicSite('https://user:pass@example.com'), /invalid_url/);
  await assert.rejects(checkPublicSite('https://example.com:8443'), /invalid_url/);
});
