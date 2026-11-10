/**
 * PIZZARIA PRIMOS — registro de pedidos + resumo do fim da noite
 * ---------------------------------------------------------------
 * Este código roda numa planilha Google (Google Sheets) e recebe,
 * a cada pedido enviado pelo site, uma linha com os itens.
 * No fechamento, monta um resumo do dia (sabores vendidos, bordas,
 * faturamento) e — se você preencher um e-mail abaixo — envia por e-mail.
 *
 * O site manda para cá: bairro, forma de pagamento, total, os itens e o
 * nome e telefone do cliente (para o histórico de consumo de cada cliente
 * no painel). O ENDEREÇO (rua, número) nunca vem. Nome e telefone só saem
 * da planilha para quem tem a senha do painel — nunca no endereço público.
 * Cada pedido ganha um código curto (ex.: K7P3X) que também vai na
 * mensagem do WhatsApp: é assim que a pizzaria acha o pedido no painel.
 *
 * Também calcula o CONSUMO DE INGREDIENTES de cada dia a partir das
 * receitas cadastradas na aba "Receitas" (editada em /admin).
 *
 * Passo a passo de instalação: veja README.md desta pasta.
 */

const ABA_PEDIDOS  = 'Pedidos';
const ABA_RESUMO   = 'Resumo do dia';
const ABA_CONSUMO  = 'Consumo diário';
const ABA_RECEITAS = 'Receitas';
const EMAIL_RESUMO = 'silvanapolletiscalisee@gmail.com'; // recebe o resumo à noite. '' para não enviar.

// Colunas da aba Pedidos. A–F existem desde o começo; G–L vieram com a página de pedidos
// do painel e M (Telefone) com o histórico de clientes (o cabeçalho é completado sozinho,
// e as linhas antigas continuam valendo).
const CABECALHO_PEDIDOS = [
  'Data e hora', 'Bairro', 'Pagamento', 'Total (R$)', 'Itens', 'Detalhe (não editar)',
  'Código', 'Status', 'Origem', 'Entrega', 'Cliente', 'Observação', 'Telefone',
];
const COL = { DATA: 1, BAIRRO: 2, PAGAMENTO: 3, TOTAL: 4, ITENS: 5, DETALHE: 6,
              CODIGO: 7, STATUS: 8, ORIGEM: 9, ENTREGA: 10, CLIENTE: 11, OBS: 12, TELEFONE: 13 };

const STATUS_VALIDOS  = ['novo', 'confirmado', 'entregue', 'cancelado'];
const ORIGENS_VALIDAS = ['site', 'whatsapp', 'telefone', 'balcao', 'outro'];
const PAGAMENTOS      = ['Pix', 'Dinheiro', 'Cartão'];
const MAX_PEDIDOS_POR_MINUTO = 60;   // trava contra enchente de pedidos falsos no endereço público
const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O, I, 0, 1

/* ------------------------------------------------------------------ */
/*  Recebe cada pedido do site                                        */
/* ------------------------------------------------------------------ */
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);

    // Ações do painel admin (admin.gs) trazem "action"; pedidos do site não.
    if (dados && dados.action) return adminPost_(dados);

    if (!pedidoDentroDoLimite_()) return json_({ ok: false, erro: 'Muitos pedidos ao mesmo tempo.' });

    let quando = dados.ts ? new Date(dados.ts) : new Date();
    if (isNaN(quando.getTime())) quando = new Date();

    // O corpo chega de um endereço público: tudo é limpo, limitado e impedido
    // de virar fórmula na planilha (celula_ está em admin.gs).
    const id = gravaPedido_({
      quando: quando,
      bairro: dados.bairro,
      pagamento: dados.pagamento,
      total: dados.total,
      itens: limpaItens_(dados.itens),
      id: dados.id,
      status: 'novo',
      origem: 'site',
      entrega: dados.entrega === 'retirada' ? 'retirada' : 'entrega',
      cliente: limpaNome_(dados.nome),
      telefone: limpaTelefone_(dados.telefone),
      obs: '',
    });
    return json_({ ok: true, id: id });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erro: 'Não foi possível registrar.' });
  }
}

