import { ZH_TW } from './zh-TW.js';

export const LANGUAGE_KEY = 'godsEyeView.language';
export function resolveLanguage(saved, browserLanguage = 'en') {
  if (saved === 'en' || saved === 'zh-TW') return saved;
  return /^zh(?:-|$)/i.test(browserLanguage) ? 'zh-TW' : 'en';
}
const lookup = new Map(
  Object.entries(ZH_TW).map(([en, zh]) => [en.toLowerCase(), zh]),
);
function phrase(text) {
  return lookup.get(text.toLowerCase()) ?? text;
}
const PANEL_NAMES = {
  位置: 'LOCATION',
  視覺樣式: 'VISUAL PRESETS',
  資料圖層: 'DATA LAYERS',
  顯示: 'DISPLAY',
  監視器: 'CCTV',
  情境資訊: 'CONTEXT',
  場景: 'SCENES',
  廣播: 'RADIO',
  參數: 'PARAMETERS',
};

// Whole labels and bounded UI patterns only; never translate arbitrary substrings
// in provider records, URLs, credentials, geographical names or identifiers.
export function translate(text, language) {
  // Panel disclosure labels are derived by the upstream UI from visible titles.
  // Canonicalize just these known titles so English never retains mixed copy.
  text = text.replace(/^(Expand|Collapse) (.+)$/i, (all, verb, title) =>
    PANEL_NAMES[title] ? `${verb} ${PANEL_NAMES[title]}` : all,
  );
  if (language !== 'zh-TW' || !text.trim()) return text;
  const core = text.trim().replace(/\s+/g, ' ');
  let value = phrase(core);
  if (value === core) {
    let match;
    if ((match = core.match(/^(Expand|Collapse) (.+)$/i))) {
      value = `${match[1].toLowerCase() === 'expand' ? '展開' : '收合'}${phrase(match[2])}`;
    } else if ((match = core.match(/^POWER UP · (\d+) KEYS? WAITING$/))) {
      value = `設定服務 · ${match[1]} 項待設定`;
    } else if (
      (match = core.match(
        /^Reset map to north up\. Current heading ([\d.-]+) degrees$/,
      ))
    ) {
      value = `轉回北方朝上，目前航向 ${match[1]} 度`;
    } else if (
      (match = core.match(
        /^(.+): (ON|OFF|LOADING|ENABLING|DISABLING|UNAVAILABLE|KEY REQUIRED)$/,
      ))
    ) {
      const label = phrase(match[1]);
      if (label !== match[1]) value = `${label}：${phrase(match[2])}`;
    } else if ((match = core.match(/^(\d+)\s*([smhd]) ago$/))) {
      value = `${match[1]} ${{ s: '秒', m: '分鐘', h: '小時', d: '天' }[match[2]]}前`;
    } else if (core.includes(' · ')) {
      value = core
        .split(' · ')
        .map((part) => translate(part, language))
        .join(' · ');
    }
  }
  if (value === core) return text;
  return text.replace(text.trim(), value);
}
