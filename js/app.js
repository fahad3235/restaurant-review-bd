// Restaurant Review BD - UI wiring (DOM + localStorage).
// Depends on js/logic.js (window.RRBD) and js/i18n.js (window.RRBDI18N).
// Pure ASCII source: Bengali text comes from i18n.js as \uXXXX escapes.
(function () {
  'use strict';

  var L = window.RRBD;
  var I = window.RRBDI18N;
  // Taka sign U+09F3, built from its code point so the source stays ASCII.
  var TAKA_SIGN = String.fromCharCode(0x09F3);
  var STAR = String.fromCharCode(0x2605);
  var STAR_EMPTY = String.fromCharCode(0x2606);
  var DATA_KEY = 'rrbd-data-v1';

  // ---- "today" override for tests: ?asof=YYYY-MM-DD ----
  var params = new URLSearchParams(window.location.search);
  var ASOF = params.get('asof');
  if (!L.isValidDateStr(ASOF)) ASOF = null;
  var TODAY = L.todayStr(ASOF);
  window.__RRBD_ASOF = TODAY;

  // ---- state ----
  var data = loadData();
  var currentTab = 'dashboard';
  var editingRestId = null;
  var editingVisitId = null;
  var visitRestId = null;
  var openVisitLists = {};

  function loadData() {
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (!raw) return L.emptyData();
      var parsed = JSON.parse(raw);
      var res = L.validateImport(parsed, TODAY);
      if (res.ok) return res.data;
      return L.emptyData();
    } catch (e) {
      return L.emptyData();
    }
  }
  function saveData() {
    try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); } catch (e) {}
  }

  // ---- helpers ----
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function loc(v) { return I.localize(v); }
  function taka(paisa) { return TAKA_SIGN + loc(L.formatTaka(paisa)); }
  function stars(avg) {
    if (avg === null || avg === undefined) return '<span class="muted">\u2014</span>';
    var filled = Math.round(avg);
    var s = '';
    for (var i = 1; i <= 5; i++) s += i <= filled ? STAR : STAR_EMPTY;
    return '<span class="stars" title="' + esc(loc(avg)) + ' / 5">' + esc(s) + '</span> ' +
      '<span class="num">' + esc(loc(avg)) + '</span>';
  }
  function priceMarks(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += TAKA_SIGN;
    return s;
  }
  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 3000);
  }
  function showError(boxId, codes) {
    var el = $(boxId);
    if (!codes || !codes.length) { el.textContent = ''; el.style.display = 'none'; return; }
    el.textContent = codes.map(function (c) { return I.t(c); }).join(' ');
    el.style.display = 'block';
  }

  // ---- i18n application ----
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = I.t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', I.t(el.getAttribute('data-i18n-ph')));
    });
    $('langToggle').textContent = I.getLang() === 'bn' ? 'English' : '\u09AC\u09BE\u0982\u09B2\u09BE';
    document.documentElement.lang = I.getLang() === 'bn' ? 'bn' : 'en';
    renderAll();
  }
  $('langToggle').addEventListener('click', function () {
    I.setLang(I.getLang() === 'bn' ? 'en' : 'bn');
    applyI18n();
  });

  // ---- tabs ----
  function showTab(tab) {
    currentTab = tab;
    ['dashboard', 'restaurants', 'add', 'data'].forEach(function (t) {
      $('tab-' + t).style.display = t === tab ? 'block' : 'none';
      var btn = document.querySelector('[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'dashboard') renderDashboard();
    if (tab === 'restaurants') renderBrowse();
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.getAttribute('data-tab')); });
  });

  // ---- dashboard ----
  function renderDashboard() {
    var d = L.dashboard(data.restaurants, data.visits);
    $('statRestaurants').textContent = loc(d.totalRestaurants);
    $('statVisits').textContent = loc(d.totalVisits);
    $('statSpend').textContent = taka(d.totalSpendPaisa);
    $('statAvg').textContent = d.overallAvgRating === null ? '\u2014' : loc(d.overallAvgRating);
    var top = $('topRatedBox');
    if (d.topRated) {
      top.innerHTML = '<strong>' + esc(d.topRated.restaurant.name) + '</strong>' +
        (d.topRated.restaurant.demo ? ' <span class="badge">' + esc(I.t('demoBadge')) + '</span>' : '') +
        '<br>' + stars(d.topRated.stats.avgRating) +
        ' \u00b7 ' + esc(loc(d.topRated.stats.visitCount)) + ' ' + esc(I.t('visitsLabel'));
    } else {
      top.innerHTML = '<span class="muted">' + esc(I.t('minVisitsNote')) + '</span>';
    }
    var mv = $('mostVisitedBox');
    if (d.mostVisited) {
      mv.innerHTML = '<strong>' + esc(d.mostVisited.restaurant.name) + '</strong>' +
        (d.mostVisited.restaurant.demo ? ' <span class="badge">' + esc(I.t('demoBadge')) + '</span>' : '') +
        '<br>' + esc(loc(d.mostVisited.stats.visitCount)) + ' ' + esc(I.t('visitsLabel')) +
        ' \u00b7 ' + stars(d.mostVisited.stats.avgRating);
    } else {
      mv.innerHTML = '<span class="muted">' + esc(I.t('noData')) + '</span>';
    }
    var rows = '';
    L.CUISINES.forEach(function (c) {
      var p = d.perCuisine[c];
      if (!p) return;
      var key = 'cuisine' + c.replace(/[^A-Za-z]/g, '');
      rows += '<tr><td>' + esc(I.t(key)) + '</td><td>' + esc(loc(p.visits)) + '</td><td>' +
        (p.avgRating === null ? '\u2014' : esc(loc(p.avgRating))) + '</td></tr>';
    });
    $('cuisineTableBody').innerHTML = rows;
    var recent = d.recentVisits.map(function (v) {
      var r = data.restaurants.find(function (x) { return x.id === v.restaurantId; });
      var name = r ? r.name : '?';
      return '<li><strong>' + esc(name) + '</strong>' +
        (r && r.demo ? ' <span class="badge">' + esc(I.t('demoBadge')) + '</span>' : '') +
        ' \u2014 ' + stars(L.visitScore(v)) +
        ' \u00b7 ' + esc(loc(v.date)) +
        ' \u00b7 ' + taka(v.spendPaisa) + '</li>';
    }).join('');
    $('recentVisits').innerHTML = recent ||
      '<li class="muted">' + esc(I.t('noData')) + '</li>';
  }

  // ---- browse ----
  function readBrowseOpts() {
    return {
      q: $('searchInput').value,
      cuisine: $('cuisineFilter').value || '',
      price: $('priceFilter').value ? parseInt($('priceFilter').value, 10) : '',
      minRating: $('minRatingFilter').value ? parseFloat($('minRatingFilter').value) : '',
      sort: $('sortSelect').value
    };
  }
  function renderBrowse() {
    var rows = L.browse(data.restaurants, data.visits, readBrowseOpts());
    var list = $('restaurantList');
    if (!rows.length) {
      list.innerHTML = '<p class="muted">' + esc(I.t('noRestaurants')) + '</p>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var r = row.restaurant, s = row.stats;
      var visitsHtml = '';
      if (openVisitLists[r.id]) {
        var mine = data.visits.filter(function (v) { return v.restaurantId === r.id; })
          .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
        visitsHtml = '<ul class="visit-list">' + (mine.length ? mine.map(function (v) {
          return '<li><strong>' + esc(loc(v.date)) + '</strong> \u2014 ' + stars(L.visitScore(v)) +
            ' \u00b7 ' + esc(I.t('vFood')) + ' ' + esc(loc(v.food)) + ' \u00b7 ' +
            esc(I.t('vService')) + ' ' + esc(loc(v.service)) + ' \u00b7 ' +
            esc(I.t('vAmbience')) + ' ' + esc(loc(v.ambience)) +
            (v.dishes ? '<br>' + esc(I.t('dishesLabel')) + ': ' + esc(v.dishes) : '') +
            '<br>' + esc(I.t('spendLabel')) + ': ' + taka(v.spendPaisa) +
            (v.notes ? '<br>' + esc(v.notes) : '') +
            (v.demo ? ' <span class="badge">' + esc(I.t('demoBadge')) + '</span>' : '') +
            '<br><button type="button" data-action="edit-visit" data-id="' + esc(v.id) + '">' +
            esc(I.t('edit')) + '</button> ' +
            '<button type="button" class="danger" data-action="del-visit" data-id="' + esc(v.id) + '">' +
            esc(I.t('delete')) + '</button></li>';
        }).join('') : '<li class="muted">' + esc(I.t('noVisitsYet')) + '</li>') + '</ul>';
      }
      return '<article class="card" data-rest-id="' + esc(r.id) + '">' +
        '<h3>' + esc(r.name) +
        (r.demo ? ' <span class="badge">' + esc(I.t('demoBadge')) + '</span>' : '') + '</h3>' +
        '<p class="meta">' + esc(r.area) + ' \u00b7 ' + esc(I.t('cuisine' + r.cuisine.replace(/[^A-Za-z]/g, ''))) +
        ' \u00b7 ' + esc(priceMarks(r.price)) + '</p>' +
        (r.phone ? '<p class="meta">' + esc(r.phone) + '</p>' : '') +
        (r.notes ? '<p class="notes">' + esc(r.notes) + '</p>' : '') +
        '<p>' + stars(s.avgRating) + '</p>' +
        '<p class="meta">' + esc(loc(s.visitCount)) + ' ' + esc(I.t('visitsLabel')) +
        ' \u00b7 ' + esc(I.t('totalSpend')) + ': ' + taka(s.totalSpendPaisa) + '</p>' +
        '<p class="meta">' + esc(I.t('lastVisit')) + ': ' +
        (s.lastVisitDate ? esc(loc(s.lastVisitDate)) : esc(I.t('neverVisited'))) + '</p>' +
        '<p class="meta">' + esc(I.t('bestDish')) + ': ' +
        (s.bestDish ? esc(s.bestDish) : '\u2014') + '</p>' +
        '<div class="card-actions">' +
        '<button type="button" data-action="add-visit" data-id="' + esc(r.id) + '">' + esc(I.t('addVisit')) + '</button> ' +
        '<button type="button" data-action="toggle-visits" data-id="' + esc(r.id) + '">' +
        esc(openVisitLists[r.id] ? I.t('hideVisits') : I.t('showVisits')) + '</button> ' +
        '<button type="button" data-action="edit-rest" data-id="' + esc(r.id) + '">' + esc(I.t('edit')) + '</button> ' +
        '<button type="button" class="danger" data-action="del-rest" data-id="' + esc(r.id) + '">' + esc(I.t('delete')) + '</button>' +
        '</div>' + visitsHtml + '</article>';
    }).join('');
  }
  ['searchInput', 'cuisineFilter', 'priceFilter', 'minRatingFilter', 'sortSelect']
    .forEach(function (id) {
      $(id).addEventListener('input', renderBrowse);
      $(id).addEventListener('change', renderBrowse);
    });

  // ---- restaurant form ----
  function openRestForm(rest) {
    editingRestId = rest ? rest.id : null;
    $('restFormTitle').textContent = I.t(rest ? 'formEditTitle' : 'formAddTitle');
    $('fName').value = rest ? rest.name : '';
    $('fArea').value = rest ? rest.area : '';
    $('fCuisine').value = rest ? rest.cuisine : 'Bangladeshi';
    $('fPrice').value = rest ? String(rest.price) : '2';
    $('fPhone').value = rest ? (rest.phone || '') : '';
    $('fNotes').value = rest ? (rest.notes || '') : '';
    showError('restFormError', []);
    showTab('add');
  }
  $('restForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var r = {
      id: editingRestId || L.newId('r'),
      name: $('fName').value.trim(),
      area: $('fArea').value.trim(),
      cuisine: $('fCuisine').value,
      price: parseInt($('fPrice').value, 10),
      phone: L.cleanPhone($('fPhone').value),
      notes: $('fNotes').value.trim(),
      demo: false,
      createdAt: TODAY
    };
    if (editingRestId) {
      var old = data.restaurants.find(function (x) { return x.id === editingRestId; });
      if (old) { r.demo = old.demo; r.createdAt = old.createdAt; }
    }
    var errors = L.validateRestaurant(r, TODAY);
    if (errors.length) { showError('restFormError', errors); return; }
    if (editingRestId) {
      var idx = data.restaurants.findIndex(function (x) { return x.id === editingRestId; });
      if (idx !== -1) data.restaurants[idx] = r;
    } else {
      data.restaurants.push(r);
    }
    saveData();
    editingRestId = null;
    toast(I.t('msgSaved'));
    $('restForm').reset();
    showTab('restaurants');
    renderAll();
  });
  $('restFormCancel').addEventListener('click', function () {
    editingRestId = null;
    $('restForm').reset();
    showTab('restaurants');
  });
  $('addNewBtn').addEventListener('click', function () { openRestForm(null); });

  // ---- visit form ----
  function openVisitForm(restId, visit) {
    visitRestId = restId;
    editingVisitId = visit ? visit.id : null;
    var r = data.restaurants.find(function (x) { return x.id === restId; });
    $('visitRestaurantName').textContent = r ? r.name : '';
    $('visitFormTitle').textContent = I.t(visit ? 'visitEditTitle' : 'visitAddTitle');
    $('vDate').value = visit ? visit.date : TODAY;
    $('vDate').max = TODAY;
    $('vFood').value = visit ? String(visit.food) : '5';
    $('vService').value = visit ? String(visit.service) : '5';
    $('vAmbience').value = visit ? String(visit.ambience) : '5';
    $('vDishes').value = visit ? visit.dishes : '';
    $('vSpend').value = visit ? String(Math.floor(visit.spendPaisa / 100)) : '';
    $('vNotes').value = visit ? (visit.notes || '') : '';
    showError('visitFormError', []);
    $('tab-visit').style.display = 'block';
    ['dashboard', 'restaurants', 'add', 'data'].forEach(function (t) {
      $('tab-' + t).style.display = 'none';
    });
    window.scrollTo(0, 0);
  }
  $('visitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var spend = L.parseSpendTaka($('vSpend').value);
    var v = {
      id: editingVisitId || L.newId('v'),
      restaurantId: visitRestId,
      date: $('vDate').value,
      food: parseInt($('vFood').value, 10),
      service: parseInt($('vService').value, 10),
      ambience: parseInt($('vAmbience').value, 10),
      dishes: $('vDishes').value.trim(),
      spendPaisa: spend === null ? -1 : spend,
      notes: $('vNotes').value.trim(),
      demo: false,
      createdAt: TODAY
    };
    if (editingVisitId) {
      var old = data.visits.find(function (x) { return x.id === editingVisitId; });
      if (old) { v.demo = old.demo; v.createdAt = old.createdAt; }
    }
    var errors = L.validateVisit(v, TODAY);
    if (errors.length) { showError('visitFormError', errors); return; }
    if (editingVisitId) {
      var idx = data.visits.findIndex(function (x) { return x.id === editingVisitId; });
      if (idx !== -1) data.visits[idx] = v;
    } else {
      data.visits.push(v);
    }
    saveData();
    editingVisitId = null;
    visitRestId = null;
    toast(I.t('msgSaved'));
    $('visitForm').reset();
    $('tab-visit').style.display = 'none';
    showTab('restaurants');
    renderAll();
  });
  $('visitFormCancel').addEventListener('click', function () {
    editingVisitId = null;
    visitRestId = null;
    $('visitForm').reset();
    $('tab-visit').style.display = 'none';
    showTab('restaurants');
  });

  // ---- card actions (event delegation) ----
  $('restaurantList').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.getAttribute('data-action');
    var id = btn.getAttribute('data-id');
    if (action === 'add-visit') openVisitForm(id, null);
    else if (action === 'toggle-visits') {
      openVisitLists[id] = !openVisitLists[id];
      renderBrowse();
    } else if (action === 'edit-rest') {
      var r = data.restaurants.find(function (x) { return x.id === id; });
      if (r) openRestForm(r);
    } else if (action === 'del-rest') {
      if (window.confirm(I.t('confirmDeleteRest'))) {
        data.restaurants = data.restaurants.filter(function (x) { return x.id !== id; });
        data.visits = data.visits.filter(function (v) { return v.restaurantId !== id; });
        saveData();
        toast(I.t('msgDeleted'));
        renderAll();
      }
    } else if (action === 'edit-visit') {
      var v = data.visits.find(function (x) { return x.id === id; });
      if (v) openVisitForm(v.restaurantId, v);
    } else if (action === 'del-visit') {
      if (window.confirm(I.t('confirmDeleteVisit'))) {
        data.visits = data.visits.filter(function (x) { return x.id !== id; });
        saveData();
        toast(I.t('msgDeleted'));
        renderAll();
      }
    }
  });

  // ---- demo data ----
  function demoData() {
    function R(id, name, area, cuisine, price, phone, notes) {
      return { id: id, name: name, area: area, cuisine: cuisine, price: price,
        phone: phone, notes: notes, demo: true, createdAt: '2026-11-20' };
    }
    function V(id, rid, date, food, service, ambience, dishes, spendTaka, notes) {
      return { id: id, restaurantId: rid, date: date, food: food, service: service,
        ambience: ambience, dishes: dishes, spendPaisa: spendTaka * 100,
        notes: notes || '', demo: true, createdAt: '2026-11-20' };
    }
    return {
      app: L.APP, version: L.VERSION,
      restaurants: [
        R('demo-r1', 'Kacchi Bhai', 'Dhanmondi', 'Bangladeshi', 2, '01712345678', 'Famous kachchi biryani.'),
        R('demo-r2', 'Fuchka House', 'Bailey Road', 'Fast Food', 1, '', 'Street-side fuchka stall.'),
        R('demo-r3', 'Star Kabab', 'Banani', 'Bangladeshi', 2, '01812345678', 'Chaap and paratha.'),
        R('demo-r4', 'China Garden', 'Gulshan', 'Chinese', 3, '01912345678', 'Family dinner spot.'),
        R('demo-r5', 'Cafe Apon', 'Uttara', 'Cafe', 2, '', 'Quiet cafe, good coffee.'),
        R('demo-r6', 'Thai Emerald', 'Banani', 'Thai', 3, '01612345678', 'Tom yum soup is the star.')
      ],
      visits: [
        V('demo-v1', 'demo-r1', '2026-11-15', 5, 4, 4, 'kachchi biryani, borhani', 850, ''),
        V('demo-v2', 'demo-r1', '2026-11-08', 5, 5, 4, 'kachchi biryani, jali kabab', 920, 'Busy Friday lunch.'),
        V('demo-v3', 'demo-r2', '2026-11-18', 4, 3, 3, 'fuchka, chotpoti', 150, ''),
        V('demo-v4', 'demo-r3', '2026-11-10', 4, 4, 3, 'chicken chaap, paratha', 620, ''),
        V('demo-v5', 'demo-r3', '2026-11-02', 3, 4, 4, 'beef chaap, lassi', 540, ''),
        V('demo-v6', 'demo-r4', '2026-11-12', 5, 5, 5, 'szechuan chicken, fried rice', 2400, 'Birthday dinner.'),
        V('demo-v7', 'demo-r5', '2026-11-16', 4, 4, 5, 'cold coffee, chicken sandwich', 780, ''),
        V('demo-v8', 'demo-r6', '2026-11-20', 5, 4, 4, 'tom yum soup, green curry', 1950, ''),
        V('demo-v9', 'demo-r6', '2026-11-05', 4, 4, 3, 'pad thai, spring roll', 1680, '')
      ]
    };
  }
  $('demoLoadBtn').addEventListener('click', function () {
    if (data.restaurants.some(function (r) { return r.demo; })) {
      toast(I.t('demoAlready'));
      return;
    }
    var d = demoData();
    data.restaurants = data.restaurants.concat(d.restaurants);
    data.visits = data.visits.concat(d.visits);
    saveData();
    toast(I.t('demoLoaded'));
    renderAll();
  });
  $('demoClearBtn').addEventListener('click', function () {
    var demoIds = {};
    data.restaurants.forEach(function (r) { if (r.demo) demoIds[r.id] = true; });
    data.restaurants = data.restaurants.filter(function (r) { return !r.demo; });
    data.visits = data.visits.filter(function (v) { return !demoIds[v.restaurantId] && !v.demo; });
    saveData();
    toast(I.t('demoCleared'));
    renderAll();
  });

  // ---- data tab: export / import / erase ----
  $('exportBtn').addEventListener('click', function () {
    var json = JSON.stringify(data, null, 2);
    $('exportOutput').textContent = json;
    $('exportOutput').style.display = 'block';
    var blob = new Blob([json], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'restaurant-review-bd-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('importBtn').addEventListener('click', function () {
    var text = $('importText').value.trim();
    if (!text) return;
    var res = L.validateImport(text, TODAY);
    if (!res.ok) {
      showError('importError', res.errors.map(function (c) { return 'errImport_' + c.replace('errImport_', ''); }));
      return;
    }
    data = res.data;
    saveData();
    showError('importError', []);
    $('importText').value = '';
    toast(I.t('importOk'));
    renderAll();
  });
  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files && $('importFile').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () { $('importText').value = String(reader.result || ''); };
    reader.readAsText(file);
  });
  $('eraseBtn').addEventListener('click', function () {
    if ($('eraseInput').value.trim() !== 'DELETE') {
      showError('eraseError', ['eraseHint']);
      return;
    }
    data = L.emptyData();
    saveData();
    $('eraseInput').value = '';
    showError('eraseError', []);
    toast(I.t('msgErased'));
    renderAll();
  });

  // ---- render all / boot ----
  function renderAll() {
    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'restaurants') renderBrowse();
  }
  // Populate cuisine / price / rating selects from logic constants.
  (function initFilters() {
    var cf = $('cuisineFilter');
    L.CUISINES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      cf.appendChild(o);
    });
    var fc = $('fCuisine');
    L.CUISINES.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c;
      o.textContent = c;
      fc.appendChild(o);
    });
    var dl = $('areaList');
    L.DHAKA_AREAS.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a;
      dl.appendChild(o);
    });
    // Price options: fill taka marks (kept out of the HTML to stay ASCII).
    ['priceFilter', 'fPrice'].forEach(function (id) {
      Array.prototype.forEach.call($(id).options, function (o) {
        if (o.value) o.textContent = priceMarks(parseInt(o.value, 10));
      });
    });
    // Live overall-score preview on the visit form.
    ['vFood', 'vService', 'vAmbience'].forEach(function (id) {
      $(id).addEventListener('change', updateVisitPreview);
    });
    updateVisitPreview();
  })();
  function updateVisitPreview() {
    var f = parseInt($('vFood').value, 10) || 0;
    var s = parseInt($('vService').value, 10) || 0;
    var a = parseInt($('vAmbience').value, 10) || 0;
    $('visitScorePreview').textContent = loc(L.visitScore({ food: f, service: s, ambience: a }));
  }
  applyI18n();
  showTab('dashboard');
  window.__RRBD = { getData: function () { return data; }, renderAll: renderAll };
})();
