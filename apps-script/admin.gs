/**
 * PIZZARIA PRIMOS — painel admin (servidor)
 * ----------------------------------------------------------------
 * Guarda os ajustes que a dona faz em /admin (horário, abrir/fechar, preços,
 * promoções e preço dos insumos) em abas da própria planilha e entrega ao site.
 *
 *   GET  ?action=config      → ajustes PÚBLICOS (o site lê ao abrir). Sem insumos.
 *   POST {action:"login"}    → confere a senha, devolve um token de sessão (6 h).
 *   POST {action:"get"|"save"|"logout", token} → só com token válido.
 *   POST {action:"pedidos"|"pedido_status"|"pedido_novo", token} → página de pedidos do painel.
 *   POST {action:"relatorio"|"clientes", token} → gráficos, consumo de ingredientes e histórico dos clientes.
 *
 * A senha NÃO fica no código: crie a propriedade de script ADMIN_SENHA
 * (Configurações do projeto → Propriedades do script). Sem ela o painel não abre.
 *
 * Passo a passo: veja README.md desta pasta.
 */

const ABA_CONFIG  = 'Config';
const ABA_PRECOS  = 'Preços';
const ABA_PROMOS  = 'Promoções';
const ABA_INSUMOS = 'Insumos';

const SESSAO_SEGUNDOS = 6 * 60 * 60;       // máximo permitido pelo CacheService
const MAX_FALHAS = 5;                       // tentativas de senha erradas...
const BLOQUEIO_SEGUNDOS = 10 * 60;          // ...e quanto tempo fica bloqueado
const CACHE_PUBLICO_SEGUNDOS = 30;          // evita ler a planilha a cada visita

class ErroUsuario extends Error {}

/* ------------------------------------------------------------------ */
/*  Entradas                                                          */
/* ------------------------------------------------------------------ */
function doGet(e) {
  const acao = (e && e.parameter && e.parameter.action) || '';
  try {
    if (acao === 'config') return json_(configPublica_());
    return json_({ ok: true, servico: 'Pizzaria Primos' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, erro: 'Erro interno.' });
  }
}

/** Chamado pelo doPost (estoque.gs) quando o corpo traz "action". */
function adminPost_(d) {
  try {
    switch (d.action) {
      case 'login':
        return json_(login_(d.senha));
      case 'logout':
        exigeSessao_(d.token);
        CacheService.getScriptCache().remove('sess:' + d.token);
        return json_({ ok: true });
      case 'get':
        exigeSessao_(d.token);
        return json_(Object.assign({ ok: true }, lerTudo_(true)));
      case 'save':
        exigeSessao_(d.token);
        return json_(salvar_(d));
      case 'pedidos':
        exigeSessao_(d.token);
        return json_(listaPedidos_());
      case 'pedido_status':
        exigeSessao_(d.token);
        return json_(mudaStatus_(d));
      case 'pedido_novo':
        exigeSessao_(d.token);
        return json_(novoPedidoManual_(d));
      case 'relatorio':
        exigeSessao_(d.token);
        return json_(relatorio_(d));
      case 'clientes':
        exigeSessao_(d.token);
        return json_(clientes_());
      default:
        return json_({ ok: false, erro: 'Ação desconhecida.' });
    }
  } catch (err) {
    if (!(err instanceof ErroUsuario)) console.error(err);
    return json_({
      ok: false,
      erro: err instanceof ErroUsuario ? err.message : 'Erro interno. Tente de novo.',
    });
  }
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/*  Login e sessão                                                    */
/* ------------------------------------------------------------------ */
function login_(senha) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const falhas = Number(cache.get('falhas') || 0);
    if (falhas >= MAX_FALHAS) {
      throw new ErroUsuario('Muitas tentativas erradas. Aguarde alguns minutos e tente de novo.');
    }

    const correta = PropertiesService.getScriptProperties().getProperty('ADMIN_SENHA');
    if (!correta) {
      throw new ErroUsuario('A senha do painel ainda não foi configurada (propriedade ADMIN_SENHA).');
    }
    if (!iguais_(String(senha || ''), correta)) {
      cache.put('falhas', String(falhas + 1), BLOQUEIO_SEGUNDOS);
      throw new ErroUsuario('Senha incorreta.');
    }

    cache.remove('falhas');
    const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    cache.put('sess:' + token, '1', SESSAO_SEGUNDOS);
    return { ok: true, token: token };
  } finally {
    lock.releaseLock();
  }
}

