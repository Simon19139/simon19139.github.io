# -*- coding: utf-8 -*-
"""4Dview 节点1算法层验证：独立实现，产出标准答案（不依赖页面代码）
覆盖：夏令时还原、真太阳时(经度+均时差)、日出日落(NOAA)、命卦(东西四命)、二十四山向方位角
"""
import math, json

# ---------- 中国夏令时 1986-1991（UTC+9），表中为当年官方时钟时刻 ----------
DST = [
    (1986, 5, 4, 2, 0, 1986, 9, 14, 2, 0),
    (1987, 4, 12, 2, 0, 1987, 9, 13, 2, 0),
    (1988, 4, 10, 2, 0, 1988, 9, 11, 2, 0),
    (1989, 4, 16, 2, 0, 1989, 9, 17, 2, 0),
    (1990, 4, 15, 2, 0, 1990, 9, 16, 2, 0),
    (1991, 4, 14, 2, 0, 1991, 9, 15, 2, 0),
]
def is_dst(y, mo, d, h, mi):
    t = (((y*13+mo)*32+d)*24+h)*60+mi
    for (y1,m1,d1,h1,i1,y2,m2,d2,h2,i2) in DST:
        a = (((y1*13+m1)*32+d1)*24+h1)*60+i1
        b = (((y2*13+m2)*32+d2)*24+h2)*60+i2
        if a <= t < b: return True
    return False

def to_standard(y, mo, d, h, mi):
    """官方时钟 -> 东八区标准时；返回(年,月,日,时,分,是否夏令时)"""
    import datetime
    dt = datetime.datetime(y, mo, d, h, mi)
    if is_dst(y, mo, d, h, mi):
        dt -= datetime.timedelta(hours=1)
        return dt.year, dt.month, dt.day, dt.hour, dt.minute, True
    return y, mo, d, h, mi, False

# ---------- NOAA 均时差 / 赤纬 ----------
def gamma(y, mo, d, h=12, mi=0):
    import datetime
    doy = datetime.datetime(y,mo,d).timetuple().tm_yday
    return 2*math.pi/365.0*(doy + (h-12)/24.0 + mi/1440.0)

def eqtime(g):
    return 229.18*(0.000075 + 0.001868*math.cos(g) - 0.032077*math.sin(g)
                   - 0.014615*math.cos(2*g) - 0.040849*math.sin(2*g))

def decl(g):
    return (0.006918 - 0.399912*math.cos(g) + 0.070257*math.sin(g)
            - 0.006758*math.cos(2*g) + 0.000907*math.sin(2*g)
            - 0.002697*math.cos(3*g) + 0.00148*math.sin(3*g))

def true_solar(y, mo, d, h, mi, lon):
    """标准时(已还夏令时)+经度 -> 真太阳时；返回(时分min, 均时差min, 经度修正min, 跨日偏移day)"""
    g = gamma(y, mo, d, h, mi)
    eot = eqtime(g)
    lon_corr = (lon - 120.0)*4.0
    total = h*60 + mi + lon_corr + eot
    day_shift = math.floor(total/1440)
    return total - day_shift*1440, eot, lon_corr, day_shift

def sunrise_sunset(y, mo, d, lat, lon):
    """返回(日出min, 日落min) 东八区标准时钟"""
    g = gamma(y, mo, d)
    eot, de = eqtime(g), decl(g)
    phi = math.radians(lat)
    cosH = (math.cos(math.radians(90.833))/(math.cos(phi)*math.cos(de))
            - math.tan(phi)*math.tan(de))
    if cosH > 1: return None, None, '极夜'
    if cosH < -1: return None, None, '极昼'
    H = math.degrees(math.acos(cosH))
    noon_utc = 720 - 4*lon - eot            # 正午(UTC分钟)
    sr = noon_utc - 4*H + 480               # 转东八区
    ss = noon_utc + 4*H + 480
    return sr, ss, ''

# ---------- 命卦 ----------
def ming_gua(year_lichan, gender):
    """year_lichan: 立春归属年(干支年); gender 'M'/'F' -> (数,卦,东西四)"""
    yy = year_lichan % 100
    if year_lichan >= 2000:
        n = (99 - yy) % 9 if gender=='M' else (yy + 6) % 9
    else:
        n = (100 - yy) % 9 if gender=='M' else (yy - 4) % 9
    if n == 0: n = 9
    if n == 5:
        gua = '坤' if gender=='M' else '艮'
    else:
        gua = {1:'坎',2:'坤',3:'震',4:'巽',6:'乾',7:'兑',8:'艮',9:'离'}[n]
    group = '东四命' if gua in '坎离震巽' else '西四命'
    return n, gua, group

# ---------- 二十四山向 ----------
SHAN24 = ['子','癸','丑','艮','寅','甲','卯','乙','辰','巽','巳','丙',
          '午','丁','未','坤','申','庚','酉','辛','戌','乾','亥','壬']
