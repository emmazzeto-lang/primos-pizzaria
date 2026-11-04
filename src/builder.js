/**
 * Diálogo "montar a pizza".
 *   - pizza:   tamanho (broto / grande), meio a meio (só grande salgada),
 *              borda recheada (só grande), tirar ingredientes, adicionais.
 *   - calzone: escolhe o sabor, tirar ingredientes, adicionais.
 * No fim, adiciona/atualiza o carrinho.
 */
import { $, $$ } from "./lib/dom.js";
import { brl, brlS, cap } from "./lib/format.js";
import {
  PIZZAS,
  ACOMPANHA,
  BORDA,
  CALZONE,
  BROTO,
  ADICIONAIS,
} from "./menu-data.js";
import { pizzaById, addItem, replaceItem } from "./store.js";
import { frasesSem } from "./lib/item-text.js";
import { precoComPromo } from "./promos.js";

const sheet = $("#sheet");

const chipsHTML = (list, cls) =>
  list
    .map(
      (i) =>
        `<label class="${cls}"><input type="checkbox" value="${i}">${i}</label>`
    )
    .join("");

/**
 * @param {"pizza"|"calzone"} tipo
 * @param {string|null} id  sabor da pizza (fixo). Calzone escolhe no diálogo.
 * @param {object|null} preload  item do carrinho em edição (traz _i = índice)
 */
