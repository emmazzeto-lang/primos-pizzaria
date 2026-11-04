/**
 * Diálogo do pedido: lista os itens, formulário de entrega/retirada e
 * pagamento e, no fim, abre o WhatsApp com a mensagem pronta.
 */
import { $, $$ } from "./lib/dom.js";
import { brl, esc } from "./lib/format.js";
import { gerarCodigo } from "./lib/codigo.js";
import { dividirTirar, frasesSemDoItem } from "./lib/item-text.js";
import { CONFIG } from "./config.js";
import {
  cart,
  cartTotal,
  removeItem,
  setQty,
  loadCliente,
  saveCliente,
  forgetCliente,
} from "./store.js";
import { lojaStatus } from "./shop-status.js";
import { openBuilder } from "./builder.js";

const dlg = $("#order");

export function openOrder() {
  renderOrder();
  prefill(loadCliente());
  dlg.showModal();
  $(".sheet__scroll", dlg).scrollTop = 0;
}

export function renderOrder() {
  const box = $("#orderLines");

  if (!cart.length) {
    box.innerHTML =
      `<div class="empty">Seu pedido está vazio.<br>Escolha um sabor pra começar.</div>`;
    $("#checkout").hidden = true;
    return;
  }
  $("#checkout").hidden = false;

  box.innerHTML =
    cart
      .map((it, i) => {
        const editavel = it.tipo === "pizza" || it.tipo === "calzone";
        return `
      <div class="line">
        <div class="line__name">${esc(it.tipoLabel)} — ${esc(it.nome)}</div>
        <div class="line__price">${brl(it.precoUnit * it.qtd)}</div>
        ${resumoLinha(it) ? `<div class="line__meta">${esc(resumoLinha(it))}</div>` : ""}
        <div class="line__ctrl">
          <span class="stepper stepper--sm">
            <button type="button" data-dec="${i}" aria-label="Menos um">–</button>
            <output>${it.qtd}</output>
            <button type="button" data-inc="${i}" aria-label="Mais um">+</button>
          </span>
          ${editavel ? `<button type="button" class="line__edit" data-edit="${i}">editar</button>` : ""}
          <button type="button" class="line__edit" data-del="${i}">remover</button>
        </div>
      </div>`;
      })
      .join("") +
    `<div class="total"><span>Total</span><span>${brl(cartTotal())}</span></div>` +
    `<p class="note">Confirme o valor final na conversa do WhatsApp.</p>`;

  $$("[data-dec]", box).forEach((b) =>
    b.addEventListener("click", () => setQty(+b.dataset.dec, cart[+b.dataset.dec].qtd - 1))
  );
  $$("[data-inc]", box).forEach((b) =>
    b.addEventListener("click", () => setQty(+b.dataset.inc, cart[+b.dataset.inc].qtd + 1))
  );
  $$("[data-del]", box).forEach((b) =>
    b.addEventListener("click", () => removeItem(+b.dataset.del))
  );
  $$("[data-edit]", box).forEach((b) =>
    b.addEventListener("click", () => {
      const i = +b.dataset.edit;
      const it = cart[i];
      dlg.close();
      openBuilder(it.tipo, it.tipo === "calzone" ? null : it.id, { ...it, _i: i });
    })
  );

  $("#sendPrice").textContent = brl(cartTotal());
}

function resumoLinha(it) {
  const bits = [];
  if (it.meio) bits.push(`meio a meio c/ ${it.meio.nome}`);
  if (it.adicionais?.length) bits.push("com " + it.adicionais.join(", "));
  bits.push(...frasesSemDoItem(it));
  if (it.borda) bits.push("borda " + it.borda.nome.toLowerCase());
  if (it.promo) bits.push("promo");
  if (it.obs) bits.push("obs: " + it.obs);
  return bits.join(" · ");
}

/* ------------------------------------------------------------------ */
/*  Formulário                                                        */
/* ------------------------------------------------------------------ */
function prefill(c) {
  const set = (sel, v) => {
    const el = $(sel);
    if (el && v) el.value = v;
  };
  set("#f-nome", c.nome);
  set("#f-tel", c.telefone);
  set("#f-rua", c.rua);
  set("#f-num", c.numero);
  set("#f-bairro", c.bairro);
  set("#f-compl", c.complemento);
  set("#f-ref", c.referencia);
}

const modoEntrega = () =>
  $("#checkout").elements["entrega"]?.value || "entrega";

function collect() {
  const f = $("#checkout");
  const get = (n) => (f.elements[n]?.value || "").trim();
  return {
    entrega: modoEntrega(),
    nome: get("nome"),
    telefone: get("telefone"),
    rua: get("rua"),
    numero: get("numero"),
    bairro: get("bairro"),
    complemento: get("complemento"),
    referencia: get("referencia"),
    pagamento: f.elements["pagamento"].value || "",
    semtroco: $("#f-semtroco").checked,
    troco: get("troco"),
  };
}

/** Liga/desliga o "required" dos campos de endereço conforme entrega/retirada. */
function syncEnderecoRequired() {
  const precisa = modoEntrega() === "entrega";
  ["#f-rua", "#f-num", "#f-bairro"].forEach((sel) => {
    $(sel).toggleAttribute("required", precisa);
  });
}

/** Pode enviar? (carrinho + validação nativa do formulário) */
function podeEnviar() {
  if (!cart.length) return false;
  return $("#checkout").reportValidity();
}

