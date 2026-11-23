// Headless-Chrome smoke test for Restaurant Review BD.
// Drives the Playwright-cached headless_shell over CDP with Node's built-in
// WebSocket (no npm deps). Run from the project root:
//   node tests/smoke.mjs [1280|390]
// Exits 0 only if every check passes. Uses ?asof=2026-11-23 for
// deterministic "today". Starts from a cleared localStorage.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9232;
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = WIDTH <= 480 ? 844 : 800;
const URL = 'file://' + path.join(ROOT, 'index.html') + '?asof=2026-11-23';
const TAKA_SIGN = String.fromCharCode(0x09F3);

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' :: ' + extra : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000, label = 'condition') {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await fn()) return true; } catch { /* retry */ }
    await sleep(150);
  }
  throw new Error('timeout waiting for ' + label);
}

const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=' + PORT,
  '--window-size=' + WIDTH + ',' + HEIGHT,
  'about:blank',
], { stdio: 'ignore' });

let ws;
try {
  let targets = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      targets = await res.json();
      break;
    } catch { await sleep(250); }
  }
  if (!targets) throw new Error('DevTools endpoint never came up');

  const pageTarget = targets.find((t) => t.type === 'page');
  ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  const failedReqs = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Network.loadingFailed') {
      failedReqs.push(msg.params.errorText);
    }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error('page JS error: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };
  const setVal = async (elId, value) => {
    await evalJs(`document.getElementById(${JSON.stringify(elId)}).value = ${JSON.stringify(value)}`);
    await evalJs(`document.getElementById(${JSON.stringify(elId)}).dispatchEvent(new Event("input", { bubbles: true }))`);
    await evalJs(`document.getElementById(${JSON.stringify(elId)}).dispatchEvent(new Event("change", { bubbles: true }))`);
  };
  const click = async (expr) => { await evalJs(expr + '.click()'); };
  const text = async (elId) => evalJs(`document.getElementById(${JSON.stringify(elId)}).textContent`);
  const showTab = async (tab) => {
    await evalJs(`document.querySelector('[data-tab="${tab}"]').click()`);
    await sleep(200);
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 480 });
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'page load');
  await sleep(500);
  await evalJs('localStorage.clear()');
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'reload');
  await sleep(500);
  await evalJs('window.confirm = () => true');
  // Prevent the export download from firing in headless Chrome; the
  // on-screen JSON output is what the round-trip test reads.
  await evalJs('HTMLAnchorElement.prototype.click = function(){}');

  console.log(`smoke @ ${WIDTH}x${HEIGHT}: ${URL}`);
  check('page title', (await evalJs('document.title')) === 'Restaurant Review BD');
  check('app heading rendered', (await evalJs('document.querySelector("h1").textContent')) === 'Restaurant Review BD');
  check('dashboard starts empty: restaurants 0', (await text('statRestaurants')) === '0');
  check('dashboard starts empty: visits 0', (await text('statVisits')) === '0');
  check('dashboard starts empty: spend 0', (await text('statSpend')) === TAKA_SIGN + '0');
  check('dashboard starts empty: avg dash', (await text('statAvg')) === '\u2014');
  check('no console errors on load', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests on load', failedReqs.length === 0, failedReqs.join(' | '));

  // --- Add a restaurant via the UI ---
  await showTab('add');
  await setVal('fName', 'Test Biryani House');
  await setVal('fArea', 'Dhanmondi');
  await evalJs('document.getElementById("fCuisine").value = "Bangladeshi"');
  await evalJs('document.getElementById("fPrice").value = "2"');
  await setVal('fPhone', '01712345678');
  await click('document.querySelector("#restForm button[type=submit]")');
  await sleep(300);
  await showTab('restaurants');
  check('1 restaurant card after add',
    (await evalJs('document.querySelectorAll("#restaurantList .card").length')) === 1);
  check('card shows name', (await evalJs('document.querySelector("#restaurantList .card h3").textContent')).includes('Test Biryani House'));
  check('card shows area + cuisine', (await evalJs('document.querySelector("#restaurantList .card .meta").textContent')).includes('Dhanmondi'));

  // --- Validation: empty name is rejected ---
  await showTab('add');
  await setVal('fName', '');
  await setVal('fArea', 'Mirpur');
  await click('document.querySelector("#restForm button[type=submit]")');
  await sleep(300);
  check('empty name shows error', (await evalJs('document.getElementById("restFormError").style.display')) !== 'none');
  await click('document.getElementById("restFormCancel")');
  await sleep(200);

  // --- Add visit 1: (5,4,4) = 4.3, spend 850 ---
  await showTab('restaurants');
  await click('document.querySelector("#restaurantList [data-action=add-visit]")');
  await sleep(300);
  await setVal('vDate', '2026-11-20');
  await evalJs('document.getElementById("vFood").value = "5"');
  await evalJs('document.getElementById("vService").value = "4"');
  await evalJs('document.getElementById("vAmbience").value = "4"');
  await setVal('vDishes', 'kachchi biryani, borhani');
  await setVal('vSpend', '850');
  await click('document.querySelector("#visitForm button[type=submit]")');
  await sleep(300);
  await showTab('dashboard');
  check('dashboard restaurants = 1', (await text('statRestaurants')) === '1');
  check('dashboard visits = 1', (await text('statVisits')) === '1');
  check('dashboard spend = 850', (await text('statSpend')) === TAKA_SIGN + '850');
  check('dashboard avg = 4.3', (await text('statAvg')) === '4.3');
  check('top rated empty until 2 visits',
    (await evalJs('document.getElementById("topRatedBox").textContent')).includes('2'));

  // --- Validation: future visit date rejected ---
  await showTab('restaurants');
  await click('document.querySelector("#restaurantList [data-action=add-visit]")');
  await sleep(300);
  await setVal('vDate', '2026-11-24');
  await click('document.querySelector("#visitForm button[type=submit]")');
  await sleep(300);
  check('future date shows error', (await evalJs('document.getElementById("visitFormError").style.display')) !== 'none');
  await click('document.getElementById("visitFormCancel")');
  await sleep(200);

  // --- Add visit 2: (5,5,4) = 4.7, spend 920; totals 1770, avg 4.5 ---
  await showTab('restaurants');
  await click('document.querySelector("#restaurantList [data-action=add-visit]")');
  await sleep(300);
  await setVal('vDate', '2026-11-18');
  await evalJs('document.getElementById("vFood").value = "5"');
  await evalJs('document.getElementById("vService").value = "5"');
  await evalJs('document.getElementById("vAmbience").value = "4"');
  await setVal('vDishes', 'kachchi biryani');
  await setVal('vSpend', '920');
  await click('document.querySelector("#visitForm button[type=submit]")');
  await sleep(300);
  await showTab('dashboard');
  check('dashboard visits = 2', (await text('statVisits')) === '2');
  check('dashboard spend = 1,770', (await text('statSpend')) === TAKA_SIGN + '1,770');
  check('dashboard avg = 4.5', (await text('statAvg')) === '4.5');
  check('top rated is Test Biryani House',
    (await evalJs('document.getElementById("topRatedBox").textContent')).includes('Test Biryani House'));
  check('recent visits list has 2 entries',
    (await evalJs('document.querySelectorAll("#recentVisits li").length')) === 2);

  // --- Card shows best dish + last visit ---
  await showTab('restaurants');
  check('best dish is kachchi biryani',
    (await evalJs('document.querySelector("#restaurantList .card").textContent')).includes('kachchi biryani'));
  check('last visit 2026-11-20 shown',
    (await evalJs('document.querySelector("#restaurantList .card").textContent')).includes('2026-11-20'));

  // --- Search / filter / sort ---
  await setVal('searchInput', 'borhani');
  await sleep(300);
  check('search borhani finds 1 card',
    (await evalJs('document.querySelectorAll("#restaurantList .card").length')) === 1);
  await setVal('searchInput', 'pizza');
  await sleep(300);
  check('search pizza finds 0 cards',
    (await evalJs('document.querySelectorAll("#restaurantList .card").length')) === 0);
  await setVal('searchInput', '');
  await sleep(300);

  // --- Second restaurant (1 visit, spend 100) for sort + delete ---
  await showTab('add');
  await setVal('fName', 'Zebra Cafe');
  await setVal('fArea', 'Uttara');
  await evalJs('document.getElementById("fCuisine").value = "Cafe"');
  await evalJs('document.getElementById("fPrice").value = "2"');
  await click('document.querySelector("#restForm button[type=submit]")');
  await sleep(300);
  await showTab('restaurants');
  await evalJs(`[...document.querySelectorAll("#restaurantList .card")].find(c => c.textContent.includes("Zebra Cafe")).querySelector("[data-action=add-visit]").click()`);
  await sleep(300);
  await setVal('vDate', '2026-11-21');
  await setVal('vDishes', 'cold coffee');
  await setVal('vSpend', '100');
  await click('document.querySelector("#visitForm button[type=submit]")');
  await sleep(300);
  await showTab('dashboard');
  check('dashboard restaurants = 2', (await text('statRestaurants')) === '2');
  check('dashboard visits = 3', (await text('statVisits')) === '3');
  check('dashboard spend = 1,870', (await text('statSpend')) === TAKA_SIGN + '1,870');
  await showTab('restaurants');
  await evalJs('document.getElementById("sortSelect").value = "spend"');
  await evalJs('document.getElementById("sortSelect").dispatchEvent(new Event("change", { bubbles: true }))');
  await sleep(300);
  check('sort by spend desc puts Test Biryani first',
    (await evalJs('document.querySelector("#restaurantList .card h3").textContent')).includes('Test Biryani House'));
  await evalJs('document.getElementById("sortSelect").value = "name"');
  await evalJs('document.getElementById("sortSelect").dispatchEvent(new Event("change", { bubbles: true }))');
  await sleep(300);
  check('sort by name puts Test Biryani first (T < Z)',
    (await evalJs('document.querySelector("#restaurantList .card h3").textContent')).includes('Test Biryani House'));

  // --- Delete the second restaurant ---
  await evalJs(`[...document.querySelectorAll("#restaurantList .card")].find(c => c.textContent.includes("Zebra Cafe")).querySelector("[data-action=del-rest]").click()`);
  await sleep(300);
  check('delete removes Zebra Cafe',
    (await evalJs('document.querySelectorAll("#restaurantList .card").length')) === 1);
  await showTab('dashboard');
  check('dashboard back to 1 restaurant', (await text('statRestaurants')) === '1');
  check('dashboard spend back to 1,770', (await text('statSpend')) === TAKA_SIGN + '1,770');

  // --- Demo data: load (6 restaurants, 9 visits, spend 9,890) ---
  await showTab('data');
  await click('document.getElementById("demoLoadBtn")');
  await sleep(300);
  await showTab('dashboard');
  check('demo load: restaurants = 7', (await text('statRestaurants')) === '7');
  check('demo load: visits = 11', (await text('statVisits')) === '11');
  check('demo load: spend = 11,660', (await text('statSpend')) === TAKA_SIGN + '11,660');
  await showTab('restaurants');
  check('demo badges shown on 6 cards',
    (await evalJs('document.querySelectorAll("#restaurantList .badge").length')) === 6);
  check('demo restaurant Kacchi Bhai listed',
    (await evalJs('document.querySelector("#restaurantList").textContent')).includes('Kacchi Bhai'));
  await showTab('data');
  await click('document.getElementById("demoClearBtn")');
  await sleep(300);
  await showTab('dashboard');
  check('demo clear: restaurants = 1', (await text('statRestaurants')) === '1');
  check('demo clear: visits = 2', (await text('statVisits')) === '2');
  check('demo clear: spend = 1,770', (await text('statSpend')) === TAKA_SIGN + '1,770');

  // --- Export -> erase -> import round-trip ---
  await showTab('data');
  await click('document.getElementById("exportBtn")');
  await sleep(300);
  const exported = await evalJs('document.getElementById("exportOutput").textContent');
  check('export output is JSON with our restaurant', exported.includes('Test Biryani House'));
  check('export output has app + version',
    exported.includes('"app": "restaurant-review-bd"') && exported.includes('"version": 1'));
  await setVal('eraseInput', 'DELETE');
  await click('document.getElementById("eraseBtn")');
  await sleep(300);
  await showTab('dashboard');
  check('erase empties restaurants', (await text('statRestaurants')) === '0');
  check('erase empties visits', (await text('statVisits')) === '0');
  await showTab('data');
  await setVal('importText', exported);
  await click('document.getElementById("importBtn")');
  await sleep(300);
  await showTab('dashboard');
  check('import restores 1 restaurant', (await text('statRestaurants')) === '1');
  check('import restores 2 visits', (await text('statVisits')) === '2');
  check('import restores spend 1,770', (await text('statSpend')) === TAKA_SIGN + '1,770');

  // --- Invalid import is rejected, data intact ---
  await showTab('data');
  await setVal('importText', '{"app":"wrong-app","version":1,"restaurants":[],"visits":[]}');
  await click('document.getElementById("importBtn")');
  await sleep(300);
  check('bad import shows error', (await evalJs('document.getElementById("importError").style.display')) !== 'none');
  await showTab('dashboard');
  check('bad import leaves data intact', (await text('statRestaurants')) === '1');

  // --- Bengali toggle: digits + persistence across reload ---
  await evalJs('document.getElementById("langToggle").click()');
  await sleep(300);
  check('BN heading after toggle',
    (await evalJs('document.querySelector("h1").textContent')) === '\u09B0\u09C7\u09B8\u09CD\u099F\u09C1\u09B0\u09C7\u09A8\u09CD\u099F \u09B0\u09BF\u09AD\u09BF\u0989 \u09AC\u09BF\u09A1\u09BF');
  check('BN visits use Bengali digits', (await text('statVisits')) === '\u09E8');
  await send('Page.navigate', { url: URL });
  await waitFor(async () => (await evalJs('document.readyState')) === 'complete', 15000, 'reload');
  await sleep(500);
  check('BN persists across reload', (await text('statVisits')) === '\u09E8');
  check('BN heading persists', (await evalJs('document.querySelector("h1").textContent')).length > 5);
  await evalJs('document.getElementById("langToggle").click()');
  await sleep(300);
  check('back to EN heading', (await evalJs('document.querySelector("h1").textContent')) === 'Restaurant Review BD');
  check('EN visits back to ASCII digits', (await text('statVisits')) === '2');

  // --- No horizontal overflow at this viewport ---
  const overflow = await evalJs('document.documentElement.scrollWidth - document.documentElement.clientWidth');
  check('no horizontal overflow', overflow === 0, 'overflow=' + overflow);
  check('no console errors at end', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('no failed requests at end', failedReqs.length === 0, failedReqs.join(' | '));

  console.log(`smoke @ ${WIDTH}: ${pass} passed, ${fail} failed`);
} catch (err) {
  console.error('SMOKE ERROR: ' + (err && err.message ? err.message : err));
  fail++;
} finally {
  try { if (ws) ws.close(); } catch {}
  chrome.kill();
}
process.exit(fail ? 1 : 0);
