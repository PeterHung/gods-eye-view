import { createSurfaceKeyboard } from './ui/surfaceKeyboard.js';
import { KEY_SETUP_KEYS } from './keySetupCore.mjs';

/** Provider Settings stays reachable in local and deployed builds.
 * Local servers allow editing; opted-in hosted servers require admin unlock.
 * Missing backends retain actionable setup guidance.
 */
export function setupApiUrl(baseUrl, route) {
  return new URL(`./api/setup/${route}`, baseUrl).href;
}

export function readOnlyKeySetupStatus() {
  return {
    mode: 'read-only',
    total: KEY_SETUP_KEYS.filter((key) => !key.hidden).length,
    setCount: null,
    keys: KEY_SETUP_KEYS.filter((key) => !key.hidden).map((key) => ({
      ...key,
      set: null,
    })),
  };
}

const DEPLOYED_DESCRIPTION =
  'Browser key editing is not enabled on this server. Run the hosted-settings setup command on the deployment host, restart its Node service, then reload this page.';
const DEPLOYED_NOTE =
  'From the repository folder: node source/scripts/enable-hosted-settings.mjs https://your-site.example/gods-eye/ . Use your own deployment URL. Static hosting cannot save server keys.';

/** Chip label — pure, exported for tests. */
export function keySetupChipLabel(status) {
  if (['read-only', 'locked'].includes(status?.mode))
    return 'PROVIDER SETTINGS';
  const missing = Math.max(0, (status?.total || 0) - (status?.setCount || 0));
  return missing > 0
    ? `POWER UP · ${missing} ${missing === 1 ? 'KEY' : 'KEYS'} WAITING`
    : 'POWERED UP';
}

/**
 * Collect a POST body from field descriptors — pure, exported for tests.
 * @param {Array<{envVar: string, value: string}>} fields
 * @returns {Record<string, string>} non-empty trimmed values only
 */
export function collectKeyUpdates(fields) {
  const updates = {};
  for (const field of fields || []) {
    const value = String(field?.value ?? '').trim();
    if (value && field?.envVar) updates[field.envVar] = value;
  }
  return updates;
}

/**
 * After the FIRST Google key lands, the restart's reload should boot the
 * photoreal default — not faithfully restore the auto-selected keyless OSM
 * basemap from the URL's live share hash. Strips only `map=osm`: a stack under
 * any other name was chosen or shared on purpose and survives, and so does
 * everything else in the hash (camera, style, layers). Pure, exported for tests.
 * @param {string} hash Location hash without the leading '#'.
 * @returns {string|null} The rewritten hash, or null when there is nothing to strip.
 */
export function stripKeylessBasemapFromHash(hash) {
  if (!hash) return null;
  try {
    const params = new URLSearchParams(hash);
    if (!['osm', 'esri-imagery'].includes(params.get('map'))) return null;
    params.delete('map');
    return params.toString();
  } catch {
    return null;
  }
}

const TIER_DOTS = Object.freeze({ metered: '🔴', free: '🟡' });

