/** Promoções que dependem do dia da semana (ex.: calabresa de quinta). */
import { CONFIG } from "./config.js";

/** Promoção ativa hoje, ou null. */
export function promoDoDia(now = new Date()) {
  return CONFIG.promos.find((p) => p.dia === now.getDay()) || null;
}

/**
 * Preço de um sabor levando a promoção em conta.
 * Só aplica em sabor único (não em meio a meio).
 */
export function precoComPromo(saborId, tamanho, precoNormal, now = new Date()) {
  const p = promoDoDia(now);
  if (p && p.sabor === saborId && p.tamanho === tamanho) return p.preco;
  return precoNormal;
}