GONG8 = {'壬':'坎','子':'坎','癸':'坎','丑':'艮','艮':'艮','寅':'艮',
         '甲':'震','卯':'震','乙':'震','辰':'巽','巽':'巽','巳':'巽',
         '丙':'离','午':'离','丁':'离','未':'坤','坤':'坤','申':'坤',
         '庚':'兑','酉':'兑','辛':'兑','戌':'乾','乾':'乾','亥':'乾'}
def bearing(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dl = math.radians(lon2-lon1)
    x = math.sin(dl)*math.cos(p2)
    yv = math.cos(p1)*math.sin(p2) - math.sin(p1)*math.cos(p2)*math.cos(dl)
    return (math.degrees(math.atan2(x, yv)) + 360) % 360

def dist_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2-lat1), math.radians(lon2-lon1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 6371.0*2*math.asin(math.sqrt(a))

def shan_of(theta):
    i = int(math.floor(((theta + 7.5) % 360) / 15.0))
    return SHAN24[i], GONG8[SHAN24[i]]

def fmt(m):
    m = round(m); return f"{m//60:02d}:{m%60:02d}"

# ================= 用例 =================
out = {}
ORIGIN = (34.540833, 108.923611)  # 中国大地原点(泾阳永乐镇)

# --- 真太阳时 ---
cases_tst = [
    ("T1 武汉1990-06-22 08:00", 1990,6,22,8,0, 114.3049),
    ("T2 北京1987-07-15 12:00(夏令时)", 1987,7,15,12,0, 116.4074),
    ("T3 上海1986-05-04 01:30(拨针前)", 1986,5,4,1,30, 121.4737),
    ("T4 上海1986-05-04 03:00(夏令时始)", 1986,5,4,3,0, 121.4737),
    ("T5 乌鲁木齐1991-09-15 01:30(夏令时末)", 1991,9,15,1,30, 87.6168),
    ("T6 乌鲁木齐1991-09-15 03:00(已结束)", 1991,9,15,3,0, 87.6168),
    ("T7 大地原点2000-01-01 00:10", 2000,1,1,0,10, 108.923611),
]
tst_res = []
for name,y,mo,d,h,mi,lon in cases_tst:
    sy,smo,sd,sh,smi,dst = to_standard(y,mo,d,h,mi)
    t,eot,lc,ds = true_solar(sy,smo,sd,sh,smi,lon)
    tst_res.append(dict(case=name, dst=dst, standard=f"{sy}-{smo:02d}-{sd:02d} {sh:02d}:{smi:02d}",
                        tst=fmt(t), eot=round(eot,2), lon_corr=round(lc,2), day_shift=ds))
out['tst'] = tst_res

# --- 日出日落 ---
cases_ss = [
    ("北京 2026-06-21", 2026,6,21, 39.9042, 116.4074),
    ("北京 2026-12-22", 2026,12,22, 39.9042, 116.4074),
    ("上海 2026-03-20", 2026,3,20, 31.2304, 121.4737),
    ("乌鲁木齐 2026-06-21", 2026,6,21, 43.8256, 87.6168),
    ("大地原点 2026-10-19", 2026,10,19, 34.540833, 108.923611),
]
ss_res = []
for name,y,mo,d,lat,lon in cases_ss:
    sr,ss,note = sunrise_sunset(y,mo,d,lat,lon)
    ss_res.append(dict(case=name, sunrise=fmt(sr) if sr else note, sunset=fmt(ss) if ss else note))
out['sun'] = ss_res

# --- 命卦 ---
cases_mg = [("1990男",1990,'M'),("1990女",1990,'F'),("2023男",2023,'M'),("2023女",2023,'F'),
            ("1985男",1985,'M'),("1985女",1985,'F'),("2000男",2000,'M'),("2000女",2000,'F'),
            ("2022男(立春前归属)",2022,'M'),("1988女",1988,'F')]
out['minggua'] = [dict(case=n, num=a, gua=b, group=c) for n,y,g in cases_mg for a,b,c in [ming_gua(y,g)]]

# --- 山向 ---
cases_shan = [
    ("北京->上海", 39.9042,116.4074, 31.2304,121.4737),
    ("大地原点->北京", 34.540833,108.923611, 39.9042,116.4074),
    ("上海->广州", 31.2304,121.4737, 23.1291,113.2644),
    ("大地原点->上海", 34.540833,108.923611, 31.2304,121.4737),
    ("广州->哈尔滨", 23.1291,113.2644, 45.8038,126.5349),
]
shan_res = []
for name,a,b,c,d in cases_shan:
    th = bearing(a,b,c,d); s,g = shan_of(th)
    shan_res.append(dict(case=name, bearing=round(th,2), shan=s, gong=g, km=round(dist_km(a,b,c,d),1)))
out['shan'] = shan_res

print(json.dumps(out, ensure_ascii=False, indent=1))
with open('/Coze/Drive/Jackson/所有对话/主对话/4Dview/test/standard_answers.json','w',encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
