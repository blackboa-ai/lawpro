// Run with: node frontend/tests/legal-intelligence.cjs
// Component state tests with a mocked Next.js router, effects and HTTP boundary.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    AbortController, URL, URLSearchParams, exports,
    require: name => dependencies[name] ?? require(name),
  });
  return exports;
}

function view(Component, hooks) {
  hooks.index = 0;
  const elements = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'function') return visit(node.type(node.props));
    elements.push(node);
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
  court_name: 'Supreme Court of India',
  judgment_date: index === 10 ? '2026-11-18' : '2026-11-17',
  subject_category: 'Criminal',
  source: 'Sample legal publisher',
  excerpt: 'Fixture excerpt',
  url: index === 1 ? 'javascript:alert(1)' : 'https://example.org/',
}));

async function main() {
  const calls = [];
  let failSearch = true;
  let authenticated = false;
  let redirect;
  const router = { replace: pathname => { redirect = pathname; } };
  const auth = { useAuth: () => ({ isAuthenticated: authenticated, loading: false }) };
  const hooks = hooksForTest();
  const legal = load('lib/legalIntelligence.ts', {
    '@/lib/api': {
      apiRequest: async (endpoint, options) => {
        calls.push({ endpoint, ...options });
        const url = new URL(endpoint, 'https://lawpro.example');
        if (url.pathname.endsWith('/filters')) {
          return { courts: [{ code: 'sc', name: 'Supreme Court of India' }], categories: [{ name: 'Criminal' }] };
        }
        const detail = fixture.find(item => url.pathname.endsWith(`/${item.id}`));
        if (detail) return { ...detail, full_text: 'Fixture reader text' };
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
  });
  const { default: Navigation } = load('app/AccountNavigation.tsx', {
    'next/link': { default: 'a' },
    'next/navigation': { usePathname: () => '/legal-intelligence' },
    '@/context/AuthContext': auth,
  });
  const render = () => view(Page, hooks);
  const textOf = node => node?.props.children;
  const form = nodes => nodes.find(node => node.type === 'form');
  const button = (nodes, label) => nodes.find(node => node.type === 'button' && textOf(node) === label);
  const hasText = (nodes, text) => nodes.some(node => typeof textOf(node) === 'string' && textOf(node).includes(text));
  const tick = async () => { hooks.flush(); await new Promise(resolve => setImmediate(resolve)); };
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
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, fixture[0].title));
  assert.equal(nodes.filter(node => node.type === 'article').length, 10);
  assert.equal(nodes.filter(node => node.type === 'a').length, 9);
  const sourceLink = nodes.find(node => node.type === 'a');
  assert.equal(sourceLink.props.href, 'https://example.org/');
  assert.equal(sourceLink.props.rel, 'noopener noreferrer');
  assert.ok(sourceLink.props.className.includes('z-10'));
  assert.equal(sourceLink.props.onClick, undefined);
  const detailButton = nodes.find(node => node.props['aria-label'] === `Read details for ${fixture[0].title}`);
  assert.equal(detailButton.type, 'button');
  assert.equal(detailButton.props['aria-haspopup'], 'dialog');
  assert.ok(detailButton.props.className.includes('after:inset-0'));
  assert.ok(detailButton.props.className.includes('focus-visible:after:outline'));
  assert.equal(legal.originalSourceUrl('https://user:password@example.org'), null);
  assert.equal(legal.originalSourceUrl('https://example.org/work\\file'), null);
  const chip = (nodes, label) => nodes.find(node => node.type === 'select' && node.props['aria-label'] === label);
  for (const label of ['Court', 'Category']) {
    assert.ok(chip(nodes, label).props.className.includes('appearance-none'));
    assert.ok(chip(nodes, label).props.className.includes('min-h-11'));
  }
  chip(nodes, 'Court').props.onChange({ target: { value: 'sc' } });
  chip(render(), 'Category').props.onChange({ target: { value: 'Criminal' } });
  editQuery(render(), '  bail  ');
  nodes = render();
  assert.equal(nodes.filter(node => node.type === 'input' && node.props.type === 'date').length, 0);
  submit(nodes);
  assert.ok(hasText(render(), 'Loading legal updates'));
  assert.equal(render().filter(node => node.type === 'article').length, 10);
  assert.equal(button(render(), 'Search').props.disabled, true);
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
  nodes.find(node => node.props['aria-label'] === `Read details for ${fixture[10].title}`).props.onClick();
  nodes = render();
  assert.ok(hasText(nodes, 'Back to Results'));
  await tick();
  nodes = render();
  nodes.find(node => node.type === 'dialog').props.onClose();
  nodes = render();
  assert.ok(nodes.some(node => Array.isArray(textOf(node)) && textOf(node).join('') === 'Page 2'));
  assert.ok(hasText(nodes, fixture[10].title));
  assert.equal(chip(nodes, 'Court').props.value, 'sc');
  assert.equal(chip(nodes, 'Category').props.value, 'Criminal');
  assert.equal(calls.length, pageTwoCalls + 1);
  const sort = chip(nodes, 'Sort loaded search results');
  sort.props.onChange({ target: { value: 'newest' } });
  nodes = render();
  assert.equal(nodes.find(node => node.type === 'h3').props.children, fixture[10].title);
  assert.equal(calls.length, pageTwoCalls + 1);
  chip(nodes, 'Sort loaded search results').props.onChange({ target: { value: 'relevance' } });
  nodes = render();
  nodes.find(node => node.props['aria-label'] === `Read details for ${fixture[0].title}`).props.onClick();
  assert.ok(hasText(render(), 'Loading details'));
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, 'Fixture reader text'));
  nodes.find(node => node.type === 'dialog').props.onClose();

  editQuery(render(), 'zero results');
  submit(render());
  render();
  await tick();
  nodes = render();
  assert.ok(hasText(nodes, 'No legal updates found'));
  assert.ok(search.signal.aborted);
  assert.equal(button(nodes, 'Reset'), undefined);
  nodes.find(node => node.props['aria-label'] === 'Clear search').props.onClick();
  nodes = render();
  assert.equal(nodes.filter(node => node.type === 'input' && node.props.type === 'date').length, 2);
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

  const [dateFrom, dateTo] = nodes.filter(node => node.type === 'input' && node.props.type === 'date');
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
