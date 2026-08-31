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
 *
 * Passo a passo de instalação: veja estoque-README.md
 */

const ABA_PEDIDOS  = 'Pedidos';
const ABA_RESUMO   = 'Resumo do dia';
const EMAIL_RESUMO = 'silvanapolletiscalisee@gmail.com'; // recebe o resumo à noite. '' para não enviar.

/* ------------------------------------------------------------------ */
/*  Recebe cada pedido do site                                        */
/* ------------------------------------------------------------------ */
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const ss  = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(ABA_PEDIDOS) || criarAbaPedidos_(ss);
    const quando = dados.ts ? new Date(dados.ts) : new Date();

    const itensTxt = (dados.itens || []).map(function (it) {
      var s = (it.qtd || 1) + 'x ' + rotulo_(it.tipo) + ' ' + it.sabor;
      if (it.meio)  s += ' / ' + it.meio + ' (meio a meio)';
      if (it.borda) s += ' [borda ' + it.borda + ']';
      if (it.tirar && it.tirar.length) s += ' (sem ' + it.tirar.join(', ') + ')';
      return s;
    }).join('  |  ');

    aba.appendRow([
      quando,
      dados.bairro || '',
      dados.pagamento || '',
      Number(dados.total || 0),
      itensTxt,
      JSON.stringify(dados.itens || [])   // coluna técnica — não editar
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, erro: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function criarAbaPedidos_(ss) {
  const aba = ss.insertSheet(ABA_PEDIDOS);
  aba.appendRow(['Data e hora', 'Bairro', 'Pagamento', 'Total (R$)', 'Itens', 'Detalhe (não editar)']);
  aba.setFrozenRows(1);
  aba.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  return aba;
}

function rotulo_(tipo) {
  return tipo === 'mini' ? 'Mini' : tipo === 'calzone' ? 'Calzone' : 'Grande';
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
  const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues();

  const sabores = {};   // "Grande Calabresa" -> quantidade
  const bordas  = {};
  let pedidos = 0, faturamento = 0;

  linhas.forEach(function (l) {
    if (new Date(l[0]) < inicio) return;
    pedidos++;
    faturamento += Number(l[3] || 0);
    var itens = [];
    try { itens = JSON.parse(l[5]); } catch (e) {}
    itens.forEach(function (it) {
      var q = it.qtd || 1;
      somar_(sabores, rotulo_(it.tipo) + ' ' + it.sabor, q);
      if (it.meio)  somar_(sabores, rotulo_(it.tipo) + ' ' + it.meio, q);  // meio a meio conta p/ os 2 sabores
      if (it.borda) somar_(bordas, it.borda, q);
    });
  });

  // ---- escreve a aba "Resumo do dia"
  var resumo = ss.getSheetByName(ABA_RESUMO) || ss.insertSheet(ABA_RESUMO);
  resumo.clear();
  var data = Utilities.formatDate(agora, ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy');
  resumo.appendRow(['Resumo de ' + data]);
  resumo.appendRow(['Pedidos', pedidos]);
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
