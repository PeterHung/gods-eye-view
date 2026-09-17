import { createSurfaceKeyboard } from './ui/surfaceKeyboard.js';
import { KEY_SETUP_KEYS } from './keySetupCore.mjs';

/** Provider Settings stays reachable in local and deployed builds.
 * Loopback dev servers allow editing. Other deployments show setup guidance
 * without collecting credentials or enabling the local write endpoint.
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
  'This deployment does not provide browser-based key editing. Ask the site administrator to configure the environment variables below on the hosting server. This page cannot verify whether those keys are configured.';
const DEPLOYED_NOTE =
  'Server keys require a backend. Google Maps and Cesium ion keys are included at build time; rebuild and redeploy after changing them. To edit keys on your own computer, use the local deployment script.';

/** Chip label — pure, exported for tests. */
export function keySetupChipLabel(status) {
  if (status?.mode === 'read-only') return 'PROVIDER SETTINGS';
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
export async function initKeySetup({
  documentRef = globalThis.document,
  fetchImpl,
  signal,
} = {}) {
  const chip = documentRef?.getElementById?.('key-setup-chip');
  const root = documentRef?.getElementById?.('key-setup');
  if (!chip || !root || root.dataset.initialized === 'true') return null;
  root.dataset.initialized = 'true';
  const lifetime = new AbortController();
  let disposed = false;
  let disposeControls = () => {};
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    lifetime.abort();
    signal?.removeEventListener('abort', destroy);
    disposeControls();
    chip.remove();
    root.remove();
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
  let status = null;
  const request = new AbortController();
  const abortRequest = () => request.abort();
  lifetime.signal.addEventListener('abort', abortRequest, { once: true });
  const timeout = globalThis.setTimeout(() => request.abort(), 5000);
  try {
    const response = await doFetch(statusUrl, {
      cache: 'no-store',
      signal: request.signal,
    });
    if (!response.ok) throw new Error(String(response.status));
    status = await response.json();
    if (disposed) return null;
    if (
      !Array.isArray(status?.keys) ||
      !Number.isInteger(status.total) ||
      !Number.isInteger(status.setCount)
    )
      throw new Error('Invalid setup status');
  } catch {
    if (disposed) return null;
    // A missing API, login response, denied request or offline service must
    // not silently remove the entry point or imply that no keys are set.
    status = readOnlyKeySetupStatus();
  } finally {
    globalThis.clearTimeout(timeout);
    lifetime.signal.removeEventListener('abort', abortRequest);
  }

  const rowsHost = root.querySelector('[data-key-setup-rows]');
  const applyButton = root.querySelector('[data-key-setup-apply]');
  const closeButton = root.querySelector('[data-key-setup-close]');
  const chipLabel = chip.querySelector('[data-key-setup-chip-label]') || chip;
  const statusLine = root.querySelector('[data-key-setup-status]');
  const readOnly = status.mode === 'read-only';
  if (readOnly) {
    const description = root.querySelector('#key-setup-description');
    if (description) description.textContent = DEPLOYED_DESCRIPTION;
    if (statusLine) statusLine.textContent = DEPLOYED_NOTE;
    if (applyButton) {
      applyButton.hidden = true;
      applyButton.disabled = true;
    }
  }
  const defaultStatusText = statusLine?.textContent || '';
  let busy = false;
  let open = false;

  const render = (nextStatus) => {
    if (disposed) return;
    status = nextStatus;
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
      (root.querySelector('input') || closeButton)?.focus?.({
        preventScroll: true,
      });
    });
  };

  const close = () => {
    if (!open) return;
    open = false;
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
    status?.store === 'pinokio-environment'
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const payload = await response.json().catch(() => ({}));
      if (disposed) return;
      if (!response.ok || !payload.ok) {
        say(payload.error || `Save failed (${response.status}).`);
        return;
      }
      for (const input of root.querySelectorAll('input[data-env-var]'))
        input.value = '';
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
        `${doneVerb} ${storeLabel()}. Restarting — this page reloads itself.`,
      );
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
  };
  return { open: openDialog, close, render, destroy };
}
