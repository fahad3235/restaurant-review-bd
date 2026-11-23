// Restaurant Review BD - Node unit tests (pure logic, no DOM).
// Run: node tests/unit.test.js   (exit 0 only if every check passes)
// All expected values below are hand-computed; see TEST_RESULTS.md.
'use strict';

// Minimal localStorage shim so i18n.js can persist the language in Node.
global.localStorage = (function () {
  var store = {};
  return {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
    removeItem: function (k) { delete store[k]; },
    clear: function () { store = {}; }
  };
})();

var L = require('../js/logic.js');
var I = require('../js/i18n.js');

var pass = 0, fail = 0;
var failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; }
  else {
    fail++;
    failures.push(name + (extra ? ' :: ' + extra : ''));
    console.log('  FAIL ' + name + (extra ? ' :: ' + extra : ''));
  }
}
function eq(name, actual, expected) {
  check(name, actual === expected, 'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected));
}
function deepEq(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected),
    'got ' + JSON.stringify(actual) + ', want ' + JSON.stringify(expected));
}

var ASOF = '2026-11-23';

// ---------- rating math ----------
eq('visitScore (5,4,4) = 4.3', L.visitScore({ food: 5, service: 4, ambience: 4 }), 4.3);
eq('visitScore (5,5,5) = 5', L.visitScore({ food: 5, service: 5, ambience: 5 }), 5);
eq('visitScore (1,2,2) = 1.7', L.visitScore({ food: 1, service: 2, ambience: 2 }), 1.7);
eq('visitScore (4,4,4) = 4', L.visitScore({ food: 4, service: 4, ambience: 4 }), 4);
eq('meanRating [4.3,4.7] = 4.5', L.meanRating([4.3, 4.7]), 4.5);
eq('meanRating [] = null', L.meanRating([]), null);
eq('meanRating [4.3,4.7,4.0] = 4.3', L.meanRating([4.3, 4.7, 4.0]), 4.3);

// ---------- dates ----------
eq('valid leap date 2024-02-29', L.isValidDateStr('2024-02-29'), true);
eq('invalid 2023-02-29', L.isValidDateStr('2023-02-29'), false);
eq('invalid 2026-02-30', L.isValidDateStr('2026-02-30'), false);
eq('invalid month 13', L.isValidDateStr('2026-13-01'), false);
eq('invalid unpadded 2026-1-5', L.isValidDateStr('2026-1-5'), false);
eq('future 2026-11-24 vs asof', L.isFutureDate('2026-11-24', ASOF), true);
eq('today is not future', L.isFutureDate('2026-11-23', ASOF), false);
eq('past is not future', L.isFutureDate('2026-11-22', ASOF), false);

// ---------- money (integer paisa) ----------
eq('formatTaka 125000 = 1,250', L.formatTaka(125000), '1,250');
eq('formatTaka 125050 = 1,250.50', L.formatTaka(125050), '1,250.50');
eq('formatTaka 0 = 0', L.formatTaka(0), '0');
eq('formatTaka 277000 = 2,770', L.formatTaka(277000), '2,770');
eq('parseSpendTaka "1,250" = 125000', L.parseSpendTaka('1,250'), 125000);
eq('parseSpendTaka Bengali digits = 125000', L.parseSpendTaka('\u09E7\u09E8\u09EB\u09E6'), 125000);
eq('parseSpendTaka "0" = 0', L.parseSpendTaka('0'), 0);
eq('parseSpendTaka "12.5" = null', L.parseSpendTaka('12.5'), null);
eq('parseSpendTaka "-5" = null', L.parseSpendTaka('-5'), null);
eq('parseSpendTaka "" = null', L.parseSpendTaka(''), null);
eq('parseSpendTaka "abc" = null', L.parseSpendTaka('abc'), null);

// ---------- dishes / best dish ----------
deepEq('splitDishes trims and drops empties',
  L.splitDishes('kachchi biryani, , borhani ,'), ['kachchi biryani', 'borhani']);