/** Build one key row. All content is our own registry text, set via textContent. */
function buildRow(documentRef, key, readOnly = false) {
  const row = documentRef.createElement('section');
  row.className = 'key-setup-row';
  row.dataset.keyId = key.id;
  row.dataset.set = readOnly ? 'unknown' : String(Boolean(key.set));
  if (key.managed) row.dataset.managed = key.managed;
  const external = key.managed === 'external';

  const head = documentRef.createElement('div');
  head.className = 'key-setup-row-head';
  const led = documentRef.createElement('span');
  led.className = 'key-setup-led';
  led.setAttribute('aria-hidden', 'true');
  const title = documentRef.createElement('strong');
  title.textContent = key.title;
  const tier = documentRef.createElement('span');
  tier.className = 'key-setup-tier';
  tier.textContent = TIER_DOTS[key.tier] || '';
  tier.title =
    key.tier === 'metered'
      ? 'Metered — a billing-enabled account'
      : 'Free key — register, paste, done';
  head.append(led, title, tier);
  if (key.clientExposed) {
    const exposed = documentRef.createElement('span');
    exposed.className = 'key-setup-exposed';
    exposed.textContent = 'browser-side';
    exposed.title =
      'This key runs in the browser by design — restrict it at the provider (see SECURITY.md)';
    head.append(exposed);
  }
  if (external) {
    // Externally supplied credentials (shell env, Keychain, a launcher) are
    // facts this panel reports, never values it rewrites or deletes.
    const badge = documentRef.createElement('span');
    badge.className = 'key-setup-external';
    badge.textContent = 'configured externally';
    badge.title =
      'Supplied by your environment, Keychain, or launcher — change it where it was set';
    head.append(badge);
  }
  const get = documentRef.createElement('a');
  get.className = 'key-setup-get';
  get.href = key.getUrl;
  get.target = '_blank';
  get.rel = 'noopener noreferrer';
  get.textContent = key.set ? 'MANAGE ↗' : 'GET KEY ↗';
  head.append(get);

  const unlocks = documentRef.createElement('p');
  unlocks.className = 'key-setup-unlocks';
  unlocks.textContent = key.unlocks;

  row.append(head, unlocks);
  if (readOnly) {
    const names = documentRef.createElement('code');
    names.className = 'key-setup-variable-names';
    names.textContent = key.envVars.join(' · ');
    row.append(names);
  } else if (!external) {
    const fields = documentRef.createElement('div');
    fields.className = 'key-setup-fields';
    for (const envVar of key.envVars) {
      const input = documentRef.createElement('input');
      // Passwords-style so a pasted key never shows on a shared or recorded
      // screen — this app gets screen-recorded a lot.
      input.type = 'password';
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.dataset.envVar = envVar;
      input.setAttribute('aria-label', envVar);
      input.placeholder = key.set
        ? `${envVar} saved — paste to replace`
        : `paste ${envVar}`;
      fields.append(input);
    }
    if (key.managed === 'file') {
      const remove = documentRef.createElement('button');
      remove.type = 'button';
      remove.className = 'key-setup-remove';
      remove.dataset.keySetupRemove = JSON.stringify(key.envVars);
      remove.textContent = 'REMOVE';
      remove.title = `Remove ${key.title} from this app's saved keys`;
      fields.append(remove);
    }
    row.append(fields);
  }
  return row;
}

/**
 * Wire the chip + dialog. Fire-and-forget from main.js; resolves to null when
 * the application was disposed or the required markup is absent.
 */
function ensureKeySetupMarkup(documentRef) {
  if (!documentRef?.getElementById || !documentRef.createElement) return;
  let chip = documentRef.getElementById('key-setup-chip');
  let root = documentRef.getElementById('key-setup');
  const body = documentRef.body;
  if (!body) return { chip, root };
  if (!chip) {
    chip = documentRef.createElement('button');
    chip.id = 'key-setup-chip';
    chip.type = 'button';
    chip.hidden = false;
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-controls', 'key-setup');
    const icon = documentRef.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'bolt';
    const label = documentRef.createElement('span');
    label.dataset.keySetupChipLabel = '';
    label.textContent = 'POWER UP';
    chip.append(icon, label);
    body.append(chip);
  }
  if (!root) {
    root = documentRef.createElement('aside');
    root.id = 'key-setup';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-labelledby', 'key-setup-title');
    root.setAttribute('aria-describedby', 'key-setup-description');
    root.hidden = true;
    root.innerHTML = `
      <div class="key-setup-scanline" aria-hidden="true"></div>
      <header class="key-setup-header">
        <span class="key-setup-kicker">GROUND STATION · PROVIDER SETTINGS</span>
        <button type="button" class="key-setup-close" data-key-setup-close aria-label="Close key setup">
          <span class="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>
      <h2 id="key-setup-title">Power up the globe</h2>
      <p id="key-setup-description">The globe already flies keyless. Every key below switches on another real feed — paste one and it's saved into this app's local configuration, then the server restarts itself. Server-side keys stay on this machine; Google Maps and Cesium ion run in the browser and must be provider-restricted. Keys you configured elsewhere are shown but never touched.</p>
      <form class="key-setup-unlock" data-key-setup-unlock hidden>
        <label for="key-setup-password">Administrator password</label>
        <div class="key-setup-fields">
          <input id="key-setup-password" data-key-setup-password type="password" autocomplete="off" spellcheck="false" required placeholder="Paste administrator password">
        </div>
        <button class="key-setup-apply" data-key-setup-unlock-button type="submit">UNLOCK SETTINGS</button>
      </form>
      <div class="key-setup-rows" data-key-setup-rows></div>
      <div class="key-setup-footer">
        <button type="button" class="key-setup-apply" data-key-setup-apply>SAVE KEYS</button>
        <button type="button" class="key-setup-remove" data-key-setup-lock hidden>LOCK SETTINGS</button>
        <button type="button" class="key-setup-apply" data-key-setup-reload hidden>RELOAD PAGE</button>
        <span class="key-setup-hint">ESC to close</span>
      </div>
      <p class="key-setup-note" data-key-setup-status role="status" aria-live="polite">The Google Maps key buys the photorealistic planet — everything else stacks on top.</p>`;
    body.append(root);
  }
  return { chip, root };
}