/* ------------------------------------------------------------------ */
/*  Gravação de um pedido (site ou digitado no painel)                */
/* ------------------------------------------------------------------ */
function gravaPedido_(p) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = abaPedidos_();

    // código: usa o do site se for válido e ainda não existir; senão cria outro
    let id = codigoValido_(p.id) ? String(p.id) : '';
    const existentes = codigosRecentes_(aba);
    if (!id || existentes.indexOf(id) >= 0) id = novoCodigoLivre_(existentes);

    aba.appendRow([
      p.quando,
      celula_(String(p.bairro || '').slice(0, 80)),
      celula_(String(p.pagamento || '').slice(0, 20)),
      numeroEntre_(p.total, 0, 10000, 0),
      celula_(textoItens_(p.itens).slice(0, 2000)),
      celula_(JSON.stringify(ajustaTamanho_(p.itens))),   // coluna técnica — não editar
      id,
      p.status,
      p.origem,
      p.entrega,
      celula_(String(p.cliente || '').slice(0, 60)),
      celula_(String(p.obs || '').slice(0, 200)),
      String(p.telefone || ''),                           // só dígitos (coluna em formato texto)
    ]);
    return id;
  } finally {
    lock.releaseLock();
  }
}

/** Aba Pedidos: cria se não existir e completa o cabeçalho das colunas novas. */
function abaPedidos_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(ABA_PEDIDOS);
  if (!aba) {
    aba = ss.insertSheet(ABA_PEDIDOS);
    aba.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  const n = CABECALHO_PEDIDOS.length;
  const atual = aba.getRange(1, 1, 1, n).getValues()[0].join('|');
  if (atual !== CABECALHO_PEDIDOS.join('|')) {
    aba.getRange('M:M').setNumberFormat('@');             // telefone nunca vira número
    aba.getRange(1, 1, 1, n).setValues([CABECALHO_PEDIDOS]).setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

/* ------------------------------------------------------------------ */
/*  Códigos                                                           */
/* ------------------------------------------------------------------ */
function codigoValido_(c) {
  return typeof c === 'string' && /^[A-HJ-NP-Z2-9]{5}$/.test(c);
}

function codigosRecentes_(aba) {
  const n = aba.getLastRow();
  if (n < 2) return [];
  const ini = Math.max(2, n - 399);
  return aba.getRange(ini, COL.CODIGO, n - ini + 1, 1).getValues()
    .map(function (l) { return String(l[0]); });
}

function novoCodigoLivre_(existentes) {
  for (let t = 0; t < 30; t++) {
    let c = '';
    for (let i = 0; i < 5; i++) c += ALFABETO_CODIGO.charAt(Math.floor(Math.random() * ALFABETO_CODIGO.length));
    if (existentes.indexOf(c) < 0) return c;
  }
  throw new Error('Não consegui gerar um código livre.');
}

/* ------------------------------------------------------------------ */
/*  Limpeza dos itens (o que chega é tratado como lixo até provar o contrário) */
/* ------------------------------------------------------------------ */
function limpaItens_(lista) {
  if (!Array.isArray(lista)) return [];
  const saida = [];
  lista.slice(0, 25).forEach(function (it) {
    if (!it || typeof it !== 'object') return;
    const sabor = String(it.sabor || '').trim().slice(0, 60);
    if (!sabor) return;
    // 'mini' era o nome antigo do broto
    const tipo = it.tipo === 'calzone' || it.tipo === 'bebida' ? it.tipo : 'pizza';
    const meio = tipo === 'pizza' && it.meio ? String(it.meio).trim().slice(0, 60) : '';
    saida.push({
      tipo: tipo,
      sabor: sabor,
      tamanho: tipo !== 'pizza' ? null : (it.tamanho === 'broto' || it.tipo === 'mini' ? 'broto' : 'grande'),
      meio: meio || null,
      qtd: inteiroEntre_(it.qtd, 1, 50, 1),
      tirar: listaTexto_(it.tirar, 10),
      tirarMeio: listaTexto_(it.tirarMeio, 10),
      tirarToda: listaTexto_(it.tirarToda, 10),
      adicionais: listaTexto_(it.adicionais, 20),
      borda: it.borda ? (String(it.borda).trim().slice(0, 25) || null) : null,
      preco: numeroEntre_(it.preco, 0, 1000, 0),
    });
  });
  return saida;
}

function listaTexto_(v, max) {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max)
    .map(function (x) { return String(x).trim().slice(0, 25); })
    .filter(function (x) { return x !== ''; });
}

function inteiroEntre_(v, min, max, padrao) {
  const n = Math.floor(Number(v));
  return isFinite(n) && n >= min && n <= max ? n : padrao;
}

function numeroEntre_(v, min, max, padrao) {
  const n = typeof v === 'number' ? v : numero_(v);
  return n !== null && isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : padrao;
}

/** Garante que o JSON cabe numa célula (limite de 50 mil caracteres). */
function ajustaTamanho_(itens) {
  const copia = itens.slice();
  while (copia.length > 1 && JSON.stringify(copia).length > 45000) copia.pop();
  return copia;
}

/* ------------------------------------------------------------------ */
/*  Texto dos itens                                                   */
/* ------------------------------------------------------------------ */
function rotulo_(it) {
  if (it.tipo === 'calzone') return 'Calzone';
  if (it.tipo === 'bebida') return 'Bebida';
  return it.tamanho === 'broto' || it.tipo === 'mini' ? 'Broto' : 'Grande';
}

/** "sem …": uma frase só sem meio a meio; uma por metade com meio a meio. */
function frasesSem_(it) {
  const primeira = it.tirar || [], meio = it.tirarMeio || [], toda = it.tirarToda || [];
  if (!it.meio) {
    const tudo = primeira.concat(toda);
    return tudo.length ? ['sem ' + tudo.join(', ')] : [];
  }
  const f = [];
  if (primeira.length) f.push('sem ' + primeira.join(', ') + ' (metade ' + it.sabor + ')');
  if (meio.length)     f.push('sem ' + meio.join(', ') + ' (metade ' + it.meio + ')');
  if (toda.length)     f.push('sem ' + toda.join(', '));
  return f;
}

function textoItem_(it) {
  const q = (it.qtd || 1) + 'x ';
  if (it.tipo === 'bebida') return q + it.sabor;
  let s = q + rotulo_(it) + ' ' + it.sabor;
  if (it.meio) s += ' / ' + it.meio + ' (meio a meio)';
  if (it.adicionais && it.adicionais.length) s += ' (com ' + it.adicionais.join(', ') + ')';
  if (it.borda) s += ' [borda ' + it.borda + ']';
  const sem = frasesSem_(it);
  if (sem.length) s += ' (' + sem.join('; ') + ')';
  return s;
}

function textoItens_(itens) {
  return itens.map(textoItem_).join('  |  ');
}

/* ------------------------------------------------------------------ */
/*  Trava contra enchente de pedidos falsos                           */
/* ------------------------------------------------------------------ */
function pedidoDentroDoLimite_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const chave = 'ped_' + Math.floor(Date.now() / 60000);   // janela fixa de 1 minuto
    const n = Number(cache.get(chave) || 0);
    if (n >= MAX_PEDIDOS_POR_MINUTO) return false;
    cache.put(chave, String(n + 1), 120);
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/*  Cliente: nome e telefone (do site ou digitados no painel)         */
/* ------------------------------------------------------------------ */
function limpaNome_(v) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/** Só dígitos, com DDD (10 ou 11 números). Aceita +55 na frente. Inválido vira ''. */
function limpaTelefone_(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if (d.length >= 12 && d.indexOf('55') === 0) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : '';
}

/* ------------------------------------------------------------------ */
/*  Receitas e consumo de ingredientes                                */
/* ------------------------------------------------------------------ */

/** Texto sem acento, minúsculo — e "muçarela"/"mussarela"/"musarela" viram a mesma coisa. */
function norm_(s) {
  return String(s == null ? '' : s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/mu[cs]{1,2}arela/g, 'mussarela')
    .replace(/\s+/g, ' ').trim();
}

/** "Mussarela extra" (adicional) → "mussarela" (ingrediente). */
function nomeAdicional_(s) {
  return norm_(s).replace(/ extra$/, '');
}

/**
 * Lê a aba Receitas no formato do painel:
 *   { existe, padrao:[{ing,qtd,un}], fatores:{broto,calzone}, bordas:[{nome,qtd,un}],
 *     sabores:[{nome, itens:[{ing,qtd,un,excecao}]}] }
 * qtd === null significa "ainda sem quantidade".
 */
function lerReceitasPainel_() {
  const r = { existe: false, padrao: [], fatores: {}, bordas: [], sabores: [] };
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_RECEITAS);
  if (!aba || aba.getLastRow() < 2) return r;
  r.existe = true;

  const porSabor = {};
  aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues().forEach(function (l) {
    const tipo = String(l[0]).trim(), sabor = String(l[1]).trim(), ing = String(l[2]).trim();
    const qtd = numero_(l[3]);
    const un = String(l[4]).trim() === 'un' ? 'un' : 'g';
    if (tipo === 'padrao' && ing) {
      r.padrao.push({ ing: ing, qtd: qtd, un: un });
    } else if (tipo === 'fator' && (ing === 'broto' || ing === 'calzone') && qtd !== null) {
      r.fatores[ing] = qtd;
    } else if (tipo === 'borda' && ing) {
      r.bordas.push({ nome: ing, qtd: qtd, un: un });
    } else if (tipo === 'sabor' && sabor && ing) {
      if (!porSabor[sabor]) porSabor[sabor] = { nome: sabor, itens: [] };
      porSabor[sabor].itens.push({ ing: ing, qtd: qtd, un: un, excecao: String(l[5]).trim() === 'sim' });
    }
  });
  r.sabores = Object.keys(porSabor).map(function (k) { return porSabor[k]; });
  return r;
}