function exigeSessao_(token) {
  if (!token || typeof token !== 'string' || !CacheService.getScriptCache().get('sess:' + token)) {
    throw new ErroUsuario('Sessão expirada. Entre de novo.');
  }
}

/** Comparação que leva o mesmo tempo, acertando ou errando. */
function iguais_(a, b) {
  let r = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return r === 0;
}

/* ------------------------------------------------------------------ */
/*  Leitura                                                           */
/* ------------------------------------------------------------------ */
function configPublica_() {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('publico');
  if (guardado) return JSON.parse(guardado);

  const t = lerTudo_(false);
  const saida = { ok: true, config: t.config, precos: t.precos, promos: t.promos, atualizadoEm: t.atualizadoEm };
  cache.put('publico', JSON.stringify(saida), CACHE_PUBLICO_SEGUNDOS);
  return saida;
}

/** Lê as abas. `comInsumos` só para o painel — insumos nunca saem no GET público. */
function lerTudo_(comInsumos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const saida = { config: null, precos: {}, promos: null, atualizadoEm: '' };

  const cfg = linhas_(ss, ABA_CONFIG, 2);
  if (cfg) {
    const m = {};
    cfg.forEach(function (l) { m[String(l[0]).trim()] = String(l[1]).trim(); });
    saida.atualizadoEm = m.atualizado_em || '';
    saida.config = {};
    if (['auto', 'aberto', 'fechado'].indexOf(m.modo) >= 0) saida.config.modo = m.modo;
    if (/^\d{4}-\d{2}-\d{2}$/.test(m.ate || '')) saida.config.ate = m.ate;
    if (m.aviso !== undefined) saida.config.aviso = m.aviso.slice(0, 120);
    if (m.dias !== undefined) {
      saida.config.diasAbre = m.dias.split(',')
        .map(function (x) { return parseInt(x, 10); })
        .filter(function (x) { return x >= 0 && x <= 6; });
    }
    const ab = numero_(m.abre), fe = numero_(m.fecha);
    if (ab !== null && fe !== null && ab >= 0 && fe <= 24 && ab < fe) {
      saida.config.abreHora = ab;
      saida.config.fechaHora = fe;
    }
  }

  const pre = linhas_(ss, ABA_PRECOS, 3);
  if (pre) {
    pre.forEach(function (l) {
      const v = numero_(l[2]);
      if (/^[a-z0-9:-]{1,50}$/.test(String(l[0])) && v !== null && v >= 0 && v <= 1000) {
        saida.precos[String(l[0])] = v;
      }
    });
  }

  const pro = linhas_(ss, ABA_PROMOS, 5);
  if (pro) {
    saida.promos = [];
    pro.forEach(function (l) {
      const dia = numero_(l[0]), preco = numero_(l[3]);
      if (dia === null || preco === null) return;
      saida.promos.push({
        dia: dia, sabor: String(l[1]).trim(), tamanho: String(l[2]).trim(),
        preco: preco, texto: String(l[4]).trim().slice(0, 120),
      });
    });
  }

  if (comInsumos) {
    saida.insumos = [];
    (linhas_(ss, ABA_INSUMOS, 3) || []).forEach(function (l) {
      const nome = String(l[0]).trim();
      const preco = numero_(l[2]);
      if (nome && preco !== null) saida.insumos.push({ nome: nome, unidade: String(l[1]).trim(), preco: preco });
    });
    saida.receitas = lerReceitasPainel_();
  }
  return saida;
}

/** Linhas de dados (sem cabeçalho, sem linhas vazias) ou null se a aba não existe. */
function linhas_(ss, nome, colunas) {
  const aba = ss.getSheetByName(nome);
  if (!aba) return null;
  const n = aba.getLastRow();
  if (n < 2) return [];
  return aba.getRange(2, 1, n - 1, colunas).getValues().filter(function (l) {
    return l.some(function (c) { return String(c).trim() !== ''; });
  });
}

