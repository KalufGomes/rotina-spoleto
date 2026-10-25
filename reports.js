/* Relatórios em PDF: planilhas no padrão da rede Spoleto/Trigo e relatório para a Vigilância (CVS 3/2026). */
(function(g){
const C = g.CORE, D = g.DEFS;
const NAVY=[22,35,63], GOLD=[184,145,58], RED=[179,38,30], GREEN=[31,122,77], AMBER=[168,98,7], GRAY=[98,106,122], INK=[27,33,48], SOFT=[243,234,212];
const CL = id => D.CHECKLISTS.find(c=>c.id===id);
const ITEM = (cl,id) => (CL(cl)?.items||[]).find(i=>i.id===id);
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const strip = s => String(s??"").replace(/[≤≥→]/g, m => ({"≤":"<=","≥":">=","→":"->"}[m]));

function mkDoc(orientation){ const {jsPDF} = g.jspdf; return new jsPDF({unit:"mm", format:"a4", orientation}); }
function ctxHelpers(ctx){
  const pname = id => { const p = ctx.people.find(x=>x.id===id); return p ? (p.apelido||p.nome) : (id||""); };
  const initials = id => { const n = pname(id).normalize("NFD").replace(/[̀-ͯ]/g,""); return n.slice(0,2).toUpperCase(); };
  return {pname, initials};
}
function baseTable(doc, extra){
  return Object.assign({
    theme:"grid", margin:{left:12, right:12, top:16, bottom:16},
    styles:{font:"helvetica", fontSize:7.6, cellPadding:1.4, lineColor:[210,206,196], lineWidth:.15, textColor:INK, overflow:"linebreak"},
    headStyles:{fillColor:NAVY, textColor:255, fontStyle:"bold", fontSize:7.2},
    alternateRowStyles:{fillColor:[249,248,245]},
    didParseCell: h => { if(h.section!=="body") return; const t = String(h.cell.raw ?? "");
      if(/^(Fora|Não conforme|NÃO|Não realizado|Vencido|Sem registro|Atrasado)/.test(t)){ h.cell.styles.textColor = RED; h.cell.styles.fontStyle = "bold"; }
      else if(/^!/.test(t)){ h.cell.text = [t.slice(1)]; h.cell.styles.textColor = RED; h.cell.styles.fontStyle = "bold"; }
      else if(/^(Vence|Feito com atraso)/.test(t)){ h.cell.styles.textColor = AMBER; h.cell.styles.fontStyle = "bold"; } },
  }, extra||{});
}
function footer(doc, left){
  const n = doc.getNumberOfPages();
  for(let i=1;i<=n;i++){ doc.setPage(i); const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    doc.setDrawColor(220,216,206); doc.setLineWidth(.2); doc.line(12, H-10, W-12, H-10);
    doc.setFont("helvetica","normal"); doc.setFontSize(6.8); doc.setTextColor(...GRAY);
    doc.text(left, 12, H-6); doc.text(`Página ${i} de ${n}`, W-12, H-6, {align:"right"}); }
  return n;
}

/* ===================== PLANILHAS DA REDE ===================== */
function rede(ctx, month, sel){
  const {pname, initials} = ctxHelpers(ctx);
  const [Y, M] = month.split("-").map(Number);
  const mesNome = MESES[M-1], loja = ctx.loja.nome || "Spoleto";
  const last = C.lastDay(new Date(Y, M-1, 1)).getDate();
  const todayStr = C.ymd(ctx.now);
  const days = Array.from({length:last}, (_,i)=>`${month}-${C.pad(i+1)}`);
  const recs = ctx.records;
  const idx = C.indexRecords(recs);
  let doc = null, first = true;
  const page = (orientation) => { if(first){ doc = mkDoc(orientation); first = false; } else doc.addPage("a4", orientation); return {W: doc.internal.pageSize.getWidth(), H: doc.internal.pageSize.getHeight()}; };
  const head = (title, sub) => {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...NAVY); doc.rect(0,0,W,13,"F");
    doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.text(title, 12, 8.6);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(...GOLD); doc.text("Kaluf & Gomes · Rotina da Cozinha", W-12, 8.6, {align:"right"});
    doc.setTextColor(...INK); doc.setFontSize(8.4);
    doc.text(`Loja: ${loja}`, 12, 19); doc.text(`Mês: ${mesNome}`, W/2-20, 19); doc.text(`Ano: ${Y}`, W-40, 19);
    if(sub){ doc.setFontSize(7.4); doc.setTextColor(...GRAY); doc.text(sub, 12, 23.5); }
    return 27;
  };
  const supervisao = (y) => { const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(); if(y > H-24){ doc.addPage(); y = 20; }
    doc.setFontSize(8); doc.setTextColor(...INK); doc.text("Supervisão: ______________________________________   Função: ______________________   Data: ____/____/______", 12, y+8); return y+12; };
  const obsBlock = (y, rows, title="Observações e ações corretivas") => {
    if(!rows.length) return y;
    doc.autoTable(baseTable(doc, {startY:y+3, head:[["Data","Hora","Item",title.includes("Medida")?"Registro":"Leitura","Ação corretiva","Descrição","Resp."]], body:rows, columnStyles:{0:{cellWidth:18},1:{cellWidth:11},3:{cellWidth:20},6:{cellWidth:16}}}));
    return doc.lastAutoTable.finalY;
  };
  const devRow = r => { const it = ITEM(r.cl, r.item); return [C.br(r.date), C.hm(new Date(r.ts)), r.item==="prod" ? r.extra.produto : (it?.q||r.item), r.v==="nc" ? "Não conforme" : C.fmtT(r.v), r.acao||"", r.obs||"", pname(r.by)]; };
  const inMonth = r => r.date && r.date.startsWith(month);

  /* ---- POP 1A ---- */
  if(sel.includes("1A")){
    const turns = [["expo_m","MANHÃ"],["expo_t","TARDE"],["expo_n","NOITE"]];
    const items = CL("expo_m").items;
    const daysUsed = days.filter(d => d <= todayStr);
    for(let i=0;i<daysUsed.length;i+=2){
      page("landscape"); let y = head("PLANILHA POP 1A · CONTROLE DE EXPOSIÇÃO DOS ALIMENTOS FRIOS (PISTA FRIA) E MOLHOS", "Pista fria: até 10 °C (pescado até 5 °C) · Molhos no atendimento: mín. 60 °C · leituras manhã (10h40), tarde (14h) e noite (19h)");
      const W = doc.internal.pageSize.getWidth(), half = (W-24-6)/2;
      [daysUsed[i], daysUsed[i+1]].forEach((d, k) => {
        if(!d) return;
        const ans = turns.map(([cl]) => idx[`D:${d}|${cl}`] || {});
        const body = items.map(it => [it.q + (it.max!=null ? ` (máx. ${it.max})` : ` (mín. ${it.min})`), ...ans.map(a => { const r = a[it.id]; if(!r) return ""; if(r.v==="na") return "N/A"; return (C.isDev(r, it) ? "!" : "") + String(r.v).replace(".",","); })]);
        const resp = ans.map(a => { const ids = [...new Set(Object.values(a).map(r=>r.by))]; return ids.map(pname).join(", "); });
        const hora = ans.map(a => { const v = Object.values(a); return v.length ? C.hm(new Date(v[0].ts)) : ""; });
        body.push([{content:"HORÁRIO", styles:{fontStyle:"bold"}}, ...hora], [{content:"RESPONSÁVEL", styles:{fontStyle:"bold"}}, ...resp]);
        doc.autoTable(baseTable(doc, {startY:y, margin:{left:12 + k*(half+6), right: k ? 12 : 12+half+6, top:16, bottom:14}, tableWidth:half,
          head:[[`DATA: ${C.br(d)}`, "MANHÃ", "TARDE", "NOITE"]], body, styles:{fontSize:6.6, cellPadding:.9, lineColor:[210,206,196], lineWidth:.15, textColor:INK},
          columnStyles:{0:{cellWidth:half*0.52}, 1:{halign:"center"}, 2:{halign:"center"}, 3:{halign:"center"}}}));
      });
      const devs = recs.filter(r => [daysUsed[i], daysUsed[i+1]].includes(r.date) && r.cl.startsWith("expo") && C.isDev(r, ITEM(r.cl, r.item)));
      let yy = Math.max(doc.lastAutoTable.finalY, y);
      yy = obsBlock(yy, devs.map(devRow));
      supervisao(yy);
    }
  }
  /* ---- POP 1B ---- */
  if(sel.includes("1B")){
    page("landscape"); let y = head("PLANILHA POP 1B · CONTROLE DE RECEBIMENTO DE MERCADORIAS", "Critérios (CVS 3/2026, Art. 30): congelados -12 °C ou menos · carnes 4 a 7 °C · pescados 2 a 3 °C · preparações cruas 0 a 5 °C · demais refrigerados até 10 °C · quentes acima de 60 °C");
    const runs = {}; recs.filter(r => r.cl==="recebimento" && inMonth(r)).forEach(r => (runs[r.run] = runs[r.run] || []).push(r));
    const yn = (rs, id, s="sim", n="não") => { const r = rs.find(x=>x.item===id); return !r ? "" : r.v==="ok" ? s : r.v==="na" ? "N/A" : "!"+n; };
    const body = [];
    Object.values(runs).sort((a,b) => a[0].ts < b[0].ts ? -1 : 1).forEach(rs => {
      const r0 = rs[0], prods = rs.filter(r => r.item==="prod");
      const equipe = `Uniformizados: ${yn(rs,"uniformizados").replace("!","")} · Veículo limpo: ${yn(rs,"veiculo_limpo").replace("!","")} · Conservação: ${yn(rs,"veiculo_conserv").replace("!","")} · Higiene: ${yn(rs,"higiene_entreg","satisfatória","não satisfatória").replace("!","")}`;
      const ncEquipe = rs.some(r => ["uniformizados","veiculo_limpo","veiculo_conserv","higiene_entreg","embalagens","recong"].includes(r.item) && r.v==="nc");
      (prods.length ? prods : [{extra:r0.extra||{}, v:""}]).forEach((p, i) => {
        const c = C.catOf(p.extra && p.extra.cat) || {}; const bad = p.item==="prod" && C.isDev(p);
        body.push([i ? "" : C.br(r0.date), i ? "" : C.hm(new Date(r0.ts)), i ? "" : pname(r0.by), i ? "" : (r0.extra && r0.extra.fornecedor || ""), p.extra.produto || "", p.v ? (bad?"!":"") + C.fmtT(p.v) : "–", c.txt || "", bad || (!i && ncEquipe) ? "!Sim" : "Não", i ? "" : equipe, [p.acao, p.obs].filter(Boolean).join(": ") || (!i ? rs.filter(r=>r.v==="nc").map(r=>[r.acao,r.obs].filter(Boolean).join(": ")).join(" · ") : "")]);
      });
    });
    doc.autoTable(baseTable(doc, {startY:y, head:[["Data","Horário","Responsável","Fornecedor","Produto","Temp.","Referência","NC","Equipe de entrega","Medida corretiva"]], body: body.length ? body : [[{content:"Nenhum recebimento registrado no mês.", colSpan:10, styles:{textColor:GRAY, fontStyle:"italic"}}]],
      columnStyles:{0:{cellWidth:17},1:{cellWidth:12},2:{cellWidth:18},3:{cellWidth:30},5:{cellWidth:15},6:{cellWidth:20},7:{cellWidth:9},8:{cellWidth:52}}}));
    supervisao(doc.lastAutoTable.finalY);
  }
  /* ---- POP 1C ---- */
  if(sel.includes("1C")){
    page("landscape"); let y = head("PLANILHA POP 1C · CONTROLE DE TEMPERATURA DOS EQUIPAMENTOS", "M = manhã (abertura e pré-serviço) · N = noite (fechamento) · valores em °C");
    const eqs = D.EQUIP.filter(e=>e.pop1c);
    const head1 = [{content:"Data", rowSpan:2}, ...eqs.map(e => ({content:`${e.nome}\n${C.critText(e)}`, colSpan:2, styles:{halign:"center"}})), {content:"Responsável", rowSpan:2}];
    const head2 = eqs.flatMap(() => [{content:"M", styles:{halign:"center"}},{content:"N", styles:{halign:"center"}}]);
    const findT = (d, eid, l) => recs.find(r => r.date===d && r.item==="eq_"+eid && ITEM(r.cl, r.item)?.leitura===l);
    const body = days.filter(d=>d<=todayStr).map(d => { const ppl = new Set(); const cells = eqs.flatMap(e => ["M","N"].map(l => { const r = findT(d, e.id, l); if(!r) return ""; ppl.add(r.by); return (C.isDev(r, ITEM(r.cl,r.item))?"!":"") + String(r.v).replace(".",","); }));
      return [d.slice(8), ...cells, [...ppl].map(pname).join(", ")]; });
    doc.autoTable(baseTable(doc, {startY:y, head:[head1, head2], body, styles:{fontSize:6.6, cellPadding:.8, halign:"center", lineColor:[210,206,196], lineWidth:.15, textColor:INK}, headStyles:{fillColor:NAVY, textColor:255, fontSize:6.2, fontStyle:"bold", valign:"middle"}, columnStyles:{0:{cellWidth:9}, [eqs.length*2+1]:{cellWidth:34, halign:"left"}}}));
    const devs = recs.filter(r => inMonth(r) && r.item.startsWith("eq_") && C.isDev(r, ITEM(r.cl, r.item)));
    let yy = obsBlock(doc.lastAutoTable.finalY, devs.map(devRow), "OBSERVAÇÕES");
    supervisao(yy);
  }
  /* ---- POP 8A ---- */
  if(sel.includes("8A")){
    page("landscape"); let y = head("PLANILHA POP 8A · CONTROLE DE HIGIENE DAS INSTALAÇÕES, EQUIPAMENTOS E UTENSÍLIOS", `Período ${C.br(days[0])} a ${C.br(days[days.length-1])} · Freq.: D diária, S semanal, M mensal · cada célula traz as iniciais de quem fez`);
    const MAP = [
      ["Balança","D",[["limp_m","balanca"]]],["Balcão refrigerado","S",[["semanal","balcao_ref"]]],["Bancadas","D",[["limp_m","bancadas"],["fechamento","bancadas"]]],
      ["Caixa de gordura","Terc.",[]],["Dispensers sabonete/álcool","S",[["semanal","dispensers"]]],["Estoque seco","S",[["semanal","estoque"]]],["Estrados/prateleiras estoque","S",[["semanal","estrados"]]],
      ["Forno","D",[["fechamento","forno_in"],["semanal","forno_fora"]]],["Freezer","S",[["semanal","freezer_l"]]],["Frigideiras","D",[["fechamento","frigideiras"]]],["Geladeira de bebidas","D",[["limp_m","geladeira_beb"]]],
      ["Interruptores/tomadas","S",[["semanal","interruptores"]]],["Lixeiras","D",[["limp_t","lixo"],["fechamento","lixo"],["semanal","lixeiras"]]],["Luminárias","M",[["mensal","luminarias"]]],
      ["Máquina de gelo","S",[["semanal","gelo_l"]]],["Organizadores","S",[["semanal","organizadores"]]],["Paredes","S",[["semanal","paredes"]]],["Piso/rodapé","D",[["limp_m","piso"],["limp_t","piso"],["fechamento","piso"]]],
      ["Pista fria","D",[["fechamento","pista_l"]]],["Portas","S",[["semanal","portas"]]],["Prateleiras frente de loja","S",[["semanal","prateleiras_frente"]]],["Ralos","D",[["fechamento","ralos"]]],
      ["Tábuas de corte: higienização","D",[["fechamento","tabuas"]]],["Teto","S",[["semanal","teto"]]],
    ];
    const ownersTxt = (pairs) => { const o = new Set(); pairs.forEach(([cl]) => ((ctx.owners||{})[cl]?.owners||[]).forEach(x=>o.add(x))); return o.size ? [...o].map(initials).join("/") : "Todos"; };
    const body = MAP.map(([nome, f, pairs]) => [nome, ownersTxt(pairs), f, ...days.map(d => { if(!pairs.length) return ""; const who = new Set(); let nc = false;
      recs.forEach(r => { if(r.date===d && pairs.some(([c,i]) => r.cl===c && r.item===i) && r.v!=="na"){ who.add(initials(r.by)); if(r.v==="nc") nc = true; } });
      return who.size ? (nc?"!":"") + [...who].join("/") : ""; })]);
    doc.autoTable(baseTable(doc, {startY:y, head:[["Estrutura","Resp.","Freq.", ...days.map(d=>String(+d.slice(8)))]], body,
      styles:{fontSize:5.2, cellPadding:.6, halign:"center", lineColor:[210,206,196], lineWidth:.12, textColor:INK, overflow:"hidden"}, headStyles:{fillColor:NAVY, textColor:255, fontSize:5.6, fontStyle:"bold", halign:"center"},
      columnStyles:Object.assign({0:{cellWidth:38, halign:"left", fontSize:6.2}, 1:{cellWidth:10}, 2:{cellWidth:8}}, Object.fromEntries(days.map((_,i)=>[i+3,{cellWidth:(doc.internal.pageSize.getWidth()-24-56)/days.length}])))}));
    let yy = doc.lastAutoTable.finalY + 4;
    doc.setFontSize(6.8); doc.setTextColor(...GRAY);
    doc.text("Iniciais: " + ctx.people.filter(p=>p.papel!=="master" && p.papel!=="dono").map(p => `${initials(p.id)} = ${p.apelido||p.nome}`).join(" · ") + " · Caixa de gordura: serviço terceirizado, conforme demanda. Banheiros, vitrines e geladeiras do estoque: não se aplicam a esta loja.", 12, yy, {maxWidth: doc.internal.pageSize.getWidth()-24});
    const devs = recs.filter(r => inMonth(r) && ["limp_m","limp_t","fechamento","semanal","mensal"].includes(r.cl) && r.v==="nc" && ITEM(r.cl,r.item)?.pop==="higien");
    yy = obsBlock(yy+4, devs.map(devRow));
    supervisao(yy);
  }
  /* ---- POP 9A ---- */
  if(sel.includes("9A")){
    page("portrait"); let y = head("PLANILHA POP 9A · CONTROLE DA SANITIZAÇÃO DO HORTIFRÚTI", "Produto: CIF Sanitizante de Hortifrutícolas · 5 ml/L · imersão de 30 segundos com timer");
    const runs = {}; recs.filter(r => r.cl==="hortifruti" && inMonth(r)).forEach(r => (runs[r.run] = runs[r.run] || []).push(r));
    const body = Object.values(runs).sort((a,b)=>a[0].ts<b[0].ts?-1:1).map(rs => { const tipo = (rs.find(r=>r.item==="tipo")||{}).v || ""; const t = String(tipo).split("|"); const nc = rs.some(r=>r.v==="nc");
      return [C.br(rs[0].date)+" "+C.hm(new Date(rs[0].ts)), t.includes("Folhosos")?"X":"", t.includes("Frutas")?"X":"", t.includes("Legumes")?"X":"", (rs.find(r=>r.item==="produto")||{}).v==="ok" ? "5 ml/L conferido" : "!Fora", (rs.find(r=>r.item==="imersao")||{}).v==="ok" ? "30 s (timer)" : "!Fora", pname(rs[0].by), nc ? "Não conforme" : "Conforme"]; });
    doc.autoTable(baseTable(doc, {startY:y, head:[["Data","Folhosos","Frutas","Legumes","Concentração","Tempo de imersão","Responsável","Verificação"]], body: body.length ? body : [[{content:"Nenhuma higienização registrada no mês.", colSpan:8, styles:{textColor:GRAY, fontStyle:"italic"}}]], columnStyles:{1:{halign:"center"},2:{halign:"center"},3:{halign:"center"}}}));
    const devs = recs.filter(r => r.cl==="hortifruti" && inMonth(r) && r.v==="nc");
    let yy = doc.lastAutoTable.finalY;
    if(devs.length) yy = obsBlock(yy, devs.map(devRow), "Ação corretiva");
    doc.setFontSize(6.8); doc.setTextColor(...GRAY);
    doc.text(doc.splitTextToSize("Ações corretivas: 01 Repetir a lavagem; 02 Se a solução estiver abaixo do indicado, ajustar a dosagem e refazer o monitoramento; 03 Se estiver acima, acrescentar água e refazer; 04 Observar gramatura e tempo de imersão do fabricante; 05 Repetir o treinamento; 06 Substituir dosador ou produto; 07 Armazenar o produto em local seco e protegido.", doc.internal.pageSize.getWidth()-24), 12, yy+6);
    supervisao(yy+14);
  }
  /* ---- Controles: 2A/2B, 3A, 5A, 6A, 6B, 7B ---- */
  if(sel.includes("CT")){
    page("portrait"); let y = head("CONTROLES PERIÓDICOS · POP 2A/2B, 3A, 5A, 6A, 6B E 7B", "Datas registradas no sistema; anexar os comprovantes na pasta do Manual de Boas Práticas");
    const docHist = id => { const d = (ctx.docs||[]).find(x=>x.id===id) || {}; const h = (d.hist||[]).slice(); if(d.last && !h.some(x=>x.last===d.last)) h.push({last:d.last, empresa:d.empresa, obs:d.obs}); return h.sort((a,b)=>a.last<b.last?-1:1); };
    const def = id => D.DOCS.find(x=>x.id===id);
    const nextOf = (id, last) => { const dd = def(id); return last && dd.every ? C.br(C.ymd(C.addDays(C.fromYmd(last), dd.every))) : ""; };
    const sec = (t) => { if(y > doc.internal.pageSize.getHeight()-40){ doc.addPage(); y = 20; } doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY); doc.text(t, 12, y+5); y += 8; };
    const tbl = (h, b, cs) => { doc.autoTable(baseTable(doc, {startY:y, head:[h], body: b.length ? b : [[{content:"Sem registro.", colSpan:h.length, styles:{textColor:GRAY, fontStyle:"italic"}}]], columnStyles:cs||{}})); y = doc.lastAutoTable.finalY + 4; };
    sec("POP 2A · Equipamentos em manutenção (não utilizar)");
    tbl(["Equipamento","Desde","Situação","Observação"], (ctx.manut||[]).map(m => [(D.EQUIP.find(e=>e.id===m.equip)||{nome:m.equip}).nome, C.br(m.desde), m.status, m.obs||""]));
    sec("POP 2B · Controle de manutenção de equipamentos");
    const b2 = (ctx.manut||[]).filter(m=>m.servico).map(m => [(D.EQUIP.find(e=>e.id===m.equip)||{nome:m.equip}).nome, m.obs||"", m.empresa||"", C.br(m.servico), m.validade?C.br(m.validade):"", ""]);
    docHist("calib").forEach(h => b2.push(["Termômetro e balança (calibração)", "Calibração", h.empresa||"", C.br(h.last), nextOf("calib", h.last), ""]));
    tbl(["Equipamento","Ação corretiva","Empresa","Data serviço","Data validade","Responsável"], b2);
    sec(`POP 3A · Controle de pragas e vetores · ${Y}`);
    const dh = docHist("dedet");
    tbl(["Mês","Empresa","Data serviço","Data validade","Observação"], MESES.map((m, i) => { const h = dh.filter(x => x.last.startsWith(`${Y}-${C.pad(i+1)}`)); return [m[0].toUpperCase()+m.slice(1), h.map(x=>x.empresa).join(", "), h.map(x=>C.br(x.last)).join(", "), h.map(x=>nextOf("dedet", x.last)).join(", "), h.map(x=>x.obs||"").join(" ")]; }), {0:{cellWidth:24}});
    const pragas = recs.filter(r => inMonth(r) && ((r.item==="pragas" && r.v==="nc") || (r.cl==="ocorrencia" && r.item==="tipo" && r.v==="Praga ou indício")));
    tbl(["Data","Ocorrência","Ação"], pragas.map(r => { const desc = r.cl==="ocorrencia" ? (recs.find(x=>x.run===r.run && x.item==="descricao")||{}).v : r.obs; return [C.br(r.date)+" "+C.hm(new Date(r.ts)), desc||"", r.acao||""]; }), {0:{cellWidth:26}});
    sec("POP 5A · Potabilidade da água");
    tbl(["Controle","Empresa","Data execução","Data validade","Observação"], ["reserv","vistoria","analise","filtro","filtro_gelo"].flatMap(id => { const h = docHist(id); return h.length ? h.map(x => [def(id).tipo, x.empresa||def(id).empresa, C.br(x.last), nextOf(id, x.last), x.obs||""]) : [[def(id).tipo, def(id).empresa, "!Sem registro", "", ""]]; }));
    const retro = recs.filter(r => inMonth(r) && r.cl==="semanal" && r.item==="retrolavagem");
    tbl(["Retrolavagem do filtro","1ª semana","2ª semana","3ª semana","4ª semana","5ª semana"], [["Data (responsável)", ...[1,2,3,4,5].map(w => { const r = retro.find(x => Math.ceil(+x.date.slice(8)/7)===w); return r ? `${C.brShort(r.date)} (${pname(r.by)})` : ""; })]]);
    sec("POP 6A · Controle de exames de saúde");
    const pd = (pid, id) => (ctx.pdocs||{})[pid+"|"+id];
    const pdef = id => D.PERSON_DOCS.find(x=>x.id===id);
    tbl(["Manipulador","Função","Data exame","Data próximo exame"], ctx.people.filter(p=>p.ativo!==false && p.papel!=="master" && p.papel!=="dono").map(p => { const l = pd(p.id,"exame"); return [p.nome, p.funcao, l?C.br(l):"!Sem registro", l?C.br(C.ymd(C.addDays(C.fromYmd(l), pdef("exame").every))):""]; }));
    sec("POP 6B · Recebimento de EPI, EPC e uniforme (troca a cada 6 meses)");
    tbl(["Colaborador","Função","Última entrega","Próxima troca"], ctx.people.filter(p=>p.ativo!==false && p.papel!=="master" && p.papel!=="dono").map(p => { const l = pd(p.id,"uniforme"); return [p.nome, p.funcao, l?C.br(l):"!Sem registro", l?C.br(C.ymd(C.addDays(C.fromYmd(l), pdef("uniforme").every))):""]; }));
    sec("POP 7B · Controle de capacitação dos colaboradores");
    tbl(["Data","Assunto do treinamento","Instrutor","Participantes"], (ctx.treinos||[]).map(t => [C.br(t.data), t.assunto, t.instrutor, (t.participantes||[]).map(pname).join(", ")]));
    tbl(["Colaborador","Curso de Boas Práticas (8 h)"], ctx.people.filter(p=>p.ativo!==false && p.papel!=="master" && p.papel!=="dono").map(p => { const l = pd(p.id,"curso"); return [p.nome, l?C.br(l):"!Sem registro"]; }));
    doc.setFontSize(7); doc.setTextColor(...GRAY); doc.text("Obs.: anexar a lista de presença dos treinamentos assinada pelos colaboradores.", 12, y+2);
  }
  /* ---- POP 7A ---- */
  if(sel.includes("7A")){
    const cl = CL("bolso"); const pers = [`Q:${month}-1`, `Q:${month}-2`];
    pers.forEach((per, qi) => {
      const ans = idx[per+"|bolso"]; if(!ans && qi===1 && `${month}-16` > todayStr) return;
      page("portrait"); let y = head(`POP 7A · CHECKLIST DE BOLSO · ${qi?"2ª":"1ª"} QUINZENA`, "Autoavaliação no padrão da auditoria da rede. Item eliminatório (*) não conforme zera a nota.");
      if(!ans){ doc.setFontSize(9); doc.setTextColor(...RED); doc.text("Checklist de Bolso não aplicado nesta quinzena.", 12, y+6); return; }
      const sc = C.bolsoScore(cl, ans); const any = Object.values(ans)[0];
      doc.autoTable(baseTable(doc, {startY:y, head:[["Bloco","Item de verificação","Resultado"]], body: cl.items.map(it => { const r = ans[it.id]; return [it.grp, it.q + (it.elim?" *":""), !r ? "" : r.v==="ok" ? "OK" : r.v==="na" ? "N/A" : "NÃO OK"+(r.obs?": "+r.obs:"")]; }), columnStyles:{0:{cellWidth:34}, 2:{cellWidth:40}}}));
      y = doc.lastAutoTable.finalY + 6;
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(...(sc.stars>=3?GREEN:RED));
      doc.text(`Resultado: ${sc.ok}/${sc.tot} conformes · ${sc.pct.toFixed(2).replace(".",",")}% · ${sc.elim ? "0 estrela (item eliminatório)" : sc.stars + " estrela" + (sc.stars===1?"":"s")}`, 12, y);
      doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(...GRAY); doc.text(`Aplicado por ${pname(any.by)} em ${C.br(any.date)}. Mínimo aceitável pela rede: 3 estrelas (77%).`, 12, y+5);
    });
  }
  if(!doc){ doc = mkDoc("portrait"); doc.text("Nenhuma planilha selecionada.", 12, 20); }
  const pages = footer(doc, `${loja} · ${mesNome}/${Y} · Registros eletrônicos com data, hora e responsável · guarda mínima de 180 dias (CVS 3/2026, Art. 181)`);
  return {doc, pages, name:`Planilhas-POP-${loja.replace(/\s+/g,"-")}-${month}.pdf`};
}

