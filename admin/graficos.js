/**
 * Gráficos simples do painel, montados só com elementos de DOM (sem biblioteca, sem HTML solto).
 *
 * Regras de leitura: uma cor só (a brasa); o destaque é o item que lidera, os demais ficam
 * mais apagados; todo valor aparece escrito (não depende de cor nem de passar o mouse).
 */
import { h } from "./dom.js";

/** Cartão com um número grande: kpi("Pedidos", "12", "sem os cancelados") */
export function kpi(rotulo, valor, sub = "") {
  return h("div", { class: "kpi" },
    h("span", { class: "kpi__rotulo" }, rotulo),
    h("b", { class: "kpi__valor" }, valor),
    sub ? h("span", { class: "kpi__sub" }, sub) : false
  );
}

/**
 * Barras horizontais, uma por linha. linhas: [{ rotulo, valor, texto? }]
 * O maior valor é o destaque. `texto` é o que aparece à direita (padrão: o próprio valor).
 */
export function barras(linhas, { vazio = "Sem dados neste período." } = {}) {
  if (!linhas.length) return h("p", { class: "vazio" }, vazio);
  const max = Math.max(...linhas.map((l) => l.valor), 1);
  return h("ul", { class: "barras" },
    linhas.map((l) =>
      h("li", { class: "barra" + (l.valor === max && l.valor > 0 ? " barra--top" : "") },
        h("span", { class: "barra__nome", title: l.rotulo }, l.rotulo),
        h("span", { class: "barra__trilho", "aria-hidden": "true" },
          h("span", { class: "barra__fill", style: `width:${Math.max((l.valor / max) * 100, l.valor > 0 ? 2 : 0).toFixed(1)}%` })
        ),
        h("span", { class: "barra__valor" }, l.texto ?? String(l.valor))
      )
    )
  );
}

/**
 * Colunas verticais. pontos: [{ rotulo, valor, titulo? }]
 * `mostrarValor`: escreve o número acima de cada coluna (use com poucas colunas).
 * `rotuloACada`: mostra o rótulo só a cada N colunas (para muitas colunas).
 */
export function colunas(pontos, { mostrarValor = true, rotuloACada = 1, vazio = "Sem dados neste período." } = {}) {
  if (!pontos.length || pontos.every((p) => p.valor === 0)) return h("p", { class: "vazio" }, vazio);
  const max = Math.max(...pontos.map((p) => p.valor), 1);
  return h("div", { class: "colunas", role: "list" },
    pontos.map((p, i) =>
      h("div", { class: "coluna" + (p.valor === max ? " coluna--top" : ""), role: "listitem", title: p.titulo || `${p.rotulo}: ${p.valor}` },
        h("span", { class: "coluna__valor" }, mostrarValor && p.valor > 0 ? String(p.valor) : " "),
        h("span", { class: "coluna__barra-box" },
          h("span", { class: "coluna__barra", style: `height:${p.valor > 0 ? Math.max((p.valor / max) * 100, 3).toFixed(1) : 0}%` })
        ),
        h("span", { class: "coluna__rotulo" }, i % rotuloACada === 0 ? p.rotulo : " ")
      )
    )
  );
}
