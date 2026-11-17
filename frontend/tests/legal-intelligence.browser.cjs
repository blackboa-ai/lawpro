// Start the fixture API and a production build on port 3000. Run with Playwright
// and its browser binaries on Node's module path. No hosted accounts are used.
const assert = require('node:assert/strict');
const { join } = require('node:path');
const { chromium, webkit } = require('playwright');

const origin = process.env.LAWPRO_TEST_ORIGIN ?? 'http://127.0.0.1:3000';
const baselineOrigin = process.env.LAWPRO_BASELINE_ORIGIN;
const legalPath = '/legal-intelligence';
const widths = [[320, 568], [360, 740], [375, 667], [390, 844], [430, 932], [768, 1024], [1024, 768], [1440, 900]];
const firstLine = '  1. The motion is allowed.\n  (a) Terms follow.';
const lastLine = '  2. The clerk shall serve this order.\nSigned.';
const longTitle = `Sample bail update 1 — ${'LongUnbrokenCaseReference'.repeat(7)}`;
const longCourt = 'Very long court name that must remain in a compact filter chip on narrow screens';
const longExcerpt = 'A long legal excerpt with enough source text to exceed three lines. '.repeat(12);

const card = page => page.locator('article').first();
const dialog = page => page.getByRole('dialog');
const query = page => page.getByRole('searchbox', { name: 'Search legal updates' });
const filterToggle = page => page.getByRole('button', { name: 'Filters', exact: true });
const court = page => page.getByRole('combobox', { name: 'Court', exact: true });
const category = page => page.getByRole('combobox', { name: 'Category', exact: true });
const back = page => dialog(page).getByRole('button', { name: 'Back to Results' });
const readerBody = page => dialog(page).getByRole('region', { name: 'Document content' });

function layoutCounts(page) {
  return page.evaluate(() => ({
    viewport: window.innerWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    firstCardTop: Math.round(document.querySelector('article').getBoundingClientRect().top),
  }));
}

