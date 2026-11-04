/**
 * Painel da pizzaria (/admin).
 * Fala com o Apps Script (CONFIG.estoque): entra com a senha, lê os ajustes,
 * mostra as abas (Pedidos, Funcionamento, Preços, Promoções, Insumos) e grava
 * os ajustes de volta na planilha.
 *
 * A tela é montada com createElement/textContent — nenhum dado da planilha
 * é inserido como HTML.
 */
import { CONFIG } from "../src/config.js";
import { PIZZAS } from "../src/menu-data.js";
import { listaPrecos } from "../src/price-keys.js";
import { lojaStatus, NOMES_DIA, ymd } from "../src/shop-status.js";
import { $, h } from "./dom.js";
import { criarPedidos } from "./pedidos.js";

const TOKEN_KEY = "primos.admin.token";
const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const UNIDADES = ["kg", "g", "L", "ml", "un", "pct", "cx", "lata"];
const PRECOS_PADRAO = Object.fromEntries(listaPrecos().map((i) => [i.chave, i.get()]));

/* ------------------------------------------------------------------ */
/*  Conversas com o servidor                                          */
/* ------------------------------------------------------------------ */
let token = sessionStorage.getItem(TOKEN_KEY) || "";

async function api(action, extra = {}) {
  let res;
  try {
    res = await fetch(CONFIG.estoque, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, ...extra }),
    });
  } catch (e) {
    throw new Error("Não consegui falar com a planilha. Confira a internet e se o Apps Script foi reimplantado com a versão nova.");
  }
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("A planilha respondeu algo inesperado. O Apps Script já foi reimplantado com a versão nova?");
  }
  if (!data || data.ok !== true) {
    const erro = new Error((data && data.erro) || "Algo deu errado.");
    erro.sessao = /Sessão expirada/.test(erro.message);
    throw erro;
  }
  return data;
}

/* ------------------------------------------------------------------ */
/*  Estado                                                            */
/* ------------------------------------------------------------------ */
let estado = null; // { config, precos, promos, insumos }
let sujo = false;

const num = (txt) => {
  const s = String(txt).trim().replace(",", ".");
  return s === "" ? NaN : Number(s);
};
const dinheiroTxt = (n) => (Number.isFinite(n) ? String(n).replace(".", ",") : "");
const horaParaInput = (hh) =>
  `${String(Math.floor(hh)).padStart(2, "0")}:${String(Math.round((hh % 1) * 60)).padStart(2, "0")}`;
const inputParaHora = (v) => {
  const [a, b] = v.split(":").map(Number);
  return a + (b || 0) / 60;
};

function montarEstado(d) {
  const c = d.config || {};
  estado = {
    config: {
      modo: c.modo ?? CONFIG.modo,
      ate: c.ate ?? CONFIG.ate,
      aviso: c.aviso ?? CONFIG.aviso,
      diasAbre: [...(c.diasAbre ?? CONFIG.diasAbre)],
      abreHora: c.abreHora ?? CONFIG.abreHora,
      fechaHora: c.fechaHora ?? CONFIG.fechaHora,
    },
    precos: { ...PRECOS_PADRAO, ...(d.precos || {}) },
    // a planilha ainda sem promoções => começa com as do código
    promos: (d.promos ?? CONFIG.promos).map((p) => ({ dia: p.dia, sabor: p.sabor, tamanho: p.tamanho, preco: p.preco, texto: p.texto || "" })),
    insumos: (d.insumos || []).map((i) => ({ ...i })),
  };
  sujo = false;
}

function marcarSujo() {
  sujo = true;
  $(".savebar").classList.add("sujo");
  $("#saveMsg").textContent = "Alterações não salvas";
  $("#salvar").disabled = false;
}

