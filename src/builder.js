/**
 * Diálogo "montar a pizza": sabor único ou meio a meio, tirar ingredientes,
 * borda recheada, observação e quantidade. No fim, adiciona/atualiza o carrinho.
 */
import { $, $$ } from "./lib/dom.js";
import { brl, brlS, cap } from "./lib/format.js";
import { PIZZAS, ACOMPANHA, BORDA, MINI, CALZONE } from "./menu-data.js";
import { pizzaById, addItem, replaceItem } from "./store.js";

const sheet = $("#sheet");
const TIPO_LABEL = { grande: "Pizza grande", mini: "Mini pizza", calzone: "Calzone" };

const chipsHTML = (list) =>
  list
    .map((i) => `<label class="chip"><input type="checkbox" value="${i}">${i}</label>`)
    .join("");

/**
 * @param {"grande"|"mini"|"calzone"} tipo
 * @param {string|null} id  sabor fixo (grande) ou null (mini/calzone escolhem no diálogo)
 * @param {object|null} preload  item do carrinho sendo editado (traz _i = índice)
 */
export function openBuilder(tipo, id, preload = null) {
  const grande = tipo === "grande";
  const pizza = grande ? pizzaById(id) : null;
  const precoBase =
    tipo === "mini" ? MINI.preco : tipo === "calzone" ? CALZONE.preco : pizza.preco;
  const titulo = grande ? pizza.nome : tipo === "mini" ? MINI.nome : CALZONE.nome;

  const html = [];

  html.push(
    `<div class="sheet__head"><h2 class="sheet__name">${titulo}</h2>` +
      `<div class="sheet__price" id="shPrice"></div>` +
      (grande ? `<p class="sheet__desc">${cap(pizza.ing.join(", "))}</p>` : "") +
      `</div>`
  );

  if (!grande) {
    html.push(
      `<div class="block"><div class="block__t">Sabor</div><select id="shSabor">` +
        PIZZAS.map((x) => `<option value="${x.id}">${x.nome}</option>`).join("") +
        `</select></div>`
    );
  }

  if (grande) {
    html.push(
      `<div class="block"><div class="block__t">Tamanho do sabor</div>` +
        `<label class="opt"><input type="radio" name="mm" value="inteira" checked>` +
        `<span class="opt__label">Sabor único</span></label>` +
        `<label class="opt"><input type="radio" name="mm" value="meio">` +
        `<span class="opt__label">Meio a meio</span><span class="opt__meta">vale o mais caro</span></label>` +
        `<div id="mmWrap" hidden style="margin-top:8px"><select id="shSabor2">` +
        PIZZAS.filter((x) => x.id !== id)
          .map((x) => `<option value="${x.id}">${x.nome} — ${brlS(x.preco)}</option>`)
          .join("") +
        `</select></div></div>`
    );
  }

  const ingredientes = grande ? [...pizza.ing, ...ACOMPANHA] : [...ACOMPANHA];
  html.push(
    `<div class="block"><div class="block__t">Tirar algo? ` +
      `<span style="text-transform:none;letter-spacing:0">(opcional)</span></div>` +
      `<div class="chips" id="shTirar">${chipsHTML(ingredientes)}</div>` +
      `<p class="note" id="tirarNote" style="margin-top:8px"></p></div>`
  );

  if (grande) {
    html.push(
      `<div class="block"><div class="block__t">Borda recheada</div>` +
        `<label class="opt"><input type="radio" name="bd" value="" checked>` +
        `<span class="opt__label">Sem borda recheada</span></label>` +
        BORDA.opcoes
          .map(
            (o) =>
              `<label class="opt"><input type="radio" name="bd" value="${o}">` +
              `<span class="opt__label">${o}</span><span class="opt__meta">+ ${brlS(BORDA.preco)}</span></label>`
          )
          .join("") +
        `</div>`
    );
  }

  html.push(
    `<div class="block"><div class="block__t">Observação</div>` +
      `<textarea id="shObs" placeholder="ex.: bem assada, cortada em 8 pedaços…"></textarea></div>`
  );

  html.push(
    `<div class="sheet__cta">` +
      `<div class="stepper">` +
      `<button type="button" id="qMinus" aria-label="Menos um">–</button>` +
      `<output id="qVal">1</output>` +
      `<button type="button" id="qPlus" aria-label="Mais um">+</button></div>` +
      `<button type="button" class="btn" id="addBtn">` +
      `<span id="addLabel">Adicionar</span><span class="btn__price" id="addPrice"></span></button>` +
      `</div>`
  );

  $("#sheetBody").innerHTML = html.join("");

  /* ---------- leitura do formulário ---------- */
  let qtd = preload?.qtd || 1;

  const chosenId = () => (grande ? id : $("#shSabor").value);
  const isHalf = () =>
    grande && sheet.querySelector('input[name=mm]:checked').value === "meio";
  const secondId = () => $("#shSabor2")?.value;
  const bordaValue = () =>
    grande ? sheet.querySelector('input[name=bd]:checked').value : "";
  const removed = () => $$("#shTirar input:checked").map((i) => i.value);

  function unitPrice() {
    let unit = grande ? pizzaById(chosenId()).preco : precoBase;
    if (isHalf()) {
      unit = Math.max(pizzaById(chosenId()).preco, pizzaById(secondId()).preco);
    }
    if (bordaValue()) unit += BORDA.preco;
    return unit;
  }

  function refresh() {
    const unit = unitPrice();
    $("#shPrice").textContent =
      brl(unit) + (qtd > 1 ? ` · ${qtd}× = ${brl(unit * qtd)}` : "");
    $("#addPrice").textContent = brl(unit * qtd);
    const r = removed();
    $("#tirarNote").textContent = r.length ? "sem " + r.join(", ") : "";
  }

  const bindRemoved = () =>
    $$("#shTirar input").forEach((i) => i.addEventListener("change", refresh));

  sheet.querySelectorAll('input[name=mm]').forEach((r) =>
    r.addEventListener("change", (e) => {
      $("#mmWrap").hidden = e.target.value !== "meio";
      refresh();
    })
  );
  $("#shSabor2")?.addEventListener("change", refresh);
  $("#shSabor")?.addEventListener("change", () => {
    $("#shTirar").innerHTML = chipsHTML([
      ...pizzaById($("#shSabor").value).ing,
      ...ACOMPANHA,
    ]);
    bindRemoved();
    refresh();
  });
  sheet.querySelectorAll('input[name=bd]').forEach((r) =>
    r.addEventListener("change", refresh)
  );
  bindRemoved();
  $("#qMinus").addEventListener("click", () => {
    qtd = Math.max(1, qtd - 1);
    $("#qVal").textContent = qtd;
    refresh();
  });
  $("#qPlus").addEventListener("click", () => {
    qtd = Math.min(20, qtd + 1);
    $("#qVal").textContent = qtd;
    refresh();
  });

  /* ---------- edição: pré-preenche os campos ---------- */
  if (preload) {
    if (!grande) $("#shSabor").value = preload.id;
    $("#qVal").textContent = qtd;
    if (grande && preload.meio) {
      sheet.querySelector('input[name=mm][value=meio]').checked = true;
      $("#mmWrap").hidden = false;
      $("#shSabor2").value = preload.meio.id;
    }
    if (grande && preload.borda) {
      const r = sheet.querySelector(`input[name=bd][value="${preload.borda.nome}"]`);
      if (r) r.checked = true;
    }
    preload.tirar.forEach((t) => {
      const box = $$("#shTirar input").find((i) => i.value === t);
      if (box) box.checked = true;
    });
    $("#shObs").value = preload.obs || "";
    $("#addLabel").textContent = "Salvar alteração";
  }

  refresh();

  $("#addBtn").addEventListener("click", () => {
    const sid = chosenId();
    const item = {
      tipo,
      tipoLabel: TIPO_LABEL[tipo],
      id: sid,
      nome: pizzaById(sid).nome,
      qtd,
      precoUnit: unitPrice(),
      meio: isHalf() ? { id: secondId(), nome: pizzaById(secondId()).nome } : null,
      tirar: removed(),
      borda: bordaValue() ? { nome: bordaValue(), preco: BORDA.preco } : null,
      obs: $("#shObs").value.trim(),
    };
    if (preload) replaceItem(preload._i, item);
    else addItem(item);
    sheet.close();
  });

  sheet.showModal();
  $(".sheet__scroll", sheet).scrollTop = 0;
}