async function signIn(browser, engine) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const diagnostics = [];
  page.on('pageerror', error => diagnostics.push(error.message));
  page.on('requestfailed', request => diagnostics.push(`${new URL(request.url()).pathname}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.url().includes('/api/v1/auth/')) diagnostics.push(`${new URL(response.url()).pathname}: ${response.status()}`);
  });
  await page.goto(`${origin}${legalPath}`);
  await page.waitForURL('**/login');
  await page.goto(`${origin}/register`, { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(`legal-${engine}-${Date.now()}@example.org`);
  await page.getByLabel('Password', { exact: true }).fill('Local-fixture-Password-404');
  await page.getByRole('button', { name: 'Create account' }).click();
  try {
    await page.waitForURL('**/dashboard', { waitUntil: 'commit', timeout: 12000 });
  } catch (error) {
    throw new Error(`${engine} fixture signup ended at ${page.url()}: ${[...diagnostics, ...await page.getByRole('alert').allTextContents()].join('; ')}`, { cause: error });
  }
  await page.getByRole('link', { name: 'Legal Intelligence' }).click();
  await card(page).getByRole('heading', { name: 'Sample bail update 1', exact: true }).waitFor();
  const state = await context.storageState();
  await context.close();
  return state;
}

async function extendFixtures(context) {
  const items = Array.from({ length: 10 }, (_, index) => ({
    id: `layout-${index}`,
    title: index === 0 ? longTitle : `Sample bail update ${index + 1}`,
    excerpt: index === 0 ? longExcerpt : 'Sample source excerpt for a legal update.',
    source: 'Sample legal publisher',
    court_name: 'Supreme Court of India',
    subject_category: 'Criminal',
    judgment_date: '2026-11-15',
    url: 'https://example.org/',
  }));
  const filters = { courts: [{ code: 'sc', name: longCourt }], categories: [{ name: 'Criminal' }] };
  const fullText = [firstLine, ...Array(45).fill('Source text from the next paragraph.'), lastLine].join('\r\n\r\n\r\n');
  await context.addInitScript(({ items, filters, fullText }) => {
    const fetch = window.fetch;
    window.fetch = (url, options) => {
      if (!String(url).includes('/api/v1/legal-intelligence/')) return fetch(url, options);
      const path = new URL(url).pathname.split('/');
      const endpoint = path.at(-1);
      const data = endpoint === 'filters' ? filters : endpoint === 'updates' ? { items, has_more: false }
        : { ...items.find(item => item.id === endpoint), full_text: fullText };
      return Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    };
  }, { items, filters, fullText });
}

async function hit(page, locator, touch) {
  const { x, y, width, height } = await locator.boundingBox();
  if (touch) await page.touchscreen.tap(x + width / 2, y + height / 2);
  else await page.mouse.click(x + width / 2, y + height / 2);
}

async function measureReader(page, width, height, touch, article = card(page)) {
  const heading = article.getByRole('heading');
  await heading.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => window.scrollY);
  await hit(page, heading, touch);
  await dialog(page).waitFor();
  await dialog(page).getByRole('heading', { name: 'Source text' }).waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'reader-title');
  assert.equal(await back(page).evaluate(node => node.matches(':focus-visible')), false);
  assert.equal(await dialog(page).locator('#reader-title').evaluate(node => {
    const { outlineColor, outlineStyle, outlineWidth } = getComputedStyle(node);
    return outlineStyle !== 'none' && parseFloat(outlineWidth) > 0
      && !['transparent', 'rgba(0, 0, 0, 0)'].includes(outlineColor);
  }), false, 'pointer entry leaves the programmatically focused heading without a visible ring');
  const rect = await dialog(page).boundingBox();
  assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= height + 1);
  if (touch) assert.ok(Math.abs(rect.y + rect.height - height) <= 1, 'mobile reader docks to the viewport');
  assert.equal(await page.evaluate(() => document.body.style.position), 'fixed');
  assert.equal(await readerBody(page).locator('section p').first().textContent(), firstLine);
  assert.equal(await readerBody(page).locator('section p').last().textContent(), lastLine);
  assert.ok(await readerBody(page).evaluate(node => {
    node.scrollTop = node.scrollHeight;
    return node.scrollTop > 0;
  }));
  assert.ok((await back(page).boundingBox()).y >= 0);
  await hit(page, back(page), touch);
  await page.locator('dialog').waitFor({ state: 'detached' });
  await page.waitForFunction(expected => Math.abs(window.scrollY - expected) <= 1, y);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-haspopup')), 'dialog');
}

async function checkWidth(browser, storageState, width, height, engine) {
  const mobile = width <= 430;
  const context = await browser.newContext({ storageState, viewport: { width, height }, isMobile: mobile, hasTouch: mobile });
  await extendFixtures(context);
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(`${origin}${legalPath}`);
  await card(page).waitFor();
  await court(page).locator('option[value="sc"]').waitFor({ state: 'attached' });
  const { viewport, overflow, firstCardTop } = await layoutCounts(page);
  assert.equal(viewport, width);
  assert.equal(overflow, 0, 'page has no horizontal overflow');
  const submit = page.getByRole('button', { name: 'Search', exact: true });
  const inputRect = await query(page).boundingBox();
  const buttonRect = await submit.boundingBox();
  assert.ok(inputRect.width >= 120 && inputRect.x + inputRect.width <= buttonRect.x + 1);
  assert.ok(buttonRect.width >= 44 && buttonRect.height >= 44);
  const filtersRect = await filterToggle(page).boundingBox();
  for (const chip of [court(page), category(page)]) {
    const rect = await chip.boundingBox();
    assert.ok(rect.height >= 44 && rect.width <= 176 && Math.abs(rect.y - filtersRect.y) <= 1,
      `${width}px filter row: ${JSON.stringify({ chip: rect, toggle: filtersRect })}`);
    assert.deepEqual(await chip.evaluate(node => [getComputedStyle(node).appearance, getComputedStyle(node).opacity]), ['none', '0']);
  }
  assert.equal(await page.locator('input[type=date]').count(), 0);
  await filterToggle(page).click();
  await page.getByLabel('To date').waitFor();
  assert.equal((await layoutCounts(page)).overflow, 0, 'date panel fits');
  await filterToggle(page).click();
  await court(page).selectOption('sc');
  await page.getByRole('button', { name: 'Clear filters' }).waitFor();
  assert.ok(await court(page).evaluate(node => {
    const label = node.previousElementSibling;
    return node.parentElement.dataset.selected === 'true' && label.scrollWidth > label.clientWidth
      && getComputedStyle(label).textOverflow === 'ellipsis';
  }));
  assert.equal(await card(page).locator('p').evaluate(node => getComputedStyle(node).webkitLineClamp), '3');
  assert.equal((await layoutCounts(page)).overflow, 0, 'long titles and chips fit');
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.locator('section[aria-labelledby="updates-title"][aria-busy="false"]').waitFor();

  if (process.env.LAWPRO_QA_ARTIFACTS && [390, 1440].includes(width)) {
    await page.screenshot({ path: join(process.env.LAWPRO_QA_ARTIFACTS, `${engine}-search-${width}.png`) });
  }
  await measureReader(page, width, height, mobile);
  if (width === 390) {
    await measureReader(page, width, height, mobile, page.locator('article').nth(5));
    assert.ok(await page.evaluate(() => window.scrollY) > 0, 'scrolled results retain their position');
    await card(page).getByRole('heading').scrollIntoViewIfNeeded();
    await hit(page, card(page).getByRole('heading'), true);
    await dialog(page).getByRole('heading', { name: 'Source text' }).waitFor();
    if (process.env.LAWPRO_QA_ARTIFACTS) await page.screenshot({ path: join(process.env.LAWPRO_QA_ARTIFACTS, `${engine}-reader-${width}.png`) });
    for (const shorter of [520, height]) {
      await page.setViewportSize({ width, height: shorter });
      const resized = await dialog(page).boundingBox();
      assert.ok(resized.y >= 0 && Math.abs(resized.y + resized.height - shorter) <= 1);
    }
  }
  console.log(`${engine} ${width}×${height} passed (first card at ${firstCardTop}px)`);
  await context.close();
}

async function runAccessibility(page, target) {
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const violations = await page.evaluate(async selector => {
    const result = await window.axe.run(selector, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } });
    return result.violations.map(({ id, nodes }) => ({ id, elements: nodes.map(node => node.target) }));
  }, target);
  assert.deepEqual(violations, []);
}

async function checkInteractions(browser, storageState, engine, runAxe) {
  const context = await browser.newContext({ storageState, viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  await context.route('https://example.org/**', route => route.fulfill({ body: '<title>Fixture source</title>', contentType: 'text/html' }));
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  await page.goto(`${origin}${legalPath}`);
  await card(page).waitFor();
  await court(page).locator('option[value="sc"]').waitFor({ state: 'attached' });
  const privacy = page.getByLabel('Search privacy information');
  await privacy.click();
  await page.getByText('Use public information only.', { exact: false }).waitFor();
  await privacy.click();
  await filterToggle(page).click();
  await page.getByLabel('From date').fill('2026-11-11');
  await page.getByLabel('To date').fill('2026-11-01');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await page.getByText('The end date must be on or after the start date.', { exact: true }).waitFor();
  await page.getByLabel('To date').fill('2026-11-15');
  await page.getByRole('button', { name: 'Apply dates' }).click();
  await page.waitForFunction(() => document.querySelectorAll('article').length === 5);
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await filterToggle(page).click();
  await court(page).selectOption('sc');
  await category(page).selectOption('Criminal');
  await query(page).fill('bail');
  await query(page).press('Enter');
  const sorting = page.getByRole('combobox', { name: 'Sort loaded search results' });
  await sorting.selectOption('newest');

  const source = card(page).getByRole('link', { name: /Open original source/ });
  const [popup] = await Promise.all([context.waitForEvent('page'), source.click()]);
  await popup.waitForURL('https://example.org/');
  await popup.close();
  assert.equal(await dialog(page).count(), 0);
  if (runAxe) await runAccessibility(page, 'main');

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Page 2', { exact: true }).waitFor();
  const details = card(page).getByRole('button', { name: /Read details/ });
  await details.focus();
  await page.keyboard.press('Enter');
  await dialog(page).waitFor();
  await dialog(page).getByRole('heading', { name: 'Source text' }).waitFor();
  assert.ok(await back(page).evaluate(node => node === document.activeElement && node.matches(':focus-visible')
    && getComputedStyle(node).outlineStyle === 'solid'));
  if (runAxe) await runAccessibility(page, 'dialog');
  await page.keyboard.press('Tab');
  assert.ok(await readerBody(page).evaluate(node => node === document.activeElement));
  await page.keyboard.press('Escape');
  await page.locator('dialog').waitFor({ state: 'detached' });
  assert.ok(await details.evaluate(node => node === document.activeElement));
  assert.equal(await query(page).inputValue(), 'bail');
  assert.equal(await court(page).inputValue(), 'sc');
  assert.equal(await category(page).inputValue(), 'Criminal');
  assert.equal(await sorting.inputValue(), 'newest');
  assert.equal(await page.getByText('Page 2', { exact: true }).count(), 1);

  let failNext = true;
  let release;
  const held = new Promise(resolve => { release = resolve; });
  await page.route(/\/api\/v1\/legal-intelligence\/updates\?.*q=hold/, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    if (!failNext) return route.continue();
    failNext = false;
    await held;
    await route.fulfill({ status: 503, headers: { 'access-control-allow-origin': origin }, json: { detail: 'Fixture outage' } });
  });
  await query(page).fill('hold');
  await query(page).press('Enter');
  await page.getByText('Loading legal updates…').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Search', exact: true }).isDisabled(), true);
  release();
  await page.getByText('Legal updates couldn’t load.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByText('No legal updates found.', { exact: false }).waitFor();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await card(page).waitFor();
  assert.equal(await query(page).inputValue(), '');
  console.log(`${engine} authentication, search, date/court/category filters, source popup, keyboard focus, state, loading, retry and empty states passed`);
  if (runAxe) console.log(`${engine} axe WCAG 2/2.1 AA scans passed for results and reader`);
  await context.close();
}

async function measureBaseline(browser, storageState) {
  const context = await browser.newContext({
    storageState: {
      cookies: [],
      origins: storageState.origins.map(entry => ({ ...entry, origin: baselineOrigin })),
    },
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  });
  await context.addInitScript(() => {
    const fetch = window.fetch;
    window.fetch = (url, options) => {
      if (!String(url).includes('/api/v1/legal-intelligence/')) return fetch(url, options);
      const data = String(url).includes('/filters') ? { courts: [], categories: [] } : {
        items: [{ id: 'baseline', title: 'Sample bail update 1', source: 'Sample court feed' }], has_more: false,
      };
      return Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
    };
  });
  const page = await context.newPage();
  await page.goto(`${baselineOrigin}${legalPath}`);
  await card(page).waitFor();
  const { firstCardTop } = await layoutCounts(page);
  await context.close();
  return firstCardTop;
}

async function main() {
  for (const engine of (process.env.LAWPRO_BROWSERS ?? 'chromium,webkit').split(',')) {
    assert.ok(['chromium', 'webkit'].includes(engine));
    const browser = engine === 'chromium'
      ? await chromium.launch({ channel: process.env.LAWPRO_CHROMIUM_CHANNEL })
      : await webkit.launch();
    try {
      const storageState = await signIn(browser, engine);
      for (const [width, height] of widths) await checkWidth(browser, storageState, width, height, engine);
      await checkInteractions(browser, storageState, engine, engine === 'chromium');
      if (baselineOrigin) console.log(`${engine} V3.1.1 first card at 390×844: ${await measureBaseline(browser, storageState)}px`);
    } finally {
      await browser.close();
    }
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
