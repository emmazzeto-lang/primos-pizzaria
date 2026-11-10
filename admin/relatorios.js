/**
 * Aba "Relatórios": o que vendeu, quando, e quanto de cada ingrediente foi gasto.
 *
 * Os números vêm prontos do Apps Script (ação "relatorio"), que usa as mesmas contas do
 * resumo do fim da noite. Aqui só se desenha. Tudo com createElement/textContent.
 */
import { brl, cap } from "../src/lib/format.js";
import { ymd } from "../src/shop-status.js";
import { h } from "./dom.js";
import { DIAS_CURTOS, diaCurto, fmtQtd, somaDias } from "./formatos.js";
import { barras, colunas, kpi } from "./graficos.js";

const PERIODOS = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7", "7 dias"],
  ["30", "30 dias"],
  ["outro", "Escolher datas"],
];

export function criarRelatorios(ctx) {
  const raiz = document.querySelector("#p-relatorios");
  let periodo = "hoje";
  let de = ymd(new Date());
  let ate = de;
  let soConf = false;
  let dados = null;
  let erro = "";
  let carregando = false;
  let pedido = 0; // descarta respostas atrasadas

  const conteudo = h("div", { class: "rel" });
  const barra = h("div", { class: "bloco rel-barra" });

  function intervalo() {
    const hoje = ymd(new Date());
    if (periodo === "hoje") return [hoje, hoje];
    if (periodo === "ontem") return [somaDias(hoje, -1), somaDias(hoje, -1)];
    if (periodo === "7") return [somaDias(hoje, -6), hoje];
    if (periodo === "30") return [somaDias(hoje, -29), hoje];
    return [de, ate];
  }

  const rotuloPeriodo = () => ({
    hoje: "hoje", ontem: "ontem", 7: "nos últimos 7 dias", 30: "nos últimos 30 dias", outro: "no período",
  })[periodo];

  function desenhaBarra() {
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Período" },
      PERIODOS.map(([v, t]) =>
        h("button", { type: "button", "aria-pressed": String(periodo === v), onclick: () => { periodo = v; desenhaBarra(); if (v !== "outro") buscar(); } }, t)
      )
    );
    const datas = periodo === "outro"
      ? h("div", { class: "duas" },
          h("div", { class: "field" }, h("label", { for: "rel-de" }, "De"),
            h("input", { id: "rel-de", type: "date", value: de, max: ymd(new Date()), oninput: (e) => { de = e.target.value; } })),
          h("div", { class: "field" }, h("label", { for: "rel-ate" }, "Até"),
            h("input", { id: "rel-ate", type: "date", value: ate, max: ymd(new Date()), oninput: (e) => { ate = e.target.value; } }))
        )
      : false;
    const aplicar = periodo === "outro"
      ? h("button", { type: "button", class: "btn btn--sm", onclick: () => buscar() }, "Ver este período")
      : false;
    barra.replaceChildren(
      ...[
        seg, datas, aplicar,
        h("label", { class: "pick" },
          h("input", { type: "checkbox", checked: soConf, onchange: (e) => { soConf = e.target.checked; buscar(); } }),
          "Contar só pedidos confirmados"
        ),
        h("button", { type: "button", class: "link", onclick: () => buscar() }, "Atualizar"),
      ].filter(Boolean) // replaceChildren nativo escreveria "false" na tela
    );
  }

  async function buscar() {
    const [d1, d2] = intervalo();
    if (!d1 || !d2) { erro = "Escolha as duas datas."; return desenha(); }
    if (d1 > d2) { erro = "A data inicial vem depois da final."; return desenha(); }
    const meu = ++pedido;
    carregando = true; erro = ""; desenha();
    try {
      const r = await ctx.api("relatorio", { de: d1, ate: d2, soConfirmados: soConf });
      if (meu !== pedido) return;
      dados = r;
    } catch (e) {
      if (meu !== pedido) return;
      if (e.sessao) return ctx.sessaoExpirou();
      erro = e.message;
    }
    carregando = false;
    desenha();
  }

  /* ---------------- pedaços da tela ---------------- */
  const bloco = (titulo, ...filhos) => h("section", { class: "bloco" }, h("h2", {}, titulo), ...filhos);

  function destaque(d) {
    if (!d.sabores.length) return h("div", { class: "rel-top rel-top--vazio" }, `Nenhum pedido ${rotuloPeriodo()}.`);
    const max = d.sabores[0].qtd;
    const lideres = d.sabores.filter((s) => s.qtd === max).map((s) => s.nome);
    return h("div", { class: "rel-top" },
      h("span", { class: "rel-top__rotulo" }, lideres.length > 1 ? `Sabores mais pedidos ${rotuloPeriodo()} (empate)` : `Sabor mais pedido ${rotuloPeriodo()}`),
      h("b", { class: "rel-top__nome" }, lideres.join(" e ")),
      h("span", { class: "rel-top__qtd" }, `${max} ${max === 1 ? "pedido" : "pedidos"}`)
    );
  }

  function porHora(d) {
    const com = d.porHora.filter((x) => x.pedidos > 0).map((x) => x.hora);
    if (!com.length) return colunas([]);
    const ini = Math.min(...com, 18), fim = Math.max(...com, 22);
    const pontos = d.porHora.filter((x) => x.hora >= ini && x.hora <= fim)
      .map((x) => ({ rotulo: `${x.hora}h`, valor: x.pedidos, titulo: `${x.hora}h: ${x.pedidos} pedido(s)` }));
    return colunas(pontos);
  }

  function porDia(d) {
    const muitos = d.porDia.length > 14;
    return colunas(
      d.porDia.map((x) => ({ rotulo: diaCurto(x.dia), valor: x.pedidos, titulo: `${diaCurto(x.dia)}: ${x.pedidos} pedido(s), ${brl(x.faturamento)}` })),
      { mostrarValor: !muitos, rotuloACada: muitos ? 5 : 1 }
    );
  }

  function consumo(d) {
    const c = d.consumo;
    const avisos = [];
    if (!c.receitasSalvas) avisos.push("As receitas ainda não foram salvas. Abra a aba Receitas, confira as quantidades e clique em Salvar alterações.");
    else if (c.faltas.length) avisos.push(`Falta a quantidade de: ${c.faltas.map(cap).join(", ")}. Esses itens não entraram na conta (aba Receitas).`);
    if (c.semPreco.length) avisos.push(`Sem preço utilizável na aba Insumos (use o mesmo nome e a unidade kg, g ou un): ${c.semPreco.map(cap).join(", ")}.`);

    const tabela = c.itens.length
      ? h("table", { class: "tab-cons" },
          h("thead", {}, h("tr", {}, h("th", {}, "Ingrediente"), h("th", { class: "num" }, "Usado"), h("th", { class: "num" }, "Custo"))),
          h("tbody", {}, c.itens.map((x) =>
            h("tr", {}, h("td", {}, x.nome.charAt(0).toUpperCase() + x.nome.slice(1)), h("td", { class: "num" }, fmtQtd(x.qtd, x.un)),
              h("td", { class: "num" }, x.custo === null ? "—" : brl(x.custo))))),
          h("tfoot", {}, h("tr", {}, h("td", { colspan: "2" }, "Custo dos ingredientes calculados"), h("td", { class: "num" }, brl(c.custoTotal))))
        )
      : h("p", { class: "vazio" }, c.receitasSalvas ? "Nenhum ingrediente calculado neste período." : "Sem receitas, não há como calcular.");

    return bloco("Ingredientes usados", tabela,
      avisos.map((a) => h("p", { class: "rel-aviso" }, a)),
      h("p", { class: "muted" }, "A conta usa as receitas e desconta o que o cliente pediu para tirar. Pedidos cancelados não entram.")
    );
  }

  function desenhaDados(d) {
    const custoOk = d.consumo.receitasSalvas && d.consumo.itens.some((x) => x.custo !== null);
    const sobra = d.faturamento - d.consumo.custoTotal;
    const partes = [
      h("div", { class: "kpis" },
        kpi("Pedidos", String(d.pedidos), `${d.entregas} entrega${d.entregas === 1 ? "" : "s"} · ${d.retiradas} retirada${d.retiradas === 1 ? "" : "s"}`),
        kpi("Faturamento", brl(d.faturamento)),
        kpi("Ticket médio", d.pedidos ? brl(d.ticketMedio) : "—", "por pedido"),
        kpi("Ingredientes", custoOk ? brl(d.consumo.custoTotal) : "—", custoOk
          ? (d.consumo.semPreco.length || d.consumo.faltas.length ? "conta incompleta (veja abaixo)" : `sobra ${brl(sobra)}`)
          : d.consumo.receitasSalvas ? "cadastre os preços em Insumos" : "cadastre as receitas")
      ),
      destaque(d),
      bloco("Sabores mais pedidos",
        barras(d.sabores.slice(0, 10).map((s) => ({ rotulo: s.nome, valor: s.qtd, texto: String(s.qtd) }))),
        h("p", { class: "muted" }, "Meio a meio conta para os dois sabores. Bebidas não entram aqui.")
      ),
    ];

    if (d.porDia.length > 1) partes.push(bloco("Pedidos por dia", porDia(d)));
    partes.push(bloco("Horários mais movimentados", porHora(d)));
    if (d.porDia.length > 1) {
      partes.push(bloco("Dias da semana",
        colunas(d.porDiaSemana.map((x) => ({ rotulo: DIAS_CURTOS[x.dia], valor: x.pedidos, titulo: `${DIAS_CURTOS[x.dia]}: ${x.pedidos} pedido(s), ${brl(x.faturamento)}` })))));
    }
    const extras = [];
    if (d.pagamentos.length) extras.push(h("div", {}, h("h3", { class: "sub-h" }, "Pagamento"), barras(d.pagamentos.map((x) => ({ rotulo: x.nome, valor: x.qtd })))));
    if (d.bairros.length) extras.push(h("div", {}, h("h3", { class: "sub-h" }, "Bairros"), barras(d.bairros.map((x) => ({ rotulo: x.nome, valor: x.qtd })))));
    if (d.bebidas.length) extras.push(h("div", {}, h("h3", { class: "sub-h" }, "Bebidas"), barras(d.bebidas.map((x) => ({ rotulo: x.nome, valor: x.qtd })))));
    if (d.bordas.length) extras.push(h("div", {}, h("h3", { class: "sub-h" }, "Bordas recheadas"), barras(d.bordas.map((x) => ({ rotulo: x.nome, valor: x.qtd })))));
    if (extras.length) partes.push(bloco("Outros números", h("div", { class: "rel-extras" }, extras)));
    partes.push(consumo(d));
    return partes;
  }

  function desenha() {
    if (carregando && !dados) return conteudo.replaceChildren(h("p", { class: "vazio card-vazio" }, "Carregando…"));
    if (erro) return conteudo.replaceChildren(h("p", { class: "erro bloco", role: "alert" }, erro));
    if (!dados) return conteudo.replaceChildren();
    conteudo.classList.toggle("rel--atualizando", carregando);
    conteudo.replaceChildren(...desenhaDados(dados));
  }

  raiz.append(barra, conteudo);
  desenhaBarra();

  return {
    /** Chamado quando a aba é aberta: carrega na primeira vez e atualiza nas seguintes. */
    aoAbrir() { buscar(); },
    reset() { dados = null; erro = ""; pedido++; carregando = false; conteudo.replaceChildren(); },
  };
}