function numero_(v) {
  if (typeof v === 'number') return isFinite(v) ? v : null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/* ------------------------------------------------------------------ */
/*  Gravação                                                          */
/* ------------------------------------------------------------------ */
function salvar_(d) {
  // 1) valida TUDO antes de escrever qualquer coisa
  const cfg = d.config !== undefined ? validaConfig_(d.config) : null;
  const pre = d.precos !== undefined ? validaPrecos_(d.precos) : null;
  const pro = d.promos !== undefined ? validaPromos_(d.promos) : null;
  const ins = d.insumos !== undefined ? validaInsumos_(d.insumos) : null;
  const rec = d.receitas !== undefined ? validaReceitas_(d.receitas) : null;

  // 2) grava
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const agora = new Date().toISOString();
    if (cfg) {
      escreverAba_(ABA_CONFIG, ['chave', 'valor'], [
        ['modo', cfg.modo],
        ['ate', cfg.ate],
        ['aviso', celula_(cfg.aviso)],
        ['dias', cfg.dias.join(',')],
        ['abre', String(cfg.abre)],
        ['fecha', String(cfg.fecha)],
        ['atualizado_em', agora],
      ], [2]);
    }
    if (pre) {
      escreverAba_(ABA_PRECOS, ['chave', 'descrição', 'valor (R$)'],
        Object.keys(pre).sort().map(function (k) { return [k, '', pre[k]]; }), [1, 2]);
    }
    if (pro) {
      escreverAba_(ABA_PROMOS, ['dia (-1 = todos)', 'sabor', 'tamanho', 'preço (R$)', 'texto'],
        pro.map(function (p) { return [p.dia, p.sabor, p.tamanho, p.preco, celula_(p.texto)]; }), [2, 3, 5]);
    }
    if (ins) {
      escreverAba_(ABA_INSUMOS, ['insumo', 'unidade', 'preço por unidade (R$)'],
        ins.map(function (i) { return [celula_(i.nome), celula_(i.unidade), i.preco]; }), [1, 2]);
    }
    if (rec) {
      const q = function (v) { return v === null ? '' : v; };
      const linhasRec = [];
      rec.padrao.forEach(function (x) { linhasRec.push(['padrao', '', celula_(x.ing), q(x.qtd), x.un, '']); });
      linhasRec.push(['fator', '', 'broto', rec.fatores.broto, '', '']);
      linhasRec.push(['fator', '', 'calzone', rec.fatores.calzone, '', '']);
      rec.bordas.forEach(function (x) { linhasRec.push(['borda', '', celula_(x.nome), q(x.qtd), x.un, '']); });
      rec.sabores.forEach(function (s) {
        s.itens.forEach(function (x) {
          linhasRec.push(['sabor', celula_(s.nome), celula_(x.ing), q(x.qtd), x.un, x.excecao ? 'sim' : '']);
        });
      });
      escreverAba_(ABA_RECEITAS, ['tipo', 'sabor', 'ingrediente', 'quantidade', 'unidade (g ou un)', 'exceção'],
        linhasRec, [1, 2, 3, 5, 6]);
    }
    CacheService.getScriptCache().remove('publico');
    return { ok: true, salvoEm: agora };
  } finally {
    lock.releaseLock();
  }
}

/** Recria a aba inteira. `colunasTexto` ficam como texto puro (nada vira data/fórmula). */
function escreverAba_(nome, cabecalho, linhas, colunasTexto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(nome) || ss.insertSheet(nome);
  aba.clear();
  (colunasTexto || []).forEach(function (c) {
    aba.getRange(1, c, Math.max(linhas.length + 1, 200), 1).setNumberFormat('@');
  });
  aba.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]).setFontWeight('bold');
  aba.setFrozenRows(1);
  if (linhas.length) aba.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
}

/** Impede que um texto vire fórmula na planilha (=, +, -, @ no começo). */
function celula_(valor) {
  const s = String(valor == null ? '' : valor);
  return /^[=+\-@\t\r]/.test(s) ? ' ' + s : s;
}

/* ------------------------------------------------------------------ */
/*  Validação — o servidor não confia no que o navegador manda        */
/* ------------------------------------------------------------------ */
function texto_(v, max, campo, obrigatorio) {
  const s = String(v == null ? '' : v).trim();
  if (obrigatorio && !s) throw new ErroUsuario('Preencha o campo "' + campo + '".');
  if (s.length > max) throw new ErroUsuario('"' + campo + '" passou de ' + max + ' caracteres.');
  return s;
}

function dinheiro_(v, max, campo) {
  const n = typeof v === 'number' ? v : numero_(v);
  if (n === null || n < 0 || n > max) {
    throw new ErroUsuario('Valor inválido em "' + campo + '" (use um número entre 0 e ' + max + ').');
  }
  return Math.round(n * 100) / 100;
}

