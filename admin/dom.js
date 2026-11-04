/** Atalhos de DOM do painel. Tudo é montado com createElement/textContent — nada vira HTML. */
export const $ = (s, r = document) => r.querySelector(s);

/** Cria elemento: h("div", {class:"x", onclick:fn}, "texto", outroNo) */
export function h(tag, props = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v == null) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  filhos.flat().forEach((c) => {
    if (c === false || c == null) return;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  });
  return el;
}
