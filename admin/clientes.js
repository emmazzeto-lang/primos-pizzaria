/**
 * Aba "Clientes": o histórico de consumo de cada cliente (sabores que mais pede, dia da
 * semana, forma de pagamento, de quanto em quanto tempo volta).
 *
 * Os dados vêm do Apps Script (ação "clientes"), agrupados pelo telefone que o cliente
 * digitou no pedido (ou pelo nome, se o pedido foi digitado sem telefone). Só quem tem a
 * senha do painel vê isto. Tudo é montado com createElement/textContent.
 */
import { brl } from "../src/lib/format.js";
import { h } from "./dom.js";
import { DIAS_CURTOS, DIAS_PLURAL, diasDesde, fmtTelefone, textoDias } from "./formatos.js";
import { barras, colunas, kpi } from "./graficos.js";

const ORDENS = [
  ["pedidos", "Mais pedidos"],
  ["recentes", "Mais recentes"],
  ["gasto", "Quem mais gastou"],
];

const semAcento = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function criarClientes(ctx) {
  const raiz = document.querySelector("#p-clientes");
  let dados = null;
  let erro = "";
  let carregando = false;
  let busca = "";
  let ordem = "pedidos";
  let aberto = ""; // chave do cliente com os detalhes abertos
  let pedido = 0;

  const topo = h("div", { class: "bloco" });
  const lista = h("div", { class: "peds" });
  const campoBusca = h("input", {
    type: "search", id: "cli-busca", placeholder: "Buscar por nome ou telefone", "aria-label": "Buscar cliente",
    oninput: (e) => { busca = e.target.value; pintaLista(); },
  });

  const nomeDe = (c) => c.nome || (c.telefone ? fmtTelefone(c.telefone) : "Sem nome");
  const diaFavorito = (c) => {
    const max = Math.max(...c.semana);
    return max > 0 ? c.semana.indexOf(max) : -1;
  };

  function frase(c) {
    const partes = [];
    const dia = diaFavorito(c);
    const masc = dia === 0 || dia === 6; // domingo e sábado são masculinos
    if (c.pedidos >= 2 && dia >= 0) partes.push(`costuma pedir ${masc ? "aos" : "às"} ${DIAS_PLURAL[dia]}`);
    else if (dia >= 0) partes.push(`pediu ${masc ? "num" : "numa"} ${DIAS_PLURAL[dia].replace(/s$/, "")}`);
    if (c.sabores[0]) partes.push(`sabor preferido: ${c.sabores[0].nome}`);
    if (c.intervaloDias) partes.push(`volta a cada ~${c.intervaloDias} dias`);
    return partes.join(" · ");
  }

  function detalhe(c) {
    const links = c.telefone
      ? h("a", { class: "btn btn--ghost btn--sm", href: `https://wa.me/55${c.telefone}`, target: "_blank", rel: "noopener" }, "Abrir conversa no WhatsApp")
      : false;
    return h("div", { class: "cli__det" },
      h("div", { class: "kpis" },
        kpi("Pedidos", String(c.pedidos), c.primeiro === c.ultimo ? "" : "desde " + c.primeiro.split("-").reverse().join("/")),
        kpi("Gasto total", brl(c.gasto)),
        kpi("Ticket médio", brl(c.ticketMedio)),
        kpi("Volta a cada", c.intervaloDias ? `${c.intervaloDias} dias` : "—", c.intervaloDias ? "em média" : "poucos pedidos")
      ),
      h("h3", { class: "sub-h" }, "Sabores que mais pede"),
      barras(c.sabores.map((s) => ({ rotulo: s.nome, valor: s.qtd })), { vazio: "Só bebidas até agora." }),
      h("h3", { class: "sub-h" }, "Dias da semana"),
      colunas(c.semana.map((n, i) => ({ rotulo: DIAS_CURTOS[i], valor: n, titulo: `${DIAS_CURTOS[i]}: ${n} pedido(s)` }))),
      h("p", { class: "muted" },
        [c.pagamento && `Costuma pagar com ${c.pagamento}`, c.bairro && `bairro ${c.bairro}`].filter(Boolean).join(" · ")),
      links
    );
  }

  function cartao(c) {
    const aberto_ = aberto === c.chave;
    const id = "cli-" + c.chave.replace(/[^a-z0-9]/gi, "");
    return h("article", { class: "ped cli" + (aberto_ ? " cli--aberto" : "") },
      h("button", {
        type: "button", class: "cli__cab", "aria-expanded": String(aberto_), "aria-controls": id,
        onclick: () => { aberto = aberto_ ? "" : c.chave; pintaLista(); },
      },
        h("span", { class: "cli__nome" }, nomeDe(c)),
        h("span", { class: "cli__tel" }, c.nome && c.telefone ? fmtTelefone(c.telefone) : ""),
        h("span", { class: "cli__nums" }, `${c.pedidos} ${c.pedidos === 1 ? "pedido" : "pedidos"} · ${brl(c.gasto)}`),
        h("span", { class: "cli__frase" }, frase(c)),
        h("span", { class: "cli__ult" }, `Último pedido ${textoDias(diasDesde(c.ultimo))}`)
      ),
      h("div", { id, hidden: !aberto_ }, aberto_ ? detalhe(c) : false)
    );
  }

  function filtrados() {
    const q = semAcento(busca).trim();
    const so = q.replace(/\D/g, "");
    let l = dados.clientes.filter((c) =>
      !q || semAcento(c.nome).includes(q) || (so.length >= 3 && c.telefone.includes(so)));
    const por = {
      pedidos: (a, b) => b.pedidos - a.pedidos || (a.ultimo < b.ultimo ? 1 : -1),
      recentes: (a, b) => (a.ultimo < b.ultimo ? 1 : a.ultimo > b.ultimo ? -1 : b.pedidos - a.pedidos),
      gasto: (a, b) => b.gasto - a.gasto,
    }[ordem];
    l = [...l].sort(por);
    return l;
  }

  function pintaLista() {
    if (erro) return lista.replaceChildren(h("p", { class: "erro bloco", role: "alert" }, erro));
    if (!dados) return lista.replaceChildren(h("p", { class: "vazio card-vazio" }, carregando ? "Carregando…" : ""));
    if (!dados.clientes.length) {
      return lista.replaceChildren(h("p", { class: "vazio card-vazio" },
        "Ainda não há clientes identificados. A partir dos próximos pedidos feitos pelo site (e dos que você digitar com nome ou telefone), o histórico de cada um aparece aqui."));
    }
    const itens = filtrados();
    if (!itens.length) return lista.replaceChildren(h("p", { class: "vazio card-vazio" }, "Ninguém encontrado com essa busca."));
    const nos = itens.slice(0, 100).map(cartao);
    if (itens.length > 100) nos.push(h("p", { class: "muted" }, `Mostrando 100 de ${itens.length}. Use a busca para achar os outros.`));
    lista.replaceChildren(...nos);
  }

  function pintaTopo() {
    topo.replaceChildren(
      h("h2", {}, "Clientes"),
      h("p", { class: "muted" },
        dados
          ? `${dados.total} cliente${dados.total === 1 ? "" : "s"} identificado${dados.total === 1 ? "" : "s"}` +
            (dados.semIdentificacao ? ` · ${dados.semIdentificacao} pedido${dados.semIdentificacao === 1 ? "" : "s"} antigo${dados.semIdentificacao === 1 ? "" : "s"} sem nome nem telefone` : "")
          : "Quem pede, o que pede e quando. Pedidos cancelados não contam."),
      campoBusca,
      h("div", { class: "seg", role: "group", "aria-label": "Ordenar por" },
        ORDENS.map(([v, t]) => h("button", { type: "button", "aria-pressed": String(ordem === v), onclick: () => { ordem = v; pintaTopo(); pintaLista(); } }, t))),
      h("button", { type: "button", class: "link", onclick: () => buscar() }, "Atualizar")
    );
  }

  async function buscar() {
    const meu = ++pedido;
    carregando = true; erro = ""; pintaLista();
    try {
      const r = await ctx.api("clientes");
      if (meu !== pedido) return;
      dados = r;
    } catch (e) {
      if (meu !== pedido) return;
      if (e.sessao) return ctx.sessaoExpirou();
      erro = e.message;
    }
    carregando = false;
    pintaTopo();
    pintaLista();
  }

  raiz.append(topo, lista);
  pintaTopo();

  return {
    aoAbrir() { buscar(); },
    reset() { dados = null; erro = ""; aberto = ""; busca = ""; campoBusca.value = ""; pedido++; carregando = false; pintaTopo(); lista.replaceChildren(); },
  };
}