export async function initKeySetup({
  documentRef = globalThis.document,
  fetchImpl,
  signal,
} = {}) {
  ensureKeySetupMarkup(documentRef);
  const chip = documentRef?.getElementById?.('key-setup-chip');
  const root = documentRef?.getElementById?.('key-setup');
  if (!chip || !root || root.dataset.initialized === 'true') return null;
  root.dataset.initialized = 'true';
  const lifetime = new AbortController();
  let disposed = false;
  let adminToken = '';
  let unlockVersion = 0;
  let disposeControls = () => {};
  const hideDialog = () => {
    if (!root) return;
    root.hidden = true;
    root.classList?.remove?.('visible');
  };
  const destroy = ({ remove = false } = {}) => {
    if (disposed) return;
    disposed = true;
    adminToken = '';
    unlockVersion += 1;
    lifetime.abort();
    signal?.removeEventListener('abort', destroy);
    disposeControls();
    delete root?.dataset?.initialized;
    hideDialog();
    if (chip) chip.hidden = false;
    if (remove) {
      chip?.remove?.();
      root?.remove?.();
    }
  };
  if (signal?.aborted) {
    destroy();
    return null;
  }
  signal?.addEventListener('abort', destroy, { once: true });
  const doFetch = fetchImpl || globalThis.fetch?.bind(globalThis);

  const baseUrl =
    documentRef.baseURI || globalThis.location?.href || 'http://localhost/';
  const statusUrl = setupApiUrl(baseUrl, 'status');
  const keysUrl = setupApiUrl(baseUrl, 'keys');
  const authHeaders = () =>
    adminToken ? { 'X-GEV-Settings-Token': adminToken } : {};
  const fetchStatus = async () => {
    const request = new AbortController();
    const abortRequest = () => request.abort();
    lifetime.signal.addEventListener('abort', abortRequest, { once: true });
    const timeout = globalThis.setTimeout(() => request.abort(), 5000);
    try {
      const response = await doFetch(statusUrl, {
        cache: 'no-store',
        credentials: 'same-origin',
        referrerPolicy: 'same-origin',
        headers: authHeaders(),
        signal: request.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && payload.mode === 'locked')
        return { ...readOnlyKeySetupStatus(), mode: 'locked' };
      if (
        !response.ok ||
        !Array.isArray(payload?.keys) ||
        !Number.isInteger(payload.total) ||
        !Number.isInteger(payload.setCount)
      )
        throw new Error('Settings API unavailable');
      return payload;
    } finally {
      globalThis.clearTimeout(timeout);
      lifetime.signal.removeEventListener('abort', abortRequest);
    }
  };
  let status;
  try {
    status = await fetchStatus();
  } catch {
    status = readOnlyKeySetupStatus();
  }
  if (disposed) {
    if (chip) chip.hidden = false;
    return null;
  }

  const rowsHost = root.querySelector('[data-key-setup-rows]');
  const applyButton = root.querySelector('[data-key-setup-apply]');
  const closeButton = root.querySelector('[data-key-setup-close]');
  const chipLabel = chip.querySelector('[data-key-setup-chip-label]') || chip;
  const statusLine = root.querySelector('[data-key-setup-status]');
  const description = root.querySelector('#key-setup-description');
  const unlockForm = root.querySelector('[data-key-setup-unlock]');
  const passwordInput = root.querySelector('[data-key-setup-password]');
  const unlockButton = root.querySelector('[data-key-setup-unlock-button]');
  const lockButton = root.querySelector('[data-key-setup-lock]');
  const reloadButton = root.querySelector('[data-key-setup-reload]');
  const localDescription = description?.textContent || '';
  const localNote = statusLine?.textContent || '';
  let defaultStatusText = localNote;
  let readOnly = true;
  let busy = false;
  let open = false;

  const render = (nextStatus) => {
    if (disposed) return;
    status = nextStatus;
    const locked = status.mode === 'locked';
    const hosted = status.mode === 'hosted';
    readOnly = locked || status.mode === 'read-only';
    if (description)
      description.textContent = locked
        ? 'Enter the administrator password to edit this server’s API keys.'
        : hosted
          ? 'Paste API keys below, then save. Server keys are stored on this server. Google Maps and Cesium ion keys run in the browser; restrict them at the provider.'
          : readOnly
            ? DEPLOYED_DESCRIPTION
            : localDescription;
    defaultStatusText = locked
      ? 'Use the password generated on the hosting server. Closing this panel locks it again.'
      : hosted
        ? 'Existing keys are never displayed. Leave a field blank to keep its saved value.'
        : readOnly
          ? DEPLOYED_NOTE
          : localNote;
    if (statusLine) statusLine.textContent = defaultStatusText;
    if (unlockForm) unlockForm.hidden = !locked;
    if (lockButton) lockButton.hidden = !hosted;
    if (reloadButton) reloadButton.hidden = true;
    if (applyButton) {
      applyButton.hidden = readOnly;
      applyButton.disabled = readOnly;
    }
    chipLabel.textContent = keySetupChipLabel(status);
    // Keep settings discoverable even when all local keys are configured.
    chip.hidden = false;
    if (!rowsHost) return;
    rowsHost.textContent = '';
    for (const key of status.keys || [])
      rowsHost.append(buildRow(documentRef, key, readOnly));
  };

  const visible = () =>
    root.isConnected &&
    root.classList.contains('visible') &&
    root.getClientRects().length > 0;

  const keyboard = createSurfaceKeyboard({
    root,
    documentRef,
    isActive: () => open && visible(),
    onEscape: () => close(),
  });

  const openDialog = () => {
    if (disposed || open) return;
    open = true;
    keyboard.activate();
    root.hidden = false;
    globalThis.requestAnimationFrame?.(() => {
      if (!open) return;
      root.classList.add('visible');
      (status.mode === 'locked'
        ? passwordInput
        : root.querySelector('input[data-env-var]') || closeButton
      )?.focus?.({
        preventScroll: true,
      });
    });
  };

  const close = () => {
    if (!open) return;
    open = false;
    lock();
    for (const input of root.querySelectorAll('input')) input.value = '';
    root.classList.remove('visible');
    const hide = () => {
      if (!open) root.hidden = true;
    };
    root.addEventListener('transitionend', hide, { once: true });
    globalThis.setTimeout?.(hide, 400);
    if (statusLine) statusLine.textContent = defaultStatusText;
    keyboard.deactivate({ restoreFocus: true });
  };

  const say = (text) => {
    if (statusLine) statusLine.textContent = text;
  };

  const storeLabel = () =>
    status?.mode === 'hosted'
      ? 'the server configuration'
      : status?.store === 'pinokio-environment'
        ? 'your app configuration'
        : 'your local .env';

  const submitUpdates = async (updates, doneVerb) => {
    if (disposed || busy || readOnly) return;
    const googleWasUnset = !status?.keys?.find(
      (key) => key.id === 'google-maps',
    )?.set;
    busy = true;
    applyButton?.setAttribute('aria-disabled', 'true');
    say('Saving…');
    try {
      const response = await doFetch(keysUrl, {
        method: 'POST',
        signal: lifetime.signal,
        credentials: 'same-origin',
        redirect: 'error',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (disposed) return;
      if (!response.ok || !payload.ok) {
        if (response.status === 401) lock();
        say(payload.error || `Save failed (${response.status}).`);
        return;
      }
      for (const input of root.querySelectorAll('input[data-env-var]'))
        input.value = '';
      if (payload.status.mode !== 'hosted' || adminToken)
        render(payload.status);
      if (googleWasUnset && payload.saved?.includes('GOOGLE_MAPS_API_KEY')) {
        const strip = () => {
          try {
            const next = stripKeylessBasemapFromHash(
              globalThis.location?.hash?.slice(1) || '',
            );
            if (next !== null)
              globalThis.history?.replaceState?.(null, '', `#${next}`);
          } catch {
            // Continuity is a nicety, never a blocker.
          }
        };
        strip();
        // The live share writer may re-serialize the still-OSM stack before
        // the restart's reload lands, so strip again at the door.
        globalThis.addEventListener?.('pagehide', strip, {
          once: true,
          signal: lifetime.signal,
        });
      }
      say(
        status.mode === 'hosted' || status.mode === 'locked'
          ? 'Saved on the server. Reload the page to apply changes.'
          : `${doneVerb} ${storeLabel()}. Restarting — this page reloads itself.`,
      );
      if (reloadButton) reloadButton.hidden = false;
    } catch (error) {
      say(`Save failed: ${error?.message || error}`);
    } finally {
      busy = false;
      applyButton?.setAttribute('aria-disabled', 'false');
    }
  };

  const onApply = async () => {
    if (disposed || busy || readOnly) return;
    const inputs = [...root.querySelectorAll('input[data-env-var]')];
    const updates = collectKeyUpdates(
      inputs.map((input) => ({
        envVar: input.dataset.envVar,
        value: input.value,
      })),
    );
    if (!Object.keys(updates).length) {
      say('Paste at least one key first.');
      return;
    }
    await submitUpdates(updates, 'Saved to');
  };

  const lock = () => {
    adminToken = '';
    unlockVersion += 1;
    if (passwordInput) passwordInput.value = '';
    if (status.mode === 'hosted')
      render({ ...readOnlyKeySetupStatus(), mode: 'locked' });
  };
  const onUnlock = async (event) => {
    event.preventDefault();
    if (busy || disposed) return;
    adminToken = String(passwordInput?.value || '').trim();
    if (!adminToken) {
      say('Enter the administrator password first.');
      return;
    }
    if (passwordInput) passwordInput.value = '';
    const attempt = ++unlockVersion;
    busy = true;
    if (unlockButton) unlockButton.disabled = true;
    say('Unlocking…');
    try {
      const nextStatus = await fetchStatus();
      if (disposed || attempt !== unlockVersion) return;
      if (nextStatus.mode !== 'hosted') {
        adminToken = '';
        say('Incorrect administrator password. Try again.');
        passwordInput?.focus?.();
        return;
      }
      render(nextStatus);
      root.querySelector('input[data-env-var]')?.focus?.();
    } catch {
      adminToken = '';
      if (!disposed && attempt === unlockVersion)
        say(
          'Cannot reach the settings service. Check the deployment and try again.',
        );
    } finally {
      busy = false;
      if (unlockButton) unlockButton.disabled = false;
    }
  };
  const reload = () => globalThis.location?.reload?.();
  unlockForm?.addEventListener('submit', onUnlock);
  lockButton?.addEventListener('click', lock);
  reloadButton?.addEventListener('click', reload);

  chip.addEventListener('click', openDialog);
  closeButton?.addEventListener('click', close);
  applyButton?.addEventListener('click', onApply);
  // Remove buttons are rendered per row; delegate so re-renders stay wired.
  rowsHost?.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-key-setup-remove]');
    if (disposed || !button || busy || readOnly) return;
    let envVars = [];
    try {
      envVars = JSON.parse(button.dataset.keySetupRemove || '[]');
    } catch {
      return;
    }
    if (!Array.isArray(envVars) || !envVars.length) return;
    // Removal is destructive and — behind a framing defense that should already
    // stop it — a clickjack target. A confirm turns a single aligned click into
    // a deliberate two-step the lure cannot pre-satisfy.
    const ok =
      typeof globalThis.confirm !== 'function' ||
      globalThis.confirm('Remove this key from your saved configuration?');
    if (!ok) return;
    void submitUpdates(
      Object.fromEntries(envVars.map((name) => [name, null])),
      'Removed from',
    );
  });

  render(status);

  // Direct entry for setup, demos and support.
  try {
    if (
      new URLSearchParams(globalThis.location?.search || '').get('setup') ===
      '1'
    )
      openDialog();
  } catch {
    // An unparsable location never blocks init.
  }

  disposeControls = () => {
    open = false;
    keyboard.destroy();
    chip.removeEventListener('click', openDialog);
    closeButton?.removeEventListener('click', close);
    applyButton?.removeEventListener('click', onApply);
    unlockForm?.removeEventListener('submit', onUnlock);
    lockButton?.removeEventListener('click', lock);
    reloadButton?.removeEventListener('click', reload);
  };
  return { open: openDialog, close, render, destroy };
}
