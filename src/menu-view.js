/** Monta o cardápio na tela a partir de menu-data.js. */
import { $ } from "./lib/dom.js";
import { brlS, cap } from "./lib/format.js";
import { PIZZAS, TIERS, ACOMPANHA, BORDA, MINI, CALZONE } from "./menu-data.js";
import { openBuilder } from "./builder.js";

function priceRange(list) {
  const min = Math.min(...list.map((p) => p.preco));
  const max = Math.max(...list.map((p) => p.preco));
  return min === max ? brlS(min) : `${brlS(min)}–${max}`;
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

  TIERS.forEach((tier) => {
    const grupo = PIZZAS.filter(tier.teste);
    if (!grupo.length) return;

    const list = document.createElement("div");
    list.className = "list";
    list.innerHTML =
      `<div class="tier"><span class="tier__label">${tier.label}</span>` +
      `<span class="tier__price">${priceRange(grupo)}</span></div>`;
    grupo.forEach((p) =>
      list.appendChild(
        flavButton({
          id: p.id,
          nome: p.nome,
          desc: cap(p.ing.join(", ")),
          preco: p.preco,
          tipo: "grande",
        })
      )
    );
    wrap.appendChild(list);
  });

  const extra = document.createElement("div");
  extra.className = "list";
  extra.innerHTML =
    `<div class="tier"><span class="tier__label">Mais opções</span>` +
    `<span class="tier__price">${brlS(MINI.preco)} · ${brlS(CALZONE.preco)}</span></div>`;
  extra.appendChild(
    flavButton({
      id: null,
      nome: MINI.nome,
      desc: "Qualquer sabor, versão individual",
      preco: MINI.preco,
      tipo: "mini",
    })
  );
  extra.appendChild(
    flavButton({
      id: null,
      nome: CALZONE.nome,
      desc: "Qualquer sabor, massa fechada",
      preco: CALZONE.preco,
      tipo: "calzone",
    })
  );
  wrap.appendChild(extra);

  $("#cardFoot").innerHTML =
    `Todas as pizzas grandes acompanham ${ACOMPANHA.join(" e ")}.<br>` +
    `Borda recheada + ${brlS(BORDA.preco)} — ${BORDA.opcoes.join(", ").toLowerCase()}.<br>` +
    `Meio a meio: vale o preço do sabor mais caro.`;
}
