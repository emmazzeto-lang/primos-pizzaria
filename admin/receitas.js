/**
 * Aba "Receitas": quanto de cada ingrediente vai em uma pizza grande.
 *
 * Com isso o painel e a planilha calculam o que foi gasto em cada dia:
 *   - sabor único: a receita do sabor; meio a meio: metade de cada;
 *   - broto e calzone: uma proporção da grande (campo "Tamanhos");
 *   - "sem cebola": tira a cebola daquela metade;
 *   - adicional: a mesma quantidade do ingrediente na pizza;
 *   - borda recheada: quantidade própria.
 *
 * Existe um valor PADRÃO por ingrediente e, se um sabor usa outra quantidade, uma EXCEÇÃO
 * naquele sabor. O que ficar em branco não é inventado: o relatório avisa que falta.
 */
import { PIZZAS, BORDA, ADICIONAIS } from "../src/menu-data.js";
import { cap } from "../src/lib/format.js";
import { h } from "./dom.js";
import { PADRAO_INICIAL, EXCECOES_INICIAIS, FATORES_INICIAIS, UNIDADE_PADRAO } from "./receitas-padrao.js";

const RASTREADO = ["azeitona"]; // acompanha toda pizza salgada e entra na conta (orégano é tempero: fora)
const chave = (s) => String(s).trim().toLowerCase();

