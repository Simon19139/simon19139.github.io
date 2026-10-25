/* 4Dview 主逻辑：输入 -> 实时计算 -> 渲染（DOM 层，依赖 FDVCORE / Lunar / AREA4 / Leaflet） */
(function () {
  'use strict';
  var C = window.FDVCORE, AREA = window.AREA4;
  /* lunar.js 在浏览器 UMD 下把导出逐个挂到 window（window.Lunar 即 Lunar 类），
     在 Node 下则是命名空间（ns.Lunar）。统一成命名空间形态，两种环境都能用。 */
  var LN = window.Lunar;
  if (LN && !LN.Lunar) LN = { Lunar: LN };
  var ORIGINS = {
    yl: { lat: 34.540833, lon: 108.923611, prov: '陕西省', city: '咸阳市', area: '泾阳县', town: '永乐镇', name: '咸阳永乐' },
    gc: { lat: 34.4047, lon: 113.1418, prov: '河南省', city: '郑州市', area: '登封市', town: '告成镇', name: '登封告成' }
  };
  var ORIGIN = ORIGINS.yl;
  var BJ = { lat: 39.9042, lon: 116.4074 };

  var S = {
    calType: 'solar', leap: false,
    y: 1990, m: 6, d: 22, h: 8, mi: 0, gender: 'M',
    birth: { prov: '陕西省', city: '咸阳市', area: '泾阳县', town: '永乐镇', lat: ORIGIN.lat, lon: ORIGIN.lon, src: '默认值（大地原点·咸阳永乐）' },
    home: { prov: '北京市', city: '北京市', area: '东城区', town: '', lat: BJ.lat, lon: BJ.lon, src: '默认值' },
    arm: null, compassScale: 1.3, compassStyle: 0, lastBearing: 0
  };

  var LUNAR_M = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];
  var LUNAR_D = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
    '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
    '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  var WEEK_CN = ['日', '一', '二', '三', '四', '五', '六'];
  var XIU_GONG = {};
  '角亢氐房心尾箕'.split('').forEach(function (x) { XIU_GONG[x] = ['东', '青龙']; });
  '斗牛女虚危室壁'.split('').forEach(function (x) { XIU_GONG[x] = ['北', '玄武']; });
  '奎娄胃昴毕觜参'.split('').forEach(function (x) { XIU_GONG[x] = ['西', '白虎']; });
  '井鬼柳星张翼轸'.split('').forEach(function (x) { XIU_GONG[x] = ['南', '朱雀']; });
  /* 六十甲子太岁大将军（白云观版本） */
  var GZ60 = [];
  (function () {
    var TG = '甲乙丙丁戊己庚辛壬癸'.split(''), DZ = '子丑寅卯辰巳午未申酉戌亥'.split('');
    for (var i = 0; i < 60; i++) GZ60.push(TG[i % 10] + DZ[i % 12]);
  })();
  var TAI_SUI = ['金辨', '陈材', '耿章', '沈兴', '赵达', '郭灿', '王济', '李素', '刘旺', '康志',
    '施广', '任保', '郭嘉', '汪文', '鲁先', '龙仲', '董德', '郑但', '陆明', '魏仁',
    '方杰', '蒋崇', '白敏', '封济', '邹铛', '傅佑', '邬桓', '范宁', '彭泰', '徐单',
    '章词', '杨仙', '管仲', '唐杰', '姜武', '谢太', '卢秘', '杨信', '贺谔', '皮时',
    '李诚', '吴遂', '文哲', '缪丙', '徐浩', '程宝', '倪秘', '叶坚', '丘德', '朱得',
    '张朝', '万清', '辛亚', '杨彦', '黎卿', '傅党', '毛梓', '石政', '洪充', '虞程'];
  /* 十二生肖守护菩萨（本命佛） */
  var GUARD = { '鼠': '千手观音', '牛': '虚空藏菩萨', '虎': '虚空藏菩萨', '兔': '文殊菩萨', '龙': '普贤菩萨', '蛇': '普贤菩萨', '马': '大势至菩萨', '羊': '大日如来', '猴': '大日如来', '鸡': '不动尊菩萨', '狗': '阿弥陀佛', '猪': '阿弥陀佛' };

  function $(id) { return document.getElementById(id); }
  function txt(id, s) { var e = $(id); if (e) e.textContent = s; }
  function html(id, s) { var e = $(id); if (e) e.innerHTML = s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return ('0' + n).slice(-2); }

  /* ================= 输入构建 ================= */
  function fill(sel, arr, cur) {
    sel.innerHTML = arr.map(function (v) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v) + '</option>'; }).join('');
  }
  function fillNum(sel, from, to, cur, names) {
    var h = '';
    for (var i = from; i <= to; i++) h += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + (names ? names[i - from] : i) + '</option>';
    sel.innerHTML = h;
  }
  function daysInSolarMonth(y, m) { return [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]; }

  function rebuildDateInputs() {
    var lunar = S.calType === 'lunar';
    $('leapWrap').style.display = lunar ? '' : 'none';
    $('mlabel').textContent = lunar ? '月(农)' : '月';
    $('dlabel').textContent = lunar ? '日(农)' : '日';
    if (lunar) {
      fillNum($('inM'), 1, 12, S.m, LUNAR_M);
      fillNum($('inD'), 1, 30, S.d, LUNAR_D);
    } else {
      fillNum($('inM'), 1, 12, S.m);
      fillNum($('inD'), 1, daysInSolarMonth(S.y, S.m), Math.min(S.d, daysInSolarMonth(S.y, S.m)));
    }
  }

  /* ================= 级联 ================= */
  function setOverseasUI(prefix, on) {
    ['City', 'Area', 'Town'].forEach(function (k) { $(prefix + k).style.display = on ? 'none' : ''; });
    $(prefix + 'Country').style.display = on ? '' : 'none';
    $(prefix + 'CityTxt').style.display = on ? '' : 'none';
  }
  function cascInit(prefix, st) {
    var p = $(prefix + 'Prov'), c = $(prefix + 'City'), a = $(prefix + 'Area'), t = $(prefix + 'Town');
    if (!AREA) {
      [p, c, a, t].forEach(function (s) { s.innerHTML = '<option value="">（区划数据未加载）</option>'; s.disabled = true; });
      st.src = '区划数据未加载：请地图点选或手填坐标'; renderLocBadges();
      return;
    }
    p.disabled = c.disabled = a.disabled = t.disabled = false;
    // 存档/导入的国外地名：归位到国外模式
    if (st.prov && st.prov !== 'OVERSEAS' && Object.keys(AREA).indexOf(st.prov) < 0) {
      st.country = st.country || st.prov;
      st.cityTxt = st.cityTxt || st.city || '';
      st.prov = 'OVERSEAS';
    }
    fill(p, Object.keys(AREA), st.prov === 'OVERSEAS' ? '' : st.prov);
    var op = document.createElement('option');
    op.value = 'OVERSEAS'; op.textContent = '🌏 国外城市…';
    if (st.prov === 'OVERSEAS') op.selected = true;
    p.appendChild(op);
    function rebuildCity() {
      var cities = Object.keys(AREA[p.value] || {});
      if (cities.indexOf(st.city) < 0) st.city = cities[0] || '';
      fill(c, cities, st.city); rebuildArea();
    }
    function rebuildArea() {
      var areas = Object.keys((AREA[p.value] || {})[c.value] || {});
      if (areas.indexOf(st.area) < 0) st.area = areas[0] || '';
      fill(a, areas, st.area); rebuildTown();
    }
    function rebuildTown() {
      var towns = (((AREA[p.value] || {})[c.value] || {})[a.value]) || [];
      if (towns.indexOf(st.town) < 0) st.town = towns[0] || '';
      fill(t, towns, st.town);
    }
    p.onchange = function () {
      st.prov = p.value;
      if (st.prov === 'OVERSEAS') {
        st.country = ''; st.cityTxt = ''; st.city = ''; st.area = ''; st.town = '';
        cascInit(prefix, st);
        st.src = '国外：请输入国家与城市'; renderLocBadges(); recompute();
        return;
      }
      st.country = ''; st.cityTxt = '';
      rebuildCity(); afterCasc(prefix, st);
    };
    c.onchange = function () { st.city = c.value; rebuildArea(); afterCasc(prefix, st); };
    a.onchange = function () { st.area = a.value; rebuildTown(); afterCasc(prefix, st); };
    t.onchange = function () { st.town = t.value; afterCasc(prefix, st); };
    if (st.prov === 'OVERSEAS') {
      setOverseasUI(prefix, true);
      $(prefix + 'Country').value = st.country || '';
      $(prefix + 'CityTxt').value = st.cityTxt || '';
      c.innerHTML = a.innerHTML = t.innerHTML = '';
      return;
    }
    setOverseasUI(prefix, false);
    rebuildCity();
  }

  var geoTimer = { b: null, h: null };
  function afterCasc(prefix, st) {
    st.src = '定位中…'; renderLocBadges();
    recompute();  // 先用现有坐标刷新，坐标回来后再次刷新
    var key = prefix === 'b' ? 'b' : 'h';
    clearTimeout(geoTimer[key]);
    geoTimer[key] = setTimeout(function () { geocodeCascade(st, prefix); }, 700);
  }

  /* 地理编码：多通道兜底（Nominatim -> Photon），查询词乡镇级 -> 区县级；全失败引导地图点选/手填 */
  function timedFetch(url, ms) {
    ms = ms || 8000;
    if (!window.AbortController) return fetch(url);
    var ctl = new AbortController();
    var t = setTimeout(function () { try { ctl.abort(); } catch (e) {} }, ms);
    return fetch(url, { signal: ctl.signal }).then(
      function (r) { clearTimeout(t); return r; },
      function (e) { clearTimeout(t); throw e; });
  }
  function geocodeCascade(st, prefix) {
    if (!window.fetch) { st.src = '当前浏览器不支持在线定位：请点「地图选点」或手填经纬度'; renderLocBadges(); return; }
    var queries = [
      [st.prov, st.city, st.area, st.town].filter(Boolean).join(' '),
      [st.prov, st.city, st.area].filter(Boolean).join(' ')
    ];
    var sources = [
      function (q) {
        return timedFetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-CN&q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (arr) { if (arr && arr.length) return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) }; throw new Error('empty'); });
      },
      function (q) {
        return timedFetch('https://photon.komoot.io/api/?limit=1&lang=zh&q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var f = j && j.features && j.features[0];
            if (f && f.geometry) return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
            throw new Error('empty');
          });
      }
    ];
    var chain = [];
    queries.forEach(function (q) { sources.forEach(function (s) { chain.push(function () { return s(q); }); }); });
    var i = 0;
    function attempt() {
      if (i >= chain.length) { st.src = '在线定位失败：请点「地图选点」按钮在地图上点取，或直接手填经纬度'; renderLocBadges(); return; }
      var fn = chain[i++];
      fn().then(function (pos) {
        st.lat = pos.lat; st.lon = pos.lon; st.src = '级联定位（在线）';
        syncLocInputs(prefix, st); renderLocBadges(); recompute(); panTo(prefix, st);
      }).catch(function () { attempt(); });
    }
    attempt();
  }

  function ovrDeb(prefix, st) {
    st.src = '国外城市'; renderLocBadges();
    clearTimeout(st._gt);
    st._gt = setTimeout(function () { geocodeOverseas(st, prefix); }, 800);
    saveLocal();
  }

  /* 国外城市前向定位：查询词=城市+国家，成功跳转视野（GCJ 境外自动不偏移） */
  function geocodeOverseas(st, prefix) {
    var q = [st.cityTxt, st.country].filter(Boolean).join(' ').trim();
    if (!q) { st.src = '国外：请输入国家与城市'; renderLocBadges(); return; }
    if (!window.fetch) { st.src = '当前浏览器不支持在线定位：请地图点选或手填经纬度'; renderLocBadges(); return; }
    st.src = '定位中…'; renderLocBadges();
    var sources = [
      function () {
        return timedFetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=zh-CN&q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (arr) { if (arr && arr.length) return { lat: parseFloat(arr[0].lat), lon: parseFloat(arr[0].lon) }; throw new Error('empty'); });
      },
      function () {
        return timedFetch('https://photon.komoot.io/api/?limit=1&q=' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var f = j && j.features && j.features[0];
            if (f && f.geometry) return { lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
            throw new Error('empty');
          });
      }
    ];
    var i = 0, q0 = q;
    function attempt() {
      if (i >= sources.length) { st.src = '在线定位失败：请点「地图选点」在地图上点取，或手填经纬度'; renderLocBadges(); return; }
      var fn = sources[i++];
      fn().then(function (pos) {
        if ([st.cityTxt, st.country].filter(Boolean).join(' ').trim() !== q0) return; // 输入已变，丢弃过期结果
        st.lat = pos.lat; st.lon = pos.lon; st.src = '国外城市定位（在线）';
        syncLocInputs(prefix, st); renderLocBadges(); recompute();
        if (map && window.L) { var gc = C.wgs2gcj(st.lat, st.lon); map.setView([gc[0], gc[1]], 10); }
      }).catch(function () { attempt(); });
    }
    attempt();
  }

  function syncLocInputs(prefix, st) {
    $(prefix + 'Lat').value = st.lat.toFixed(6);
    $(prefix + 'Lon').value = st.lon.toFixed(6);
  }
  function renderLocBadges() {
    txt('bSrc', S.birth.src); txt('hSrc', S.home.src);
  }

  /* ================= 地名反查（点选坐标 -> 回填省市区镇） ================= */
  function normName(s) { return String(s || '').replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|自治州|自治县|地区|盟|省|市|县|区|旗|林区)$/g, ''); }
  function bestKey(list, name) {
    if (!name) return null;
    var nn = normName(name), i, ln;
    for (i = 0; i < list.length; i++) if (list[i] === name) return list[i];
    for (i = 0; i < list.length; i++) if (normName(list[i]) === nn) return list[i];
    for (i = 0; i < list.length; i++) { ln = normName(list[i]); if (nn && (ln.indexOf(nn) >= 0 || nn.indexOf(ln) >= 0)) return list[i]; }
    return null;
  }
  function fillCascadeNames(st, prefix, names) {
    if (names.overseas) {
      st.prov = 'OVERSEAS';
      st.country = names.country || '';
      st.cityTxt = names.city || names.area || '';
      st.city = ''; st.area = ''; st.town = '';
      cascInit(prefix, st);
      return true;
    }
    if (!AREA) return false;
    var p = bestKey(Object.keys(AREA), names.prov);
    if (!p) return false;
    var cities = Object.keys(AREA[p] || {});
    var c = bestKey(cities, names.city) || cities[0] || '';
    var areas = Object.keys((AREA[p] || {})[c] || {});
    var a = bestKey(areas, names.area) || (areas.indexOf(st.area) >= 0 ? st.area : areas[0] || '');
    var towns = (((AREA[p] || {})[c] || {})[a]) || [];
    var t = bestKey(towns, names.town) || '';
    st.prov = p; st.city = c; st.area = a; st.town = t;
    cascInit(prefix, st);
    return true;
  }
  /* 中国香港/澳门/台湾省是中国特别行政区，反查时按国内处理，不得判为国外 */
  var SAR_CC = { HK: '香港特别行政区', MO: '澳门特别行政区', TW: '台湾省' };
  function sarProv(cc) { return SAR_CC[String(cc || '').toUpperCase()] || ''; }
  function reverseFill(prefix, st) {
    if (!window.fetch) return;
    var lat = st.lat, lon = st.lon;
    // BigDataCloud（免 key、国内可达）-> Nominatim -> Photon
    function viaBDC() {
      return timedFetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat + '&longitude=' + lon + '&localityLanguage=zh')
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var adm = (j.localityInfo && j.localityInfo.administrative) || [];
          function lv(n) { for (var i = adm.length - 1; i >= 0; i--) if (adm[i].adminLevel === n) return adm[i].name; return ''; }
          var sar = sarProv(j.countryCode);
          var out = {
            prov: sar || j.principalSubdivision || lv(4),
            city: j.city || lv(6) || lv(5),
            area: j.locality || lv(8) || lv(7),
            town: lv(9) || lv(10),
            country: sar ? '中国' : (j.countryName || ''),
            overseas: !!(j.countryCode && j.countryCode !== 'CN' && !sar)
          };
          if (!out.prov && !out.city) throw new Error('empty');
          return out;
        });
    }
    function viaNominatim() {
      return timedFetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&accept-language=zh-CN&lat=' + lat + '&lon=' + lon)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var a = j && j.address; if (!a) throw new Error('empty');
          var sar = sarProv(a.country_code);
          return { prov: sar || a.province || a.state || '', city: a.city || a.town || a.county || '', area: a.county || a.district || a.suburb || '', town: a.town || a.village || a.suburb || '',
            country: sar ? '中国' : (a.country || ''), overseas: !!(a.country_code && String(a.country_code).toLowerCase() !== 'cn' && !sar) };
        });
    }
    function viaPhoton() {
      return timedFetch('https://photon.komoot.io/reverse?lat=' + lat + '&lon=' + lon)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var f = j && j.features && j.features[0];
          var p = f && f.properties; if (!p) throw new Error('empty');
          var sar = sarProv(p.countrycode);
          return { prov: sar || p.state || '', city: p.city || p.county || '', area: p.district || p.county || '', town: p.name || '',
            country: sar ? '中国' : (p.country || ''), overseas: !!(p.countrycode && p.countrycode !== 'CN' && !sar) };
        });
    }
    viaBDC().catch(function () { return viaNominatim(); }).catch(function () { return viaPhoton(); }).then(function (names) {
      if (Math.abs(st.lat - lat) > 1e-9 || Math.abs(st.lon - lon) > 1e-9) return; // 坐标已被再次修改，丢弃过期结果
      if (fillCascadeNames(st, prefix, names)) {
        st.src = '地图点选＋地名反查';
        renderLocBadges(); recompute();
      } else {
        st.src = '地图点选（地名反查未匹配，可手选行政区）'; renderLocBadges();
      }
    }).catch(function () {
      if (Math.abs(st.lat - lat) > 1e-9 || Math.abs(st.lon - lon) > 1e-9) return;
      st.src = '地图点选（地名反查不可用，可手选行政区）'; renderLocBadges();
    });
  }

  /* ================= 地图 ================= */
  var map, mkB, mkH, line, brgTag, layers = {}, hintTimer = null;
  function gcj(st) { var g = C.wgs2gcj(st.lat, st.lon); return [g[0], g[1]]; }
  function mkIcon(color, label) {
    return L.divIcon({
      className: 'pt', html: '<div style="width:16px;height:16px;border-radius:50%;background:' + color +
        ';border:2.5px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.6)"></div><div class="ptlb" style="background:' + color + '">' + label + '</div>',
      iconSize: [16, 16], iconAnchor: [8, 8]
    });
  }
  function toggleFs() {
    var mw = $('mapwrap');
    var on = !mw.classList.contains('fs');
    mw.classList.toggle('fs', on);
    txt('fsBtn', on ? '✕ 还原' : '⤢ 放大');
    document.body.style.overflow = on ? 'hidden' : '';
    if (map) setTimeout(function () { map.invalidateSize(); positionCompass(); }, 80);
  }
  function initMap() {
    if (map) return;
    if (!window.L) {
      var mw = $('mapwrap');
      if (mw && !$('mapFail')) {
        var d = document.createElement('div');
        d.id = 'mapFail';
        d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;color:#d4b36a;background:rgba(10,14,30,.9);z-index:500;font-size:14px;line-height:1.8;';
        d.textContent = '地图组件未加载成功，请刷新重试；其余功能不受影响。';
        mw.appendChild(d);
      }
      return;
    }
    layers.vec = L.tileLayer('https://webrst0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], maxZoom: 18, attribution: '© 高德地图' });
    // 矢量瓦片取流失败时自动降级：备用高德源 -> OSM
    var VEC_B = 'https://wprd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=7&x={x}&y={y}&z={z}';
    var vecErr = 0;
    layers.vec.on('tileerror', function () {
      vecErr++;
      if (vecErr === 10) layers.vec.setUrl(VEC_B);
      if (vecErr === 30) { var b = $('layerOsm'); if (b) b.click(); }
    });
    layers.sat = L.tileLayer('https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}', { subdomains: ['1', '2', '3', '4'], maxZoom: 18, attribution: '© 高德影像' });
    layers.osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap（未纠偏，可能偏移）' });
    // OSM 官方源不通时自动降级：osm.fr HOT -> CartoCDN -> osm.de -> 提示
    var OSM_B1 = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
    var OSM_B2 = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
    var OSM_B3 = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';
    var osmErr = 0;
    layers.osm.on('tileerror', function () {
      osmErr++;
      if (osmErr === 10) layers.osm.setUrl(OSM_B1);
      if (osmErr === 20) layers.osm.setUrl(OSM_B2);
      if (osmErr === 30) layers.osm.setUrl(OSM_B3);
      if (osmErr === 40) {
        var mw = $('mapwrap');
        if (mw && !$('osmFail')) {
          var d = document.createElement('div');
          d.id = 'osmFail';
          d.style.cssText = 'position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 14px;color:#d4b36a;background:rgba(10,14,30,.92);z-index:600;font-size:12px;border:1px solid rgba(212,179,106,.4);border-radius:6px;';
          d.textContent = 'OSM 瓦片源在你当前网络不可达，请改用「矢量」或「影像」';
          mw.appendChild(d);
        }
      }
    });
    map = L.map('map', { center: [34.5, 109.5], zoom: 5, layers: [layers.vec], zoomControl: true, attributionControl: true });
    mkB = L.marker(gcj(S.birth), { icon: mkIcon('#d4b36a', '出生'), draggable: true }).addTo(map);
    mkH = L.marker(gcj(S.home), { icon: mkIcon('#6ac8d4', '常居'), draggable: true }).addTo(map);
    line = L.polyline([gcj(S.birth), gcj(S.home)], { color: '#d4b36a', weight: 2, dashArray: '6 6' }).addTo(map);
    brgTag = L.marker(gcj(S.home), { icon: L.divIcon({ className: 'brgTag', html: '' }), interactive: false }).addTo(map);
    mkB.on('dragend', function () { onPick('b', mkB.getLatLng()); });
    mkH.on('dragend', function () { onPick('h', mkH.getLatLng()); });
    map.on('click', function (e) {
      if (S.arm) { onPick(S.arm, e.latlng); return; }
      txt('armTip', '请先在左侧点「🗺 地图选点」按钮，再点击地图');
      $('armTip').style.display = '';
      clearTimeout(hintTimer);
      hintTimer = setTimeout(function () { if (!S.arm) $('armTip').style.display = 'none'; }, 2600);
    });
    map.on('move zoom resize', positionCompass);
    ['layerVec', 'layerSat', 'layerOsm'].forEach(function (id, i) {
      $(id).onclick = function () {
        ['vec', 'sat', 'osm'].forEach(function (k) { map.removeLayer(layers[k]); });
        map.addLayer(layers[['vec', 'sat', 'osm'][i]]);
        ['layerVec', 'layerSat', 'layerOsm'].forEach(function (x, j) { $(x).classList.toggle('on', i === j); });
        if (i !== 2) { var of = $('osmFail'); if (of) of.remove(); }
      };
    });
    $('bArm').onclick = function () { setArm(S.arm === 'b' ? null : 'b'); };
    $('hArm').onclick = function () { setArm(S.arm === 'h' ? null : 'h'); };
    fitBoth();
  }
  function setArm(v) {
    S.arm = v;
    $('bArm').classList.toggle('on', v === 'b');
    $('hArm').classList.toggle('on', v === 'h');
    $('map').style.cursor = v ? 'crosshair' : '';
    txt('armTip', v === 'b' ? '点击地图设置出生地点' : v === 'h' ? '点击地图设置现常居地' : '');
    $('armTip').style.display = v ? '' : 'none';
  }
  function onPick(prefix, latlng) {
    var w = C.gcj2wgs(latlng.lat, latlng.lng);
    var st = prefix === 'b' ? S.birth : S.home;
    st.lat = w[0]; st.lon = w[1]; st.src = '地图点选';
    syncLocInputs(prefix, st); renderLocBadges();
    if (S.arm) setArm(null);
    recompute();
    reverseFill(prefix, st);
  }
  function panTo(prefix, st) {
    if (!map) return;
    map.setView(gcj(st), Math.max(map.getZoom(), 10), { animate: true });
  }
  function fitBoth() {
    if (!map) return;
    var b = L.latLngBounds([gcj(S.birth), gcj(S.home)]);
    map.fitBounds(b.pad(0.35));
  }

  /* ================= 二十四山罗盘（三样式） ================= */
  var compassG;
  /* 三套配色：鎏金（暗底金纹）/ 水墨（宣纸墨线）/ 五行（八卦分色） */
  var COMPASS_STYLES = [
    { bg: 'rgba(10,14,30,.86)', ring: '#d4b36a', gua: 'rgba(232,228,216,.55)', shan: '#d4b36a', shanM: '#f0d9a0', tick: 'rgba(212,179,106,.5)', north: '#e05c5c', arrow: '#e05c5c', arrowDim: 'rgba(224,92,92,.45)', center: '#d4b36a' },
    { bg: 'rgba(243,238,226,.94)', ring: '#3a3a3a', gua: 'rgba(40,40,40,.72)', shan: '#4a4a4a', shanM: '#8b1a1a', tick: 'rgba(58,58,58,.55)', north: '#8b1a1a', arrow: '#8b1a1a', arrowDim: 'rgba(139,26,26,.45)', center: '#3a3a3a' },
    { bg: 'rgba(10,14,30,.88)', ring: '#c8c0a8', gua: 'rgba(232,228,216,.75)', shan: '#e8e4d8', shanM: '#ffffff', tick: 'rgba(200,192,168,.45)', north: '#ff6b5e', arrow: '#ff6b5e', arrowDim: 'rgba(255,107,94,.45)', center: '#c8c0a8' }
  ];
  /* 八卦五行扇面色（仅"五行"样式启用）：坎水 艮土 震木 巽木 离火 坤土 兑金 乾金
     色相采用命理八字模块的五行字体色：木#A8D5A2 火#E8A5A5 土#F5E6A3 金#B8A5D6 水#A5C8E8 */
  var GUA5X = ['rgba(165,200,232,.55)', 'rgba(245,230,163,.55)', 'rgba(168,213,162,.55)', 'rgba(168,213,162,.55)', 'rgba(232,165,165,.55)', 'rgba(245,230,163,.55)', 'rgba(184,165,214,.55)', 'rgba(184,165,214,.55)'];
  var GUA8 = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];
  function pt(r, aDeg) { var a = aDeg * Math.PI / 180; return [150 + r * Math.sin(a), 150 - r * Math.cos(a)]; }
  function buildCompass() {
    var pal = COMPASS_STYLES[S.compassStyle] || COMPASS_STYLES[0];
    var h = '';
    h += '<circle cx="150" cy="150" r="148" fill="' + pal.bg + '" stroke="' + pal.ring + '" stroke-width="2"/>';
    // 8宫扇面
    for (var g = 0; g < 8; g++) {
      var a1 = g * 45 - 22.5, a2 = g * 45 + 22.5;
      var p1 = pt(146, a1), p2 = pt(146, a2);
      var secFill = S.compassStyle === 2 ? GUA5X[g] : (g % 2 ? 'rgba(212,179,106,.10)' : (S.compassStyle === 1 ? 'rgba(58,58,58,.07)' : 'rgba(139,126,200,.10)'));
      if (S.compassStyle === 1) secFill = (g % 2 ? 'rgba(58,58,58,.11)' : 'rgba(58,58,58,.05)');
      h += '<path d="M150 150 L' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + ' A146 146 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1) + ' Z" fill="' + secFill + '"/>';
      var gp = pt(108, g * 45);
      h += '<text x="' + gp[0] + '" y="' + gp[1] + '" class="cgua" style="fill:' + pal.gua + '" transform="rotate(' + (g * 45) + ' ' + gp[0] + ' ' + gp[1] + ')">' + GUA8[g] + '</text>';
    }
    // 水墨样式：各宫内三个山向之间用虚线区隔
    if (S.compassStyle === 1) {
      for (var dg = 0; dg < 8; dg++) {
        [-7.5, 7.5].forEach(function (off) {
          var q1 = pt(84, dg * 45 + off), q2 = pt(146, dg * 45 + off);
          h += '<line x1="' + q1[0].toFixed(1) + '" y1="' + q1[1].toFixed(1) + '" x2="' + q2[0].toFixed(1) + '" y2="' + q2[1].toFixed(1) + '" stroke="' + pal.tick + '" stroke-width="1" stroke-dasharray="3 3"/>';
        });
      }
    }
    // 24山
    for (var i = 0; i < 24; i++) {
      var a = i * 15;
      var t1 = pt(146, a - 7.5), t2 = pt(132, a - 7.5);
      h += '<line x1="' + t1[0].toFixed(1) + '" y1="' + t1[1].toFixed(1) + '" x2="' + t2[0].toFixed(1) + '" y2="' + t2[1].toFixed(1) + '" stroke="' + pal.tick + '" stroke-width="1"/>';
      var lp = pt(139, a);
      var major = (a % 45 === 0);
      h += '<text x="' + lp[0] + '" y="' + lp[1] + '" class="cshan' + (major ? ' cm' : '') + '" style="fill:' + (major ? pal.shanM : pal.shan) + '" transform="rotate(' + a + ' ' + lp[0] + ' ' + lp[1] + ')">' + C.SHAN24[i] + '</text>';
    }
    // 中心
    h += '<circle cx="150" cy="150" r="4" fill="' + pal.center + '"/>';
    h += '<text x="150" y="30" class="cn" style="fill:' + pal.north + '">北</text>';
    // 方位指针（旋转组）
    h += '<g id="cArrow" transform="rotate(0 150 150)">' +
      '<polygon points="150,52 156,84 150,78 144,84" fill="' + pal.arrow + '" stroke="#fff" stroke-width="1"/>' +
      '<line x1="150" y1="150" x2="150" y2="86" stroke="' + pal.arrow + '" stroke-width="2.5"/>' +
      '<line x1="150" y1="150" x2="150" y2="196" stroke="' + pal.arrowDim + '" stroke-width="2" stroke-dasharray="4 4"/>' +
      '</g>';
    $('compassSvg').innerHTML = h;
    compassG = $('compassSvg');
    applyCompassScale();
    positionCompass();
    // 重建后恢复指针角度
    var arrow = $('cArrow');
    if (arrow) arrow.setAttribute('transform', 'rotate(' + (S.lastBearing || 0).toFixed(2) + ' 150 150)');
    // 样式按钮高亮
    [0, 1, 2].forEach(function (i) { var b = $('csStyle' + i); if (b) b.classList.toggle('on', i === S.compassStyle); });
  }
  function applyCompassScale() {
    var px = Math.round(300 * S.compassScale);
    compassG.style.width = px + 'px'; compassG.style.height = px + 'px';
  }
  function positionCompass() {
    if (!map || !compassG) return;
    var p = map.latLngToContainerPoint(L.latLng(gcj(S.birth)[0], gcj(S.birth)[1]));
    var box = $('compass');
    box.style.left = p.x + 'px'; box.style.top = p.y + 'px';
  }

  /* ================= 主计算 ================= */
  function errLine(msg) { txt('errLine', msg); $('errLine').style.display = msg ? '' : 'none'; }

  function inputToSolarMs() {
    // 返回 {ms, err}：墙钟(官方时钟)的 UTC-ms 表示
    if (S.calType === 'solar') {
      var dim = daysInSolarMonth(S.y, S.m);
      if (S.d < 1 || S.d > dim) return { err: '公历日期无效' };
      return { ms: Date.UTC(S.y, S.m - 1, S.d, S.h, S.mi) };
    }
    try {
      var lunar = LN.Lunar.fromYmd(S.y, S.leap ? -S.m : S.m, S.d);
      var so = lunar.getSolar();
      return { ms: Date.UTC(so.getYear(), so.getMonth() - 1, so.getDay(), S.h, S.mi) };
    } catch (e) {
      return { err: '农历日期无效（该年可能无此月/日，或超出 1900-2099 范围）' };
    }
  }

  function lunarAt(msUtc) {
    var p = C.parts(msUtc);
    return LN.Lunar.fromDate(new Date(p[0], p[1] - 1, p[2], p[3], p[4]));
  }

  function festNames(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      out.push(typeof f.getName === 'function' ? f.getName() : String(f));
    }
    return out;
  }

  function recompute() {
    errLine('');
    try {
      var r = inputToSolarMs();
      if (r.err) { errLine(r.err); return; }
      // 1. 夏令时还原
      var sp = C.parts(r.ms);
      var std = C.toStandard(sp[0], sp[1], sp[2], sp[3], sp[4]);
      // 2. 真太阳时
      var ts = C.trueSolar(std.ms, S.birth.lon);
      var tp = ts.parts;
      // 3. 历法（以真太阳时为准）
      var l = lunarAt(ts.ms);
      var foto = l.getFoto(), tao = l.getTao();
      // 4. 日出日落（输入日、出生地）
      var sun = C.sunriseSunset(sp[0], sp[1], sp[2], S.birth.lat, S.birth.lon);
      // 5. 命卦（立春归属按真太阳时）
      var ly = C.lichunYear(LN.Lunar, ts.ms);
      var mg = C.mingGua(ly, S.gender);
      // 6. 山向
      var bearing = C.bearing(S.birth.lat, S.birth.lon, S.home.lat, S.home.lon);
      var shan = C.shanOf(bearing);
      var km = C.distKm(S.birth.lat, S.birth.lon, S.home.lat, S.home.lon);
      S.lastBearing = bearing;

      /* ---- 渲染：时空历法 ---- */
      txt('oTstBig', C.fmtMs(ts.ms));
      txt('oTstShichen', C.shichenOf(ts.minutes) + '时');
      html('oDst', std.dst ? '<span class="badge warn">夏令时：官方时钟已 -1 小时还原</span>' : '<span class="badge">无夏令时</span>');
      txt('oStd', C.fmtMs(std.ms));
      txt('oCorr', '经度修正 ' + (ts.lonCorr >= 0 ? '+' : '') + ts.lonCorr.toFixed(1) + ' 分 · 均时差 ' + (ts.eot >= 0 ? '+' : '') + ts.eot.toFixed(1) + ' 分');
      txt('oSolar', tp[0] + ' 年 ' + tp[1] + ' 月 ' + tp[2] + ' 日（真太阳时）');
      txt('oWeek', '星期' + WEEK_CN[new Date(tp[0], tp[1] - 1, tp[2]).getDay()]);
      txt('oLunar', l.getYearInChinese() + ' 年 ' + l.getMonthInChinese() + ' 月 ' + l.getDayInChinese() + ' · 生肖' + l.getYearShengXiaoExact());
      /* 本命星宿（宿曜二十七宿，按农历生日）+ 当日值日星宿（二十八宿轮值），归道历行 */
      try {
        var fx = foto.getXiu(), xg = XIU_GONG[fx];
        txt('oXiuDay', fx + '宿（' + foto.getZheng() + foto.getAnimal() + (xg ? ' · ' + xg[0] + '方' + xg[1] : '') + ' · ' + foto.getXiuLuck() + '）');
      } catch (e) { txt('oXiuDay', ''); }
      try {
        txt('oXiuDuty', l.getXiu() + '宿（' + l.getZheng() + l.getAnimal() + ' · ' + l.getGong() + '方' + l.getShou() + ' · ' + l.getXiuLuck() + '）');
      } catch (e) { txt('oXiuDuty', ''); }
      /* 本命太岁（六十甲子太岁大将军，按出生年干支） */
      try {
        var ygz = l.getYearInGanZhiExact(), ti = GZ60.indexOf(ygz);
        txt('oTaiSui', ti >= 0 ? TAI_SUI[ti] + '大将军（' + ygz + '太岁）' : '—');
      } catch (e) { txt('oTaiSui', ''); }
      txt('oGanzhi', l.getYearInGanZhiExact() + '年 ' + l.getMonthInGanZhiExact() + '月 ' + l.getDayInGanZhiExact() + '日 ' + l.getTimeInGanZhi() + '时');
      txt('oYuejian', '月建 ' + l.getMonthInGanZhiExact());
      var todayJq = l.getJieQi();
      txt('oJieqiToday', todayJq ? '今日交 ' + todayJq : '—');
      var pj = l.getPrevJieQi(), nj = l.getNextJieQi();
      txt('oJieqiPrev', pj.getName() + ' ' + pj.getSolar().toYmdHms());
      txt('oJieqiNext', nj.getName() + ' ' + nj.getSolar().toYmdHms());
      if (sun.note) {
        txt('oSun', sun.note);
      } else {
        var dmin = ts.lonCorr + ts.eot;
        txt('oSun', '日出 ' + C.fmtMin(sun.sunrise) + ' · 日落 ' + C.fmtMin(sun.sunset) + '（北京时）');
        txt('oSunTst', '≈ 当地真太阳时：日出 ' + C.fmtMin(sun.sunrise + dmin) + ' · 日落 ' + C.fmtMin(sun.sunset + dmin));
      }
      txt('oYi', l.getDayYi().join('　'));
      txt('oJi', l.getDayJi().join('　'));
      txt('oChong', '冲' + l.getDayChongDesc() + ' · 煞' + l.getDaySha());
      txt('oZhishen', l.getDayTianShen() + '（' + l.getDayTianShenType() + '·' + l.getDayTianShenLuck() + '）');
      txt('oPengzu', l.getPengZuGan() + '；' + l.getPengZuZhi());
      txt('oXishen', '喜神 ' + l.getDayPositionXiDesc() + ' · 财神 ' + l.getDayPositionCaiDesc() + ' · 阳贵 ' + l.getDayPositionYangGuiDesc());
      txt('oTaishen', l.getDayPositionTai());

      /* 佛历 */
      txt('oFoto', '佛历 ' + foto.getYearInChinese() + ' 年 ' + foto.getMonthInChinese() + ' 月 ' + foto.getDayInChinese() + '（' + foto.getYear() + '）');
      var ff = festNames(foto.getFestivals());
      txt('oFotoFest', ff.length ? ff.join(' · ') : '—');
      var zhai = [];
      try {
        if (foto.isDayZhaiTen()) zhai.push('十斋日');
        if (foto.isDayZhaiSix()) zhai.push('六斋日');
        if (foto.isDayZhaiShuoWang()) zhai.push('朔望斋');
        if (foto.isDayZhaiGuanYin()) zhai.push('观音斋');
        if (foto.isMonthZhai()) zhai.push('斋月');
      } catch (e) {}
      txt('oFotoZhai', zhai.length ? zhai.join(' · ') : '—');
      var sx = l.getYearShengXiaoExact();
      txt('oFotoGuard', GUARD[sx] ? GUARD[sx] + '（' + sx + '年本命佛）' : '—');

      /* 道历 */
      txt('oTao', '道历 ' + tao.getYearInChinese() + ' 年（' + tao.getYear() + '）' + l.getMonthInChinese() + '月' + l.getDayInChinese());
      var tf = festNames(tao.getFestivals());
      txt('oTaoFest', tf.length ? tf.join(' · ') : '—');
      var tm = [];
      try {
        if (tao.isDaySanYuan()) tm.push('三元');
        if (tao.isDaySanHui()) tm.push('三会');
        if (tao.isDayBaJie()) tm.push('八节');
        if (tao.isDayWuLa()) tm.push('五腊');
        if (tao.isDayBaHui()) tm.push('八会');
        if (tao.isDayTianShe()) tm.push('天赦日');
        if (tao.isDayMingWu()) tm.push('明戊');
        if (tao.isDayAnWu()) tm.push('暗戊');
      } catch (e) {}
      txt('oTaoMark', tm.length ? tm.join(' · ') : '—');

      /* ---- 宅命 ---- */
      html('oMgGua', '<b class="gold big">' + mg.gua + '命</b>（' + mg.num + ' ' + mg.gua + '）');
      txt('oMgGroup', mg.group + ' · 立春归属 ' + ly + ' 年');
      var rows = '';
      mg.dirs.forEach(function (x) {
        rows += '<tr class="' + (x.ji ? 'ji' : 'xiong') + '"><td>' + x.luck + '</td><td>' + x.gong + '</td><td>' + x.dir + '</td><td>' + x.deg + '°</td><td>' + (x.ji ? '吉' : '凶') + '</td></tr>';
      });
      html('mgDirs', rows);

      /* ---- 山向（常居地相对出生地的朝向） ---- */
      txt('oBearing', bearing.toFixed(2) + '°');
      html('oShan', '<b class="gold big">' + shan.shan + '向</b>（' + shan.gong + '宫）');
      txt('oDist', '约 ' + km.toFixed(1) + ' km（大圆距离）');
      txt('oCoords', '出生地 ' + S.birth.lat.toFixed(5) + ',' + S.birth.lon.toFixed(5) + ' → 常居地 ' + S.home.lat.toFixed(5) + ',' + S.home.lon.toFixed(5));

      /* ---- 地图 ---- */
      if (map && mkB && mkH && line) {
        mkB.setLatLng(gcj(S.birth));
        mkH.setLatLng(gcj(S.home));
        line.setLatLngs([gcj(S.birth), gcj(S.home)]);
        if (brgTag) {
          brgTag.setLatLng(gcj(S.home));
          brgTag.setIcon(L.divIcon({ className: 'brgTag', html: '<div class="brgBox">' + bearing.toFixed(1) + '&deg; · ' + shan.shan + '向（' + shan.gong + '宫）</div>' }));
        }
        var arrow = $('cArrow');
        if (arrow) arrow.setAttribute('transform', 'rotate(' + bearing.toFixed(2) + ' 150 150)');
        positionCompass();
      }
      saveLocal();
    } catch (e) { errLine('计算异常：' + (e && e.message ? e.message : e) + '（请刷新重试；若持续出现，可能是部分资源未加载完整）'); }
  }

  /* ================= 存档：自动暂存 + 多档案下拉 + xls 导入导出 ================= */
  var LS_KEY = '4dview_state_v1';   // 会话自动暂存
  var LS_REC = '4dview_records_v1'; // 多档案
  function collectState() {
    return {
      app: '4Dview', ver: 1, savedAt: new Date().toISOString(),
      calType: S.calType, leap: S.leap, y: S.y, m: S.m, d: S.d, h: S.h, mi: S.mi, gender: S.gender,
      birth: { prov: S.birth.prov, city: S.birth.city, area: S.birth.area, town: S.birth.town, country: S.birth.country || '', cityTxt: S.birth.cityTxt || '', lat: S.birth.lat, lon: S.birth.lon },
      home: { prov: S.home.prov, city: S.home.city, area: S.home.area, town: S.home.town, country: S.home.country || '', cityTxt: S.home.cityTxt || '', lat: S.home.lat, lon: S.home.lon },
      ui: { compassScale: S.compassScale, compassStyle: S.compassStyle }
    };
  }
  function ioMsgT(s) { txt('ioMsg', s); }
  function saveLocal() {
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(LS_KEY, JSON.stringify(collectState()));
      var n = new Date();
      ioMsgT('已自动暂存 ' + pad(n.getHours()) + ':' + pad(n.getMinutes()) + ':' + pad(n.getSeconds()));
    } catch (e) {}
  }
  function validLoc(o) { return o && isFinite(+o.lat) && isFinite(+o.lon) && Math.abs(+o.lat) <= 90 && Math.abs(+o.lon) <= 180; }
  function applyState(o) {
    if (!o || typeof o !== 'object') return false;
    if (o.calType === 'solar' || o.calType === 'lunar') S.calType = o.calType;
    S.leap = !!o.leap;
    if (isFinite(+o.y)) S.y = Math.round(+o.y);
    if (isFinite(+o.m)) S.m = Math.min(12, Math.max(1, Math.round(+o.m)));
    if (isFinite(+o.d)) S.d = Math.min(31, Math.max(1, Math.round(+o.d)));
    if (isFinite(+o.h)) S.h = Math.min(23, Math.max(0, Math.round(+o.h)));
    if (isFinite(+o.mi)) S.mi = Math.min(59, Math.max(0, Math.round(+o.mi)));
    if (o.gender === 'M' || o.gender === 'F') S.gender = o.gender;
    if (o.ui) {
      if (isFinite(+o.ui.compassScale)) S.compassScale = Math.min(3, Math.max(0.4, +o.ui.compassScale));
      if (o.ui.compassStyle === 0 || o.ui.compassStyle === 1 || o.ui.compassStyle === 2) S.compassStyle = o.ui.compassStyle;
    }
    [['birth', S.birth], ['home', S.home]].forEach(function (kv) {
      var src = o[kv[0]], st = kv[1];
      if (!src) return;
      ['prov', 'city', 'area', 'town', 'country', 'cityTxt'].forEach(function (k) { if (typeof src[k] === 'string') st[k] = src[k]; });
      if (validLoc(src)) { st.lat = +src.lat; st.lon = +src.lon; }
      st.src = '存档恢复';
    });
    return true;
  }
  function refreshAllInputs() {
    $('calSolar').checked = (S.calType === 'solar');
    $('calLunar').checked = (S.calType === 'lunar');
    $('leap').checked = S.leap;
    $('rGM').classList.toggle('on', S.gender === 'M');
    $('rGF').classList.toggle('on', S.gender === 'F');
    $('genderM').checked = (S.gender === 'M');
    $('genderF').checked = (S.gender === 'F');
    $('inY').value = S.y;
    fillNum($('inH'), 0, 23, S.h);
    $('inMi').value = pad(S.mi);
    rebuildDateInputs();
    cascInit('b', S.birth); cascInit('h', S.home);
    syncLocInputs('b', S.birth); syncLocInputs('h', S.home);
    renderLocBadges();
    var cs = $('compassScale');
    if (cs) { cs.value = S.compassScale; txt('compassScaleVal', S.compassScale.toFixed(1) + '×'); }
    if (compassG) buildCompass();
  }
  function restoreFromLocal() {
    try {
      if (!window.localStorage) return;
      var raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return;
      var o = JSON.parse(raw);
      if (applyState(o)) { refreshAllInputs(); ioMsgT('已恢复上次会话'); }
    } catch (e) {}
  }

  /* ---- 多档案 ---- */
  function loadRecs() {
    try {
      if (!window.localStorage) return [];
      var a = JSON.parse(window.localStorage.getItem(LS_REC) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function saveRecs(a) { try { if (window.localStorage) window.localStorage.setItem(LS_REC, JSON.stringify(a)); } catch (e) {} }
  function recName(o) {
    var bp = o.birth ? (o.birth.prov === 'OVERSEAS' ? (o.birth.cityTxt || o.birth.country) : (o.birth.area || o.birth.city)) || '?' : '?';
    var hp = (o.home && (o.home.area || o.home.city)) || '?';
    return o.y + '-' + pad(+o.m || 1) + '-' + pad(+o.d || 1) + ' ' + bp + '→' + hp;
  }
  function renderIoList(selIdx) {
    var sel = $('ioList'); if (!sel) return;
    var a = loadRecs();
    if (!a.length) { sel.innerHTML = '<option value="">（暂无存档，点「存为新档」）</option>'; sel.disabled = true; return; }
    sel.disabled = false;
    sel.innerHTML = a.map(function (r, i) {
      var t = r.savedAt ? (' · ' + String(r.savedAt).slice(5, 16).replace('T', ' ')) : '';
      return '<option value="' + i + '"' + (i === selIdx ? ' selected' : '') + '>' + esc(r.name || recName(r)) + esc(t) + '</option>';
    }).join('');
    if (selIdx != null) sel.value = String(selIdx);
  }
  function saveAsNew() {
    var o = collectState();
    o.name = recName(o);
    var a = loadRecs(), n = o.name, k = 2;
    while (a.some(function (r) { return r.name === o.name; })) o.name = n + '(' + (k++) + ')';
    a.push(o); saveRecs(a); renderIoList(a.length - 1);
    ioMsgT('已存为「' + o.name + '」');
  }
  function delSel() {
    var sel = $('ioList'), a = loadRecs();
    var i = parseInt(sel.value, 10);
    if (!a.length || !(i >= 0 && i < a.length)) { ioMsgT('请先在下拉列表选择要删除的存档'); return; }
    var nm = a[i].name || '';
    a.splice(i, 1); saveRecs(a); renderIoList(a.length ? Math.min(i, a.length - 1) : null);
    ioMsgT('已删除「' + nm + '」');
  }
  function loadSel() {
    var a = loadRecs(), i = parseInt($('ioList').value, 10);
    if (!(i >= 0 && i < a.length)) return;
    if (applyState(a[i])) {
      refreshAllInputs(); recompute(); fitBoth();
      ioMsgT('已载入「' + (a[i].name || recName(a[i])) + '」');
    }
  }

  /* ---- xls（HTML 表格格式，Excel/WPS 直接打开） ---- */
  var XLS_COLS = ['名称', '历种', '闰月', '年', '月', '日', '时', '分', '性别', '出生省', '出生市', '出生区', '出生镇', '出生纬度', '出生经度', '常居省', '常居市', '常居区', '常居镇', '常居纬度', '常居经度', '保存时间'];
  function recToRow(r) {
    return [r.name || recName(r), r.calType === 'lunar' ? '农历' : '公历', r.leap ? '是' : '否', r.y, r.m, r.d, r.h, r.mi, r.gender === 'F' ? '女' : '男',
      r.birth.prov === 'OVERSEAS' ? r.birth.country : r.birth.prov, r.birth.prov === 'OVERSEAS' ? r.birth.cityTxt : r.birth.city, r.birth.prov === 'OVERSEAS' ? '' : r.birth.area, r.birth.prov === 'OVERSEAS' ? '' : r.birth.town, r.birth.lat, r.birth.lon,
      r.home.prov === 'OVERSEAS' ? r.home.country : r.home.prov, r.home.prov === 'OVERSEAS' ? r.home.cityTxt : r.home.city, r.home.prov === 'OVERSEAS' ? '' : r.home.area, r.home.prov === 'OVERSEAS' ? '' : r.home.town, r.home.lat, r.home.lon, r.savedAt || ''];
  }
  function exportXls() {
    var a = loadRecs();
    if (!a.length) { ioMsgT('暂无存档可导出，请先「存为新档」'); return; }
    try {
      var h = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table border="1"><tr>' +
        XLS_COLS.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr>' +
        a.map(function (r) { return '<tr>' + recToRow(r).map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</table></body></html>';
      var blob = new Blob(['﻿' + h], { type: 'application/vnd.ms-excel' });
      var link = document.createElement('a');
      var n = new Date();
      link.href = URL.createObjectURL(blob);
      link.download = '4dview存档-' + n.getFullYear() + pad(n.getMonth() + 1) + pad(n.getDate()) + '-' + pad(n.getHours()) + pad(n.getMinutes()) + '.xls';
      document.body.appendChild(link); link.click();
      setTimeout(function () { try { document.body.removeChild(link); URL.revokeObjectURL(link.href); } catch (e) {} }, 300);
      ioMsgT('已导出 ' + a.length + ' 条存档（xls）');
    } catch (e) { ioMsgT('导出失败：' + (e && e.message ? e.message : e)); }
  }
  function importXls(file) {
    if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var text = String(rd.result), rows = [];
        if (/<table/i.test(text)) {
          var doc = new DOMParser().parseFromString(text, 'text/html');
          var trs = doc.querySelectorAll('tr');
          for (var i = 0; i < trs.length; i++) {
            var tds = trs[i].querySelectorAll('td');
            if (tds.length >= 20) rows.push([].map.call(tds, function (td) { return td.textContent; }));
          }
        } else {
          text.split(/\r?\n/).forEach(function (ln) {
            if (!ln.trim()) return;
            var cells = ln.split(',').map(function (s) { return s.replace(/^"|"$/g, '').trim(); });
            if (cells.length >= 20 && !/名称|name/i.test(cells[0])) rows.push(cells);
          });
        }
        var a = loadRecs(), added = 0;
        rows.forEach(function (c) {
          var lat = parseFloat(c[13]), lon = parseFloat(c[14]);
          var hlat = parseFloat(c[19]), hlon = parseFloat(c[20]);
          if (!isFinite(lat) || !isFinite(lon) || !isFinite(+c[3])) return;
          a.push({
            name: c[0], calType: /农历/.test(c[1]) ? 'lunar' : 'solar', leap: /^(是|闰|true)$/i.test(String(c[2]).trim()),
            y: +c[3], m: +c[4], d: +c[5], h: +c[6], mi: +c[7], gender: /女/.test(c[8]) ? 'F' : 'M',
            birth: { prov: c[9] || '', city: c[10] || '', area: c[11] || '', town: c[12] || '', lat: lat, lon: lon },
            home: { prov: c[15] || '', city: c[16] || '', area: c[17] || '', town: c[18] || '', lat: isFinite(hlat) ? hlat : BJ.lat, lon: isFinite(hlon) ? hlon : BJ.lon },
            savedAt: c[21] || ''
          });
          (function (r) {
            ['birth', 'home'].forEach(function (k) {
              var o = r[k];
              if (o.prov && AREA && Object.keys(AREA).indexOf(o.prov) < 0) { o.country = o.prov; o.cityTxt = o.city; o.prov = 'OVERSEAS'; o.city = ''; o.area = ''; o.town = ''; }
            });
          })(a[a.length - 1]);
          added++;
        });
        if (!added) { ioMsgT('导入失败：文件中没有可识别的存档行'); return; }
        saveRecs(a); renderIoList(a.length - 1);
        var last = a[a.length - 1];
        if (applyState(last)) { refreshAllInputs(); recompute(); fitBoth(); }
        ioMsgT('已导入并载入 ' + added + ' 条存档（当前：' + (last.name || recName(last)) + '）');
      } catch (e) { ioMsgT('导入失败：' + (e && e.message ? e.message : e)); }
    };
    rd.onerror = function () { ioMsgT('导入失败：文件读取错误'); };
    rd.readAsText(file);
  }

  /* ================= 绑定 ================= */
  function bind() {
    // 历种
    $('calSolar').onchange = $('calLunar').onchange = function () {
      S.calType = $('calLunar').checked ? 'lunar' : 'solar';
      rebuildDateInputs(); recompute();
    };
    $('leap').onchange = function () { S.leap = this.checked; recompute(); };
    // 时间
    $('inY').onchange = function () { S.y = parseInt(this.value, 10) || S.y; rebuildDateInputs(); recompute(); };
    $('inM').onchange = function () { S.m = parseInt(this.value, 10); rebuildDateInputs(); recompute(); };
    $('inD').onchange = function () { S.d = parseInt(this.value, 10); recompute(); };
    $('inH').onchange = function () { S.h = parseInt(this.value, 10); recompute(); };
    $('inMi').onchange = function () { S.mi = Math.max(0, Math.min(59, parseInt(this.value, 10) || 0)); this.value = S.mi; recompute(); };
    $('genderM').onchange = $('genderF').onchange = function () {
      S.gender = $('genderF').checked ? 'F' : 'M';
      $('rGM').classList.toggle('on', S.gender === 'M');
      $('rGF').classList.toggle('on', S.gender === 'F');
      recompute();
    };
    // 坐标手填
    ['b', 'h'].forEach(function (prefix) {
      var st = prefix === 'b' ? S.birth : S.home;
      $(prefix + 'Lat').onchange = $(prefix + 'Lon').onchange = function () {
        var la = parseFloat($(prefix + 'Lat').value), lo = parseFloat($(prefix + 'Lon').value);
        if (isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180) {
          st.lat = la; st.lon = lo; st.src = '手动输入'; renderLocBadges(); recompute(); panTo(prefix, st);
        }
      };
    });
    $('bReset').onclick = function () {
      var og = ORIGINS[($('bOrigin') && $('bOrigin').value) || 'yl'] || ORIGINS.yl;
      S.birth.lat = og.lat; S.birth.lon = og.lon; S.birth.src = '默认值（大地原点·' + og.name + '）';
      S.birth.prov = og.prov; S.birth.city = og.city; S.birth.area = og.area; S.birth.town = og.town;
      cascInit('b', S.birth); syncLocInputs('b', S.birth); renderLocBadges(); recompute(); panTo('b', S.birth);
    };
    $('fitBtn').onclick = fitBoth;
    $('fsBtn').onclick = toggleFs;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('mapwrap').classList.contains('fs')) toggleFs();
    });
    // 罗盘样式
    [0, 1, 2].forEach(function (i) {
      var b = $('csStyle' + i);
      if (b) b.onclick = function () { S.compassStyle = i; buildCompass(); saveLocal(); };
    });
    // 存档
    // 国外城市输入（去抖 800ms 后在线定位）
    [['b', S.birth], ['h', S.home]].forEach(function (kv) {
      var pfx = kv[0], st = kv[1];
      $(pfx + 'Country').oninput = function () { st.country = this.value.trim(); ovrDeb(pfx, st); };
      $(pfx + 'CityTxt').oninput = function () { st.cityTxt = this.value.trim(); ovrDeb(pfx, st); };
    });
    $('ioSave').onclick = saveAsNew;
    $('ioDel').onclick = delSel;
    $('ioList').onchange = loadSel;
    $('ioExport').onclick = exportXls;
    $('ioImport').onclick = function () { $('ioFile').click(); };
    $('ioFile').onchange = function () { importXls(this.files && this.files[0]); this.value = ''; };
  }

  /* ================= 启动 =================
     不等 window.load（任一图片/瓦片挂起都会拖死整页），用 DOMContentLoaded；
     每个初始化步骤独立容错，单点失败不拖垮整页，失败项汇总显示。 */
  var booted = false, bootErrs = [];
  function step(name, fn) {
    try { fn(); } catch (e) { bootErrs.push(name + '（' + (e && e.message ? e.message : e) + '）'); }
  }
  function boot() {
    if (booted) return; booted = true;
    step('事件绑定', bind);
    step('时间输入', function () {
      $('inY').value = S.y;
      fillNum($('inH'), 0, 23, S.h);
      $('inMi').value = pad(S.mi);
      rebuildDateInputs();
    });
    step('地点级联', function () {
      cascInit('b', S.birth);
      cascInit('h', S.home);
      syncLocInputs('b', S.birth); syncLocInputs('h', S.home);
      renderLocBadges();
    });
    step('本地存档', restoreFromLocal);
    step('存档列表', function () { renderIoList(); });
    step('罗盘', function () {
      buildCompass();
      $('compassScale').oninput = function () {
        S.compassScale = parseFloat(this.value);
        txt('compassScaleVal', S.compassScale.toFixed(1) + '×');
        applyCompassScale();
      };
    });
    step('地图', initMap);
    step('初始化计算', recompute);
    if (bootErrs.length) {
      var cur = $('errLine').textContent;
      errLine((cur ? cur + '；另：' : '部分功能初始化失败：') + bootErrs.join('；') + (cur ? '' : '。其余功能不受影响，可刷新重试。'));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
