/* 4Dview 浏览器级 E2E（jsdom）：启动/七历/选点/反查/国外/存档/xls/罗盘样式/全屏
   运行：NODE_PATH=/tmp/e2e/node_modules node test/e2e_jsdom.js  （jsdom@24 装于 /tmp/e2e） */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let html = read('index.html');
html = html.replace(/<script[^>]*src=[^>]*><\/script>/g, '').replace(/<link[^>]*>/g, '');

const dom = new JSDOM(html, { url: 'https://t9w5rcrkqg.page.coze.site/', runScripts: 'dangerously', pretendToBeVisual: true });
const w = dom.window;

w.SVGSVGElement.prototype.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0 });
['offsetWidth', 'clientWidth'].forEach(k => Object.defineProperty(w.HTMLElement.prototype, k, { get() { return 800; }, configurable: true }));
['offsetHeight', 'clientHeight'].forEach(k => Object.defineProperty(w.HTMLElement.prototype, k, { get() { return 600; }, configurable: true }));
w.HTMLElement.prototype.getBoundingClientRect = function () { return { x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 600, width: 800, height: 600 }; };
w.fetch = (url) => {
  if (/bigdatacloud\.net/.test(url)) {
    const m = url.match(/longitude=([\d.-]+)/);
    const la = url.match(/latitude=([\d.-]+)/);
    const lon = m ? parseFloat(m[1]) : 0;
    const lat = la ? parseFloat(la[1]) : 0;
    if (lon > 114 && lon < 114.5 && lat > 22 && lat < 22.6) {
      return Promise.resolve({ json: () => Promise.resolve({ countryName: '中国', countryCode: 'HK', principalSubdivision: '香港', city: '中西区', locality: '', localityInfo: { administrative: [{ adminLevel: 4, name: '香港' }] } }) });
    }
    if (lon > 137) {
      return Promise.resolve({ json: () => Promise.resolve({ countryName: '日本', countryCode: 'JP', principalSubdivision: '东京都', city: '东京', locality: '', localityInfo: { administrative: [{ adminLevel: 6, name: '东京' }] } }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ principalSubdivision: '湖北省', city: '武汉市', locality: '武昌区', localityInfo: { administrative: [{ adminLevel: 9, name: '粮道街道' }] } }) });
  }
  if (/nominatim\.openstreetmap\.org\/search/.test(url)) {
    if (/香港|%E9%A6%99%E6%B8%AF/.test(url)) return Promise.resolve({ json: () => Promise.resolve([{ lat: '22.32', lon: '114.17' }]) });
    return Promise.resolve({ json: () => Promise.resolve([{ lat: '35.68', lon: '139.69' }]) });
  }
  if (/nominatim\.openstreetmap\.org\/reverse/.test(url)) {
    return Promise.resolve({ json: () => Promise.resolve({ address: { province: '湖北省', city: '武汉市', county: '武昌区', suburb: '粮道街' } }) });
  }
  return new Promise(() => {});
};
w.URL.createObjectURL = () => 'blob:mock';
w.URL.revokeObjectURL = () => {};
w.HTMLAnchorElement.prototype.click = function () {};

