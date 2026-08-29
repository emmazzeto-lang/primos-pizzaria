/**
 * Event bus minúsculo. Deixa os módulos conversarem
 * ("o carrinho mudou") sem depender uns dos outros em círculo.
 */
const listeners = new Map();

export function on(type, fn) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
}

export function emit(type, detail) {
  (listeners.get(type) || []).forEach((fn) => fn(detail));
}
