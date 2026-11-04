import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../public/api.js';

const endpoint = 'https://example.com/exec';
const respond = result => async () => ({ ok: true, json: async () => result });

test('reads the requested side through Apps Script', async () => {
  const api = createApi(endpoint, async (url, options) => {
    assert.equal(new URL(url).searchParams.get('side'), 'right');
    assert.equal(options.method, 'GET');
    return { ok: true, json: async () => ({ success: true, data: [{ nickname: '눈', answer: '교감할 때' }] }) };
  });
  assert.deepEqual(await api.getAnswers('right'), [{ nickname: '눈', answer: '교감할 때' }]);
});

test('sends Korean text and retry ID as form data without JSON preflight headers', async () => {
  const api = createApi(endpoint, async (url, options) => {
    assert.equal(url, endpoint);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers, undefined);
    assert.equal(options.body.get('action'), 'addAnswer');
    assert.equal(options.body.get('answer'), '<hello> & 안녕');
    assert.equal(options.body.get('requestId'), 'retry-id');
    return { ok: true, json: async () => ({ success: true }) };
  });
  await api.addAnswer('left', { nickname: '테스트', answer: '<hello> & 안녕', requestId: 'retry-id' });
});

test('propagates server rejection so the form can retain input', async () => {
  const api = createApi(endpoint, respond({ success: false, error: '저장 실패' }));
  await assert.rejects(api.addAnswer('left', {}), /저장 실패/);
});

test('rejects connection failures and malformed lists', async () => {
  await assert.rejects(createApi(endpoint, async () => ({ ok: false })).getAnswers('left'), /서버 연결/);
  await assert.rejects(createApi(endpoint, respond({ success: true, data: null })).getAnswers('left'), /목록 형식/);
  await assert.rejects(createApi('').getAnswers('left'), /연결 주소/);
});
