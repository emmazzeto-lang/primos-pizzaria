/** Promoções que dependem do dia da semana (ex.: calabresa de quinta). */
import { CONFIG } from "./config.js";
import { PIZZAS } from "./menu-data.js";

/** Promoções valendo hoje (dia -1 = todos os dias). */
export function promosDoDia(now = new Date()) {
  return CONFIG.promos.filter((p) => p.dia === -1 || p.dia === now.getDay());
}

/** Texto do aviso; se a promoção não tiver um, monta um. */
export function promoTexto(p) {
  if (p.texto) return p.texto;
  const sabor = PIZZAS.find((x) => x.id === p.sabor)?.nome || p.sabor;
  return `Promoção: ${sabor} ${p.tamanho} por R$ ${String(p.preco).replace(".", ",")}`;
}

/**
 * Preço de um sabor levando a promoção em conta.
 * Só vale para sabor único (não para meio a meio) e nunca sobe o preço.
 */
export function precoComPromo(saborId, tamanho, precoNormal, now = new Date()) {
  const precos = promosDoDia(now)
    .filter((p) => p.sabor === saborId && p.tamanho === tamanho)
    .map((p) => p.preco);
  return Math.min(precoNormal, ...precos);
}
