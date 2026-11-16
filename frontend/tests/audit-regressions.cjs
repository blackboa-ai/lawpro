// Run with: node frontend/tests/audit-regressions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const storage = new Map();
let redirected = '';
let response;
const context = {
  exports: {}, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' } },
  localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  window: { location: { replace: value => { redirected = value; } } },
  atob, Date, URLSearchParams, TextEncoder,
  fetch: async () => response,
};
function load(file, globals) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, globals);
  return globals.exports;
}
const api = load('lib/api.ts', context);
const token = exp => 'header.' + Buffer.from(JSON.stringify({ sub: '1', email: 'sample@example.com', role: 'advocate', exp })).toString('base64url') + '.signature';

async function main() {
  api.setToken(token(Date.now() / 1000 - 10));
  assert.equal(api.getDecodedToken(), null);
  assert.equal(api.getToken(), null);
  api.setToken('malformed');
  assert.equal(api.isAuthenticated(), false);
  assert.equal(api.getToken(), null);
  api.setToken(token(Date.now() / 1000 + 3600));
  assert.equal(api.getDecodedToken().id, 1);
  response = { ok: false, status: 401, json: async () => ({ detail: 'Expired' }) };
  await assert.rejects(api.getCasesPage(new URLSearchParams('limit=25')), /Expired/);
  assert.equal(api.getToken(), null);
  assert.equal(redirected, '/login');
  response = { ok: false, status: 422, json: async () => ({ detail: [{ msg: 'Password must be at most 72 UTF-8 bytes' }] }) };
  await assert.rejects(api.register({ email: 'sample@example.com', password: 'x'.repeat(73) }), /72 UTF-8 bytes/);
  const exports = load('lib/caseExports.ts', { exports: {}, require: () => api, TextEncoder, Date });
  const item = { id: 1, user_id: 2, case_title: 'Sample', court_name: null, case_number: null, next_hearing_date: '2026-12-01' };
  const uid = data => exports.hearingCalendar(data).replace(/\r\n /g, '').match(/^UID:(.*)$/m)[1];
  assert.equal(uid(item), uid(item));
  assert.notEqual(uid(item), uid({ ...item, user_id: 3 }));
  assert.notEqual(uid(item), uid({ ...item, next_hearing_date: '2026-12-02' }));
  assert.match(exports.hearingCalendar(item), /DTEND;VALUE=DATE:20261202/);
  assert.match(exports.casesCsv([{ ...item, case_title: '=SUM(A1)' }]), /'=SUM/);
  console.log('Frontend audit regressions passed: sessions, 401, validation messages, calendar IDs, CSV escaping.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
