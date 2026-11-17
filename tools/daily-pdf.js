// ===== Bazi engine (wealth-focused) =====
const STEMS = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const STEM_PY = ['Jia','Yi','Bing','Ding','Wu','Ji','Geng','Xin','Ren','Gui'];
const BR = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const BR_PY = ['Zi','Chou','Yin','Mao','Chen','Si','Wu','Wei','Shen','You','Xu','Hai'];
const ANIMAL = ['Rat','Ox','Tiger','Rabbit','Dragon','Snake','Horse','Goat','Monkey','Rooster','Dog','Pig'];
const EL = ['Wood','Fire','Earth','Metal','Water'];
const EL_ZH = ['木','火','土','金','水'];
const BR_EL = [4,2,0,0,2,1,1,2,3,3,2,4];
const HIDDEN = [[9],[5,9,7],[0,2,4],[1],[4,1,9],[2,4,6],[3,5],[5,3,1],[6,8,4],[7],[4,7,3],[8,0]];
const HW = {1:[1],2:[0.7,0.3],3:[0.6,0.3,0.1]};
const mod = (a,n) => ((a % n) + n) % n;
const stemEl = s => Math.floor(s/2);
const stemYang = s => s % 2 === 0;
const idx60 = (s,b) => mod(6*s - 5*b, 60);

// ---- time ----
function jdnCivil(y,m,d){
  const a=Math.floor((14-m)/12), yy=y+4800-a, mm=m+12*a-3;
  return d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;
}
const jdFromMs = ms => ms/86400000 + 2440587.5;
const msFromJd = jd => (jd-2440587.5)*86400000;
function deltaT(y){
  const t=y-2000;
  if(y>=2005) return 62.92+0.32217*t+0.005589*t*t;
  if(y>=1986) return 63.86+0.3345*t-0.060374*t*t+0.0017275*t**3+0.000651814*t**4+0.00002373599*t**5;
  if(y>=1961){const u=y-1975; return 45.45+1.067*u-u*u/260-u**3/718;}
  if(y>=1941){const u=y-1950; return 29.07+0.407*u-u*u/233+u**3/2547;}
  if(y>=1920){const u=y-1920; return 21.20+0.84493*u-0.0761*u*u+0.0020936*u**3;}
  if(y>=1900){const u=y-1900; return -2.79+1.494119*u-0.0598939*u*u+0.0061966*u**3-0.000197*u**4;}
  const u=(y-1820)/100; return -20+32*u*u;
}
function sunLon(jdUT){
  const yr=2000+(jdUT-2451545)/365.25;
  const jd=jdUT+deltaT(yr)/86400;
  const T=(jd-2451545)/36525, r=Math.PI/180;
  const L0=280.46646+36000.76983*T+0.0003032*T*T;
  const M=(357.52911+35999.05029*T-0.0001537*T*T)*r;
  const C=(1.914602-0.004817*T-0.000014*T*T)*Math.sin(M)+(0.019993-0.000101*T)*Math.sin(2*M)+0.000289*Math.sin(3*M);
  const om=(125.04-1934.136*T)*r;
  return mod(L0+C-0.00569-0.00478*Math.sin(om),360);
}
function findLon(target, jdGuess){
  let jd=jdGuess;
  for(let i=0;i<60;i++){
    const d=mod(target-sunLon(jd)+180,360)-180;
    jd+=d/0.98564736;
    if(Math.abs(d)<1e-7) break;
  }
  return jd;
}
// "Jie" terms that start each solar month: 15°+30k
function prevJie(jd){ const l=sunLon(jd); const t=mod(15+30*Math.floor((l-15)/30),360); return {jd:findLon(t, jd-mod(l-t,360)/0.9856), lon:t}; }
function nextJie(jd){ const l=sunLon(jd); const t=mod(15+30*(Math.floor((l-15)/30)+1),360); return {jd:findLon(t, jd+mod(t-l,360)/0.9856), lon:t}; }

// time zone offset (minutes) for an IANA zone at a UTC instant
const _fmtCache={};
function tzOffsetMin(tz, ms){
  if(typeof tz==='number') return tz*60;
  const f=_fmtCache[tz]||(_fmtCache[tz]=new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'numeric',day:'numeric',hour:'numeric',minute:'numeric',second:'numeric'}));
  const p={}; f.formatToParts(new Date(ms)).forEach(x=>p[x.type]=x.value);
  const asUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour%24,+p.minute,+p.second);
  return Math.round((asUTC-ms)/60000);
}
function localToUtcMs(y,m,d,h,mi,tz){
  const naive=Date.UTC(y,m-1,d,h,mi);
  let off=tzOffsetMin(tz,naive);
  off=tzOffsetMin(tz,naive-off*60000);
  return {ms:naive-off*60000, off};
}
function eotMin(ms){ // equation of time (minutes)
  const dt=new Date(ms); const start=Date.UTC(dt.getUTCFullYear(),0,0);
  const N=(ms-start)/86400000; const B=2*Math.PI*(N-81)/364;
  return 9.87*Math.sin(2*B)-7.53*Math.cos(B)-1.5*Math.sin(B);
}

// ---- pillars ----
function yearMonthFromJd(jd, gYear, gMonth){
  const l=sunLon(jd);
  const m=Math.floor(mod(l-315,360)/30); // 0 = Yin month
  let by=gYear; if(gMonth<=2 && m>=10) by=gYear-1;
  if(gMonth>=11 && m<=1) by=gYear; // safety
  const yi=mod(by-4,60), ys=yi%10;
  const ms=mod((ys%5)*2+2+m,10), mb=(m+2)%12;
  return {year:{s:ys,b:yi%12}, month:{s:ms,b:mb}, baziYear:by, monthNo:m};
}
function dayPillarCivil(y,m,d){ const i=mod(jdnCivil(y,m,d)+49,60); return {s:i%10,b:i%12}; }
function hourPillar(dayStem, hb){ return {s:((dayStem%5)*2+hb)%10, b:hb}; }

