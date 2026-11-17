// Run with: node frontend/tests/legal-intelligence.cjs
// Component state tests with a mocked Next.js router, effects and HTTP boundary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies, browser = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    AbortController, URL, URLSearchParams, exports, ...browser,
    require: name => dependencies[name] ?? require(name),
  });
  return exports;
}

function view(Component, hooks, attachRef = () => {}) {
  hooks.index = 0;
  const elements = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'function') return visit(node.type(node.props));
    elements.push(node);
    attachRef(node);
    visit(node.props.children);
  }
  visit(Component());
  return elements;
}

function hooksForTest() {
  const state = [];
  const effects = [];
  const pending = [];
  return {
    index: 0,
    useState(initial) {
      const index = this.index++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => {
        state[index] = typeof value === 'function' ? value(state[index]) : value;
      }];
    },
    useRef(initial) {
      const index = this.index++;
      return state[index] ??= { current: initial };
    },
    useEffect(run, deps) {
      const index = this.index++;
      const previous = effects[index];
      if (previous && deps.every((value, i) => value === previous.deps[i])) return;
      pending.push(() => {
        previous?.cleanup?.();
        effects[index] = { deps, cleanup: run() };
      });
    },
    flush() {
      pending.splice(0).forEach(run => run());
    },
  };
}

const fixture = Array.from({ length: 11 }, (_, index) => ({
  id: `item-${index}`,
  title: `Sample bail update ${index + 1}`,
  court_name: index === 1 ? null : 'Supreme Court of India',
  judgment_date: index === 1 ? null : index === 10 ? '2026-11-18' : '2026-11-17',
  subject_category: index === 1 ? null : 'Criminal',
  source: index === 1 ? null : 'Sample legal publisher',
  excerpt: 'Fixture excerpt',
  url: index === 1 ? 'javascript:alert(1)' : 'https://example.org/',
}));