/* ===================== VIGILÂNCIA ===================== */
const POPS_CVS = [
  ["saude","1","Higiene e saúde dos funcionários","Art. 172"],["capacit","2","Capacitação","Art. 173"],["receb","3","Controle de qualidade no recebimento","Art. 174"],
  ["higien","4","Higienização de instalações, equipamentos e utensílios","Art. 175"],["agua","5","Reservatório e potabilidade da água","Art. 176"],["manut","6","Manutenção e calibração de equipamentos","Art. 177"],
  ["pragas","7","Controle de vetores e pragas urbanas","Art. 178"],["residuos","8","Manejo de resíduos","Art. 179"],["transp","9","Transporte e entrega (delivery)","Arts. 112, 113 e 180"],
];
function vigilancia(ctx, opts){
  const {pname} = ctxHelpers(ctx);
  const doc = mkDoc("portrait"), W = 210, H = 297, M = 12;
  const recs = ctx.records, loja = ctx.loja.nome || "Spoleto";
  const per = ctx.from===ctx.to ? C.br(ctx.from) : `${C.br(ctx.from)} a ${C.br(ctx.to)}`;
  const days = []; for(let d = C.fromYmd(ctx.from); C.ymd(d) <= ctx.to; d = C.addDays(d,1)) days.push(C.ymd(d));
  const todayStr = C.ymd(ctx.now);
  const idx = C.indexRecords(recs);
  let y = 0;
  const T = (head, body, cs, extra) => { doc.autoTable(baseTable(doc, Object.assign({startY:y, head:[head], body: body.length ? body : [[{content:"Sem registros no período.", colSpan:head.length, styles:{textColor:GRAY, fontStyle:"italic"}}]], columnStyles:cs||{}}, extra||{}))); y = doc.lastAutoTable.finalY + 5; };
  const need = h => { if(y + h > H-18){ doc.addPage(); y = 18; } };
  const h1 = (t, ref) => { need(20); doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(...NAVY); doc.text(t, M, y); doc.setDrawColor(...GOLD); doc.setLineWidth(.6); doc.line(M, y+1.8, M+18, y+1.8); if(ref){ doc.setFont("helvetica","normal"); doc.setFontSize(7.6); doc.setTextColor(...GRAY); doc.text(ref, W-M, y, {align:"right"}); } y += 6.5; };
  const h2 = (t, ref) => { need(14); doc.setFont("helvetica","bold"); doc.setFontSize(9.6); doc.setTextColor(...INK); doc.text(t, M, y); if(ref){ doc.setFont("helvetica","normal"); doc.setFontSize(7.2); doc.setTextColor(...GRAY); doc.text(ref, W-M, y, {align:"right"}); } y += 3.5; };
  const para = (t, s=8) => { doc.setFont("helvetica","normal"); doc.setFontSize(s); doc.setTextColor(...GRAY); const l = doc.splitTextToSize(t, W-2*M); need(l.length*s*.42+2); doc.text(l, M, y); y += l.length*s*.42 + 3; };

  doc.setFillColor(...NAVY); doc.rect(0,0,W,28,"F");
  doc.setTextColor(255); doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("Relatório de Boas Práticas: registros por POP", M, 12);
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("Registros de controle para a Vigilância Sanitária · Portaria CVS nº 3/2026 (SP)", M, 18.5);
  doc.setTextColor(...GOLD); doc.setFontSize(8.2); doc.text("Kaluf & Gomes · Rotina da Cozinha", M, 24);
  y = 35;
  const L = ctx.loja;
  T(["Identificação",""], [["Estabelecimento", loja],["Razão social", L.razao||"(preencher)"],["CNPJ", L.cnpj||"(preencher)"],["Endereço", L.endereco||"(preencher)"],["Responsável legal", L.respLegal||"(preencher)"],["Responsável técnico", L.respTecnico||"Não se aplica / (preencher)"],["Período dos registros", per],["Emitido em", `${C.br(todayStr)} às ${C.hm(ctx.now)}`]],
    {0:{fontStyle:"bold", cellWidth:46, fillColor:SOFT}}, {showHead:false, styles:{font:"helvetica", fontSize:8.6, cellPadding:1.8, lineColor:[210,206,196], lineWidth:.15, textColor:INK}});
  const regs = D.CHECKLISTS.filter(c => c.freq==="daily");
  let planned=0, ontime=0, late=0, miss=0;
  days.forEach(d => regs.forEach(c => { const s = C.statusOf(c, idx, d===todayStr ? ctx.now : C.addDays(C.fromYmd(d), 1), C.fromYmd(d)); if(d===todayStr && s.k==="later") return; planned++; if(s.k==="done") ontime++; else if(s.k==="late-done") late++; else if(s.k==="late") miss++; }));
  const temps = recs.filter(r => { const it = ITEM(r.cl, r.item); return (it && it.t==="temp" && r.v!=="na") || (r.item==="prod" && r.v); });
  const devs = recs.filter(r => C.isDev(r, ITEM(r.cl, r.item)));
  const photos = recs.filter(r => r.photo);
  h1("Resumo do período");
  T(["Indicador","Total"], [["Rotinas diárias previstas", planned],["Realizadas no prazo", ontime],["Realizadas com atraso", late],["Não realizadas", miss],["Leituras de temperatura", temps.length],["Leituras fora do critério", temps.filter(r=>C.isDev(r, ITEM(r.cl,r.item))).length],["Não conformidades, todas com ação corretiva registrada", devs.length],["Fotos de comprovação", photos.length]], {1:{halign:"right", cellWidth:26, fontStyle:"bold"}});
  para("Registros eletrônicos com data, hora e identificação de quem preencheu (Art. 7º). Guarda mínima de 180 dias, disponíveis à autoridade sanitária (Art. 181). Os critérios aparecem ao lado de cada leitura (Arts. 30 e 48). Vigência da CVS 3/2026: 01/02/2027 (Portaria CVS 9/2026); até lá vale a CVS 5/2013, e os critérios aqui atendem às duas.");

  doc.addPage(); y = 18;
  h1("1. Controle de temperaturas", "Manual Spoleto POP 01 · CVS 3/2026");
  h2("1.1 Equipamentos de conservação: 2 leituras por dia (POP 1C)", "Arts. 44 e 48");
  const eqs = D.EQUIP.filter(e=>e.pop1c);
  const rows = []; days.forEach(d => eqs.forEach(e => { const m = recs.find(r=>r.date===d && r.item==="eq_"+e.id && ITEM(r.cl,r.item)?.leitura==="M"), n = recs.find(r=>r.date===d && r.item==="eq_"+e.id && ITEM(r.cl,r.item)?.leitura==="N");
    const cell = r => r ? `${C.fmtT(r.v)} · ${C.hm(new Date(r.ts))} (${pname(r.by)})` : (d===todayStr ? "Aguardando" : "Não realizado");
    const bad = [m,n].some(r => r && C.isDev(r, ITEM(r.cl,r.item)));
    rows.push([C.br(d), e.nome, C.critText(e), cell(m), cell(n), bad ? "Fora da faixa" : (!m||!n) ? (d===todayStr ? "Em andamento" : "Não realizado") : "Ok"]); }));
  T(["Data","Equipamento","Critério","Manhã","Noite","Situação"], rows, {0:{cellWidth:18}, 2:{cellWidth:20}});
  h2("1.2 Alimentos expostos: pista fria e molhos (POP 1A)", "Arts. 60 e 73");
  const rows2 = []; days.forEach(d => ["expo_m","expo_t","expo_n"].forEach(cl => { const a = idx[`D:${d}|${cl}`]; const c = CL(cl);
    if(!a){ if(d===todayStr && C.statusOf(c, idx, ctx.now).k==="later") return; rows2.push([C.br(d), c.turno, "–", "–", "–", d===todayStr ? "Aguardando" : "Não realizado"]); return; }
    const vals = Object.values(a); const bad = vals.filter(r => C.isDev(r, ITEM(r.cl, r.item)));
    rows2.push([C.br(d), c.turno, C.hm(new Date(vals[0].ts)), [...new Set(vals.map(r=>pname(r.by)))].join(", "), `${vals.filter(r=>r.v!=="na").length} itens`, bad.length ? "Fora: " + bad.map(r => `${ITEM(r.cl,r.item).q} ${C.fmtT(r.v)}`).join("; ") : "Ok"]); }));
  T(["Data","Turno","Hora","Responsável","Leituras","Situação"], rows2, {0:{cellWidth:18}, 1:{cellWidth:16}, 2:{cellWidth:12}});
  para("Critérios do Manual Spoleto: ingredientes da pista fria até 10 °C (pescado até 5 °C), por no máximo 4 horas; molhos no atendimento a no mínimo 60 °C, por no máximo 6 horas. A CVS 3/2026 pede leitura no início e a cada 2 horas a partir de 01/02/2027.", 7.4);
  h2("1.3 Aquecimento dos molhos na retaguarda", "Arts. 59 e 68");
  T(["Data","Hora","Controle","Critério","Medido","Responsável","Situação"], recs.filter(r=>r.item==="molho_ret").map(r => [C.br(r.date), C.hm(new Date(r.ts)), "Molhos aquecidos (centro)", "mín. 75 °C", C.fmtT(r.v), pname(r.by), C.isDev(r, ITEM(r.cl,r.item)) ? "Fora da faixa" : "Ok"]), {0:{cellWidth:18}});
  h2("1.4 Recebimento de mercadorias (POP 1B)", "Arts. 29 a 31");
  T(["Data","Hora","Fornecedor","Produto","Critério","Medido","Resp.","Situação"], recs.filter(r=>r.item==="prod").map(r => { const c = C.catOf(r.extra.cat)||{}; return [C.br(r.date), C.hm(new Date(r.ts)), r.extra.fornecedor, r.extra.produto, c.txt||"", r.v ? C.fmtT(r.v) : "–", pname(r.by), C.isDev(r) ? "Fora do critério" : "Ok"]; }), {0:{cellWidth:18}, 1:{cellWidth:11}});

  h1("2. Registros por POP", "Art. 170, parágrafo único");
  para("Os 9 POPs exigidos pela Portaria CVS 3/2026, com as verificações feitas nas rotinas do período (resumo por dia e rotina). As não conformidades estão detalhadas na seção 3.");
  POPS_CVS.forEach(([key, n, title, ref]) => {
    h2(`POP ${n}. ${title}`, ref);
    const groups = {};
    recs.forEach(r => { const it = ITEM(r.cl, r.item); if(!it || it.pop!==key) return; const k = r.date+"|"+r.cl+"|"+(r.period.startsWith("R:")?r.run:""); (groups[k] = groups[k] || []).push({r, it}); });
    const body = Object.entries(groups).sort().map(([k, list]) => { const [d, cl] = k.split("|"); const ok = list.filter(x=>x.r.v==="ok").length, nc = list.filter(x=>x.r.v==="nc").length, na = list.filter(x=>x.r.v==="na").length;
      return [C.br(d), CL(cl).title, list.map(x=>x.it.q.split(" (")[0].split(";")[0]).slice(0,4).join("; ") + (list.length>4 ? `; +${list.length-4}` : ""), `${ok} conforme${ok!==1?"s":""}${na?` · ${na} N/A`:""}`, nc ? `Não conforme: ${nc}` : "Ok", [...new Set(list.map(x=>pname(x.r.by)))].join(", ")]; });
    const docRows = [];
    const dstat = (def, d) => { const s = C.docStatus(d.last, def.every, ctx.now); return [def.tipo, d.empresa||def.empresa||"", d.last?C.br(d.last):"–", s.next && s.next.includes("-") ? C.br(s.next) : (s.next||""), s.label]; };
    if(key==="agua") ["reserv","vistoria","analise","filtro","filtro_gelo"].forEach(id => docRows.push(dstat(D.DOCS.find(x=>x.id===id), (ctx.docs||[]).find(x=>x.id===id)||{})));
    if(key==="pragas") docRows.push(dstat(D.DOCS.find(x=>x.id==="dedet"), (ctx.docs||[]).find(x=>x.id==="dedet")||{}));
    if(key==="manut") docRows.push(dstat(D.DOCS.find(x=>x.id==="calib"), (ctx.docs||[]).find(x=>x.id==="calib")||{}));
    if(key==="saude" || key==="capacit") ctx.people.filter(p=>p.ativo!==false && p.papel!=="master" && p.papel!=="dono").forEach(p => D.PERSON_DOCS.filter(x => key==="saude" ? x.id!=="curso" : x.id==="curso").forEach(def => { const l = (ctx.pdocs||{})[p.id+"|"+def.id]; const s = C.docStatus(l, def.every, ctx.now); docRows.push([`${def.tipo}: ${p.nome}`, "", l?C.br(l):"–", s.next && s.next.includes("-") ? C.br(s.next) : (s.next||""), s.label]); }));
    if(body.length) T(["Data","Rotina","Verificações","Resultado","Situação","Responsável"], body, {0:{cellWidth:18}, 1:{cellWidth:30}, 3:{cellWidth:26}, 4:{cellWidth:24}, 5:{cellWidth:26}});
    if(key==="capacit" && (ctx.treinos||[]).length) T(["Data","Treinamento","Instrutor","Participantes"], ctx.treinos.map(t=>[C.br(t.data), t.assunto, t.instrutor, (t.participantes||[]).map(pname).join(", ")]));
    if(key==="manut" && (ctx.manut||[]).length) T(["Equipamento","Desde","Situação","Observação"], ctx.manut.map(m=>[(D.EQUIP.find(e=>e.id===m.equip)||{nome:m.equip}).nome, C.br(m.desde), m.status, m.obs||""]));
    if(docRows.length) T(["Documento de comprovação","Empresa","Último","Próximo","Situação"], docRows, {}, {headStyles:{fillColor:[60,72,98], textColor:255, fontStyle:"bold", fontSize:7.2}});
    if(!body.length && !docRows.length) para(key==="transp" ? "A loja não faz transporte próprio. Delivery por aplicativo: lacre e identificação conferidos no pré-serviço." : "Sem verificações no período.", 7.6);
  });

  h1("3. Não conformidades e ações corretivas");
  T(["Data e hora","Rotina","Item","Registro","Ação corretiva","Descrição","Resp."], devs.map(r => { const it = ITEM(r.cl, r.item); return [`${C.br(r.date)} ${C.hm(new Date(r.ts))}`, CL(r.cl).title, r.item==="prod" ? `${r.extra.produto} (${(C.catOf(r.extra.cat)||{}).nome})` : it.q, r.v==="nc" ? "Não conforme" : C.fmtT(r.v), r.acao||"", r.obs||"", pname(r.by)]; }), {0:{cellWidth:22}, 3:{cellWidth:18}, 6:{cellWidth:14}});
  const oc = recs.filter(r => r.cl==="ocorrencia" && r.item==="descricao");
  if(oc.length){ h2("Ocorrências registradas pela equipe"); T(["Data e hora","Tipo","Descrição","Resp."], oc.map(r => [`${C.br(r.date)} ${C.hm(new Date(r.ts))}`, (recs.find(x=>x.run===r.run && x.item==="tipo")||{}).v||"", r.v, pname(r.by)])); }

  h1("4. Execução das rotinas diárias");
  const ex = []; days.forEach(d => regs.forEach(c => { const s = C.statusOf(c, idx, d===todayStr ? ctx.now : C.addDays(C.fromYmd(d),1), C.fromYmd(d)); if(d===todayStr && s.k==="later") return;
    ex.push([C.br(d), c.title, `${c.start}–${c.due}`, s.last ? C.hm(new Date(s.last.ts)) : "–", [...new Set(Object.values(s.answered).map(r=>pname(r.by)))].join(", ") || "–", `${s.n}/${s.total}`, s.k==="done" ? "No prazo" : s.k==="late-done" ? "Feito com atraso" : s.k==="late" ? (d===todayStr ? "Atrasado" : "Não realizado") : "Em andamento"]); }));
  T(["Data","Rotina","Janela","Concluído","Responsável","Itens","Situação"], ex, {0:{cellWidth:18}, 2:{cellWidth:20}, 3:{cellWidth:16}, 5:{cellWidth:12}});

  need(40); y += 6; doc.setFont("helvetica","normal"); doc.setFontSize(8.6); doc.setTextColor(...INK);
  doc.text("Declaro que os registros acima correspondem às rotinas executadas no estabelecimento.", M, y); y += 16;
  doc.setDrawColor(...GRAY); doc.setLineWidth(.3); doc.line(M, y, M+82, y); doc.line(W-M-56, y, W-M, y); y += 4;
  doc.setFontSize(7.6); doc.setTextColor(...GRAY); doc.text("Responsável técnico ou legal (nome e assinatura)", M, y); doc.text("Data", W-M-56, y);

  if(opts && opts.photos && photos.length){
    doc.addPage(); y = 18; h1("Anexo fotográfico", `${photos.length} fotos`);
    const cols = 3, gap = 5, cw = (W-2*M-gap*(cols-1))/cols, ih = cw*.75, ch = ih+16; let c = 0;
    photos.forEach(r => {
      if(c%cols===0){ if(c>0) y += ch + 2; if(y + ch > H-16){ doc.addPage(); y = 18; } }
      const x = M + (c%cols)*(cw+gap); const src = ctx.photos[r.photo] || (String(r.photo).startsWith("data:") ? r.photo : null);
      if(src){ try{ doc.addImage(src, "JPEG", x, y, cw, ih, undefined, "FAST"); }catch(e){ doc.setDrawColor(...GRAY); doc.rect(x,y,cw,ih); } } else { doc.setDrawColor(...GRAY); doc.rect(x,y,cw,ih); }
      const it = ITEM(r.cl, r.item);
      doc.setFont("helvetica","bold"); doc.setFontSize(6.8); doc.setTextColor(...INK); doc.text(doc.splitTextToSize(it ? it.q : r.item, cw).slice(0,2), x, y+ih+3.4);
      doc.setFont("helvetica","normal"); doc.setTextColor(...GRAY); doc.text(doc.splitTextToSize(`${C.br(r.date)} ${C.hm(new Date(r.ts))} · ${pname(r.by)} · ${CL(r.cl).title}`, cw).slice(0,2), x, y+ih+10.2);
      c++;
    });
  }
  const pages = footer(doc, `${loja} · ${per} · Registros guardados por no mínimo 180 dias (Art. 181, Portaria CVS 3/2026)`);
  return {doc, pages, name:`Relatorio-Vigilancia-${loja.replace(/\s+/g,"-")}-${ctx.from}_a_${ctx.to}.pdf`};
}
g.REPORTS = {rede, vigilancia};
})(window);