function validaConfig_(c) {
  if (!c || typeof c !== 'object') throw new ErroUsuario('Ajustes de funcionamento inválidos.');
  const modo = ['auto', 'aberto', 'fechado'].indexOf(c.modo) >= 0 ? c.modo : 'auto';

  let ate = '';
  if (modo !== 'auto') {
    ate = String(c.ate || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ate) || isNaN(new Date(ate + 'T12:00:00Z').getTime())) {
      throw new ErroUsuario('Informe até que dia o ajuste vale.');
    }
  }

  const dias = (Array.isArray(c.diasAbre) ? c.diasAbre : [])
    .map(Number)
    .filter(function (x, i, arr) { return Number.isInteger(x) && x >= 0 && x <= 6 && arr.indexOf(x) === i; })
    .sort();

  const abre = Number(c.abreHora), fecha = Number(c.fechaHora);
  if (!isFinite(abre) || !isFinite(fecha) || abre < 0 || fecha > 24 || abre >= fecha) {
    throw new ErroUsuario('O horário de abertura precisa ser antes do de fechamento.');
  }

  return { modo: modo, ate: ate, aviso: texto_(c.aviso, 120, 'Aviso', false), dias: dias, abre: abre, fecha: fecha };
}

function validaPrecos_(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new ErroUsuario('Tabela de preços inválida.');
  const chaves = Object.keys(p);
  if (chaves.length > 200) throw new ErroUsuario('Itens demais na tabela de preços.');
  const saida = {};
  chaves.forEach(function (k) {
    if (!/^(pizza:[a-z0-9-]{1,40}|bebida:[a-z0-9-]{1,40}|broto|calzone|borda|adicional)$/.test(k)) {
      throw new ErroUsuario('Item de preço desconhecido: ' + k.slice(0, 30));
    }
    saida[k] = dinheiro_(p[k], 1000, k);
  });
  return saida;
}

function validaPromos_(lista) {
  if (!Array.isArray(lista) || lista.length > 20) throw new ErroUsuario('Promoções inválidas (máximo 20).');
  return lista.map(function (p, i) {
    const n = i + 1;
    const dia = Number(p.dia);
    if (!Number.isInteger(dia) || dia < -1 || dia > 6) throw new ErroUsuario('Promoção ' + n + ': dia inválido.');
    const sabor = String(p.sabor || '');
    if (!/^[a-z0-9-]{1,40}$/.test(sabor)) throw new ErroUsuario('Promoção ' + n + ': escolha o sabor.');
    if (p.tamanho !== 'grande' && p.tamanho !== 'broto') throw new ErroUsuario('Promoção ' + n + ': tamanho inválido.');
    return {
      dia: dia, sabor: sabor, tamanho: p.tamanho,
      preco: dinheiro_(p.preco, 1000, 'Promoção ' + n + ' — preço'),
      texto: texto_(p.texto, 120, 'Promoção ' + n + ' — texto', false),
    };
  });
}

function validaInsumos_(lista) {
  if (!Array.isArray(lista) || lista.length > 300) throw new ErroUsuario('Lista de insumos inválida (máximo 300).');
  const saida = [];
  lista.forEach(function (i) {
    const nome = String(i && i.nome || '').trim();
    if (!nome) return; // linha em branco: ignora
    saida.push({
      nome: texto_(nome, 60, 'Insumo', true),
      unidade: texto_(i.unidade, 12, 'Unidade', false),
      preco: dinheiro_(i.preco, 100000, 'Insumo ' + nome.slice(0, 20)),
    });
  });
  return saida;
}