/* opts: {y,m,d,h,mi, timeKnown, tz, lon, solar:'clock'|'mean'|'true', zi:'early'|'midnight', gender:'M'|'F'} */
function computeChart(o){
  const h=o.timeKnown?o.h:12, mi=o.timeKnown?o.mi:0;
  const {ms,off}=localToUtcMs(o.y,o.m,o.d,h,mi,o.tz);
  const jd=jdFromMs(ms);
  let effMs=ms+off*60000, solarNote=null;
  if(o.lon!=null && !isNaN(o.lon)){
    const meanMs=ms+o.lon/15*3600000;
    const trueMs=meanMs+eotMin(ms)*60000;
    solarNote={meanMs,trueMs,clockMs:ms+off*60000,offMin:off};
    if(o.solar==='mean') effMs=meanMs; else if(o.solar==='true') effMs=trueMs;
  }
  const e=new Date(effMs);
  const ey=e.getUTCFullYear(), em=e.getUTCMonth()+1, ed=e.getUTCDate(), eh=e.getUTCHours(), emi=e.getUTCMinutes();
  const ym=yearMonthFromJd(jd, o.y, o.m);
  let dj=jdnCivil(ey,em,ed);
  const late=o.timeKnown && eh===23;
  const dIdx=mod(dj+(late&&o.zi==='early'?1:0)+49,60);
  const day={s:dIdx%10,b:dIdx%12};
  let hour=null;
  if(o.timeKnown){
    const hb=Math.floor((eh+1)/2)%12;
    const stemDay= late ? mod(dj+1+49,60)%10 : day.s;
    hour=hourPillar(stemDay,hb);
  }
  const chart={input:o, utcMs:ms, offMin:off, effMs, solarNote, eff:{y:ey,m:em,d:ed,h:eh,mi:emi},
    pillars:{year:ym.year, month:ym.month, day, hour}, dm:day.s, gender:o.gender};
  // boundary warnings
  chart.warnings=[];
  const pj=prevJie(jd), nj=nextJie(jd);
  const hrsPrev=(jd-pj.jd)*24, hrsNext=(nj.jd-jd)*24;
  if(hrsPrev<3||hrsNext<3) chart.warnings.push(`Birth is within ${Math.min(hrsPrev,hrsNext).toFixed(1)} hours of a solar-term change, so the month pillar is sensitive to the exact birth time.`);
  if(o.timeKnown){ const mins=eh*60+emi; const into=mod(mins-(eh%2===1?eh:eh-1)*60,120); if(into<8||into>112) chart.warnings.push('Birth time is within 8 minutes of an hour-pillar boundary; confirm the exact time.'); }
  if(solarNote && o.timeKnown){
    const alt = o.solar==='clock' ? solarNote.trueMs : solarNote.clockMs;
    const a=new Date(alt); const ah=a.getUTCHours();
    const altHb=Math.floor((ah+1)/2)%12;
    if(hour && altHb!==hour.b) chart.warnings.push(o.solar==='clock'
      ? `With true-solar-time correction for this longitude the hour would be ${BR[altHb]} ${BR_PY[altHb]} instead of ${BR[hour.b]} ${BR_PY[hour.b]}${ah===23||eh===23?' (and the day pillar may also change)':''}. Schools differ; most commercial readings use clock time.`
      : `By clock time the hour would be ${BR[altHb]} ${BR_PY[altHb]}. Most commercial readings use clock time.`);
  }
  chart.jd=jd;
  analyse(chart);
  luckPillars(chart, jd, pj, nj);
  return chart;
}

// ---- Ten Gods ----
const TG = [
 {k:'F', en:'Friend', zh:'比肩'}, {k:'RW', en:'Rob Wealth', zh:'劫财'},
 {k:'EG', en:'Eating God', zh:'食神'}, {k:'HO', en:'Hurting Officer', zh:'伤官'},
 {k:'IW', en:'Indirect Wealth', zh:'偏财'}, {k:'DW', en:'Direct Wealth', zh:'正财'},
 {k:'7K', en:'Seven Killings', zh:'七杀'}, {k:'DO', en:'Direct Officer', zh:'正官'},
 {k:'IR', en:'Indirect Resource', zh:'偏印'}, {k:'DR', en:'Direct Resource', zh:'正印'}];
function tenGod(dm, s){
  const rel=mod(stemEl(s)-stemEl(dm),5); // 0 same,1 I produce,2 I control,3 controls me,4 produces me
  const same=stemYang(s)===stemYang(dm);
  return TG[rel*2+(same?0:1)];
}

// ---- analysis ----
function analyse(c){
  const P=c.pillars, dm=c.dm, dEl=stemEl(dm);
  const sc=[0,0,0,0,0];
  const stems=[P.year,P.month,P.day,P.hour].filter(Boolean);
  stems.forEach(p=>sc[stemEl(p.s)]+=1);
  const bw={year:1,month:2.5,day:1.3,hour:1};
  for(const k of ['year','month','day','hour']){
    const p=P[k]; if(!p) continue;
    const hs=HIDDEN[p.b], w=HW[hs.length];
    hs.forEach((s,i)=>sc[stemEl(s)]+=bw[k]*w[i]);
  }
  const total=sc.reduce((a,b)=>a+b,0);
  const comp=dEl, res=mod(dEl-1,5), out=mod(dEl+1,5), wea=mod(dEl+2,5), off=mod(dEl+3,5);
  const support=sc[comp]+sc[res], pct=support/total;
  let label = pct>=0.62?'Very strong':pct>=0.5?'Strong':pct>=0.42?'Slightly weak':pct>=0.3?'Weak':'Very weak';
  const strong=pct>=0.5;
  const fav=[0,0,0,0,0];
  let favOrder, unfOrder;
  if(strong){
    favOrder = sc[res]>sc[comp] ? [wea,out,off] : [off,wea,out];
    // for wealth focus, Output feeds Wealth: ensure Wealth is in top 2
    if(favOrder.indexOf(wea)>1) favOrder=[favOrder[0],wea,favOrder[1]];
    unfOrder = sc[res]>sc[comp] ? [res,comp] : [comp,res];
    fav[favOrder[0]]=2; fav[favOrder[1]]=1.5; fav[favOrder[2]]=1;
    fav[unfOrder[0]]=-1.6; fav[unfOrder[1]]=-1.1;
  } else {
    const drains=[out,wea,off].sort((a,b)=>sc[b]-sc[a]);
    favOrder = drains[0]===off ? [res,comp] : [comp,res];
    unfOrder = drains;
    fav[favOrder[0]]=2; fav[favOrder[1]]=1.5;
    fav[drains[0]]=-1.7; fav[drains[1]]=-1.2; fav[drains[2]]=-0.7;
  }
  const monthMain=HIDDEN[P.month.b][0];
  const inSeason=[comp,res].includes(stemEl(monthMain));
  // wealth structure
  const wealthCount=[];
  for(const k of ['year','month','day','hour']){
    const p=P[k]; if(!p) continue;
    if(k!=='day' && stemEl(p.s)===wea) wealthCount.push({where:k,pos:'stem',tg:tenGod(dm,p.s)});
    HIDDEN[p.b].forEach((s,i)=>{ if(stemEl(s)===wea) wealthCount.push({where:k,pos:i===0?'main hidden':'hidden',tg:tenGod(dm,s)}); });
  }
  const vault=[7,10,4,1,4][wea]; // tomb branch of wealth element: Wood未 Fire戌 Earth辰 Metal丑 Water辰
  c.an={sc,total,pct,label,strong,fav,favOrder,unfOrder,inSeason,
        roles:{comp,res,out,wea,off}, wealthCount, vault,
        noble:NOBLE[dm], monthMain};
}
const NOBLE=[[1,7],[0,8],[11,9],[11,9],[1,7],[0,8],[1,7],[2,6],[3,5],[3,5]];
const PEACH=b=>[9,6,3,0][b%4]; // 申子辰->酉, 巳酉丑->午, 寅午戌->卯, 亥卯未->子
const HORSE=b=>[2,11,8,5][b%4];
function _peachFix(b){ return {0:9,4:9,8:9, 1:6,5:6,9:6, 2:3,6:3,10:3, 3:0,7:0,11:0}[b]; }
function _horseFix(b){ return {0:2,4:2,8:2, 1:11,5:11,9:11, 2:8,6:8,10:8, 3:5,7:5,11:5}[b]; }

