/** Repinta o cabeçalho, o hero, a barra fixa e o aviso de promoção. */
import { $ } from "./lib/dom.js";
import { brl, fmtHora } from "./lib/format.js";
import { CONFIG } from "./config.js";
import { cartCount, cartTotal } from "./store.js";
import { lojaStatus, formatDias } from "./shop-status.js";
import { promosDoDia, promoTexto } from "./promos.js";

/** Cabeçalho + hero: aberto/fechado; trava o botão de enviar fora do horário. */
export function paintStatus() {
  const { aberta, quando, aviso } = lojaStatus();

  const pill = $("#statusPill");
  pill.className = "pill " + (aberta ? "pill--open" : "pill--closed");
  $("#statusPillText").textContent = aberta ? "Aberto agora" : "Fechado";

  $("#hero").classList.toggle("is-closed", !aberta);
  $("#heroStatus").innerHTML = aberta
    ? `<b>Aberto agora</b> — entrega em ${CONFIG.entregaMin}–${CONFIG.entregaMax} min`
    : `Fechado agora${quando ? ` — abrimos <b>${quando}</b>` : ""}`;

  const warn = $("#closedWarn");
  warn.hidden = aberta;
  if (!aberta) {
    warn.textContent =
      (aviso ? `${aviso} ` : "") +
      `A pizzaria está fechada agora${quando ? ` (abrimos ${quando})` : ""}. ` +
      `Você pode montar o pedido e copiar o texto — o envio pelo botão volta a funcionar quando abrirmos.`;
  }

  const promos = promosDoDia();
  const banner = $("#promoBanner");
  if (banner) {
    banner.hidden = !promos.length;
    banner.textContent = promos.map(promoTexto).join("  ·  ");
  }

  const horario = $("#footHorario");
  if (horario) {
    horario.textContent =
      `Pizzaria Primos · ${formatDias(CONFIG.diasAbre)}, ` +
      `${fmtHora(CONFIG.abreHora)}–${fmtHora(CONFIG.fechaHora)}`;
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