/** Receitas: quanto de cada ingrediente vai em cada sabor (grande), fatores de tamanho e bordas. */
function validaReceitas_(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) throw new ErroUsuario('Receitas inválidas.');
  const qtd = function (v, campo) {
    if (v === null || v === undefined || v === '') return null;          // ainda sem quantidade
    const n = typeof v === 'number' ? v : numero_(v);
    if (n === null || n < 0 || n > 5000) throw new ErroUsuario('Quantidade inválida em "' + campo + '" (use de 0 a 5000).');
    return Math.round(n * 100) / 100;
  };
  const un = function (v) { return v === 'un' ? 'un' : 'g'; };
  const lista = function (v, max, campo) {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > max) throw new ErroUsuario('Lista de "' + campo + '" inválida.');
    return v;
  };

  const padrao = [], vistos = {};
  lista(r.padrao, 200, 'ingredientes').forEach(function (x) {
    const ing = texto_(x && x.ing, 60, 'Ingrediente', true);
    if (vistos[norm_(ing)]) return;
    vistos[norm_(ing)] = true;
    padrao.push({ ing: ing, qtd: qtd(x.qtd, ing), un: un(x.un) });
  });

  const fatores = {};
  ['broto', 'calzone'].forEach(function (k) {
    const f = r.fatores && r.fatores[k] !== undefined ? numero_(r.fatores[k]) : 1;
    if (f === null || f < 0.05 || f > 5) throw new ErroUsuario('Proporção de "' + k + '" inválida (use entre 5% e 500%).');
    fatores[k] = Math.round(f * 1000) / 1000;
  });

  const bordas = lista(r.bordas, 20, 'bordas').map(function (x) {
    const nome = texto_(x && x.nome, 40, 'Borda', true);
    return { nome: nome, qtd: qtd(x.qtd, 'Borda ' + nome), un: un(x.un) };
  });

  const sabores = lista(r.sabores, 80, 'sabores').map(function (s) {
    const nome = texto_(s && s.nome, 60, 'Sabor', true);
    const itens = lista(s.itens, 40, nome).map(function (x) {
      const ing = texto_(x && x.ing, 60, 'Ingrediente de ' + nome, true);
      return { ing: ing, qtd: qtd(x.qtd, nome + ' — ' + ing), un: un(x.un), excecao: x.excecao === true };
    });
    return { nome: nome, itens: itens };
  });

  return { padrao: padrao, fatores: fatores, bordas: bordas, sabores: sabores };
}

/* ------------------------------------------------------------------ */
/*  Pedidos (página "Pedidos" do painel)                              */
/* ------------------------------------------------------------------ */

/** Pedidos dos últimos 7 dias, do mais novo para o mais antigo. */
function listaPedidos_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
  if (!aba || aba.getLastRow() < 2) return { ok: true, pedidos: [] };

  const ultima = aba.getLastRow();
  const n = Math.min(ultima - 1, 400);
  const linhas = aba.getRange(ultima - n + 1, 1, n, CABECALHO_PEDIDOS.length).getValues();
  const corte = Date.now() - 7 * 24 * 3600 * 1000;
  const pedidos = [];

  linhas.forEach(function (l) {
    const id = String(l[COL.CODIGO - 1] || '').trim();
    if (!id) return;                                   // linhas de antes dos códigos
    const quando = l[0] instanceof Date ? l[0] : new Date(l[0]);
    if (isNaN(quando.getTime()) || quando.getTime() < corte) return;

    var itens = [];
    try { itens = JSON.parse(l[COL.DETALHE - 1]); } catch (e) {}
    if (!Array.isArray(itens)) itens = [];

    const status = String(l[COL.STATUS - 1]);
    const origem = String(l[COL.ORIGEM - 1]);
    pedidos.push({
      id: id,
      ts: quando.toISOString(),
      status: STATUS_VALIDOS.indexOf(status) >= 0 ? status : 'novo',
      origem: ORIGENS_VALIDAS.indexOf(origem) >= 0 ? origem : 'site',
      entrega: String(l[COL.ENTREGA - 1]) === 'retirada' ? 'retirada' : 'entrega',
      bairro: String(l[COL.BAIRRO - 1] || ''),
      pagamento: String(l[COL.PAGAMENTO - 1] || ''),
      total: Number(l[COL.TOTAL - 1]) || 0,
      cliente: String(l[COL.CLIENTE - 1] || ''),
      telefone: String(l[COL.TELEFONE - 1] || ''),
      obs: String(l[COL.OBS - 1] || ''),
      itens: itens,
      texto: String(l[COL.ITENS - 1] || ''),
    });
  });

  pedidos.sort(function (a, b) { return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0; });
  return { ok: true, pedidos: pedidos };
}

