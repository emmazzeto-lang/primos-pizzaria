/** Monta o cardápio na tela a partir de menu-data.js. */
import { $ } from "./lib/dom.js";
import { brlS, cap } from "./lib/format.js";
import {
  PIZZAS,
  TIERS,
  ACOMPANHA,
  BORDA,
  CALZONE,
  BROTO_PRECO,
  ADICIONAIS,
  BEBIDAS,
} from "./menu-data.js";
import { openBuilder } from "./builder.js";
import { addBebida } from "./store.js";

function priceRange(list) {
  const min = Math.min(...list.map((p) => p.preco));
  const max = Math.max(...list.map((p) => p.preco));
  return min === max ? brlS(min) : `${brlS(min)}–${max}`;
}

function tierHead(label, right) {
  return `<div class="tier"><span class="tier__label">${label}</span><span class="tier__price">${right}</span></div>`;
}

function flavButton({ id, nome, desc, preco, tipo }) {
  const b = document.createElement("button");
  b.className = "flav";
  b.type = "button";
  b.innerHTML =
    `<span class="flav__name">${nome}</span>` +
    `<span class="flav__desc">${desc}</span>` +
    `<span class="flav__price">${brlS(preco)}</span>` +
    `<span class="flav__add">montar →</span>`;
  b.addEventListener("click", () => openBuilder(tipo, id));
  return b;
}

export function renderMenu() {
  const wrap = $("#menu");
  wrap.innerHTML = "";

  // ---- pizzas salgadas, por faixa de preço
  TIERS.forEach((tier) => {
    const grupo = PIZZAS.filter((p) => !p.doce && tier.teste(p));
    if (!grupo.length) return;
    const list = document.createElement("div");
    list.className = "list";
    list.innerHTML = tierHead(tier.label, priceRange(grupo));
    grupo.forEach((p) =>
      list.appendChild(
        flavButton({
          id: p.id,
          nome: p.nome,
          desc: cap(p.ing.join(", ")),
          preco: p.preco,
          tipo: "pizza",
        })
      )
    );
    wrap.appendChild(list);
  });

  // ---- pizzas doces
  const doces = PIZZAS.filter((p) => p.doce);
  if (doces.length) {
    const list = document.createElement("div");
    list.className = "list";
    list.innerHTML = tierHead("Doces", priceRange(doces));
    doces.forEach((p) =>
      list.appendChild(
        flavButton({
          id: p.id,
          nome: p.nome,
          desc: cap(p.ing.join(", ")),
          preco: p.preco,
          tipo: "pizza",
        })
      )
    );
    wrap.appendChild(list);
  }

  // ---- calzone
  const extra = document.createElement("div");
  extra.className = "list";
  extra.innerHTML = tierHead("Mais opções", brlS(CALZONE.preco));
  extra.appendChild(
    flavButton({
      id: null,
      nome: CALZONE.nome,
      desc: "Massa fechada, qualquer sabor",
      preco: CALZONE.preco,
      tipo: "calzone",
    })
  );
  wrap.appendChild(extra);

  // ---- bebidas
  if (BEBIDAS.length) {
    const list = document.createElement("div");
    list.className = "list";
    list.innerHTML = tierHead("Bebidas", "");
    BEBIDAS.forEach((bev) => {
      const row = document.createElement("div");
      row.className = "drink";
      row.innerHTML =
        `<span class="drink__name">${bev.nome}</span>` +
        `<span class="drink__price">${brlS(bev.preco)}</span>`;
      const add = document.createElement("button");
      add.type = "button";
      add.className = "drink__add";
      add.textContent = "Adicionar";
      add.addEventListener("click", () => addBebida(bev));
      row.appendChild(add);
      list.appendChild(row);
    });
    wrap.appendChild(list);
  }

  $("#cardFoot").innerHTML =
    `Broto (${brlS(BROTO_PRECO)}) ou grande, qualquer sabor. ` +
    `Todas acompanham ${ACOMPANHA.join(" e ")}.<br>` +
    `Borda recheada + ${brlS(BORDA.preco)} (só na grande). ` +
    `Adicionais + ${brlS(ADICIONAIS.preco)} cada.<br>` +
    `Meio a meio (só salgadas): vale o preço do sabor mais caro.`;
}
