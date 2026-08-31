/** Repinta o cabeçalho, o hero, a barra fixa e o aviso de promoção. */
import { $ } from "./lib/dom.js";
import { brl } from "./lib/format.js";
import { CONFIG } from "./config.js";
import { cartCount, cartTotal } from "./store.js";
import { lojaStatus } from "./shop-status.js";
import { promoDoDia } from "./promos.js";

/** Cabeçalho + hero: aberto/fechado; trava o botão de enviar fora do horário. */
export function paintStatus() {
  const { aberta, quando } = lojaStatus();

  const pill = $("#statusPill");
  pill.className = "pill " + (aberta ? "pill--open" : "pill--closed");
  $("#statusPillText").textContent = aberta ? "Aberto agora" : "Fechado";

  $("#hero").classList.toggle("is-closed", !aberta);
  $("#heroStatus").innerHTML = aberta
    ? `<b>Aberto agora</b> — entrega em ${CONFIG.entregaMin}–${CONFIG.entregaMax} min`
    : `Fechado agora — abrimos <b>${quando}</b>`;

  const warn = $("#closedWarn");
  warn.hidden = aberta;
  if (!aberta) {
    warn.textContent =
      `A pizzaria está fechada agora (abrimos ${quando}). Você pode montar o pedido e ` +
      `copiar o texto — o envio pelo botão volta a funcionar no horário de atendimento.`;
  }

  const promo = promoDoDia();
  const banner = $("#promoBanner");
  if (banner) {
    banner.hidden = !promo;
    if (promo) banner.textContent = promo.texto;
  }

  const send = $("#sendBtn");
  if (send) {
    send.disabled = !aberta || cartCount() === 0;
    $("#sendLabel").textContent = aberta
      ? "Enviar pedido no WhatsApp"
      : "Fora do horário de atendimento";
  }
}

/** Contador do topo + barra fixa "ver meu pedido". */
export function paintCart() {
  const n = cartCount();
  $("#cartCount").textContent = n;
  $("#openCart").hidden = n === 0;

  $("#bar").classList.toggle("is-on", n > 0);
  $("#barLabel").textContent =
    n === 1 ? "Ver meu pedido · 1 item" : `Ver meu pedido · ${n} itens`;
  $("#barPrice").textContent = brl(cartTotal());

  paintStatus();
}
