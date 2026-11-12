/* Rotina da Cozinha · Spoleto Franca
   Definições dos checklists, equipamentos, equipe inicial e documentos.
   Fonte: Manual de Boas Práticas Spoleto 2026, planilhas POP da rede (Trigo),
   Checklist de Bolso (POP 7A), roteiro de implantação (25/10/2026) e Portaria CVS 3/2026.
   Para alterar horários, itens ou faixas, edite este arquivo e publique de novo. */
(function(g){
const LOJA = {
  nome: "Spoleto Franca",
  razao: "", cnpj: "", ie: "", endereco: "", tipo: "Shopping",
  respLegal: "", respTecnico: "", respBP: "",
  horario: "Equipe 7h40 às 22h30 · Atendimento 10h às 22h",
};

/* Equipe inicial. PIN inicial 1234: o app obriga cada pessoa a criar o próprio PIN no primeiro acesso.
   papel: equipe (registra no tablet) · admin (gestão da loja) · master (administradora do sistema, Kaluf & Gomes)
   Pessoas novas desta lista entram sozinhas na planilha quando a gestão abre o app (PIN 1234). */
const PEOPLE = [
  {id:"taise",   nome:"Taise",    funcao:"Consultora · Kaluf & Gomes", turno:"", papel:"master", notif:false},
  {id:"guilherme", nome:"Guilherme", funcao:"Proprietário", turno:"", papel:"dono", notif:true},
  {id:"vagner",  nome:"Vagner",   funcao:"Gerente",           turno:"",            papel:"admin",  notif:true},
  {id:"manu",    nome:"Emanuele", apelido:"Manu", funcao:"Subgerente", turno:"14h10–22h30", papel:"admin", notif:true},
  {id:"rose",    nome:"Rose",     funcao:"Auxiliar de cozinha", turno:"7h40–16h",   papel:"equipe"},
  {id:"sabrina", nome:"Sabrina",  funcao:"Auxiliar de cozinha", turno:"10h30–22h30", papel:"equipe"},
  {id:"debora",  nome:"Débora",   funcao:"Auxiliar de cozinha", turno:"10h30–22h30", papel:"equipe"},
  {id:"joaovitor", nome:"João Vitor", funcao:"Auxiliar de cozinha", turno:"", papel:"equipe"},
];

/* Equipamentos (POP 1C e POP 2B). Faixas do POP 01 do manual da rede. */
const EQUIP = [
  {id:"camara",   nome:"Câmara fria",                 max:4,  min:0,  pop1c:true},
  {id:"geladeira",nome:"Geladeira de bebidas",        max:4,  min:0,  pop1c:true},
  {id:"balcao",   nome:"Balcão refrigerado",          max:4,  min:0,  pop1c:true},
  {id:"freezer",  nome:"Freezer",                     max:-18,        pop1c:true},
  {id:"pista",    nome:"Pista fria (equipamento)",    maxEx:0,        pop1c:true, label:"Abaixo de 0 °C"},
  {id:"bmaria",   nome:"Banho-maria (atendimento)",   min:85,         pop1c:true},
  {id:"scalda",   nome:"Scalda massa",                min:90,         pop1c:true},
  {id:"gelo",     nome:"Máquina de gelo"},
  {id:"masseira", nome:"Masseira"},
  {id:"forno",    nome:"Forno"},
  {id:"balanca",  nome:"Balança"},
  {id:"ralador",  nome:"Máquina de ralar queijo"},
  {id:"termometro", nome:"Termômetro laser"},
];
const eq = id => EQUIP.find(e=>e.id===id);

/* Pista fria e molhos (POP 1A). Ingredientes até 10 °C, pescado até 5 °C; molhos mín. 60 °C (decisão da loja). */
const PISTA = ["Alho assado","Alho poró refogado","Azeitona","Bacon","Brócolis","Cebola refogada","Cebola roxa","Cenoura","Cogumelo","Espinafre","Frango desfiado","Linguiça calabresa","Milho verde","Mix de ervas","Molho pesto","Ovo de codorna","Palmito","Peito de peru","Presunto","Queijo gorgonzola","Queijo muçarela","Ricota temperada","Tomate assado","Tomate","Uva passas"];
const MOLHOS = ["Molho pomodoro","Molho branco","Molho bolognesa","Molho queijos"];
const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const expoItems = () => [
  ...PISTA.map(n => ({id:"i_"+slug(n), t:"temp", q:n, max:10, cat:"expo", grp:"Pista fria", rede:"POP 1A", ref:"Art. 73"})),
  {id:"i_camarao", t:"temp", q:"Camarão (pescado)", max:5, cat:"expo", grp:"Pista fria", rede:"POP 1A", ref:"Art. 73", na:true},
  ...MOLHOS.map(n => ({id:"m_"+slug(n), t:"temp", q:n, min:60, cat:"expo", grp:"Molhos (banho-maria)", rede:"POP 1A", ref:"Arts. 60 e 73"})),
];
const eqTemp = (id, leitura, extra) => { const e = eq(id); return Object.assign({id:"eq_"+id, t:"temp", q:`${e.nome}`, sub:`Leitura ${leitura === "M" ? "1 (manhã)" : "2 (tarde)"}`, min:e.min, max:e.max, maxEx:e.maxEx, label:e.label, eq:id, leitura, cat:"equip", grp:"Temperatura dos equipamentos", rede:"POP 1C", ref:"Arts. 44 e 48", acoes: id === "camara" ? "camara" : undefined}, extra||{}); };

const ACOES = {
  padrao: ["Produto descartado","Produto devolvido ao fornecedor","Produto segregado e identificado","Produto transferido para outro equipamento","Equipamento inativado e manutenção acionada","Reaquecido até 75 °C","Item refeito e conferido","Manipulador afastado","Outra ação"],
  camara: ["Produtos mantidos em refrigeração","Produto descartado","Produto segregado e identificado","Produto transferido para outro equipamento","Equipamento inativado e manutenção acionada","Outra ação"],
  pragas: ["Dedetização do shopping acionada","Área isolada e higienizada","Barreira física corrigida (tela, vedação, ralo)","Gerente avisado","Outra ação"],
  hortifruti: ["01 Repetir a lavagem","02 Corrigir dosagem e refazer monitoramento","04 Conferir gramatura e tempo de imersão do fabricante","05 Repetir treinamento","06 Substituir dosador ou produto","07 Armazenar o produto clorado corretamente","Outra ação"],
};

/* Mudança de rotina de 06/11/2026: itens com until valem até 05/11; itens com from valem a partir de 06/11.
   Assim o histórico e os relatórios dos dias anteriores continuam certos. */
const ATE = "2026-11-05", DESDE = "2026-11-06";
const old = x => Object.assign(x, {until:ATE});
const nw  = x => Object.assign(x, {from:DESDE});
const L = (id, q, extra) => Object.assign({id, t:"ok", q, rede:"POP 8A", pop:"higien", ref:"Art. 175"}, extra||{});
const R = (id, q, extra) => Object.assign({id, t:"ok", q, rede:"Rotina da loja", ref:""}, extra||{});   // reposição e montagem (não entram nos POPs)

/* freq: daily | weekly | monthly | fortnight | ondemand
   start/due: HH:MM. Semanal: start segunda, due quarta (dueDow=3). pre:"ok" = já vem marcado como Conforme (pode mudar). */
const CHECKLISTS = [
  {id:"abertura", title:"Abertura", sub:"Pragas, higiene pessoal, 1ª leitura dos equipamentos de frio e validades", freq:"daily", start:"07:40", due:"08:30", items:[
    {id:"pragas", t:"ok", q:"Ausência de pragas ou indícios (cozinha, estoque e porta externa)", elim:true, acoes:"pragas", rede:"POP 3A", ref:"Arts. 134 e 178", pop:"pragas"},
    {id:"saude", t:"ok", q:"Nenhum manipulador com diarreia, febre, vômito ou ferida exposta. Quem tem sintomas foi afastado e avisou o gerente.", rede:"POP 06", ref:"Arts. 8º a 10", pop:"saude"},
    {id:"uniforme", t:"ok", q:"Uniforme completo da rede: chapéu com rede, sem adornos, maquiagem, esmalte, barba ou celular", rede:"POP 06", ref:"Art. 172", pop:"saude"},
    {id:"pia", t:"ok", q:"Pia de mãos com sabonete bactericida, álcool em gel, papel não reciclado e lixeira de pedal; procedimento fixado", rede:"POP 06", ref:"Art. 172", pop:"saude"},
    {id:"timer", t:"ok", q:"Mãos higienizadas ao chegar e timer de 30 minutos ligado", rede:"POP 06", ref:"Arts. 16 e 17", pop:"saude"},
    {id:"termometro", t:"ok", q:"Termômetro laser funcionando e limpo", rede:"POP 01", ref:"Art. 146", pop:"manut"},
    eqTemp("camara","M"), eqTemp("geladeira","M"), eqTemp("balcao","M"), eqTemp("freezer","M"),
    {id:"vedacao", t:"ok", q:"Equipamentos de frio fechando bem (borrachas íntegras) e sem acúmulo de gelo", rede:"POP 02", ref:"Art. 43", pop:"manut"},
    {id:"vencidos", t:"ok", q:"Nenhum produto vencido e nenhuma reetiquetação", elim:true, rede:"POP 12", ref:"Arts. 45 e 46", pop:"receb"},
    {id:"identificados", t:"ok", q:"Todos os produtos manipulados identificados (nome, data de manipulação e validade)", elim:true, rede:"POP 12", ref:"Arts. 37 a 39", pop:"receb"},
    {id:"pvps", t:"ok", q:"Estoque organizado por PVPS (primeiro que vence, primeiro que sai), nada no chão", rede:"Manual 15", ref:"Art. 33", pop:"receb"},
    {id:"foto_etiquetas", t:"photo", q:"Foto das etiquetas dos produtos abertos e pré-preparados", rede:"POP 12", ref:"Arts. 37 a 39", pop:"receb"},
  ]},
  {id:"preservico", title:"Pré-serviço", sub:"Pista fria, montagem da cozinha, molhos e linha de montagem", freq:"daily", start:"09:15", due:"10:00", items:[
    eqTemp("pista","M"), old(eqTemp("bmaria","M")), old(eqTemp("scalda","M")),
    nw(R("montar_forno", "Montar forno (com grades)", {grp:"Montagem da cozinha"})),
    nw(R("montar_bm", "Montar banho-maria (com conchas e panela)", {grp:"Montagem da cozinha"})),
    nw(R("molho_aquecer", "Colocar molho para aquecer", {grp:"Cocção e aquecimento"})),
    {id:"molho_ret", t:"temp", q:"Molhos aquecidos na retaguarda (centro do produto)", min:75, cat:"coc", grp:"Cocção e aquecimento", rede:"POP 01", ref:"Arts. 59 e 68"},
    {id:"sobras", t:"ok", q:"Sobras de molho de ontem com etiqueta \"sobra\" (uso até o almoço) ou descartadas", na:true, grp:"Cocção e aquecimento", rede:"Manual 17", ref:"Art. 39", pop:"receb"},
    {id:"descong", t:"ok", q:"Descongelamento (pista fria) sob refrigeração (até 4 °C), identificado e com dreno", na:true, grp:"Linha de montagem", rede:"Manual 16.1", ref:"Art. 53", pop:"receb"},
    old({id:"marinada", t:"ok", q:"Marinados sob refrigeração a até 4 °C (cogumelos e frango 12 h, camarão 3 h)", na:true, rede:"Manual 16.3", ref:"Art. 44", pop:"receb"}),
    {id:"equip_desmont", t:"ok", q:"Masseira, mixer e utensílios desmontáveis higienizados", pre:"ok", grp:"Linha de montagem", rede:"POP 08", ref:"Art. 115", pop:"higien"},
    {id:"contaminacao", t:"ok", q:"Alimentos protegidos contra contaminação cruzada; perecíveis fora do frio no máx. 30 min", pre:"ok", grp:"Linha de montagem", rede:"POP 7A", ref:"Art. 55", pop:"higien"},
    {id:"delivery", t:"ok", q:"Embalagens de delivery com lacre e a frase \"Produto para consumo imediato.\"", na:true, pause:[DESDE, "2027-01-31"], grp:"Linha de montagem", rede:"—", ref:"Arts. 112 e 113", pop:"transp"},
    {id:"foto_linha", t:"photo", q:"Foto da pista fria montada e protegida", grp:"Linha de montagem", rede:"POP 7A", ref:"Arts. 69 a 71", pop:"higien"},
  ]},
  {id:"expo_m", title:"Pista fria e molhos · manhã", sub:"POP 1A e 1C: alimentos expostos, banho-maria e scalda massa", freq:"daily", start:"10:00", due:"11:00", compact:true, turno:"MANHÃ", items:[
    ...expoItems(), nw(eqTemp("bmaria","M")), nw(eqTemp("scalda","M"))]},
  {id:"expo_t", title:"Pista fria e molhos · tarde", sub:"POP 1A e 1C: alimentos expostos e 2ª leitura dos equipamentos", freq:"daily", start:"17:00", due:"18:00", compact:true, turno:"TARDE", items:[
    ...expoItems(), ...["camara","geladeira","balcao","freezer","pista","bmaria","scalda"].map(id => nw(eqTemp(id,"N")))]},
  {id:"expo_n", title:"Pista fria e molhos · noite", sub:"POP 1A: temperatura dos alimentos expostos", freq:"daily", start:"19:00", due:"19:30", compact:true, turno:"NOITE", until:ATE, items:expoItems()},
  {id:"limp_m", title:"Limpeza da manhã", sub:"POP 8A", freq:"daily", start:"10:00", due:"11:30", items:[
    L("piso","Piso e rodapé"), L("bancadas","Bancadas"), L("balanca","Balança (se usada)", {na:true}), L("geladeira_beb","Geladeira de bebidas"),
    nw(L("balcao_frente","Limpeza do balcão da frente")), nw(L("bandeja_talheres","Bandeja e talheres")), nw(R("temperos","Bandeja de temperos (abastecer)")),
  ]},
  {id:"limp_t", title:"Limpeza da tarde", sub:"POP 8A", freq:"daily", start:"15:00", due:"16:00", items:[
    L("piso","Piso e rodapé"), {id:"lixo", t:"ok", q:"Lixo retirado; lixeiras com tampa e pedal, forradas", rede:"POP 04", pop:"residuos", ref:"Art. 179"},
    nw(L("balcao","Balcão")), nw(L("fogao","Fogão")), nw(L("maq_lavar","Máquina de lavar")), nw(L("frigideiras","Frigideiras")),
    nw(L("pratos","Pratos")), nw(L("bandejas","Bandejas")), nw(L("talheres","Talheres")), nw(R("abastecer_loja","Abastecer a loja")),
  ]},
  {id:"fechamento", title:"Fechamento", sub:"Pragas, limpeza diária e reposição", freq:"daily", start:"21:45", due:"22:30", items:[
    {id:"pragas", t:"ok", q:"Ausência de pragas ou indícios (cozinha, estoque e porta externa)", elim:true, acoes:"pragas", rede:"POP 3A", ref:"Arts. 134 e 178", pop:"pragas"},
    ...["camara","geladeira","balcao","freezer","pista","bmaria","scalda"].map(id => old(eqTemp(id,"N"))),
    {id:"sobras_n", t:"ok", q:"Sobras de molho: etiqueta \"sobra\" e nome do produto, ou descarte", na:true, rede:"Manual 17", ref:"Art. 39", pop:"receb"},
    L("piso","Piso e rodapé", {grp:"Limpeza"}), L("bancadas","Bancadas", {grp:"Limpeza"}), L("pista_l","Pista fria higienizada", {grp:"Limpeza"}),
    nw(L("balcao_frente","Limpeza do balcão da frente", {grp:"Limpeza"})), nw(L("balcao","Balcão", {grp:"Limpeza"})), nw(L("fogao","Fogão", {grp:"Limpeza"})), nw(L("maq_lavar","Máquina de lavar", {grp:"Limpeza"})),
    old(L("forno_in","Forno por dentro")), L("frigideiras","Frigideiras", {grp:"Limpeza"}),
    nw(L("pratos","Pratos", {grp:"Limpeza"})), nw(L("bandejas","Bandejas", {grp:"Limpeza"})), nw(L("talheres","Talheres", {grp:"Limpeza"})), nw(L("bandeja_talheres","Bandeja e talheres", {grp:"Limpeza"})),
    nw(L("temperos","Bandeja de temperos (limpar)", {grp:"Limpeza"})),
    L("ralos","Ralos", {grp:"Limpeza"}), L("tabuas","Tábuas de corte higienizadas", {grp:"Limpeza"}),
    {id:"lixo", t:"ok", q:"Lixo retirado; lixeiras forradas", grp:"Limpeza", rede:"POP 04", pop:"residuos", ref:"Art. 179"},
    nw(R("abastecer_loja","Abastecer a loja", {grp:"Reposição"})), nw(R("abastecer_bebidas","Abastecer a geladeira de bebidas", {grp:"Reposição"})),
    {id:"ligados", t:"ok", q:"Refrigeradores e freezer ligados e bem fechados", grp:"Ao sair", rede:"Manual 15", ref:"Art. 43", pop:"manut"},
    old({id:"foto_fech", t:"photo", q:"Foto da cozinha fechada", rede:"POP 8A", pop:"higien", ref:"Art. 175"}),
  ]},
  {id:"semanal", title:"Limpeza semanal", sub:"POP 8A · fazer de segunda a quarta (cada item pode ser feito por uma pessoa)", freq:"weekly", start:"07:40", due:"22:30", dueDow:3, items:[
    L("balcao_ref","Balcão refrigerado"), L("dispensers","Dispensers de sabonete e álcool"), L("estoque","Estoque seco"), L("estrados","Estrados e prateleiras do estoque"),
    L("forno_fora","Forno (limpeza interna e externa)"), L("freezer_l","Freezer"), L("interruptores","Interruptores e tomadas"), L("lixeiras","Lixeiras (lavagem)"), L("organizadores","Organizadores"),
    L("paredes","Paredes"), old(L("portas","Portas")), L("prateleiras_frente","Prateleiras da frente de loja"), L("teto","Teto"), L("gelo_l","Máquina de gelo"),
    old({id:"retrolavagem", t:"ok", q:"Retrolavagem do filtro de água", rede:"POP 5A", pop:"agua", ref:"Art. 123"}),
    ...[["camara_l","Câmara fria"],["escritorio","Escritório"],["escada","Escada"],["cozinha_utens","Cozinha de utensílios"],["caixas_frig","Caixas de frigideiras"],["inox_balcoes","Inox (geladeiras dos balcões)"]].map(([id, q]) => L(id, q, {from:"2026-11-16"})),
  ]},
  {id:"mensal", title:"Limpeza mensal", sub:"POP 8A · feita pela equipe", freq:"monthly", start:"07:40", due:"22:30", items:[
    L("luminarias","Luminárias"), nw(L("portas","Portas")), nw(L("coifa","Coifa")),
  ]},
  {id:"bolso", title:"Checklist de Bolso", sub:"POP 7A · autoavaliação quinzenal com nota em estrelas", freq:"fortnight", start:"07:40", due:"22:30", leaderOnly:true, bolso:true, items:[
    ["d1","Gestão e documentação","Certificado de dedetização mensal válido, de empresa registrada"],
    ["d2","Gestão e documentação","Manual de Boas Práticas impresso presente na loja"],
    ["d3","Gestão e documentação","Certificado de limpeza do sistema de exaustão semestral válido",true],
    ["im1","Imagem","Pista fria, canudos, fogão, vidro anteparo, balcão do caixa e frigideiras limpos e bem apresentados"],
    ["s1","Segurança do alimento","Pia de mãos com sabonete bactericida, álcool em gel, papel não reciclado, lixeira de pedal e procedimento fixado"],
    ["s2","Segurança do alimento","Ausência de pragas ou indícios",false,true],
    ["s3","Segurança do alimento","Hortifrúti higienizado corretamente e procedimento fixado perto da pia"],
    ["s4","Segurança do alimento","Troca e higienização das tábuas adequadas"],
    ["s5","Segurança do alimento","Ausência de alimentos deteriorados ou procedimentos não autorizados",false,true],
    ["s6","Segurança do alimento","Nenhum perecível fora da refrigeração por mais de 30 minutos"],
    ["s7","Segurança do alimento","Descongelamento correto (identificado, sob refrigeração, com dreno)"],
    ["s8","Segurança do alimento","Esponjas higienizadas e guardadas em recipiente fechado"],
    ["s9","Segurança do alimento","Ausência de produtos não homologados pela rede",false,true],
    ["s10","Segurança do alimento","Alimentos protegidos contra contaminação cruzada"],
    ["s11","Segurança do alimento","Só pano descartável limpo e conservado"],
    ["s12","Segurança do alimento","Embalagens descartáveis disponíveis e bem armazenadas"],
    ["s13","Segurança do alimento","Todos os produtos identificados após manipulação, inclusive os dos clientes",false,true],
    ["s14","Segurança do alimento","Todos os produtos, inclusive de limpeza, na validade e sem reetiquetação",false,true],
    ["t1","Controle de temperatura","Geladeira, câmara e balcão refrigerado de 0 a 4 °C",false,true],
    ["t2","Controle de temperatura","Freezer a -18 °C ou menos"],
    ["t3","Controle de temperatura","Nível de água e temperatura do banho-maria e da caçarola do scalda corretos"],
    ["t4","Controle de temperatura","Pista fria: equipamento abaixo de 0 °C e alimentos de 0 a 10 °C"],
    ["t5","Controle de temperatura","Pré-aquecimento e reposição dos molhos (sobras e novos) corretos"],
    ["t6","Controle de temperatura","Temperatura dos molhos no atendimento e no aquecimento corretas"],
    ["t7","Controle de temperatura","Todas as temperaturas registradas conforme o padrão"],
    ["t8","Controle de temperatura","Borrachas de vedação dos equipamentos de frio em bom estado"],
    ["l1","Limpeza e organização","Estoque organizado por PVPS"],
    ["l2","Limpeza e organização","Lixeiras com pedal e forradas com saco"],
    ["l3","Limpeza e organização","Utensílios limpos e em quantidade suficiente"],
    ["l4","Limpeza e organização","Limpeza geral da parte interna da loja (incluindo portas e teto)"],
    ["l5","Limpeza e organização","Limpeza dos equipamentos (refrigeração com gaxetas e cortinas, fogão, máquina de gelo)"],
    ["l6","Limpeza e organização","Limpeza dos móveis de apoio"],
    ["f1","Avaliação dos funcionários","Higienização das mãos na frequência certa e apresentação pessoal (touca, uniforme, sem adornos, maquiagem, esmalte, barba ou celular)"],
  ].map(([id,grp,q,na,elim])=>({id, t:"ok", q, grp, na:!!na, elim:!!elim, rede:"POP 7A", ref:"", pop:"bolso"}))},

  /* Sob demanda: quem fizer, registra */
  {id:"recebimento", title:"Recebimento de mercadorias", sub:"POP 1B · registrar a cada entrega", freq:"ondemand", receb:true, items:[
    {id:"uniformizados", t:"ok", q:"Entregadores uniformizados?", rede:"POP 1B", ref:"Art. 29", pop:"receb"},
    {id:"veiculo_limpo", t:"ok", q:"Veículo limpo e organizado?", rede:"POP 1B", ref:"Arts. 103 a 108", pop:"receb"},
    {id:"veiculo_conserv", t:"ok", q:"Conservação do veículo satisfatória?", rede:"POP 1B", ref:"Arts. 103 a 108", pop:"receb"},
    {id:"higiene_entreg", t:"ok", q:"Higiene pessoal dos entregadores satisfatória?", rede:"POP 1B", ref:"Art. 29", pop:"receb"},
    {id:"embalagens", t:"ok", q:"Embalagens íntegras, rotuladas e dentro da validade; sem insetos ou umidade", rede:"Manual 14", ref:"Art. 29", pop:"receb"},
    {id:"recong", t:"ok", q:"Congelados sem sinais de descongelamento e recongelamento", na:true, rede:"Manual 14", ref:"Art. 29", pop:"receb"},
    {id:"foto_nf", t:"photo", q:"Foto da nota fiscal conferida", rede:"POP 1B", ref:"Arts. 29 e 30", pop:"receb"},
  ]},
  {id:"hortifruti", title:"Higienização de hortifrúti", sub:"POP 9A · registrar quando a mercadoria chegar e for higienizada", freq:"ondemand", items:[
    {id:"tipo", t:"multi", q:"O que foi higienizado", opts:["Folhosos","Frutas","Legumes"], rede:"POP 9A", pop:"higien"},
    {id:"produto", t:"ok", q:"CIF Sanitizante de Hortifrutícolas na dosagem de 5 ml por litro", acoes:"hortifruti", rede:"POP 9A", ref:"Art. 175", pop:"higien"},
    {id:"imersao", t:"ok", q:"Imersão total por 30 segundos, com timer", acoes:"hortifruti", rede:"POP 9A", ref:"Art. 175", pop:"higien"},
    {id:"enxague", t:"ok", q:"Enxágue em água corrente e potável", acoes:"hortifruti", rede:"POP 9A", ref:"Art. 175", pop:"higien"},
  ]},
  {id:"ocorrencia", title:"Registrar ocorrência", sub:"Praga, equipamento com defeito ou outro problema. O gerente é avisado na hora.", freq:"ondemand", items:[
    {id:"tipo", t:"choice", q:"Tipo de ocorrência", opts:["Praga ou indício","Equipamento com defeito","Falta de produto de higiene","Outro"], rede:"—", pop:"manut"},
    {id:"descricao", t:"text", q:"O que aconteceu e o que foi feito", rede:"—"},
    {id:"foto", t:"photo", q:"Foto (se possível)", optional:true, rede:"—"},
  ]},
];

/* Fornecedores (POP 1B) e categorias de recebimento (Art. 30, CVS 3/2026) */
const FORNECEDORES = [
  {nome:"Magazzino (distribuidora da rede)", dias:[1,4]},
  {nome:"Coca-Cola"},{nome:"Chopp"},{nome:"Hortifrúti"},{nome:"Salada (entrega diária)", dias:[0,1,2,3,4,5,6]},
  {nome:"Riberfoods (brócolis e alho)"},{nome:"Material descartável"},{nome:"Outro"},
];
const CATEG = [
  {id:"cong",   nome:"Congelado",                          max:-12, txt:"-12 °C ou menos"},
  {id:"carne",  nome:"Carne refrigerada",                  max:7,   txt:"4 a 7 °C"},
  {id:"pesc",   nome:"Pescado refrigerado",                max:3,   txt:"2 a 3 °C"},
  {id:"cru",    nome:"Preparação com carne ou pescado cru", max:5,  txt:"0 a 5 °C"},
  {id:"refr",   nome:"Demais refrigerados",                max:10,  txt:"até 10 °C"},
  {id:"quente", nome:"Alimento quente",                    min:60,  txt:"acima de 60 °C"},
  {id:"seco",   nome:"Seco / temperatura ambiente",                 txt:"sem medição"},
];

/* Documentos e controles periódicos. last/next em AAAA-MM-DD; every em dias. */
const DOCS = [
  {id:"dedet",      pop:"3A", rede:"POP 3A", tipo:"Dedetização e desratização", empresa:"Shopping", last:"2026-10-01", every:30, ref:"Art. 135"},
  {id:"reserv",     pop:"5A", rede:"POP 5A", tipo:"Limpeza da caixa d'água", empresa:"Shopping", last:"", every:182, ref:"Art. 122"},
  {id:"vistoria",   pop:"5A", rede:"POP 5A", tipo:"Vistoria da caixa d'água (tampa e vazamentos)", empresa:"Shopping", last:"", every:91, ref:"Art. 122"},
  {id:"analise",    pop:"5A", rede:"POP 5A", tipo:"Análise microbiológica da água", empresa:"Shopping", last:"", every:182, ref:"Art. 120"},
  {id:"filtro",     pop:"5A", rede:"POP 5A", tipo:"Troca do elemento filtrante (filtro central)", empresa:"Água Fresca", last:"", every:182, ref:"Art. 123"},
  {id:"filtro_gelo",pop:"5A", rede:"POP 5A", tipo:"Filtro da máquina de gelo", empresa:"Água Fresca", last:"", every:182, ref:"Art. 123"},
  {id:"calib",      pop:"2B", rede:"POP 2B", tipo:"Calibração do termômetro e da balança", empresa:"Técnica Metrológica", last:"2026-04-14", every:365, ref:"Art. 147"},
  {id:"manual",     pop:"--", rede:"Manual", tipo:"Manual de Boas Práticas e POPs preenchidos e assinados", empresa:"Rede / loja", last:"", every:365, ref:"Art. 170"},
];
/* Por pessoa: exames (POP 6A, anual), uniforme e EPI (POP 6B, 6 meses), curso 8 h (Art. 22) */
const PERSON_DOCS = [
  {id:"exame",    rede:"POP 6A", tipo:"Exames (ASO, coprocultura, parasitológico)", every:365, ref:"Arts. 8º a 10"},
  {id:"uniforme", rede:"POP 6B", tipo:"Entrega de uniforme e EPI", every:182, ref:"Art. 172"},
  {id:"curso",    rede:"POP 7B", tipo:"Curso de Boas Práticas (8 h)", every:null, ref:"Art. 22"},
];
const PERSON_DOC_SEED = {"sabrina|uniforme":"2026-07-18"};

/* Equipamentos em manutenção (POP 2A) */
const MANUT_SEED = [{id:"m1", equip:"ralador", desde:"2026-10-25", status:"Em manutenção", obs:"Máquina de ralar queijo com placa POP 2A", empresa:""}];

/* Tarefas do dia (lista da subgerente). A gestão marca o que entra no dia; a quantidade vem sugerida e pode ser mudada. */
const TAREFAS = [
  ["PISTA", ["ALHO","4 PACOTES"],["CEBOLA","1 POTE GRANDE"],["PEITO DE PERU","1 POTE PEQ"],["PRESUNTO","1 POTE PEQ"],["CALABRESA","2 PACOTES"],["BACON","6 PACOTES"],["PESTO DE AZEITONA","1 POTE PEQ"],["COGUMELO","1 PACOTE"],["GORGONZOLA","1 POTE"],["MUSSARELA","1 PEÇA"],["RICOTA","1 PEÇA"],["OVO","1 PACOTE"],["TOMATE ASSADO","2 BOWLS CHEIOS"],["TOMATE","2 POTES PEQ"],["ALHO PORÓ","1 POTE GRANDE"],["BRÓCOLIS","1 POTE GRANDE OU 1 PACOTE"],["PALMITO","1 POTE PEQUENO OU 1 PACOTE"],["ESPINAFRE","O QUE VIER"],["MANJERICÃO","O QUE VIER"],["MIX DE ERVAS","O QUE VIER"],["CENOURA","1 POTE PEQ"],["CEBOLA CARAMELIZADA","1 BOWL"],["PARMESÃO","½ PEÇA OU 3 POTES GRANDES"],["REQUEIJÃO","1 BISNAGA"],["SALADA","O QUE VIER"]],
  ["PROTEÍNA", ["CAMARÃO","4 K POR SEMANA"],["COSTELA","4 K"],["ALMÔNDEGA","4 K"],["TIRAS DE FRANGO","12 PACOTES"],["FILÉ DE FRANGO","10 K"],["FRANGO EMPANADO","1 POTE GRANDE"],["POLPETONE","10 UNIDADES"],["FRANGO DESFIADO","2 PACOTES"]],
  ["MASSA (COZINHAR)", ["FETUCCINE","2 PACOTES"],["PENNE","2 PACOTES"],["ESPAGUETE","2 PACOTES"],["FARFALLE","1 PACOTE"],["PENNE INTEGRAL","½ PACOTE"],["RISOTO","4 PACOTES"],["LASANHA","1 PACOTE"],["PIZZA","7 UNIDADES MUSSARELA E 4 DE CALABRESA"],["RAVIOLI CONGELADO","5 PACOTES"]],
  ["MOLHOS", ["MOSTARDA E MEL","1 BISNAGA"],["CAESAR","2 BISNAGAS"]],
].flatMap(([sec, ...list]) => list.map(([nome, qtd]) => ({id: slug(sec.split(" ")[0] + "_" + nome), sec, nome, qtd})));
/* Etapas para produção: segunda lista do dia. O texto das etapas vem sugerido e pode ser mudado. (id começa com "e_") */
const ETAPAS = [
  ["PISTA", ["ALHO","Assar e porcionar"],["CEBOLA","Cortar e refogar"],["CALABRESA","Cortar e assar"],["BACON","Assar e porcionar"],["TOMATE ASSADO","Cortar e assar"],["CEBOLA CARAMELIZADA","Cortar e refogar"],["SALADA","Lavar e porcionar"]],
  ["PROTEÍNA", ["CAMARÃO","Temperar e porcionar"],["ALMÔNDEGAS","Assar e porcionar"],["TIRAS DE FRANGO","Marinar, assar, cortar e porcionar"],["FILÉ DE FRANGO","Marinar, assar e porcionar"],["FRANGO DESFIADO","Assar e porcionar"]],
  ["MASSA", ["MASSAS EM GERAL","Cozinhar e porcionar"],["LASANHA","Descongelar e porcionar"]],
].flatMap(([sec, ...list]) => list.map(([nome, qtd]) => ({id: "e_" + slug(sec + "_" + nome), sec, nome, qtd})));
const LISTAS = [
  {id:"preparo", titulo:"Lista de preparo", campo:"Quantidade", itens:TAREFAS, modos:true},
  {id:"etapas",  titulo:"Etapas para produção", campo:"Etapas", itens:ETAPAS, modos:false},
];
const listaDe = id => String(id).startsWith("e_") ? "etapas" : "preparo";
const TAREFA_MODOS = ["Preparar", "Conferir etiqueta"];

/* Lembretes com data marcada: aparecem no painel da gestão e chegam no celular das pessoas indicadas. */
const LEMBRETES = [
  {id:"lacre-2027", data:"2027-01-15", para:["taise","vagner","manu"], titulo:"Lacre do delivery", texto:"Confirmar se a franquia enviou o lacre das embalagens de delivery. O item do lacre volta sozinho ao pré-serviço em 01/02/2027."},
  {id:"cvs3-2h-2027", data:"2027-01-11", para:["taise","vagner","manu"], titulo:"Temperatura da pista fria a cada 2 horas", texto:"A partir de 01/02/2027 a CVS 3/2026 pede leitura da pista fria e dos molhos no início e a cada 2 horas. Hoje são 2 leituras (10h–11h e 17h–18h). Rever os horários com a Kaluf & Gomes."},
];

/* Escala de estrelas da auditoria da rede (Manual, item 22) */
/* Notificações padrão por perfil (cada pessoa pode ajustar; a administradora ajusta de todos) */
const NOTIF_DEFAULTS = {
  admin:  {pragas:true, nc:true,  atraso:true,  docs:"todos",    resumo:false},
  dono:   {pragas:true, nc:false, atraso:false, docs:"vencidos", resumo:true},
  master: {pragas:true, nc:false, atraso:false, docs:"todos",    resumo:true},
};
const STARS = [[95,5],[86,4],[77,3],[67,2],[57,1],[0,0]];

g.DEFS = {NOTIF_DEFAULTS, LOJA, PEOPLE, EQUIP, PISTA, MOLHOS, CHECKLISTS, ACOES, FORNECEDORES, CATEG, DOCS, PERSON_DOCS, PERSON_DOC_SEED, MANUT_SEED, STARS, TAREFAS, ETAPAS, LISTAS, listaDe, TAREFA_MODOS, LEMBRETES, VERSION:"2026.11.13"};
})(typeof window!=="undefined"?window:globalThis);
