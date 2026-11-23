// Restaurant Review BD - pure logic (no DOM, no localStorage).
// Money is integer paisa everywhere. Ratings are integers 1-5.
// All functions are deterministic and unit-tested in tests/unit.test.js.
(function (root) {
  'use strict';

  var APP = 'restaurant-review-bd';
  var VERSION = 1;
  var CUISINES = ['Bangladeshi', 'Chinese', 'Indian', 'Fast Food', 'Cafe',
    'Continental', 'Thai', 'Other'];
  var DHAKA_AREAS = ['Dhanmondi', 'Banani', 'Gulshan', 'Uttara', 'Mirpur',
    'Bailey Road', 'Old Dhaka', 'Bashundhara', 'Mohammadpur', 'Motijheel',
    'Wari', 'Lalbagh', 'Tejgaon', 'Farmgate', 'Banasree', 'Khilgaon',
    'Jatrabari', 'Shyamoli', 'Green Road', 'Elephant Road', 'Savar',
    'Keraniganj', 'Baridhara', 'Niketan', 'Rampura', 'Malibagh'];
  var PHONE_RE = /^01[3-9][0-9]{8}$/;
  var DATE_RE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

  function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }
  function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
  }
  function isInt(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
  }
  function round1(x) {
    return Math.round(x * 10) / 10;
  }

  // ---- dates ----
  // Strict YYYY-MM-DD check: rejects 2026-02-30, 2026-13-01, 2026-2-3, etc.
  function isValidDateStr(s) {
    if (typeof s !== 'string') return false;
    var m = DATE_RE.exec(s);
    if (!m) return false;
    var y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 &&
      dt.getUTCDate() === d;
  }
  function isFutureDate(dateStr, asof) {
    // ISO date strings compare lexicographically.
    return dateStr > asof;
  }
  function todayStr(asof) {
    if (asof && isValidDateStr(asof)) return asof;
    var d = new Date();
    var y = d.getFullYear();
    var mo = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    if (mo.length < 2) mo = '0' + mo;
    if (dd.length < 2) dd = '0' + dd;
    return y + '-' + mo + '-' + dd;
  }

  // ---- ratings ----
  // Overall visit score = mean of food/service/ambience, 1 decimal.
  function visitScore(v) {
    return round1((v.food + v.service + v.ambience) / 3);
  }
  function meanRating(values) {
    if (!values.length) return null;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return round1(sum / values.length);
  }

  // ---- dishes ----
  // Split a comma-separated dish string into trimmed, non-empty names.
  function splitDishes(dishes) {
    if (typeof dishes !== 'string') return [];
    return dishes.split(',').map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length > 0; });
  }
  // Most-mentioned dish across visits. Count case-insensitively.
  // Ties go to the alphabetically first name (by lowercase name).
  // Display uses the first-seen original spelling. Returns null if none.
  function bestDish(visits) {
    var counts = {};      // lower name -> count
    var display = {};     // lower name -> first-seen spelling
    visits.forEach(function (v) {
      splitDishes(v.dishes || '').forEach(function (name) {
        var key = name.toLowerCase();
        if (!counts[key]) { counts[key] = 0; display[key] = name; }
        counts[key]++;
      });
    });
    var best = null;
    Object.keys(counts).forEach(function (key) {
      if (best === null || counts[key] > counts[best] ||
        (counts[key] === counts[best] && key < best)) {
        best = key;
      }
    });
    return best === null ? null : display[best];
  }

  // ---- per-restaurant aggregates ----
  function restaurantStats(restaurant, visits) {
    var mine = visits.filter(function (v) { return v.restaurantId === restaurant.id; });
    var totalSpend = 0;
    var scores = [];
    var lastVisit = null;
    mine.forEach(function (v) {
      totalSpend += v.spendPaisa;
      scores.push(visitScore(v));
      if (lastVisit === null || v.date > lastVisit) lastVisit = v.date;
    });
    return {
      visitCount: mine.length,
      totalSpendPaisa: totalSpend,
      avgRating: meanRating(scores),
      lastVisitDate: lastVisit,
      bestDish: bestDish(mine)
    };
  }

  // ---- dashboard ----
  function dashboard(restaurants, visits) {
    var totalSpend = 0;
    var scores = [];
    visits.forEach(function (v) {
      totalSpend += v.spendPaisa;
      scores.push(visitScore(v));
    });
    var statsById = {};
    restaurants.forEach(function (r) {
      statsById[r.id] = restaurantStats(r, visits);
    });
    // Top rated: min 2 visits; tie-break most visits, then name A-Z.
    var topRated = null;
    var topStats = null;
    restaurants.forEach(function (r) {
      var s = statsById[r.id];
      if (s.visitCount < 2 || s.avgRating === null) return;
      if (topRated === null || s.avgRating > topStats.avgRating ||
        (s.avgRating === topStats.avgRating && s.visitCount > topStats.visitCount) ||
        (s.avgRating === topStats.avgRating && s.visitCount === topStats.visitCount &&
          r.name.toLowerCase() < topRated.name.toLowerCase())) {
        topRated = r; topStats = s;
      }
    });
    // Most visited: tie-break name A-Z.
    var mostVisited = null;
    var mostStats = null;
    restaurants.forEach(function (r) {
      var s = statsById[r.id];
      if (s.visitCount === 0) return;
      if (mostVisited === null || s.visitCount > mostStats.visitCount ||
        (s.visitCount === mostStats.visitCount &&
          r.name.toLowerCase() < mostVisited.name.toLowerCase())) {
        mostVisited = r; mostStats = s;
      }
    });
    // Per-cuisine visit counts + average rating (mean of visit scores).
    var perCuisine = {};
    CUISINES.forEach(function (c) {
      perCuisine[c] = { visits: 0, avgRating: null, _sum: 0 };
    });
    restaurants.forEach(function (r) {
      var s = statsById[r.id];
      if (!perCuisine[r.cuisine]) perCuisine[r.cuisine] = { visits: 0, avgRating: null, _sum: 0 };
      perCuisine[r.cuisine].visits += s.visitCount;
      // Sum visit scores for this cuisine.
      visits.forEach(function (v) {
        if (v.restaurantId === r.id) perCuisine[r.cuisine]._sum += visitScore(v);
      });
    });
    Object.keys(perCuisine).forEach(function (c) {
      var p = perCuisine[c];
      p.avgRating = p.visits ? round1(p._sum / p.visits) : null;
      delete p._sum;
    });
    // Recent visits: latest 5 by date desc, stable on insertion order.
    var recent = visits.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return 0;
    }).slice(0, 5);
    return {
      totalRestaurants: restaurants.length,
      totalVisits: visits.length,
      totalSpendPaisa: totalSpend,
      overallAvgRating: meanRating(scores),
      topRated: topRated ? { restaurant: topRated, stats: topStats } : null,
      mostVisited: mostVisited ? { restaurant: mostVisited, stats: mostStats } : null,
      perCuisine: perCuisine,
      recentVisits: recent
    };
  }

  // ---- browse: search / filter / sort ----
  // opts: { q, cuisine, price, minRating, sort }
  // sort: 'name' | 'rating' | 'visits' | 'spend' | 'newest'
  function browse(restaurants, visits, opts) {
    opts = opts || {};
    var q = (opts.q || '').trim().toLowerCase();
    var statsById = {};
    restaurants.forEach(function (r) { statsById[r.id] = restaurantStats(r, visits); });
    var out = restaurants.filter(function (r) {
      var s = statsById[r.id];
      if (opts.cuisine && r.cuisine !== opts.cuisine) return false;
      if (opts.price && r.price !== opts.price) return false;
      if (opts.minRating) {
        if (s.avgRating === null || s.avgRating < opts.minRating) return false;
      }
      if (q) {
        var hay = (r.name + ' ' + r.area).toLowerCase();
        var dishHit = false;
        visits.forEach(function (v) {
          if (v.restaurantId === r.id &&
            splitDishes(v.dishes || '').join(' ').toLowerCase().indexOf(q) !== -1) {
            dishHit = true;
          }
        });
        if (hay.indexOf(q) === -1 && !dishHit) return false;
      }
      return true;
    });
    var sort = opts.sort || 'name';
    function nameCmp(a, b) {
      var x = a.name.toLowerCase(), y = b.name.toLowerCase();
      return x < y ? -1 : (x > y ? 1 : 0);
    }
    out.sort(function (a, b) {
      var sa = statsById[a.id], sb = statsById[b.id];
      if (sort === 'rating') {
        var ra = sa.avgRating === null ? -1 : sa.avgRating;
        var rb = sb.avgRating === null ? -1 : sb.avgRating;
        if (rb !== ra) return rb - ra;
        return nameCmp(a, b);
      }
      if (sort === 'visits') {
        if (sb.visitCount !== sa.visitCount) return sb.visitCount - sa.visitCount;
        return nameCmp(a, b);
      }
      if (sort === 'spend') {
        if (sb.totalSpendPaisa !== sa.totalSpendPaisa) return sb.totalSpendPaisa - sa.totalSpendPaisa;
        return nameCmp(a, b);
      }
      if (sort === 'newest') {
        var ca = a.createdAt || '', cb = b.createdAt || '';
        if (cb !== ca) return cb < ca ? -1 : 1;
        return nameCmp(a, b);
      }
      return nameCmp(a, b);
    });
    return out.map(function (r) { return { restaurant: r, stats: statsById[r.id] }; });
  }

  // ---- money ----
  // Format integer paisa as taka: 125000 -> "T 1,250" (currency symbol added
  // by the caller via TAKA constant to keep this file ASCII-safe in output).
  function formatTaka(paisa) {
    var negative = paisa < 0;
    var abs = Math.abs(paisa);
    var taka = Math.floor(abs / 100);
    var rem = abs % 100;
    var intPart = String(taka).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = rem === 0 ? intPart : intPart + '.' + (rem < 10 ? '0' + rem : String(rem));
    return (negative ? '-' : '') + out;
  }
  // Parse a whole-taka spend string -> paisa, or null if invalid.
  // Accepts Bengali digits too (U+09E6..U+09EF).
  function parseSpendTaka(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim().replace(/,/g, '')
      .replace(/[\u09E6-\u09EF]/g, function (d) {
        return String(d.charCodeAt(0) - 0x09E6);
      });
    if (!/^[0-9]+$/.test(s)) return null;
    var taka = parseInt(s, 10);
    if (!isFinite(taka) || taka < 0) return null;
    return taka * 100;
  }

  // ---- validation ----
  function cleanPhone(raw) {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[\s-]/g, '');
  }
  function validateRestaurant(r, asof) {
    var errors = [];
    if (!isNonEmptyString(r.name) || r.name.trim().length > 80) errors.push('errName');
    if (!isNonEmptyString(r.area) || r.area.trim().length > 60) errors.push('errArea');
    if (CUISINES.indexOf(r.cuisine) === -1) errors.push('errCuisine');
    if (!isInt(r.price) || r.price < 1 || r.price > 4) errors.push('errPrice');
    if (r.phone != null && r.phone !== '') {
      if (typeof r.phone !== 'string' || !PHONE_RE.test(cleanPhone(r.phone))) {
        errors.push('errPhone');
      }
    }
    if (r.notes != null && (typeof r.notes !== 'string' || r.notes.length > 200)) {
      errors.push('errNotes');
    }
    return errors;
  }
  function validateVisit(v, asof) {
    var errors = [];
    if (!isValidDateStr(v.date)) errors.push('errDate');
    else if (isFutureDate(v.date, asof)) errors.push('errDate');
    ['food', 'service', 'ambience'].forEach(function (k) {
      if (!isInt(v[k]) || v[k] < 1 || v[k] > 5) errors.push('errRating');
    });
    if (typeof v.dishes !== 'string' || v.dishes.length > 200) errors.push('errDishes');
    if (!isInt(v.spendPaisa) || v.spendPaisa < 0) errors.push('errSpend');
    if (v.notes != null && (typeof v.notes !== 'string' || v.notes.length > 200)) {
      errors.push('errNotes');
    }
    return errors;
  }

  // ---- strict import validation ----
  // Returns { ok: true, data: normalizedData } or { ok: false, errors: [codes] }.
  // On failure the caller's data must stay untouched.
  function validateImport(raw, asof) {
    var errors = [];
    var data;
    if (typeof raw === 'string') {
      try { data = JSON.parse(raw); } catch (e) { return { ok: false, errors: ['errImport_bad-json'] }; }
    } else {
      data = raw;
    }
    if (!isPlainObject(data)) return { ok: false, errors: ['errImport_bad-type'] };
    if (data.app !== APP) errors.push('errImport_wrong-app');
    if (data.version !== VERSION) errors.push('errImport_wrong-version');
    if (!Array.isArray(data.restaurants) || !Array.isArray(data.visits)) {
      errors.push('errImport_bad-type');
      return { ok: false, errors: errors };
    }
    var restKeys = ['id', 'name', 'area', 'cuisine', 'price', 'phone', 'notes', 'demo', 'createdAt'];
    var visitKeys = ['id', 'restaurantId', 'date', 'food', 'service', 'ambience',
      'dishes', 'spendPaisa', 'notes', 'demo', 'createdAt'];
    var restIds = {};
    var restIdSet = {};
    data.restaurants.forEach(function (r, i) {
      if (!isPlainObject(r)) { errors.push('errImport_bad-type'); return; }
      Object.keys(r).forEach(function (k) {
        if (restKeys.indexOf(k) === -1) errors.push('errImport_bad-field');
      });
      if (typeof r.id !== 'string' || r.id === '') errors.push('errImport_bad-field');
      else if (restIds[r.id]) errors.push('errImport_duplicate-id');
      else { restIds[r.id] = true; restIdSet[r.id] = true; }
      validateRestaurant(r, asof).forEach(function (code) {
        if (code === 'errPhone') errors.push('errImport_bad-phone');
        else errors.push('errImport_bad-field');
      });
      if (r.demo !== undefined && typeof r.demo !== 'boolean') errors.push('errImport_bad-type');
      if (r.createdAt !== undefined && !isValidDateStr(r.createdAt)) errors.push('errImport_bad-date');
      if (r.phone !== undefined && r.phone !== '' && typeof r.phone !== 'string') {
        errors.push('errImport_bad-phone');
      }
    });
    var visitIds = {};
    data.visits.forEach(function (v) {
      if (!isPlainObject(v)) { errors.push('errImport_bad-type'); return; }
      Object.keys(v).forEach(function (k) {
        if (visitKeys.indexOf(k) === -1) errors.push('errImport_bad-field');
      });
      if (typeof v.id !== 'string' || v.id === '') errors.push('errImport_bad-field');
      else if (visitIds[v.id]) errors.push('errImport_duplicate-id');
      else visitIds[v.id] = true;
      if (typeof v.restaurantId !== 'string' || !restIdSet[v.restaurantId]) {
        errors.push('errImport_unknown-restaurant');
      }
      if (!isValidDateStr(v.date)) errors.push('errImport_bad-date');
      else if (isFutureDate(v.date, asof)) errors.push('errImport_future-date');
      ['food', 'service', 'ambience'].forEach(function (k) {
        if (!isInt(v[k]) || v[k] < 1 || v[k] > 5) errors.push('errImport_bad-rating');
      });
      if (typeof v.dishes !== 'string' || v.dishes.length > 200) errors.push('errImport_bad-field');
      if (!isInt(v.spendPaisa)) errors.push('errImport_bad-spend');
      else if (v.spendPaisa < 0) errors.push('errImport_negative-spend');
      if (v.notes !== undefined && (typeof v.notes !== 'string' || v.notes.length > 200)) {
        errors.push('errImport_bad-field');
      }
      if (v.demo !== undefined && typeof v.demo !== 'boolean') errors.push('errImport_bad-type');
      if (v.createdAt !== undefined && !isValidDateStr(v.createdAt)) errors.push('errImport_bad-date');
    });
    if (errors.length) return { ok: false, errors: errors };
    return { ok: true, data: data };
  }

  function emptyData() {
    return { app: APP, version: VERSION, restaurants: [], visits: [] };
  }
  function newId(prefix) {
    return prefix + '-' + Date.now().toString(36) +
      Math.floor(Math.random() * 46656).toString(36);
  }

  var api = {
    APP: APP, VERSION: VERSION, CUISINES: CUISINES, DHAKA_AREAS: DHAKA_AREAS,
    isValidDateStr: isValidDateStr, isFutureDate: isFutureDate,
    todayStr: todayStr, visitScore: visitScore, meanRating: meanRating,
    splitDishes: splitDishes, bestDish: bestDish,
    restaurantStats: restaurantStats, dashboard: dashboard, browse: browse,
    formatTaka: formatTaka, parseSpendTaka: parseSpendTaka,
    cleanPhone: cleanPhone, validateRestaurant: validateRestaurant,
    validateVisit: validateVisit, validateImport: validateImport,
    emptyData: emptyData, newId: newId
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RRBD = api;
})(typeof window !== 'undefined' ? window : globalThis);
