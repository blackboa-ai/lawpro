// Requires Playwright and a local frontend configured to use a disposable local API.
// Run with: node frontend/tests/case-notes.browser.cjs http://127.0.0.1:3000 http://127.0.0.1:8000
// Set BROWSER=webkit to run in WebKit, or CHANNEL=chrome to use installed Chrome.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');
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
  for (let index = 1; index <= 24; index++) {
    await create(token, { case_title: `Pagination fixture ${index}`, court_name: 'District Court' });
  }
  await create(token, { case_title: 'Short notes case', description: 'Call the clerk.' });
  await create(token, { case_title: 'No notes case', description: ' \n ' });
  const ownCase = await create(token, {
    case_title: title, description: notes, case_number: '2026/12', court_name: 'District Court',
    next_hearing_date: '2099-01-15',
  });
  const headers = { Authorization: `Bearer ${token}` };
  assert.equal((await request(`cases/${otherCase.id}`, { headers })).status, 404);
  assert.equal((await request('cases/')).status, 401);
  return { token, ownCase };
}

async function assertBorderless(locator) {
  const { outlineStyle, borderTopWidth } = await locator.evaluate(element => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, borderTopWidth: style.borderTopWidth };
  });
  assert.equal(outlineStyle, 'none');
  assert.equal(borderTopWidth, '0px');
}

