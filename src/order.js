/**
 * Diálogo do pedido: lista os itens, formulário de entrega/pagamento e,
 * no fim, abre o WhatsApp com a mensagem pronta.
 */
import { $, $$ } from "./lib/dom.js";
import { brl } from "./lib/format.js";
import { CONFIG } from "./config.js";
import {
  cart,
  cartTotal,
  removeItem,
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
      .map(
        (it, i) => `
      <div class="line">
        <div class="line__name">${it.qtd}× ${it.tipoLabel} — ${it.nome}</div>
        <div class="line__price">${brl(it.precoUnit * it.qtd)}</div>
        ${resumoLinha(it) ? `<div class="line__meta">${resumoLinha(it)}</div>` : ""}
        <button type="button" class="line__edit" data-edit="${i}">editar</button>
        <button type="button" class="line__edit" data-del="${i}" style="margin-left:14px">remover</button>
      </div>`
      )
      .join("") +
    `<div class="total"><span>Total</span><span>${brl(cartTotal())}</span></div>
     <p class="note">Só as pizzas. Adicionais e bebidas, se quiser, a gente combina no WhatsApp.</p>`;

  $$("[data-del]", box).forEach((b) =>
    b.addEventListener("click", () => removeItem(+b.dataset.del))
  );
  $$("[data-edit]", box).forEach((b) =>
    b.addEventListener("click", () => {
      const i = +b.dataset.edit;
      const it = cart[i];
      dlg.close();
      openBuilder(it.tipo, it.tipo === "grande" ? it.id : null, { ...it, _i: i });
    })
  );

  $("#sendPrice").textContent = brl(cartTotal());
}

function resumoLinha(it) {
  const bits = [];
  if (it.meio) bits.push(`meio a meio c/ ${it.meio.nome}`);
  if (it.tirar.length) bits.push("sem " + it.tirar.join(", "));
  if (it.borda) bits.push("borda " + it.borda.nome.toLowerCase());
  if (it.obs) bits.push("obs: " + it.obs);
  return bits.join(" · ");
}

/* ------------------------------------------------------------------ */
/*  Formulário de entrega                                             */
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

function collect() {
  const f = $("#checkout");
  const get = (n) => (f.elements[n]?.value || "").trim();
  return {
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

function missing(d) {
  const falta = [];
  if (!cart.length) falta.push("pizza");
  ["nome", "telefone", "rua", "numero", "bairro"].forEach((k) => {
    if (!d[k]) falta.push(k);
  });
  if (!d.pagamento) falta.push("pagamento");
  return falta;
}

/* ------------------------------------------------------------------ */
/*  Mensagem para o WhatsApp                                          */
/* ------------------------------------------------------------------ */
function buildMessage(d) {
  const L = ["*Pizzaria Primos — Pedido*", ""];

  cart.forEach((it) => {
    let head = `${it.qtd}x ${it.tipoLabel} — ${it.nome}`;
    if (it.meio) head += ` / ${it.meio.nome} (meio a meio)`;
    L.push(head);
    if (it.tirar.length) L.push(`   • sem ${it.tirar.join(", ")}`);
    if (it.borda) L.push(`   • borda ${it.borda.nome}`);
    if (it.obs) L.push(`   • obs: ${it.obs}`);
    L.push(`   • ${brl(it.precoUnit)} cada`);
  });

  L.push("", `*Total (pizzas): ${brl(cartTotal())}*`, "");
  L.push("*Entrega*", d.nome, `${d.rua}, ${d.numero} — ${d.bairro}`);
  if (d.complemento) L.push(`Compl.: ${d.complemento}`);
  if (d.referencia) L.push(`Ref.: ${d.referencia}`);
  L.push(`Tel.: ${d.telefone}`, CONFIG.cidade, "");

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
function logForStock(d) {
  if (!CONFIG.estoque) return;

  const payload = {
    ts: new Date().toISOString(),
    bairro: d.bairro,
    pagamento: d.pagamento,
    total: cartTotal(),
    itens: cart.map((it) => ({
      tipo: it.tipo,
      sabor: it.nome,
      meio: it.meio?.nome || null,
      qtd: it.qtd,
      tirar: it.tirar,
      borda: it.borda?.nome || null,
      preco: it.precoUnit,
    })),
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
    const d = collect();
    if (missing(d).length) {
      $("#checkout").reportValidity();
      return;
    }
    if (!lojaStatus().aberta) return; // botão já fica desabilitado; trava dupla

    $("#f-save").checked ? saveCliente(d) : forgetCliente();
    logForStock(d);

    const url =
      "https://wa.me/" + CONFIG.whatsapp + "?text=" + encodeURIComponent(buildMessage(d));
    const win = window.open(url, "_blank", "noopener");
    if (!win) location.href = url;
  });

  $("#copyBtn").addEventListener("click", async () => {
    const d = collect();
    if (missing(d).length) {
      $("#checkout").reportValidity();
      return;
    }
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
