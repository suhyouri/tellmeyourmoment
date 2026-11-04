const SPREADSHEET_ID = '1JUW88_DGfv9QLWs2pH_IybOZrIbq_mUFBV7cN9I6okg';
const SHEETS = { left: 'WMLAlive', right: 'WMLNAlive' };
function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function getSheet(side) {
  if (!Object.prototype.hasOwnProperty.call(SHEETS, side)) throw new Error('Invalid side');
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEETS[side]);
  if (!sheet) throw new Error('Sheet not found');
  return sheet;
}
function columns(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(x => x.trim().toLowerCase());
  const nickname = headers.indexOf('nickname'), content = headers.indexOf('content');
  if (nickname < 0 || content < 0) throw new Error('Nickname / Content columns required');
  return { nickname, content };
}
function doGet(e) {
  try {
    if (e.parameter.action === 'getChallenge') return issueChallenge(e.parameter);
    const sheet = getSheet(e.parameter.side);
    const col = columns(sheet);
    const rows = sheet.getDataRange().getDisplayValues().slice(1);
    return json({success:true, data:rows.filter(r => r[col.content].trim()).map(r => ({nickname:r[col.nickname], answer:r[col.content]}))});
  } catch (error) { return json({success:false,error:error.message}); }
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const p = e.parameter;
    if (p.action !== 'addAnswer' || p.hp_email) throw new Error('Invalid request');
    const nickname = cleanText(p.nickname), answer = cleanText(p.answer);
    validateContent(nickname, answer);
    if (!validId(p.clientId)) throw new Error('페이지를 새로고침 후 다시 시도해주세요.');
    if (!nickname || nickname.length > 80 || !answer || answer.length > 2000) throw new Error('닉네임과 답변 길이를 확인해주세요.');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(p.requestId || '')) throw new Error('Invalid request ID');
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    const signature = fingerprint([p.side, nickname, answer, p.clientId]);
    const saved = cache.get('saved:' + p.requestId);
    if (saved === signature) return json({success:true});
    if (saved) throw new Error('요청 정보가 변경되었습니다. 다시 시도해주세요.');
    const tokenKey = 'token:' + p.token;
    const token = JSON.parse(cache.get(tokenKey) || 'null');
    if (!token || token.clientId !== p.clientId || token.side !== p.side || Date.now() - token.time > 600000) {
      return json({success:false, code:'CHALLENGE_EXPIRED', error:'제출 확인이 만료되었습니다. 다시 시도해주세요.'});
    }
    if (Date.now() - token.time < 2000) throw new Error('조금 기다린 후 다시 시도해주세요.');
    const rateKey = 'rate:' + p.clientId;
    const recent = JSON.parse(cache.get(rateKey) || '[]').filter(time => Date.now() - time < 600000);
    if (recent.length && Date.now() - recent[recent.length - 1] < 15000) throw new Error('15초 후 다시 작성해주세요.');
    if (recent.length >= 5) throw new Error('10분 동안 최대 5개까지 작성할 수 있습니다. 잠시 후 다시 시도해주세요.');
    const globalKey = 'writes:' + Math.floor(Date.now() / 60000);
    const count = Number(cache.get(globalKey) || 0);
    if (count >= 30) throw new Error('요청이 많습니다. 잠시 후 다시 시도해주세요.');
    const duplicateKey = 'content:' + fingerprint([p.side, nickname.toLowerCase(), answer.toLowerCase()]);
    if (cache.get(duplicateKey)) throw new Error('같은 닉네임과 답변이 이미 등록되었습니다.');
    const sheet = getSheet(p.side), col = columns(sheet);
    const row = Array(sheet.getLastColumn()).fill('');
    // Prefix formula-like input so Sheets stores it as text.
    const safe = value => /^[=+@-]/.test(value) ? "'" + value : value;
    row[col.nickname] = safe(nickname); row[col.content] = safe(answer);
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    cache.put('saved:' + p.requestId, signature, 21600);
    cache.put(duplicateKey, 'saved', 21600);
    recent.push(Date.now());
    cache.put(rateKey, JSON.stringify(recent), 600);
    cache.put(globalKey, String(count + 1), 120);
    cache.remove(tokenKey);
    return json({success:true});
  } catch (error) { return json({success:false,error:error.message}); }
  finally { if (lock.hasLock()) lock.releaseLock(); }
}

function validId(value) {
  return /^[a-zA-Z0-9-]{16,80}$/.test(value || '');
}
function cleanText(value) {
  return String(value || '').normalize('NFKC').trim();
}
function validateContent(nickname, answer) {
  const text = nickname + ' ' + answer;
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/.test(text)) {
    throw new Error('숨겨진 제어문자는 사용할 수 없습니다.');
  }
  if (!/[\p{L}\p{N}]/u.test(answer)) throw new Error('답변을 글자로 작성해주세요.');
  if (/(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|xyz|online|club|io|kr)\b)/i.test(text)) {
    throw new Error('링크나 홍보 주소는 등록할 수 없습니다.');
  }
  if (/<\/?[a-z][^>]*>/i.test(text)) throw new Error('HTML 태그는 등록할 수 없습니다.');
  if (/(.)\1{11,}/u.test(text)) throw new Error('같은 문자를 과도하게 반복할 수 없습니다.');
}
function fingerprint(parts) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(parts)));
}
function issueChallenge(p) {
  if (!validId(p.clientId) || !Object.prototype.hasOwnProperty.call(SHEETS, p.side)) throw new Error('Invalid request');
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('token:' + token, JSON.stringify({clientId:p.clientId, side:p.side, time:Date.now()}), 600);
  return json({success:true, token:token, waitMs:2500});
}