eq('bestDish most-mentioned wins', L.bestDish([
  { dishes: 'kachchi biryani, borhani' },
  { dishes: 'kachchi biryani, jali kabab' }
]), 'kachchi biryani');
eq('bestDish tie goes alphabetical', L.bestDish([
  { dishes: 'Borhani' }, { dishes: 'biryani' }
]), 'biryani');
eq('bestDish keeps first-seen spelling', L.bestDish([
  { dishes: 'Kachchi Biryani' }, { dishes: 'kachchi biryani' }
]), 'Kachchi Biryani');
eq('bestDish none = null', L.bestDish([{ dishes: '' }, { dishes: '  ' }]), null);

// ---------- fixture for stats / dashboard / browse ----------
var restA = { id: 'r-a', name: 'Kacchi Bhai', area: 'Dhanmondi', cuisine: 'Bangladeshi',
  price: 2, phone: '01712345678', notes: '', demo: false, createdAt: '2026-11-01' };
var restB = { id: 'r-b', name: 'China Garden', area: 'Gulshan', cuisine: 'Chinese',
  price: 3, phone: '', notes: '', demo: false, createdAt: '2026-11-02' };
var restC = { id: 'r-c', name: 'Thai Emerald', area: 'Banani', cuisine: 'Thai',
  price: 3, phone: '', notes: '', demo: false, createdAt: '2026-11-03' };
var visits = [
  { id: 'v-1', restaurantId: 'r-a', date: '2026-11-15', food: 5, service: 4, ambience: 4,
    dishes: 'kachchi biryani, borhani', spendPaisa: 85000, notes: '', demo: false },
  { id: 'v-2', restaurantId: 'r-a', date: '2026-11-08', food: 5, service: 5, ambience: 4,
    dishes: 'kachchi biryani, jali kabab', spendPaisa: 92000, notes: '', demo: false },
  { id: 'v-3', restaurantId: 'r-b', date: '2026-11-10', food: 4, service: 4, ambience: 4,
    dishes: 'fried rice', spendPaisa: 100000, notes: '', demo: false }
];
var restaurants = [restA, restB, restC];

var statsA = L.restaurantStats(restA, visits);
eq('statsA visitCount = 2', statsA.visitCount, 2);
eq('statsA totalSpendPaisa = 177000', statsA.totalSpendPaisa, 177000);
eq('statsA avgRating = 4.5', statsA.avgRating, 4.5);
eq('statsA lastVisitDate', statsA.lastVisitDate, '2026-11-15');
eq('statsA bestDish', statsA.bestDish, 'kachchi biryani');
var statsC = L.restaurantStats(restC, visits);
eq('statsC visitCount = 0', statsC.visitCount, 0);
eq('statsC avgRating = null', statsC.avgRating, null);
eq('statsC lastVisitDate = null', statsC.lastVisitDate, null);
eq('statsC bestDish = null', statsC.bestDish, null);

var d = L.dashboard(restaurants, visits);
eq('dashboard totalRestaurants = 3', d.totalRestaurants, 3);
eq('dashboard totalVisits = 3', d.totalVisits, 3);
eq('dashboard totalSpendPaisa = 277000', d.totalSpendPaisa, 277000);
eq('dashboard overallAvgRating = 4.3', d.overallAvgRating, 4.3);
eq('dashboard topRated is Kacchi Bhai', d.topRated.restaurant.name, 'Kacchi Bhai');
eq('dashboard topRated avg = 4.5', d.topRated.stats.avgRating, 4.5);
eq('dashboard mostVisited is Kacchi Bhai', d.mostVisited.restaurant.name, 'Kacchi Bhai');
eq('dashboard mostVisited count = 2', d.mostVisited.stats.visitCount, 2);
eq('dashboard Bangladeshi visits = 2', d.perCuisine.Bangladeshi.visits, 2);
eq('dashboard Bangladeshi avg = 4.5', d.perCuisine.Bangladeshi.avgRating, 4.5);
eq('dashboard Chinese visits = 1', d.perCuisine.Chinese.visits, 1);
eq('dashboard Chinese avg = 4.0', d.perCuisine.Chinese.avgRating, 4.0);
eq('dashboard Thai visits = 0', d.perCuisine.Thai.visits, 0);
eq('dashboard Thai avg = null', d.perCuisine.Thai.avgRating, null);
deepEq('dashboard recentVisits order',
  d.recentVisits.map(function (v) { return v.id; }), ['v-1', 'v-3', 'v-2']);
