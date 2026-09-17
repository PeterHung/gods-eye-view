import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectKeyUpdates,
  keySetupChipLabel,
  stripKeylessBasemapFromHash,
} from './keySetup.js';

test('the chip counts what is missing, and retires the count at zero', () => {
  assert.equal(
    keySetupChipLabel({ setCount: 0, total: 8 }),
    'POWER UP · 8 KEYS WAITING',
  );
  assert.equal(
    keySetupChipLabel({ setCount: 7, total: 8 }),
    'POWER UP · 1 KEY WAITING',
  );
  assert.equal(keySetupChipLabel({ setCount: 8, total: 8 }), 'POWERED UP');
  assert.equal(
    keySetupChipLabel(null),
    'POWERED UP',
    'no status is not a broken label',
  );
});

test('collectKeyUpdates keeps only non-empty trimmed values', () => {
  const updates = collectKeyUpdates([
    { envVar: 'OPENAI_API_KEY', value: '  sk-abc  ' },
    { envVar: 'FIRMS_MAP_KEY', value: '' },
    { envVar: 'TOMTOM_API_KEY', value: '   ' },
    { envVar: '', value: 'orphan' },
    null,
  ]);
  assert.deepEqual(updates, { OPENAI_API_KEY: 'sk-abc' });
  assert.deepEqual(collectKeyUpdates([]), {});
  assert.deepEqual(collectKeyUpdates(null), {});
});

test('the first Google key strips ONLY the keyless OSM basemap from the share hash', () => {
  const stripped = stripKeylessBasemapFromHash(
    'lat=30.2&lon=-97.7&map=osm&style=normal',
  );
  assert.ok(stripped !== null);
  const params = new URLSearchParams(stripped);
  assert.equal(params.get('map'), null, 'osm basemap removed');
  assert.equal(params.get('lat'), '30.2', 'camera survives');
  assert.equal(params.get('style'), 'normal', 'style survives');
  // A stack under any other name was chosen or shared on purpose.
  assert.equal(stripKeylessBasemapFromHash('map=bing-aerial&lat=1'), null);
  assert.equal(
    stripKeylessBasemapFromHash('lat=1&lon=2'),
    null,
    'no stack, nothing to do',
  );
  assert.equal(stripKeylessBasemapFromHash(''), null);
  assert.equal(stripKeylessBasemapFromHash(undefined), null);
});

test('aborting pending setup removes its surface and ignores a late response', async () => {
  const { initKeySetup } = await import('./keySetup.js');
  const removed = [];
  const chip = { remove: () => removed.push('chip') };
  const root = { dataset: {}, remove: () => removed.push('root') };
  let resolveResponse;
  let requestSignal;
  const controller = new AbortController();
  const pending = initKeySetup({
    documentRef: {
      getElementById: (id) => (id === 'key-setup-chip' ? chip : root),
    },
    signal: controller.signal,
    fetchImpl: (_url, { signal }) => {
      requestSignal = signal;
      return new Promise((resolve) => {
        resolveResponse = resolve;
      });
    },
  });
  controller.abort();
  assert.equal(requestSignal.aborted, true);
  assert.deepEqual(removed, ['chip', 'root']);
  resolveResponse({ ok: true, json: async () => ({ keys: [] }) });
  assert.equal(await pending, null);
});

test('setup API follows the application subdirectory', async () => {
  const { setupApiUrl } = await import('./keySetup.js');
  assert.equal(
    setupApiUrl('https://example.test/gods-eye/#map', 'status'),
    'https://example.test/gods-eye/api/setup/status',
  );
  assert.equal(
    setupApiUrl('http://localhost:4173/', 'keys'),
    'http://localhost:4173/api/setup/keys',
  );
});

test('unavailable deployment status does not invent missing credentials', async () => {
  const { readOnlyKeySetupStatus } = await import('./keySetup.js');
  const status = readOnlyKeySetupStatus();
  assert.equal(keySetupChipLabel(status), 'PROVIDER SETTINGS');
  assert.equal(status.setCount, null);
  assert.ok(status.keys.length > 0);
  assert.ok(status.keys.every((key) => key.set === null && !key.hidden));
});

function setupDocument() {
  const created = [];
  class Element extends EventTarget {
    constructor(tag = 'div') {
      super();
      this.tag = tag;
      this.dataset = {};
      this.children = [];
      this.hidden = true;
      this.textContent = '';
    }
    append(...nodes) {
      this.children.push(...nodes);
    }
    setAttribute() {}
    remove() {
      this.removed = true;
    }
  }
  const nodes = Object.fromEntries(
    [
      'chip',
      'root',
      'rows',
      'apply',
      'close',
      'label',
      'status',
      'description',
    ].map((name) => [name, new Element()]),
  );
  nodes.chip.querySelector = () => nodes.label;
  nodes.root.querySelector = (selector) =>
    ({
      '[data-key-setup-rows]': nodes.rows,
      '[data-key-setup-apply]': nodes.apply,
      '[data-key-setup-close]': nodes.close,
      '[data-key-setup-status]': nodes.status,
      '#key-setup-description': nodes.description,
    })[selector] || null;
  const documentRef = {
    baseURI: 'https://example.test/gods-eye/',
    getElementById: (id) => (id === 'key-setup-chip' ? nodes.chip : nodes.root),
    createElement: (tag) => {
      const element = new Element(tag);
      created.push(element);
      return element;
    },
  };
  return { documentRef, nodes, created };
}

for (const failure of [
  'missing',
  'denied',
  'html',
  'invalid-json',
  'network',
]) {
  test(`deployment ${failure} keeps settings visible without accepting writes`, async () => {
    const { initKeySetup } = await import('./keySetup.js');
    const fixture = setupDocument();
    const requests = [];
    const controller = await initKeySetup({
      documentRef: fixture.documentRef,
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        if (failure === 'network') throw new Error('offline');
        return {
          ok: failure === 'html' || failure === 'invalid-json',
          status: failure === 'denied' ? 403 : 404,
          json: async () => {
            if (failure === 'html') throw new SyntaxError('HTML');
            return {};
          },
        };
      },
    });
    assert.equal(fixture.nodes.chip.hidden, false);
    assert.equal(fixture.nodes.chip.removed, undefined);
    assert.equal(fixture.nodes.label.textContent, 'PROVIDER SETTINGS');
    assert.ok(fixture.nodes.rows.children.length > 0);
    assert.equal(
      fixture.created.filter((node) => node.tag === 'input').length,
      0,
    );
    assert.equal(fixture.nodes.apply.hidden, true);
    assert.equal(fixture.nodes.apply.disabled, true);
    fixture.nodes.apply.dispatchEvent(new Event('click'));
    await Promise.resolve();
    assert.equal(requests.length, 1, 'read-only mode never submits keys');
    assert.equal(
      requests[0].url,
      'https://example.test/gods-eye/api/setup/status',
    );
    controller.destroy();
  });
}

test('fully configured local installations retain the settings entry', async () => {
  const { initKeySetup } = await import('./keySetup.js');
  const fixture = setupDocument();
  const controller = await initKeySetup({
    documentRef: fixture.documentRef,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ keys: [], total: 8, setCount: 8 }),
    }),
  });
  assert.equal(fixture.nodes.chip.hidden, false);
  assert.equal(fixture.nodes.label.textContent, 'POWERED UP');
  assert.notEqual(fixture.nodes.apply.disabled, true);
  controller.destroy();
});
