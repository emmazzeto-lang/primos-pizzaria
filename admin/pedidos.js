/**
 * Página "Pedidos" do painel: acompanhar, confirmar e registrar pedidos.
 *
 * - Lista os pedidos dos últimos 7 dias (os do site chegam sozinhos, com um código
 *   como #K7P3X que também está na mensagem do WhatsApp do cliente).
 * - Cada pedido anda: Novo → Confirmado → Entregue (ou Cancelado).
 * - "Registrar pedido feito fora do site" digita na planilha os pedidos combinados
 *   por WhatsApp, telefone ou balcão, para entrarem no resumo e no faturamento.
 *
 * Tudo é montado com createElement/textContent: os pedidos vêm de um endereço
 * público, então nada deles pode virar HTML.
 */
import { PIZZAS, BORDA, ADICIONAIS, BEBIDAS } from "../src/menu-data.js";
import { brl } from "../src/lib/format.js";
import { frasesSem } from "../src/lib/item-text.js";
import { h } from "./dom.js";

const STATUS_ROTULO = { novo: "Novo", confirmado: "Confirmado", entregue: "Entregue", cancelado: "Cancelado" };
const ORIGEM_ROTULO = {
  site: "Site",
  whatsapp: "WhatsApp (digitado)",
  telefone: "Ligação (digitado)",
  balcao: "Balcão (digitado)",
  outro: "Outro (digitado)",
};
const ORIGENS_FORM = [
  ["whatsapp", "Conversa de WhatsApp"],
  ["telefone", "Ligação"],
  ["balcao", "No balcão"],
  ["outro", "Outro"],
];
const PAGAMENTOS = ["Pix", "Dinheiro", "Cartão"];
const POLL_MS = 25_000;

const pad = (n) => String(n).padStart(2, "0");
const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
const pizzaPorId = (id) => PIZZAS.find((p) => p.id === id);
const salgadas = PIZZAS.filter((p) => !p.doce);