var dEmpty = L.dashboard([], []);
eq('dashboard empty totalRestaurants = 0', dEmpty.totalRestaurants, 0);
eq('dashboard empty overallAvg = null', dEmpty.overallAvgRating, null);
eq('dashboard empty topRated = null', dEmpty.topRated, null);
eq('dashboard empty mostVisited = null', dEmpty.mostVisited, null);

// top-rated tie-break: more visits wins at equal average
var restD = { id: 'r-d', name: 'Apex Biryani', area: 'Mirpur', cuisine: 'Bangladeshi',
  price: 2, phone: '', notes: '', demo: false, createdAt: '2026-11-01' };
var tieVisits = visits.concat([
  { id: 'v-4', restaurantId: 'r-d', date: '2026-11-20', food: 5, service: 4, ambience: 4,
    dishes: 'biryani', spendPaisa: 50000, notes: '', demo: false },
  { id: 'v-5', restaurantId: 'r-d', date: '2026-11-19', food: 5, service: 5, ambience: 4,
    dishes: 'biryani', spendPaisa: 50000, notes: '', demo: false },
  { id: 'v-6', restaurantId: 'r-d', date: '2026-11-18', food: 5, service: 4, ambience: 4,
    dishes: 'biryani', spendPaisa: 50000, notes: '', demo: false }
]);
// Apex avg = mean(4.3, 4.7, 4.3) = 4.433 -> 4.4, so Kacchi Bhai (4.5) still wins.
eq('topRated still Kacchi Bhai at 4.5 vs 4.4',
  L.dashboard([restA, restD], tieVisits).topRated.restaurant.name, 'Kacchi Bhai');
// Equal average + equal visits -> name A-Z wins
var restE = { id: 'r-e', name: 'A Biryani', area: 'Mirpur', cuisine: 'Bangladeshi',
  price: 2, phone: '', notes: '', demo: false, createdAt: '2026-11-01' };
var tie2 = [
  { id: 'v-1', restaurantId: 'r-a', date: '2026-11-15', food: 5, service: 4, ambience: 4,
    dishes: 'x', spendPaisa: 100, notes: '', demo: false },
  { id: 'v-2', restaurantId: 'r-a', date: '2026-11-08', food: 5, service: 5, ambience: 4,
    dishes: 'x', spendPaisa: 100, notes: '', demo: false },
  { id: 'v-7', restaurantId: 'r-e', date: '2026-11-15', food: 5, service: 4, ambience: 4,
    dishes: 'x', spendPaisa: 100, notes: '', demo: false },
  { id: 'v-8', restaurantId: 'r-e', date: '2026-11-08', food: 5, service: 5, ambience: 4,
    dishes: 'x', spendPaisa: 100, notes: '', demo: false }
];
eq('topRated name tie-break A Biryani wins',
  L.dashboard([restA, restE], tie2).topRated.restaurant.name, 'A Biryani');

// ---------- browse ----------
function names(rows) { return rows.map(function (r) { return r.restaurant.name; }); }
deepEq('browse search by dish borhani', names(L.browse(restaurants, visits, { q: 'borhani' })), ['Kacchi Bhai']);
deepEq('browse search by area gulshan', names(L.browse(restaurants, visits, { q: 'gulshan' })), ['China Garden']);
deepEq('browse search case-insensitive KACCHI', names(L.browse(restaurants, visits, { q: 'KACCHI' })), ['Kacchi Bhai']);
deepEq('browse cuisine filter Chinese', names(L.browse(restaurants, visits, { cuisine: 'Chinese' })), ['China Garden']);
deepEq('browse price filter 3', names(L.browse(restaurants, visits, { price: 3 })), ['China Garden', 'Thai Emerald']);
deepEq('browse minRating 4.5', names(L.browse(restaurants, visits, { minRating: 4.5 })), ['Kacchi Bhai']);
deepEq('browse minRating 4 excludes unvisited', names(L.browse(restaurants, visits, { minRating: 4 })), ['China Garden', 'Kacchi Bhai']);
deepEq('browse sort rating desc', names(L.browse(restaurants, visits, { sort: 'rating' })), ['Kacchi Bhai', 'China Garden', 'Thai Emerald']);
deepEq('browse sort visits desc', names(L.browse(restaurants, visits, { sort: 'visits' })), ['Kacchi Bhai', 'China Garden', 'Thai Emerald']);
deepEq('browse sort spend desc', names(L.browse(restaurants, visits, { sort: 'spend' })), ['Kacchi Bhai', 'China Garden', 'Thai Emerald']);
deepEq('browse sort newest', names(L.browse(restaurants, visits, { sort: 'newest' })), ['Thai Emerald', 'China Garden', 'Kacchi Bhai']);
deepEq('browse sort name', names(L.browse(restaurants, visits, { sort: 'name' })), ['China Garden', 'Kacchi Bhai', 'Thai Emerald']);
deepEq('browse no match', names(L.browse(restaurants, visits, { q: 'pizza' })), []);