/** Receitas já indexadas pelo nome sem acento, prontas para as contas. */
function receitasIndexadas_() {
  const r = lerReceitasPainel_();
  const idx = {
    existe: r.existe,
    fatores: {
      broto: r.fatores.broto !== undefined ? r.fatores.broto : 1,
      calzone: r.fatores.calzone !== undefined ? r.fatores.calzone : 1,
    },
    padrao: {}, bordas: {}, sabores: {},
  };
  r.padrao.forEach(function (x) { idx.padrao[norm_(x.ing)] = { nome: x.ing, qtd: x.qtd, un: x.un }; });
  r.bordas.forEach(function (x) { idx.bordas[norm_(x.nome)] = { nome: x.nome, qtd: x.qtd, un: x.un }; });
  r.sabores.forEach(function (s) { idx.sabores[norm_(s.nome)] = s; });
  return idx;
}

function novoConsumo_() { return { itens: {}, faltas: {} }; }

function somaConsumo_(acc, nome, qtd, un) {
  const k = norm_(nome) + '|' + un;
  if (!acc.itens[k]) acc.itens[k] = { nome: nome, qtd: 0, un: un };
  acc.itens[k].qtd += qtd;
}

/**
 * Soma ao acumulador o que UM item do pedido gasta.
 *  - broto/calzone usam uma fração da receita da grande (fatores);
 *  - meio a meio: metade da receita de cada sabor;
 *  - "sem cebola" tira a cebola só daquela metade; "sem azeitona" (toda) tira das duas;
 *  - adicional: a mesma quantidade do ingrediente na pizza;
 *  - borda recheada: quantidade cadastrada para a borda.
 * O que falta cadastrar vai para acc.faltas (nunca é inventado).
 */