// ---- luck pillars ----
function luckPillars(c, jd, pj, nj){
  if(!c.gender){ c.luck=null; return; }
  const yYang=stemYang(c.pillars.year.s);
  const fwd=(yYang&&c.gender==='M')||(!yYang&&c.gender==='F');
  const days=fwd?(nj.jd-jd):(jd-pj.jd);
  const startYears=days/3;
  const mi=idx60(c.pillars.month.s,c.pillars.month.b);
  const list=[];
  for(let i=1;i<=9;i++){
    const k=mod(mi+(fwd?i:-i),60);
    const ageStart=startYears+10*(i-1);
    const startMs=c.utcMs+ageStart*365.2422*86400000;
    list.push({s:k%10,b:k%12,ageStart,startMs,endMs:startMs+10*365.2422*86400000});
  }
  c.luck={fwd,startYears,list};
}

// ---- interactions between a period pillar and the natal chart ----
const COMBO6_EL={'0-1':2,'2-11':0,'3-10':1,'4-9':3,'5-8':4,'6-7':1};
const SAN_HE_EL=[4,3,1,0]; // by b%4: 0 Water(申子辰),1 Metal(巳酉丑),2 Fire(寅午戌),3 Wood(亥卯未)
const PUNISH=[[2,5],[5,8],[2,8],[1,10],[10,7],[1,7],[0,3]];
const isClash=(a,b)=>mod(a-b,12)===6;
const isCombo=(a,b)=>mod(a+b,12)===1 && a!==b;
const isHarm=(a,b)=>mod(a+b,12)===7 && a!==b;
const isPunish=(a,b)=>PUNISH.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a)) || (a===b && [4,6,9,11].includes(a));
const stemCombo=(a,b)=>Math.abs(a-b)===5;
const stemComboEl=(a,b)=>[2,3,4,0,1][Math.min(a,b)];
const stemClash=(a,b)=>Math.abs(a-b)===6 && Math.min(a,b)<4;
const PNAME={year:'Year',month:'Month',day:'Day',hour:'Hour'};
const PAREA={year:'social circle, outside clients and the wider market',month:'career, employer and industry environment',day:'yourself, spouse and closest partners',hour:'projects, subordinates and future pipeline'};

function interactions(c, p){
  const out=[]; const P=c.pillars, dm=c.dm, an=c.an;
  for(const k of ['year','month','day','hour']){
    const q=P[k]; if(!q) continue;
    if(isClash(p.b,q.b)) out.push({type:'clash',k,w:k==='day'?-0.8:k==='month'?-0.45:k==='year'?-0.4:-0.25,
      text:`${BR[p.b]} clashes your ${PNAME[k]} branch ${BR[q.b]} (${ANIMAL[q.b]}): movement and disruption in ${PAREA[k]}.`});
    if(isCombo(p.b,q.b)){ const key=[p.b,q.b].sort((a,b)=>a-b).join('-'); const el=COMBO6_EL[key];
      out.push({type:'combo',k,w:(k==='day'?0.35:0.2)+0.15*an.fav[el],el,
      text:`${BR[p.b]} combines with your ${PNAME[k]} branch ${BR[q.b]} into ${EL[el]}: cooperation and agreements through ${PAREA[k]}.`});}
    if(isHarm(p.b,q.b)) out.push({type:'harm',k,w:k==='day'?-0.3:-0.15,text:`${BR[p.b]} harms your ${PNAME[k]} branch ${BR[q.b]}: hidden friction or misunderstandings in ${PAREA[k]}.`});
    if(isPunish(p.b,q.b)) out.push({type:'punish',k,w:k==='day'?-0.3:-0.15,text:`${BR[p.b]} punishes your ${PNAME[k]} branch ${BR[q.b]}: watch legal, compliance and paperwork issues in ${PAREA[k]}.`});
  }
  if(stemCombo(p.s,dm)){ const el=stemComboEl(p.s,dm); out.push({type:'scombo',k:'day',w:0.3,text:`${STEMS[p.s]} combines with your Day Master ${STEMS[dm]}: you are drawn to an offer or a person.`}); }
  if(stemClash(p.s,dm)) out.push({type:'sclash',k:'day',w:-0.4,text:`${STEMS[p.s]} clashes your Day Master ${STEMS[dm]}: pressure on you personally; avoid rash decisions.`});
  if(an.noble.includes(p.b)) out.push({type:'noble',k:'',w:0.5,text:`${BR[p.b]} ${ANIMAL[p.b]} is your Nobleman (天乙贵人): helpful people and introductions.`});
  if(p.b===an.vault) out.push({type:'vault',k:'',w:0.35,text:`${BR[p.b]} is your Wealth Vault (财库): good for saving, collecting and storing money.`});
  if(an.vault!=null && isClash(p.b,an.vault) && Object.values(P).some(q=>q&&q.b===an.vault)) out.push({type:'vaultopen',k:'',w:0.3,text:`${BR[p.b]} clashes open your natal Wealth Vault ${BR[an.vault]}: money moves in and out; big transactions likely.`});
  // three harmony completion with natal branches
  const nb=Object.values(P).filter(Boolean).map(q=>q.b);
  const grp=[0,1,2].map(i=>mod(p.b%4+4*i,12)); // all 3 branches of the frame
  const g=[p.b%4, p.b%4+4, p.b%4+8];
  const have=g.filter(x=>x===p.b||nb.includes(x));
  if(have.length===3){ const el=SAN_HE_EL[p.b%4]; out.push({type:'sanhe',k:'',w:0.25*an.fav[el],el,text:`${BR[p.b]} completes a Three Harmony ${g.map(x=>BR[x]).join('')} ${EL[el]} frame with your chart: a strong ${EL[el]} surge.`}); }
  return out;
}

