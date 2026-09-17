import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import { parseEnv } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import {
  admitHostedKeySetup,
  settingsTokenHash,
} from '../server/standalone/key-setup-auth.mjs';
import { keySetupEndpoint } from '../server/standalone/key-setup.js';
import { enableHostedSettings } from '../scripts/enable-hosted-settings.mjs';

const origin = 'https://host.example';
const token = 'fixture-password-with-no-access-to-any-real-service';
const env = {
  GEV_SETTINGS_ORIGIN: origin,
  GEV_SETTINGS_TOKEN_SHA256: settingsTokenHash(token),
};
const headers = {
  host: '127.0.0.1:4173',
  'x-forwarded-host': 'host.example',
  'x-forwarded-proto': 'https',
  origin,
  'x-gev-settings-token': token,
  'content-type': 'application/json',
};

test('hosted access requires explicit configuration, HTTPS, exact origin and correct password', () => {
  const request = { method: 'POST', headers };
  assert.equal(admitHostedKeySetup(request, {}), null);
  assert.equal(
    admitHostedKeySetup(request, { GEV_SETTINGS_ORIGIN: origin }).status,
    403,
  );
  assert.deepEqual(admitHostedKeySetup(request, env), {
    ok: true,
    mode: 'hosted',
  });
  assert.deepEqual(
    admitHostedKeySetup(
      {
        ...request,
        headers: { ...headers, 'x-forwarded-host': 'host.example:443' },
      },
      env,
    ),
    { ok: true, mode: 'hosted' },
  );
  for (const change of [
    { origin: 'https://attacker.example' },
    { origin: undefined },
    { 'x-forwarded-host': 'attacker.example' },
    { 'x-forwarded-proto': 'http' },
    { 'x-forwarded-proto': 'http,https' },
  ])
    assert.equal(
      admitHostedKeySetup(
        { ...request, headers: { ...headers, ...change } },
        env,
      ).status,
      403,
    );
  for (const password of [undefined, '', 'wrong', 'x'.repeat(300)]) {
    const result = admitHostedKeySetup(
      { ...request, headers: { ...headers, 'x-gev-settings-token': password } },
      env,
    );
    assert.equal(result.status, 401);
    assert.equal(result.mode, 'locked');
  }
  assert.equal(
    admitHostedKeySetup(
      { ...request, headers: { ...headers, 'content-type': 'text/plain' } },
      env,
    ).status,
    415,
  );
  assert.equal(
    admitHostedKeySetup(
      {
        method: 'GET',
        headers: {
          ...headers,
          origin: undefined,
          referer: origin + '/gods-eye/',
        },
      },
      env,
    ).ok,
    true,
  );
  assert.equal(
    admitHostedKeySetup(
      { method: 'GET', headers: { ...headers, origin: undefined } },
      env,
    ).status,
    403,
  );
});

test('one-time setup preserves keys, stores only a password hash and can rotate it', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-hosted-config-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, '.env');
  fs.writeFileSync(
    file,
    '# existing configuration\nOPENAI_API_KEY=fixture-existing-key\n',
  );
  const setup = enableHostedSettings(root, origin + '/gods-eye/');
  let stored = fs.readFileSync(file, 'utf8');
  assert.equal(setup.password.length, 43);
  assert.equal(stored.includes(setup.password), false);
  assert.equal(parseEnv(stored).OPENAI_API_KEY, 'fixture-existing-key');
  assert.equal(
    parseEnv(stored).GEV_SETTINGS_TOKEN_SHA256,
    settingsTokenHash(setup.password),
  );
  if (process.platform !== 'win32')
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const second = enableHostedSettings(root, origin);
  assert.notEqual(second.password, setup.password);
  stored = fs.readFileSync(file, 'utf8');
  assert.equal(
    parseEnv(stored).GEV_SETTINGS_TOKEN_SHA256,
    settingsTokenHash(second.password),
  );
  assert.equal(stored.includes(settingsTokenHash(setup.password)), false);
  assert.throws(() => enableHostedSettings(root, 'http://host.example'));
  assert.equal(fs.readFileSync(file, 'utf8'), stored);
  fs.renameSync(file, path.join(root, 'actual-env'));
  fs.symlinkSync(path.join(root, 'actual-env'), file);
  assert.throws(() => enableHostedSettings(root, origin), /symlink/);
  assert.equal(fs.readFileSync(file, 'utf8'), stored);
});

