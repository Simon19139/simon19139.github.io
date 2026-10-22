/* 4Dview 计算核心：夏令时还原 / 真太阳时 / 日出日落 / 命卦(八宅) / 二十四山向 / GCJ02<->WGS84
 * 浏览器 window.FDVCORE 与 Node module.exports 双端可用；所有时间以 UTC-ms + UTC字段处理，与本地时区无关 */
(function (root, factory) {
  var M = factory();
  if (typeof module === 'object' && module.exports) module.exports = M;
  root.FDVCORE = M;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  var M = {};
  var D = Math.PI / 180;

  /* ---------- 中国夏令时 1986-1991（官方时钟，UTC+9） ---------- */
  var DST = [
    [1986, 5, 4, 2, 0, 1986, 9, 14, 2, 0],
    [1987, 4, 12, 2, 0, 1987, 9, 13, 2, 0],
    [1988, 4, 10, 2, 0, 1988, 9, 11, 2, 0],
    [1989, 4, 16, 2, 0, 1989, 9, 17, 2, 0],
    [1990, 4, 15, 2, 0, 1990, 9, 16, 2, 0],
    [1991, 4, 14, 2, 0, 1991, 9, 15, 2, 0]
  ];
  function stamp(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi); }
  M.isDST = function (y, mo, d, h, mi) {
    var t = stamp(y, mo, d, h, mi);
    for (var i = 0; i < DST.length; i++) {
      var r = DST[i];
      if (t >= stamp(r[0], r[1], r[2], r[3], r[4]) && t < stamp(r[5], r[6], r[7], r[8], r[9])) return true;
    }
    return false;
  };
  /* 官方时钟 -> 东八区标准时，返回 {ms, dst} */
  M.toStandard = function (y, mo, d, h, mi) {
    var t = stamp(y, mo, d, h, mi);
    if (M.isDST(y, mo, d, h, mi)) return { ms: t - 3600000, dst: true };
    return { ms: t, dst: false };
  };

  /* ---------- NOAA 均时差 / 赤纬 ---------- */
  function dayOfYear(y, mo, d) {
    return Math.floor((stamp(y, mo, d, 0, 0) - stamp(y, 1, 1, 0, 0)) / 86400000) + 1;
  }
  function gamma(y, mo, d, h, mi) {
    return 2 * Math.PI / 365 * (dayOfYear(y, mo, d) + (h - 12) / 24 + (mi || 0) / 1440);
  }
  function eqtime(g) {
    return 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  }
  function decl(g) {
    return 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
      - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  }
  function parts(ms) { var t = new Date(ms); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), t.getUTCHours(), t.getUTCMinutes()]; }

  /* 真太阳时：标准时ms + 东经lon -> {minutes(0-1439), ms(含跨日), eot, lonCorr} */
  M.trueSolar = function (stdMs, lon) {
    var p = parts(stdMs);
    var g = gamma(p[0], p[1], p[2], p[3], p[4]);
    var eot = eqtime(g);
    var lonCorr = (lon - 120) * 4;
    var deltaMin = lonCorr + eot;
    var tstMs = stdMs + deltaMin * 60000;
    var tp = parts(tstMs);
    var minutes = Math.round(((tstMs / 60000) % 1440 + 1440) % 1440) % 1440;
    return { minutes: minutes, ms: tstMs, eot: eot, lonCorr: lonCorr, parts: tp };
  };

  /* 日出日落：出生地经纬度 + 日期 -> 东八区标准时钟 {sunrise, sunset(min), note} */
  M.sunriseSunset = function (y, mo, d, lat, lon) {
    var g = gamma(y, mo, d, 12, 0);
    var eot = eqtime(g), de = decl(g);
    var phi = lat * D;
    var cosH = Math.cos(90.833 * D) / (Math.cos(phi) * Math.cos(de)) - Math.tan(phi) * Math.tan(de);
    if (cosH > 1) return { note: '极夜' };
    if (cosH < -1) return { note: '极昼' };
    var H = Math.acos(cosH) / D;
    var noonUtc = 720 - 4 * lon - eot;
    return { sunrise: noonUtc - 4 * H + 480, sunset: noonUtc + 4 * H + 480 };
  };

  /* ---------- 时辰 ---------- */
  var SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  M.shichenOf = function (minutes) {
    var i = Math.floor((((minutes + 60) % 1440 + 1440) % 1440) / 120);
    return SHICHEN[i];
  };

  /* ---------- 命卦（八宅） ---------- */
  var GUA_NUM = { 1: '坎', 2: '坤', 3: '震', 4: '巽', 6: '乾', 7: '兑', 8: '艮', 9: '离' };
  var RING = ['乾', '坎', '艮', '震', '巽', '离', '坤', '兑'];       // 顺时针宫序
  var GUA_DIR = { 坎: 0, 艮: 45, 震: 90, 巽: 135, 离: 180, 坤: 225, 兑: 270, 乾: 315 };
  var DIR_NAME = { 坎: '正北', 艮: '东北', 震: '正东', 巽: '东南', 离: '正南', 坤: '西南', 兑: '正西', 乾: '西北' };
  /* 大游年歌：各宫伏位起，按 RING 顺时针依次排布七曜 */
  var YOUNIAN = {
    乾: ['伏位', '六煞', '天医', '五鬼', '祸害', '绝命', '延年', '生气'],
    坎: ['伏位', '五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
    艮: ['伏位', '六煞', '绝命', '祸害', '生气', '延年', '天医', '五鬼'],
    震: ['伏位', '延年', '生气', '祸害', '绝命', '五鬼', '天医', '六煞'],
    巽: ['伏位', '天医', '五鬼', '六煞', '祸害', '生气', '绝命', '延年'],
    离: ['伏位', '六煞', '五鬼', '绝命', '延年', '祸害', '生气', '天医'],
    坤: ['伏位', '天医', '延年', '绝命', '生气', '祸害', '五鬼', '六煞'],
    兑: ['伏位', '生气', '祸害', '延年', '绝命', '六煞', '五鬼', '天医']
  };
  var JI = { 伏位: 1, 生气: 1, 天医: 1, 延年: 1, 六煞: 0, 五鬼: 0, 祸害: 0, 绝命: 0 };
  M.mingGua = function (yearLichan, gender) {
    var yy = yearLichan % 100, n;
    if (yearLichan >= 2000) n = gender === 'M' ? (99 - yy) % 9 : (yy + 6) % 9;
    else n = gender === 'M' ? (100 - yy) % 9 : (yy - 4) % 9;
    n = ((n % 9) + 9) % 9; if (n === 0) n = 9;
    var gua = n === 5 ? (gender === 'M' ? '坤' : '艮') : GUA_NUM[n];
    var group = ('坎离震巽'.indexOf(gua) >= 0) ? '东四命' : '西四命';
    var start = RING.indexOf(gua), lucks = YOUNIAN[gua], dirs = [];
    for (var i = 0; i < 8; i++) {
      var g2 = RING[(start + i) % 8];
      dirs.push({ gong: g2, dir: DIR_NAME[g2], deg: GUA_DIR[g2], luck: lucks[i], ji: JI[lucks[i]] === 1 });
    }
    return { num: n, gua: gua, group: group, dirs: dirs };
  };

  /* ---------- 二十四山向 ---------- */
  var SHAN24 = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙',
    '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];
  M.SHAN24 = SHAN24;
  M.bearing = function (lat1, lon1, lat2, lon2) {
    var p1 = lat1 * D, p2 = lat2 * D, dl = (lon2 - lon1) * D;
    var x = Math.sin(dl) * Math.cos(p2);
    var y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (Math.atan2(x, y) / D + 360) % 360;
  };
  M.distKm = function (lat1, lon1, lat2, lon2) {
    var p1 = lat1 * D, p2 = lat2 * D, dp = (lat2 - lat1) * D, dl = (lon2 - lon1) * D;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371 * 2 * Math.asin(Math.sqrt(a));
  };
  M.shanOf = function (theta) {
    var i = Math.floor(((theta + 7.5) % 360) / 15);
    var s = SHAN24[i];
    var gong = { 壬: '坎', 子: '坎', 癸: '坎', 丑: '艮', 艮: '艮', 寅: '艮', 甲: '震', 卯: '震', 乙: '震', 辰: '巽', 巽: '巽', 巳: '巽', 丙: '离', 午: '离', 丁: '离', 未: '坤', 坤: '坤', 申: '坤', 庚: '兑', 酉: '兑', 辛: '兑', 戌: '乾', 乾: '乾', 亥: '乾' }[s];
    return { index: i, shan: s, gong: gong };
  };

  /* ---------- GCJ-02 <-> WGS-84 ---------- */
  var A = 6378245.0, EE = 0.00669342162296594323;
  function outOfChina(lat, lon) { return lon < 72.004 || lon > 137.8347 || lat < 0.8293 || lat > 55.8271; }
  function tLat(x, y) {
    var r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
    r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
    return r;
  }
  function tLon(x, y) {
    var r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
    r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
    r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
    return r;
  }
  M.wgs2gcj = function (lat, lon) {
    if (outOfChina(lat, lon)) return [lat, lon];
    var dlat = tLat(lon - 105, lat - 35), dlon = tLon(lon - 105, lat - 35);
    var radlat = lat / 180 * Math.PI, magic = Math.sin(radlat);
    magic = 1 - EE * magic * magic;
    var sq = Math.sqrt(magic);
    dlat = (dlat * 180) / ((A * (1 - EE)) / (magic * sq) * Math.PI);
    dlon = (dlon * 180) / (A / sq * Math.cos(radlat) * Math.PI);
    return [lat + dlat, lon + dlon];
  };
  M.gcj2wgs = function (lat, lon) {
    if (outOfChina(lat, lon)) return [lat, lon];
    var la = lat, lo = lon;
    for (var i = 0; i < 3; i++) {
      var g = M.wgs2gcj(la, lo);
      la += lat - g[0]; lo += lon - g[1];
    }
    return [la, lo];
  };

  /* ---------- 立春归属年（命卦用；依赖 lunar.js 的 Lunar 对象） ---------- */
  M.lichunYear = function (Lunar, ms) {
    var p = parts(ms);
    var d = new Date(p[0], p[1] - 1, p[2], p[3], p[4]);   // 本地字段=墙钟，时区无关
    var l = Lunar.fromDate(d);
    var table = l.getJieQiTable();
    var lc = table['立春'];
    if (!lc) return p[0];
    var lcStr = lc.getYear() + '-' + ('0' + lc.getMonth()).slice(-2) + '-' + ('0' + lc.getDay()).slice(-2)
      + ' ' + ('0' + lc.getHour()).slice(-2) + ':' + ('0' + lc.getMinute()).slice(-2) + ':' + ('0' + lc.getSecond()).slice(-2);
    var wall = M.fmtMs(ms) + ':00';
    return wall < lcStr ? p[0] - 1 : p[0];
  };

  /* ---------- 工具 ---------- */
  M.fmtMin = function (m) { m = Math.round(m); return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
  M.fmtMs = function (ms) { var p = parts(ms); return p[0] + '-' + ('0' + p[1]).slice(-2) + '-' + ('0' + p[2]).slice(-2) + ' ' + ('0' + p[3]).slice(-2) + ':' + ('0' + p[4]).slice(-2); };
  M.parts = parts;
  return M;
});
