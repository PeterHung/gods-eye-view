import { LANGUAGE_KEY, resolveLanguage, translate } from './locale.js';

const ATTRIBUTES = ['title', 'aria-label', 'placeholder'];
const SKIP =
  'script, style, textarea, [contenteditable], [data-no-i18n], .material-symbols-outlined, #cesiumContainer, #world-overlay-actions, #intel-hud, #location-pills, #poi-row, #location-mini-city, #location-mini-poi';

/** Localize presentation without changing layer IDs, action values or data.
 * Remember source copy so switching back restores English, including nodes that
 * providers replace while Chinese is selected. Observe changed subtrees only.
 */
export function installInterfaceLanguage(doc = document, win = window) {
  let saved;
  try {
    saved = win.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* private mode */
  }
  let language = resolveLanguage(saved, win.navigator.language);
  const texts = new WeakMap();
  const attributes = new WeakMap();
  const switcher = doc.createElement('nav');
  switcher.id = 'interface-language';
  switcher.dataset.noI18n = '';
  switcher.setAttribute('aria-label', '介面語言 / Interface language');
  const buttons = ['zh-TW', 'en'].map((locale) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.lang = locale;
    button.textContent = locale === 'zh-TW' ? '繁體中文' : 'English';
    button.dataset.language = locale;
    button.addEventListener('click', () => setLanguage(locale));
    switcher.append(button);
    return button;
  });
  doc.body.append(switcher);

  function localizeText(node) {
    if (node.parentElement?.closest(SKIP)) return;
    const previous = texts.get(node);
    const original =
      previous && node.data === previous.output ? previous.original : node.data;
    const output = translate(original, language);
    texts.set(node, { original, output });
    if (node.data !== output) node.data = output;
  }
  function localizeAttributes(element) {
    if (element.closest(SKIP)) return;
    let records = attributes.get(element);
    if (!records) {
      records = new Map();
      attributes.set(element, records);
    }
    for (const name of ATTRIBUTES) {
      const current = element.getAttribute(name);
      if (current === null) {
        records.delete(name);
        continue;
      }
      const previous = records.get(name);
      const original =
        previous && current === previous.output ? previous.original : current;
      const output = translate(original, language);
      records.set(name, { original, output });
      if (current !== output) element.setAttribute(name, output);
    }
  }
  function visit(node) {
    if (node.nodeType === 3) {
      localizeText(node);
      return;
    }
    if (node.nodeType !== 1 || node.matches(SKIP)) return;
    localizeAttributes(node);
    for (const child of node.childNodes) visit(child);
  }
  const observer = new win.MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') localizeText(record.target);
      else if (record.type === 'attributes') localizeAttributes(record.target);
      else for (const node of record.addedNodes) visit(node);
    }
  });
  function setLanguage(next) {
    language = next;
    doc.documentElement.lang = language;
    for (const button of buttons)
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.language === language),
      );
    try {
      win.localStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      /* still switch this session */
    }
    visit(doc.body);
  }
  setLanguage(language);
  observer.observe(doc.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRIBUTES,
  });
  return {
    setLanguage,
    destroy() {
      observer.disconnect();
      language = 'en';
      visit(doc.body);
      switcher.remove();
    },
  };
}