async function main() {
  const calls = [];
  let failSearch = true;
  let failDetail = true;
  let authenticated = false;
  let redirect;
  const router = { replace: pathname => { redirect = pathname; } };
  const auth = { useAuth: () => ({ isAuthenticated: authenticated, loading: false }) };
  const hooks = hooksForTest();
  const scrollRestores = [];
  const document = { documentElement: { clientWidth: 375 }, body: { style: { position: '' } } };
  const window = {
    innerWidth: 390, scrollX: 0, scrollY: 450,
    getComputedStyle: () => ({ paddingInlineEnd: '0px' }),
    scrollTo: options => scrollRestores.push(options),
  };
  function focusable() {
    return {
      hasAutofocus: false,
      setAttribute(name) { assert.equal(name, 'autofocus'); this.hasAutofocus = true; },
      removeAttribute() { this.hasAutofocus = false; },
      focus(options) { document.activeElement = this; this.focusOptions = options; },
    };
  }
  const title = focusable();
  const back = focusable();
  const trigger = focusable();
  const dialog = {
    open: false,
    showModal() {
      this.open = true;
      const target = [title, back].find(node => node.hasAutofocus);
      assert.ok(target);
      target.focus();
    },
  };
  function attachReaderRef(node) {
    const element = node.type === 'dialog' ? dialog : node.props.id === 'reader-title' ? title
      : node.props.className === 'back' ? back : null;
    if (element) node.ref.current = element;
  }
  const legal = load('lib/legalIntelligence.ts', {
    '@/lib/api': {
      apiRequest: async (endpoint, options) => {
        calls.push({ endpoint, ...options });
        const url = new URL(endpoint, 'https://lawpro.example');
        if (url.pathname.endsWith('/filters')) {
          return { courts: [{ code: 'sc', name: 'Supreme Court of India' }], categories: [{ name: 'Criminal' }] };
        }
        const detail = fixture.find(item => url.pathname.endsWith(`/${item.id}`));
        if (detail) {
          if (detail.id === 'item-10' && failDetail) {
            failDetail = false;
            throw new Error('Simulated detail error');
          }
          return { ...detail, full_text: 'Fixture reader text\r\n  1. First order\r\n \r\n\r\n  2. Second order\nSigned.' };
        }
        const q = url.searchParams.get('q');
        if (q === 'zero results') return { items: [], has_more: false };
        if (q && failSearch) {
          failSearch = false;
          throw new Error('Simulated upstream error');
        }
        return { items: q ? fixture : fixture.slice(0, 10), has_more: !q };
      },
    },
  });
  const { default: Page } = load('app/legal-intelligence/page.tsx', {
    react: {
      useState: hooks.useState.bind(hooks),
      useEffect: hooks.useEffect.bind(hooks),
      useRef: hooks.useRef.bind(hooks),
    },
    'next/navigation': { useRouter: () => router },
    '@/context/AuthContext': auth,
    '@/lib/legalIntelligence': legal,
    './legal-intelligence.module.css': { default: new Proxy({}, { get: (_target, key) => key }) },
  }, { window, document });
  const { default: Navigation } = load('app/AccountNavigation.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => '/legal-intelligence' },
    '@/context/AuthContext': auth,
  });
  const render = () => view(Page, hooks, attachReaderRef);
  const textOf = node => node?.props.children;
  const form = nodes => nodes.find(node => node.type === 'form');
  const button = (nodes, label) => nodes.find(node => node.type === 'button' && textOf(node) === label);
  const hasText = (nodes, text) => nodes.some(node => typeof textOf(node) === 'string' && textOf(node).includes(text));
  const tick = async () => { hooks.flush(); await new Promise(resolve => setImmediate(resolve)); };
  const control = (nodes, label) => nodes.find(node => node.props['aria-label'] === label);
  const toggleFilters = nodes => nodes.find(node => node.props['aria-controls'] === 'legal-filter-panel');
  const dateInputs = nodes => nodes.filter(node => node.type === 'input' && node.props.type === 'date');
  const closeReader = nodes => {
    dialog.open = false;
    nodes.find(node => node.type === 'dialog').props.onClose();
    assert.equal(document.activeElement, trigger);
    assert.equal(trigger.focusOptions.preventScroll, true);
    assert.equal(window.scrollY, scrollRestores.at(-1).top);
    assert.equal(document.body.style.position, '');
  };
  const editQuery = (nodes, value) =>
    nodes.find(node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value } });
  const submit = nodes => form(nodes).props.onSubmit({ preventDefault() {} });

  assert.deepEqual(view(Navigation, hooks), []);
  assert.deepEqual(render(), []);
  await tick();
  assert.equal(redirect, '/login');
  assert.equal(calls.length, 0);

  authenticated = true;
  const nav = view(Navigation, hooks);
  assert.equal(nav.find(node => node.props.href === '/dashboard').props.children, 'Dashboard');
  assert.equal(nav.find(node => node.props.href === '/legal-intelligence').props['aria-current'], 'page');

  let nodes = render();
  assert.ok(hasText(nodes, 'Loading legal updates'));
  assert.equal(nodes.filter(node => node.props.className?.includes('motion-safe:animate-pulse')).length, 3);
  assert.equal(toggleFilters(nodes).props['aria-expanded'], false);
  assert.equal(dateInputs(nodes).length, 0);
  assert.equal(control(nodes, 'Search legal updates').props.enterKeyHint, 'search');
  assert.equal(control(nodes, 'Search legal updates').props['aria-describedby'], 'public-search-note');
  assert.equal(control(nodes, 'Search privacy information').type, 'summary');
  assert.equal(nodes.find(node => node.props.className === 'searchBar').props.children.at(-1).props.type, 'submit');
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, fixture[0].title));
  assert.equal(nodes.filter(node => node.type === 'article').length, 10);
  assert.equal(nodes.filter(node => node.type === 'a').length, 9);
  assert.equal(nodes.filter(node => node.type === 'ul' && node.props['aria-label'] === 'Document metadata').length, 9);
  const sourceLink = nodes.find(node => node.type === 'a');
  assert.equal(sourceLink.props.href, 'https://example.org/');
  assert.equal(sourceLink.props.rel, 'noopener noreferrer');
  assert.equal(sourceLink.props.className, 'cardSource');
  assert.equal(sourceLink.props.onClick, undefined);
  const detailButton = nodes.find(node => node.props['aria-label'] === `Read details for ${fixture[0].title}`);
  assert.equal(detailButton.type, 'button');
  assert.equal(detailButton.props['aria-haspopup'], 'dialog');
  assert.equal(detailButton.props.className, 'cardAction');
  assert.equal(legal.originalSourceUrl('https://user:password@example.org'), null);
  assert.equal(legal.originalSourceUrl('https://example.org/work\\file'), null);
  const chip = (nodes, label) => nodes.find(node => node.type === 'select' && node.props['aria-label'] === label);
  for (const label of ['Court', 'Category']) {
    const wrapper = nodes.find(node => node.type === 'label' && node.props.children[1].props['aria-label'] === label);
    assert.equal(wrapper.props.className, 'chip selectChip');
    assert.equal(wrapper.props.children[0].props.className, 'truncate');
    assert.equal(wrapper.props['data-selected'], false);
    assert.equal(chip(nodes, label).props.disabled, false);
  }
  const css = fs.readFileSync(path.join(__dirname, '../app/legal-intelligence/legal-intelligence.module.css'), 'utf8');
  assert.match(css, /\.selectChip select\s*\{[^}]*appearance: none;[^}]*opacity: 0;/);
  assert.match(css, /\.cardAction::after\s*\{[^}]*inset: 0;/);
  assert.match(css, /\.cardSource\s*\{[^}]*z-index: 1;/);
  assert.match(css, /\.reader\s*\{[^}]*100dvh[^}]*safe-area-inset-top/);
  assert.match(css, /\.readerScroll\s*\{[^}]*overflow-y: auto;[^}]*overscroll-behavior: contain;/);
  assert.match(css, /\.hub :where\([^)]+\):focus-visible\s*\{[^}]*outline: 2px solid/);
  chip(nodes, 'Court').props.onChange({ target: { value: 'sc' } });
  chip(render(), 'Category').props.onChange({ target: { value: 'Criminal' } });
  editQuery(render(), '  bail  ');
  nodes = render();
  assert.equal(nodes.filter(node => node.type === 'input' && node.props.type === 'date').length, 0);
  submit(nodes);
  assert.ok(hasText(render(), 'Loading legal updates'));
  assert.equal(render().filter(node => node.type === 'article').length, 10);
  assert.equal(control(render(), 'Search').props.disabled, true);
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, 'The source may be warming up.'));
  button(nodes, 'Retry').props.onClick();
  render();
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, fixture[0].title));
  const search = calls.at(-1);
  assert.equal(new URLSearchParams(search.endpoint.split('?')[1]).toString(), 'limit=25&offset=0&court=sc&category=Criminal&q=bail');
  assert.equal(search.cache, 'no-store');

  const requestsBeforePaging = calls.length;
  button(nodes, 'Next').props.onClick();
  nodes = render();
  await tick();
  assert.ok(hasText(nodes, fixture[10].title));
  assert.equal(button(nodes, 'Next').props.disabled, true);
  assert.equal(calls.length, requestsBeforePaging);
  const pageTwoCalls = calls.length;
  control(nodes, `Read details for ${fixture[10].title}`).props.onClick({ detail: 1, currentTarget: trigger });
  nodes = render();
  assert.equal(nodes.find(node => node.props.className === 'back').props.children.at(-1).trim(), 'Back to Results');
  await tick();
  assert.equal(document.activeElement, title);
  assert.equal(document.body.style.position, 'fixed');
  nodes = render();
  assert.ok(hasText(nodes, 'Details are unavailable.'));
  button(nodes, 'Retry').props.onClick();
  render();
  await tick();
  nodes = render();
  const text = nodes.filter(node => node.type === 'p').map(textOf);
  assert.ok(text.includes('Fixture reader text\n  1. First order'));
  assert.ok(text.includes('  2. Second order\nSigned.'));
  closeReader(nodes);
  nodes = render();
  assert.ok(nodes.some(node => Array.isArray(textOf(node)) && textOf(node).join('') === 'Page 2'));
  assert.ok(hasText(nodes, fixture[10].title));
  assert.equal(control(nodes, 'Search legal updates').props.value, '  bail  ');
  assert.equal(chip(nodes, 'Court').props.value, 'sc');
  assert.equal(chip(nodes, 'Category').props.value, 'Criminal');
  assert.equal(calls.length, pageTwoCalls + 2);
  const sort = chip(nodes, 'Sort loaded search results');
  sort.props.onChange({ target: { value: 'newest' } });
  nodes = render();
  assert.equal(nodes.find(node => node.type === 'h3').props.children, fixture[10].title);
  assert.equal(calls.length, pageTwoCalls + 2);
  chip(nodes, 'Sort loaded search results').props.onChange({ target: { value: 'relevance' } });
  nodes = render();
  control(nodes, `Read details for ${fixture[0].title}`).props.onClick({ detail: 0, currentTarget: trigger });
  assert.ok(hasText(render(), 'Loading details'));
  await tick();
  nodes = render();
  assert.equal(document.activeElement, back);
  assert.ok(hasText(nodes, 'Fixture reader text'));
  closeReader(nodes);

  editQuery(render(), 'zero results');
  submit(render());
  render();
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, 'No legal updates found'));
  assert.ok(search.signal.aborted);
  assert.equal(button(nodes, 'Reset'), undefined);
  control(nodes, 'Clear search').props.onClick();
  nodes = render();
  assert.equal(dateInputs(nodes).length, 0);
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, fixture[0].title));
  assert.equal(chip(nodes, 'Court').props.value, 'sc');
  button(nodes, 'Clear filters').props.onClick();
  render();
  await tick();
  nodes = render();
  assert.equal(chip(nodes, 'Court').props.value, '');
  assert.equal(button(nodes, 'Clear filters'), undefined);

  toggleFilters(nodes).props.onClick();
  nodes = render();
  assert.equal(toggleFilters(nodes).props['aria-expanded'], true);
  const [dateFrom, dateTo] = dateInputs(nodes);
  dateFrom.props.onChange({ target: { value: '2026-11-15' } });
  dateTo.props.onChange({ target: { value: '2026-11-01' } });
  submit(render());
  assert.ok(hasText(render(), 'The end date must be on or after the start date.'));
  dateTo.props.onChange({ target: { value: '2026-11-17' } });
  button(render(), 'Apply dates').props.onClick();
  render();
  await tick();
  assert.ok(calls.at(-1).endpoint.includes('date_from=2026-11-15&date_to=2026-11-17'));
  button(render(), 'Next').props.onClick();
  render();
  await tick();
  assert.ok(calls.at(-1).endpoint.includes('offset=10'));
  console.log('Legal Intelligence checks passed: compact controls, search, filters, sorting, pagination, reader context, safe links, loading, retry, cancellation and empty states.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
