/* Regras compartilhadas: datas, períodos, faixas e status. Também usado pelo relatório. */
(function(g){
const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const hm  = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toMin = s => { const [h,m] = String(s).split(":").map(Number); return h*60+m; };
const fromYmd = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d, 12, 0, 0); };
const br = s => { if(!s) return ""; const [y,m,d] = s.split("-"); return `${d}/${m}/${y}`; };
const brShort = s => br(s).slice(0,5);
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const monday = d => { const x = new Date(d); const w = (x.getDay()+6)%7; x.setDate(x.getDate()-w); return x; };
const lastDay = d => new Date(d.getFullYear(), d.getMonth()+1, 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function periodOf(cl, d){
  switch(cl.freq){
    case "daily": return "D:"+ymd(d);
    case "weekly": return "W:"+ymd(monday(d));
    case "monthly": return "M:"+ymd(d).slice(0,7);
    case "fortnight": return "Q:"+ymd(d).slice(0,7)+"-"+(d.getDate()<=15?1:2);
    default: return null;
  }
}
/* janela [início, prazo] em Date para o período que contém d */
function windowOf(cl, d){
  const at = (day, s) => { const x = new Date(day); const m = toMin(s); x.setHours(Math.floor(m/60), m%60, 0, 0); return x; };
  if(cl.freq==="daily") return [at(d, cl.start), at(d, cl.due)];
  if(cl.freq==="weekly"){ const mo = monday(d); return [at(mo, cl.start), at(addDays(mo, (cl.dueDow||7)-1), cl.due)]; }
  if(cl.freq==="monthly"){ const f = new Date(d.getFullYear(), d.getMonth(), 1); return [at(f, cl.start), at(lastDay(d), cl.due)]; }
  if(cl.freq==="fortnight"){ const first = d.getDate()<=15; const f = new Date(d.getFullYear(), d.getMonth(), first?1:16); const l = first ? new Date(d.getFullYear(), d.getMonth(), 15) : lastDay(d); return [at(f, cl.start), at(l, cl.due)]; }
  return [null,null];
}
const num = v => parseFloat(String(v).replace(",", "."));
function outOfRange(it, v){
  if(v===undefined || v===null || v==="" || v==="na") return false;
  const n = num(v); if(isNaN(n)) return false;
  return (it.min!=null && n < it.min) || (it.max!=null && n > it.max) || (it.maxEx!=null && n >= it.maxEx);
}
function critText(it){
  if(it.label) return it.label;
  if(it.txt) return it.txt;
  if(it.min!=null && it.max!=null) return `${it.min} a ${it.max} °C`;
  if(it.min!=null) return `mín. ${it.min} °C`;
  if(it.max!=null) return `máx. ${it.max} °C`;
  if(it.maxEx!=null) return `abaixo de ${it.maxEx} °C`;
  return "";
}
const fmtT = v => v==="na" ? "N/A" : (v===""||v==null) ? "" : String(v).replace(".", ",")+" °C";
function catOf(id){ return (g.DEFS.CATEG||[]).find(c=>c.id===id); }
function isDev(rec, it){
  if(!rec) return false;
  if(rec.v==="nc") return true;
  if(rec.item==="prod"){ const c = catOf(rec.extra && rec.extra.cat); return c ? outOfRange(c, rec.v) : false; }
  return it ? outOfRange(it, rec.v) : false;
}
const requiredItems = cl => cl.items.filter(i => !i.optional);

/* Índice: último registro por período+checklist+item */
function indexRecords(records){
  const idx = {};
  for(const r of records){
    if(!r.period || r.period.startsWith("R:")) continue;
    const k = r.period+"|"+r.cl;
    (idx[k] = idx[k] || {})[r.item] = r;
  }
  return idx;
}
function statusOf(cl, idx, now, d){
  d = d || now;
  const per = periodOf(cl, d); const done = idx[per+"|"+cl.id] || {};
  const req = requiredItems(cl); const n = req.filter(i => done[i.id]).length;
  const [st, due] = windowOf(cl, d);
  const base = {per, n, total:req.length, answered:done, start:st, due};
  if(n>=req.length) {
    const last = Object.values(done).reduce((a,r)=> !a || r.ts>a.ts ? r : a, null);
    const late = last && new Date(last.ts) > due;
    return {...base, k: late?"late-done":"done", label: late?"Feito com atraso":"Feito", c: late?"warn":"ok", last};
  }
  if(now > due) return {...base, k:"late", label: n? `Atrasado · ${n}/${req.length}` : "Atrasado", c:"bad"};
  if(now >= st) return {...base, k: n?"partial":"open", label: n? `Em andamento · ${n}/${req.length}` : "Para fazer", c:"warn"};
  return {...base, k:"later", label:"Mais tarde", c:"idle"};
}
function stars(pct){ for(const [lim,s] of g.DEFS.STARS) if(pct>=lim) return s; return 0; }
function bolsoScore(cl, answered){
  let ok=0, tot=0, elim=false;
  for(const it of cl.items){ const r = answered[it.id]; if(!r || r.v==="na") continue; tot++; if(r.v==="ok") ok++; else if(it.elim) elim=true; }
  const pct = tot ? Math.round(ok/tot*10000)/100 : 0;
  return {ok, tot, pct, elim, stars: elim ? 0 : stars(pct)};
}
function docStatus(last, every, today){
  if(!last) return {k:"bad", label:"Sem registro", next:""};
  if(!every) return {k:"ok", label:"Em dia", next:"Não vence"};
  const next = addDays(fromYmd(last), every); const days = Math.round((next - fromYmd(ymd(today)))/864e5);
  if(days < 0) return {k:"bad", label:`Vencido há ${-days} dia${-days>1?"s":""}`, next:ymd(next), days};
  if(days <= 15) return {k:"warn", label: days===0 ? "Vence hoje" : `Vence em ${days} dia${days>1?"s":""}`, next:ymd(next), days};
  return {k:"ok", label:"Em dia", next:ymd(next), days};
}
g.CORE = {pad, ymd, hm, toMin, fromYmd, br, brShort, addDays, monday, lastDay, uid, periodOf, windowOf, num, outOfRange, critText, fmtT, isDev, catOf, indexRecords, statusOf, requiredItems, stars, bolsoScore, docStatus};
})(typeof window!=="undefined"?window:globalThis);
