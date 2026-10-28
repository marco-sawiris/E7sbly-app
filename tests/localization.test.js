'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'app/src/main/assets/translations.json'), 'utf8'));

test('native and web localized UI keys have complete English translations', () => {
  for (const file of ['app/src/main/java/com/ehsably/app/NativeComparisonView.java', 'app/src/main/assets/app.js']) {
    const source = fs.readFileSync(path.join(root,file),'utf8');
    for (const match of source.matchAll(/\bt\(("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\)/g)) {
      const key = match[1].slice(1,-1);
      assert.ok(catalog[key], `${file}: missing ${key}`);
      assert.equal(/[\u0600-\u06ff]/.test(catalog[key]), false, `English contains Arabic: ${key}`);
    }
  }
});

test('calculator validation messages have English equivalents without changing calculation API', () => {
  const source = fs.readFileSync(path.join(root,'app/src/main/assets/calculator.js'),'utf8');
  for (const match of source.matchAll(/"([^"\n]*[\u0600-\u06ff][^"\n]*)"/g)) {
    assert.ok(catalog[match[1]], `Missing calculator message: ${match[1]}`);
  }
});

test('launcher name is E7sbly and the Android 10 minimum is retained', () => {
  assert.match(fs.readFileSync(path.join(root,'app/src/main/res/values/strings.xml'),'utf8'), /<string name="app_name">E7sbly<\/string>/);
  assert.match(fs.readFileSync(path.join(root,'app/src/main/AndroidManifest.xml'),'utf8'), /minSdkVersion="29"/);
});
