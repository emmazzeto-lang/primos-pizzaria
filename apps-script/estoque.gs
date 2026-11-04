/**
 * PIZZARIA PRIMOS — registro de pedidos + resumo do fim da noite
 * ---------------------------------------------------------------
 * Este código roda numa planilha Google (Google Sheets) e recebe,
 * a cada pedido enviado pelo site, uma linha com os itens.
 * No fechamento, monta um resumo do dia (sabores vendidos, bordas,
 * faturamento) e — se você preencher um e-mail abaixo — envia por e-mail.
 *
 * O site NÃO manda nome, telefone nem endereço para cá — só bairro,
 * forma de pagamento, total e os itens. É só para controle de produção.
 * Cada pedido ganha um código curto (ex.: K7P3X) que também vai na
 * mensagem do WhatsApp: é assim que a pizzaria acha o pedido no painel.
 *
 * Passo a passo de instalação: veja README.md desta pasta.
 */

const ABA_PEDIDOS  = 'Pedidos';
const ABA_RESUMO   = 'Resumo do dia';
const EMAIL_RESUMO = 'silvanapolletiscalisee@gmail.com'; // recebe o resumo à noite. '' para não enviar.

// Colunas da aba Pedidos. A–F existem desde o começo; G–L vieram com a página de pedidos
// do painel (o cabeçalho é completado sozinho, e as linhas antigas continuam valendo).
const CABECALHO_PEDIDOS = [
  'Data e hora', 'Bairro', 'Pagamento', 'Total (R$)', 'Itens', 'Detalhe (não editar)',
  'Código', 'Status', 'Origem', 'Entrega', 'Cliente', 'Observação',
];
const COL = { DATA: 1, BAIRRO: 2, PAGAMENTO: 3, TOTAL: 4, ITENS: 5, DETALHE: 6,
              CODIGO: 7, STATUS: 8, ORIGEM: 9, ENTREGA: 10, CLIENTE: 11, OBS: 12 };

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
      cliente: '',
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
      if (it.tipo === 'bebida') { somar_(sabores, 'Bebida ' + it.sabor, q); return; }
      somar_(sabores, rotulo_(it) + ' ' + it.sabor, q);
      if (it.meio)  somar_(sabores, rotulo_(it) + ' ' + it.meio, q);  // meio a meio conta p/ os 2 sabores
      if (it.borda) somar_(bordas, it.borda, q);
    });
  });

  // ---- escreve a aba "Resumo do dia"
  var resumo = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  resumo.clear();
  var data = Utilities.formatDate(agora, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
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
  resumo.appendRow(['— quando você tiver a quantidade de cada ingrediente por pizza,']);
  resumo.appendRow(['  dá para transformar isto em "kg de mussarela, kg de calabresa..." —']);

  // ---- e-mail opcional
  if (EMAIL_RESUMO) {
    var corpo = 'Resumo de ' + data + '\n\n'
      + 'Pedidos: ' + pedidos + '\n'
      + 'Faturamento: R$ ' + faturamento.toFixed(2).replace('.', ',') + '\n\n'
      + 'Sabores / itens:\n';
    chavesOrdenadas_(sabores).forEach(function (k) { corpo += '  ' + sabores[k] + 'x ' + k + '\n'; });
    if (Object.keys(bordas).length) {
      corpo += '\nBordas:\n';
      Object.keys(bordas).forEach(function (k) { corpo += '  ' + bordas[k] + 'x ' + k + '\n'; });
    }
    MailApp.sendEmail(EMAIL_RESUMO, 'Pizzaria Primos — resumo do dia (' + data + ')', corpo);
  }
}

function somar_(obj, chave, q)      { obj[chave] = (obj[chave] || 0) + q; }
function chavesOrdenadas_(obj)      { return Object.keys(obj).sort(function (a, b) { return obj[b] - obj[a]; }); }