export function openBuilder(tipo, id, preload = null) {
  const isPizza = tipo === "pizza";
  const pizza = isPizza ? pizzaById(id) : null;
  const salgada = isPizza && !pizza.doce;

  const html = [];

  html.push(
    `<div class="sheet__head">` +
      `<h2 class="sheet__name">${isPizza ? pizza.nome : CALZONE.nome}</h2>` +
      `<div class="sheet__price" id="shPrice"></div>` +
      (isPizza ? `<p class="sheet__desc">${cap(pizza.ing.join(", "))}</p>` : "") +
      `</div>`
  );

  // ----- calzone: escolher sabor
  if (!isPizza) {
    html.push(
      `<div class="block"><div class="block__t">Sabor</div><select id="shSabor">` +
        PIZZAS.map((x) => `<option value="${x.id}">${x.nome}</option>`).join("") +
        `</select></div>`
    );
  }

  // ----- pizza: tamanho
  if (isPizza) {
    html.push(
      `<div class="block"><div class="block__t">Tamanho</div>` +
        `<label class="opt"><input type="radio" name="tam" value="grande" checked>` +
        `<span class="opt__label">Grande</span>` +
        `<span class="opt__meta">${brlS(precoComPromo(id, "grande", pizza.preco))}</span></label>` +
        `<label class="opt"><input type="radio" name="tam" value="broto">` +
        `<span class="opt__label">Broto</span><span class="opt__meta">${brlS(precoComPromo(id, "broto", BROTO.preco))}</span></label>` +
        `</div>`
    );
  }

  // ----- meio a meio (só pizza grande salgada)
  if (salgada) {
    html.push(
      `<div class="block" id="mmBlock"><div class="block__t">Sabor único ou meio a meio</div>` +
        `<label class="opt"><input type="radio" name="mm" value="inteira" checked>` +
        `<span class="opt__label">Sabor único</span></label>` +
        `<label class="opt"><input type="radio" name="mm" value="meio">` +
        `<span class="opt__label">Meio a meio</span><span class="opt__meta">vale o mais caro</span></label>` +
        `<div id="mmWrap" hidden style="margin-top:8px"><select id="shSabor2">` +
        PIZZAS.filter((x) => !x.doce && x.id !== id)
          .map((x) => `<option value="${x.id}">${x.nome} — ${brlS(x.preco)}</option>`)
          .join("") +
        `</select></div></div>`
    );
  }

  // ----- borda (só pizza grande)
  if (isPizza) {
    html.push(
      `<div class="block" id="bdBlock"><div class="block__t">Borda recheada</div>` +
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

  // ----- tirar ingredientes (no meio a meio, cada metade tem os seus)
  const primeiroSabor = isPizza ? pizza : PIZZAS[0]; // calzone começa no 1º sabor da lista
  html.push(
    `<div class="block"><div class="block__t">Tirar algo? ` +
      `<span style="text-transform:none;letter-spacing:0">(opcional)</span></div>` +
      `<p class="sub" id="tirarT1" hidden></p>` +
      `<div class="chips" id="shTirar">${chipsHTML(primeiroSabor.ing, "chip")}</div>` +
      `<div id="tirarMeioWrap" hidden>` +
      `<p class="sub" id="tirarT2"></p>` +
      `<div class="chips" id="shTirarMeio"></div></div>` +
      `<p class="sub" id="tirarT3" hidden>Na pizza toda</p>` +
      `<div class="chips" id="shTirarToda">${chipsHTML(ACOMPANHA, "chip")}</div>` +
      `<p class="note" id="tirarNote" style="margin-top:8px"></p></div>`
  );

  // ----- adicionais
  html.push(
    `<div class="block"><div class="block__t">Adicionais ` +
      `<span style="text-transform:none;letter-spacing:0">(+ ${brlS(ADICIONAIS.preco)} cada)</span></div>` +
      `<div class="chips" id="shAdd">${chipsHTML(ADICIONAIS.opcoes, "pick")}</div>` +
      `<p class="note" id="addNote" style="margin-top:8px"></p></div>`
  );

  // ----- observação
  html.push(
    `<div class="block"><div class="block__t">Observação</div>` +
      `<textarea id="shObs" placeholder="ex.: bem assada, cortada em 8 pedaços…"></textarea></div>`
  );

  // ----- quantidade + adicionar
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

  /* ---------------- leitura do formulário ---------------- */
  let qtd = preload?.qtd || 1;

  const saborId = () => (isPizza ? id : $("#shSabor").value);
  const tamanho = () =>
    isPizza ? sheet.querySelector("input[name=tam]:checked").value : null;
  const isGrande = () => isPizza && tamanho() === "grande";
  const isHalf = () =>
    salgada && isGrande() && sheet.querySelector("input[name=mm]:checked").value === "meio";
  const secondId = () => $("#shSabor2")?.value;
  const bordaValue = () =>
    isGrande() ? sheet.querySelector("input[name=bd]:checked").value : "";
  // tirar: 1ª metade (ou pizza inteira) + azeitona/orégano — mesma forma de sempre
  const removed = () =>
    [...$$("#shTirar input:checked"), ...$$("#shTirarToda input:checked")].map((i) => i.value);
  // tirar da 2ª metade (só vale no meio a meio)
  const removedMeio = () =>
    isHalf() ? $$("#shTirarMeio input:checked").map((i) => i.value) : [];
  const nomeMeio = () => (secondId() ? pizzaById(secondId()).nome : "");
  const extras = () => $$("#shAdd input:checked").map((i) => i.value);

  function precoBase() {
    if (!isPizza) return CALZONE.preco;
    if (tamanho() === "broto") return precoComPromo(saborId(), "broto", BROTO.preco);
    if (isHalf()) {
      return Math.max(
        pizzaById(saborId()).preco,
        pizzaById(secondId()).preco
      );
    }
    return precoComPromo(saborId(), "grande", pizzaById(saborId()).preco);
  }

  function usouPromo() {
    if (!isPizza || isHalf()) return false;
    const t = tamanho();
    const normal = t === "broto" ? BROTO.preco : pizzaById(saborId()).preco;
    return precoComPromo(saborId(), t, normal) < normal;
  }

  function unitPrice() {
    let unit = precoBase();
    if (bordaValue()) unit += BORDA.preco;
    unit += extras().length * ADICIONAIS.preco;
    return unit;
  }

  function refresh() {
    // mostra/esconde meio a meio e borda conforme o tamanho
    if (isPizza) {
      const broto = tamanho() === "broto";
      if ($("#mmBlock")) $("#mmBlock").hidden = broto;
      if ($("#bdBlock")) $("#bdBlock").hidden = broto;
      if (broto) {
        const mm = sheet.querySelector("input[name=mm][value=inteira]");
        if (mm) mm.checked = true;
        if ($("#mmWrap")) $("#mmWrap").hidden = true;
      }
    }
    const unit = unitPrice();
    $("#shPrice").textContent =
      brl(unit) +
      (qtd > 1 ? ` · ${qtd}× = ${brl(unit * qtd)}` : "") +
      (usouPromo() ? "  · promo" : "");
    $("#addPrice").textContent = brl(unit * qtd);

    const half = isHalf();
    $("#tirarT1").hidden = !half;
    $("#tirarMeioWrap").hidden = !half;
    $("#tirarT3").hidden = !half;
    if (half) {
      $("#tirarT1").textContent = `Metade ${pizzaById(saborId()).nome}`;
      $("#tirarT2").textContent = `Metade ${nomeMeio()}`;
    }
    const sem = frasesSem({
      nome: pizzaById(saborId()).nome,
      meioNome: half ? nomeMeio() : "",
      primeira: $$("#shTirar input:checked").map((i) => i.value),
      meio: removedMeio(),
      toda: $$("#shTirarToda input:checked").map((i) => i.value),
    });
    $("#tirarNote").textContent = sem.join(" · ");
    const a = extras();
    $("#addNote").textContent = a.length
      ? `com ${a.join(", ")}  (+ ${brl(a.length * ADICIONAIS.preco)})`
      : "";
  }

  const bind = (sel, ev = "change") =>
    $$(sel).forEach((el) => el.addEventListener(ev, refresh));

  bind("input[name=tam]");
  bind("input[name=bd]");
  bind("#shTirar input");
  bind("#shTirarToda input");
  bind("#shAdd input");

  // chips da 2ª metade: refeitos sempre que o 2º sabor muda (o que estava marcado se perde)
  function desenhaTirarMeio() {
    if (!secondId()) return;
    $("#shTirarMeio").innerHTML = chipsHTML(pizzaById(secondId()).ing, "chip");
    bind("#shTirarMeio input");
  }
  desenhaTirarMeio();

  sheet.querySelectorAll("input[name=mm]").forEach((r) =>
    r.addEventListener("change", (e) => {
      $("#mmWrap").hidden = e.target.value !== "meio";
      refresh();
    })
  );
  $("#shSabor2")?.addEventListener("change", () => {
    desenhaTirarMeio();
    refresh();
  });
  $("#shSabor")?.addEventListener("change", () => {
    $("#shTirar").innerHTML = chipsHTML(pizzaById($("#shSabor").value).ing, "chip");
    bind("#shTirar input");
    refresh();
  });
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

  /* ---------------- edição: pré-preenche ---------------- */
  if (preload) {
    if (!isPizza) $("#shSabor").value = preload.id;
    if (isPizza && preload.tamanho === "broto") {
      sheet.querySelector("input[name=tam][value=broto]").checked = true;
    }
    $("#qVal").textContent = qtd;
    if (salgada && preload.meio) {
      const mm = sheet.querySelector("input[name=mm][value=meio]");
      if (mm) {
        mm.checked = true;
        $("#mmWrap").hidden = false;
        $("#shSabor2").value = preload.meio.id;
        desenhaTirarMeio();
        (preload.tirarMeio || []).forEach((t) => {
          const box = $$("#shTirarMeio input").find((i) => i.value === t);
          if (box) box.checked = true;
        });
      }
    }
    if (isPizza && preload.borda) {
      const r = sheet.querySelector(`input[name=bd][value="${preload.borda.nome}"]`);
      if (r) r.checked = true;
    }
    (preload.tirar || []).forEach((t) => {
      const box = [...$$("#shTirar input"), ...$$("#shTirarToda input")].find((i) => i.value === t);
      if (box) box.checked = true;
    });
    (preload.adicionais || []).forEach((a) => {
      const box = $$("#shAdd input").find((i) => i.value === a);
      if (box) box.checked = true;
    });
    $("#shObs").value = preload.obs || "";
    $("#addLabel").textContent = "Salvar alteração";
  }

  refresh();

  $("#addBtn").addEventListener("click", () => {
    const sid = saborId();
    const tam = tamanho();
    const item = {
      tipo,
      tipoLabel: !isPizza
        ? "Calzone"
        : tam === "broto"
          ? "Pizza broto"
          : "Pizza grande",
      id: sid,
      nome: pizzaById(sid).nome,
      qtd,
      precoUnit: unitPrice(),
      tamanho: tam,
      meio: isHalf()
        ? { id: secondId(), nome: pizzaById(secondId()).nome }
        : null,
      tirar: removed(),
      tirarMeio: removedMeio(),
      borda: bordaValue() ? { nome: bordaValue(), preco: BORDA.preco } : null,
      adicionais: extras(),
      obs: $("#shObs").value.trim(),
      promo: usouPromo() || undefined,
    };
    if (preload) replaceItem(preload._i, item);
    else addItem(item);
    sheet.close();
  });

  sheet.showModal();
  $(".sheet__scroll", sheet).scrollTop = 0;
}
