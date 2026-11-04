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
    const nickname = String(p.nickname || '').trim(), answer = String(p.answer || '').trim();
    if (!nickname || nickname.length > 80 || !answer || answer.length > 2000) throw new Error('닉네임과 답변 길이를 확인해주세요.');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(p.requestId || '')) throw new Error('Invalid request ID');
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    if (cache.get(p.requestId)) return json({success:true});
    const sheet = getSheet(p.side), col = columns(sheet);
    const row = Array(sheet.getLastColumn()).fill('');
    // Prefix formula-like input so Sheets stores it as text.
    const safe = value => /^[=+@-]/.test(value) ? "'" + value : value;
    row[col.nickname] = safe(nickname); row[col.content] = safe(answer);
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    cache.put(p.requestId, 'saved', 21600);
    return json({success:true});
  } catch (error) { return json({success:false,error:error.message}); }
  finally { if (lock.hasLock()) lock.releaseLock(); }
}