// ---- wealth scoring ----
function pillarScore(c, p){
  const an=c.an, dm=c.dm, R=an.roles;
  const hs=HIDDEN[p.b], w=HW[hs.length];
  let v=0.45*an.fav[stemEl(p.s)];
  hs.forEach((s,i)=>v+=0.55*w[i]*an.fav[stemEl(s)]);
  // wealth layer
  const elems=[{e:stemEl(p.s),wt:0.5}].concat(hs.map((s,i)=>({e:stemEl(s),wt:0.5*w[i]})));
  let wealthBonus=0;
  elems.forEach(({e,wt})=>{
    if(e===R.wea) wealthBonus+= an.strong?0.9*wt:0.35*wt;
    if(e===R.out) wealthBonus+= an.strong?0.45*wt:0.1*wt;   // output feeds wealth
    if(e===R.comp) wealthBonus+= an.strong?-0.6*wt:0.25*wt;  // rob wealth vs. support
  });
  const ints=interactions(c,p);
  let iv=ints.reduce((a,x)=>a+x.w,0);
  const raw=v+wealthBonus+iv;
  const score=Math.max(5,Math.min(95,Math.round(52+raw*13)));
  return {score, ints, stemTG:tenGod(dm,p.s), branchTG:tenGod(dm,hs[0]), raw};
}
const OFFICERS=[
 {en:'Establish',zh:'建',adj:2,good:'Starting new ventures, opening accounts, meeting decision-makers',avoid:'Moving house, ground-breaking'},
 {en:'Remove',zh:'除',adj:1,good:'Clearing debts, settling disputes, cleaning up books',avoid:'Weddings, big launches'},
 {en:'Full',zh:'满',adj:3,good:'Collecting payments, sales events, stocking up, celebrations',avoid:'Legal filings, starting litigation'},
 {en:'Balance',zh:'平',adj:0,good:'Routine work, negotiations seeking compromise',avoid:'High-stakes signing'},
 {en:'Stable',zh:'定',adj:3,good:'Signing contracts, hiring, long-term commitments',avoid:'Litigation, travel'},
 {en:'Initiate',zh:'执',adj:1,good:'Collecting debts, enforcing agreements, firm follow-ups',avoid:'Moving money out, lending'},
 {en:'Destruction',zh:'破',adj:-8,good:'Demolition, ending bad contracts',avoid:'Signing, investing, launching, lending'},
 {en:'Danger',zh:'危',adj:-3,good:'Prayer, careful review, risk audits',avoid:'Speculative trades, risky ventures'},
 {en:'Success',zh:'成',adj:5,good:'Closing deals, launches, signing, opening business',avoid:'Litigation'},
 {en:'Receive',zh:'收',adj:4,good:'Receiving payments, collecting receivables, buying assets',avoid:'Funerals, giving out loans'},
 {en:'Open',zh:'开',adj:4,good:'Grand openings, new clients, investments, starting projects',avoid:'Burials'},
 {en:'Close',zh:'闭',adj:-2,good:'Saving, consolidating, closing accounts',avoid:'Launches, new partnerships'}];
const officerOf=(dayB,monthB)=>OFFICERS[mod(dayB-monthB,12)];

// ---- period pillars for reports ----
function dayInfo(c, y,m,d, tz){
  const {ms}=localToUtcMs(y,m,d,12,0,tz);
  const ym=yearMonthFromJd(jdFromMs(ms),y,m);
  const day=dayPillarCivil(y,m,d);
  const ps=pillarScore(c,day);
  const off=officerOf(day.b, ym.month.b);
  const monthPs=pillarScore(c,ym.month);
  let score=Math.round(ps.score*0.8+monthPs.score*0.2+off.adj);
  score=Math.max(5,Math.min(95,score));
  return {y,m,d,day,month:ym.month,year:ym.year,ps,off,score,dow:new Date(Date.UTC(y,m-1,d)).getUTCDay()};
}
function hoursInfo(c,y,m,d){
  const day=dayPillarCivil(y,m,d), nextDay=dayPillarCivil(...addDays(y,m,d,1));
  const res=[];
  for(let hb=0;hb<12;hb++){
    const p=hourPillar(day.s,hb);
    res.push({hb,p,ps:pillarScore(c,p),from:mod(hb*2-1,24),to:hb*2+1});
  }
  return res;
}
function addDays(y,m,d,n){ const t=new Date(Date.UTC(y,m-1,d+n)); return [t.getUTCFullYear(),t.getUTCMonth()+1,t.getUTCDate()]; }
function daysInMonth(y,m){ return new Date(Date.UTC(y,m,0)).getUTCDate(); }
// Solar months that start in [fromMs, toMs)
function solarMonthsBetween(fromMs,toMs){
  const res=[]; let jd=jdFromMs(fromMs)-0.001;
  let j=prevJie(jdFromMs(fromMs));
  while(true){
    const n=nextJie(j.jd+0.5);
    if(msFromJd(j.jd)>=toMs) break;
    res.push({startJd:j.jd,endJd:n.jd});
    j=n;
  }
  return res;
}
function solarMonthAt(jd){ const a=prevJie(jd), b=nextJie(jd); return {startJd:a.jd,endJd:b.jd}; }
function liChun(year){ return findLon(315, jdFromMs(Date.UTC(year,1,4))); }

