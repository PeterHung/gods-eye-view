import test from 'node:test';
import assert from 'node:assert/strict';
import { translate, resolveLanguage } from './locale.js';

test('saved preference wins; Chinese browser locales default to Traditional Chinese', () => {
  assert.equal(resolveLanguage('en', 'zh-TW'), 'en');
  assert.equal(resolveLanguage('zh-TW', 'en-US'), 'zh-TW');
  assert.equal(resolveLanguage(null, 'zh-HK'), 'zh-TW');
  assert.equal(resolveLanguage('unknown', 'fr'), 'en');
});
test('live layer labels retain numbers and provider names', () => {
  assert.equal(
    translate('Earthquakes (24h): ON', 'zh-TW'),
    '地震（24 小時）：開啟',
  );
  assert.equal(translate('USGS · 8s ago', 'zh-TW'), 'USGS · 8 秒前');
  assert.equal(
    translate('POWER UP · 8 KEYS WAITING', 'zh-TW'),
    '設定服務 · 8 項待設定',
  );
});
test('unknown records, credentials, coordinates and English remain unchanged', () => {
  for (const text of [
    'Taipei',
    'CAL123',
    '25.03, 121.56',
    'OPENAI_API_KEY',
    'https://example.com/ON',
    'Northern Lights',
  ]) {
    assert.equal(translate(text, 'zh-TW'), text);
  }
  assert.equal(translate('DATA LAYERS', 'en'), 'DATA LAYERS');
  assert.equal(translate('  DATA LAYERS\n', 'zh-TW'), '  資料圖層\n');
});
test('panel titles used by upstream accessibility labels restore to English', () => {
  assert.equal(translate('Expand 位置', 'en'), 'Expand LOCATION');
  assert.equal(translate('Collapse 資料圖層', 'en'), 'Collapse DATA LAYERS');
  assert.equal(translate('Collapse 資料圖層', 'zh-TW'), '收合資料圖層');
});
