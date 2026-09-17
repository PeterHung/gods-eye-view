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

test('aborting pending setup hides its surface and ignores a late response', async () => {
  const { initKeySetup } = await import('./keySetup.js');
  const removed = [];
  const chip = {
    hidden: true,
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
    remove: () => removed.push('chip'),
  };
  const root = {
    dataset: {},
    hidden: true,
    classList: { add() {}, remove() {}, contains: () => false },
    querySelector: () => null,
    addEventListener() {},
    removeEventListener() {},
    getClientRects: () => [],
    isConnected: true,
    remove: () => removed.push('root'),
  };
  let resolveResponse;
  let requestSignal;
  const controller = new AbortController();
  const pending = initKeySetup({
    documentRef: {
      body: { append() {} },
      getElementById: (id) => (id === 'key-setup-chip' ? chip : root),
      createElement: () => ({ dataset: {}, setAttribute() {}, append() {} }),
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
  assert.equal(chip.hidden, false);
  assert.deepEqual(removed, []);
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
    set textContent(value) {
      this.text = value;
      this.children = [];
    }
    get textContent() {
      return this.text || '';
    }
    setAttribute() {}
    classList = {
      add() {},
      remove() {},
      contains() {
        return false;
      },
    };
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
      'unlock',
      'password',
      'unlockButton',
      'lock',
      'reload',
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
      '[data-key-setup-unlock]': nodes.unlock,
      '[data-key-setup-password]': nodes.password,
      '[data-key-setup-unlock-button]': nodes.unlockButton,
      '[data-key-setup-lock]': nodes.lock,
      '[data-key-setup-reload]': nodes.reload,
    })[selector] || null;
  const descendants = (node) =>
    node.children.flatMap((child) => [child, ...descendants(child)]);
  nodes.root.querySelectorAll = () =>
    descendants(nodes.rows).filter((node) => node.tag === 'input');
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

test('hosted panel unlocks, saves via app-relative API, clears secrets and locks again', async () => {
  const { initKeySetup } = await import('./keySetup.js');
  const { keySetupStatus } = await import('./keySetupCore.mjs');
  const fixture = setupDocument();
  const requests = [];
  const hosted = { ...keySetupStatus({}), mode: 'hosted' };
  const controller = await initKeySetup({
    documentRef: fixture.documentRef,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (options.headers?.['X-GEV-Settings-Token'] !== 'fixture-admin')
        return Response.json({ mode: 'locked' }, { status: 401 });
      if (options.method === 'POST')
        return Response.json({
          ok: true,
          saved: ['OPENAI_API_KEY'],
          status: hosted,
        });
      return Response.json(hosted);
    },
  });
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  assert.equal(fixture.nodes.unlock.hidden, false);
  assert.equal(fixture.nodes.apply.hidden, true);
  fixture.nodes.password.value = 'wrong';
  fixture.nodes.unlock.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  assert.match(fixture.nodes.status.textContent, /Incorrect administrator/);
  assert.equal(fixture.nodes.password.value, '');
  fixture.nodes.password.value = 'fixture-admin';
  fixture.nodes.unlock.dispatchEvent(new Event('submit', { cancelable: true }));
  await flush();
  assert.equal(fixture.nodes.unlock.hidden, true);
  assert.equal(fixture.nodes.apply.hidden, false);
  const inputs = fixture.nodes.root.querySelectorAll('input');
  assert.equal(inputs.length, 9);
  inputs.find((input) => input.dataset.envVar === 'OPENAI_API_KEY').value =
    'fixture-new-key';
  fixture.nodes.apply.dispatchEvent(new Event('click'));
  await flush();
  const saved = requests.at(-1);
  assert.equal(saved.url, 'https://example.test/gods-eye/api/setup/keys');
  assert.equal(saved.options.redirect, 'error');
  assert.deepEqual(JSON.parse(saved.options.body), {
    OPENAI_API_KEY: 'fixture-new-key',
  });
  assert.equal(saved.options.headers['X-GEV-Settings-Token'], 'fixture-admin');
  assert.equal(
    inputs.every((input) => !input.value),
    true,
  );
  assert.match(fixture.nodes.status.textContent, /Saved on the server/);
  assert.equal(fixture.nodes.reload.hidden, false);
  fixture.nodes.lock.dispatchEvent(new Event('click'));
  assert.equal(fixture.nodes.unlock.hidden, false);
  assert.equal(fixture.nodes.apply.hidden, true);
  assert.equal(fixture.nodes.root.querySelectorAll('input').length, 0);
  const count = requests.length;
  fixture.nodes.apply.dispatchEvent(new Event('click'));
  await flush();
  assert.equal(requests.length, count);
  controller.destroy();
});

test('creates settings markup when the template is missing from the document', async () => {
  const { initKeySetup } = await import('./keySetup.js');
  const created = [];
  const body = {
    children: [],
    append(...nodes) {
      this.children.push(...nodes);
    },
  };
  class Element {
    constructor(tag) {
      this.tag = tag;
      this.dataset = {};
      this.children = [];
      this.hidden = true;
      this.classList = { add() {}, remove() {}, contains: () => false };
    }
    setAttribute() {}
    append(...nodes) {
      this.children.push(...nodes);
    }
    querySelector(selector) {
      const map = {
        '[data-key-setup-rows]': this.rows,
        '[data-key-setup-apply]': this.apply,
        '[data-key-setup-close]': this.close,
        '[data-key-setup-status]': this.status,
        '#key-setup-description': this.description,
        '[data-key-setup-unlock]': this.unlock,
        '[data-key-setup-password]': this.password,
        '[data-key-setup-unlock-button]': this.unlockButton,
        '[data-key-setup-lock]': this.lock,
        '[data-key-setup-reload]': this.reload,
        '[data-key-setup-chip-label]': this.label,
      };
      return map[selector] || null;
    }
    querySelectorAll() {
      return [];
    }
    addEventListener() {}
    removeEventListener() {}
    getClientRects() {
      return [];
    }
    remove() {}
  }
  const nodes = {};
  const documentRef = {
    body,
    getElementById: (id) => nodes[id] || null,
    createElement: (tag) => {
      const el = new Element(tag);
      created.push(el);
      if (tag === 'button' && !nodes['key-setup-chip']) {
        nodes['key-setup-chip'] = el;
        el.label = new Element('span');
        el.querySelector = () => el.label;
      }
      if (tag === 'aside') {
        nodes['key-setup'] = el;
        for (const name of [
          'rows',
          'apply',
          'close',
          'status',
          'description',
          'unlock',
          'password',
          'unlockButton',
          'lock',
          'reload',
        ]) {
          el[name] = new Element('div');
        }
      }
      return el;
    },
    baseURI: 'https://example.test/gods-eye/',
  };
  const controller = await initKeySetup({
    documentRef,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(Boolean(nodes['key-setup-chip']), true);
  assert.equal(Boolean(nodes['key-setup']), true);
  assert.equal(nodes['key-setup-chip'].hidden, false);
  assert.equal(nodes['key-setup-chip'].label.textContent, 'PROVIDER SETTINGS');
  controller.destroy();
});


test('page entry creates settings before application startup', async () => {
  const main = await import('node:fs').then((fs) =>
    fs.readFileSync(new URL('./main.js', import.meta.url), 'utf8'),
  );
  assert.match(main, /import { initKeySetup } from '.\/keySetup.js';/);
  assert.match(main, /const providerSettings = initKeySetup\(\);/);
  assert.ok(
    main.indexOf('const providerSettings = initKeySetup()') <
      main.indexOf('application.start()'),
    'settings must start before the globe application',
  );
});