// ---- recommendations & outfit ----
const WEAR=[
 {main:'green, olive or teal',acc:'a green or wooden accessory',all:'green, olive, teal'},
 {main:'red, maroon or orange',acc:'a red, pink or purple accent (tie, scarf, pocket square)',all:'red, orange, pink, purple, maroon'},
 {main:'brown, beige or khaki',acc:'a brown leather belt, bag or shoes',all:'brown, beige, khaki, mustard, yellow'},
 {main:'white, grey or silver',acc:'a silver or white-gold watch or cufflinks',all:'white, grey, silver, gold'},
 {main:'black or navy',acc:'a dark blue accessory',all:'black, navy, dark blue'}];
function pillarElWeights(p){ const w=[0,0,0,0,0]; w[stemEl(p.s)]+=1; const hs=HIDDEN[p.b], hw=HW[hs.length]; hs.forEach((s,i)=>w[stemEl(s)]+=hw[i]); return w; }
function outfit(c, p){
  const an=c.an, w=pillarElWeights(p);
  const unf=[0,1,2,3,4].filter(e=>an.fav[e]<0 && w[e]>=0.6).sort((a,b)=>w[b]*-an.fav[b]-w[a]*-an.fav[a]);
  let main=an.favOrder.includes(an.roles.wea)?an.roles.wea:an.favOrder[0], why;
  why=`${EL[main]} is ${main===an.roles.wea?'your wealth element':'your most favourable element'}`;
  if(unf.length){
    const u=unf[0], ctrl=mod(u+3,5), drain=mod(u+1,5);
    const opts=[ctrl,drain].filter(e=>an.fav[e]>0).sort((a,b)=>an.fav[b]-an.fav[a]);
    if(opts.length){ main=opts[0]; why=`today is heavy in ${EL[u]}, which is unfavourable for you; ${EL[main]} ${main===ctrl?'controls':'drains'} it${main===an.roles.wea?' and is also your wealth element':''}`; }
  }
  const acc=an.favOrder.find(e=>e!==main) ?? main;
  const avoid=an.unfOrder.filter(e=>an.fav[e]<0).slice(0,2);
  return {main,acc,avoid,why,mainText:WEAR[main].main,accText:WEAR[acc].acc,avoidText:avoid.map(e=>WEAR[e].all).join(', ')};
}
const TG_TASK={
 F:['Meet a peer or partner about a joint opportunity','Agree any fee split or referral fee in writing before work starts'],
 RW:['Review bank balances and this week\'s outgoing payments','Postpone lending, guarantees and new partnership commitments'],
 EG:['Quote or package one service at your full rate','Deliver outstanding client work so it can be billed'],
 HO:['Make a pitch or sales presentation to a prospect','Have a second pair of eyes check contract wording before it goes out'],
 IW:['Follow up your largest open deal and push for a decision','Make one new prospecting call or introduction request'],
 DW:['Send outstanding invoices and chase receivables older than 30 days','Update your cash-flow forecast for the month'],
 '7K':['Push a difficult negotiation or send a firm demand letter','Prepare your walk-away terms before any tough meeting'],
 DO:['Submit tenders, licence applications or formal letters to authorities','Tidy compliance paperwork so approvals are not delayed'],
 IR:['Do due diligence on a pending deal before committing','Block time for strategy; do not rush a decision today'],
 DR:['Prepare financing, loan or property documents','Ask a mentor or senior contact for backing on a current deal']};
const OFF_TASK={Establish:'Open the new account, file or engagement you have been planning',Remove:'Settle a small debt or dispute and clear old items from your books',
 Full:'Run collections and close sales that are ready',Balance:'Use negotiation to reach a compromise on a stuck matter',Stable:'Schedule contract signings and hiring decisions',
 Initiate:'Enforce agreements: follow up overdue payments firmly',Destruction:'Do not sign or invest; use the day to end a loss-making arrangement',
 Danger:'Run a risk review; no speculative trades or large transfers',Success:'Schedule signings, launches and closing meetings today',
 Receive:'Chase and receive payments; good day to buy an asset you have already vetted',Open:'Start a new project or onboard a new client',Close:'Consolidate: move surplus cash to savings, close unused accounts'};
const EL_TASK=[
 'Start the day with planning and growth tasks; take an east-facing seat for important calls',
 'Hold key meetings in bright, warm, well-lit rooms and keep something red on your desk',
 'Work on property, records and consolidation; meet in solid, formal venues',
 'Focus on precise work: contracts, numbers and analysis; keep your workspace orderly',
 'Use the day for communication, travel and information gathering'];
