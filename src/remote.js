/**
 * Ajustes feitos no painel (/admin): horário, abrir/fechar, preços e promoções.
 *
 * O site já nasce com valores padrão (config.js e menu-data.js). Aqui buscamos na
 * planilha o que a dona mudou e sobrescrevemos em cima — se a planilha não
 * responder, o site continua funcionando com o último valor guardado (ou o padrão).
 *
 * Nada que vem da planilha é confiado às cegas: cada valor é validado e só
 * entram números, datas e textos curtos (textos são mostrados com textContent).
 */
import { CONFIG } from "./config.js";
import { PIZZAS } from "./menu-data.js";
import { listaPrecos } from "./price-keys.js";
import { emit } from "./lib/bus.js";

const CACHE_KEY = "primos.remote";
const CACHE_MAX_MS = 7 * 24 * 3600 * 1000;
const REFRESH_MS = 5 * 60 * 1000;
const MIN_ENTRE_BUSCAS_MS = 30 * 1000;
const TIMEOUT_MS = 6000;

/* Foto dos valores padrão, tirada antes de qualquer ajuste */
const PADRAO = {
  diasAbre: [...CONFIG.diasAbre],
  abreHora: CONFIG.abreHora,
  fechaHora: CONFIG.fechaHora,
  modo: CONFIG.modo,
  ate: CONFIG.ate,
  aviso: CONFIG.aviso,
  promos: CONFIG.promos.map((p) => ({ ...p })),
  precos: Object.fromEntries(listaPrecos().map((i) => [i.chave, i.get()])),
};

const num = (v, max) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
const ids = new Set(PIZZAS.map((p) => p.id));

function promoValida(p) {
  return (
    p &&
    Number.isInteger(p.dia) && p.dia >= -1 && p.dia <= 6 &&
    ids.has(p.sabor) &&
    (p.tamanho === "grande" || p.tamanho === "broto") &&
    num(p.preco, 1000)
  );
}

let ultimaAssinatura = "";

/** Valida `data` (resposta da planilha) e aplica por cima dos valores padrão. */
export function applyRemote(data, { silent = false } = {}) {
  // 1) volta ao padrão
  CONFIG.diasAbre = [...PADRAO.diasAbre];
  CONFIG.abreHora = PADRAO.abreHora;
  CONFIG.fechaHora = PADRAO.fechaHora;
  CONFIG.modo = PADRAO.modo;
  CONFIG.ate = PADRAO.ate;
  CONFIG.aviso = PADRAO.aviso;
  CONFIG.promos = PADRAO.promos.map((p) => ({ ...p }));
  const itens = listaPrecos();
  itens.forEach((i) => i.set(PADRAO.precos[i.chave]));

  // 2) aplica o que veio, já validado
  const c = data && typeof data.config === "object" ? data.config : null;
  if (c) {
    if (["auto", "aberto", "fechado"].includes(c.modo)) CONFIG.modo = c.modo;
    if (typeof c.ate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.ate)) CONFIG.ate = c.ate;
    if (typeof c.aviso === "string") CONFIG.aviso = c.aviso.slice(0, 120);
    if (Array.isArray(c.diasAbre)) {
      CONFIG.diasAbre = [...new Set(c.diasAbre.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
    }
    if (num(c.abreHora, 24) && num(c.fechaHora, 24) && c.abreHora < c.fechaHora) {
      CONFIG.abreHora = c.abreHora;
      CONFIG.fechaHora = c.fechaHora;
    }
  }

  const precos = data && typeof data.precos === "object" && data.precos ? data.precos : {};
  itens.forEach((i) => {
    if (num(precos[i.chave], 1000)) i.set(precos[i.chave]);
  });

  if (data && Array.isArray(data.promos)) {
    CONFIG.promos = data.promos.filter(promoValida).map((p) => ({
      dia: p.dia,
      sabor: p.sabor,
      tamanho: p.tamanho,
      preco: p.preco,
      texto: typeof p.texto === "string" ? p.texto.slice(0, 120) : "",
    }));
  }

  // 3) avisa a página só se algo mudou de verdade
  const assinatura = JSON.stringify([
    CONFIG.diasAbre, CONFIG.abreHora, CONFIG.fechaHora, CONFIG.modo, CONFIG.ate,
    CONFIG.aviso, CONFIG.promos, itens.map((i) => i.get()),
  ]);
  const mudou = assinatura !== ultimaAssinatura;
  ultimaAssinatura = assinatura;
  if (mudou && !silent) emit("remote:changed");
}

function lerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    return c && Date.now() - c.t < CACHE_MAX_MS ? c.data : null;
  } catch (e) {
    return null;
  }
}

let ultimaBusca = 0;

async function buscar() {
  if (Date.now() - ultimaBusca < MIN_ENTRE_BUSCAS_MS) return;
  ultimaBusca = Date.now();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    // "t" só existe para o navegador não reaproveitar uma resposta antiga
    // (sem cabeçalhos extras, para o pedido continuar "simples" e dispensar preflight)
    const res = await fetch(`${CONFIG.estoque}?action=config&t=${Date.now()}`, {
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!data || data.ok !== true) return;
    applyRemote(data);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
    } catch (e) {
      /* modo privado — tudo bem */
    }
  } catch (e) {
    /* sem rede ou planilha fora do ar: segue com o que já tem */
  } finally {
    clearTimeout(timer);
  }
}

/** Chamar uma vez, ANTES do primeiro desenho da página. */
export function initRemote() {
  if (!CONFIG.estoque) return;

  const guardado = lerCache();
  if (guardado) applyRemote(guardado, { silent: true });

  buscar();
  setInterval(buscar, REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) buscar();
  });
}
