/* 节点2/3：JS核心 vs Python标准答案 逐字段断言 */
const C = require('../assets/4dview-core.js');
const std = require('./standard_answers.json');
let pass = 0, fail = 0;
function eq(name, got, want, tol) {
  const ok = (typeof want === 'number' && tol !== undefined) ? Math.abs(got - want) <= tol : got === want;
  if (ok) { pass++; } else { fail++; console.log(`FAIL ${name}: got=${JSON.stringify(got)} want=${JSON.stringify(want)}`); }
}
// --- 真太阳时 ---
const tstCases = [
  [1990,6,22,8,0, 114.3049, std.tst[0]],
  [1987,7,15,12,0, 116.4074, std.tst[1]],
  [1986,5,4,1,30, 121.4737, std.tst[2]],
  [1986,5,4,3,0, 121.4737, std.tst[3]],
  [1991,9,15,1,30, 87.6168, std.tst[4]],
  [1991,9,15,3,0, 87.6168, std.tst[5]],
  [2000,1,1,0,10, 108.923611, std.tst[6]],
];
tstCases.forEach(([y,mo,d,h,mi,lon,w],i)=>{
  const s = C.toStandard(y,mo,d,h,mi);
  eq(`T${i+1}.dst`, s.dst, w.dst);
  eq(`T${i+1}.standard`, C.fmtMs(s.ms), w.standard);
  const t = C.trueSolar(s.ms, lon);
  eq(`T${i+1}.tst`, C.fmtMin(t.minutes), w.tst);
  eq(`T${i+1}.eot`, t.eot, w.eot, 0.01);
  eq(`T${i+1}.lonCorr`, t.lonCorr, w.lon_corr, 0.01);
  const dayShift = Math.round((t.ms - s.ms - (t.lonCorr+t.eot)*60000)/86400000) + (new Date(t.ms).getUTCDate()!==new Date(s.ms).getUTCDate()? -1:0);
  // 直接比较日期分量
  const sp=C.parts(s.ms), tp=C.parts(t.ms);
  const shiftDays = Math.round((Date.UTC(tp[0],tp[1]-1,tp[2]) - Date.UTC(sp[0],sp[1]-1,sp[2]))/86400000);
  eq(`T${i+1}.dayShift`, shiftDays, w.day_shift);
  eq(`T${i+1}.shichen`, C.shichenOf(t.minutes), ['卯','巳','丑','丑','亥','子','子'][i]); // 06:35卯 10:40巳 01:39丑 02:09丑 22:25亥 00:55子(早) 23:23子(晚)
});
// --- 日出日落 ---
const sunCases = [
  [2026,6,21,39.9042,116.4074, std.sun[0]],
  [2026,12,22,39.9042,116.4074, std.sun[1]],
  [2026,3,20,31.2304,121.4737, std.sun[2]],
  [2026,6,21,43.8256,87.6168, std.sun[3]],
  [2026,10,19,34.540833,108.923611, std.sun[4]],
];
sunCases.forEach(([y,mo,d,lat,lon,w],i)=>{
  const r = C.sunriseSunset(y,mo,d,lat,lon);
  eq(`S${i+1}.sunrise`, C.fmtMin(r.sunrise), w.sunrise);
  eq(`S${i+1}.sunset`, C.fmtMin(r.sunset), w.sunset);
});
// --- 命卦 ---
const mgCases = [
  [1990,'M',std.minggua[0]],[1990,'F',std.minggua[1]],[2023,'M',std.minggua[2]],[2023,'F',std.minggua[3]],
  [1985,'M',std.minggua[4]],[1985,'F',std.minggua[5]],[2000,'M',std.minggua[6]],[2000,'F',std.minggua[7]],
  [2022,'M',std.minggua[8]],[1988,'F',std.minggua[9]],
];
mgCases.forEach(([y,g,w],i)=>{
  const r = C.mingGua(y,g);
  eq(`M${i+1}.num`, r.num, w.num);
  eq(`M${i+1}.gua`, r.gua, w.gua);
  eq(`M${i+1}.group`, r.group, w.group);
});
// 命卦八向抽查：坎命 生气巽(东南) 绝命坤(西南); 兑命 生气乾(西北)
const k = C.mingGua(1990,'M');
const kMap = Object.fromEntries(k.dirs.map(x=>[x.luck,x.gong]));
eq('坎命.生气', kMap['生气'], '巽'); eq('坎命.绝命', kMap['绝命'], '坤'); eq('坎命.伏位', kMap['伏位'], '坎'); eq('坎命.天医', kMap['天医'], '震');
const d = C.mingGua(1981,'M'); // 1981男=(100-81)%9=1? 19%9=1 坎... 改兑命用1984? (100-84)%9=7 兑
const dui = C.mingGua(1984,'M');
eq('1984男', dui.gua, '兑');
const dMap = Object.fromEntries(dui.dirs.map(x=>[x.luck,x.gong]));
eq('兑命.生气', dMap['生气'], '乾'); eq('兑命.五鬼', dMap['五鬼'], '离'); eq('兑命.天医', dMap['天医'], '坤');
// --- 山向 ---
const shanCases = [
  [39.9042,116.4074, 31.2304,121.4737, std.shan[0]],
  [34.540833,108.923611, 39.9042,116.4074, std.shan[1]],
  [31.2304,121.4737, 23.1291,113.2644, std.shan[2]],
  [34.540833,108.923611, 31.2304,121.4737, std.shan[3]],
  [23.1291,113.2644, 45.8038,126.5349, std.shan[4]],
];
shanCases.forEach(([a,b,c,e,w],i)=>{
  const th = C.bearing(a,b,c,e);
  eq(`H${i+1}.bearing`, th, w.bearing, 0.01);
  const s = C.shanOf(th);
  eq(`H${i+1}.shan`, s.shan, w.shan);
  eq(`H${i+1}.gong`, s.gong, w.gong);
  eq(`H${i+1}.km`, C.distKm(a,b,c,e), w.km, 0.1);
});
// --- GCJ 往返 ---
const g = C.wgs2gcj(34.540833,108.923611);
const w = C.gcj2wgs(g[0],g[1]);
eq('gcj.roundtrip.lat', w[0], 34.540833, 1e-6);
eq('gcj.roundtrip.lon', w[1], 108.923611, 1e-6);
// --- 立春归属年 ---
const L = require('../assets/lunar.js');
const ms = (y,mo,d,h,mi)=>Date.UTC(y,mo-1,d,h,mi);
eq('lichun.2023-02-03', C.lichunYear(L.Lunar, ms(2023,2,3,12,0)), 2022);
eq('lichun.2023-02-05', C.lichunYear(L.Lunar, ms(2023,2,5,12,0)), 2023);
eq('lichun.2024-02-04 16:00', C.lichunYear(L.Lunar, ms(2024,2,4,16,0)), 2023); // 立春2024-02-04 16:27
eq('lichun.2024-02-04 17:00', C.lichunYear(L.Lunar, ms(2024,2,4,17,0)), 2024);
eq('lichun.2024-01-15', C.lichunYear(L.Lunar, ms(2024,1,15,8,0)), 2023);
// --- 晚子时换日 / 早子时 ---
const early = L.Lunar.fromDate(new Date(2020,0,15,0,30));
const late  = L.Lunar.fromDate(new Date(2020,0,15,23,45));
const nextDay = L.Lunar.fromDate(new Date(2020,0,16,12,0));
eq('早子时日柱=当日', early.getDayInGanZhi(), L.Lunar.fromDate(new Date(2020,0,15,12,0)).getDayInGanZhi());
eq('晚子时日柱=次日(Exact)', late.getDayInGanZhiExact(), nextDay.getDayInGanZhi());
// --- 佛历/道历节日识别 ---
const fo = L.Lunar.fromYmd(2026,4,8).getFoto();
eq('佛诞.四月初八', fo.getFestivals().map(f=>f.getName?f.getName():f.toString()).join('|').includes('释迦牟尼佛诞'), true);
eq('佛历年=农历年+544', L.Lunar.fromYmd(2026,4,8).getFoto().getYear(), 2570);
const ta = L.Lunar.fromYmd(2026,1,9).getTao();
eq('道诞.正月初九', ta.getFestivals().map(f=>f.getName?f.getName():f.toString()).join('|').includes('玉皇上帝圣诞'), true);
console.log(`\n=== PASS ${pass} / FAIL ${fail} ===`);
process.exit(fail?1:0);