function recommend(c, di, hrs){
  const an=c.an, out=[];
  const fs=favNote_(c,di.ps.stemTG), fb=favNote_(c,di.ps.branchTG);
  const lead = fs>=fb ? di.ps.stemTG : di.ps.branchTG;
  const leadFav = Math.max(fs,fb);
  if(leadFav>0) out.push({t:TG_TASK[lead.k][0],why:`${lead.en} energy is favourable for you today`});
  else out.push({t:TG_TASK.RW[0],why:`today's energy (${di.ps.stemTG.en}) is not on your side, so protect what you have`});
  out.push({t:OFF_TASK[di.off.en],why:`${di.off.en} day ${di.off.zh}`});
  if(hrs){ const b=[...hrs].sort((a,b)=>b.ps.score-a.ps.score)[0]; const pad=n=>String(n).padStart(2,'0');
    out.push({t:`Book your most important money call or meeting for ${pad(b.from)}:00–${pad((b.to+23)%24)}:59`,why:`best hour of the day (${STEMS[b.p.s]}${BR[b.p.b]}, score ${b.ps.score})`}); }
  const ints=di.ps.ints;
  if(ints.some(x=>x.type==='noble')) out.push({t:`Ask a senior contact for an introduction; people born in ${an.noble.map(b=>ANIMAL[b]).join(' or ')} years are your helpers`,why:'Nobleman day'});
  if(ints.some(x=>x.type==='vault')) out.push({t:'Move surplus cash into savings or a fixed deposit',why:'Wealth Vault day'});
  if(ints.some(x=>x.type==='vaultopen')) out.push({t:'Expect a large transaction; double-check amounts and bank details before transferring',why:'your Wealth Vault is clashed open'});
  if(ints.some(x=>x.type==='clash'&&x.k==='day')) out.push({t:'Keep partnership and family discussions calm; re-read partnership documents before acting',why:'today clashes your Day branch'});
  if(ints.some(x=>x.type==='clash'&&x.k!=='day')) out.push({t:'Expect changes from clients or the market; confirm meetings and deadlines in the morning',why:'today clashes your chart'});
  if(ints.some(x=>x.type==='punish')) out.push({t:'Review legal and compliance paperwork twice before filing or sending',why:'punishment with your chart'});
  if(ints.some(x=>x.type==='harm')) out.push({t:'Put instructions and agreements in writing to avoid misunderstandings',why:'harm with your chart'});
  if(ints.some(x=>x.type==='scombo')) out.push({t:'An offer or person will attract you; consider it, but sleep on it before committing',why:'a stem combines with your Day Master'});
  if(di.score<62){ const fe=an.favOrder[0]; out.push({t:EL_TASK[fe],why:`activates ${EL[fe]}, your most favourable element, to lift a weaker day`}); }
  if(leadFav>0 && TG_TASK[lead.k][1]) out.push({t:TG_TASK[lead.k][1],why:lead.en});
  const seen=new Set(); return out.filter(x=>!seen.has(x.t)&&seen.add(x.t)).slice(0,6);
}
function favNote_(c,tg){ const relEl={F:0,RW:0,EG:1,HO:1,IW:2,DW:2,'7K':3,DO:3,IR:4,DR:4}[tg.k]; return c.an.fav[mod(stemEl(c.dm)+relEl,5)]; }