test('proxy HTTP workflow saves, replaces and removes keys only after administrator unlock', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gev-hosted-api-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [name, value] of Object.entries({
    ...env,
    OPENAI_API_KEY: '',
    GEV_LAUNCHER: '',
  })) {
    const before = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (before === undefined) delete process.env[name];
      else process.env[name] = before;
    });
  }
  const file = path.join(root, '.env');
  fs.writeFileSync(
    file,
    `# preserved\nGEV_SETTINGS_TOKEN_SHA256=${env.GEV_SETTINGS_TOKEN_SHA256}\n`,
  );
  const routes = new Map();
  let restarts = 0;
  keySetupEndpoint({ sourceRoot: root }).configureServer({
    middlewares: { use: (route, handler) => routes.set(route, handler) },
    restart: async () => {
      restarts += 1;
    },
  });
  const server = http.createServer((req, res) => {
    // Match the deployment proxy: /gods-eye/ is stripped before forwarding.
    const handler = routes.get(req.url.replace(/^\/gods-eye/, ''));
    if (handler) handler(req, res);
    else {
      res.statusCode = 404;
      res.end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/gods-eye/api/setup/`;
  const send = (route, updates, override = {}) =>
    fetch(base + route, {
      method: updates === undefined ? 'GET' : 'POST',
      headers: { ...headers, ...override },
      ...(updates === undefined ? {} : { body: JSON.stringify(updates) }),
    });
  const locked = await send('status', undefined, {
    'x-gev-settings-token': '',
  });
  assert.equal(locked.status, 401);
  assert.deepEqual(Object.keys(await locked.json()).sort(), ['error', 'mode']);
  assert.equal(locked.headers.get('cache-control'), 'no-store');
  for (const override of [
    { 'x-gev-settings-token': 'wrong' },
    { origin: 'https://attacker.example' },
  ]) {
    assert.ok(
      [401, 403].includes(
        (await send('keys', { OPENAI_API_KEY: 'must-not-save' }, override))
          .status,
      ),
    );
    assert.equal(
      fs.readFileSync(file, 'utf8').includes('must-not-save'),
      false,
    );
  }
  assert.equal(
    (await send('keys', { GEV_SETTINGS_TOKEN_SHA256: 'cannot-rotate-here' }))
      .status,
    400,
  );
  for (const value of ['fixture-saved-key', 'fixture-replaced-key', null]) {
    const response = await send('keys', { OPENAI_API_KEY: value });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.status.mode, 'hosted');
    assert.equal(
      payload.status.keys.find((key) => key.id === 'openai').set,
      value !== null,
    );
    assert.deepEqual(payload.saved, ['OPENAI_API_KEY']);
    assert.equal(
      parseEnv(fs.readFileSync(file, 'utf8')).OPENAI_API_KEY,
      value ?? undefined,
    );
    assert.equal(process.env.OPENAI_API_KEY, value ?? '');
    if (value) assert.equal(JSON.stringify(payload).includes(value), false);
    if (process.platform !== 'win32')
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
  const status = await send('status');
  const serialized = JSON.stringify(await status.json());
  assert.equal(serialized.includes(token), false);
  assert.equal(serialized.includes(env.GEV_SETTINGS_TOKEN_SHA256), false);
  assert.ok(fs.readFileSync(file, 'utf8').startsWith('# preserved\n'));
  await delay(300);
  assert.equal(restarts, 3);
});