function consumoDoItem_(it, rec, acc) {
  if (!it || it.tipo === 'bebida') return;
  const q = it.qtd || 1;
  const fator = it.tipo === 'calzone' ? rec.fatores.calzone : (it.tamanho === 'broto' || it.tipo === 'mini' ? rec.fatores.broto : 1);
  const toda = (it.tirarToda || []).map(norm_);
  const metades = it.meio ? [[it.sabor, it.tirar], [it.meio, it.tirarMeio]] : [[it.sabor, it.tirar]];
  const peso = it.meio ? 0.5 : 1;

  metades.forEach(function (m) {
    const receita = rec.sabores[norm_(m[0])];
    if (!receita) { acc.faltas['sabor ' + m[0]] = true; return; }
    const tirados = (m[1] || []).map(norm_).concat(toda);
    receita.itens.forEach(function (x) {
      if (tirados.indexOf(norm_(x.ing)) >= 0) return;
      if (x.qtd === null) { acc.faltas[x.ing] = true; return; }
      somaConsumo_(acc, x.ing, x.qtd * peso * fator * q, x.un);
    });
  });

  (it.adicionais || []).forEach(function (nome) {
    const e = rec.padrao[nomeAdicional_(nome)];
    if (!e || e.qtd === null) { acc.faltas[nome] = true; return; }
    somaConsumo_(acc, e.nome, e.qtd * q, e.un);
  });

  if (it.borda) {
    const b = rec.bordas[norm_(it.borda)];
    if (!b || b.qtd === null) acc.faltas['borda ' + it.borda] = true;
    else somaConsumo_(acc, b.nome, b.qtd * q, b.un);
  }
}

