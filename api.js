/* Camada de dados: servidor (Google Apps Script) ou modo demonstração (dados de exemplo no aparelho). */
(function(g){
const C = g.CORE, D = g.DEFS;
const CFG = g.APP_CONFIG || {};
const ls = {
  get(k, d){ try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

/* ---------------- Servidor ---------------- */
function Remote(url){
  const call = async (action, payload={}) => {
    const res = await fetch(url, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({action, ...payload})});
    if(!res.ok) throw new Error("Servidor respondeu "+res.status);
    const j = await res.json();
    if(!j.ok) { const e = new Error(j.error || "Erro no servidor"); e.code = j.code; throw e; }
    return j.data;
  };
  const OUT = "rotina-outbox";
  async function flush(token){
    const box = ls.get(OUT, []); if(!box.length) return 0;
    let sent = 0;
    for(const job of box.slice()){
      try{ await call("save", {token: job.token || token, records: job.records, photos: job.photos}); sent++; box.shift(); ls.set(OUT, box); }
      catch(e){ if(e.code==="auth"){ box.shift(); ls.set(OUT, box); continue; } break; }
    }
    return sent;
  }
  return {
    mode:"remote",
    pending: () => ls.get(OUT, []).reduce((a,j)=>a+j.records.length, 0),
    flush,
    people: () => call("people"),
    login: (personId, pin, remember) => call("login", {personId, pin, remember}),
    logout: token => call("logout", {token}).catch(()=>{}),
    changePin: (token, pin) => call("changePin", {token, pin}),
    bootstrap: (token, from) => call("bootstrap", {token, from}),
    records: (token, from, to) => call("records", {token, from, to}),
    photos: async (token, ids) => { const out = {}; for(let i=0;i<ids.length;i+=8){ Object.assign(out, await call("photos", {token, ids: ids.slice(i,i+8)})); } return out; },
    photoUrl: id => id && id.startsWith("data:") ? id : `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`,
    async save(token, records, photos){
      try{ await flush(token); return await call("save", {token, records, photos}); }
      catch(e){
        if(e.code==="auth") throw e;
        const box = ls.get(OUT, []); box.push({token, records, photos}); ls.set(OUT, box);
        return {queued:true};
      }
    },
    admin: (op, token, data) => call("admin", {op, token, data}),
  };
}

/* ---------------- Demonstração ---------------- */
function Demo(){
  const KEY = "rotina-demo-v7";
  let S = ls.get(KEY, null);
  const persist = () => ls.set(KEY, S);
  if(!S) S = seed();
  function seed(){
    const now = new Date(), recs = [];
    let s = 11; const rnd = () => (s = (s*16807)%2147483647, (s-1)/2147483646);
    const r1 = (a,b) => Math.round((a + rnd()*(b-a))*10)/10;
    const good = it => {
      if(it.cat==="equip"){ if(it.eq==="freezer") return r1(-22,-19); if(it.eq==="pista") return r1(-4,-1); if(it.max!=null) return r1(1, it.max-0.6); return r1(it.min+2, it.min+8); }
      if(it.cat==="expo") return it.min!=null ? r1(63,72) : r1(2, it.max-1.5);
      if(it.cat==="coc") return r1(78,88);
      return 0;
    };
    const team = ["rose","sabrina","debora","manu","vagner"];
    const ownerFor = (cl, d) => cl.id==="abertura"||cl.id==="preservico"||cl.id==="limp_m"||cl.id==="expo_m" ? "rose" : cl.id==="fechamento"||cl.id==="expo_n" ? (d%2?"debora":"sabrina") : cl.id==="semanal" ? team[d%3] : cl.id==="bolso" ? "manu" : team[(d+cl.id.length)%3];
    const OVR = {"4|fechamento|eq_freezer":{v:"-14.5", acao:"Produto transferido para outro equipamento", obs:"Porta do freezer mal fechada. Ajustada; nova leitura às 22:50 marcou -19 °C."},
                 "3|expo_t|m_molho_bolognesa":{v:"57", acao:"Reaquecido até 75 °C", obs:"Bolognesa abaixo de 60 °C. Reaquecida na retaguarda e voltou a 68 °C."},
                 "6|abertura|pragas":{v:"nc", acao:"Dedetização do shopping acionada", obs:"Barata na porta externa. Shopping acionado; reforço feito no mesmo dia."}};
    const MISSING = new Set(["5|expo_n","2|limp_t"]);
    for(let d=13; d>=0; d--){
      const day = C.addDays(now, -d); day.setHours(12,0,0,0);
      for(const cl of D.CHECKLISTS){
        if(cl.freq==="ondemand") continue;
        if(MISSING.has(d+"|"+cl.id)) continue;
        const [st, due] = C.windowOf(cl, day);
        if(cl.freq==="weekly" && ((day.getDay()+6)%7)!==1) continue;      // semanal feito na terça
        if(cl.freq==="monthly" && day.getDate()!==5) continue;
        if(cl.freq==="fortnight" && !(day.getDate()===14 || day.getDate()===28)) continue;
        const t = new Date(day); const sm = st.getHours()*60+st.getMinutes();
        const at = cl.freq==="daily" ? sm + 6 + Math.floor(rnd()*Math.max(4,(due-st)/6e4-10)) : 10*60 + Math.floor(rnd()*300);
        t.setHours(Math.floor(at/60), at%60, 0, 0);
        if(d===0 && t > now) continue;
        if(d===1 && cl.id==="expo_t") t.setMinutes(t.getMinutes()+40);  // um atraso
        const by = ownerFor(cl, d);
        const run = C.uid();
        for(const it of cl.items){
          if(it.optional) continue;
          const o = OVR[`${d}|${cl.id}|${it.id}`];
          let v = it.t==="ok" ? (it.na && rnd()<.3 ? "na" : "ok") : it.t==="temp" ? String(good(it)) : it.t==="photo" ? "foto" : "";
          if(cl.bolso) v = it.na ? "na" : (rnd()<.06 && !it.elim ? "nc" : "ok");
          const rec = {id:C.uid(), ts:t.toISOString(), date:C.ymd(t), period:C.periodOf(cl, day), cl:cl.id, item:it.id, v, by, run};
          if(it.t==="photo") rec.photo = "demo:"+cl.id+"|"+C.brShort(C.ymd(t))+" "+C.hm(t);
          if(o) Object.assign(rec, o);
          recs.push(rec);
        }
      }
      // recebimentos e hortifrúti sob demanda
      const dow = day.getDay();
      const addRun = (clId, hour, by, extraRows) => {
        const cl = D.CHECKLISTS.find(c=>c.id===clId); const t = new Date(day); t.setHours(hour, 10+Math.floor(rnd()*40), 0, 0);
        if(d===0 && t > now) return;
        const run = C.uid(), per = "R:"+run;
        cl.items.forEach(it => { if(it.optional) return; const rec = {id:C.uid(), ts:t.toISOString(), date:C.ymd(t), period:per, cl:clId, item:it.id, v: it.t==="photo"?"foto": it.t==="multi"?"Folhosos|Legumes": it.t==="ok" ? (it.na?"na":"ok") : "", by, run, extra:extraRows.extra};
          if(it.t==="photo") rec.photo = "demo:"+clId+"|"+C.brShort(C.ymd(t))+" "+C.hm(t); recs.push(rec); });
        (extraRows.prods||[]).forEach(p => recs.push({id:C.uid(), ts:t.toISOString(), date:C.ymd(t), period:per, cl:clId, item:"prod", v:p.v, by, run, extra:{...extraRows.extra, produto:p.produto, cat:p.cat}, acao:p.acao, obs:p.obs}));
      };
      if(dow===1 || dow===4){
        const bad = d===3;
        addRun("recebimento", 9, "vagner", {extra:{fornecedor:"Magazzino (distribuidora da rede)"}, prods:[
          {produto:"Massas recheadas", cat:"cong", v:String(r1(-19,-14))},
          {produto:"Molhos (fábrica)", cat:"cong", v:String(r1(-18,-13))},
          {produto:"Peito de frango", cat:"carne", v: bad ? "8.4" : String(r1(3,6.5)), acao: bad?"Produto devolvido ao fornecedor":undefined, obs: bad?"Frango a 8,4 °C. Recusado e registrado no Portal de Qualidade da rede.":undefined},
          {produto:"Queijos", cat:"refr", v:String(r1(4,8))},
          {produto:"Descartáveis", cat:"seco", v:""},
        ]});
      }
      addRun("recebimento", 8, "rose", {extra:{fornecedor:"Salada (entrega diária)"}, prods:[{produto:"Folhosos", cat:"refr", v:String(r1(5,9))}]});
      addRun("hortifruti", 8, "rose", {extra:{}});
    }
    const pd = {...D.PERSON_DOC_SEED};
    return {
      people: D.PEOPLE.map(p => ({...p, ativo:true})),
      owners: {}, docs: D.DOCS.map(x => ({id:x.id, last:x.last, empresa:x.empresa, obs:"", hist: x.id==="dedet" ? [{last:"2026-08-29", empresa:"Shopping", obs:""},{last:"2026-09-30", empresa:"Shopping", obs:""}] : []})), pdocs: pd,
      manut: D.MANUT_SEED.slice(), loja: {...D.LOJA}, treinos: [], records: recs, pins:{},
      ver: 3,
    };
  }
  const ok = v => Promise.resolve(JSON.parse(JSON.stringify(v)));
  const pub = p => ({id:p.id, nome:p.nome, apelido:p.apelido||"", funcao:p.funcao, turno:p.turno||"", papel:p.papel, ativo:p.ativo!==false, notif:!!p.notif, prefs:Object.assign({}, D.NOTIF_DEFAULTS[p.papel]||{}, p.prefs||{})});
  return {
    mode:"demo",
    pending: () => 0, flush: async () => 0,
    reset(){ ls.del(KEY); S = seed(); persist(); },
    people: () => ok(S.people.filter(p=>p.ativo!==false).map(pub)),
    async login(personId, pin, remember){
      const p = S.people.find(x=>x.id===personId);
      if(!p) throw Object.assign(new Error("Pessoa não encontrada"), {code:"auth"});
      if((S.pins[personId]||"1234") !== String(pin)) throw Object.assign(new Error("PIN incorreto"), {code:"pin"});
      return {token:"demo-"+personId, person:pub(p), mustChange: !S.pins[personId] && personId === "taise"};
    },
    logout: async () => {},
    async changePin(token, pin){ const id = String(token).replace("demo-",""); S.pins[id] = String(pin); persist(); return true; },
    bootstrap: (token, from) => ok({people:S.people.map(pub), owners:S.owners, docs:S.docs, pdocs:S.pdocs, manut:S.manut, loja:S.loja, treinos:S.treinos, records:S.records.filter(r=>!from || r.date>=from)}),
    records: (token, from, to) => ok(S.records.filter(r=>r.date>=from && r.date<=to)),
    photos: async (token, ids) => { const o = {}; ids.forEach(id => o[id] = demoPhoto(id)); return o; },
    photoUrl: id => id && id.startsWith("demo:") ? demoPhoto(id) : id,
    async save(token, records, photos){
      const ids = {};
      records.forEach(r => { if(r.photo && photos && photos[r.photo]){ ids[r.photo] = photos[r.photo]; r.photo = photos[r.photo]; } S.records.push(r); });
      persist(); return {saved:records.length, ids};
    },
    async admin(op, token, d){
      const me = S.people.find(x => "demo-"+x.id === token) || {};
      const gest = x => x && (x.papel==="admin" || x.papel==="master" || x.papel==="dono");
      if(op==="setNotif"){ if(d.personId!==me.id && me.papel!=="master") throw new Error("Só a administradora do sistema altera as notificações de outra pessoa."); const x = S.people.find(p=>p.id===d.personId); x.notif = !!d.notif; x.prefs = d.prefs; persist(); return {ok:true}; }
      if(me.papel==="dono" && !["registerPush","testPush"].includes(op)) throw new Error("Acesso de consulta: alterações ficam com a gestão.");
      if(op==="setPerson"){ const cur = S.people.find(x=>x.id===d.person.id); if(me.papel!=="master" && cur && gest(cur) && cur.id!==me.id) throw new Error("Só a administradora do sistema altera a gestão.");
        if(me.papel!=="master" && gest(d.person) && !(cur && cur.papel===d.person.papel)) throw new Error("Só a administradora do sistema dá acesso à gestão."); }
      if(op==="revokeDevices"){ if(me.papel!=="master") throw new Error("Só a administradora do sistema."); persist(); return {ok:true}; }
      if(op==="setPerson"){ const i = S.people.findIndex(p=>p.id===d.person.id); if(i>=0) S.people[i] = {...S.people[i], ...d.person}; else S.people.push(d.person); if(d.pin) S.pins[d.person.id] = String(d.pin); }
      else if(op==="setPin"){ S.pins[d.personId] = String(d.pin); }
      else if(op==="setOwners"){ if(d.owners && d.owners.length) S.owners[d.cl] = {owners:d.owners}; else delete S.owners[d.cl]; }
      else if(op==="setDoc"){ const i = S.docs.findIndex(x=>x.id===d.id); if(i>=0){ const o = S.docs[i]; const hist = (o.hist||[]).slice(); if(o.last && !hist.some(h=>h.last===o.last)) hist.push({last:o.last, empresa:o.empresa, obs:o.obs}); S.docs[i] = {...o, ...d, hist}; } else S.docs.push({...d, hist:[]}); }
      else if(op==="setPersonDoc"){ S.pdocs[d.personId+"|"+d.doc] = d.date; }
      else if(op==="setManut"){ const i = S.manut.findIndex(x=>x.id===d.id); if(i>=0) S.manut[i] = {...S.manut[i], ...d}; else S.manut.push({...d, id:d.id||C.uid()}); }
      else if(op==="setLoja"){ S.loja = {...S.loja, ...d}; }
      else if(op==="addTreino"){ S.treinos.push({...d, id:C.uid()}); }
      else if(op==="registerPush" || op==="testPush" || op==="setDefs"){ return {demo:true}; }
      persist(); return {ok:true};
    },
  };
}

/* Foto de exemplo desenhada no aparelho (só no modo demonstração) */
const photoCache = {};
function demoPhoto(id){
  if(photoCache[id]) return photoCache[id];
  if(typeof document==="undefined") return "";
  const [label, stamp] = id.slice(5).split("|");
  const cl = (D.CHECKLISTS.find(c=>c.id===label)||{title:label}).title;
  const c = document.createElement("canvas"); c.width=480; c.height=360; const x = c.getContext("2d");
  let h = 0; for(const ch of id) h = (h*31 + ch.charCodeAt(0))%360;
  const gr = x.createLinearGradient(0,0,0,360); gr.addColorStop(0,`hsl(${h},16%,80%)`); gr.addColorStop(1,`hsl(${h},12%,60%)`);
  x.fillStyle = gr; x.fillRect(0,0,480,360);
  x.fillStyle = `hsl(${h},6%,88%)`; x.fillRect(0,215,480,145);
  for(let i=0;i<5;i++){ x.fillStyle = `hsl(${(h+i*50)%360},32%,${52+i*4}%)`; x.fillRect(28+i*88,150-(i%2)*26,70,66+(i%2)*26); x.fillStyle="#fff"; x.fillRect(38+i*88,172-(i%2)*26,50,14); }
  x.fillStyle = "rgba(22,35,63,.85)"; x.fillRect(0,300,480,60);
  x.fillStyle = "#fff"; x.font = "600 18px sans-serif"; x.fillText(cl.slice(0,40), 14, 326);
  x.fillStyle = "#d9b25e"; x.font = "14px monospace"; x.fillText("Foto de exemplo · "+(stamp||""), 14, 348);
  return photoCache[id] = c.toDataURL("image/jpeg", .7);
}

g.API = CFG.apiUrl ? Remote(CFG.apiUrl) : Demo();
g.LS = ls;
})(typeof window!=="undefined"?window:globalThis);
