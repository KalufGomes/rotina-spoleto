/* Rotina da Cozinha · Spoleto Franca · aplicativo */
(function(){
const C = CORE, D = DEFS, A = API, ls = LS;
const CFG = window.APP_CONFIG || {};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const CL = id => D.CHECKLISTS.find(c => c.id === id);
const ITEM = (cl, id) => (CL(cl)?.items || []).find(i => i.id === id);

const ST = {
  view: ls.get("rotina-view", "team"), tab: "hoje",
  people: [], owners: {}, docs: [], pdocs: {}, manut: [], loja: {}, treinos: [], records: [], idx: {},
  device: ls.get("rotina-device", null),     // sessão do aparelho (tablet)
  admin: ls.get("rotina-admin", null),       // sessão lembrada do gestor (celular)
  person: null,                              // sessão curta de quem está registrando
  current: null, draft: null, lastLate: -1, sound: false, loaded: false, error: "",
};
const isDemo = A.mode === "demo";
if(isDemo && !ST.device) ST.device = {token:"demo-device"};
const token = () => (ST.person && ST.person.token) || (ST.admin && ST.admin.token) || (ST.device && ST.device.token);
const pname = id => { const p = ST.people.find(x => x.id === id); return p ? (p.apelido || p.nome) : (id || ""); };
const app = () => $("#app");
const GEST = p => !!p && (p.papel === "admin" || p.papel === "master" || p.papel === "dono");   // acesso à gestão (dono só consulta)
const EDIT = p => !!p && (p.papel === "admin" || p.papel === "master");                         // pode alterar configurações
const canEdit = () => EDIT(me_());
const isStaff = p => p.ativo !== false && p.papel !== "master" && p.papel !== "dono";             // equipe da loja (exames, uniformes, cursos)
const me_ = () => (ST.admin && ST.admin.person) || (ST.person && ST.person.person) || null;
const isMaster = () => { const m = me_(); return !!m && m.papel === "master"; };
const papelTxt = p => p.papel === "master" ? "Administradora do sistema" : p.papel === "admin" ? "Gestão" : p.papel === "dono" ? "Proprietário (consulta)" : "Equipe";

/* ---------- carga e atualização ---------- */
function fromDate(){ const n = new Date(); const a = C.addDays(n, -13); const m = new Date(n.getFullYear(), n.getMonth(), 1); return C.ymd(a < m ? a : m); }
async function load(){
  try{
    const b = await A.bootstrap(token(), fromDate());
    Object.assign(ST, {people:b.people||[], owners:b.owners||{}, docs:b.docs||[], pdocs:b.pdocs||{}, manut:b.manut||[], loja:{...D.LOJA, ...(b.loja||{})}, treinos:b.treinos||[], records:b.records||[]});
    ST.idx = C.indexRecords(ST.records); ST.loaded = true; ST.error = "";
    if(!isDemo && isAdmin() && canEdit() && b.defsVersion !== D.VERSION){
      const defs = {version: D.VERSION,
        checklists: D.CHECKLISTS.filter(c => c.freq !== "ondemand").map(c => ({id: c.id, title: c.title, freq: c.freq, start: c.start, due: c.due, dueDow: c.dueDow || null, leaderOnly: !!c.leaderOnly, req: C.requiredItems(c).map(i => i.id)})),
        docs: D.DOCS.map(d => ({id: d.id, tipo: d.tipo, every: d.every})), personDocs: D.PERSON_DOCS.map(d => ({id: d.id, tipo: d.tipo, every: d.every}))};
      A.admin("setDefs", adminToken(), defs).catch(() => {});
    }
  }catch(e){
    if(e.code === "auth"){ ls.del("rotina-device"); ls.del("rotina-admin"); ST.device = null; ST.admin = null; }
    ST.error = e.code === "auth" ? "" : "Sem conexão com o servidor. Os registros ficam guardados e são enviados quando a internet voltar.";
  }
  render();
}
setInterval(() => { if(!ST.current && document.visibilityState === "visible") load(); }, 120000);
setInterval(() => { if(!ST.current) renderHeaderOnly(); checkAlerts(); }, 30000);
window.addEventListener("online", async () => { await A.flush(token()); load(); });

/* ---------- sessão curta (quem está registrando) ---------- */
let idleTimer = null;
function touch(){ clearTimeout(idleTimer); if(ST.person && !ST.person.remember) idleTimer = setTimeout(() => { ST.person = null; ST.current = null; render(); toast("Sessão encerrada por inatividade."); }, 5*60*1000); }
document.addEventListener("pointerdown", touch, {passive:true});

/* ---------- avisos no tablet ---------- */
let audio = null;
function beep(){
  try{
    if(!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    [0, .22].forEach(t => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.value = .12; o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .14); });
  }catch(e){}
  try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(e){}
}
function counts(){
  const now = new Date(); let late = 0, open = 0;
  D.CHECKLISTS.filter(c => c.freq !== "ondemand" && !c.leaderOnly).forEach(c => { const s = C.statusOf(c, ST.idx, now); if(s.k === "late") late++; else if(s.k === "open" || s.k === "partial") open++; });
  return {late, open};
}
function checkAlerts(){
  if(ST.view !== "team" || !ST.loaded) return;
  const {late} = counts();
  if(ST.lastLate >= 0 && late > ST.lastLate && ST.sound) beep();
  ST.lastLate = late;
}

/* ---------- toasts e modais ---------- */
function toast(msg, kind){ const t = document.createElement("div"); t.className = "toast " + (kind||""); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.classList.add("on"), 10); setTimeout(() => { t.classList.remove("on"); setTimeout(() => t.remove(), 300); }, 3800); }
function modal(html, onMount){
  const s = document.createElement("div"); s.className = "scrim"; s.innerHTML = `<div class="card modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(s); const close = () => s.remove();
  s.addEventListener("click", e => { if(e.target === s) close(); });
  onMount && onMount(s.querySelector(".modal"), close); return close;
}

/* ---------- PIN ---------- */
function askPin({title = "Quem está registrando?", only = null, remember = false} = {}){
  return new Promise(resolve => {
    let picked = only && only.length === 1 ? only[0] : null, buf = "";
    const list = ST.people.filter(p => p.ativo !== false && (only ? only.includes(p.id) : isStaff(p) || p.papel === "admin"));
    const draw = (m) => {
      m.innerHTML = `<div class="m-head"><h2>${esc(title)}</h2><button class="x" data-x aria-label="Fechar">×</button></div>
        <div class="people">${list.map(p => `<button class="person" data-p="${p.id}" aria-pressed="${picked === p.id}"><b>${esc(p.apelido || p.nome)}</b><small>${esc(p.funcao)}</small></button>`).join("")}</div>
        <div class="pin">${[0,1,2,3].map(i => `<span>${buf[i] ? "•" : ""}</span>`).join("")}</div>
        <p class="err" id="pin-err"></p>
        <div class="pad">${[1,2,3,4,5,6,7,8,9,"←",0,"OK"].map(k => `<button data-k="${k}">${k}</button>`).join("")}</div>`;
      m.querySelector("[data-x]").onclick = () => { close(); resolve(null); };
      m.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { picked = b.dataset.p; draw(m); });
      m.querySelectorAll("[data-k]").forEach(b => b.onclick = async () => {
        const k = b.dataset.k, err = m.querySelector("#pin-err");
        if(k === "←") buf = buf.slice(0,-1);
        else if(k === "OK"){
          if(!picked){ err.textContent = "Escolha seu nome primeiro."; return; }
          if(buf.length < 4){ err.textContent = "O PIN tem 4 dígitos."; return; }
          try{ const r = await A.login(picked, buf, remember); close(); if(r.mustChange){ const ok = await changePinFlow(r.token, true); if(!ok){ resolve(null); return; } } resolve({...r, remember}); }
          catch(e){ buf = ""; draw(m); m.querySelector("#pin-err").textContent = e.code === "pin" ? "PIN incorreto. Tente de novo." : (e.message || "Não foi possível entrar."); }
          return;
        } else if(buf.length < 4) buf += k;
        draw(m);
      });
    };
    let close; close = modal("", (m, c) => { close = c; draw(m); });
  });
}

/* ---------- trocar o próprio PIN ---------- */
function changePinFlow(tok, forced){
  return new Promise(resolve => {
    let step = 0, a = "", b = "";
    const draw = (m, close) => {
      const buf = step ? b : a;
      m.innerHTML = `<div class="m-head"><h2>${forced ? "Crie seu PIN" : "Trocar meu PIN"}</h2>${forced ? "" : `<button class="x" data-x aria-label="Fechar">×</button>`}</div>
        <p class="sub">${forced ? "Primeiro acesso: troque o PIN 1234 por um de 4 números que só você saiba. Ele vale como sua assinatura nos registros." : "Escolha um PIN de 4 números que só você saiba."}</p>
        <p class="lbl" style="text-align:center">${step ? "Digite o novo PIN de novo" : "Novo PIN"}</p>
        <div class="pin">${[0,1,2,3].map(i => `<span>${buf[i] ? "•" : ""}</span>`).join("")}</div>
        <p class="err" id="cp-err"></p>
        <div class="pad">${[1,2,3,4,5,6,7,8,9,"←",0,"OK"].map(k => `<button data-k="${k}">${k}</button>`).join("")}</div>`;
      const x = m.querySelector("[data-x]"); if(x) x.onclick = () => { close(); resolve(false); };
      m.querySelectorAll("[data-k]").forEach(btn => btn.onclick = async () => {
        const k = btn.dataset.k, err = m.querySelector("#cp-err");
        if(k === "←"){ if(step) b = b.slice(0,-1); else a = a.slice(0,-1); }
        else if(k === "OK"){
          if(!step){ if(a.length < 4){ err.textContent = "O PIN tem 4 números."; return; } if(a === "1234" || /^(\d)\1{3}$/.test(a) || a === "0123" || a === "4321"){ err.textContent = "Escolha um PIN menos óbvio."; return; } step = 1; }
          else { if(b !== a){ step = 0; a = ""; b = ""; draw(m, close); m.querySelector("#cp-err").textContent = "Os dois PINs não batem. Comece de novo."; return; }
            try{ await A.changePin(tok, a); close(); toast("PIN alterado.", "ok"); resolve(true); }catch(e){ err.textContent = e.message; } return; }
        } else { if(step){ if(b.length < 4) b += k; } else if(a.length < 4) a += k; }
        draw(m, close);
      });
    };
    modal("", (m, close) => draw(m, close));
  });
}

/* ---------- cabeçalho ---------- */
function header(){
  const pend = A.pending();
  return `<header class="top"><div class="top-in">
    <div class="brand"><b>Rotina da Cozinha</b><span>${esc(ST.loja.nome || "Spoleto Franca")} · <em>Kaluf &amp; Gomes</em></span></div>
    <div class="seg" role="group" aria-label="Visão">
      <button id="v-team" aria-pressed="${ST.view === "team"}">Equipe</button>
      <button id="v-mgr" aria-pressed="${ST.view === "mgr"}">Gestão</button>
    </div></div></header>
    ${isDemo ? `<div class="demo">Modo demonstração: dados de exemplo neste aparelho · PIN de todos: <b class="num">1234</b></div>` : ""}
    ${ST.error ? `<div class="demo bad">${esc(ST.error)}</div>` : ""}
    ${pend ? `<div class="demo warn">${pend} registro${pend > 1 ? "s" : ""} aguardando internet para enviar.</div>` : ""}`;
}
function bindHeader(){
  $("#v-team").onclick = () => { ST.view = "team"; ls.set("rotina-view", "team"); ST.current = null; render(); };
  $("#v-mgr").onclick = async () => {
    if(!isAdmin()){ const r = await askPin({title:"Entrar na gestão", only: ST.people.filter(GEST).map(p => p.id), remember: !isTablet()}); if(!r) return; setAdmin(r); }
    ST.view = "mgr"; ls.set("rotina-view", "mgr"); ST.current = null; render();
  };
}
const isAdmin = () => GEST(ST.admin && ST.admin.person) || GEST(ST.person && ST.person.person);
const adminToken = () => (ST.admin && ST.admin.token) || (ST.person && GEST(ST.person.person) && ST.person.token);
const isTablet = () => ls.get("rotina-devtype", "tablet") === "tablet";
function setAdmin(r){ if(r.remember){ ST.admin = {token:r.token, person:r.person}; ls.set("rotina-admin", ST.admin); } else { ST.person = r; touch(); } }
function renderHeaderOnly(){ if(ST.view === "team" && !ST.current) render(); }

/* ---------- ativação do aparelho (servidor) ---------- */
async function activationScreen(){
  app().innerHTML = header().replace(/<div class="seg"[\s\S]*?<\/div><\/div><\/header>/, "</div></header>") + `<main><div class="login card pad-l">
    <h1>Ativar este aparelho</h1>
    <p class="sub"><b>Tablet da cozinha:</b> a Taise, o Vagner ou a Manu entram uma vez com o PIN, e o tablet fica liberado para a equipe.</p>
    <p class="sub"><b>Celular:</b> cada pessoa da gestão e o proprietário escolhem o próprio nome e entram com o próprio PIN.</p>
    <div class="act-btns"><button class="btn" id="act-tablet">É o tablet da cozinha</button><button class="btn ghost" id="act-phone">É o meu celular</button></div>
    <p class="err" id="act-err"></p></div></main>`;
  try{ ST.people = await A.people(); }catch(e){ $("#act-err").textContent = "Não foi possível falar com o servidor. Confira a internet e o endereço configurado."; return; }
  const go = async (type) => {
    const r = await askPin({title: type === "tablet" ? "Liberar o tablet da cozinha" : "Quem é você?", only: ST.people.filter(type === "tablet" ? EDIT : GEST).map(p => p.id), remember:true});
    if(!r) return;
    ls.set("rotina-devtype", type);
    if(type === "tablet"){ try{ const d = await A.admin("deviceToken", r.token, {name:"Tablet da cozinha"}); ST.device = {token:d.token}; ls.set("rotina-device", ST.device); }catch(e){ $("#act-err").textContent = e.message; return; } ST.view = "team"; }
    else { ST.admin = {token:r.token, person:r.person}; ls.set("rotina-admin", ST.admin); ST.view = "mgr"; }
    ls.set("rotina-view", ST.view); load();
  };
  $("#act-tablet").onclick = () => go("tablet");
  $("#act-phone").onclick = () => go("phone");
}

/* ---------- render principal ---------- */
function render(){
  if(!token()){ return activationScreen(); }
  if(!ST.loaded && !ST.error){ app().innerHTML = header() + `<main><p class="sub">Carregando…</p></main>`; bindHeader(); return; }
  if(ST.view === "mgr" && !isAdmin()){ ST.view = "team"; }
  if(ST.current) return renderRun();
  if(ST.view === "mgr") return renderMgr();
  renderTeam();
}

/* ================= EQUIPE (tablet) ================= */
function ownersOf(clId){ const o = ST.owners[clId]; return o && o.owners && o.owners.length ? o.owners : null; }
function renderTeam(){
  const now = new Date(), me = ST.person && ST.person.person;
  const regular = D.CHECKLISTS.filter(c => c.freq !== "ondemand");
  const rows = regular.map(c => ({c, s: C.statusOf(c, ST.idx, now)})).filter(x => !x.c.leaderOnly || EDIT(me) || x.s.k === "done");
  const mine = x => me && ownersOf(x.c.id) && ownersOf(x.c.id).includes(me.id);
  const sortK = x => (mine(x) ? 0 : 1)*10 + ({late:0, partial:1, open:2, later:3, "late-done":4, done:5})[x.s.k];
  const now_ = rows.filter(x => ["late","open","partial"].includes(x.s.k)).sort((a,b) => sortK(a) - sortK(b));
  const later = rows.filter(x => x.s.k === "later");
  const done = rows.filter(x => x.s.k === "done" || x.s.k === "late-done");
  const {late, open} = counts();
  const dow = now.getDay();
  const entregas = D.FORNECEDORES.filter(f => f.dias && f.dias.includes(dow) && f.dias.length < 7).map(f => f.nome.split(" (")[0]);
  const card = ({c, s}) => {
    const own = ownersOf(c.id); const who = own ? own.map(pname).join(", ") : "Aberto a todos";
    const st = c.freq === "daily" ? `${c.start}–${c.due}` : c.freq === "weekly" ? "Semana · até quarta" : c.freq === "monthly" ? "Este mês" : "Esta quinzena";
    const pct = s.total ? Math.round(s.n / s.total * 100) : 0;
    return `<button class="cl ${s.k}" data-cl="${c.id}">
      <span class="time">${c.freq === "daily" ? c.start : c.freq === "weekly" ? "SEM" : c.freq === "monthly" ? "MÊS" : "QZN"}</span>
      <span class="cl-main"><b>${esc(c.title)}</b><small>${esc(st)} · ${s.total} itens · <span class="${mine({c}) ? "mine" : ""}">${mine({c}) ? "Sua tarefa" : esc(who)}</span></small>
      <span class="bar"><i style="width:${pct}%"></i></span></span>
      <span class="pill p-${s.c}">${esc(s.label)}</span></button>`;
  };
  app().innerHTML = header() + `<main>
    <div class="who">
      <div><span class="eyebrow">${C.br(C.ymd(now))} · ${C.hm(now)}</span><h1>${me ? `Olá, ${esc(me.apelido || me.nome)}` : "Tarefas de hoje"}</h1>
      <p class="sub">${me ? "Toque em uma tarefa para registrar." : "Toque em uma tarefa e entre com seu nome e PIN. Quem fizer, registra."}</p></div>
      <div class="who-act">${me ? `<button class="btn ghost" id="mypin">Trocar meu PIN</button><button class="btn ghost" id="out">Sair</button>` : ""}<button class="btn ghost" id="snd" aria-pressed="${ST.sound}">${ST.sound ? "Som dos avisos ligado" : "Ligar som dos avisos"}</button></div>
    </div>
    ${late || open ? `<div class="alert-bar ${late ? "bad" : "warn"}" role="status"><b>${late ? `${late} tarefa${late > 1 ? "s" : ""} atrasada${late > 1 ? "s" : ""}` : ""}${late && open ? " · " : ""}${open ? `${open} para fazer agora` : ""}</b><span>Toque na tarefa para registrar.</span></div>` : `<div class="alert-bar ok"><b>Tudo em dia por enquanto.</b></div>`}
    <section class="quick">
      <h2>Registrar agora</h2>
      <div class="quick-row">
        <button class="qbtn" data-od="recebimento"><b>Recebimento</b><small>${entregas.length ? "Hoje: " + esc(entregas.join(", ")) : "A cada entrega"}</small></button>
        <button class="qbtn" data-od="hortifruti"><b>Hortifrúti higienizado</b><small>Quando chegar</small></button>
        <button class="qbtn danger" data-od="ocorrencia"><b>Ocorrência</b><small>Praga, defeito, outro</small></button>
      </div>
    </section>
    ${now_.length ? `<h2 class="sec">Para fazer agora</h2><div class="list">${now_.map(card).join("")}</div>` : ""}
    ${later.length ? `<h2 class="sec">Mais tarde</h2><div class="list">${later.map(card).join("")}</div>` : ""}
    ${done.length ? `<h2 class="sec">Feito</h2><div class="list done-list">${done.map(card).join("")}</div>` : ""}
  </main>`;
  bindHeader();
  const o = $("#out"); if(o) o.onclick = () => { A.logout(ST.person.token); ST.person = null; render(); };
  const mp = $("#mypin"); if(mp) mp.onclick = () => changePinFlow(ST.person.token, false);
  $("#snd").onclick = () => { ST.sound = !ST.sound; if(ST.sound) beep(); render(); };
  app().querySelectorAll("[data-cl]").forEach(b => b.onclick = () => openChecklist(b.dataset.cl));
  app().querySelectorAll("[data-od]").forEach(b => b.onclick = () => openChecklist(b.dataset.od));
}
async function ensurePerson(cl){
  if(ST.person) return true;
  const only = cl.leaderOnly ? ST.people.filter(EDIT).map(p => p.id) : null;
  const r = await askPin({only}); if(!r) return false; ST.person = r; touch(); return true;
}
async function openChecklist(id){
  const cl = CL(id); if(!(await ensurePerson(cl))) return;
  if(cl.leaderOnly && !EDIT(ST.person.person)){ toast("Só o gerente ou a subgerente aplicam o Checklist de Bolso.", "bad"); return; }
  ST.current = cl; ST.draft = {items:{}, prods: cl.receb ? [{produto:"", cat:"", v:""}] : [], extra:{}};
  render(); window.scrollTo(0,0);
}

/* ================= EXECUÇÃO ================= */
const needsFix = (it, a) => a && (a.v === "nc" || (it.t === "temp" && C.outOfRange(it, a.v)));
function itemValid(it, a){
  if(!a) return false;
  if(a.v === "na") return true;
  const fix = () => a.acao && a.obs && a.obs.trim().length > 2;
  if(it.t === "ok") return a.v === "ok" || (a.v === "nc" && fix());
  if(it.t === "temp") return a.v !== "" && a.v != null && !isNaN(C.num(a.v)) && (!C.outOfRange(it, a.v) || fix());
  if(it.t === "photo") return !!a.photo;
  if(it.t === "text") return a.v && a.v.trim().length > 2;
  if(it.t === "choice") return !!a.v;
  if(it.t === "multi") return a.v && a.v.length > 0;
  return false;
}
function prodValid(p){
  const c = C.catOf(p.cat); if(!p.produto.trim() || !c) return false;
  if(c.id === "seco") return true;
  if(p.v === "" || isNaN(C.num(p.v))) return false;
  return !C.outOfRange(c, p.v) || (p.acao && p.obs && p.obs.trim().length > 2);
}
function runState(){
  const cl = ST.current, per = cl.freq === "ondemand" ? null : C.periodOf(cl, new Date());
  const prev = per ? (ST.idx[per + "|" + cl.id] || {}) : {};
  const pend = cl.items.filter(i => !prev[i.id]);
  const valid = pend.filter(i => itemValid(i, ST.draft.items[i.id]));
  const touched = pend.filter(i => ST.draft.items[i.id] && (ST.draft.items[i.id].v || ST.draft.items[i.id].photo));
  const invalidTouched = touched.filter(i => !itemValid(i, ST.draft.items[i.id]));
  return {per, prev, pend, valid, invalidTouched};
}
function renderRun(){
  const cl = ST.current, me = ST.person.person, {prev, pend, valid, invalidTouched} = runState();
  const od = cl.freq === "ondemand";
  const req = C.requiredItems(cl);
  const doneN = req.filter(i => prev[i.id]).length;
  const groups = [];
  cl.items.forEach(it => { const g = it.grp || ""; let G = groups.find(x => x.g === g); if(!G) groups.push(G = {g, items:[]}); G.items.push(it); });
  const prodsOk = !cl.receb || (ST.draft.extra.fornecedor && ST.draft.prods.length && ST.draft.prods.every(prodValid));
  const canSave = od ? (cl.items.filter(i => !i.optional).every(i => itemValid(i, ST.draft.items[i.id])) && prodsOk) : (valid.length > 0 && invalidTouched.length === 0);
  app().innerHTML = header() + `<main>
    <div class="run-head">
      <div><span class="eyebrow">${od ? "Registro sob demanda" : (cl.freq === "daily" ? `${cl.start} até ${cl.due}` : esc(cl.sub))} · ${esc(me.apelido || me.nome)}</span>
      <h1>${esc(cl.title)}</h1><p class="sub">${esc(cl.sub)}${od ? "" : ` · <span class="num">${doneN + valid.length}/${req.length}</span> itens`}</p></div>
      <button class="btn ghost" id="back">Voltar</button>
    </div>
    ${cl.receb ? recebHead() : ""}
    ${groups.map(G => `${G.g ? `<h2 class="sec">${esc(G.g)}</h2>` : ""}<div class="items ${cl.compact ? "compact" : ""}">${G.items.map(it => prev[it.id] ? doneItemHTML(cl, it, prev[it.id]) : (cl.compact && it.t === "temp" ? compactHTML(cl, it) : itemHTML(cl, it))).join("")}</div>`).join("")}
    <div class="foot">
      ${!od && pend.length && valid.length < pend.length ? `<span class="foot-note">${pend.length - valid.length} ${pend.length - valid.length > 1 ? "itens" : "item"} ainda sem resposta. Você pode salvar o que fez; o resto fica para quem vier depois.</span>` : ""}
      ${!od && !pend.length ? `<span class="pill p-ok">Checklist concluído</span>` : `<button class="btn" id="save" ${canSave ? "" : "disabled"}>${od ? "Registrar" : valid.length === pend.length ? "Concluir checklist" : `Salvar ${valid.length} ${valid.length !== 1 ? "itens" : "item"}`}</button>`}
    </div>
  </main>`;
  bindHeader();
  $("#back").onclick = () => { ST.current = null; render(); };
  const sv = $("#save"); if(sv) sv.onclick = saveRun;
  bindRun();
}
function recebHead(){
  const ex = ST.draft.extra;
  return `<div class="card item">
    <div class="field"><label for="forn">Fornecedor</label><select id="forn"><option value="">Escolha</option>${D.FORNECEDORES.map(f => `<option ${ex.fornecedor === f.nome ? "selected" : ""}>${esc(f.nome)}</option>`).join("")}</select></div>
    ${ex.fornecedor === "Outro" ? `<div class="field"><label for="forn-o">Qual fornecedor?</label><input id="forn-o" value="${esc(ex.outro || "")}"></div>` : ""}
    <h3>Produtos e temperatura na chegada</h3>
    <div class="prods">${ST.draft.prods.map((p, i) => {
      const c = C.catOf(p.cat); const bad = c && c.id !== "seco" && C.outOfRange(c, p.v);
      return `<div class="prod ${bad ? "is-bad" : ""}">
        <input data-pp="${i}" placeholder="Produto" value="${esc(p.produto)}" aria-label="Produto">
        <select data-pc="${i}" aria-label="Categoria"><option value="">Categoria</option>${D.CATEG.map(x => `<option value="${x.id}" ${p.cat === x.id ? "selected" : ""}>${esc(x.nome)}</option>`).join("")}</select>
        ${c && c.id === "seco" ? `<span class="range">Sem medição</span>` : `<input data-pv="${i}" inputmode="decimal" placeholder="°C" value="${esc(p.v)}" aria-label="Temperatura" class="tin">`}
        <span class="range">${c ? esc(c.txt) : ""}</span>
        ${ST.draft.prods.length > 1 ? `<button class="x" data-pdel="${i}" aria-label="Remover produto">×</button>` : ""}
        ${bad ? `<div class="fix full"><label>Fora do critério: o que foi feito?</label><select data-pa="${i}"><option value="">Escolha</option>${D.ACOES.padrao.map(a => `<option ${p.acao === a ? "selected" : ""}>${a}</option>`).join("")}</select><textarea data-po="${i}" placeholder="Ex.: produto recusado e registrado no Portal de Qualidade">${esc(p.obs || "")}</textarea></div>` : ""}
      </div>`; }).join("")}</div>
    <button class="btn ghost" id="addp">+ Adicionar produto</button>
  </div>`;
}
function refTag(it){ return `<span class="ref">${esc(it.rede || "")}${it.ref ? " · CVS 3 " + esc(it.ref) : ""}</span>`; }
function fixHTML(it, a, key){
  const list = D.ACOES[it.acoes || "padrao"];
  return `<div class="fix">
    <label for="a-${key}">${it.elim ? "Item eliminatório na auditoria da rede. " : ""}Ação corretiva (obrigatória)</label>
    <select id="a-${key}" data-a="${it.id}"><option value="">Escolha o que foi feito</option>${list.map(x => `<option ${a.acao === x ? "selected" : ""}>${x}</option>`).join("")}</select>
    <textarea id="o-${key}" data-o="${it.id}" placeholder="Descreva o problema e a correção">${esc(a.obs || "")}</textarea></div>`;
}
function itemHTML(cl, it){
  const a = ST.draft.items[it.id] || {};
  const na = it.na ? `<button class="c-na" data-v="na" data-i="${it.id}" aria-pressed="${a.v === "na"}">Não se aplica</button>` : "";
  let body = "";
  if(it.t === "ok") body = `<div class="choice"><button class="c-ok" data-v="ok" data-i="${it.id}" aria-pressed="${a.v === "ok"}">Conforme</button><button class="c-bad" data-v="nc" data-i="${it.id}" aria-pressed="${a.v === "nc"}">Não conforme</button>${na}</div>`;
  else if(it.t === "temp"){ const bad = C.outOfRange(it, a.v); body = `<div class="temp"><input data-t="${it.id}" inputmode="decimal" placeholder="°C" value="${a.v && a.v !== "na" ? esc(a.v) : ""}" aria-label="Temperatura em °C" class="tin"><span class="range">${esc(C.critText(it))}</span>${bad ? `<span class="pill p-bad">Fora da faixa</span>` : ""}</div>${it.na ? `<div class="choice">${na}</div>` : ""}`; }
  else if(it.t === "photo") body = `<div class="photo"><label class="btn ghost" for="p-${it.id}">${a.photo ? "Trocar foto" : "Tirar foto"}</label><input type="file" id="p-${it.id}" data-p="${it.id}" accept="image/*" capture="environment">${a.photo ? `<img src="${a.photo}" alt="Foto">` : `<span class="range">${it.optional ? "Opcional" : "Obrigatória"}</span>`}</div>`;
  else if(it.t === "text") body = `<textarea data-tx="${it.id}" placeholder="Escreva aqui">${esc(a.v || "")}</textarea>`;
  else if(it.t === "choice") body = `<div class="choice wrap">${it.opts.map(o => `<button class="c-opt" data-ch="${it.id}" data-val="${esc(o)}" aria-pressed="${a.v === o}">${esc(o)}</button>`).join("")}</div>`;
  else if(it.t === "multi"){ const sel = a.v || []; body = `<div class="choice wrap">${it.opts.map(o => `<button class="c-opt" data-mu="${it.id}" data-val="${esc(o)}" aria-pressed="${sel.includes(o)}">${esc(o)}</button>`).join("")}</div>`; }
  const sub = it.sub ? `<small class="isub">${esc(it.sub)}</small>` : "";
  return `<div class="card item ${it.elim ? "elim" : ""}"><div class="item-top"><p>${esc(it.q)}${sub}</p>${refTag(it)}</div>${body}${needsFix(it, a) ? fixHTML(it, a, it.id) : ""}</div>`;
}
function compactHTML(cl, it){
  const a = ST.draft.items[it.id] || {}; const bad = C.outOfRange(it, a.v);
  return `<div class="crow ${bad ? "is-bad" : ""} ${a.v === "na" ? "is-na" : ""}">
    <span class="cname">${esc(it.q)}</span>
    <input data-t="${it.id}" inputmode="decimal" placeholder="°C" value="${a.v && a.v !== "na" ? esc(a.v) : ""}" aria-label="${esc(it.q)} em °C" class="tin">
    <span class="range">${esc(C.critText(it))}</span>
    ${it.na ? `<button class="mini" data-v="na" data-i="${it.id}" aria-pressed="${a.v === "na"}">N/A</button>` : `<span></span>`}
    ${bad ? `<div class="full">${fixHTML(it, a, it.id)}</div>` : ""}
  </div>`;
}
function doneItemHTML(cl, it, r){
  const txt = it.t === "temp" ? C.fmtT(r.v) : r.v === "ok" ? "Conforme" : r.v === "nc" ? "Não conforme" : r.v === "na" ? "Não se aplica" : it.t === "photo" ? "Foto enviada" : esc(Array.isArray(r.v) ? r.v.join(", ") : r.v);
  const bad = C.isDev(r, it);
  return `<div class="${cl.compact && it.t === "temp" ? "crow" : "card item"} done ${bad ? "is-bad" : ""}"><div class="item-top"><p>${esc(it.q)}${it.sub ? `<small class="isub">${esc(it.sub)}</small>` : ""}</p><span class="pill p-${bad ? "bad" : "ok"}">${txt}</span></div><small class="by">por ${esc(pname(r.by))} às ${C.hm(new Date(r.ts))}${r.acao ? " · " + esc(r.acao) : ""}</small></div>`;
}
function bindRun(){
  const d = ST.draft, rr = () => { const y = window.scrollY; renderRun(); window.scrollTo(0, y); };
  const it = id => ST.current.items.find(i => i.id === id);
  const get = id => d.items[id] || (d.items[id] = {});
  app().querySelectorAll("[data-v][data-i]").forEach(b => b.onclick = () => { const a = get(b.dataset.i); a.v = a.v === b.dataset.v && b.dataset.v === "na" ? "" : b.dataset.v; rr(); });
  app().querySelectorAll("[data-t]").forEach(inp => { inp.onchange = () => { get(inp.dataset.t).v = inp.value.trim(); rr(); }; inp.onkeydown = e => { if(e.key === "Enter"){ inp.blur(); } }; });
  app().querySelectorAll("[data-a]").forEach(s => s.onchange = () => { get(s.dataset.a).acao = s.value; rr(); });
  app().querySelectorAll("[data-o]").forEach(t => { t.oninput = () => { get(t.dataset.o).obs = t.value; }; t.onblur = rr; });
  app().querySelectorAll("[data-tx]").forEach(t => { t.oninput = () => { get(t.dataset.tx).v = t.value; }; t.onblur = rr; });
  app().querySelectorAll("[data-ch]").forEach(b => b.onclick = () => { get(b.dataset.ch).v = b.dataset.val; rr(); });
  app().querySelectorAll("[data-mu]").forEach(b => b.onclick = () => { const a = get(b.dataset.mu); a.v = a.v || []; const i = a.v.indexOf(b.dataset.val); i >= 0 ? a.v.splice(i, 1) : a.v.push(b.dataset.val); rr(); });
  app().querySelectorAll("[data-p]").forEach(inp => inp.onchange = () => { const f = inp.files[0]; if(!f) return; compress(f).then(url => { get(inp.dataset.p).photo = url; rr(); }); });
  if(ST.current.receb){
    const f = $("#forn"); f.onchange = () => { d.extra.fornecedor = f.value; rr(); };
    const fo = $("#forn-o"); if(fo) fo.oninput = () => { d.extra.outro = fo.value; };
    app().querySelectorAll("[data-pp]").forEach(i => { i.oninput = () => { d.prods[+i.dataset.pp].produto = i.value; }; i.onblur = rr; });
    app().querySelectorAll("[data-pc]").forEach(s => s.onchange = () => { d.prods[+s.dataset.pc].cat = s.value; rr(); });
    app().querySelectorAll("[data-pv]").forEach(i => i.onchange = () => { d.prods[+i.dataset.pv].v = i.value.trim(); rr(); });
    app().querySelectorAll("[data-pa]").forEach(s => s.onchange = () => { d.prods[+s.dataset.pa].acao = s.value; rr(); });
    app().querySelectorAll("[data-po]").forEach(t => { t.oninput = () => { d.prods[+t.dataset.po].obs = t.value; }; t.onblur = rr; });
    app().querySelectorAll("[data-pdel]").forEach(b => b.onclick = () => { d.prods.splice(+b.dataset.pdel, 1); rr(); });
    $("#addp").onclick = () => { d.prods.push({produto:"", cat:"", v:""}); rr(); };
  }
}
function compress(file){
  return new Promise(res => { const rd = new FileReader(); rd.onload = () => { const img = new Image(); img.onload = () => { const s = Math.min(1, 1100 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL("image/jpeg", .72)); }; img.onerror = () => res(rd.result); img.src = rd.result; }; rd.readAsDataURL(file); });
}
async function saveRun(){
  const cl = ST.current, {per, pend} = runState(), now = new Date(), me = ST.person.person;
  const od = cl.freq === "ondemand", run = C.uid(), period = od ? "R:" + run : per;
  const recs = [], photos = {};
  const extra = cl.receb ? {fornecedor: ST.draft.extra.fornecedor === "Outro" ? ("Outro: " + (ST.draft.extra.outro || "")) : ST.draft.extra.fornecedor} : undefined;
  const base = {ts: now.toISOString(), date: C.ymd(now), period, cl: cl.id, by: me.id, run, dev: isTablet() ? "tablet" : "celular"};
  (od ? cl.items : pend).forEach(it => {
    const a = ST.draft.items[it.id]; if(!a || !itemValid(it, a)) return;
    const r = {...base, id: C.uid(), item: it.id, v: Array.isArray(a.v) ? a.v.join("|") : (it.t === "photo" ? "foto" : a.v)};
    if(a.acao) r.acao = a.acao; if(a.obs) r.obs = a.obs; if(extra) r.extra = extra;
    if(it.t === "photo" && a.photo){ const pid = "tmp-" + C.uid(); photos[pid] = a.photo; r.photo = pid; }
    recs.push(r);
  });
  if(cl.receb) ST.draft.prods.forEach(p => { const r = {...base, id: C.uid(), item: "prod", v: p.v, extra: {...extra, produto: p.produto, cat: p.cat}}; if(p.acao) r.acao = p.acao; if(p.obs) r.obs = p.obs; recs.push(r); });
  /* rótulos para a planilha e para as notificações do gestor */
  recs.forEach(r => { const it = ITEM(r.cl, r.item); r.clt = cl.title; r.label = r.item === "prod" ? `${r.extra.produto} (${(C.catOf(r.extra.cat) || {}).nome || ""})` : (it ? it.q + (it.sub ? " · " + it.sub : "") : r.item); r.nc = C.isDev(r, it) || (cl.id === "ocorrencia" && r.item === "descricao"); if(it && it.elim && r.v === "nc") r.prio = true; if(cl.id === "ocorrencia" && r.item === "descricao"){ const tp = ST.draft.items.tipo; r.label = "Ocorrência: " + (tp && tp.v || ""); if(tp && /Praga/.test(tp.v)) r.prio = true; } });
  const btn = $("#save"); btn.disabled = true; btn.textContent = "Salvando…";
  try{
    const res = await A.save(ST.person.token, recs, photos);
    recs.forEach(r => { if(r.photo && res && res.ids && res.ids[r.photo]) r.photo = res.ids[r.photo]; else if(r.photo && photos[r.photo]) r.photo = photos[r.photo]; });
    ST.records.push(...recs); ST.idx = C.indexRecords(ST.records);
    const devs = recs.filter(r => C.isDev(r, ITEM(r.cl, r.item)));
    toast(res && res.queued ? "Sem internet: registro guardado no aparelho e enviado depois." : devs.length ? `Registrado. ${devs.length} não conformidade${devs.length > 1 ? "s" : ""} avisada${devs.length > 1 ? "s" : ""} ao gerente.` : "Registrado.", devs.length ? "warn" : "ok");
    ST.current = null; render();
  }catch(e){
    if(e.code === "auth"){ ST.person = null; toast("Sua sessão expirou. Entre de novo com o PIN.", "bad"); render(); return; }
    toast("Não foi possível salvar: " + e.message, "bad"); btn.disabled = false; btn.textContent = "Tentar de novo";
  }
}

/* ================= GESTÃO ================= */
function renderMgr(){
  const tabs = [["hoje","Hoje"],["hist","Histórico"],["docs","Documentos"],["rel","Relatórios"],["cfg","Configurações"]];
  app().innerHTML = header() + `<main>
    <nav class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${ST.tab === k}">${l}</button>`).join("")}</nav>
    <div id="tab"></div></main>`;
  bindHeader();
  app().querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { ST.tab = b.dataset.tab; renderMgr(); });
  ({hoje: tabHoje, hist: tabHist, docs: tabDocs, rel: tabRel, cfg: tabCfg})[ST.tab]();
}
const T = () => $("#tab");
function allDocStatus(){
  const today = new Date(), out = [];
  D.DOCS.forEach(def => { const d = ST.docs.find(x => x.id === def.id) || {}; out.push({def, d, s: C.docStatus(d.last, def.every, today), name: def.tipo}); });
  ST.people.filter(isStaff).forEach(p => D.PERSON_DOCS.forEach(def => { const last = ST.pdocs[p.id + "|" + def.id]; out.push({def, person: p, d: {last}, s: C.docStatus(last, def.every, today), name: `${def.tipo}: ${p.apelido || p.nome}`}); }));
  return out;
}
function tabHoje(){
  const now = new Date(), today = C.ymd(now);
  const regs = D.CHECKLISTS.filter(c => c.freq !== "ondemand");
  const st = regs.map(c => ({c, s: C.statusOf(c, ST.idx, now)}));
  const daily = st.filter(x => x.c.freq === "daily");
  const doneN = daily.filter(x => x.s.k === "done" || x.s.k === "late-done").length;
  const lateN = st.filter(x => x.s.k === "late").length;
  const todayRecs = ST.records.filter(r => r.date === today);
  const devs = todayRecs.filter(r => C.isDev(r, ITEM(r.cl, r.item)));
  const docs = allDocStatus().filter(x => x.s.k !== "ok");
  const ocorr = ST.records.filter(r => r.cl === "ocorrencia" && r.item === "descricao" && r.date >= C.ymd(C.addDays(now, -6)));
  const receb = todayRecs.filter(r => r.cl === "recebimento" && r.item === "prod");
  const temps = todayRecs.filter(r => { const it = ITEM(r.cl, r.item); return it && it.t === "temp" && it.cat === "equip"; });
  const expoToday = todayRecs.filter(r => { const it = ITEM(r.cl, r.item); return it && it.cat === "expo" && r.v !== "na"; });
  const expoBad = expoToday.filter(r => C.isDev(r, ITEM(r.cl, r.item)));
  const row = ({c, s}) => { const ppl = [...new Set(Object.values(s.answered).map(r => pname(r.by)))].join(", ");
    const own = ownersOf(c.id);
    return `<div class="row"><span class="num t-m">${c.freq === "daily" ? c.start : c.freq === "weekly" ? "SEM" : c.freq === "monthly" ? "MÊS" : "QZN"}</span><span><b>${esc(c.title)}</b><small>${c.freq === "daily" ? "prazo " + c.due : esc(c.sub.split(" · ")[0])}${own ? " · resp. " + esc(own.map(pname).join(", ")) : ""}${ppl ? " · feito por " + esc(ppl) : ""}</small></span><span class="pill p-${s.c}">${esc(s.label)}</span></div>`; };
  T().innerHTML = `
    <div class="mgr-head"><div><span class="eyebrow">${C.br(today)} · atualizado às ${C.hm(now)}</span><h1>Como está a operação</h1></div>
      <div class="who-act"><button class="btn ghost" id="refresh">Atualizar</button><button class="btn gold" id="go-rel">Relatórios</button></div></div>
    <div class="kpis">
      <div class="card kpi ok"><span class="eyebrow">Feitos hoje</span><div class="v">${doneN}<small>/${daily.length}</small></div></div>
      <div class="card kpi ${lateN ? "bad" : ""}"><span class="eyebrow">Atrasados</span><div class="v">${lateN}</div></div>
      <div class="card kpi ${devs.length ? "bad" : ""}"><span class="eyebrow">Não conformidades</span><div class="v">${devs.length}</div></div>
      <div class="card kpi ${docs.length ? "warn" : ""}"><span class="eyebrow">Documentos a resolver</span><div class="v">${docs.length}</div></div>
    </div>
    <div class="grid2">
      <section class="card panel"><h2>Checklists</h2><div class="rows">${st.map(row).join("")}</div></section>
      <div class="stack">
        <section class="card panel"><h2>Não conformidades de hoje</h2>${devs.length ? devs.map(r => { const it = ITEM(r.cl, r.item); const cl = CL(r.cl); const name = r.item === "prod" ? (r.extra.produto + " (" + (C.catOf(r.extra.cat) || {}).nome + ")") : it.q; return `<div class="dev"><b>${esc(name)}${r.v !== "nc" ? ` · <span class="num">${C.fmtT(r.v)}</span>` : ""}</b><small><b>${esc(r.acao || "")}</b> · ${esc(r.obs || "")}</small><small>${esc(cl.title)} · ${esc(pname(r.by))} às ${C.hm(new Date(r.ts))}</small></div>`; }).join("") : `<p class="empty">Nenhuma não conformidade registrada hoje.</p>`}</section>
        <section class="card panel"><h2>Pista fria e molhos hoje</h2><p class="${expoBad.length ? "bad-t" : "ok-t"}"><b class="num">${expoToday.length}</b> leituras · <b class="num">${expoBad.length}</b> fora da faixa</p></section>
        <section class="card panel"><h2>Ocorrências (7 dias)</h2>${ocorr.length ? ocorr.map(r => { const tipo = ST.records.find(x => x.run === r.run && x.item === "tipo"); return `<div class="dev"><b>${esc(tipo ? tipo.v : "Ocorrência")}</b><small>${esc(r.v)}</small><small>${C.brShort(r.date)} ${C.hm(new Date(r.ts))} · ${esc(pname(r.by))}</small></div>`; }).join("") : `<p class="empty">Nenhuma ocorrência.</p>`}</section>
        ${docs.length ? `<section class="card panel"><h2>Documentos</h2>${docs.slice(0, 6).map(x => `<div class="row r2"><span>${esc(x.name)}<small>${esc(x.def.rede)}</small></span><span class="pill p-${x.s.k}">${esc(x.s.label)}</span></div>`).join("")}<button class="btn ghost" id="go-docs">Ver todos</button></section>` : ""}
      </div>
    </div>
    <section class="card panel mt"><h2>Temperatura dos equipamentos hoje (POP 1C)</h2><div class="tbl-wrap"><table><thead><tr><th>Equipamento</th><th>Critério</th><th class="r">Manhã</th><th class="r">Noite</th></tr></thead><tbody>${
      D.EQUIP.filter(e => e.pop1c).map(e => { const m = temps.find(r => r.item === "eq_" + e.id && ITEM(r.cl, r.item).leitura === "M"), n = temps.find(r => r.item === "eq_" + e.id && ITEM(r.cl, r.item).leitura === "N"); const cell = r => r ? `<span class="${C.isDev(r, ITEM(r.cl, r.item)) ? "bad-t" : ""}">${C.fmtT(r.v)}</span><small>${C.hm(new Date(r.ts))} · ${esc(pname(r.by))}</small>` : `<span class="muted">–</span>`; return `<tr><td>${esc(e.nome)}</td><td class="muted">${esc(C.critText(e))}</td><td class="r num">${cell(m)}</td><td class="r num">${cell(n)}</td></tr>`; }).join("")
    }</tbody></table></div></section>
    ${receb.length ? `<section class="card panel mt"><h2>Recebimentos de hoje (POP 1B)</h2><div class="tbl-wrap"><table><thead><tr><th>Hora</th><th>Fornecedor</th><th>Produto</th><th class="r">Temp.</th><th>Situação</th></tr></thead><tbody>${receb.map(r => { const c = C.catOf(r.extra.cat) || {}; const bad = C.isDev(r); return `<tr><td class="num">${C.hm(new Date(r.ts))}</td><td>${esc(r.extra.fornecedor)}</td><td>${esc(r.extra.produto)}<small>${esc(c.nome || "")} · ${esc(c.txt || "")}</small></td><td class="r num">${r.v ? C.fmtT(r.v) : "–"}</td><td><span class="pill p-${bad ? "bad" : "ok"}">${bad ? "Fora" : "Ok"}</span></td></tr>`; }).join("")}</tbody></table></div></section>` : ""}`;
  $("#refresh").onclick = load; $("#go-rel").onclick = () => { ST.tab = "rel"; renderMgr(); };
  const gd = $("#go-docs"); if(gd) gd.onclick = () => { ST.tab = "docs"; renderMgr(); };
}
function tabHist(){
  const now = new Date(), days = [];
  for(let d = 0; d < 14; d++){
    const day = C.addDays(now, -d); const k = C.ymd(day);
    const daily = D.CHECKLISTS.filter(c => c.freq === "daily").map(c => ({c, s: C.statusOf(c, ST.idx, now, day)}));
    const recs = ST.records.filter(r => r.date === k);
    days.push({k, d, done: daily.filter(x => x.s.k === "done" || x.s.k === "late-done").length, late: daily.filter(x => x.s.k === "late-done").length, miss: d ? daily.filter(x => x.s.k === "late").length : 0, total: daily.length, nc: recs.filter(r => C.isDev(r, ITEM(r.cl, r.item))).length, daily, recs});
  }
  const sel = ST.histDay || days[0].k; const D0 = days.find(x => x.k === sel) || days[0];
  T().innerHTML = `<div class="grid2">
    <section class="card panel"><h2>Últimos 14 dias</h2><div class="tbl-wrap"><table><thead><tr><th>Dia</th><th class="r">Feitos</th><th class="r">Atraso</th><th class="r">Faltou</th><th class="r">NC</th></tr></thead><tbody>${days.map(x => `<tr class="click ${x.k === sel ? "sel" : ""}" data-day="${x.k}"><td class="num">${x.d ? C.brShort(x.k) : "Hoje"}</td><td class="r num">${x.done}/${x.total}</td><td class="r num">${x.late || "–"}</td><td class="r num ${x.miss ? "bad-t" : ""}">${x.miss || "–"}</td><td class="r num ${x.nc ? "bad-t" : ""}">${x.nc || "–"}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card panel"><h2>${D0.d ? C.br(D0.k) : "Hoje"}</h2><div class="rows">${D0.daily.map(({c, s}) => { const ppl = [...new Set(Object.values(s.answered).map(r => pname(r.by)))].join(", "); return `<div class="row"><span class="num t-m">${c.start}</span><span><b>${esc(c.title)}</b><small>${ppl ? "por " + esc(ppl) : "sem registro"}</small></span><span class="pill p-${s.k === "late" && !D0.d ? "bad" : s.c}">${s.k === "late" && D0.d ? "Não realizado" : esc(s.label)}</span></div>`; }).join("")}</div>
    ${D0.recs.filter(r => C.isDev(r, ITEM(r.cl, r.item))).map(r => { const it = ITEM(r.cl, r.item); return `<div class="dev"><b>${esc(r.item === "prod" ? r.extra.produto : it.q)} ${r.v !== "nc" ? "· " + C.fmtT(r.v) : ""}</b><small><b>${esc(r.acao || "")}</b> · ${esc(r.obs || "")}</small><small>${esc(CL(r.cl).title)} · ${esc(pname(r.by))} às ${C.hm(new Date(r.ts))}</small></div>`; }).join("")}</section></div>`;
  T().querySelectorAll("[data-day]").forEach(tr => tr.onclick = () => { ST.histDay = tr.dataset.day; tabHist(); });
}
function tabDocs(){
  const all = allDocStatus(); const loja = all.filter(x => !x.person);
  const people = ST.people.filter(isStaff);
  const today = new Date();
  T().innerHTML = `
    <section class="card panel"><div class="panel-h"><h2>Controles da loja</h2><span class="ref">Registros guardados por no mínimo 180 dias (CVS 3/2026, Art. 181)</span></div>
    <div class="tbl-wrap"><table><thead><tr><th>Controle</th><th>Empresa</th><th>Último</th><th>Próximo</th><th>Situação</th><th></th></tr></thead><tbody>${loja.map(x => `<tr><td>${esc(x.def.tipo)}<small>${esc(x.def.rede)} · CVS 3 ${esc(x.def.ref)}</small></td><td>${esc(x.d.empresa || x.def.empresa || "")}</td><td class="num">${x.d.last ? C.br(x.d.last) : "–"}</td><td class="num">${x.s.next ? (x.s.next.includes("-") ? C.br(x.s.next) : x.s.next) : "–"}</td><td><span class="pill p-${x.s.k}">${esc(x.s.label)}</span></td><td>${canEdit() ? `<button class="btn ghost sm" data-doc="${x.def.id}">Registrar</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card panel mt"><h2>Equipe: exames, uniformes e cursos</h2><div class="tbl-wrap"><table><thead><tr><th>Pessoa</th>${D.PERSON_DOCS.map(d => `<th>${esc(d.tipo)}<small>${esc(d.rede)}</small></th>`).join("")}</tr></thead><tbody>${people.map(p => `<tr><td><b>${esc(p.apelido || p.nome)}</b><small>${esc(p.funcao)}</small></td>${D.PERSON_DOCS.map(def => { const last = ST.pdocs[p.id + "|" + def.id]; const s = C.docStatus(last, def.every, today); return `<td><button class="cellbtn" data-pd="${p.id}|${def.id}" ${canEdit() ? "" : "disabled"}><span class="pill p-${s.k}">${esc(s.label)}</span><small>${last ? C.br(last) : "Sem data"}</small></button></td>`; }).join("")}</tr>`).join("")}</tbody></table></div></section>
    <section class="card panel mt"><div class="panel-h"><h2>Equipamentos em manutenção (POP 2A e 2B)</h2>${canEdit() ? `<button class="btn ghost sm" id="add-m">+ Registrar</button>` : ""}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Equipamento</th><th>Desde</th><th>Situação</th><th>Empresa</th><th>Observação</th><th></th></tr></thead><tbody>${ST.manut.length ? ST.manut.map(m => `<tr><td>${esc((D.EQUIP.find(e => e.id === m.equip) || {nome: m.equip}).nome)}</td><td class="num">${m.desde ? C.br(m.desde) : ""}</td><td><span class="pill p-${m.status === "Liberado" ? "ok" : "warn"}">${esc(m.status)}</span></td><td>${esc(m.empresa || "")}</td><td>${esc(m.obs || "")}${m.servico ? `<small>Serviço: ${C.br(m.servico)}${m.validade ? " · validade " + C.br(m.validade) : ""}</small>` : ""}</td><td>${m.status !== "Liberado" && canEdit() ? `<button class="btn ghost sm" data-mf="${m.id}">Liberar</button>` : ""}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhum equipamento em manutenção.</td></tr>`}</tbody></table></div></section>
    <section class="card panel mt"><div class="panel-h"><h2>Treinamentos (POP 7B)</h2>${canEdit() ? `<button class="btn ghost sm" id="add-t">+ Registrar</button>` : ""}</div>
    <div class="tbl-wrap"><table><thead><tr><th>Data</th><th>Assunto</th><th>Instrutor</th><th>Participantes</th></tr></thead><tbody>${ST.treinos.length ? ST.treinos.map(t => `<tr><td class="num">${C.br(t.data)}</td><td>${esc(t.assunto)}</td><td>${esc(t.instrutor)}</td><td>${esc((t.participantes || []).map(pname).join(", "))}</td></tr>`).join("") : `<tr><td colspan="4" class="empty">Nenhum treinamento registrado.</td></tr>`}</tbody></table></div></section>`;
  T().querySelectorAll("[data-doc]").forEach(b => b.onclick = () => docForm(b.dataset.doc));
  T().querySelectorAll("[data-pd]").forEach(b => b.onclick = () => personDocForm(...b.dataset.pd.split("|")));
  if(!canEdit()) return;
  $("#add-m").onclick = () => manutForm();
  T().querySelectorAll("[data-mf]").forEach(b => b.onclick = () => manutForm(ST.manut.find(m => m.id === b.dataset.mf)));
  $("#add-t").onclick = treinoForm;
}
async function adminCall(op, data, okMsg){
  try{ await A.admin(op, adminToken(), data); toast(okMsg || "Salvo.", "ok"); await load(); }
  catch(e){ if(e.code === "auth"){ ls.del("rotina-admin"); ST.admin = null; ST.view = "team"; render(); } toast("Não foi possível salvar: " + e.message, "bad"); }
}
function docForm(id){
  const def = D.DOCS.find(d => d.id === id), d = ST.docs.find(x => x.id === id) || {};
  modal(`<div class="m-head"><h2>${esc(def.tipo)}</h2><button class="x" data-x>×</button></div>
    <div class="field"><label for="f-last">Data da realização</label><input type="date" id="f-last" value="${esc(d.last || C.ymd(new Date()))}"></div>
    <div class="field"><label for="f-emp">Empresa</label><input id="f-emp" value="${esc(d.empresa || def.empresa || "")}"></div>
    <div class="field"><label for="f-obs">Observação (nº do certificado, laudo, ocorrências)</label><input id="f-obs" value="${esc(d.obs || "")}"></div>
    <p class="sub">Próximo vencimento calculado automaticamente: a cada ${def.every} dias.</p>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="f-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    m.querySelector("#f-ok").onclick = () => { close(); adminCall("setDoc", {id, last: m.querySelector("#f-last").value, empresa: m.querySelector("#f-emp").value, obs: m.querySelector("#f-obs").value}); };
  });
}
function personDocForm(pid, docId){
  const def = D.PERSON_DOCS.find(d => d.id === docId), last = ST.pdocs[pid + "|" + docId];
  modal(`<div class="m-head"><h2>${esc(def.tipo)}: ${esc(pname(pid))}</h2><button class="x" data-x>×</button></div>
    <div class="field"><label for="f-d">Data</label><input type="date" id="f-d" value="${esc(last || C.ymd(new Date()))}"></div>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="f-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    m.querySelector("#f-ok").onclick = () => { close(); adminCall("setPersonDoc", {personId: pid, doc: docId, date: m.querySelector("#f-d").value}); };
  });
}
function manutForm(m0){
  const m = m0 || {equip: "", desde: C.ymd(new Date()), status: "Em manutenção"};
  modal(`<div class="m-head"><h2>${m0 ? "Liberar equipamento" : "Equipamento em manutenção"}</h2><button class="x" data-x>×</button></div>
    <div class="field"><label for="f-eq">Equipamento</label><select id="f-eq" ${m0 ? "disabled" : ""}>${D.EQUIP.map(e => `<option value="${e.id}" ${m.equip === e.id ? "selected" : ""}>${esc(e.nome)}</option>`).join("")}</select></div>
    <div class="two"><div class="field"><label for="f-ds">Desde</label><input type="date" id="f-ds" value="${esc(m.desde)}"></div><div class="field"><label for="f-sv">Data do serviço</label><input type="date" id="f-sv" value="${esc(m.servico || (m0 ? C.ymd(new Date()) : ""))}"></div></div>
    <div class="two"><div class="field"><label for="f-em">Empresa</label><input id="f-em" value="${esc(m.empresa || "")}"></div><div class="field"><label for="f-vl">Validade do serviço</label><input type="date" id="f-vl" value="${esc(m.validade || "")}"></div></div>
    <div class="field"><label for="f-ob">Ação corretiva / observação</label><input id="f-ob" value="${esc(m.obs || "")}"></div>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="f-ok">${m0 ? "Liberar para uso" : "Salvar"}</button></div>`, (el, close) => {
    el.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    el.querySelector("#f-ok").onclick = () => { close(); adminCall("setManut", {id: m.id, equip: el.querySelector("#f-eq").value, desde: el.querySelector("#f-ds").value, servico: el.querySelector("#f-sv").value, empresa: el.querySelector("#f-em").value, validade: el.querySelector("#f-vl").value, obs: el.querySelector("#f-ob").value, status: m0 ? "Liberado" : "Em manutenção"}); };
  });
}
function treinoForm(){
  modal(`<div class="m-head"><h2>Registrar treinamento</h2><button class="x" data-x>×</button></div>
    <div class="two"><div class="field"><label for="f-dt">Data</label><input type="date" id="f-dt" value="${C.ymd(new Date())}"></div><div class="field"><label for="f-in">Instrutor</label><input id="f-in"></div></div>
    <div class="field"><label for="f-as">Assunto</label><input id="f-as" placeholder="Ex.: Boas Práticas, higienização das mãos"></div>
    <div class="field"><span class="lbl">Participantes</span><div class="checks">${ST.people.filter(p => p.ativo !== false).map(p => `<label><input type="checkbox" value="${p.id}"> ${esc(p.apelido || p.nome)}</label>`).join("")}</div></div>
    <p class="sub">Anexe a lista de presença assinada na pasta do manual (POP 7B).</p>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="f-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    m.querySelector("#f-ok").onclick = () => { const parts = [...m.querySelectorAll(".checks input:checked")].map(i => i.value); close(); adminCall("addTreino", {data: m.querySelector("#f-dt").value, instrutor: m.querySelector("#f-in").value, assunto: m.querySelector("#f-as").value, participantes: parts}); };
  });
}

/* ---------- relatórios ---------- */
function tabRel(){
  const now = new Date();
  const months = Array.from({length: 7}, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return {v: C.ymd(d).slice(0, 7), l: d.toLocaleDateString("pt-BR", {month: "long", year: "numeric"})}; });
  const bolso = CL("bolso"); const hist = [];
  const per = {}; ST.records.filter(r => r.cl === "bolso").forEach(r => { (per[r.period] = per[r.period] || {})[r.item] = r; });
  Object.entries(per).sort().reverse().forEach(([k, ans]) => { const s = C.bolsoScore(bolso, ans); const any = Object.values(ans)[0]; hist.push({k, s, by: pname(any.by), date: any.date}); });
  const PL = [["1A","POP 1A · Exposição dos alimentos (pista fria e molhos)"],["1B","POP 1B · Recebimento de mercadorias"],["1C","POP 1C · Temperatura dos equipamentos"],["8A","POP 8A · Higiene das instalações, equipamentos e utensílios"],["9A","POP 9A · Sanitização do hortifrúti"],["CT","Controles: 2A/2B manutenção, 3A pragas, 5A água, 6A exames, 6B uniformes, 7B treinamentos"],["7A","POP 7A · Checklist de Bolso (notas da quinzena)"]];
  T().innerHTML = `<div class="grid2">
    <section class="card panel"><h2>Planilhas da rede (supervisor)</h2><p class="sub">Mesmo layout das planilhas POP do manual Spoleto, preenchidas com os registros do mês.</p>
      <div class="field"><label for="r-mes">Mês</label><select id="r-mes">${months.map(m => `<option value="${m.v}">${m.l}</option>`).join("")}</select></div>
      <div class="checks">${PL.map(([k, l]) => `<label><input type="checkbox" value="${k}" checked> ${l}</label>`).join("")}</div>
      <p class="status" id="r1-st"></p><button class="btn" id="r1">Gerar PDF das planilhas</button></section>
    <section class="card panel"><h2>Relatório para a Vigilância</h2><p class="sub">Organizado pelos 9 POPs da Portaria CVS 3/2026, com temperaturas, não conformidades, ações corretivas, documentos e anexo de fotos.</p>
      <div class="two"><div class="field"><label for="r-de">De</label><input type="date" id="r-de" value="${C.ymd(C.addDays(now, -6))}"></div><div class="field"><label for="r-ate">Até</label><input type="date" id="r-ate" value="${C.ymd(now)}"></div></div>
      <div class="checks"><label><input type="checkbox" id="r-fotos" checked> Incluir anexo fotográfico</label></div>
      <p class="status" id="r2-st"></p><button class="btn" id="r2">Gerar PDF da Vigilância</button></section>
  </div>
  <section class="card panel mt"><h2>Checklist de Bolso: notas (POP 7A)</h2><div class="tbl-wrap"><table><thead><tr><th>Quinzena</th><th>Aplicado por</th><th class="r">Conformes</th><th class="r">%</th><th>Estrelas</th></tr></thead><tbody>${hist.length ? hist.map(h => `<tr><td class="num">${esc(h.k.slice(2))}</td><td>${esc(h.by)} · ${C.brShort(h.date)}</td><td class="r num">${h.s.ok}/${h.s.tot}</td><td class="r num">${h.s.pct.toFixed(1).replace(".", ",")}%</td><td>${h.s.elim ? `<span class="pill p-bad">0 · item eliminatório</span>` : `<span class="stars">${"★".repeat(h.s.stars)}${"☆".repeat(5 - h.s.stars)}</span>`}</td></tr>`).join("") : `<tr><td colspan="5" class="empty">Nenhuma autoavaliação ainda. Ela aparece na tela da equipe para o gerente e a subgerente.</td></tr>`}</tbody></table></div><p class="sub">Escala da rede: 95% = 5 estrelas · 86% = 4 · 77% = 3 (mínimo aceitável) · 67% = 2 · 57% = 1. Item eliminatório não conforme zera a nota.</p></section>`;
  const ctx = async (from, to, withPhotos, st) => {
    st.className = "status"; st.textContent = "Buscando registros…";
    const records = await A.records(adminToken(), from, to);
    let photos = {};
    if(withPhotos){ const ids = [...new Set(records.filter(r => r.photo).map(r => r.photo))]; if(ids.length){ st.textContent = `Baixando ${ids.length} fotos…`; photos = await A.photos(adminToken(), ids); } }
    return {records, photos, people: ST.people, owners: ST.owners, docs: ST.docs, pdocs: ST.pdocs, manut: ST.manut, treinos: ST.treinos, loja: ST.loja, from, to, now: new Date()};
  };
  $("#r1").onclick = async () => {
    const st = $("#r1-st"), m = $("#r-mes").value, sel = [...T().querySelectorAll("section:first-child .checks input:checked")].map(i => i.value);
    const from = m + "-01", to = C.ymd(C.lastDay(C.fromYmd(from)));
    try{ const c = await ctx(from, to, false, st); st.textContent = "Montando o PDF…"; const out = REPORTS.rede(c, m, sel); await savePdf(out, st); }catch(e){ st.className = "status bad"; st.textContent = "Não foi possível gerar: " + e.message; console.error(e); }
  };
  $("#r2").onclick = async () => {
    const st = $("#r2-st"); const a = $("#r-de").value, b = $("#r-ate").value; const from = a < b ? a : b, to = a < b ? b : a;
    try{ const c = await ctx(from, to, $("#r-fotos").checked, st); st.textContent = "Montando o PDF…"; const out = REPORTS.vigilancia(c, {photos: $("#r-fotos").checked}); await savePdf(out, st); }catch(e){ st.className = "status bad"; st.textContent = "Não foi possível gerar: " + e.message; console.error(e); }
  };
}
let DL = null;
if(window.claude && window.claude.use){ window.claude.use("downloads").then(d => DL = d).catch(() => {}); }
async function savePdf({doc, name, pages}, st){
  if(window.claude && window.claude.use){
    if(!DL){ st.className = "status bad"; st.textContent = "Esta visualização não permite baixar arquivos."; return; }
    try{ await DL.save({filename: name, data: doc.output("blob")}); st.className = "status ok"; st.textContent = `PDF salvo: ${name} (${pages} páginas).`; }
    catch(e){ st.className = "status bad"; st.textContent = e && e.code === "declined" ? "Download cancelado." : "Não foi possível salvar o PDF."; }
    return;
  }
  doc.save(name); st.className = "status ok"; st.textContent = `PDF gerado: ${name} (${pages} páginas).`;
}

/* ---------- configurações ---------- */
function tabCfg(){
  const me = (ST.admin && ST.admin.person) || ST.person.person;
  const regs = D.CHECKLISTS;
  const notifOn = typeof Notification !== "undefined" && Notification.permission === "granted";
  if(!canEdit()){
    T().innerHTML = `<section class="card panel"><h2>Este aparelho</h2>
      <p class="sub">Acesso de consulta: painel, histórico, documentos e relatórios. Alterações ficam com a gestão da loja e a administradora do sistema.</p>
      <div class="who-act"><button class="btn ghost" id="cfg-pin">Trocar meu PIN</button><button class="btn ghost" id="my-nf">Minhas notificações</button>
      ${CFG.firebase ? `<button class="btn" id="push-on">${notifOn ? "Notificações ativadas · reenviar registro" : "Ativar notificações neste celular"}</button><button class="btn ghost" id="push-test">Enviar notificação de teste</button>` : ""}
      <button class="btn ghost" id="logout-adm">Sair</button></div><p class="status" id="dev-st"></p>
</section>`;
    $("#cfg-pin").onclick = () => changePinFlow(adminToken(), false);
    $("#my-nf").onclick = () => notifForm(ST.people.find(p => p.id === me_().id) || me_());
    $("#logout-adm").onclick = () => { A.logout(adminToken()); ls.del("rotina-admin"); ST.admin = null; if(ST.person && GEST(ST.person.person)) ST.person = null; ST.view = "team"; ls.set("rotina-view", "team"); render(); };
    const po = $("#push-on"); if(po) po.onclick = () => PUSH.enable(adminToken(), $("#dev-st"));
    const pt = $("#push-test"); if(pt) pt.onclick = async () => { try{ await A.admin("testPush", adminToken(), {}); $("#dev-st").textContent = "Teste enviado."; }catch(e){ $("#dev-st").textContent = "Falhou: " + e.message; } };
    return;
  }
  T().innerHTML = `
    <section class="card panel"><div class="panel-h"><h2>Equipe</h2><button class="btn ghost sm" id="add-p">+ Pessoa</button></div>
    <div class="tbl-wrap"><table><thead><tr><th>Nome</th><th>Função</th><th>Turno</th><th>Acesso</th><th></th></tr></thead><tbody>${ST.people.map(p => `<tr class="${p.ativo === false ? "muted" : ""}"><td><b>${esc(p.nome)}</b>${p.apelido ? `<small>${esc(p.apelido)}</small>` : ""}</td><td>${esc(p.funcao)}</td><td>${esc(p.turno || "")}</td><td>${papelTxt(p)}${p.ativo === false ? " · inativo" : ""}${p.notif ? "<small>Recebe notificações</small>" : ""}</td><td>${GEST(p) && !isMaster() && p.id !== me_().id ? `<small>Só a administradora do sistema edita</small>` : `<button class="btn ghost sm" data-pe="${p.id}">Editar</button>`}${GEST(p) && (isMaster() || p.id === me_().id) ? ` <button class="btn ghost sm" data-nf="${p.id}">Notificações</button>` : ""}</td></tr>`).join("")}</tbody></table></div></section>
    <section class="card panel mt"><div class="panel-h"><h2>Responsáveis pelas tarefas</h2><span class="ref">Sem responsável = aberto a todos</span></div>
    <p class="sub">Enquanto a equipe está incompleta, deixe tudo aberto: quem fizer, registra. Quando definir um responsável, a tarefa aparece como "Sua tarefa" para ele, mas qualquer pessoa ainda pode cobrir.</p>
    <div class="rows">${regs.map(c => { const o = ownersOf(c.id); return `<div class="row"><span class="num t-m">${c.freq === "daily" ? c.start : c.freq === "ondemand" ? "—" : c.freq.slice(0, 3).toUpperCase()}</span><span><b>${esc(c.title)}</b><small>${o ? "Responsável: " + esc(o.map(pname).join(", ")) : "Aberto a todos"}</small></span><button class="btn ghost sm" data-ow="${c.id}">Definir</button></div>`; }).join("")}</div></section>
    <section class="card panel mt"><h2>Identificação da loja</h2><p class="sub">Vai no cabeçalho dos relatórios.</p>
      <div class="two">${[["nome","Nome da loja"],["razao","Razão social"],["cnpj","CNPJ"],["ie","Inscrição estadual"],["endereco","Endereço"],["respLegal","Responsável legal"],["respTecnico","Responsável técnico"],["respBP","Responsável pelas Boas Práticas"],["horario","Horário de funcionamento"]].map(([k, l]) => `<div class="field"><label for="l-${k}">${l}</label><input id="l-${k}" data-l="${k}" value="${esc(ST.loja[k] || "")}"></div>`).join("")}</div>
      <button class="btn" id="save-l">Salvar identificação</button></section>
    <section class="card panel mt"><h2>Este aparelho</h2>
      <p class="sub">Tipo: <b>${isTablet() ? "Tablet da cozinha" : "Celular do gestor"}</b> · Gestor conectado: <b>${esc(me.apelido || me.nome)}</b></p>
      <div class="who-act">
        <button class="btn ghost" id="dev-t">${isTablet() ? "Usar como celular do gestor" : "Usar como tablet da cozinha"}</button>
        ${CFG.firebase ? `<button class="btn" id="push-on">${notifOn ? "Notificações ativadas · reenviar registro" : "Ativar notificações neste celular"}</button><button class="btn ghost" id="push-test">Enviar notificação de teste</button>` : `<span class="sub">Notificações: configure o Firebase no arquivo config.js.</span>`}
        <button class="btn ghost" id="cfg-pin">Trocar meu PIN</button>
        <button class="btn ghost" id="my-nf">Minhas notificações</button>
        ${isMaster() ? `<button class="btn ghost" id="revoke">Encerrar acesso de todos os aparelhos</button>` : ""}
        <button class="btn ghost" id="logout-adm">Sair da gestão</button>
        ${isDemo ? `<button class="btn ghost" id="reset-demo">Restaurar dados de exemplo</button>` : ""}
      </div><p class="status" id="dev-st"></p></section>
    <p class="legal">Versão das regras ${esc(D.VERSION)} · Portaria CVS 3/2026 em vigor a partir de 01/02/2027 (Portaria CVS 9/2026); até lá vale a CVS 5/2013. Os critérios aqui já seguem a regra nova.</p>`;
  $("#add-p").onclick = () => personForm();
  $("#cfg-pin").onclick = () => changePinFlow(adminToken(), false);
  $("#my-nf").onclick = () => notifForm(ST.people.find(p => p.id === me_().id) || me_());
  const rv = $("#revoke"); if(rv) rv.onclick = () => modal(`<div class="m-head"><h2>Encerrar acesso dos aparelhos</h2><button class="x" data-x>×</button></div><p>Use se o tablet ou um celular for perdido ou trocado. Todos os aparelhos, inclusive o tablet, voltam para a tela "Ativar este aparelho" e precisam do PIN da gestão de novo. Os registros não são apagados.</p><div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="rv-ok">Encerrar agora</button></div>`, (m, close) => { m.querySelectorAll("[data-x]").forEach(b => b.onclick = close); m.querySelector("#rv-ok").onclick = () => { close(); adminCall("revokeDevices", {}, "Acessos encerrados. Ative os aparelhos de novo."); }; });
  T().querySelectorAll("[data-pe]").forEach(b => b.onclick = () => personForm(ST.people.find(p => p.id === b.dataset.pe)));
  T().querySelectorAll("[data-nf]").forEach(b => b.onclick = () => notifForm(ST.people.find(p => p.id === b.dataset.nf)));
  T().querySelectorAll("[data-ow]").forEach(b => b.onclick = () => ownersForm(b.dataset.ow));
  $("#save-l").onclick = () => { const o = {}; T().querySelectorAll("[data-l]").forEach(i => o[i.dataset.l] = i.value.trim()); adminCall("setLoja", o, "Identificação salva."); };
  $("#dev-t").onclick = () => { ls.set("rotina-devtype", isTablet() ? "phone" : "tablet"); toast("Tipo do aparelho alterado.", "ok"); tabCfg(); };
  $("#logout-adm").onclick = () => { A.logout(adminToken()); ls.del("rotina-admin"); ST.admin = null; if(ST.person && GEST(ST.person.person)) ST.person = null; ST.view = "team"; ls.set("rotina-view", "team"); render(); };
  const rd = $("#reset-demo"); if(rd) rd.onclick = () => { A.reset(); load(); toast("Dados de exemplo restaurados.", "ok"); };
  const po = $("#push-on"); if(po) po.onclick = () => PUSH.enable(adminToken(), $("#dev-st"));
  const pt = $("#push-test"); if(pt) pt.onclick = async () => { try{ await A.admin("testPush", adminToken(), {}); $("#dev-st").textContent = "Teste enviado. Deve chegar em alguns segundos."; }catch(e){ $("#dev-st").textContent = "Falhou: " + e.message; } };
}
function notifForm(p){
  const f = Object.assign({}, D.NOTIF_DEFAULTS[p.papel] || {}, p.prefs || {});
  const own = p.id === me_().id;
  const opts = [["pragas","Pragas ou indícios (aviso urgente, na hora)"],["nc","Outras não conformidades: temperatura fora da faixa, recebimento recusado, item não conforme"],["atraso","Checklist atrasado (até 3 horas depois do prazo)"],["resumo","Resumo do dia às 22h40 (rotinas feitas e não conformidades)"]];
  modal(`<div class="m-head"><h2>Notificações${own ? "" : ": " + esc(p.apelido || p.nome)}</h2><button class="x" data-x>×</button></div>
    <p class="sub">${own ? "Escolha o que chega no seu celular." : "Escolha o que chega no celular dessa pessoa."} O painel continua mostrando tudo.</p>
    <div class="checks"><label><input type="checkbox" id="nf-on" ${p.notif ? "checked" : ""}> <b>Receber notificações no celular</b></label></div>
    <div class="checks" id="nf-list">${opts.map(([k, l]) => `<label><input type="checkbox" data-nk="${k}" ${f[k] ? "checked" : ""}> ${l}</label>`).join("")}</div>
    <div class="field"><label for="nf-docs">Documentos (dedetização, caixa d'água, filtros, exames, calibração)</label>
      <select id="nf-docs"><option value="todos" ${f.docs === "todos" ? "selected" : ""}>Avisar 15 e 3 dias antes e quando vencer</option><option value="vencidos" ${f.docs === "vencidos" ? "selected" : ""}>Só quando vencer</option><option value="nao" ${f.docs === "nao" ? "selected" : ""}>Não avisar</option></select></div>
    <p class="sub">Para chegar, o celular também precisa estar com as notificações ativadas em Configurações > Este aparelho.</p>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="nf-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    const sync = () => { const on = m.querySelector("#nf-on").checked; m.querySelectorAll("#nf-list input, #nf-docs").forEach(i => i.disabled = !on); };
    m.querySelector("#nf-on").onchange = sync; sync();
    m.querySelector("#nf-ok").onclick = () => { const prefs = {docs: m.querySelector("#nf-docs").value}; m.querySelectorAll("[data-nk]").forEach(i => prefs[i.dataset.nk] = i.checked); close(); adminCall("setNotif", {personId: p.id, notif: m.querySelector("#nf-on").checked, prefs}, "Notificações atualizadas."); };
  });
}
function personForm(p0){
  const p = p0 || {id: "", nome: "", apelido: "", funcao: "Auxiliar de cozinha", turno: "", papel: "equipe", ativo: true, notif: false};
  modal(`<div class="m-head"><h2>${p0 ? "Editar pessoa" : "Nova pessoa"}</h2><button class="x" data-x>×</button></div>
    <div class="two"><div class="field"><label for="p-n">Nome</label><input id="p-n" value="${esc(p.nome)}"></div><div class="field"><label for="p-a">Como é chamada (opcional)</label><input id="p-a" value="${esc(p.apelido || "")}"></div></div>
    <div class="two"><div class="field"><label for="p-f">Função</label><input id="p-f" value="${esc(p.funcao)}"></div><div class="field"><label for="p-t">Turno</label><input id="p-t" value="${esc(p.turno || "")}" placeholder="Ex.: 10h30–22h30"></div></div>
    <div class="two"><div class="field"><label for="p-r">Acesso</label><select id="p-r"><option value="equipe" ${p.papel === "equipe" || !p.papel ? "selected" : ""}>Equipe (registra no tablet)</option>${isMaster() || p.papel === "admin" ? `<option value="admin" ${p.papel === "admin" ? "selected" : ""}>Gestão (painel, relatórios, responsáveis, equipe)</option>` : ""}${isMaster() ? `<option value="dono" ${p.papel === "dono" ? "selected" : ""}>Proprietário (consulta painel e relatórios, resumo diário)</option><option value="master" ${p.papel === "master" ? "selected" : ""}>Administradora do sistema (tudo, inclusive PIN da gestão)</option>` : ""}</select></div>
    <div class="field"><label for="p-pin">${p0 ? "Novo PIN (deixe em branco para manter)" : "PIN de 4 dígitos"}</label><input id="p-pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}"></div></div>
    <div class="checks"><label><input type="checkbox" id="p-at" ${p.ativo !== false ? "checked" : ""}> Ativo</label><label><input type="checkbox" id="p-no" ${p.notif ? "checked" : ""}> Recebe notificações no celular (só gestão e administradora)</label></div>
    <p class="err" id="p-err"></p>
    <div class="modal-foot"><button class="btn ghost" data-x>Cancelar</button><button class="btn" id="p-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    m.querySelector("#p-ok").onclick = () => {
      const nome = m.querySelector("#p-n").value.trim(), pin = m.querySelector("#p-pin").value.trim();
      if(!nome){ m.querySelector("#p-err").textContent = "Informe o nome."; return; }
      if((pin && !/^\d{4}$/.test(pin)) || (!p0 && !/^\d{4}$/.test(pin))){ m.querySelector("#p-err").textContent = "O PIN precisa ter 4 números."; return; }
      const id = p.id || nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "") + "-" + Math.random().toString(36).slice(2, 5);
      const papel = m.querySelector("#p-r").value;
      close(); adminCall("setPerson", {person: {id, nome, apelido: m.querySelector("#p-a").value.trim(), funcao: m.querySelector("#p-f").value.trim(), turno: m.querySelector("#p-t").value.trim(), papel, ativo: m.querySelector("#p-at").checked, notif: papel !== "equipe" && m.querySelector("#p-no").checked}, pin: pin || undefined});
    };
  });
}
function ownersForm(clId){
  const cl = CL(clId), cur = ownersOf(clId) || [];
  modal(`<div class="m-head"><h2>Responsável: ${esc(cl.title)}</h2><button class="x" data-x>×</button></div>
    <p class="sub">Marque uma ou mais pessoas. Sem ninguém marcado, a tarefa fica aberta a todos.</p>
    <div class="checks">${ST.people.filter(p => p.ativo !== false).map(p => `<label><input type="checkbox" value="${p.id}" ${cur.includes(p.id) ? "checked" : ""}> ${esc(p.apelido || p.nome)} <small class="muted">${esc(p.funcao)}${p.turno ? " · " + esc(p.turno) : ""}</small></label>`).join("")}</div>
    <div class="modal-foot"><button class="btn ghost" id="o-clear">Deixar aberto a todos</button><button class="btn" id="o-ok">Salvar</button></div>`, (m, close) => {
    m.querySelectorAll("[data-x]").forEach(b => b.onclick = close);
    m.querySelector("#o-clear").onclick = () => { close(); adminCall("setOwners", {cl: clId, owners: []}, "Tarefa aberta a todos."); };
    m.querySelector("#o-ok").onclick = () => { const o = [...m.querySelectorAll(".checks input:checked")].map(i => i.value); close(); adminCall("setOwners", {cl: clId, owners: o}, o.length ? "Responsável definido." : "Tarefa aberta a todos."); };
  });
}

/* ---------- início ---------- */
window.ROTINA = {ST, load, render};
if(token()) load(); else render();
if(window.PUSH) PUSH.init();
})();