function marcarSalvo() {
  sujo = false;
  $(".savebar").classList.remove("sujo");
  const agora = new Date();
  $("#saveMsg").textContent = `Salvo às ${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
  $("#salvar").disabled = true;
}

let toastTimer;
function aviso(msg, erro = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (erro ? " erro" : "");
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), erro ? 7000 : 3500);
}

/* ------------------------------------------------------------------ */
/*  Aba: Funcionamento                                                */
/* ------------------------------------------------------------------ */
function abaFuncionamento() {
  const c = estado.config;
  const painel = $("#p-func");
  painel.replaceChildren();

  const statusTxt = h("span");
  const status = h("div", { class: "status" }, h("span", { class: "status__dot" }), statusTxt);
  const atualizaStatus = () => {
    const r = lojaStatus(new Date(), c);
    status.classList.toggle("on", r.aberta);
    statusTxt.textContent = r.aberta
      ? "Agora o site mostra: Aberto"
      : `Agora o site mostra: Fechado${r.quando ? ` — abre ${r.quando}` : ""}`;
  };

  const extra = h("div", { class: "bloco-extra", style: "display:grid;gap:12px" });
  const desenhaExtra = () => {
    extra.replaceChildren();
    if (c.modo === "auto") return;
    extra.append(
      h("div", { class: "field" },
        h("label", { for: "f-ate" }, c.modo === "fechado" ? "Fechado até o dia (inclusive)" : "Aberto até o dia (inclusive)"),
        h("input", {
          id: "f-ate", type: "date", min: ymd(new Date()), value: c.ate,
          oninput: (e) => { c.ate = e.target.value; marcarSujo(); atualizaStatus(); },
        })
      ),
      h("div", { class: "field" },
        h("label", { for: "f-aviso" }, "Aviso para os clientes (opcional)"),
        h("input", {
          id: "f-aviso", type: "text", maxlength: "120", value: c.aviso,
          placeholder: c.modo === "fechado" ? "ex.: Hoje não vamos abrir. Voltamos quinta!" : "ex.: Abrimos hoje, de última hora!",
          oninput: (e) => { c.aviso = e.target.value; marcarSujo(); },
        })
      )
    );
  };

  const opcao = (valor, titulo, detalhe) =>
    h("label", { class: "opt" },
      h("input", {
        type: "radio", name: "modo", value: valor, checked: c.modo === valor,
        onchange: () => {
          c.modo = valor;
          if (valor !== "auto" && !c.ate) c.ate = ymd(new Date());
          marcarSujo(); desenhaExtra(); atualizaStatus();
        },
      }),
      h("span", {}, titulo, h("small", {}, detalhe))
    );

  painel.append(
    h("div", { class: "bloco" },
      h("h2", {}, "Hoje"),
      status,
      opcao("auto", "Seguir o horário normal", "O site abre e fecha sozinho nos dias e horários abaixo."),
      opcao("fechado", "Fechar", "Não vamos abrir (feriado, imprevisto, férias). O site avisa e trava o envio de pedidos."),
      opcao("aberto", "Abrir fora do horário", "Vamos abrir num dia ou horário que normalmente não abrimos."),
      extra
    ),
    h("div", { class: "bloco" },
      h("h2", {}, "Dias e horário normais"),
      h("div", { class: "dias", role: "group", "aria-label": "Dias de funcionamento" },
        DIAS_CURTOS.map((nome, i) =>
          h("label", { class: "dia", title: NOMES_DIA[i] },
            h("input", {
              type: "checkbox", checked: c.diasAbre.includes(i),
              onchange: (e) => {
                c.diasAbre = e.target.checked ? [...new Set([...c.diasAbre, i])].sort() : c.diasAbre.filter((d) => d !== i);
                marcarSujo(); atualizaStatus();
              },
            }),
            nome
          )
        )
      ),
      h("div", { class: "duas" },
        h("div", { class: "field" },
          h("label", { for: "f-abre" }, "Abre às"),
          h("input", { id: "f-abre", type: "time", step: "900", value: horaParaInput(c.abreHora),
            oninput: (e) => { if (e.target.value) { c.abreHora = inputParaHora(e.target.value); marcarSujo(); atualizaStatus(); } } })
        ),
        h("div", { class: "field" },
          h("label", { for: "f-fecha" }, "Fecha às"),
          h("input", { id: "f-fecha", type: "time", step: "900", value: horaParaInput(c.fechaHora),
            oninput: (e) => { if (e.target.value) { c.fechaHora = inputParaHora(e.target.value); marcarSujo(); atualizaStatus(); } } })
        )
      ),
      h("p", { class: "muted" }, "Os clientes só conseguem enviar pedido dentro desse horário.")
    )
  );
  desenhaExtra();
  atualizaStatus();
}

/* ------------------------------------------------------------------ */
/*  Aba: Preços                                                       */
/* ------------------------------------------------------------------ */
function abaPrecos() {
  const painel = $("#p-precos");
  painel.replaceChildren();
  const bloco = h("div", { class: "bloco" },
    h("h2", {}, "Preços do cardápio"),
    h("p", { class: "muted" }, "Mude o valor e salve. Quem abrir o site depois verá o novo preço. Para promoção em um dia específico, use a aba Promoções.")
  );

  let grupoAtual = "";
  listaPrecos().forEach((item) => {
    if (item.grupo !== grupoAtual) {
      grupoAtual = item.grupo;
      bloco.append(h("div", { class: "grupo" }, grupoAtual));
    }
    const padrao = PRECOS_PADRAO[item.chave];
    const linha = h("div", { class: "linha" });
    const campo = h("input", {
      type: "text", inputmode: "decimal", id: `p-${item.chave}`, value: dinheiroTxt(estado.precos[item.chave]),
      "aria-label": `Preço de ${item.nome}`,
      oninput: (e) => {
        const v = num(e.target.value);
        estado.precos[item.chave] = v;
        e.target.setAttribute("aria-invalid", Number.isFinite(v) && v >= 0 ? "false" : "true");
        linha.classList.toggle("mudou", v !== padrao);
        marcarSujo();
      },
    });
    linha.classList.toggle("mudou", estado.precos[item.chave] !== padrao);
    linha.append(
      h("span", { class: "linha__nome" }, item.nome),
      h("span", { class: "linha__padrao" }, `padrão R$ ${dinheiroTxt(padrao)}`),
      h("span", { class: "dinheiro" }, h("span", {}, "R$"), campo)
    );
    bloco.append(linha);
  });
  painel.append(bloco);
}

/* ------------------------------------------------------------------ */
/*  Aba: Promoções                                                    */
/* ------------------------------------------------------------------ */
function abaPromos() {
  const painel = $("#p-promos");
  painel.replaceChildren();
  const bloco = h("div", { class: "bloco" },
    h("h2", {}, "Promoções"),
    h("p", { class: "muted" }, "O preço promocional aparece no montador da pizza e um aviso dourado no topo do site, nos dias escolhidos. Vale só para sabor único (não para meio a meio).")
  );

  if (!estado.promos.length) bloco.append(h("p", { class: "vazio" }, "Nenhuma promoção por enquanto."));

  estado.promos.forEach((p, i) => {
    const select = (valor, opcoes, aoMudar, rotulo) =>
      h("select", { "aria-label": rotulo, onchange: (e) => { aoMudar(e.target.value); marcarSujo(); } },
        opcoes.map(([v, t]) => h("option", { value: v, selected: String(v) === String(valor) }, t)));

    bloco.append(
      h("div", { class: "carta" },
        h("div", { class: "quatro" },
          h("div", { class: "field" }, h("label", {}, "Dia"),
            select(p.dia, [[-1, "Todos os dias"], ...NOMES_DIA.map((n, d) => [d, n])], (v) => (p.dia = Number(v)), "Dia da promoção")),
          h("div", { class: "field" }, h("label", {}, "Sabor"),
            select(p.sabor, PIZZAS.map((x) => [x.id, x.nome]), (v) => (p.sabor = v), "Sabor da promoção")),
          h("div", { class: "field" }, h("label", {}, "Tamanho"),
            select(p.tamanho, [["grande", "Grande"], ["broto", "Broto"]], (v) => (p.tamanho = v), "Tamanho da promoção")),
          h("div", { class: "field" }, h("label", { for: `pp-${i}` }, "Preço promocional (R$)"),
            h("input", { id: `pp-${i}`, type: "text", inputmode: "decimal", value: dinheiroTxt(p.preco),
              oninput: (e) => { p.preco = num(e.target.value); e.target.setAttribute("aria-invalid", Number.isFinite(p.preco) ? "false" : "true"); marcarSujo(); } }))
        ),
        h("div", { class: "field" }, h("label", { for: `pt-${i}` }, "Texto do aviso (deixe em branco para o site montar um)"),
          h("input", { id: `pt-${i}`, type: "text", maxlength: "120", value: p.texto, placeholder: "ex.: Quinta é dia de calabresa: grande por R$ 50",
            oninput: (e) => { p.texto = e.target.value; marcarSujo(); } })),
        h("button", { type: "button", class: "btn btn--ghost", onclick: () => { estado.promos.splice(i, 1); marcarSujo(); abaPromos(); } }, "Remover esta promoção")
      )
    );
  });

  bloco.append(
    h("button", {
      type: "button", class: "btn btn--ghost",
      disabled: estado.promos.length >= 20,
      onclick: () => {
        estado.promos.push({ dia: new Date().getDay(), sabor: PIZZAS.find((x) => !x.doce).id, tamanho: "grande", preco: 50, texto: "" });
        marcarSujo(); abaPromos();
      },
    }, "+ Nova promoção")
  );
  painel.append(bloco);
}

/* ------------------------------------------------------------------ */
/*  Aba: Insumos                                                      */
/* ------------------------------------------------------------------ */
function abaInsumos() {
  const painel = $("#p-insumos");
  painel.replaceChildren();
  const bloco = h("div", { class: "bloco" },
    h("h2", {}, "Preço dos insumos"),
    h("p", { class: "muted" }, "Quanto você paga por cada ingrediente. Isso fica só na planilha — não aparece no site. Quando tivermos a quantidade de cada ingrediente por pizza, dá para calcular o custo e o lucro.")
  );

  if (!estado.insumos.length) bloco.append(h("p", { class: "vazio" }, "Nenhum insumo cadastrado ainda."));

  estado.insumos.forEach((ins, i) => {
    bloco.append(
      h("div", { class: "insumo" },
        h("input", { class: "nome", type: "text", maxlength: "60", value: ins.nome, placeholder: "Insumo (ex.: Mussarela)", "aria-label": "Nome do insumo",
          oninput: (e) => { ins.nome = e.target.value; marcarSujo(); } }),
        h("select", { "aria-label": "Unidade", onchange: (e) => { ins.unidade = e.target.value; marcarSujo(); } },
          [...new Set([...UNIDADES, ins.unidade].filter(Boolean))].map((u) => h("option", { value: u, selected: u === ins.unidade }, u))),
        h("input", { type: "text", inputmode: "decimal", value: dinheiroTxt(ins.preco), placeholder: "R$ por un.", "aria-label": "Preço por unidade",
          oninput: (e) => { ins.preco = num(e.target.value); e.target.setAttribute("aria-invalid", Number.isFinite(ins.preco) ? "false" : "true"); marcarSujo(); } }),
        h("button", { type: "button", class: "x", "aria-label": `Remover ${ins.nome || "insumo"}`, onclick: () => { estado.insumos.splice(i, 1); marcarSujo(); abaInsumos(); } }, "✕")
      )
    );
  });

  bloco.append(
    h("button", {
      type: "button", class: "btn btn--ghost", disabled: estado.insumos.length >= 300,
      onclick: () => { estado.insumos.push({ nome: "", unidade: "kg", preco: 0 }); marcarSujo(); abaInsumos(); },
    }, "+ Novo insumo")
  );
  painel.append(bloco);
}

/* ------------------------------------------------------------------ */
/*  Salvar                                                            */
/* ------------------------------------------------------------------ */
function montarEnvio() {
  const c = estado.config;
  for (const [chave, v] of Object.entries(estado.precos)) {
    if (!Number.isFinite(v) || v < 0) {
      const item = listaPrecos().find((i) => i.chave === chave);
      throw new Error(`Confira o preço de “${item ? item.nome : chave}”.`);
    }
  }
  estado.promos.forEach((p, i) => {
    if (!Number.isFinite(p.preco) || p.preco < 0) throw new Error(`Confira o preço da promoção ${i + 1}.`);
  });
  estado.insumos.forEach((ins) => {
    if (ins.nome.trim() && (!Number.isFinite(ins.preco) || ins.preco < 0)) throw new Error(`Confira o preço de “${ins.nome}”.`);
  });

  return {
    config: {
      modo: c.modo,
      ate: c.modo === "auto" ? "" : c.ate,
      aviso: c.aviso,
      diasAbre: c.diasAbre,
      abreHora: c.abreHora,
      fechaHora: c.fechaHora,
    },
    precos: estado.precos,
    promos: estado.promos.map((p) => ({ dia: p.dia, sabor: p.sabor, tamanho: p.tamanho, preco: p.preco, texto: p.texto.trim() })),
    insumos: estado.insumos.filter((i) => i.nome.trim()).map((i) => ({ nome: i.nome.trim(), unidade: i.unidade, preco: i.preco })),
  };
}

async function salvar() {
  const botao = $("#salvar");
  let envio;
  try {
    envio = montarEnvio();
  } catch (e) {
    aviso(e.message, true);
    return;
  }
  botao.disabled = true;
  $("#saveMsg").textContent = "Salvando…";
  try {
    await api("save", envio);
    marcarSalvo();
    aviso("Salvo! O site já usa os novos valores (pode levar até 1 minuto).");
  } catch (e) {
    if (e.sessao) return voltarAoLogin("Sua sessão expirou. Entre de novo — o que você mexeu continua na tela, mas não foi salvo.");
    marcarSujo();
    aviso(e.message, true);
  }
}

/* ------------------------------------------------------------------ */
/*  Telas: entrar / painel                                            */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Pedidos (página própria: confirma e registra pedidos)             */
/* ------------------------------------------------------------------ */
const TITULO = document.title;

function mostraNovos(n) {
  const badge = $("#badgePedidos");
  badge.hidden = n === 0;
  badge.textContent = String(n);
  document.title = n ? `(${n}) ${TITULO}` : TITULO;
}

const pedidos = criarPedidos({
  api: (...a) => api(...a),
  aviso: (...a) => aviso(...a),
  estado: () => estado,
  sessaoExpirou: () => voltarAoLogin("Sua sessão expirou. Entre de novo."),
  aoMudarNovos: mostraNovos,
});

function mostrarPainel() {
  $("#login").hidden = true;
  $("#app").hidden = false;
  abaFuncionamento();
  abaPrecos();
  abaPromos();
  abaInsumos();
  marcarSalvo();
  pedidos.iniciar();
}

function voltarAoLogin(msg = "") {
  pedidos.parar();
  mostraNovos(0);
  token = "";
  sessionStorage.removeItem(TOKEN_KEY);
  $("#app").hidden = true;
  $("#login").hidden = false;
  const erro = $("#loginErro");
  erro.hidden = !msg;
  erro.textContent = msg;
  $("#senha").value = "";
  $("#senha").focus();
}

async function carregarEMostrar() {
  const dados = await api("get");
  montarEstado(dados);
  mostrarPainel();
}

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const botao = $("#entrar");
  const erro = $("#loginErro");
  erro.hidden = true;
  botao.disabled = true;
  botao.textContent = "Entrando…";
  try {
    const r = await api("login", { senha: $("#senha").value });
    token = r.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    $("#senha").value = "";
    await carregarEMostrar();
  } catch (err) {
    erro.textContent = err.message;
    erro.hidden = false;
  } finally {
    botao.disabled = false;
    botao.textContent = "Entrar";
  }
});

$("#salvar").addEventListener("click", salvar);

$("#sair").addEventListener("click", async () => {
  if (sujo && !confirm("Há alterações não salvas. Sair mesmo assim?")) return;
  try { await api("logout"); } catch (e) { /* sessão já caída: tudo bem */ }
  sujo = false;
  voltarAoLogin();
});

document.querySelectorAll(".tab").forEach((aba) =>
  aba.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => {
      const ativa = t === aba;
      t.setAttribute("aria-selected", String(ativa));
      $("#" + t.getAttribute("aria-controls")).hidden = !ativa;
    });
    // "Salvar alterações" é das abas de ajustes; os pedidos agem na hora
    $(".savebar").hidden = aba.id === "t-pedidos";
  })
);

window.addEventListener("beforeunload", (e) => {
  if (sujo) {
    e.preventDefault();
    e.returnValue = "";
  }
});

/* Início */
(async function iniciar() {
  if (!CONFIG.estoque) {
    $("#loginErro").textContent = "O endereço da planilha (CONFIG.estoque) ainda não foi configurado.";
    $("#loginErro").hidden = false;
    $("#entrar").disabled = true;
    return;
  }
  if (!token) return $("#senha").focus();
  try {
    await carregarEMostrar();
  } catch (e) {
    voltarAoLogin(e.sessao ? "" : e.message);
  }
})();
