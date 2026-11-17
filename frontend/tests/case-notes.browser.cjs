// Requires Playwright and a local frontend configured to use a disposable local API.
// Run with: node frontend/tests/case-notes.browser.cjs http://127.0.0.1:3000 http://127.0.0.1:8000
// Set BROWSER=webkit to run in WebKit, or CHANNEL=chrome to use installed Chrome.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
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
  await create(token, { case_title: 'Short notes case', description: 'Call the clerk.' });
  const ownCase = await create(token, {
    case_title: title, description: notes, case_number: '2026/12', court_name: 'District Court',
    next_hearing_date: '2099-01-15',
  });
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await request(`cases/${otherCase.id}`, { headers })).status, 404);
  assert.equal((await request('cases/')).status, 401);
  return { token, ownCase, createCase: data => create(token, data) };
}

async function checkLayout(browser, frontend, token, width, height, mobile) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await page.addInitScript(value => localStorage.setItem('token', value), token);
  await page.goto(`${frontend}/dashboard`);
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const modal = page.getByRole('dialog', { name: `Case Notes ${title}`, exact: true });
  const region = modal.getByRole('region', { name: 'Notes text' });
  const scroller = region.locator('..');
  const close = modal.getByRole('button', { name: 'Close', exact: true });
  const edit = modal.getByRole('button', { name: 'Edit Notes', exact: true });

  await preview.waitFor();
  assert.equal(await page.getByText('Private notes', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Private case' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
  const caseList = page.getByRole('region', { name: 'Your cases' });
  const panel = await caseList.evaluate(element => {
    const style = getComputedStyle(element);
    return { padding: style.paddingLeft, border: style.borderLeftWidth, shadow: style.boxShadow, background: style.backgroundColor };
  });
  if (width <= 640) {
    assert.deepEqual(panel, { padding: '0px', border: '0px', shadow: 'none', background: 'rgba(0, 0, 0, 0)' });
    const card = await preview.locator('..').boundingBox();
    for (const field of [page.getByRole('searchbox', { name: 'Search cases' }), page.getByLabel('Filter by status')]) {
      const box = await field.boundingBox();
      assert.ok(Math.abs(box.x - card.x) < 1 && Math.abs(box.width - card.width) < 1);
    }
  } else {
    assert.equal(panel.border, '1px');
  }
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
  assert.equal(await region.locator('p').evaluate(element => getComputedStyle(element).whiteSpace), 'pre-wrap');
  const content = await scroller.evaluate(element => ({
    height: element.clientHeight, scrollHeight: element.scrollHeight,
    width: element.clientWidth, scrollWidth: element.scrollWidth,
  }));
  assert.ok(content.height > 0 && content.scrollHeight > content.height);
  assert.equal(content.scrollWidth, content.width);
  const box = await modal.boundingBox();
  if (mobile) {
    assert.equal(box.x, 0);
    assert.equal(box.width, width);
    assert.ok(Math.abs(box.y + box.height - height) < 1, 'The sheet sits at the bottom');
    assert.ok(Math.abs(box.height - height * 0.85) < 1, 'Long notes reach the 85% height cap');
  } else {
    assert.equal(box.width, 560);
    assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1, 'The modal is horizontally centered');
    assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < 1, 'The modal is vertically centered');
  }
  assert.equal(await modal.evaluate(element => getComputedStyle(element).borderTopWidth), '0px');
  assert.ok((await close.boundingBox()).height >= 44 && (await edit.boundingBox()).height >= 44);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  const previewBehindModal = await preview.boundingBox();
  assert.ok(Math.abs(previewBehindModal.x - previewBefore.x) < 1, 'Opening preserves the background width');
  assert.ok(Math.abs(previewBehindModal.y - previewBefore.y) < 1, 'Opening preserves the background position');

  if (mobile) {
    await scroller.evaluate(element => { element.scrollTop = element.scrollHeight; });
    assert.ok(await scroller.evaluate(element => element.scrollTop > 0));
    await scroller.evaluate(element => { element.scrollTop = 0; });
    await close.tap();
    assert.equal(await preview.evaluate(element => getComputedStyle(element).outlineStyle), 'none');
  } else {
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    assert.equal(await close.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await edit.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await region.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('End');
    await page.waitForFunction(() => document.activeElement.parentElement.scrollTop > 0);
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
  assert.ok((await empty.boundingBox()).height < box.height);
  await empty.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Case Notes for Short notes case', exact: true }).click();
  const short = page.getByRole('dialog', { name: 'Case Notes Short notes case', exact: true });
  const shortText = short.getByText('Call the clerk.', { exact: true });
  const textBox = await shortText.boundingBox();
  const editBox = await short.getByRole('button', { name: 'Edit Notes' }).boundingBox();
  assert.ok((await short.boundingBox()).height < 200, 'Short notes wrap their content');
  assert.ok(editBox.y - (textBox.y + textBox.height) < 40, 'Actions follow the note');
  await short.getByRole('button', { name: 'Close', exact: true }).click();
  return page;
}

async function checkNotesEditing(page, token, ownCase) {
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const modal = page.getByRole('dialog', { name: `Case Notes ${title}`, exact: true });
  const edit = modal.getByRole('button', { name: 'Edit Notes', exact: true });
  const field = modal.getByRole('textbox', { name: 'Notes', exact: true });
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
  const save = modal.getByRole('button', { name: 'Save', exact: true });
  const close = modal.getByRole('button', { name: 'Close', exact: true });
  const savedText = modal.getByRole('region').locator('p').last();

  await preview.tap();
  await edit.tap();
  assert.equal(await page.getByRole('dialog', { name: 'Edit case', exact: true }).count(), 0);
  assert.equal(await field.inputValue(), notes);
  assert.equal(await field.evaluate(element => element === document.activeElement), true);
  assert.equal(await save.isDisabled(), true);
  await field.fill('One line');
  const short = await field.boundingBox();
  await field.fill('Wrapped line for the growing editor.\n'.repeat(8));
  assert.ok((await field.boundingBox()).height > short.height, 'The textarea expands with the draft');
  await field.fill(`${notes}\nUnsaved text`);
  assert.ok(await field.evaluate(element => element.scrollHeight > element.clientHeight));

  // Mobile emulation has no system keyboard. Exercise the resize and pan events Safari reports.
  await page.evaluate(() => {
    const viewport = window.visualViewport;
    Object.defineProperties(viewport, {
      height: { configurable: true, value: 210 },
      offsetTop: { configurable: true, value: 32 },
    });
    viewport.dispatchEvent(new Event('resize'));
    Object.defineProperty(viewport, 'offsetTop', { value: 16 });
    viewport.dispatchEvent(new Event('scroll'));
  });
  const keyboardTop = 226;
  const sheet = await modal.boundingBox();
  const input = await field.boundingBox();
  for (const button of [cancel, save]) {
    const control = await button.boundingBox();
    assert.ok(control.y + control.height <= keyboardTop, 'Actions stay above the keyboard');
    assert.equal(await button.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2) === element;
    }), true, 'The action is reachable with the keyboard open');
  }
  assert.ok(sheet.height <= 210 * 0.85 && Math.abs(sheet.y + sheet.height - keyboardTop) < 1);
  assert.ok(input.y >= 16 && input.y + 44 < (await save.boundingBox()).y, 'The focused input is visible');
  await page.evaluate(() => {
    delete visualViewport.height;
    delete visualViewport.offsetTop;
    visualViewport.dispatchEvent(new Event('resize'));
  });

  page.once('dialog', confirmation => confirmation.dismiss());
  await cancel.tap();
  assert.equal(await field.inputValue(), `${notes}\nUnsaved text`);
  page.once('dialog', confirmation => confirmation.accept());
  await cancel.tap();
  assert.equal(await savedText.textContent(), notes);
  assert.equal(await edit.evaluate(element => element === document.activeElement), true);

  await edit.tap();
  await field.fill('Unsaved text');
  page.once('dialog', confirmation => confirmation.dismiss());
  await close.tap();
  assert.equal(await field.inputValue(), 'Unsaved text');
  page.once('dialog', confirmation => confirmation.accept());
  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });

  async function saveNotes(value, description) {
    await field.fill(value);
    const response = page.waitForResponse(res => res.url().endsWith(`/cases/${ownCase.id}`) && res.request().method() === 'PUT');
    await save.tap();
    const result = await response;
    assert.equal(result.status(), 200);
    assert.deepEqual(result.request().postDataJSON(), { description });
    assert.equal(result.request().headers().authorization, `Bearer ${token}`);
    const updated = await result.json();
    for (const key of Object.keys(ownCase).filter(key => key !== 'description' && key !== 'updated_at')) {
      assert.deepEqual(updated[key], ownCase[key], `${key} is preserved`);
    }
    await edit.waitFor();
  }

  await preview.tap();
  await edit.tap();
  await saveNotes(savedNotes, savedNotes);
  assert.equal(await savedText.textContent(), savedNotes);
  await close.tap();
  await preview.getByText('Updated first paragraph.', { exact: false }).waitFor();
  await page.reload();
  await preview.tap();
  assert.equal(await savedText.textContent(), savedNotes);
  await edit.tap();
  await saveNotes('', null);
  await modal.getByText('No notes yet.').waitFor();
  await edit.tap();
  await saveNotes(notes, notes);
  await close.tap();
}