function mudaStatus_(d) {
  const id = typeof d.id === 'string' ? d.id.toUpperCase() : '';
  if (!/^[A-Z0-9]{4,8}$/.test(id)) throw new ErroUsuario('Código de pedido inválido.');
  if (STATUS_VALIDOS.indexOf(d.status) < 0) throw new ErroUsuario('Status inválido.');

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_PEDIDOS);
    if (!aba || aba.getLastRow() < 2) throw new ErroUsuario('Pedido não encontrado.');

    // procura de baixo para cima: o pedido que se mexe é quase sempre dos últimos
    const ultima = aba.getLastRow();
    const n = Math.min(ultima - 1, 800);
    const ini = ultima - n + 1;
    const codigos = aba.getRange(ini, COL.CODIGO, n, 1).getValues();
    let linha = 0;
    for (let i = codigos.length - 1; i >= 0; i--) {
      if (String(codigos[i][0]).trim() === id) { linha = ini + i; break; }
    }
    if (!linha) throw new ErroUsuario('Pedido não encontrado (talvez seja muito antigo).');

    aba.getRange(linha, COL.STATUS).setValue(d.status);
    return { ok: true, id: id, status: d.status };
  } finally {
    lock.releaseLock();
  }
}

/** Pedido que NÃO veio pelo site (WhatsApp, telefone, balcão…), digitado pela dona. */
function novoPedidoManual_(d) {
  const itens = limpaItens_(d.itens);
  if (!itens.length) throw new ErroUsuario('Adicione pelo menos um item ao pedido.');

  const origem = String(d.origem || '');
  if (ORIGENS_VALIDAS.indexOf(origem) <= 0) throw new ErroUsuario('Escolha como o pedido foi feito.');   // 0 = 'site'
  const pagamento = String(d.pagamento || '');
  if (PAGAMENTOS.indexOf(pagamento) < 0) throw new ErroUsuario('Escolha a forma de pagamento.');
  const entrega = d.entrega === 'retirada' ? 'retirada' : 'entrega';

  let quando = d.quando ? new Date(d.quando) : new Date();
  if (isNaN(quando.getTime())) throw new ErroUsuario('Data e hora inválidas.');
  const agora = Date.now();
  if (quando.getTime() > agora + 24 * 3600 * 1000) throw new ErroUsuario('A data do pedido está no futuro.');
  if (quando.getTime() < agora - 31 * 24 * 3600 * 1000) throw new ErroUsuario('A data do pedido é muito antiga (máximo 31 dias).');

  const telefone = limpaTelefone_(d.telefone);
  if (String(d.telefone || '').trim() && !telefone) throw new ErroUsuario('Telefone inválido (use DDD + número).');

  const id = gravaPedido_({
    quando: quando,
    telefone: telefone,
    bairro: texto_(d.bairro, 80, 'Bairro', false),
    pagamento: pagamento,
    total: dinheiro_(d.total, 10000, 'Total'),
    itens: itens,
    id: '',
    status: 'confirmado',        // quem digita já combinou o pedido
    origem: origem,
    entrega: entrega,
    cliente: limpaNome_(texto_(d.cliente, 60, 'Cliente', false)),
    obs: texto_(d.obs, 200, 'Observação', false),
  });
  return { ok: true, id: id };
}

/* ------------------------------------------------------------------ */
/*  Relatórios e clientes                                             */
/* ------------------------------------------------------------------ */

/**
 * Pedidos já "abertos" (data/dia da semana/hora no fuso da planilha, itens em objeto).
 * Lê só as últimas `maxLinhas` linhas e, se `desdeMs`, ignora o que for mais antigo.
 */
function lerPedidosRecentes_(maxLinhas, desdeMs) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(ABA_PEDIDOS);
  if (!aba || aba.getLastRow() < 2) return [];

  const ultima = aba.getLastRow();
  const n = Math.min(ultima - 1, maxLinhas);
  const linhas = aba.getRange(ultima - n + 1, 1, n, CABECALHO_PEDIDOS.length).getValues();
  const tz = ss.getSpreadsheetTimeZone();
  const saida = [];

  linhas.forEach(function (l) {
    const quando = l[0] instanceof Date ? l[0] : new Date(l[0]);
    if (isNaN(quando.getTime())) return;
    if (desdeMs && quando.getTime() < desdeMs) return;

    const partes = Utilities.formatDate(quando, tz, 'yyyy-MM-dd|u|H').split('|');
    var itens = [];
    try { itens = JSON.parse(l[COL.DETALHE - 1]); } catch (e) {}
    if (!Array.isArray(itens)) itens = [];
    const status = String(l[COL.STATUS - 1]);

    saida.push({
      quando: quando.getTime(),
      dia: partes[0],
      diaSemana: Number(partes[1]) % 7,            // 'u': 1=segunda … 7=domingo → 0=domingo … 6=sábado
      hora: Number(partes[2]),
      status: STATUS_VALIDOS.indexOf(status) >= 0 ? status : 'novo',
      origem: ORIGENS_VALIDAS.indexOf(String(l[COL.ORIGEM - 1])) >= 0 ? String(l[COL.ORIGEM - 1]) : 'site',
      entrega: String(l[COL.ENTREGA - 1]) === 'retirada' ? 'retirada' : 'entrega',
      bairro: String(l[COL.BAIRRO - 1] || '').trim(),
      pagamento: String(l[COL.PAGAMENTO - 1] || '').trim(),
      total: Number(l[COL.TOTAL - 1]) || 0,
      cliente: String(l[COL.CLIENTE - 1] || '').trim(),
      telefone: String(l[COL.TELEFONE - 1] || '').trim(),
      itens: itens,
    });
  });
  return saida;
}