/** Preço dos insumos (aba Insumos) indexado pelo nome sem acento. */
function insumosIndexados_() {
  const idx = {};
  (linhas_(SpreadsheetApp.getActiveSpreadsheet(), ABA_INSUMOS, 3) || []).forEach(function (l) {
    const preco = numero_(l[2]);
    if (String(l[0]).trim() && preco !== null) {
      idx[norm_(l[0])] = { unidade: String(l[1]).trim().toLowerCase(), preco: preco };
    }
  });
  return idx;
}

/** Custo de 1 g (ou 1 un) da receita, a partir do preço do insumo. null = unidades incompatíveis. */
function custoUnitario_(ins, un) {
  if (un === 'g') {
    if (ins.unidade === 'kg') return ins.preco / 1000;
    if (ins.unidade === 'g')  return ins.preco;
  }
  if (un === 'un' && (ins.unidade === 'un' || ins.unidade === 'unid' || ins.unidade === 'unidade')) return ins.preco;
  return null;
}

/**
 * Fecha o acumulador: lista ordenada com custo, total e o que ficou de fora.
 *   itens: [{nome, qtd, un, custo|null}]   faltas: nomes sem quantidade   semPreco: nomes sem preço utilizável
 */
function fechaConsumo_(acc, insumos) {
  const itens = [], semPreco = [];
  let custoTotal = 0;
  Object.keys(acc.itens).forEach(function (k) {
    const x = acc.itens[k];
    const ins = insumos[norm_(x.nome)];
    const cu = ins ? custoUnitario_(ins, x.un) : null;
    const custo = cu === null ? null : Math.round(x.qtd * cu * 100) / 100;
    if (custo === null) semPreco.push(x.nome); else custoTotal += custo;
    itens.push({ nome: x.nome, qtd: Math.round(x.qtd * 10) / 10, un: x.un, custo: custo });
  });
  itens.sort(function (a, b) {
    if (a.un !== b.un) return a.un === 'g' ? -1 : 1;
    return b.qtd - a.qtd;
  });
  return {
    itens: itens,
    custoTotal: Math.round(custoTotal * 100) / 100,
    faltas: Object.keys(acc.faltas).sort(),
    semPreco: semPreco.sort(),
  };
}

