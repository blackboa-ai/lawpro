// Regression tests for display-only legal judgment text reflow.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../lib/legalText.ts'), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleExports = {};
vm.runInNewContext(code, { exports: moduleExports });
const { formatLegalText } = moduleExports;

function blocks(input) {
  return Array.from(formatLegalText(input), block => ({ kind: block.kind, text: block.text }));
}

assert.deepEqual(blocks(`I. PROLOGUE

1. The extant controversy has emerged wearing a garb of
novelty;

however, novelty of form does not necessarily tantamount
to novelty

of substance. The wisdom from the eons has long
recognised this
distinction: in Swami Vivekananda's felicitous prose, “Name
and form
come and go, but substance remains ever the same 1”.`), [
  { kind: 'heading', text: 'I. PROLOGUE' },
  { kind: 'numbered', text: '1. The extant controversy has emerged wearing a garb of novelty; however, novelty of form does not necessarily tantamount to novelty of substance. The wisdom from the eons has long recognised this distinction: in Swami Vivekananda\'s felicitous prose, “Name and form come and go, but substance remains ever the same 1”.' },
]);

assert.deepEqual(blocks(`1. First holding.

2. Separate holding.

(a) Reason one
(b) Reason two

ORDER

Signed.
Justice Example`), [
  { kind: 'numbered', text: '1. First holding.' },
  { kind: 'numbered', text: '2. Separate holding.' },
  { kind: 'numbered', text: '(a) Reason one' },
  { kind: 'numbered', text: '(b) Reason two' },
  { kind: 'heading', text: 'ORDER' },
  { kind: 'signature', text: 'Signed.' },
  { kind: 'paragraph', text: 'Justice Example' },
]);

assert.deepEqual(blocks(`The first paragraph ends.\r\n\r\nThis is a separate paragraph.\r\n\r\n9. Next legal paragraph continues\r\nwith a soft wrap.\r\n\r\n10. Next number`), [
  { kind: 'paragraph', text: 'The first paragraph ends.' },
  { kind: 'paragraph', text: 'This is a separate paragraph.' },
  { kind: 'numbered', text: '9. Next legal paragraph continues with a soft wrap.' },
  { kind: 'numbered', text: '10. Next number' },
]);

const input = 'One\t two\r\nthree.\r\n\r\nFour.';
assert.equal(input.includes('three.'), true);
assert.deepEqual(blocks(input), [
  { kind: 'paragraph', text: 'One two three.' },
  { kind: 'paragraph', text: 'Four.' },
]);

const css = fs.readFileSync(path.join(__dirname, '../app/legal-intelligence/legal-intelligence.module.css'), 'utf8');
assert.match(css, /\.sourceText p\s*\{[^}]*white-space:\s*normal;/);
assert.match(css, /\.sourceText p\[data-kind='heading'\]/);

console.log('Legal source-text mobile reflow checks passed.');
