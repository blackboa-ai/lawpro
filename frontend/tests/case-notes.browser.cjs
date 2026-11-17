// Requires Playwright and a local frontend configured to use a disposable local API.
// Run with: node frontend/tests/case-notes.browser.cjs http://127.0.0.1:3000 http://127.0.0.1:8000
// Set BROWSER=webkit to run in WebKit, or CHANNEL=chrome to use installed Chrome.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const playwright = require('playwright');

const title = 'Boundary dispute';
const notes = `First paragraph of the case notes. ${'Review the survey and supporting documents. '.repeat(20)}\n\n` +
  `Second paragraph.\n${'UnbrokenReference'.repeat(30)}\n\n${'Contact the witness.\n'.repeat(70)}Final line.`;
const savedNotes = 'Updated first paragraph.\n\nUpdated second paragraph.';

function localOrigin(value) {
  const url = new URL(value);
  assert.equal(url.protocol, 'http:');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Use a disposable local environment');
  return url.origin;
}

async function seed(apiOrigin) {
  async function request(path, options) {
    return fetch(`${apiOrigin}/api/v1/${path}`, { ...options, redirect: 'error' });
  }

  async function account() {
    const email = `case-notes-${randomUUID()}@example.com`;
    const password = 'LocalCaseNotes-QA-2026!';
    const registration = await request('auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(registration.status, 201, await registration.text());
    const login = await request('auth/login', {
      method: 'POST', body: new URLSearchParams({ username: email, password }),
    });
    assert.equal(login.status, 200);
    return (await login.json()).access_token;
  }

  async function create(token, data) {
    const response = await request('cases/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    assert.equal(response.status, 201);
    return response.json();
  }

  const token = await account();
  const otherToken = await account();
  const otherCase = await create(otherToken, { case_title: 'Private case', description: 'Private notes' });
  await create(token, { case_title: 'No notes case', description: ' \n ' });
  await create(token, { case_title: title, description: notes, next_hearing_date: '2099-01-15' });
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await request(`cases/${otherCase.id}`, { headers })).status, 404);
  assert.equal((await request('cases/')).status, 401);
  return token;
}

async function checkLayout(browser, frontend, token, width, height, mobile) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await page.addInitScript(value => localStorage.setItem('token', value), token);
  await page.goto(`${frontend}/dashboard`);
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const modal = page.getByRole('dialog', { name: `Case Notes ${title}`, exact: true });
  const region = modal.getByRole('region', { name: 'Notes text' });
  const close = modal.getByRole('button', { name: 'Close', exact: true });
  const edit = modal.getByRole('button', { name: 'Edit Notes', exact: true });

  await preview.waitFor();
  assert.equal(await page.getByText('Private notes', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Private case' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
  const clamp = await preview.getByText(/First paragraph of the case notes/).evaluate(element => {
    const style = getComputedStyle(element);
    return { lines: style.webkitLineClamp, lineHeight: parseFloat(style.lineHeight), height: element.clientHeight };
  });
  assert.equal(clamp.lines, '2');
  assert.equal(clamp.height, clamp.lineHeight * 2);
  const heading = page.getByRole('heading', { name: title, exact: true });
  await heading.click();
  assert.equal(await modal.count(), 0, 'Clicking the case title leaves notes closed');

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await preview.scrollIntoViewIfNeeded();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  const previewBefore = await preview.boundingBox();
  if (mobile) {
    await preview.tap();
  } else {
    await preview.focus();
    await page.keyboard.press('Enter');
  }
  await modal.waitFor();
  assert.equal(await region.locator('p').last().textContent(), notes);
  const content = await region.evaluate(element => ({
    whiteSpace: getComputedStyle(element.lastElementChild).whiteSpace,
    height: element.clientHeight, scrollHeight: element.scrollHeight,
    width: element.clientWidth, scrollWidth: element.scrollWidth,
  }));
  assert.equal(content.whiteSpace, 'pre-wrap');
  assert.ok(content.height > 0 && content.scrollHeight > content.height);
  assert.equal(content.scrollWidth, content.width);
  await region.evaluate(element => { element.scrollTop = element.scrollHeight; });
  assert.ok(await region.evaluate(element => element.scrollTop > 0));

  const box = await modal.boundingBox();
  assert.ok(box.x >= 15 && box.y >= 15 && box.x + box.width <= width - 15 && box.y + box.height <= height - 15);
  assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1, `Horizontal dialog alignment: ${JSON.stringify(box)}`);
  assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < 1, `Vertical dialog alignment: ${JSON.stringify(box)}`);
  assert.ok((await close.boundingBox()).height >= 44 && (await edit.boundingBox()).height >= 44);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  const previewBehindModal = await preview.boundingBox();
  assert.ok(Math.abs(previewBehindModal.x - previewBefore.x) < 1, 'Opening preserves the background width');
  assert.ok(Math.abs(previewBehindModal.y - previewBefore.y) < 1, 'Opening preserves the background position');

  if (mobile) {
    await close.tap();
    assert.equal(await preview.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
  } else {
    assert.equal(await region.evaluate(element => element === document.activeElement), true);
    assert.equal(await region.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await edit.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await region.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 500);
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    await page.keyboard.press('Escape');
  }
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await preview.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);

  await page.getByRole('button', { name: 'Add notes for No notes case' }).click();
  const empty = page.getByRole('dialog', { name: 'Case Notes No notes case' });
  await empty.getByText('No notes yet.').waitFor();
  await empty.getByRole('button', { name: 'Close', exact: true }).click();
  return page;
}