// ---------- restaurant validation ----------
eq('validateRestaurant valid = []', L.validateRestaurant(restA, ASOF).length, 0);
check('validateRestaurant empty name', L.validateRestaurant({ name: ' ', area: 'X', cuisine: 'Thai', price: 1 }, ASOF).indexOf('errName') !== -1);
check('validateRestaurant 81-char name', L.validateRestaurant({ name: new Array(82).join('x'), area: 'X', cuisine: 'Thai', price: 1 }, ASOF).indexOf('errName') !== -1);
check('validateRestaurant 80-char name ok', L.validateRestaurant({ name: new Array(81).join('x'), area: 'X', cuisine: 'Thai', price: 1 }, ASOF).indexOf('errName') === -1);
check('validateRestaurant empty area', L.validateRestaurant({ name: 'N', area: '', cuisine: 'Thai', price: 1 }, ASOF).indexOf('errArea') !== -1);
check('validateRestaurant bad cuisine', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Mexican', price: 1 }, ASOF).indexOf('errCuisine') !== -1);
check('validateRestaurant price 5', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Thai', price: 5 }, ASOF).indexOf('errPrice') !== -1);
check('validateRestaurant bad phone 011...', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Thai', price: 1, phone: '01123456789' }, ASOF).indexOf('errPhone') !== -1);
check('validateRestaurant bad phone short', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Thai', price: 1, phone: '0171234' }, ASOF).indexOf('errPhone') !== -1);
check('validateRestaurant phone with spaces ok', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Thai', price: 1, phone: '0171 234 5678' }, ASOF).indexOf('errPhone') === -1);
check('validateRestaurant notes 201 chars', L.validateRestaurant({ name: 'N', area: 'X', cuisine: 'Thai', price: 1, notes: new Array(202).join('x') }, ASOF).indexOf('errNotes') !== -1);

// ---------- visit validation ----------
var goodVisit = { date: '2026-11-20', food: 5, service: 4, ambience: 4, dishes: 'biryani', spendPaisa: 50000, notes: '' };
eq('validateVisit valid = []', L.validateVisit(goodVisit, ASOF).length, 0);
check('validateVisit future date', L.validateVisit(Object.assign({}, goodVisit, { date: '2026-11-24' }), ASOF).indexOf('errDate') !== -1);
check('validateVisit bad date 2026-02-30', L.validateVisit(Object.assign({}, goodVisit, { date: '2026-02-30' }), ASOF).indexOf('errDate') !== -1);
check('validateVisit rating 0', L.validateVisit(Object.assign({}, goodVisit, { food: 0 }), ASOF).indexOf('errRating') !== -1);
check('validateVisit rating 6', L.validateVisit(Object.assign({}, goodVisit, { service: 6 }), ASOF).indexOf('errRating') !== -1);
check('validateVisit negative spend', L.validateVisit(Object.assign({}, goodVisit, { spendPaisa: -100 }), ASOF).indexOf('errSpend') !== -1);
check('validateVisit non-integer spend', L.validateVisit(Object.assign({}, goodVisit, { spendPaisa: 12.5 }), ASOF).indexOf('errSpend') !== -1);
check('validateVisit dishes 201 chars', L.validateVisit(Object.assign({}, goodVisit, { dishes: new Array(202).join('x') }), ASOF).indexOf('errDishes') !== -1);

// ---------- strict import validation ----------
function baseImport() {
  return {
    app: 'restaurant-review-bd', version: 1,
    restaurants: [JSON.parse(JSON.stringify(restA))],
    visits: [JSON.parse(JSON.stringify(visits[0]))]
  };
}
eq('validateImport valid ok', L.validateImport(baseImport(), ASOF).ok, true);
eq('validateImport valid from JSON string ok', L.validateImport(JSON.stringify(baseImport()), ASOF).ok, true);
function expectReject(name, mutate) {
  var d = baseImport();
  mutate(d);
  var res = L.validateImport(d, ASOF);
  check('import rejects: ' + name, res.ok === false);
}
check('import rejects bad JSON string', L.validateImport('{nope', ASOF).ok === false);
expectReject('wrong app', function (d) { d.app = 'other-app'; });
expectReject('wrong version', function (d) { d.version = 2; });
expectReject('restaurants not array', function (d) { d.restaurants = {}; });
expectReject('duplicate restaurant ids', function (d) { d.restaurants.push(JSON.parse(JSON.stringify(restA))); });
expectReject('duplicate visit ids', function (d) { d.visits.push(JSON.parse(JSON.stringify(visits[0]))); });
expectReject('unknown restaurantId', function (d) { d.visits[0].restaurantId = 'r-nope'; });
expectReject('rating 6', function (d) { d.visits[0].food = 6; });
expectReject('rating 0', function (d) { d.visits[0].service = 0; });
expectReject('negative spend', function (d) { d.visits[0].spendPaisa = -1; });
expectReject('non-integer spend', function (d) { d.visits[0].spendPaisa = 12.5; });
expectReject('future visit date', function (d) { d.visits[0].date = '2026-12-01'; });
expectReject('bad visit date 2026-02-30', function (d) { d.visits[0].date = '2026-02-30'; });
expectReject('bad phone', function (d) { d.restaurants[0].phone = '01123456789'; });
expectReject('unknown extra field', function (d) { d.restaurants[0].surprise = 1; });
expectReject('bad cuisine', function (d) { d.restaurants[0].cuisine = 'Mexican'; });
expectReject('empty restaurant id', function (d) { d.restaurants[0].id = ''; });
expectReject('visit not an object', function (d) { d.visits[0] = 'nope'; });
check('import ok does not mutate input', (function () {
  var d = baseImport();
  var before = JSON.stringify(d);
  L.validateImport(d, ASOF);
  return JSON.stringify(d) === before;
})());

// ---------- i18n ----------
eq('i18n en appTitle', I.t('appTitle'), 'Restaurant Review BD');
eq('i18n toBnDigits 2026', I.toBnDigits('2026'), '\u09E8\u09E6\u09E8\u09EC');
eq('i18n toBnDigits mixed', I.toBnDigits('2026-11-23'), '\u09E8\u09E6\u09E8\u09EC-\u09E7\u09E7-\u09E8\u09E9');
eq('i18n toBnDigits 0', I.toBnDigits(0), '\u09E6');
I.setLang('bn');
eq('i18n bn tabDashboard', I.t('tabDashboard'), '\u09A1\u09CD\u09AF\u09BE\u09B6\u09AC\u09CB\u09B0\u09CD\u09A1');
eq('i18n bn demoBadge', I.t('demoBadge'), '\u09A1\u09C7\u09AE\u09CB');
eq('i18n localize bn converts digits', I.localize('1250'), '\u09E7\u09E8\u09EB\u09E6');
I.setLang('en');
eq('i18n back to en', I.t('tabDashboard'), 'Dashboard');
eq('i18n localize en keeps digits', I.localize('1250'), '1250');
eq('i18n unknown key falls back to key', I.t('noSuchKey'), 'noSuchKey');

// ---------- summary ----------
console.log('unit tests: ' + pass + ' passed, ' + fail + ' failed');
if (failures.length) { console.log('failures:'); failures.forEach(function (f) { console.log('  - ' + f); }); }
process.exit(fail ? 1 : 0);
