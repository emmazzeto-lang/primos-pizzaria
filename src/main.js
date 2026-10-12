/**
 * Ponto de entrada: liga os eventos da página e inicia tudo.
 * Este é o único arquivo carregado pelo index.html.
 */
import { $, $$ } from "./lib/dom.js";
import { CONFIG } from "./config.js";
import { on } from "./lib/bus.js";
import { renderMenu } from "./menu-view.js";
import { openOrder, renderOrder, initOrder } from "./order.js";
import { paintStatus, paintCart } from "./ui.js";
import { initRemote } from "./remote.js";

/* Abrir o pedido pelos dois botões */
$("#openCart").addEventListener("click", openOrder);
$("#barBtn").addEventListener("click", openOrder);

/* Fechar diálogos: no "✕" e no clique fora da folha */
$$("[data-close]").forEach((b) =>
  b.addEventListener("click", (e) => e.target.closest("dialog").close())
);
$$("dialog").forEach((dlg) =>
  dlg.addEventListener("click", (e) => {
    const r = dlg.getBoundingClientRect();
    const fora =
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom;
    if (fora) dlg.close();
  })
);

/* Sempre que o carrinho muda: repinta e atualiza o pedido se estiver aberto */
on("cart:changed", () => {
  paintCart();
  if ($("#order").open) renderOrder();
});

/* Ajustes do painel chegaram (ou mudaram): redesenha cardápio, preços e status */
on("remote:changed", () => {
  renderMenu();
  paintCart();
});

/* Rodapé */
$("#footWa").href = "https://wa.me/" + CONFIG.whatsapp;
const ig = $("#footIg");
ig.href = "https://instagram.com/" + CONFIG.instagram;
ig.textContent = "@" + CONFIG.instagram;

/* Início — primeiro aplica o último ajuste guardado, depois desenha */
initRemote();
renderMenu();
initOrder();
paintCart(); // já chama paintStatus()
setInterval(paintStatus, 60_000);