['assets/4dview-core.js', 'assets/lunar.js', 'assets/area.js', 'assets/leaflet.js', 'assets/4dview-app.js']
  .forEach(f => w.eval(read(f)));

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name); console.log('  ✗ ' + name + (extra ? '  | ' + extra : '')); }
}
const g = id => w.document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await sleep(600);

  console.log('— 启动与初始渲染 —');
  ok('boot 无汇总错误', !/初始化失败/.test(g('errLine').textContent), g('errLine').textContent);
  ok('真太阳时输出(1990夏令时还原)', /1990-06-22 06:1\d/.test(g('oTstBig').textContent), g('oTstBig').textContent);
  ok('时辰输出', /时$/.test(g('oTstShichen').textContent), g('oTstShichen').textContent);
  ok('命卦八向 8 行', g('mgDirs').querySelectorAll('tr').length === 8);
  ok('山向输出含"向"', /向（/.test(g('oShan').textContent), g('oShan').textContent);
  ok('方位角数值', /^\d+\.\d\d°$/.test(g('oBearing').textContent), g('oBearing').textContent);

  console.log('— 七历：星期/星宿(道历)/太岁/守护菩萨 —');
  ok('星期(1990-06-22=星期五)', g('oWeek').textContent === '星期五', g('oWeek').textContent);
  ok('本命星宿(27宿:鬼金羊南方朱雀)', /鬼宿（金羊 · 南方朱雀 · 凶）/.test(g('oXiuDay').textContent), g('oXiuDay').textContent);
  ok('当日值日星宿(28宿:牛金牛北方玄武)', /牛宿（金牛 · 北方玄武 · .+）/.test(g('oXiuDuty').textContent), g('oXiuDuty').textContent);
  ok('本命太岁(庚午=王济)', /王济大将军（庚午太岁）/.test(g('oTaiSui').textContent), g('oTaiSui').textContent);
  ok('守护菩萨(马=大势至)', /大势至菩萨（马年本命佛）/.test(g('oFotoGuard').textContent), g('oFotoGuard').textContent);
  ok('农历行无星宿信息', !/星宿/.test(g('oLunar').parentElement.textContent.replace('农历', '')), g('oLunar').parentElement.textContent);

  console.log('— 图层切换 —');
  g('layerOsm').click();
  ok('切 OSM 高亮且不崩', g('layerOsm').classList.contains('on'));
  g('layerVec').click();
  ok('切回矢量', g('layerVec').classList.contains('on'));

  console.log('— 地图选点链路（国内） —');
  const bearingBefore = g('oBearing').textContent;
  g('bArm').click();
  ok('武装态提示可见', g('armTip').style.display !== 'none' && /出生地点/.test(g('armTip').textContent));
  const mapEl = g('map');
  function domClick(el, x, y) {
    ['mousedown', 'mouseup', 'click'].forEach(t => {
      const ev = new w.MouseEvent(t, { bubbles: true, cancelable: true, clientX: x, clientY: y, view: w });
      el.dispatchEvent(ev);
    });
  }
  domClick(mapEl, 400, 300);
  await sleep(200);
  const bLat = parseFloat(g('bLat').value);
  ok('点选后纬度更新为合法值', isFinite(bLat) && Math.abs(bLat) <= 90, g('bLat').value);
  ok('点选后 src=地图点选', /地图点选/.test(g('bSrc').textContent), g('bSrc').textContent);
  ok('武装态已解除', !g('bArm').classList.contains('on'));
  ok('方位角随点选刷新', g('oBearing').textContent !== bearingBefore, bearingBefore + ' -> ' + g('oBearing').textContent);
  ok('罗盘指针已旋转', /rotate\(-?\d/.test((g('cArrow').getAttribute('transform') || '')));
  const brgBox = w.document.querySelector('.brgBox');
  ok('地图实时方位角+24向标注', !!brgBox && /°/.test(brgBox.textContent) && /向（/.test(brgBox.textContent), brgBox && brgBox.textContent);
  const cssTxt = read('index.html');
  ok('标注样式：紫金底+金黄加粗+常居点右侧', /\.brgBox \{[^}]*display:inline-block[^}]*font-weight:700[^}]*#ffd76a[^}]*62,34,112/.test(cssTxt) && /translate\(60px,-50%\)/.test(cssTxt));

  console.log('— 地名反查回填级联（国内） —');
  await sleep(600);
  ok('反查后省=湖北省', g('bProv').value === '湖北省', g('bProv').value);
  ok('反查后市=武汉市', g('bCity').value === '武汉市', g('bCity').value);
  ok('反查后区含武昌', /武昌/.test(g('bArea').value), g('bArea').value);
  ok('徽标含"反查"', /反查/.test(g('bSrc').textContent), g('bSrc').textContent);

  console.log('— 自动暂存(含ui) —');
  const raw = w.localStorage.getItem('4dview_state_v1');
  let saved = null; try { saved = JSON.parse(raw); } catch (e) {}
  ok('localStorage 已写入且可解析', !!saved, raw && raw.slice(0, 60));
  ok('暂存纬度=点选纬度', saved && Math.abs(saved.birth.lat - parseFloat(g('bLat').value)) < 1e-6, saved && saved.birth.lat);
  ok('暂存含 ui 字段', saved && saved.ui && typeof saved.ui.compassStyle !== 'undefined', JSON.stringify(saved && saved.ui));

  console.log('— 罗盘缩放与样式 —');
  const cs = g('compassScale');
  cs.value = '2.0';
  cs.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('罗盘缩放 2.0×', g('compassScaleVal').textContent === '2.0×', g('compassScaleVal').textContent);
  ok('罗盘 SVG 尺寸放大', g('compassSvg').style.width === '600px', g('compassSvg').style.width);
  const rotBefore = g('cArrow').getAttribute('transform');
  g('csStyle1').click();
  ok('水墨样式高亮', g('csStyle1').classList.contains('on') && !g('csStyle0').classList.contains('on'));
  ok('重建后指针角度保持', g('cArrow').getAttribute('transform') === rotBefore);
  ok('重建后缩放保持(600px)', g('compassSvg').style.width === '600px', g('compassSvg').style.width);
  ok('水墨样式：宫内虚线区隔×16', (g('compassSvg').innerHTML.match(/stroke-dasharray="3 3"/g) || []).length === 16, String((g('compassSvg').innerHTML.match(/stroke-dasharray="3 3"/g) || []).length));
  g('csStyle2').click();
  ok('五行样式采用八字五行字体色', /rgba\(165,200,232/.test(g('compassSvg').innerHTML) && /rgba\(232,165,165/.test(g('compassSvg').innerHTML) && /rgba\(184,165,214/.test(g('compassSvg').innerHTML));
  ok('五行样式不再用旧离火色', !/rgba\(192,57,43/.test(g('compassSvg').innerHTML));
  g('csStyle0').click();
  ok('切回鎏金并暂存', g('csStyle0').classList.contains('on') && JSON.parse(w.localStorage.getItem('4dview_state_v1')).ui.compassStyle === 0);

  console.log('— 全屏切换 —');
  g('fsBtn').click();
  await sleep(200);
  ok('进入全屏', g('mapwrap').classList.contains('fs') && g('fsBtn').textContent === '✕ 还原', g('fsBtn').textContent);
  g('fsBtn').click();
  await sleep(200);
  ok('退出全屏', !g('mapwrap').classList.contains('fs') && g('fsBtn').textContent === '⤢ 放大', g('fsBtn').textContent);

  console.log('— 多档案 —');
  g('ioSave').click();
  let recs = null; try { recs = JSON.parse(w.localStorage.getItem('4dview_records_v1')); } catch (e) {}
  ok('存档记录 1 条', Array.isArray(recs) && recs.length === 1);
  ok('下拉列表出现存档', /武昌|武汉|1990/.test(g('ioList').innerHTML), g('ioList').innerHTML.slice(0, 80));
  g('inY').value = '2001'; g('inY').onchange.call(g('inY'));
  ok('改动后年=2001', g('inY').value === '2001', g('inY').value);
  g('ioList').value = '0'; g('ioList').onchange.call(g('ioList'));
  await sleep(200);
  ok('载入后年=1990', g('inY').value === '1990', g('inY').value);

  console.log('— 导出/导入 xls —');
  g('ioExport').click();
  ok('导出提示(1条)', /已导出 1 条/.test(g('ioMsg').textContent), g('ioMsg').textContent);
  const xlsHtml = '<html><body><table><tr><th>名称</th></tr>' +
    '<tr><td>测试档A</td><td>公历</td><td>否</td><td>1985</td><td>3</td><td>20</td><td>14</td><td>30</td><td>女</td>' +
    '<td>广东省</td><td>广州市</td><td>越秀区</td><td></td><td>23.1291</td><td>113.2644</td>' +
    '<td>北京市</td><td>北京市</td><td>东城区</td><td></td><td>39.9042</td><td>116.4074</td><td>2026-10-19T00:00:00</td></tr>' +
    '<tr><td>国外档B</td><td>公历</td><td>否</td><td>2000</td><td>1</td><td>1</td><td>12</td><td>0</td><td>男</td>' +
    '<td>日本</td><td>东京</td><td></td><td></td><td>35.68</td><td>139.69</td>' +
    '<td>湖北省</td><td>武汉市</td><td>武昌区</td><td></td><td>30.55</td><td>114.31</td><td>2026-10-20T00:00:00</td></tr>' +
    '</table></body></html>';
  const file = new w.File([xlsHtml], 'b.xls', { type: 'application/vnd.ms-excel' });
  const fi = g('ioFile');
  Object.defineProperty(fi, 'files', { value: [file], configurable: true });
  fi.onchange.call(fi);
  await sleep(500);
  ok('导入提示(2条)', /已导入并载入 2 条/.test(g('ioMsg').textContent), g('ioMsg').textContent);
  try { recs = JSON.parse(w.localStorage.getItem('4dview_records_v1')); } catch (e) {}
  ok('导入后共 3 条', Array.isArray(recs) && recs.length === 3, JSON.stringify(recs && recs.length));
  ok('国外行识别为OVERSEAS', recs && recs[2] && recs[2].birth.prov === 'OVERSEAS' && recs[2].birth.country === '日本', JSON.stringify(recs && recs[2] && recs[2].birth));
  ok('导入后输入区自动更新(年=2000)', g('inY').value === '2000', g('inY').value);
  ok('导入后出生地为国外模式', g('bProv').value === 'OVERSEAS' && g('bCountry').value === '日本' && g('bCityTxt').value === '东京', g('bProv').value + '/' + g('bCountry').value + '/' + g('bCityTxt').value);
  ok('导入后输出区自动更新(真太阳时2000-01-01)', /2000-01-01/.test(g('oTstBig').textContent), g('oTstBig').textContent);
  g('ioList').value = '1'; g('ioList').onchange.call(g('ioList'));
  await sleep(200);
  ok('载入测试档A(年=1985/省=广东)', g('inY').value === '1985' && g('bProv').value === '广东省', g('inY').value + '/' + g('bProv').value);
  ok('载入后性别女高亮', g('rGF').classList.contains('on'));
  ok('载入后真太阳时刷新', /1985-03-20/.test(g('oTstBig').textContent), g('oTstBig').textContent);
  g('ioDel').click();
  try { recs = JSON.parse(w.localStorage.getItem('4dview_records_v1')); } catch (e) {}
  ok('删除后剩 2 条', Array.isArray(recs) && recs.length === 2);

  console.log('— 国外：选择/定位/反查 —');
  g('bProv').value = 'OVERSEAS'; g('bProv').onchange.call(g('bProv'));
  await sleep(100);
  ok('国外模式：国家城市框显示', g('bCountry').style.display !== 'none' && g('bCityTxt').style.display !== 'none');
  ok('国外模式：市区镇下拉隐藏', g('bCity').style.display === 'none' && g('bArea').style.display === 'none' && g('bTown').style.display === 'none');
  ok('省下拉显示🌏选中', /国外城市/.test(g('bProv').innerHTML) && g('bProv').value === 'OVERSEAS');
  g('bCountry').value = '日本'; g('bCountry').oninput.call(g('bCountry'));
  g('bCityTxt').value = '东京'; g('bCityTxt').oninput.call(g('bCityTxt'));
  await sleep(1200);
  ok('国外前向定位(东京35.68)', g('bLat').value.startsWith('35.68'), g('bLat').value);
  ok('国外定位徽标', /国外城市定位/.test(g('bSrc').textContent), g('bSrc').textContent);
  await sleep(300);
  g('hArm').click();
  domClick(mapEl, 400, 300);
  await sleep(300);
  ok('国外点选更新坐标', isFinite(parseFloat(g('hLat').value)), g('hLat').value);
  await sleep(700);
  ok('国外反查：省栏=OVERSEAS', g('hProv').value === 'OVERSEAS', g('hProv').value);
  ok('国外反查：国家=日本', g('hCountry').value === '日本', g('hCountry').value);
  ok('国外反查：城市=东京', g('hCityTxt').value === '东京', g('hCityTxt').value);

  console.log('— 港澳台按国内处理（反查不判国外） —');
  g('bProv').value = 'OVERSEAS'; g('bProv').onchange.call(g('bProv'));
  await sleep(100);
  g('bCountry').value = '中国'; g('bCountry').oninput.call(g('bCountry'));
  g('bCityTxt').value = '香港'; g('bCityTxt').oninput.call(g('bCityTxt'));
  await sleep(1300);
  g('bArm').click();
  domClick(mapEl, 400, 300);
  await sleep(800);
  ok('香港点选反查：省=香港特别行政区', g('bProv').value === '香港特别行政区', g('bProv').value);
  ok('香港点选反查：未判为国外', g('bProv').value !== 'OVERSEAS' && g('bCountry').style.display === 'none', g('bProv').value);

  console.log('— 大地原点双选项 —');
  const bOrigin = g('bOrigin');
  ok('大地原点含登封告成选项', !!bOrigin && Array.from(bOrigin.options).some(o => o.value === 'gc' && /登封告成/.test(o.textContent)));
  bOrigin.value = 'gc';
  g('bReset').click();
  await sleep(200);
  ok('复位登封告成：省市区镇', g('bProv').value === '河南省' && g('bCity').value === '郑州市' && g('bArea').value === '登封市' && g('bTown').value === '告成镇', g('bProv').value + '/' + g('bCity').value + '/' + g('bArea').value + '/' + g('bTown').value);
  ok('复位登封告成：坐标', g('bLat').value.startsWith('34.40') && g('bLon').value.startsWith('113.14'), g('bLat').value + ',' + g('bLon').value);
  ok('复位徽标含登封告成', /大地原点·登封告成/.test(g('bSrc').textContent), g('bSrc').textContent);
  bOrigin.value = 'yl';
  g('bReset').click();
  await sleep(200);
  ok('复位咸阳永乐：坐标与区划', g('bLat').value.startsWith('34.54') && g('bProv').value === '陕西省' && g('bTown').value === '永乐镇', g('bLat').value + '/' + g('bProv').value + '/' + g('bTown').value);

  console.log('— 文案规范 + 级联定位链路 —');
  const htmlTxt2 = read('index.html');
  const appTxt = read('assets/4dview-app.js');
  ok('副标题新文案', /出生八宅方位 × 常居地择优/.test(htmlTxt2));
  ok('章节标题：出生八宅方位', /<h2>出生八宅方位<\/h2>/.test(htmlTxt2));
  ok('章节标题：常居地择优', /<h2>常居地择优<\/h2>/.test(htmlTxt2));
  ok('表头宜忌+无吉凶残留', /<th>宜忌<\/th>/.test(htmlTxt2) && !/<th>吉凶<\/th>/.test(htmlTxt2) && !/吉|凶/.test(appTxt));
  ok('八宅表单元格渲染适宜/避免', /适宜|避免/.test(g('mgDirs').innerHTML), g('mgDirs').innerHTML.slice(0, 80));
  g('bTown').value = g('bTown').options[0].value;
  g('bTown').onchange.call(g('bTown'));
  await sleep(1100);
  ok('级联定位徽标含精度标注', /级联定位（在线·到乡镇）/.test(g('bSrc').textContent), g('bSrc').textContent);

  console.log('\n=== E2E PASS ' + pass + ' / FAIL ' + fail + ' ===');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('E2E 运行异常:', e); process.exit(1); });