async function checkCaseActions(page) {
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const editor = page.getByRole('dialog', { name: 'Edit case', exact: true });
  const card = preview.locator('..');
  await card.getByRole('button', { name: 'Edit case', exact: true }).click();
  assert.equal(await editor.getByRole('textbox', { name: 'Case notes' }).inputValue(), notes);
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
  await page.getByRole('heading', { name: 'Your cases', exact: true }).waitFor();
  assert.equal(await preview.count(), 0);
}

async function checkDashboardTools(page, createCase) {
  for (let index = 0; index < 25; index++) {
    await createCase({ case_title: `QA case ${index + 1}` });
  }
  await page.reload();
  await page.getByText('Page 1 of 2', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByText('Page 2 of 2', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'Short notes case', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByText('Page 1 of 2', { exact: true }).waitFor();

  await page.getByRole('searchbox', { name: 'Search cases' }).fill('District Court');
  await page.getByText('1 of 28 cases', { exact: true }).waitFor();
  await page.getByRole('heading', { name: title, exact: true }).waitFor();
  await page.getByLabel('Filter by status').selectOption('ongoing');
  await page.getByText('No cases match your search and filters.').waitFor();
  await page.getByLabel('Filter by status').selectOption('pending');
  await page.getByText('1 of 28 cases', { exact: true }).waitFor();
  const windowsWebKit = process.platform === 'win32' && page.context().browser().browserType().name() === 'webkit';
  if (windowsWebKit) {
    // Windows WebKit emits the download event but cancels saving the app's Blob URL.
    await page.evaluate(() => {
      const createObjectURL = URL.createObjectURL;
      URL.createObjectURL = blob => {
        URL.createObjectURL = createObjectURL;
        window.exportedCsv = blob.text();
        return URL.createObjectURL(blob);
      };
    });
  }
  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  const file = await exportEvent;
  assert.match(file.suggestedFilename(), /\.csv$/);
  const csv = windowsWebKit ? await page.evaluate(() => window.exportedCsv) : await readFile(await file.path(), 'utf8');
  assert.ok(csv.includes(title) && csv.includes('District Court') && !csv.includes('QA case'));
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByText('Page 1 of 2', { exact: true }).waitFor();
}

async function main() {
  const frontend = localOrigin(process.argv[2]);
  const api = localOrigin(process.argv[3]);
  const engine = process.env.BROWSER || 'chromium';
  const { token, ownCase, createCase } = await seed(api);
  const browser = await playwright[engine].launch({ channel: process.env.CHANNEL });
  try {
    for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [844, 390]]) {
      const page = await checkLayout(browser, frontend, token, width, height, true);
      if (width === 320 || width === 390) {
        await checkNotesEditing(page, token, ownCase);
        console.log(`${engine} ${width}×${height}: inline edit, discard, save, clear, and reload passed`);
      }
      await page.close();
      console.log(`${engine} ${width}×${height}: notes preview and touch dialog passed`);
    }
    const scrolledDesktop = await checkLayout(browser, frontend, token, 1280, 600, false);
    await scrolledDesktop.close();
    const page = await checkLayout(browser, frontend, token, 1440, 900, false);
    await checkDashboardTools(page, createCase);
    console.log(`${engine} desktop: search, status filters, pagination, and CSV passed`);
    await checkCaseActions(page);
    console.log(`${engine} desktop: centered layout, keyboard, case actions, and ownership passed`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
