/**
 * Estado do app:
 *   - carrinho (dura só a visita — sessionStorage)
 *   - dados do cliente (ficam no aparelho — localStorage)
 */
import { PIZZAS } from "./menu-data.js";
import { emit } from "./lib/bus.js";

export const pizzaById = (id) => PIZZAS.find((p) => p.id === id);

/* ------------------------------------------------------------------ */
/*  Carrinho                                                          */
/* ------------------------------------------------------------------ */
const CART_KEY = "primos.cart";

export const cart = [];
try {
  JSON.parse(sessionStorage.getItem(CART_KEY) || "[]").forEach((it) => cart.push(it));
} catch (e) {
  /* começa vazio */
}

function persist() {
  try {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch (e) {
    /* modo privado pode bloquear — tudo bem */
  }
  emit("cart:changed");
}

export function addItem(item) {
  cart.push(item);
  persist();
}

export function replaceItem(index, item) {
  cart[index] = item;
  persist();
}

export function removeItem(index) {
  cart.splice(index, 1);
  persist();
}

export function setQty(index, qtd) {
  if (qtd < 1) return removeItem(index);
  cart[index] = { ...cart[index], qtd };
  persist();
}

/** Bebida: se já estiver no carrinho, soma 1; senão adiciona. */
export function addBebida(bebida) {
  const i = cart.findIndex((it) => it.tipo === "bebida" && it.id === bebida.id);
  if (i >= 0) cart[i] = { ...cart[i], qtd: cart[i].qtd + 1 };
  else
    cart.push({
      tipo: "bebida",
      tipoLabel: "Bebida",
      id: bebida.id,
      nome: bebida.nome,
      qtd: 1,
      precoUnit: bebida.preco,
    });
  persist();
}

export const cartTotal = () => cart.reduce((s, it) => s + it.precoUnit * it.qtd, 0);
export const cartCount = () => cart.reduce((s, it) => s + it.qtd, 0);

/* ------------------------------------------------------------------ */
/*  Dados do cliente                                                  */
/* ------------------------------------------------------------------ */
const CLI_KEY = "primos.cliente";

export function loadCliente() {
  try {
    return JSON.parse(localStorage.getItem(CLI_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

export function saveCliente(d) {
  try {
    localStorage.setItem(
      CLI_KEY,
      JSON.stringify({
        nome: d.nome,
        telefone: d.telefone,
        rua: d.rua,
        numero: d.numero,
        bairro: d.bairro,
        complemento: d.complemento,
        referencia: d.referencia,
      })
    );
  } catch (e) {
    /* ignora */
  }
}

export function forgetCliente() {
  try {
    localStorage.removeItem(CLI_KEY);
  } catch (e) {
    /* ignora */
  }
}