/** Pedido cancelado nunca conta; com `soConfirmados`, só confirmado/entregue. */
function contaPedido_(p, soConfirmados) {
  if (p.status === 'cancelado') return false;
  return !soConfirmados || p.status === 'confirmado' || p.status === 'entregue';
}

function dataIso_(v, campo) {
  const s = String(v || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || isNaN(Date.parse(s + 'T12:00:00Z'))) {
    throw new ErroUsuario('Data inválida em "' + campo + '".');
  }
  return s;
}

function diasEntre_(de, ate) {
  const out = [];
  const fim = Date.parse(ate + 'T12:00:00Z');
  for (var t = Date.parse(de + 'T12:00:00Z'); t <= fim; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

function maisFrequente_(mapa) {
  var melhor = '', max = 0;
  Object.keys(mapa).forEach(function (k) { if (mapa[k] > max) { max = mapa[k]; melhor = k; } });
  return melhor;
}

function lista_(mapa, limite) {
  return Object.keys(mapa)
    .map(function (k) { return { nome: k, qtd: mapa[k] }; })
    .sort(function (a, b) { return b.qtd - a.qtd || (a.nome < b.nome ? -1 : 1); })
    .slice(0, limite);
}

/** Sabores de um item (meio a meio conta para os dois). Bebida não entra. */
function saboresDoItem_(it) {
  if (!it || it.tipo === 'bebida') return [];
  return it.meio ? [it.sabor, it.meio] : [it.sabor];
}

/** Números e gráficos de um período: sabores, dias, horários, pagamentos e consumo de ingredientes. */
function relatorio_(d) {
  const de = dataIso_(d.de, 'De'), ate = dataIso_(d.ate, 'Até');
  if (de > ate) throw new ErroUsuario('A data inicial vem depois da final.');
  const dias = diasEntre_(de, ate);
  if (dias.length > 93) throw new ErroUsuario('Escolha um período de até 3 meses.');
  const soConf = d.soConfirmados === true;

  // margem de 36 h para o fuso: o filtro exato é feito pelo dia no fuso da planilha
  const desde = Date.parse(de + 'T00:00:00Z') - 36 * 3600 * 1000;
  const pedidos = lerPedidosRecentes_(5000, desde).filter(function (p) {
    return p.dia >= de && p.dia <= ate && contaPedido_(p, soConf);
  });

  const rec = receitasIndexadas_();
  const acc = novoConsumo_();
  const sabores = {}, bebidas = {}, bordas = {}, pagamentos = {}, origens = {}, bairros = {};
  const porDia = {}, porSemana = [], porHora = [];
  dias.forEach(function (x) { porDia[x] = { dia: x, pedidos: 0, faturamento: 0 }; });
  for (var i = 0; i < 7; i++) porSemana.push({ dia: i, pedidos: 0, faturamento: 0 });
  for (var h = 0; h < 24; h++) porHora.push({ hora: h, pedidos: 0 });
  var faturamento = 0, entregas = 0, retiradas = 0;

  pedidos.forEach(function (p) {
    faturamento += p.total;
    porDia[p.dia].pedidos++;           porDia[p.dia].faturamento += p.total;
    porSemana[p.diaSemana].pedidos++;  porSemana[p.diaSemana].faturamento += p.total;
    porHora[p.hora].pedidos++;
    if (p.entrega === 'retirada') retiradas++; else { entregas++; if (p.bairro) somar_(bairros, p.bairro, 1); }
    if (p.pagamento) somar_(pagamentos, p.pagamento, 1);
    somar_(origens, p.origem, 1);
    p.itens.forEach(function (it) {
      const q = it.qtd || 1;
      consumoDoItem_(it, rec, acc);
      if (it.tipo === 'bebida') somar_(bebidas, it.sabor, q);
      saboresDoItem_(it).forEach(function (s) { somar_(sabores, s, q); });
      if (it.borda) somar_(bordas, it.borda, q);
    });
  });

  const cons = fechaConsumo_(acc, insumosIndexados_());
  const arred = function (n) { return Math.round(n * 100) / 100; };
  return {
    ok: true, de: de, ate: ate, soConfirmados: soConf,
    pedidos: pedidos.length,
    faturamento: arred(faturamento),
    ticketMedio: pedidos.length ? arred(faturamento / pedidos.length) : 0,
    entregas: entregas, retiradas: retiradas,
    sabores: lista_(sabores, 12),
    bebidas: lista_(bebidas, 6),
    bordas: lista_(bordas, 6),
    pagamentos: lista_(pagamentos, 6),
    origens: lista_(origens, 6),
    bairros: lista_(bairros, 6),
    porDia: dias.map(function (x) { return { dia: x, pedidos: porDia[x].pedidos, faturamento: arred(porDia[x].faturamento) }; }),
    porDiaSemana: porSemana.map(function (x) { return { dia: x.dia, pedidos: x.pedidos, faturamento: arred(x.faturamento) }; }),
    porHora: porHora,
    consumo: { itens: cons.itens, custoTotal: cons.custoTotal, faltas: cons.faltas, semPreco: cons.semPreco, receitasSalvas: rec.existe },
  };
}

/** Histórico de cada cliente identificado (telefone, ou nome quando não há telefone). */
function clientes_() {
  const pedidos = lerPedidosRecentes_(4000, 0).filter(function (p) { return contaPedido_(p, false); });
  const mapa = {};
  var semIdentificacao = 0;

  pedidos.forEach(function (p) {
    const chave = p.telefone ? 't' + p.telefone : (p.cliente ? 'n' + norm_(p.cliente) : '');
    if (!chave) { semIdentificacao++; return; }
    const c = mapa[chave] || (mapa[chave] = {
      chave: chave, nome: '', telefone: p.telefone, ultimoTs: 0, pedidos: 0, gasto: 0,
      dias: {}, sabores: {}, semana: [0, 0, 0, 0, 0, 0, 0], pagamentos: {}, bairros: {},
    });
    c.pedidos++;
    c.gasto += p.total;
    c.dias[p.dia] = true;
    c.semana[p.diaSemana]++;
    if (p.pagamento) somar_(c.pagamentos, p.pagamento, 1);
    if (p.entrega === 'entrega' && p.bairro) somar_(c.bairros, p.bairro, 1);
    if (p.cliente && p.quando >= c.ultimoTs) c.nome = p.cliente;   // nome mais recente
    if (p.quando >= c.ultimoTs) c.ultimoTs = p.quando;
    p.itens.forEach(function (it) {
      saboresDoItem_(it).forEach(function (s) { somar_(c.sabores, s, it.qtd || 1); });
    });
  });

  const lista = Object.keys(mapa).map(function (k) {
    const c = mapa[k];
    const dias = Object.keys(c.dias).sort();
    var intervalo = null;
    if (dias.length >= 2) {
      intervalo = Math.round((Date.parse(dias[dias.length - 1] + 'T12:00:00Z') - Date.parse(dias[0] + 'T12:00:00Z')) / 86400000 / (dias.length - 1));
    }
    return {
      chave: c.chave, nome: c.nome, telefone: c.telefone,
      pedidos: c.pedidos, gasto: Math.round(c.gasto * 100) / 100,
      ticketMedio: Math.round(c.gasto / c.pedidos * 100) / 100,
      primeiro: dias[0], ultimo: dias[dias.length - 1], intervaloDias: intervalo,
      sabores: lista_(c.sabores, 8), semana: c.semana,
      pagamento: maisFrequente_(c.pagamentos), bairro: maisFrequente_(c.bairros),
    };
  }).sort(function (a, b) { return b.pedidos - a.pedidos || (a.ultimo < b.ultimo ? 1 : -1); });

  return { ok: true, clientes: lista.slice(0, 400), total: lista.length, semIdentificacao: semIdentificacao };
}

