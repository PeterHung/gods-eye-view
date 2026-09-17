#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  settingsOrigin,
  settingsTokenHash,
} from '../server/standalone/key-setup-auth.mjs';
import { hardenCredentialFile } from '../server/standalone/key-setup-hardening.mjs';
import { upsertDotenvValues } from '../src/keySetupCore.mjs';

/** Run on the deployment host. Only a hash is persisted, never the password. */
export function enableHostedSettings(sourceRoot, url) {
  const origin = settingsOrigin(url);
  if (!origin)
    throw new Error(
      '請提供有效的 HTTPS 部署網址 / A valid HTTPS URL is required.',
    );
  const filepath = path.join(sourceRoot, '.env');
  let original = '';
  try {
    if (fs.lstatSync(filepath).isSymbolicLink())
      throw new Error('Refusing a symlink .env');
    original = fs.readFileSync(filepath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const password = randomBytes(32).toString('base64url');
  const text = upsertDotenvValues(original, {
    GEV_SETTINGS_ORIGIN: origin,
    GEV_SETTINGS_TOKEN_SHA256: settingsTokenHash(password),
  });
  const temporary = path.join(sourceRoot, `.env.${randomUUID()}.tmp`);
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    if (!hardenCredentialFile(temporary))
      throw new Error('Cannot restrict configuration permissions');
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temporary, filepath);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(temporary, { force: true });
  }
  return { origin, password };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const { origin, password } = enableHostedSettings(root, process.argv[2]);
    console.log(`已啟用網頁金鑰設定 / Hosted settings enabled: ${origin}`);
    console.log(
      `管理密碼（僅顯示此次，請保存）/ Administrator password (save it now):\n${password}`,
    );
    console.log(
      '請完整停止並重新啟動 Node 服務，再重新整理網頁 → 設定服務 → 解鎖設定。',
    );
    console.log(
      'Restart the Node process, reload the page, then open Provider Settings → Unlock settings.',
    );
    console.log(
      '再次執行會更換管理密碼，原有 API 金鑰不變。/ Running again rotates the password and preserves provider keys.',
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
