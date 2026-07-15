import { promises as dns } from 'dns';

export function parseDbUrl(url: string) {
  const atIdx = url.lastIndexOf('@');
  const credPart = url.slice(url.indexOf('://') + 3, atIdx);
  const hostDb = url.slice(atIdx + 1);
  const colonIdx = credPart.indexOf(':');
  // Strip surrounding brackets that Supabase adds in the connection string template
  const password = credPart.slice(colonIdx + 1).replace(/^\[|\]$/g, '');
  const slashIdx = hostDb.indexOf('/');
  const hostPort = hostDb.slice(0, slashIdx);
  const database = hostDb.slice(slashIdx + 1).split('?')[0];
  const [, portStr] = hostPort.split(':');
  // Always use the Session Pooler (IPv4-compatible) instead of the direct host
  return {
    host: 'aws-0-us-west-2.pooler.supabase.com',
    port: parseInt(portStr || '5432'),
    database,
    username: 'postgres.bfegntdoabirnimnrvgd',
    password,
  };
}

export async function resolveHost(host: string): Promise<string> {
  try {
    const addresses = await dns.resolve4(host);
    return addresses[0];
  } catch {
    return host;
  }
}
