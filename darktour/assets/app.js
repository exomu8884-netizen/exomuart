/* 다크투어 — 공용 로직
 *
 * 설계 요약 (SPEC.md 참조)
 *  - 캐시는 (areaCode × lens) 단위로만 존재한다. 기간과 렌즈 조합은 여기서 계산한다.
 *  - 여러 렌즈를 고르면 합집합으로 병합한다 (교집합 아님).
 *  - 순서는 저장하지 않고 eraStart(시간의 길) / 좌표(발의 길)로 계산한다.
 *  - 자를 때는 선택한 렌즈마다 최소 1곳을 먼저 확보한 뒤 weight 로 채운다.
 */
(function (global) {
  'use strict';

  var DT = {};
  var BASE = 'data/';
  var _cache = {};

  /* ---------- 기본 유틸 ---------- */

  DT.get = function (path) {
    if (!_cache[path]) {
      _cache[path] = fetch(BASE + path, { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) return null;
        return r.json();
      }).catch(function () { return null; });
    }
    return _cache[path];
  };

  DT.loadLenses = function () { return DT.get('lenses.json'); };
  DT.loadRegions = function () { return DT.get('regions.json'); };
  DT.loadCoverage = function () { return DT.get('coverage.json'); };
  DT.loadTour = function () { return DT.get('tour.json'); };
  DT.loadGrandculture = function () { return DT.get('grandculture.json'); };
  DT.loadMotifs = function () { return DT.get('motifs.json'); };

  DT.motifById = function (motifData, id) {
    var hit = null;
    ((motifData && motifData.motifs) || []).forEach(function (m) { if (m.id === id) hit = m; });
    return hit;
  };

  DT.loadCache = function (areaCode, lens) {
    return DT.get('cache/' + areaCode + '__' + lens + '.json');
  };

  DT.params = function () {
    var p = new URLSearchParams(global.location.search);
    var o = {};
    p.forEach(function (v, k) { o[k] = v; });
    return o;
  };

  DT.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  DT.encyURL = function (query) {
    return 'https://encykorea.aks.ac.kr/Article/Search/' + encodeURIComponent(query || '');
  };

  DT.kakaoURL = function (place) {
    if (place.lat == null || place.lng == null) return null;
    return 'https://map.kakao.com/link/map/' +
      encodeURIComponent(place.name) + ',' + place.lat + ',' + place.lng;
  };

  /**
   * 디지털○○문화대전 주소. 서비스 중인 시군구만 슬러그가 등록되어 있고,
   * 없으면 null 을 돌려 링크를 아예 만들지 않는다 (죽은 링크 방지).
   */
  DT.grandcultureURL = function (gc, areaCode, sigungu) {
    if (!gc || !gc.verified) return null;
    var slug = gc.verified[areaCode + '|' + sigungu];
    if (!slug) return null;
    return gc.urlPattern.replace(/\{slug\}/g, slug);
  };

  /* ---------- 근거와 출처 ---------- */

  var EVIDENCE = {
    record: { label: '사료 기록', note: '문헌·법령·판례 등 문서로 남은 사실에 근거합니다.' },
    site: { label: '유물·유적', note: '남아 있는 건물이나 유물 자체가 근거입니다.' },
    oral: { label: '구술·증언', note: '당사자와 관계자의 증언에 근거합니다. 세부는 증언마다 다를 수 있습니다.' },
    legend: { label: '전해지는 이야기', note: '설화·구전입니다. 사실이 아닐 수 있으나, 이 지역이 무엇을 기억하려 했는지는 사실입니다.' }
  };
  DT.evidence = function (id) { return EVIDENCE[id] || null; };

  DT.sourceURL = function (src) {
    if (src.url) return src.url;
    if (src.encyQuery) return DT.encyURL(src.encyQuery);
    return null;
  };

  /* ---------- 렌즈 ---------- */

  DT.lensMap = function (lensData) {
    var m = {};
    (lensData.lenses || []).forEach(function (l) { m[l.id] = l; });
    return m;
  };

  DT.lensLabel = function (lensData, id) {
    var l = DT.lensMap(lensData)[id];
    return l ? l.label : id;
  };

  DT.durationById = function (lensData, id) {
    var found = null;
    (lensData.durations || []).forEach(function (d) { if (d.id === id) found = d; });
    return found || (lensData.durations || [])[1] || { id: 'day', label: '하루', stops: 5 };
  };

  DT.orderById = function (lensData, id) {
    var found = null;
    (lensData.orders || []).forEach(function (o) { if (o.id === id) found = o; });
    return found || (lensData.orders || [])[0];
  };

  /* ---------- 풀 병합 (합집합) ---------- */

  /**
   * 선택한 렌즈들의 캐시를 모두 읽어 하나의 풀로 합친다.
   * 합집합이므로 어느 한 렌즈에만 걸린 장소도 전부 포함된다.
   * 같은 장소가 여러 캐시에 나오면 id 로 합치고 lensNotes 를 병합한다.
   */
  DT.buildPool = function (areaCode, lensIds) {
    return Promise.all(lensIds.map(function (l) { return DT.loadCache(areaCode, l); }))
      .then(function (files) {
        var byId = {};
        var order = [];
        var notes = [];

        files.forEach(function (file, i) {
          if (!file) return;
          if (file.regionNote) notes.push({ lens: lensIds[i], text: file.regionNote });

          (file.places || []).forEach(function (p) {
            if (!byId[p.id]) {
              byId[p.id] = JSON.parse(JSON.stringify(p));
              order.push(p.id);
            } else {
              // 같은 장소가 다른 렌즈 캐시에도 있으면 관점 문단을 합친다
              var t = byId[p.id];
              t.lensNotes = t.lensNotes || {};
              Object.keys(p.lensNotes || {}).forEach(function (k) {
                if (!t.lensNotes[k]) t.lensNotes[k] = p.lensNotes[k];
              });
              (p.lenses || []).forEach(function (l) {
                if (t.lenses.indexOf(l) === -1) t.lenses.push(l);
              });
              if ((p.weight || 0) > (t.weight || 0)) t.weight = p.weight;
            }
          });
        });

        return {
          places: order.map(function (id) { return byId[id]; }),
          regionNotes: notes
        };
      });
  };

  DT.filterBySigungu = function (places, sigungu) {
    if (!sigungu || sigungu === '*') return places.slice();
    return places.filter(function (p) { return p.sigungu === sigungu; });
  };

  /* ---------- 정거장 선택 (렌즈별 최소 1곳 보장) ---------- */

  function byWeight(a, b) {
    var w = (b.weight || 0) - (a.weight || 0);
    if (w !== 0) return w;
    return (a.eraStart || 0) - (b.eraStart || 0);
  }

  /**
   * 1단계 선택한 각 렌즈에서 weight 최고 1곳씩 확보
   * 2단계 남은 자리를 전체 weight 내림차순으로 채움
   * 정원이 렌즈 수보다 적으면 warning 을 돌려준다 — 조용히 버리지 않는다.
   */
  DT.selectStops = function (places, lensIds, count) {
    var picked = [];
    var used = {};
    var warnings = [];
    var covered = [];

    lensIds.forEach(function (lens) {
      if (picked.length >= count) return;
      var candidates = places.filter(function (p) {
        return !used[p.id] && (p.lenses || []).indexOf(lens) !== -1;
      }).sort(byWeight);
      if (candidates.length) {
        used[candidates[0].id] = true;
        picked.push(candidates[0]);
        covered.push(lens);
      }
    });

    var rest = places.filter(function (p) { return !used[p.id]; }).sort(byWeight);
    while (picked.length < count && rest.length) {
      var next = rest.shift();
      used[next.id] = true;
      picked.push(next);
    }

    var missing = lensIds.filter(function (l) { return covered.indexOf(l) === -1; });
    if (missing.length && count < lensIds.length) {
      warnings.push({ type: 'tooShort', missing: missing, count: count, lenses: lensIds.length });
    } else if (missing.length) {
      warnings.push({ type: 'noData', missing: missing });
    }
    if (picked.length < count) {
      warnings.push({ type: 'thin', got: picked.length, want: count });
    }

    return { stops: picked, warnings: warnings };
  };

  /* ---------- 순서 계산 ---------- */

  function haversine(a, b) {
    if (a.lat == null || b.lat == null) return 0;
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  DT.distanceKm = haversine;

  DT.orderStops = function (stops, mode) {
    var list = stops.slice();
    if (mode === 'walking') {
      // 최근접 이웃. 시작점은 weight 가 가장 높은 곳 (동률이면 가장 이른 시대).
      var remaining = list.slice().sort(byWeight);
      var route = [remaining.shift()];
      while (remaining.length) {
        var last = route[route.length - 1];
        var bestIdx = 0, bestD = Infinity;
        remaining.forEach(function (p, i) {
          var d = haversine(last, p);
          if (d < bestD) { bestD = d; bestIdx = i; }
        });
        route.push(remaining.splice(bestIdx, 1)[0]);
      }
      return route;
    }
    return list.sort(function (a, b) {
      return (a.eraStart || 0) - (b.eraStart || 0);
    });
  };

  /* ---------- 코스 조립 ---------- */

  DT.buildCourse = function (opts) {
    // opts: { areaCode, sigungu, lenses[], days, order }
    return Promise.all([DT.loadLenses(), DT.buildPool(opts.areaCode, opts.lenses)])
      .then(function (res) {
        var lensData = res[0], pool = res[1];
        var duration = DT.durationById(lensData, opts.days);
        var scoped = DT.filterBySigungu(pool.places, opts.sigungu);
        var sel = DT.selectStops(scoped, opts.lenses, duration.stops);
        var ordered = DT.orderStops(sel.stops, opts.order);

        return {
          lensData: lensData,
          duration: duration,
          order: DT.orderById(lensData, opts.order),
          stops: ordered,
          warnings: sel.warnings,
          regionNotes: pool.regionNotes,
          poolSize: scoped.length
        };
      });
  };

  /* ---------- 「이 테마 여행은 ○○에서도 가능합니다」 ----------
   *
   * 전국 순례 페이지를 따로 두지 않는다. 지역을 골라 코스를 다 본 사람에게
   * 코스 끝에서 같은 관점이 가능한 다른 지역을 권하는 방식으로만 확장한다.
   * coverage.json 한 파일만 읽으므로 캐시가 85건이 되어도 비용이 늘지 않는다.
   */
  DT.alsoIn = function (cov, regions, lensIds, currentAreaCode) {
    var avail = (cov && cov.available) || {};
    var out = [];
    Object.keys(avail).forEach(function (a) {
      var code = parseInt(a, 10);
      if (code === currentAreaCode) return;
      var shared = lensIds.filter(function (l) { return avail[a].indexOf(l) !== -1; });
      if (!shared.length) return;
      var sido = null;
      regions.sido.forEach(function (s) { if (s.areaCode === code) sido = s; });
      out.push({
        areaCode: code,
        short: sido ? sido.short : String(code),
        name: sido ? sido.name : String(code),
        lenses: shared
      });
    });
    return out;
  };

  /* ---------- 장소 단건 조회 ---------- */

  DT.findPlace = function (areaCode, placeId) {
    return DT.loadCoverage().then(function (cov) {
      var lenses = (cov && cov.available && cov.available[String(areaCode)]) || [];
      return DT.buildPool(areaCode, lenses).then(function (pool) {
        var hit = null;
        pool.places.forEach(function (p) { if (p.id === placeId) hit = p; });
        return hit;
      });
    });
  };

  /* ---------- 렌더 조각 ---------- */

  DT.badges = function (lensData, lensIds) {
    var m = DT.lensMap(lensData);
    return (lensIds || []).map(function (id) {
      var l = m[id];
      if (!l) return '';
      return '<span class="badge" data-lens="' + DT.esc(id) + '">' + DT.esc(l.label) + '</span>';
    }).join('');
  };

  DT.courseURL = function (o) {
    return 'course.html?area=' + encodeURIComponent(o.areaCode) +
      '&sigungu=' + encodeURIComponent(o.sigungu || '*') +
      '&lens=' + encodeURIComponent((o.lenses || []).join(',')) +
      '&days=' + encodeURIComponent(o.days) +
      '&order=' + encodeURIComponent(o.order);
  };

  DT.placeURL = function (areaCode, placeId, back) {
    var u = 'place.html?area=' + encodeURIComponent(areaCode) + '&id=' + encodeURIComponent(placeId);
    if (back) u += '&back=' + encodeURIComponent(back);
    return u;
  };

  /* ---------- 지도 ---------- */

  DT.drawMap = function (el, stops, opts) {
    opts = opts || {};
    function fallback(msg) {
      el.style.height = 'auto';
      el.innerHTML = '<div class="map-fallback">' + msg + '</div>';
      return null;
    }
    if (!global.L) {
      return fallback('지도를 불러오지 못했습니다. «카카오맵에서 열기» 링크를 이용해 주세요.');
    }
    var pts = stops.filter(function (s) { return s.lat != null && s.lng != null; });
    if (!pts.length) return fallback('좌표 정보가 없습니다.');

    var map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap'
    }).addTo(map);

    var latlngs = [];
    pts.forEach(function (p, i) {
      var ll = [p.lat, p.lng];
      latlngs.push(ll);
      var icon = L.divIcon({
        className: '',
        html: '<div class="dt-marker">' + (opts.numbered === false ? '·' : (i + 1)) + '</div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      L.marker(ll, { icon: icon }).addTo(map)
        .bindPopup('<b>' + DT.esc(p.name) + '</b><br>' + DT.esc(p.sigungu || ''));
    });

    if (opts.line !== false && latlngs.length > 1) {
      L.polyline(latlngs, { color: '#c9a06a', weight: 2, opacity: .6, dashArray: '5,6' }).addTo(map);
    }

    if (latlngs.length === 1) map.setView(latlngs[0], 14);
    else map.fitBounds(L.latLngBounds(latlngs).pad(0.25));

    return map;
  };

  global.DT = DT;
})(window);