async function checkLayout(browser, frontend, token, width, height, mobile) {
  const page = await browser.newPage({ viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await page.addInitScript(value => localStorage.setItem('token', value), token);
  await page.goto(`${frontend}/dashboard`);
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const modal = page.getByRole('dialog', { name: 'Case Notes', exact: true });
  const region = modal.getByRole('region', { name: 'Notes text' });
  const close = modal.getByRole('button', { name: 'Close', exact: true });
  const edit = modal.getByRole('button', { name: 'Edit Notes', exact: true });

  await preview.waitFor();
  if (process.env.LAWPRO_QA_ARTIFACTS && [320, 390, 1440].includes(width)) {
    await page.screenshot({ path: join(process.env.LAWPRO_QA_ARTIFACTS, `dashboard-${process.env.BROWSER || 'chromium'}-${width}.png`) });
  }
  assert.equal(await page.getByText('Private notes', { exact: true }).count(), 0);
  assert.equal(await page.getByRole('heading', { name: 'Private case' }).count(), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === document.documentElement.clientWidth));
  assert.equal(await page.getByRole('region', { name: 'Your cases' }).evaluate(element => {
    const { paddingLeft, borderLeftWidth, boxShadow } = getComputedStyle(element);
    return [paddingLeft, borderLeftWidth, boxShadow].join(' ');
  }), '0px 0px none', 'case cards do not have an outer panel');
  const actions = await preview.locator('..').locator('button[title], select').evaluateAll(elements =>
    elements.map(element => element.getBoundingClientRect().toJSON()));
  assert.ok(actions.every(rect => rect.height >= 44 && rect.width >= 44));
  assert.ok(actions.every(rect => Math.abs(rect.top - actions[0].top) <= 1), 'card actions fit on one row');
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
  await assertBorderless(modal);
  await assertBorderless(region);
  await assertBorderless(edit);
  if (mobile) assert.equal(await region.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
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
  assert.ok(box.x > 0 && box.y > 0 && box.x + box.width < width && box.y + box.height < height);
  assert.ok(Math.abs(box.x + box.width / 2 - width / 2) < 1, 'The modal is horizontally centered');
  assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < 1, 'The modal is vertically centered');
  assert.notEqual(await modal.evaluate(element => getComputedStyle(element, '::backdrop').backdropFilter), 'none');
  assert.equal(await modal.evaluate(element => getComputedStyle(element).borderTopWidth), '0px');
  assert.ok((await close.boundingBox()).height >= 44 && (await edit.boundingBox()).height >= 44);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  const previewBehindModal = await preview.boundingBox();
  assert.ok(Math.abs(previewBehindModal.x - previewBefore.x) < 1, 'Opening preserves the background width');
  assert.ok(Math.abs(previewBehindModal.y - previewBefore.y) < 1, 'Opening preserves the background position');

  if (mobile && browser.browserType().name() === 'chromium') {
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 5, y: 120 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 5, y: 30 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await session.detach();
  } else if (!mobile) {
    await page.mouse.move(5, 5);
    await page.mouse.wheel(0, 500);
  } else {
    await page.evaluate(() => window.scrollBy(0, 500));
  }
  assert.equal(await page.evaluate(() => window.scrollY), 0);
  if (mobile) {
    await close.tap();
  } else {
    assert.equal(await region.evaluate(element => element === document.activeElement), true);
    assert.equal(await region.evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(237, 243, 250)');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await region.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Tab');
    assert.equal(await edit.evaluate(element => element === document.activeElement), true);
    assert.equal(await edit.evaluate(element => getComputedStyle(element).textDecorationLine), 'underline');
    await page.keyboard.press('Tab');
    assert.equal(await close.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Escape');
  }
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await preview.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore);

  await page.getByRole('button', { name: 'Add notes for No notes case' }).click();
  const empty = page.getByRole('dialog', { name: 'Case Notes', exact: true });
  await empty.getByText('No notes yet.').waitFor();
  assert.ok((await empty.boundingBox()).height < 250, 'short notes use a compact dialog');
  await empty.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Case Notes for Short notes case', exact: true }).click();
  const short = page.getByRole('dialog', { name: 'Case Notes', exact: true });
  await short.getByText('Call the clerk.', { exact: true }).waitFor();
  assert.ok((await short.boundingBox()).height < 220, 'a one-line note stays compact');
  await short.getByRole('button', { name: 'Close', exact: true }).click();
  return page;
}

async function checkNotesEditing(page, token, ownCase) {
  const preview = page.getByRole('button', { name: `Case Notes for ${title}`, exact: true });
  const modal = page.getByRole('dialog', { name: 'Case Notes', exact: true });
  const edit = modal.getByRole('button', { name: 'Edit Notes', exact: true });
  const field = modal.getByRole('textbox', { name: 'Notes', exact: true });
  const cancel = modal.getByRole('button', { name: 'Cancel', exact: true });
  const save = modal.getByRole('button', { name: 'Save', exact: true });
  const close = modal.getByRole('button', { name: 'Close', exact: true });
  const savedText = modal.getByRole('region').locator('p').last();
  const warning = page.getByRole('dialog', { name: 'Discard unsaved notes?' });

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
  assert.ok(await modal.locator('.floating-body').evaluate(element => element.scrollWidth === element.clientWidth));
  const viewport = page.viewportSize();
  await page.setViewportSize({ width: viewport.width, height: 260 });
  await page.waitForFunction(() => {
    const dialog = document.querySelector('dialog[open]');
    return parseFloat(dialog?.style.getPropertyValue('--dialog-viewport-height')) <= 261;
  });
  for (const action of [save, cancel, close]) {
    const rect = await action.boundingBox();
    assert.ok(rect.y >= 0 && rect.y + rect.height <= 260, 'editing actions fit above a reduced viewport');
  }
  if (process.env.LAWPRO_QA_ARTIFACTS && viewport.width === 390) {
    await page.screenshot({ path: join(process.env.LAWPRO_QA_ARTIFACTS, `notes-editor-${process.env.BROWSER || 'chromium'}-390.png`) });
  }
  await page.setViewportSize(viewport);
  // The browser runner has no system keyboard. Simulate the resize and pan events iOS sends.
  for (const visibleHeight of [210, 155]) {
    await page.evaluate(height => {
      const viewport = window.visualViewport;
      Object.defineProperties(viewport, {
        height: { configurable: true, value: height },
        offsetTop: { configurable: true, value: 32 },
      });
      viewport.dispatchEvent(new Event('resize'));
      Object.defineProperty(viewport, 'offsetTop', { value: 16 });
      viewport.dispatchEvent(new Event('scroll'));
    }, visibleHeight);
    const dialogBox = await modal.boundingBox();
    assert.ok(Math.abs(dialogBox.y + dialogBox.height / 2 - (16 + visibleHeight / 2)) < 1);
    for (const action of [save, cancel, close]) {
      const rect = await action.boundingBox();
      assert.ok(rect.y >= 16 && rect.y + rect.height <= 16 + visibleHeight);
      assert.ok(await action.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      }));
    }
  }
  await page.evaluate(() => {
    delete visualViewport.height;
    delete visualViewport.offsetTop;
    visualViewport.dispatchEvent(new Event('resize'));
  });
  await cancel.tap();
  const keepEditing = warning.getByRole('button', { name: 'Keep editing' });
  await assertBorderless(warning);
  await assertBorderless(keepEditing);
  assert.equal(await keepEditing.evaluate(element => getComputedStyle(element).textDecorationLine), 'none');
  await keepEditing.tap();
  assert.equal(await field.inputValue(), `${notes}\nUnsaved text`);
  assert.equal(await field.evaluate(element => element === document.activeElement), true);
  await assertBorderless(modal);
  await assertBorderless(field);
  assert.equal(await page.evaluate(() => getComputedStyle(document.body).position), 'fixed');
  await cancel.tap();
  await warning.getByRole('button', { name: 'Discard changes' }).tap();
  assert.equal(await savedText.textContent(), notes);
  assert.equal(await edit.evaluate(element => element === document.activeElement), true);

  await edit.tap();
  await field.fill('Unsaved text');
  await page.keyboard.press('Escape');
  await warning.waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await field.inputValue(), 'Unsaved text');
  await page.keyboard.press('Escape');
  await warning.getByRole('button', { name: 'Discard changes' }).tap();
  await modal.waitFor({ state: 'hidden' });
  assert.equal(await preview.evaluate(element => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dialog-open')), false);

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
  const card = page.locator('article').filter({ has: preview });
  const newCase = page.getByRole('button', { name: 'New case' });
  const create = page.getByRole('dialog', { name: 'Create new case' });
  await newCase.click();
  await create.getByRole('textbox', { name: 'Case title' }).fill('Procedural review');
  await create.getByRole('textbox', { name: 'Case number' }).fill('QA-304');
  await create.getByRole('textbox', { name: 'Court' }).fill('Civil Court');
  await create.getByLabel('Next hearing date').fill('2099-01-20');
  await create.getByRole('textbox', { name: 'Case notes' }).fill('Initial case notes');
  await create.getByRole('button', { name: 'Create case', exact: true }).click();
  await create.waitFor({ state: 'hidden' });
  const createdCard = page.locator('article').filter({ has: page.getByRole('heading', { name: 'Procedural review' }) });
  await createdCard.waitFor();
  assert.ok((await createdCard.textContent()).includes('QA-304'));
  await newCase.click();
  await create.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await newCase.evaluate(element => element === document.activeElement), true);

  await card.getByRole('button', { name: 'Edit case', exact: true }).click();
  assert.equal(await editor.getByRole('textbox', { name: 'Case notes' }).inputValue(), notes);
  await editor.getByRole('heading', { name: 'Hearing history' }).waitFor();
  await editor.getByLabel('Next hearing date').fill('2099-01-16');
  await editor.getByRole('textbox', { name: /^Notes for/ }).fill('Hearing adjourned.');
  await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
  await editor.waitFor({ state: 'hidden' });
  await card.getByText('16 Jan 2099', { exact: true }).waitFor();
  await card.getByRole('button', { name: 'Edit case', exact: true }).click();
  await editor.getByText('Hearing adjourned.').waitFor();
  await page.keyboard.press('Escape');

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

  const deleteAction = card.getByRole('button', { name: 'Delete case' });
  const confirmation = page.getByRole('dialog', { name: 'Delete case?' });
  await deleteAction.click();
  await confirmation.getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await deleteAction.evaluate(element => element === document.activeElement), true);
  await deleteAction.click();
  await confirmation.getByRole('button', { name: 'Delete case' }).click();
  await preview.waitFor({ state: 'hidden' });
  await confirmation.waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cases-heading');
  await page.reload();
  await page.getByRole('button', { name: 'Add notes for No notes case' }).waitFor();
  assert.equal(await preview.count(), 0);

  const pagination = page.getByRole('navigation', { name: 'Case pages' });
  await pagination.getByRole('button', { name: 'Next' }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 2);
  await pagination.getByText('Page 2 of 2').waitFor();
  await pagination.getByRole('button', { name: 'Previous' }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 25);
  await page.getByRole('searchbox', { name: 'Search cases' }).fill('QA-304');
  await page.getByText('1 of 27 cases', { exact: true }).waitFor();
  const windowsWebKit = process.platform === 'win32' && page.context().browser().browserType().name() === 'webkit';
  if (windowsWebKit) {
    // Windows WebKit emits the download event but cancels saving a Blob URL.
    await page.evaluate(() => {
      const createObjectURL = URL.createObjectURL;
      URL.createObjectURL = blob => {
        URL.createObjectURL = createObjectURL;
        window.exportedCsv = blob.text();
        return createObjectURL(blob);
      };
    });
  }
  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export filtered CSV' }).click();
  const file = await csv;
  assert.match(file.suggestedFilename(), /\.csv$/);
  const content = windowsWebKit ? await page.evaluate(() => window.exportedCsv) : await readFile(await file.path(), 'utf8');
  assert.ok(content.includes('Procedural review') && content.includes('QA-304') && !content.includes('Pagination fixture'));
  await page.getByRole('combobox', { name: 'Filter by status' }).selectOption('completed');
  await page.getByText('No cases match your search and filters.').waitFor();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: /Upcoming hearings/ }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByText('No cases match your search and filters.').waitFor();
  await page.getByRole('button', { name: 'All upcoming' }).click();
  await createdCard.waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dialog-open')), false);
}

async function main() {
  const frontend = localOrigin(process.argv[2]);
  const api = localOrigin(process.argv[3]);
  const engine = process.env.BROWSER || 'chromium';
  const { token, ownCase } = await seed(api);
  const browser = await playwright[engine].launch({ channel: process.env.CHANNEL });
  try {
    for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [844, 390]]) {
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
    await checkCaseActions(page);
    console.log(`${engine} desktop: centered layout, keyboard, case actions, and ownership passed`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
