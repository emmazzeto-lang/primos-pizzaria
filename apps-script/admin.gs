/**
 * PIZZARIA PRIMOS — painel admin (servidor)
 * ----------------------------------------------------------------
 * Guarda os ajustes que a dona faz em /admin (horário, abrir/fechar, preços,
 * promoções e preço dos insumos) em abas da própria planilha e entrega ao site.
 *
 *   GET  ?action=config      → ajustes PÚBLICOS (o site lê ao abrir). Sem insumos.
 *   POST {action:"login"}    → confere a senha, devolve um token de sessão (6 h).
 *   POST {action:"get"|"save"|"logout", token} → só com token válido.
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
