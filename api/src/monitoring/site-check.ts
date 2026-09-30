import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import https from 'node:https';
import http from 'node:http';

const blockedV4 = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const;

function ipv4Number(value: string): number {
  return value.split('.').reduce((total, part) => ((total << 8) | Number(part)) >>> 0, 0);
}

function isPublicIpv4(value: string): boolean {
  if (isIP(value) !== 4) return false;
  const address = ipv4Number(value);
  return blockedV4.every(([network, prefix]) => {
    const shift = 32 - prefix;
    return (address >>> shift) !== (ipv4Number(network) >>> shift);
  });
}

async function resolvePublicIpv4(hostname: string): Promise<string> {
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('host_not_public');
  if (isIP(hostname)) {
    if (!isPublicIpv4(hostname)) throw new Error('host_not_public');
    return hostname;
  }
  const addresses = await lookup(hostname, { all: true, family: 4, verbatim: true });
  if (!addresses.length || addresses.some((entry) => !isPublicIpv4(entry.address))) throw new Error('host_not_public');
  return addresses[0]!.address;
}

export type SiteCheckResult = {
  url: string;
  status: 'Online' | 'Offline';
  httpStatus: number | null;
  latencyMs: number;
  sslExpiresAt: string | null;
  checkedAt: string;
};

export async function checkPublicSite(input: string): Promise<SiteCheckResult> {
  let url: URL;
  try {
    const raw = input.trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) throw new Error('invalid_url');
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch { throw new Error('invalid_url'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname) throw new Error('invalid_url');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('invalid_url');

  const ip = await resolvePublicIpv4(url.hostname);
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const isHttps = url.protocol === 'https:';
  const transport = isHttps ? https : http;
  return new Promise((resolve) => {
    const req = transport.request(url, {
      method: 'HEAD',
      timeout: 8_000,
      headers: { 'User-Agent': 'NexoSiteMonitor/1.0', Accept: '*/*' },
      lookup: (_hostname, _options, callback) => callback(null, ip, 4),
    }, (response) => {
      const certificate = isHttps ? (response.socket as import('node:tls').TLSSocket).getPeerCertificate() : undefined;
      const sslExpiresAt = certificate?.valid_to ? new Date(certificate.valid_to).toISOString() : null;
      const httpStatus = response.statusCode ?? null;
      response.destroy();
      resolve({
        url: url.toString(), status: httpStatus !== null && httpStatus < 500 ? 'Online' : 'Offline',
        httpStatus, latencyMs: Date.now() - startedAt, sslExpiresAt, checkedAt,
      });
    });
    req.once('timeout', () => req.destroy(new Error('check_timeout')));
    req.once('error', () => resolve({ url: url.toString(), status: 'Offline', httpStatus: null, latencyMs: Date.now() - startedAt, sslExpiresAt: null, checkedAt }));
    req.end();
  });
}

export function isPublicIpv4Address(value: string): boolean { return isPublicIpv4(value); }