/** "1,25 kg", "340 g", "20 un" */
function qtdTexto_(qtd, un) {
  if (un === 'un') return String(Math.round(qtd)) + ' un';
  if (qtd >= 1000) return (qtd / 1000).toFixed(2).replace('.', ',') + ' kg';
  return String(Math.round(qtd)) + ' g';
}

function reais_(n) { return 'R$ ' + Number(n).toFixed(2).replace('.', ','); }

/** Guarda o consumo do dia na aba "Consumo diário" (refazer o mesmo dia troca as linhas dele). */
function registraConsumo_(ss, dataTxt, cons) {
  const aba = ss.getSheetByName(ABA_CONSUMO) || ss.insertSheet(ABA_CONSUMO);
  let antigas = [];
  if (aba.getLastRow() >= 2) {
    antigas = aba.getRange(2, 1, aba.getLastRow() - 1, 5).getValues()
      .filter(function (l) { return String(l[0]) !== dataTxt; });
  }
  const novas = cons.itens.map(function (x) {
    return [dataTxt, celula_(x.nome), x.qtd, x.un, x.custo === null ? '' : x.custo];
  });
  aba.clear();
  aba.getRange('A:A').setNumberFormat('@');
  aba.getRange(1, 1, 1, 5).setValues([['Data', 'Ingrediente', 'Quantidade', 'Unidade', 'Custo (R$)']]).setFontWeight('bold');
  aba.setFrozenRows(1);
  const todas = antigas.concat(novas);
  if (todas.length) aba.getRange(2, 1, todas.length, 5).setValues(todas);
}