function horaCurta(iso) {
  const d = new Date(iso);
  const hoje = d.toDateString() === new Date().toDateString();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}` + (hoje ? "" : ` · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`);
}

function agoraLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Item como veio da planilha → título + detalhes em texto puro. */
export function descreverItem(it) {
  const qtd = Number.isInteger(it?.qtd) && it.qtd > 0 ? it.qtd : 1;
  const sabor = String(it?.sabor ?? "");
  if (it?.tipo === "bebida") return { titulo: `${qtd}× ${sabor}`, detalhes: [] };

  const rotulo = it?.tipo === "calzone" ? "Calzone" : it?.tamanho === "broto" ? "Broto" : "Grande";
  const meio = it?.meio ? String(it.meio) : "";
  const detalhes = [];
  if (arr(it?.adicionais).length) detalhes.push("com " + arr(it.adicionais).join(", "));
  if (it?.borda) detalhes.push("borda " + String(it.borda));
  detalhes.push(...frasesSem({ nome: sabor, meioNome: meio, primeira: arr(it?.tirar), meio: arr(it?.tirarMeio), toda: arr(it?.tirarToda) }));
  return { titulo: `${qtd}× ${rotulo} — ${sabor}${meio ? ` / ${meio} (meio a meio)` : ""}`, detalhes };
}

/**
 * @param {{ api:Function, aviso:Function, estado:()=>object, sessaoExpirou:Function, aoMudarNovos:(n:number)=>void }} ctx
 */
export function criarPedidos(ctx) {
  const painel = document.getElementById("p-pedidos");

  let lista = [];
  let filtro = "abertos";
  let carregou = false;
  let erroRede = "";
  let emVoo = false;
  let timer = null;
  let conhecidos = new Set();
  const ocupados = new Set();

  let formAberto = false;
  let form = novoForm();

  const topoEl = h("div", { class: "bloco" });
  const formEl = h("div");
  const listaEl = h("div", { class: "peds" });
  painel.replaceChildren(topoEl, formEl, listaEl);

  /* ------------------------------------------------------------------ */
  /*  Lista                                                             */
  /* ------------------------------------------------------------------ */
  const abertos = () => lista.filter((p) => p.status === "novo" || p.status === "confirmado");
  const deHoje = () => lista.filter((p) => new Date(p.ts).toDateString() === new Date().toDateString());
  const contarNovos = () => lista.filter((p) => p.status === "novo").length;

  function visiveis() {
    return filtro === "abertos" ? abertos() : filtro === "hoje" ? deHoje() : lista;
  }

  function pintarTopo() {
    const seg = (id, texto, n) =>
      h("button", { type: "button", "aria-pressed": String(filtro === id), onclick: () => { filtro = id; pintarTopo(); pintarLista(); } }, `${texto} (${n})`);

    topoEl.replaceChildren(...[
      h("div", { class: "ped-topo" },
        h("h2", {}, "Pedidos"),
        h("button", { type: "button", class: "btn btn--ghost btn--sm", disabled: emVoo, onclick: () => buscar() }, emVoo ? "Atualizando…" : "Atualizar")
      ),
      h("p", { class: "muted" },
        "Os pedidos do site aparecem aqui com um código (ex.: #K7P3X). Procure o mesmo código na conversa do WhatsApp, confira o pedido e toque em Confirmar."),
      h("div", { class: "seg", role: "group", "aria-label": "Filtrar pedidos" },
        seg("abertos", "Em aberto", abertos().length), seg("hoje", "Hoje", deHoje().length), seg("semana", "7 dias", lista.length)),
      erroRede ? h("p", { class: "erro", role: "status" }, `Sem conexão com a planilha — tentando de novo. (${erroRede})`) : false,
      h("button", {
        type: "button", class: "btn btn--ghost",
        onclick: () => { formAberto = !formAberto; if (formAberto) form = novoForm(); desenhaForm(); pintarTopo(); },
      }, formAberto ? "Fechar o registro" : "+ Registrar pedido feito fora do site"),
    ].filter(Boolean));
  }

  function acoesDe(p) {
    const ocupado = ocupados.has(p.id);
    const b = (texto, status, classe = "btn btn--sm", confirmar = "") =>
      h("button", { type: "button", class: classe, disabled: ocupado, onclick: () => mudar(p.id, status, confirmar) }, texto);
    const cancelar = b("Cancelar", "cancelado", "btn btn--ghost btn--sm", `Cancelar o pedido #${p.id}? Ele deixa de contar no resumo do dia.`);
    switch (p.status) {
      case "novo": return [b("Confirmar pedido", "confirmado"), cancelar];
      case "confirmado": return [b(p.entrega === "retirada" ? "Marcar como retirado" : "Marcar como entregue", "entregue"), cancelar];
      case "entregue": return [b("Desfazer", "confirmado", "btn btn--ghost btn--sm")];
      default: return [b("Restaurar pedido", "novo", "btn btn--ghost btn--sm")];
    }
  }

  function cartaoDe(p) {
    const itens = Array.isArray(p.itens) ? p.itens : [];
    const meta = [p.entrega === "retirada" ? "Retirada" : "Entrega", p.entrega === "entrega" && p.bairro ? p.bairro : "", p.pagamento].filter(Boolean).join(" · ");
    return h("article", { class: `ped ped--${p.status}` },
      h("header", { class: "ped__topo" },
        h("span", { class: "ped__cod" }, `#${p.id}`),
        h("span", { class: "ped__hora" }, horaCurta(p.ts)),
        h("span", { class: `tag tag--${p.status}` }, STATUS_ROTULO[p.status]),
        h("span", { class: "tag" }, ORIGEM_ROTULO[p.origem] || "Site")
      ),
      itens.length
        ? h("ul", { class: "ped__itens" }, itens.map((it) => {
            const d = descreverItem(it);
            return h("li", {}, h("div", { class: "ped__item" }, d.titulo), d.detalhes.map((x) => h("div", { class: "ped__det" }, x)));
          }))
        : h("p", { class: "ped__det" }, p.texto || "(sem itens)"),
      h("p", { class: "ped__meta" }, meta, " — ", h("b", {}, brl(p.total))),
      p.cliente || p.obs ? h("p", { class: "ped__det" }, [p.cliente && `Cliente: ${p.cliente}`, p.obs && `Obs.: ${p.obs}`].filter(Boolean).join(" · ")) : false,
      h("div", { class: "ped__acoes" }, acoesDe(p))
    );
  }

  function pintarLista() {
    const itens = visiveis();
    if (!carregou) return listaEl.replaceChildren(h("p", { class: "vazio" }, "Carregando pedidos…"));
    if (!itens.length) {
      const msg = filtro === "abertos" ? "Nenhum pedido em aberto. Quando um cliente enviar pelo site, ele aparece aqui."
        : filtro === "hoje" ? "Nenhum pedido hoje ainda." : "Nenhum pedido nos últimos 7 dias.";
      return listaEl.replaceChildren(h("p", { class: "vazio card-vazio" }, msg));
    }
    listaEl.replaceChildren(...itens.map(cartaoDe));
  }

  async function mudar(id, status, confirmar) {
    if (confirmar && !confirm(confirmar)) return;
    ocupados.add(id);
    pintarLista();
    try {
      await ctx.api("pedido_status", { id, status });
      const p = lista.find((x) => x.id === id);
      if (p) p.status = status;
    } catch (e) {
      if (e.sessao) return ctx.sessaoExpirou();
      ctx.aviso(e.message, true);
    } finally {
      ocupados.delete(id);
      pintarTopo();
      pintarLista();
      ctx.aoMudarNovos(contarNovos());
    }
  }

  async function buscar() {
    if (emVoo) return;
    emVoo = true;
    pintarTopo();
    try {
      const r = await ctx.api("pedidos");
      const lidos = Array.isArray(r.pedidos) ? r.pedidos : [];
      if (carregou) {
        const novos = lidos.filter((p) => !conhecidos.has(p.id) && p.status === "novo" && p.origem === "site");
        if (novos.length) ctx.aviso(novos.length === 1 ? `Novo pedido: #${novos[0].id}` : `${novos.length} novos pedidos`);
      }
      lista = lidos;
      conhecidos = new Set(lidos.map((p) => p.id));
      erroRede = "";
    } catch (e) {
      if (e.sessao) { emVoo = false; return ctx.sessaoExpirou(); }
      erroRede = e.message;
    } finally {
      emVoo = false;
      carregou = true;
      pintarTopo();
      pintarLista();
      ctx.aoMudarNovos(contarNovos());
    }
  }

  const aoVoltarParaAba = () => { if (!document.hidden) buscar(); };

  function iniciar() {
    parar();
    buscar();
    timer = setInterval(() => { if (!document.hidden) buscar(); }, POLL_MS);
    document.addEventListener("visibilitychange", aoVoltarParaAba);
  }

  function parar() {
    clearInterval(timer);
    timer = null;
    document.removeEventListener("visibilitychange", aoVoltarParaAba);
    lista = [];
    carregou = false;
    erroRede = "";
    conhecidos = new Set();
    formAberto = false;
    form = novoForm();
    formEl.replaceChildren();
  }

  /* ------------------------------------------------------------------ */
  /*  Registrar pedido feito fora do site                               */
  /* ------------------------------------------------------------------ */
  function novaLinha() {
    return { tipo: "pizza", saborId: salgadas[0].id, tamanho: "grande", meioId: "", borda: "", adicionais: [], qtd: 1, bebidaId: BEBIDAS[0]?.id || "" };
  }

  function novoForm() {
    return { quando: agoraLocal(), origem: "", entrega: "entrega", bairro: "", pagamento: "", cliente: "", obs: "", itens: [novaLinha()], totalManual: null, erro: "" };
  }

  const precos = () => ctx.estado().precos;

  /** Menor preço promocional que vale para esta linha na data do pedido (ou Infinity). */
  function promoDaLinha(l) {
    if (l.tipo !== "pizza" || l.meioId) return Infinity;
    const data = new Date(form.quando);
    const dia = isNaN(data.getTime()) ? new Date().getDay() : data.getDay();
    return Math.min(Infinity, ...ctx.estado().promos
      .filter((p) => (p.dia === -1 || p.dia === dia) && p.sabor === l.saborId && p.tamanho === l.tamanho && Number.isFinite(p.preco))
      .map((p) => p.preco));
  }

  function precoUnit(l, comPromo = true) {
    const P = precos();
    const adicionais = l.adicionais.length * P.adicional;
    if (l.tipo === "bebida") return P[`bebida:${l.bebidaId}`];
    if (l.tipo === "calzone") return P.calzone + adicionais;

    let base;
    if (l.tamanho === "broto") base = P.broto;
    else if (l.meioId) base = Math.max(P[`pizza:${l.saborId}`], P[`pizza:${l.meioId}`]);
    else base = P[`pizza:${l.saborId}`];
    if (comPromo) base = Math.min(base, promoDaLinha(l));
    return base + (l.tamanho === "grande" && l.borda ? P.borda : 0) + adicionais;
  }

  const somaItens = () => form.itens.reduce((s, l) => s + precoUnit(l) * l.qtd, 0);
  const totalFinal = () => (form.totalManual === null ? somaItens() : form.totalManual);

  function itemParaEnvio(l) {
    const P = precoUnit(l);
    const base = { qtd: l.qtd, tirar: [], tirarMeio: [], tirarToda: [], adicionais: [], borda: null, meio: null, preco: P };
    if (l.tipo === "bebida") return { ...base, tipo: "bebida", sabor: BEBIDAS.find((b) => b.id === l.bebidaId)?.nome || "", tamanho: null };
    const sabor = pizzaPorId(l.saborId).nome;
    if (l.tipo === "calzone") return { ...base, tipo: "calzone", sabor, tamanho: null, adicionais: l.adicionais };
    return {
      ...base, tipo: "pizza", sabor, tamanho: l.tamanho, adicionais: l.adicionais,
      meio: l.tamanho === "grande" && l.meioId ? pizzaPorId(l.meioId).nome : null,
      borda: l.tamanho === "grande" && l.borda ? l.borda : null,
    };
  }

  function desenhaForm() {
    formEl.replaceChildren();
    if (!formAberto) return;

    const precoEls = [];
    let totalInput, somaEl, erroEl;

    const atualizaTotais = () => {
      form.itens.forEach((l, i) => {
        const u = precoUnit(l);
        const promoAplicada = Number.isFinite(u) && precoUnit(l, false) > u;
        precoEls[i].textContent = Number.isFinite(u)
          ? `${brl(u)} cada → ${brl(u * l.qtd)}${promoAplicada ? " · promoção do dia" : ""}`
          : "Preço indisponível — confira a aba Preços";
      });
      const soma = somaItens();
      somaEl.textContent = Number.isFinite(soma) ? `Soma dos itens: ${brl(soma)}` : "Soma indisponível";
      if (form.totalManual === null && Number.isFinite(soma)) totalInput.value = String(soma.toFixed(2)).replace(".", ",");
    };

    const campoSelect = (rotulo, opcoes, valor, aoMudar) =>
      h("div", { class: "field" }, h("label", {}, rotulo),
        h("select", { "aria-label": rotulo, onchange: (e) => aoMudar(e.target.value) },
          opcoes.map(([v, t]) => h("option", { value: v, selected: String(v) === String(valor) }, t))));

    const linhas = form.itens.map((l, i) => {
      const precoEl = h("p", { class: "muted" });
      precoEls.push(precoEl);
      const redesenha = (fn) => (v) => { fn(v); desenhaForm(); };

      const corpo = [];
      corpo.push(h("div", { class: "duas" },
        campoSelect("Tipo", [["pizza", "Pizza"], ["calzone", "Calzone"], ["bebida", "Bebida"]], l.tipo, redesenha((v) => (l.tipo = v))),
        h("div", { class: "field" }, h("label", { for: `fq-${i}` }, "Quantidade"),
          h("input", {
            id: `fq-${i}`, type: "number", min: "1", max: "50", value: String(l.qtd), inputmode: "numeric",
            oninput: (e) => { const n = Math.floor(Number(e.target.value)); l.qtd = n >= 1 && n <= 50 ? n : 1; atualizaTotais(); },
          }))
      ));

      if (l.tipo === "bebida") {
        corpo.push(campoSelect("Bebida", BEBIDAS.map((b) => [b.id, b.nome]), l.bebidaId, redesenha((v) => (l.bebidaId = v))));
      } else {
        corpo.push(campoSelect("Sabor", PIZZAS.map((p) => [p.id, p.nome]), l.saborId, redesenha((v) => {
          l.saborId = v;
          if (pizzaPorId(v).doce || l.meioId === v) l.meioId = "";
        })));
        if (l.tipo === "pizza") {
          corpo.push(campoSelect("Tamanho", [["grande", "Grande"], ["broto", "Broto"]], l.tamanho, redesenha((v) => {
            l.tamanho = v;
            if (v === "broto") { l.meioId = ""; l.borda = ""; }
          })));
          if (l.tamanho === "grande") {
            const segundos = pizzaPorId(l.saborId).doce ? [] : salgadas.filter((p) => p.id !== l.saborId);
            if (segundos.length) {
              corpo.push(campoSelect("Meio a meio", [["", "Sabor único"], ...segundos.map((p) => [p.id, `Metade ${p.nome}`])], l.meioId, redesenha((v) => (l.meioId = v))));
            }
            corpo.push(campoSelect("Borda recheada", [["", "Sem borda"], ...BORDA.opcoes.map((o) => [o, o])], l.borda, redesenha((v) => (l.borda = v))));
          }
        }
        const resumo = h("summary", {}, `Adicionais${l.adicionais.length ? ` (${l.adicionais.length})` : ""}`);
        corpo.push(h("details", { class: "adic", open: l.adicionais.length > 0 },
          resumo,
          h("div", { class: "adic__lista" }, ADICIONAIS.opcoes.map((nome) =>
            h("label", { class: "pick" },
              h("input", {
                type: "checkbox", checked: l.adicionais.includes(nome),
                onchange: (e) => {
                  l.adicionais = e.target.checked ? [...l.adicionais, nome] : l.adicionais.filter((x) => x !== nome);
                  resumo.textContent = `Adicionais${l.adicionais.length ? ` (${l.adicionais.length})` : ""}`;
                  atualizaTotais();
                },
              }), nome)))
        ));
      }

      corpo.push(precoEl);
      if (form.itens.length > 1) {
        corpo.push(h("button", { type: "button", class: "btn btn--ghost btn--sm", onclick: () => { form.itens.splice(i, 1); desenhaForm(); } }, "Remover este item"));
      }
      return h("div", { class: "carta" }, corpo);
    });

    totalInput = h("input", {
      id: "fm-total", type: "text", inputmode: "decimal", "aria-label": "Total do pedido",
      oninput: (e) => {
        const s = e.target.value.trim().replace(",", ".");
        form.totalManual = s === "" ? NaN : Number(s);
        e.target.setAttribute("aria-invalid", String(!(Number.isFinite(form.totalManual) && form.totalManual >= 0)));
      },
    });
    if (form.totalManual !== null) {
      totalInput.value = Number.isFinite(form.totalManual) ? String(form.totalManual).replace(".", ",") : "";
    }
    somaEl = h("span", { class: "muted" });
    erroEl = h("p", { class: "erro", role: "alert", hidden: !form.erro }, form.erro);
    const enviar = h("button", { type: "button", class: "btn" }, "Registrar pedido");

    const campoTexto = (id, rotulo, chave, max, dica = "") =>
      h("div", { class: "field" }, h("label", { for: id }, rotulo),
        h("input", { id, type: "text", maxlength: String(max), value: form[chave], placeholder: dica, oninput: (e) => (form[chave] = e.target.value) }));

    formEl.append(
      h("div", { class: "bloco" },
        h("h2", {}, "Registrar pedido feito fora do site"),
        h("p", { class: "muted" }, "Para pedidos combinados por WhatsApp, ligação ou no balcão. Ele entra como confirmado e conta no resumo do dia e no faturamento."),
        h("div", { class: "duas" },
          campoSelect("Como o pedido foi feito", [["", "Escolha…"], ...ORIGENS_FORM], form.origem, (v) => (form.origem = v)),
          h("div", { class: "field" }, h("label", { for: "fm-quando" }, "Data e hora"),
            h("input", { id: "fm-quando", type: "datetime-local", value: form.quando, oninput: (e) => { form.quando = e.target.value; atualizaTotais(); } }))
        ),
        h("div", { class: "duas" },
          campoSelect("Receber", [["entrega", "Entrega"], ["retirada", "Retirada"]], form.entrega, (v) => { form.entrega = v; desenhaForm(); }),
          campoSelect("Pagamento", [["", "Escolha…"], ...PAGAMENTOS.map((p) => [p, p])], form.pagamento, (v) => (form.pagamento = v))
        ),
        form.entrega === "entrega" ? campoTexto("fm-bairro", "Bairro (opcional)", "bairro", 80) : false,
        campoTexto("fm-cliente", "Cliente (opcional)", "cliente", 60, "ex.: Dona Maria"),
        h("h3", { class: "sub-h" }, "Itens"),
        linhas,
        h("button", { type: "button", class: "btn btn--ghost", disabled: form.itens.length >= 25, onclick: () => { form.itens.push(novaLinha()); desenhaForm(); } }, "+ Adicionar outro item"),
        h("div", { class: "field" }, h("label", { for: "fm-total" }, "Total do pedido (R$)"),
          h("div", { class: "total-linha" }, totalInput, somaEl,
            h("button", { type: "button", class: "link", onclick: () => { form.totalManual = null; totalInput.setAttribute("aria-invalid", "false"); atualizaTotais(); } }, "usar a soma")),
          h("p", { class: "muted" }, "Você pode corrigir o valor se combinou outro preço.")),
        campoTexto("fm-obs", "Observação (opcional)", "obs", 200),
        erroEl,
        enviar
      )
    );

    atualizaTotais();

    enviar.addEventListener("click", async () => {
      const erro = (msg) => { form.erro = msg; erroEl.textContent = msg; erroEl.hidden = !msg; };
      erro("");
      if (!form.origem) return erro("Escolha como o pedido foi feito.");
      if (!form.pagamento) return erro("Escolha a forma de pagamento.");
      const quando = new Date(form.quando);
      if (isNaN(quando.getTime())) return erro("Confira a data e a hora.");
      if (form.itens.some((l) => !Number.isFinite(precoUnit(l)))) return erro("Falta o preço de algum item. Confira a aba Preços.");
      const total = totalFinal();
      if (!Number.isFinite(total) || total < 0) return erro("Confira o total do pedido.");

      enviar.disabled = true;
      enviar.textContent = "Registrando…";
      try {
        const r = await ctx.api("pedido_novo", {
          quando: quando.toISOString(), origem: form.origem, entrega: form.entrega, pagamento: form.pagamento,
          bairro: form.entrega === "entrega" ? form.bairro : "", cliente: form.cliente, obs: form.obs,
          total: Math.round(total * 100) / 100, itens: form.itens.map(itemParaEnvio),
        });
        ctx.aviso(`Pedido #${r.id} registrado.`);
        formAberto = false;
        form = novoForm();
        desenhaForm();
        pintarTopo();
        await buscar();
      } catch (e) {
        if (e.sessao) return ctx.sessaoExpirou();
        enviar.disabled = false;
        enviar.textContent = "Registrar pedido";
        erro(e.message);
      }
    });
  }

  pintarTopo();
  pintarLista();
  return { iniciar, parar };
}
