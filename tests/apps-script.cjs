const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

function fixture() {
  const rows = [['Nickname', 'Content'], ['기존', '답변']];
  const cache = new Map();
  let now = 100000, locked = false;
  const sheet = {
    getLastColumn: () => 2,
    getRange: () => ({getDisplayValues: () => [rows[0]]}),
    getDataRange: () => ({getDisplayValues: () => rows}),
    appendRow: row => rows.push(row),
  };
  const context = {
    Date: {now: () => now},
    ContentService: {createTextOutput: text => ({setMimeType: () => JSON.parse(text)}), MimeType: {JSON:'json'}},
    SpreadsheetApp: {openById: () => ({getSheetByName: () => sheet}), flush() {}},
    LockService: {getScriptLock: () => ({waitLock: () => {locked = true;}, hasLock: () => locked, releaseLock: () => {locked = false;}})},
    CacheService: {getScriptCache: () => ({
      get: key => { const item = cache.get(key); return item && item.expires > now ? item.value : null; },
      put: (key, value, seconds) => cache.set(key, {value, expires:now + seconds * 1000}),
      remove: key => cache.delete(key),
    })},
    Utilities: {getUuid: () => crypto.randomUUID(), DigestAlgorithm:{SHA_256:'sha256'}, computeDigest: (_, value) => crypto.createHash('sha256').update(value).digest(), base64EncodeWebSafe: value => Buffer.from(value).toString('base64url')},
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('apps-script/Code.gs', 'utf8'), context);
  const base = {action:'addAnswer', side:'left', nickname:'눈', answer:'지금!', clientId:crypto.randomUUID()};
  function submission(overrides = {}, wait = 2500) {
    const values = {...base, requestId:crypto.randomUUID(), ...overrides};
    const challenge = context.doGet({parameter:{action:'getChallenge', side:values.side, clientId:values.clientId}});
    now += wait;
    return {...values, token:challenge.token};
  }
  return {rows, submission, send: p => context.doPost({parameter:p}), get: p => context.doGet({parameter:p}), advance: ms => {now += ms;}, isLocked: () => locked};
}

test('normal short Korean answer, formula safety, and idempotent retry', () => {
  const f = fixture();
  assert.equal(f.get({side:'left'}).data.length, 1);
  const p = f.submission({nickname:'=test'});
  assert.equal(f.send(p).success, true);
  assert.equal(f.rows[2][0], "'=test");
  assert.equal(f.send(p).success, true);
  assert.equal(f.rows.length, 3);
  assert.equal(f.isLocked(), false);
  assert.equal(f.send({...p, answer:'다른 답변'}).success, false);
});

test('direct POST, immediate POST, expired and cross-client tokens are blocked', () => {
  const f = fixture();
  const p = f.submission({}, 0);
  assert.equal(f.send(p).success, false);
  f.advance(2500);
  assert.equal(f.send({...p, token:''}).code, 'CHALLENGE_EXPIRED');
  assert.equal(f.send({...p, clientId:crypto.randomUUID()}).success, false);
  f.advance(600001);
  assert.equal(f.send(p).code, 'CHALLENGE_EXPIRED');
  assert.equal(f.rows.length, 2);
});

test('spam payloads never reach the sheet', () => {
  for (const values of [
    {hp_email:'bot'}, {answer:'https://spam.com'}, {nickname:'www.spam.com'},
    {answer:'<script>alert(1)</script>'}, {answer:'aaaaaaaaaaaa'},
    {answer:'!!!'}, {answer:'숨김\u200b문자'}, {answer:'a'.repeat(2001)}, {side:'bad'},
  ]) {
    const f = fixture();
    assert.equal(f.send(f.submission(values)).success, false, JSON.stringify(values));
    assert.equal(f.rows.length, 2);
    assert.equal(f.isLocked(), false);
  }
});

test('cooldown, five per ten minutes, and duplicate content are enforced', () => {
  const f = fixture();
  assert.equal(f.send(f.submission()).success, true);
  assert.equal(f.send(f.submission({answer:'다음 답변'})).success, false);
  f.advance(15000);
  assert.equal(f.send(f.submission({clientId:crypto.randomUUID()})).success, false);
  for (let i = 1; i < 5; i++) {
    f.advance(15000);
    assert.equal(f.send(f.submission({answer:`순간 ${i}`})).success, true);
  }
  f.advance(15000);
  assert.equal(f.send(f.submission({answer:'여섯 번째'})).success, false);
  f.advance(600001);
  assert.equal(f.send(f.submission({answer:'충분히 기다린 후'})).success, true);
});

test('global submission cap applies even with new client IDs', () => {
  const f = fixture();
  for (let i = 0; i < 30; i++) {
    assert.equal(f.send(f.submission({clientId:crypto.randomUUID(), answer:`답변 ${i}`}, 0)).success, false);
  }
  // Keep all writes in one server minute while allowing the minimum token age.
  const requests = Array.from({length:31}, (_, i) => f.submission({clientId:crypto.randomUUID(), answer:`전역 ${i}`}, 0));
  f.advance(2500);
  for (const p of requests.slice(0,30)) assert.equal(f.send(p).success, true);
  assert.equal(f.send(requests[30]).success, false);
});