/* ------------------------------------------------------------------ */
/*  Mensagem para o WhatsApp                                          */
/* ------------------------------------------------------------------ */
function buildMessage(d, codigo = "") {
  const L = [`*Pizzaria Primos — Pedido${codigo ? " #" + codigo : ""}*`, ""];

  cart.forEach((it) => {
    if (it.tipo === "bebida") {
      L.push(`${it.qtd}x ${it.nome}`);
      L.push(`   • ${brl(it.precoUnit)} cada`);
      return;
    }
    let head = `${it.qtd}x ${it.tipoLabel} — ${it.nome}`;
    if (it.meio) head += ` / ${it.meio.nome} (meio a meio)`;
    L.push(head);
    if (it.adicionais?.length) L.push(`   • com ${it.adicionais.join(", ")}`);
    if (it.borda) L.push(`   • borda ${it.borda.nome}`);
    frasesSemDoItem(it).forEach((f) => L.push(`   • ${f}`));
    if (it.promo) L.push(`   • promoção do dia`);
    if (it.obs) L.push(`   • obs: ${it.obs}`);
    L.push(`   • ${brl(it.precoUnit)} cada`);
  });

  L.push("", `*Total: ${brl(cartTotal())}*`, "");

  if (d.entrega === "retirada") {
    L.push("*Retirada no balcão*", CONFIG.endereco, `${CONFIG.cidade}`, "");
  } else {
    L.push("*Entrega*", d.nome, `${d.rua}, ${d.numero} — ${d.bairro}`);
    if (d.complemento) L.push(`Compl.: ${d.complemento}`);
    if (d.referencia) L.push(`Ref.: ${d.referencia}`);
    L.push(CONFIG.cidade, "");
  }
  if (d.entrega === "retirada") L.push(`Nome: ${d.nome}`);
  L.push(`Tel.: ${d.telefone}`, "");

  let pg = `*Pagamento:* ${d.pagamento}`;
  if (d.pagamento === "Dinheiro") {
    if (d.semtroco) pg += " — não precisa de troco";
    else if (d.troco) pg += ` — troco para ${brl(parseFloat(d.troco))}`;
  }
  L.push(pg);

  return L.join("\n");
}

/* ------------------------------------------------------------------ */
/*  Registro opcional para o controle de estoque                      */
/*  (não envia nome, telefone nem endereço — só o que foi pedido)     */
/* ------------------------------------------------------------------ */
function logForStock(d, codigo) {
  if (!CONFIG.estoque) return;

  const payload = {
    id: codigo,
    ts: new Date().toISOString(),
    entrega: d.entrega,
    bairro: d.entrega === "entrega" ? d.bairro : "",
    pagamento: d.pagamento,
    total: cartTotal(),
    itens: cart.map((it) => {
      const sem = dividirTirar(it);
      return {
        tipo: it.tipo,
        sabor: it.nome,
        tamanho: it.tamanho || null,
        meio: it.meio?.nome || null,
        qtd: it.qtd,
        tirar: sem.primeira,
        tirarMeio: sem.meio,
        tirarToda: sem.toda,
        adicionais: it.adicionais || [],
        borda: it.borda?.nome || null,
        preco: it.precoUnit,
      };
    }),
  };

  try {
    fetch(CONFIG.estoque, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch (e) {
    /* nunca bloqueia o envio do pedido */
  }
}

/* ------------------------------------------------------------------ */
/*  Ligações do formulário — chamado uma vez no início                */
/* ------------------------------------------------------------------ */
export function initOrder() {
  $$('input[name=entrega]').forEach((r) =>
    r.addEventListener("change", () => {
      const retirada = modoEntrega() === "retirada";
      $("#enderecoBlock").hidden = retirada;
      $("#retiradaInfo").hidden = !retirada;
      syncEnderecoRequired();
    })
  );
  syncEnderecoRequired();

  $$('input[name=pagamento]').forEach((r) =>
    r.addEventListener("change", (e) => {
      $("#trocoWrap").hidden = e.target.value !== "Dinheiro";
    })
  );
  $("#f-semtroco").addEventListener("change", (e) => {
    $("#trocoField").hidden = e.target.checked;
  });

  $("#checkout").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!podeEnviar()) return;
    if (!lojaStatus().aberta) return; // botão já fica desabilitado; trava dupla

    const d = collect();
    $("#f-save").checked ? saveCliente(d) : forgetCliente();
    // O código só existe se o pedido for registrado na planilha (senão não há o que procurar no painel)
    const codigo = CONFIG.estoque ? gerarCodigo() : "";
    logForStock(d, codigo);

    const url =
      "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(buildMessage(d, codigo));
    const win = window.open(url, "_blank", "noopener");
    if (!win) location.href = url;
  });

  $("#copyBtn").addEventListener("click", async () => {
    if (!podeEnviar()) return;
    const d = collect();
    const msg = buildMessage(d);
    const box = $("#msgBox");
    box.hidden = false;
    box.value = msg;
    try {
      await navigator.clipboard.writeText(msg);
      $("#copyBtn").textContent = "Copiado ✓";
    } catch (e) {
      box.select();
    }
    setTimeout(() => {
      $("#copyBtn").textContent = "Copiar pedido em texto";
    }, 2500);
  });
}