/** Todos os ingredientes do cardápio (pizzas + adicionais + azeitona), sem repetir. */
export function ingredientesDoCardapio() {
  const set = new Set();
  PIZZAS.forEach((p) => p.ing.forEach((i) => set.add(chave(i))));
  ADICIONAIS.opcoes.forEach((o) => set.add(chave(o).replace(/ extra$/, "")));
  RASTREADO.forEach((i) => set.add(i));
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

const ingredientesDoSabor = (p) => [...p.ing.map(chave), ...(p.doce ? [] : RASTREADO)];
const qtdVazia = (k) => ({ qtd: null, un: UNIDADE_PADRAO[k] || "g" });

/** Monta o estado da aba a partir do que o servidor devolveu (ou das quantidades iniciais). */
export function montarReceitas(s) {
  const universo = ingredientesDoCardapio();
  const r = { padrao: {}, fatores: {}, bordas: {}, excecoes: {}, semente: false };

  if (!s || !s.existe) {
    r.semente = true;
    universo.forEach((k) => {
      const p = PADRAO_INICIAL[k];
      r.padrao[k] = p ? { qtd: p[0], un: p[1] } : qtdVazia(k);
    });
    r.fatores = { ...FATORES_INICIAIS };
    BORDA.opcoes.forEach((o) => (r.bordas[o] = { qtd: null, un: "g" }));
    Object.entries(EXCECOES_INICIAIS).forEach(([sabor, m]) => (r.excecoes[sabor] = { ...m }));
    return r;
  }

  universo.forEach((k) => (r.padrao[k] = qtdVazia(k)));
  (s.padrao || []).forEach((x) => {
    const k = chave(x.ing);
    if (r.padrao[k]) r.padrao[k] = { qtd: x.qtd, un: x.un === "un" ? "un" : "g" };
  });
  const f = s.fatores || {};
  r.fatores = {
    broto: Number.isFinite(f.broto) ? f.broto : FATORES_INICIAIS.broto,
    calzone: Number.isFinite(f.calzone) ? f.calzone : FATORES_INICIAIS.calzone,
  };
  BORDA.opcoes.forEach((o) => {
    const x = (s.bordas || []).find((b) => chave(b.nome) === chave(o));
    r.bordas[o] = x ? { qtd: x.qtd, un: x.un === "un" ? "un" : "g" } : { qtd: null, un: "g" };
  });
  (s.sabores || []).forEach((sab) =>
    sab.itens.forEach((i) => {
      if (!i.excecao || !Number.isFinite(i.qtd)) return;
      if (!r.excecoes[sab.nome]) r.excecoes[sab.nome] = {};
      r.excecoes[sab.nome][chave(i.ing)] = i.qtd;
    })
  );
  return r;
}

/** Nomes (para mostrar) do que ainda está sem quantidade. */
export function faltas(r) {
  const f = Object.entries(r.padrao).filter(([, v]) => v.qtd === null).map(([k]) => cap(k));
  BORDA.opcoes.forEach((o) => {
    if (r.bordas[o].qtd === null) f.push(`borda ${o.toLowerCase()}`);
  });
  return f;
}

/** Formato que o Apps Script espera. Lança Error com mensagem clara se algo estiver inválido. */
export function receitasParaEnvio(r) {
  const qtd = (v, nome) => {
    if (v === null) return null;
    if (!Number.isFinite(v) || v < 0 || v > 5000) throw new Error(`Confira a quantidade de “${nome}” na aba Receitas.`);
    return v;
  };
  for (const k of ["broto", "calzone"]) {
    const v = r.fatores[k];
    if (!Number.isFinite(v) || v < 0.05 || v > 5) throw new Error(`Confira a proporção de “${k}” na aba Receitas (entre 5% e 500%).`);
  }
  const universo = ingredientesDoCardapio();
  return {
    padrao: universo.map((k) => ({ ing: k, qtd: qtd(r.padrao[k].qtd, cap(k)), un: r.padrao[k].un })),
    fatores: { broto: r.fatores.broto, calzone: r.fatores.calzone },
    bordas: BORDA.opcoes.map((o) => ({ nome: o, qtd: qtd(r.bordas[o].qtd, `borda ${o}`), un: r.bordas[o].un })),
    sabores: PIZZAS.map((p) => ({
      nome: p.nome,
      itens: ingredientesDoSabor(p).map((k) => {
        const ex = r.excecoes[p.nome] && r.excecoes[p.nome][k];
        const temEx = ex !== undefined;
        return {
          ing: k,
          qtd: temEx ? qtd(ex, `${p.nome} — ${cap(k)}`) : qtd(r.padrao[k].qtd, cap(k)),
          un: r.padrao[k].un,
          excecao: temEx,
        };
      }),
    })),
  };
}

/* ------------------------------------------------------------------ */
/*  Tela                                                              */
/* ------------------------------------------------------------------ */
const txt = (v) => (v === null || v === undefined ? "" : Number.isFinite(v) ? String(v).replace(".", ",") : "");
const lerNumero = (s) => {
  const t = String(s).trim().replace(",", ".");
  return t === "" ? null : Number(t);
};
const fmtPadrao = (v) => (v.qtd === null ? "sem quantidade" : `${txt(v.qtd)} ${v.un}`);

export function abaReceitas(painel, r, marcarSujo) {
  painel.replaceChildren();
  const dicas = []; // { el, k } — "padrão: 200 g" nas exceções, atualizado quando o padrão muda
  const resumos = []; // { el, sabor } — "(2 diferentes)"

  const status = h("div", { role: "status" });
  const pintaStatus = () => {
    const f = faltas(r);
    status.className = "rec-status " + (f.length ? "rec-status--falta" : "rec-status--ok");
    status.replaceChildren(
      ...(f.length
        ? [h("b", {}, `Faltam ${f.length} quantidade${f.length > 1 ? "s" : ""}: `), f.join(", "),
           h("br"), "Enquanto estiver em branco, o ingrediente fica de fora das contas e o relatório avisa."]
        : ["Todas as quantidades estão preenchidas."])
    );
  };
  const pintaDicas = () => {
    dicas.forEach(({ el, input, k }) => {
      el.textContent = `padrão ${fmtPadrao(r.padrao[k])}`;
      input.placeholder = r.padrao[k].qtd === null ? "—" : txt(r.padrao[k].qtd);
    });
  };
  const pintaResumos = () => {
    resumos.forEach(({ el, sabor }) => {
      const n = Object.keys(r.excecoes[sabor] || {}).length;
      el.textContent = n ? ` · ${n} diferente${n > 1 ? "s" : ""} do padrão` : "";
    });
  };

  /* ---- 1. padrão por ingrediente */
  const bloco1 = h("div", { class: "bloco" },
    h("h2", {}, "Quantidade por ingrediente"),
    h("p", { class: "muted" }, "Quanto vai em UMA pizza grande. O adicional usa a mesma quantidade. Se um sabor leva outra quantidade, ajuste mais abaixo, em “Exceções por sabor”."),
    status
  );
  if (r.semente) {
    bloco1.prepend(
      h("div", { class: "rec-aviso" },
        h("b", {}, "Valores iniciais. "),
        "Preenchi com as quantidades que a pizzaria informou. Foram deduzidos: azeitona = 20 un na grande (10 no broto), broto = 50% e calzone = 100% de uma grande, e o catupiry do Caipira = 100 g. ",
        "Confira, complete o que estiver em branco e clique em ",
        h("b", {}, "Salvar alterações"), "."
      )
    );
  }
  bloco1.append(h("div", { class: "rec-cab" }, h("span", {}, "Ingrediente"), h("span", {}, "Quantidade"), h("span", {}, "Unidade")));
  ingredientesDoCardapio().forEach((k) => {
    const v = r.padrao[k];
    const input = h("input", {
      type: "text", inputmode: "decimal", value: txt(v.qtd), placeholder: "—", "aria-label": `Quantidade de ${cap(k)}`,
      class: v.qtd === null ? "falta" : "",
      oninput: (e) => {
        v.qtd = lerNumero(e.target.value);
        e.target.setAttribute("aria-invalid", String(v.qtd !== null && !(Number.isFinite(v.qtd) && v.qtd >= 0)));
        e.target.classList.toggle("falta", v.qtd === null);
        marcarSujo(); pintaStatus(); pintaDicas();
      },
    });
    const un = h("select", { "aria-label": `Unidade de ${cap(k)}`, onchange: (e) => { v.un = e.target.value; marcarSujo(); pintaDicas(); } },
      ["g", "un"].map((u) => h("option", { value: u, selected: u === v.un }, u)));
    bloco1.append(h("div", { class: "rec-linha" }, h("span", { class: "linha__nome" }, cap(k)), input, un));
  });

  /* ---- 2. tamanhos */
  const pct = (k, rotulo, dica) => {
    const input = h("input", {
      type: "text", inputmode: "decimal", value: String(Math.round(r.fatores[k] * 1000) / 10).replace(".", ","),
      "aria-label": rotulo,
      oninput: (e) => {
        const n = lerNumero(e.target.value);
        r.fatores[k] = n === null ? NaN : n / 100;
        e.target.setAttribute("aria-invalid", String(!(r.fatores[k] >= 0.05 && r.fatores[k] <= 5)));
        marcarSujo();
      },
    });
    return h("div", { class: "field" }, h("label", {}, rotulo), h("div", { class: "pct" }, input, h("span", {}, "%")), h("p", { class: "muted" }, dica));
  };
  const bloco2 = h("div", { class: "bloco" },
    h("h2", {}, "Tamanhos"),
    h("p", { class: "muted" }, "Quanto cada tamanho usa em relação à pizza grande, de cada ingrediente."),
    h("div", { class: "duas" },
      pct("broto", "Broto usa", "Calabresa broto: 80 g de calabresa contra 160 g na grande = 50%."),
      pct("calzone", "Calzone usa", "Não informado: começa em 100%. Ajuste se o calzone leva menos.")
    )
  );

  /* ---- 3. borda recheada */
  const bloco3 = h("div", { class: "bloco" },
    h("h2", {}, "Borda recheada"),
    h("p", { class: "muted" }, "Quanto de recheio vai na borda de uma pizza grande. Entra na conta do próprio ingrediente (ex.: borda de catupiry soma no catupiry).")
  );
  BORDA.opcoes.forEach((o) => {
    const v = r.bordas[o];
    bloco3.append(h("div", { class: "rec-linha" },
      h("span", { class: "linha__nome" }, o),
      h("input", {
        type: "text", inputmode: "decimal", value: txt(v.qtd), placeholder: "—", "aria-label": `Quantidade da borda de ${o}`,
        class: v.qtd === null ? "falta" : "",
        oninput: (e) => {
          v.qtd = lerNumero(e.target.value);
          e.target.setAttribute("aria-invalid", String(v.qtd !== null && !(Number.isFinite(v.qtd) && v.qtd >= 0)));
          e.target.classList.toggle("falta", v.qtd === null);
          marcarSujo(); pintaStatus();
        },
      }),
      h("span", { class: "rec-un" }, "g")
    ));
  });

  /* ---- 4. exceções por sabor */
  const bloco4 = h("div", { class: "bloco" },
    h("h2", {}, "Exceções por sabor"),
    h("p", { class: "muted" }, "Só preencha onde o sabor usa uma quantidade diferente do padrão. Em branco = usa o padrão.")
  );
  PIZZAS.forEach((p) => {
    const resumoEl = h("span", { class: "muted" });
    resumos.push({ el: resumoEl, sabor: p.nome });
    const det = h("details", { class: "adic" }, h("summary", {}, p.nome, resumoEl));
    ingredientesDoSabor(p).forEach((k) => {
      const dica = h("span", { class: "linha__padrao" });
      const input = h("input", {
        type: "text", inputmode: "decimal", "aria-label": `${p.nome}: quantidade de ${cap(k)}`,
        value: txt(r.excecoes[p.nome] && r.excecoes[p.nome][k]),
        oninput: (e) => {
          const n = lerNumero(e.target.value);
          if (n === null) {
            if (r.excecoes[p.nome]) delete r.excecoes[p.nome][k];
          } else {
            if (!r.excecoes[p.nome]) r.excecoes[p.nome] = {};
            r.excecoes[p.nome][k] = n;
          }
          e.target.setAttribute("aria-invalid", String(n !== null && !(Number.isFinite(n) && n >= 0)));
          marcarSujo(); pintaResumos();
        },
      });
      dicas.push({ el: dica, input, k });
      det.append(h("div", { class: "rec-linha rec-linha--ex" }, h("span", { class: "linha__nome" }, cap(k)), dica, input));
    });
    bloco4.append(det);
  });

  painel.append(bloco1, bloco2, bloco3, bloco4);
  pintaStatus();
  pintaDicas();
  pintaResumos();
}
