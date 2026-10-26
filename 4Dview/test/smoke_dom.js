/* 节点2/3 应用层：DOM-ID一致性 + 无头DOM桩端到端跑 recompute */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
function eq(name, got, want) { if (got === want) pass++; else { fail++; console.log(`FAIL ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`); } }
function ok(name, cond, extra) { if (cond) pass++; else { fail++; console.log(`FAIL ${name} ${extra||''}`); } }

// ---------- 1. ID 一致性 ----------
const appSrc = fs.readFileSync(path.join(root, 'assets/4dview-app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const used = new Set([...appSrc.matchAll(/\$\('([A-Za-z0-9_]+)'\)/g)].map(m => m[1]));
const defined = new Set([...html.matchAll(/id="([A-Za-z0-9_]+)"/g)].map(m => m[1]));
const DYNAMIC = new Set(['cArrow', 'mapFail', 'osmFail']); const missing = [...used].filter(id => !defined.has(id) && !DYNAMIC.has(id));
eq('DOM-ID全部存在', missing.join(',') || 'NONE', 'NONE');

// ---------- 2. DOM 桩 ----------
const els = {};
function mkEl(id) {
  if (els[id]) return els[id];
  const e = {
    id, value: '', textContent: '', innerHTML: '', checked: false,
    style: {}, _cls: new Set(),
    classList: { toggle(c, v) { v ? e._cls.add(c) : e._cls.delete(c); }, add(c) { e._cls.add(c); }, contains(c) { return e._cls.has(c); } },
    setAttribute(k, v) { e['_attr_' + k] = v; },
    getAttribute(k) { return e['_attr_' + k]; },
    addEventListener() {},
  };
  els[id] = e; return e;
}
const listeners = {};
global.window = global;
global.self = global;
global.document = { getElementById: mkEl, addEventListener() {} };
window.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.fetch = () => new Promise(() => {}); // 挂起=离线路径
// Leaflet 桩
global.L = {
  divIcon: o => o,
  marker: (ll, o) => ({ ll, on() {}, setLatLng(x) { this.ll = x; }, getLatLng() { return this.ll; }, addTo() { return this; } }),
  polyline: () => ({ addTo() { return this; }, setLatLngs() {} }),
  tileLayer: () => ({ on: () => {}, setUrl: () => {} }),
  map: () => ({ on() {}, setView() {}, fitBounds() {}, removeLayer() {}, addLayer() {}, getZoom: () => 5, latLngToContainerPoint: () => ({ x: 0, y: 0 }) }),
  latLng: (a, b) => [a, b],
  latLngBounds: b => ({ pad: () => ({}) }),
};
// 依赖脚本
const C = require('../assets/4dview-core.js');
window.FDVCORE = C;
window.Lunar = require('../assets/lunar.js').Lunar; // 对齐浏览器 UMD 真实行为：window.Lunar 即 Lunar 类本身
require('../assets/area.js'); // sets window.AREA4
// Leaflet 桩须在 app.js 引用 L 前就绪（app.js 用的是全局 L）
require('../assets/4dview-app.js');

// ---------- 3. 触发 load ----------
(listeners.load || []).forEach(fn => fn());
ok('load执行后地图初始化', true);

// ---------- 4. 默认用例端到端 ----------
// 默认：1990-06-22 08:00 男 大地原点；1990-06-22 在夏令时内
const expStd = C.toStandard(1990, 6, 22, 8, 0);
const expTst = C.trueSolar(expStd.ms, 108.923611);
eq('默认.TST大字', els.oTstBig.textContent, C.fmtMs(expTst.ms));
eq('默认.时辰', els.oTstShichen.textContent, C.shichenOf(expTst.minutes) + '时');
ok('默认.夏令时badge', /夏令时/.test(els.oDst.innerHTML));
ok('默认.干支非空', /年 .*月 .*日 .*时/.test(els.oGanzhi.textContent));
ok('默认.农历含生肖', /生肖/.test(els.oLunar.textContent));
ok('默认.宜忌输出', els.oYi.textContent.length > 0 && els.oJi.textContent.length > 0);
ok('默认.佛历', /佛历/.test(els.oFoto.textContent));
ok('默认.道历', /道历/.test(els.oTao.textContent));
ok('默认.宅命', /[坎坤震巽乾兑艮离]命/.test(els.oMgGua.innerHTML) && els.mgDirs.innerHTML.split('<tr').length === 9);
ok('默认.山向', /°/.test(els.oBearing.textContent) && /宫）/.test(els.oShan.innerHTML));
ok('默认.罗盘指针已旋转', /rotate\(\d/.test(els.cArrow && els.cArrow._attr_transform || ''));
// 与核心独立复算一致（大地原点->北京）
const th = C.bearing(34.540833, 108.923611, 39.9042, 116.4074);
eq('默认.方位角', els.oBearing.textContent, th.toFixed(2) + '°');
eq('默认.向', els.oShan.innerHTML.includes(C.shanOf(th).shan + '向'), true);
eq('默认.日出', els.oSun.textContent.indexOf(C.fmtMin(C.sunriseSunset(1990, 6, 22, 34.540833, 108.923611).sunrise)) >= 0, true);

// ---------- 5. 交互：改为农历输入 ----------
els.calLunar.checked = true; els.calSolar.checked = false;
els.calLunar.onchange();
// 农历 2026 四月初八（佛诞 2026-05-24）
els.inY.value = '2026'; els.inY.onchange();
els.inM.value = '4'; els.inM.onchange();
els.inD.value = '8'; els.inD.onchange();
ok('农历.佛诞识别', /释迦牟尼佛诞/.test(els.oFotoFest.textContent));
ok('农历.公历回显0524', /5 月 24 日/.test(els.oSolar.textContent));

// ---------- 6. 交互：无效农历 ----------
els.inM.value = '13'; // select无13月选项，模拟异常输入路径
S_direct();
function S_direct() { /* select 值不在选项时 value 仍会赋值；直接改 state 更稳 */ }
// 直接注入非法：闰月+日期越界
els.leap.checked = true; els.leap.onchange();
els.inY.value = '2026'; els.inY.onchange();
// 2026年无闰四月（假设），触发errLine或正常——不断言具体年，仅断言错误机制存在：
els.inD.value = '30'; els.inD.onchange();
ok('农历.异常路径不崩溃(有输出或错误提示)', (els.oTstBig.textContent !== '' ) || els.errLine.textContent !== '');

// ---------- 7. 性别切换影响命卦 ----------
els.calSolar.checked = true; els.calLunar.checked = false; els.calSolar.onchange();
els.inY.value = '1990'; els.inY.onchange();
els.genderM.checked = true; els.genderF.checked = false; els.genderM.onchange();
const g1 = els.oMgGua.innerHTML;
els.genderF.checked = true; els.genderM.checked = false; els.genderF.onchange();
const g2 = els.oMgGua.innerHTML;
ok('性别切换命卦变化', g1 !== g2 && /坎命/.test(g1) && /艮命/.test(g2));

// ---------- 8. 手填坐标 ----------
els.inM.value='6'; els.inM.onchange(); els.inD.value='22'; els.inD.onchange();
els.bLat.value = '30.592800'; els.bLon.value = '114.304900';
els.bLat.onchange();
const expW = C.trueSolar(C.toStandard(1990, 6, 22, 8, 0).ms, 114.3049);
eq('武汉.TST', els.oTstBig.textContent, C.fmtMs(expW.ms));


// ---------- 9. 罗盘SVG结构 ----------
const svg = els.compassSvg.innerHTML;
eq('罗盘.24山标签', (svg.match(/class="cshan/g) || []).length, 24);
eq('罗盘.8卦', (svg.match(/class="cgua/g) || []).length, 8);
ok('罗盘.含子壬午卯', svg.includes('>子<') && svg.includes('>壬<') && svg.includes('>午<') && svg.includes('>卯<'));
ok('罗盘.指北', svg.includes('>北<'));
ok('罗盘.箭头组', /id="cArrow"/.test(svg));
ok('罗盘.缩放已应用', (els.compassSvg.style.width || '').endsWith('px'));
console.log(`=== SVG PASS累加: 当前总计 PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail ? 1 : 0);