/* ------------------------------------------------------------------ */
/*  Resumo do dia — rode manualmente ou por acionador de tempo        */
/* ------------------------------------------------------------------ */
function resumoDoDia() {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(ABA_PEDIDOS);
  if (!aba || aba.getLastRow() < 2) return;

  const agora  = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());  // meia-noite de hoje
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, CABECALHO_PEDIDOS.length).getValues();

  const sabores = {};   // "Grande Calabresa" -> quantidade
  const bordas  = {};
  const rec = receitasIndexadas_();
  const acc = novoConsumo_();
  let pedidos = 0, faturamento = 0;

  linhas.forEach(function (l) {
    if (new Date(l[COL.DATA - 1]) < inicio) return;
    if (String(l[COL.STATUS - 1]) === 'cancelado') return;   // cancelado no painel não conta
    pedidos++;
    faturamento += Number(l[COL.TOTAL - 1] || 0);
    var itens = [];
    try { itens = JSON.parse(l[COL.DETALHE - 1]); } catch (e) {}
    if (!Array.isArray(itens)) itens = [];
    itens.forEach(function (it) {
      var q = it.qtd || 1;
      consumoDoItem_(it, rec, acc);
      if (it.tipo === 'bebida') { somar_(sabores, 'Bebida ' + it.sabor, q); return; }
      somar_(sabores, rotulo_(it) + ' ' + it.sabor, q);
      if (it.meio)  somar_(sabores, rotulo_(it) + ' ' + it.meio, q);  // meio a meio conta p/ os 2 sabores
      if (it.borda) somar_(bordas, it.borda, q);
    });
  });

  const cons = fechaConsumo_(acc, insumosIndexados_());
  const tz = ss.getSpreadsheetTimeZone();
  const data = Utilities.formatDate(agora, tz, 'dd/MM/yyyy');
  registraConsumo_(ss, Utilities.formatDate(agora, tz, 'yyyy-MM-dd'), cons);

  // ---- escreve a aba "Resumo do dia"
  var resumo = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  resumo.clear();
  resumo.appendRow(['Resumo de ' + data]);
  resumo.appendRow(['Pedidos (sem os cancelados)', pedidos]);
  resumo.appendRow(['Faturamento (R$)', faturamento]);
  resumo.appendRow([]);
  resumo.appendRow(['Sabor / item', 'Quantidade']);
  chavesOrdenadas_(sabores).forEach(function (k) { resumo.appendRow([k, sabores[k]]); });
  if (Object.keys(bordas).length) {
    resumo.appendRow([]);
    resumo.appendRow(['Borda', 'Quantidade']);
    Object.keys(bordas).forEach(function (k) { resumo.appendRow([k, bordas[k]]); });
  }
  resumo.appendRow([]);
  resumo.appendRow(['Ingredientes usados', 'Quantidade', 'Custo (R$)']);
  cons.itens.forEach(function (x) {
    resumo.appendRow([celula_(x.nome), qtdTexto_(x.qtd, x.un), x.custo === null ? '' : x.custo]);
  });
  if (!cons.itens.length) resumo.appendRow(['(nenhum ingrediente calculado)']);
  resumo.appendRow(['Custo estimado dos ingredientes (R$)', '', cons.custoTotal]);
  resumo.appendRow(['Faturamento menos custo dos ingredientes (R$)', '', Math.round((faturamento - cons.custoTotal) * 100) / 100]);
  if (!rec.existe) resumo.appendRow(['Atenção: as receitas ainda não foram salvas no painel (aba Receitas).']);
  if (cons.faltas.length)   resumo.appendRow(['Atenção: falta a quantidade de: ' + cons.faltas.join(', ')]);
  if (cons.semPreco.length) resumo.appendRow(['Atenção: sem preço compatível na aba Insumos: ' + cons.semPreco.join(', ')]);

  // ---- e-mail opcional
  if (EMAIL_RESUMO) {
    var corpo = 'Resumo de ' + data + '\n\n'
      + 'Pedidos: ' + pedidos + '\n'
      + 'Faturamento: ' + reais_(faturamento) + '\n\n'
      + 'Sabores / itens:\n';
    chavesOrdenadas_(sabores).forEach(function (k) { corpo += '  ' + sabores[k] + 'x ' + k + '\n'; });
    if (Object.keys(bordas).length) {
      corpo += '\nBordas:\n';
      Object.keys(bordas).forEach(function (k) { corpo += '  ' + bordas[k] + 'x ' + k + '\n'; });
    }
    corpo += '\nIngredientes usados:\n';
    cons.itens.forEach(function (x) {
      corpo += '  ' + qtdTexto_(x.qtd, x.un) + ' de ' + x.nome + (x.custo === null ? '' : ' (' + reais_(x.custo) + ')') + '\n';
    });
    corpo += '\nCusto estimado dos ingredientes: ' + reais_(cons.custoTotal) + '\n';
    corpo += 'Faturamento menos custo dos ingredientes: ' + reais_(faturamento - cons.custoTotal) + '\n';
    if (!rec.existe) corpo += '\nAtenção: as receitas ainda não foram salvas no painel (aba Receitas).\n';
    if (cons.faltas.length)   corpo += '\nAtenção: falta a quantidade de: ' + cons.faltas.join(', ') + '\n';
    if (cons.semPreco.length) corpo += 'Atenção: sem preço compatível na aba Insumos: ' + cons.semPreco.join(', ') + '\n';
    MailApp.sendEmail(EMAIL_RESUMO, 'Pizzaria Primos — resumo do dia (' + data + ')', corpo);
  }
}

function somar_(obj, chave, q)      { obj[chave] = (obj[chave] || 0) + q; }
function chavesOrdenadas_(obj)      { return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }); }
