import { createHash, timingSafeEqual } from 'node:crypto';

export function settingsTokenHash(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function settingsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** An explicit HTTPS origin and a random admin credential opt in to hosted editing.
 * Forwarding headers alone never authorize a request. The reverse proxy must
 * terminate TLS and overwrite Host / X-Forwarded-Host / X-Forwarded-Proto.
 */
export function admitHostedKeySetup(req, env = {}) {
  const configuredOrigin = String(env.GEV_SETTINGS_ORIGIN || '');
  const digest = String(env.GEV_SETTINGS_TOKEN_SHA256 || '');
  if (!configuredOrigin && !digest) return null; // Preserve the default local gate.
  const origin = settingsOrigin(configuredOrigin);
  const deny = (error) => ({ ok: false, status: 403, error });
  if (origin !== configuredOrigin || !/^[a-f0-9]{64}$/.test(digest))
    return deny('Hosted settings configuration is incomplete');
  const headers = req.headers || {};
  const hostHeader = String(headers['x-forwarded-host'] || headers.host || '');
  const host = hostHeader.split(',')[0].trim().split(':')[0];
  const proto = String(headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim();
  const https = Boolean(req.socket?.encrypted) || proto === 'https';
  if (!https || host !== new URL(origin).hostname)
    return deny('Hosted settings requires the configured HTTPS site');
  // GET normally has no Origin. Its same-origin Referer supplies that check.
  let requestOrigin = headers.origin;
  if (!requestOrigin && req.method === 'GET') {
    try {
      requestOrigin = new URL(headers.referer).origin;
    } catch {
      /* refuse below */
    }
  }
  if (requestOrigin !== origin)
    return deny('Cross-origin requests are refused');
  if (
    req.method === 'POST' &&
    !/^application\/json(?:\s*;|$)/i.test(headers['content-type'] || '')
  )
    return {
      ok: false,
      status: 415,
      error: 'Content-Type must be application/json',
    };
  const token = headers['x-gev-settings-token'];
  const presented =
    typeof token === 'string' && token.length > 0 && token.length <= 256
      ? settingsTokenHash(token)
      : '0'.repeat(64);
  if (
    typeof token !== 'string' ||
    token.length === 0 ||
    token.length > 256 ||
    !timingSafeEqual(Buffer.from(presented, 'hex'), Buffer.from(digest, 'hex'))
  )
    return {
      ok: false,
      status: 401,
      mode: 'locked',
      error: 'Unlock settings with the administrator password.',
    };
  return { ok: true, mode: 'hosted' };
}