// ===== Daily Bazi wealth PDF report generator =====
// Usage: node daily-pdf.js --date YYYY-MM-DD --birth "YYYY-MM-DD HH:MM" --gender M --tz Asia/Kuala_Lumpur --lon 101.69 --zi midnight --name "Izad" --out report.html
// Then: google-chrome --headless --no-pdf-header-footer --print-to-pdf=report.pdf report.html
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,arr)=>{ if(v.startsWith('--')) a.push([v.slice(2),arr[i+1]]); return a; },[]));
const RTZ=args.rtz||'Asia/Kuala_Lumpur';
function todayParts(){ const p={}; new Intl.DateTimeFormat('en-CA',{timeZone:RTZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(x=>p[x.type]=x.value); return {y:+p.year,m:+p.month,d:+p.day}; }
const T=args.date?(([y,m,d])=>({y,m,d}))(args.date.split('-').map(Number)):todayParts();
const [bd,bt]=(args.birth||'').split(' ');
const [by,bm,bdd]=bd.split('-').map(Number);
const timeKnown=!!bt; const [bh,bmi]=timeKnown?bt.split(':').map(Number):[12,0];
const C=computeChart({y:by,m:bm,d:bdd,h:bh,mi:bmi,timeKnown,tz:args.tz||'Asia/Kuala_Lumpur',lon:args.lon?parseFloat(args.lon):null,solar:args.solar||'clock',zi:args.zi||'midnight',gender:args.gender||'M'});
const NAME=args.name||'Your chart';

const EL_INFO=[
 {col:'green, teal',dir:'East, South-east',num:'3, 8'},{col:'red, orange, pink, purple',dir:'South',num:'2, 7'},
 {col:'yellow, brown, beige',dir:'Centre, North-east, South-west',num:'5, 0'},{col:'white, silver, gold, grey',dir:'West, North-west',num:'4, 9'},
 {col:'black, blue, navy',dir:'North',num:'1, 6'}];
const ELC=['#2F7D3B','#C9372C','#9A6B1E','#6B7280','#1D4E89'];
const TGX={
 F:{h:'Peers and competitors are active',t:'Money tends to be shared. Good for alliances with equals and networking; fees may be split.',avoid:['Sharing deal details','Loose fee splits']},
 RW:{h:'Money can leak',t:'Competitors, partners or impulsive spending can take a share. Protect cash and get terms in writing.',avoid:['Lending money','Guarantees','Speculation']},
 EG:{h:'Expertise turns into income',t:'Your skills, products and service generate money steadily. Good for creating offers and serving clients well.',avoid:['Underpricing']},
 HO:{h:'Persuasion sells',t:'Bold, persuasive energy for pitching, marketing and negotiating. Be careful with authorities and contract wording.',avoid:['Fights with regulators','Careless wording']},
 IW:{h:'Deal-making and windfall energy',t:'Commissions, investments, new markets and big-ticket opportunities. Money moves fast, in and out.',avoid:['Over-leverage']},
 DW:{h:'Steady, earned income',t:'Invoices, collections, fees and recurring revenue. Rewards discipline and diligent follow-through.',avoid:['Speculation']},
 '7K':{h:'High stakes and pressure',t:'Competition and tough counterparts. Decisive, disciplined action wins; bluffing does not.',avoid:['Confrontation without preparation']},
 DO:{h:'Recognition and formal approvals',t:'Contracts, licences, tenders and dealings with authorities go well. Reputation converts into business.',avoid:['Shortcuts']},
 IR:{h:'Strategy over sales',t:'Research, planning and unconventional insight. Money comes slower; use the time to prepare.',avoid:['Rushing deals','Ignoring cash flow']},
 DR:{h:'Backing and documents',t:'Support from mentors, financiers and paperwork. Good for approvals, property and financing.',avoid:['Neglecting sales']}};
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOWL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const pad=n=>String(n).padStart(2,'0');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pz=p=>STEMS[p.s]+BR[p.b];
const hz=p=>`<span style="color:${ELC[stemEl(p.s)]}">${STEMS[p.s]}</span><span style="color:${ELC[BR_EL[p.b]]}">${BR[p.b]}</span>`;
function band(s){ return s>=75?['#1F7A4D','Prime money day']:s>=62?['#0E6A55','Favourable']:s>=48?['#5E6460','Neutral']:s>=35?['#B7791F','Be careful']:['#B42318','Protect cash']; }
function favNote(tg){ const relEl={F:0,RW:0,EG:1,HO:1,IW:2,DW:2,'7K':3,DO:3,IR:4,DR:4}[tg.k]; const el=mod(stemEl(C.dm)+relEl,5); const f=C.an.fav[el]; return {el,f,word:f>=1.5?'strongly favourable':f>0?'favourable':f>-1.2?'mildly unfavourable':'unfavourable'}; }
function tgBlock(tg,where){ const x=TGX[tg.k], fn=favNote(tg); const caution=fn.f<0?` Because ${EL[fn.el]} is ${fn.word} for your chart, expect more effort for less return; keep commitments small.`:''; return `<p><b>${where}: ${tg.en} ${tg.zh}</b> <span class="mut">(${EL[fn.el]}, ${fn.word})</span>. ${x.h}. ${x.t}${caution}</p>`; }
function bestUses(di){ const out=[]; const o=di.off.en, s=di.ps.stemTG.k, b=di.ps.branchTG.k;
  if(['Success','Stable'].includes(o)) out.push('Sign and close'); if(['Receive','Full','Initiate'].includes(o)) out.push('Collect payments'); if(['Open','Establish'].includes(o)) out.push('Launch, new clients');
  const map={IW:'Deals and investments',DW:'Invoicing and collections',EG:'Sell your expertise',HO:'Pitch and negotiate',DO:'Tenders and approvals','7K':'Tough negotiations',DR:'Financing and paperwork',IR:'Research and due diligence',F:'Networking',RW:'Guard cash'};
  [s,b].forEach(k=>{ if(!out.includes(map[k])) out.push(map[k]); }); if(di.ps.ints.some(x=>x.type==='noble')) out.unshift('Ask for introductions'); return out.slice(0,3); }
function avoidList(d){ const a=[d.off.avoid]; TGX[d.ps.stemTG.k].avoid.forEach(x=>a.push(x)); if(d.ps.ints.some(x=>x.type==='clash'&&x.k==='day')) a.push('Partnership disputes'); return a.slice(0,4).join('; '); }

const di=dayInfo(C,T.y,T.m,T.d,RTZ);
const hrs=hoursInfo(C,T.y,T.m,T.d);
const top=[...hrs].sort((a,b)=>b.ps.score-a.ps.score).slice(0,3).map(h=>h.hb);
const fe=C.an.favOrder[0], clashB=mod(di.day.b+6,12);
const week=[]; for(let i=1;i<=7;i++){ const a=addDays(T.y,T.m,T.d,i); week.push(dayInfo(C,a[0],a[1],a[2],RTZ)); }
const [bc,bl]=band(di.score);
const REC=recommend(C,di,hrs), OUT=outfit(C,di.day);
const SW={0:'#2F7D3B',1:'#C9372C',2:'#9A6B1E',3:'#9CA3AF',4:'#1E2A44'};
const lp=luckAt(Date.now());
function luckAt(ms){ return C.luck?C.luck.list.find(l=>ms>=l.startMs&&ms<l.endMs):null; }
const P=C.pillars;
const R=C.an.roles;

const html=`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Bazi wealth report ${T.d} ${MON[T.m-1]} ${T.y}</title>
<style>
@page{size:A4;margin:14mm 14mm 14mm}
body{font:10.5pt/1.45 "IBM Plex Sans","Helvetica Neue",Arial,"Noto Sans CJK SC","Noto Sans SC",sans-serif;color:#17191C;margin:0}
h1,h2{font-family:"Noto Serif CJK SC","Noto Serif SC",Georgia,serif;margin:0}
h1{font-size:20pt} h2{font-size:12.5pt;margin:14px 0 6px;border-bottom:1px solid #DDE0DC;padding-bottom:3px}
.mut{color:#5E6460} p{margin:5px 0}
.top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #B3261E;padding-bottom:8px}
.seal{background:#B3261E;color:#fff;font:900 18pt "Noto Serif CJK SC",serif;width:38px;height:38px;display:flex;align-items:center;justify-content:center;border-radius:5px;margin-right:10px}
.hero{display:flex;gap:16px;align-items:center;margin:12px 0}
.score{width:92px;height:92px;border-radius:50%;border:8px solid ${bc};display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
.score b{font-size:24pt;line-height:1} .score span{font-size:7.5pt;color:#5E6460}
.pill{display:inline-block;border:1px solid currentColor;border-radius:99px;padding:1px 9px;font-weight:600;font-size:9.5pt}
.tag{display:inline-block;background:#E2F0EB;color:#0E6A55;border-radius:4px;padding:1px 7px;font-weight:600;font-size:9pt;margin:2px 4px 2px 0}
.tag.w{background:#FBEFD9;color:#8A5A0F}
.big{font:700 15pt "Noto Serif CJK SC",serif}
table{border-collapse:collapse;width:100%;font-size:9.5pt}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #E6E8E4}
th{font-size:8pt;text-transform:uppercase;color:#5E6460;letter-spacing:.04em}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}
.card{border:1px solid #DDE0DC;border-radius:6px;padding:7px 9px;background:#F6F7F5}
.card h4{margin:0 0 3px;font-size:7.5pt;text-transform:uppercase;color:#5E6460;letter-spacing:.05em}
.bar{display:inline-block;height:7px;border-radius:3px;vertical-align:middle;margin-right:5px}
ul{margin:4px 0;padding-left:16px} li{margin:2px 0}
.week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.wd{border-radius:6px;padding:5px;text-align:center;border:1px solid #DDE0DC}
.pillars{display:flex;gap:6px}
.pp{border:1px solid #DDE0DC;border-radius:5px;padding:3px 8px;text-align:center}
.foot{font-size:8pt;color:#5E6460;margin-top:12px;border-top:1px solid #DDE0DC;padding-top:6px}
.brk{break-inside:avoid}
ol.rec{margin:4px 0;padding-left:18px} ol.rec li{margin:3px 0}
.wear{display:grid;grid-template-columns:1.1fr 1.4fr 1.3fr;gap:8px}
.sw{width:16px;height:16px;border-radius:4px;display:inline-block;flex:none;border:1px solid rgba(0,0,0,.15)}
</style></head><body>
<div class="top"><div style="display:flex;align-items:center"><div class="seal">财</div><div><h1>Daily Wealth Report</h1><div class="mut">${esc(NAME)} · ${STEMS[C.dm]} ${STEM_PY[C.dm]} ${EL[stemEl(C.dm)]} Day Master · wealth element ${EL[R.wea]}</div></div></div>
<div style="text-align:right"><div class="big">${DOWL[di.dow]}</div><div>${T.d} ${MON[T.m-1]} ${T.y}</div></div></div>

<div class="hero"><div class="score"><b>${di.score}</b><span>wealth score</span></div>
<div><span class="pill" style="color:${bc}">${bl}</span>
<p style="margin-top:6px">Day pillar <span class="big">${hz(di.day)}</span> ${STEM_PY[di.day.s]} ${BR_PY[di.day.b]} (${ANIMAL[di.day.b]}) · <b>${di.off.en} day ${di.off.zh}</b> · Month ${pz(di.month)} · Year ${pz(di.year)}</p>
<div>${bestUses(di).map(u=>`<span class="tag ${u==='Guard cash'?'w':''}">${u}</span>`).join('')}</div></div></div>

<h2>Recommended actions today</h2>
<ol class="rec">${REC.map(r=>`<li><b>${esc(r.t)}</b> <span class="mut">— ${esc(r.why)}</span></li>`).join('')}</ol>

<h2>What to wear</h2>
<div class="wear">
<div class="card"><h4>Main colour</h4><div style="display:flex;align-items:center;gap:7px"><span class="sw" style="background:${SW[OUT.main]}"></span><b>${OUT.mainText}</b></div></div>
<div class="card"><h4>Accent</h4><div style="display:flex;align-items:center;gap:7px"><span class="sw" style="background:${SW[OUT.acc]}"></span><span>${OUT.accText}</span></div></div>
<div class="card"><h4>Avoid</h4><span>${OUT.avoidText}</span></div>
</div>
<p class="mut" style="font-size:9pt">Why: ${esc(OUT.why)}.</p>

<h2>Money themes</h2>
${tgBlock(di.ps.stemTG,'Visible (heavenly stem)')}
${tgBlock(di.ps.branchTG,'Underlying (earthly branch)')}
<p><b>${di.off.en} day:</b> good for ${di.off.good.toLowerCase()}. <b>Avoid:</b> ${avoidList(di)}.</p>

<h2>Interactions with your chart</h2>
${di.ps.ints.length?'<ul>'+di.ps.ints.map(x=>`<li style="color:${x.w<0?'#B42318':'#17191C'}"><span style="color:#17191C">${esc(x.text)}</span></li>`).join('')+'</ul>':'<p class="mut">No clashes or combinations with your natal chart today.</p>'}

<div class="grid">
<div class="card"><h4>Lucky numbers</h4><b>${EL_INFO[OUT.main].num}</b></div>
<div class="card"><h4>Face / sit towards</h4><b>${EL_INFO[fe].dir}</b></div>
<div class="card"><h4>Clashes today</h4><b>${ANIMAL[clashB]} ${BR[clashB]}</b> people may be less cooperative</div>
</div>

<div class="brk"><h2>Best hours</h2>
<table><thead><tr><th>Time</th><th>Hour pillar</th><th>Ten God</th><th>Score</th></tr></thead><tbody>
${hrs.map(h=>`<tr${top.includes(h.hb)?' style="background:#E2F0EB"':''}><td>${pad(h.from)}:00–${pad((h.to+23)%24)}:59${top.includes(h.hb)?' <b style="color:#0E6A55">Best</b>':''}</td><td><span class="big" style="font-size:11pt">${hz(h.p)}</span> ${ANIMAL[h.p.b]}</td><td>${h.ps.stemTG.en}</td><td><span class="bar" style="width:${h.ps.score*0.7}px;background:${band(h.ps.score)[0]}"></span>${h.ps.score}</td></tr>`).join('')}
</tbody></table></div>

<div class="brk"><h2>Next 7 days</h2>
<div class="week">${week.map(w=>{const [c]=band(w.score);return `<div class="wd" style="border-color:${c}"><div style="font-size:8.5pt">${DOW[w.dow]} ${w.d}</div><div class="big" style="font-size:11pt">${hz(w.day)}</div><div style="font-weight:700;color:${c}">${w.score}</div><div style="font-size:7.5pt" class="mut">${w.off.en}</div></div>`;}).join('')}</div></div>

<div class="brk"><h2>Your chart</h2>
<div class="pillars">${[['Hour',P.hour],['Day',P.day],['Month',P.month],['Year',P.year]].map(([l,p])=>`<div class="pp"><div class="mut" style="font-size:7.5pt">${l}</div><div class="big">${p?hz(p):'—'}</div></div>`).join('')}
<div style="padding-left:8px;font-size:9pt">Day Master <b>${C.an.label.toLowerCase()}</b> (${Math.round(C.an.pct*100)}% support). Favourable: ${C.an.favOrder.map(e=>`<b style="color:${ELC[e]}">${EL[e]}</b>`).join(', ')}. Unfavourable: ${C.an.unfOrder.slice(0,2).map(e=>EL[e]).join(', ')}.<br>Nobleman: ${C.an.noble.map(b=>ANIMAL[b]).join(', ')} · Wealth Vault: ${BR[C.an.vault]} ${ANIMAL[C.an.vault]}${lp?` · Luck pillar ${pz(lp)} (${tenGod(C.dm,lp.s).en})`:''}</div></div></div>

<div class="foot">Generated by Bazi Wealth Timing. Scores (0–100) are a rule-based timing guide using a simplified strength method, not financial advice.</div>
</body></html>`;
require('fs').writeFileSync(args.out||'report.html',html);
console.log(JSON.stringify({date:`${T.y}-${pad(T.m)}-${pad(T.d)}`,score:di.score,band:bl,day:pz(di.day),officer:di.off.en,uses:bestUses(di),best:hrs.filter(h=>top.includes(h.hb)).map(h=>`${pad(h.from)}:00-${pad((h.to+23)%24)}:59`),actions:REC.map(r=>r.t),wear:{main:OUT.mainText,accent:OUT.accText,avoid:OUT.avoidText}}));