async function checkCaseActions(page) {
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  await preview.click();
  await page.getByRole('button', { name: 'Edit Notes', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit case', exact: true });
  const field = editor.getByRole('textbox', { name: 'Case notes' });
  assert.equal(await field.inputValue(), notes);
  await field.fill(savedNotes);
  await editor.getByRole('button', { name: 'Save changes' }).click();
  await preview.getByText('Updated first paragraph.', { exact: false }).waitFor();
  await page.reload();
  await preview.click();
  const modal = page.getByRole('dialog', { name: `Case Notes ${title}`, exact: true });
  assert.equal(await modal.getByRole('region').locator('p').last().textContent(), savedNotes);
  await modal.getByRole('button', { name: 'Close', exact: true }).click();

  const card = preview.locator('..');
  await card.getByRole('button', { name: 'Edit case', exact: true }).click();
  assert.equal(await field.inputValue(), savedNotes);
  await editor.getByRole('heading', { name: 'Hearing history' }).waitFor();
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();

  const status = card.getByRole('combobox', { name: `Status for ${title}` });
  const statusResponse = page.waitForResponse(response => /\/cases\/\d+$/.test(response.url()) && response.request().method() === 'PUT');
  await status.selectOption('ongoing');
  assert.equal((await statusResponse).status(), 200);
  await page.reload();
  assert.equal(await status.inputValue(), 'ongoing');

  await card.getByRole('button', { name: 'Add to calendar' }).click();
  const calendar = page.getByRole('dialog', { name: 'Add hearing to calendar?' });
  const download = page.waitForEvent('download');
  await calendar.getByRole('button', { name: 'Add to calendar' }).click();
  assert.match((await download).suggestedFilename(), /\.ics$/);

  page.once('dialog', confirmation => confirmation.accept());
  await card.getByRole('button', { name: 'Delete case' }).click();
  await preview.waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByRole('button', { name: 'Add notes for No notes case' }).waitFor();
  assert.equal(await preview.count(), 0);
}

async function main() {
  const frontend = localOrigin(process.argv[2]);
  const api = localOrigin(process.argv[3]);
  const engine = process.env.BROWSER || 'chromium';
  const token = await seed(api);
  const browser = await playwright[engine].launch({ channel: process.env.CHANNEL });
  try {
    for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [844, 390]]) {
      const page = await checkLayout(browser, frontend, token, width, height, true);
      await page.close();
      console.log(`${engine} ${width}×${height}: notes preview and touch dialog passed`);
    }
    const scrolledDesktop = await checkLayout(browser, frontend, token, 1280, 600, false);
    await scrolledDesktop.close();
    const page = await checkLayout(browser, frontend, token, 1440, 900, false);
    await checkCaseActions(page);
    console.log(`${engine} desktop: keyboard, save/refresh, case actions, and ownership passed`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
