/**
 * Aberto ou fechado agora, com base no horário do aparelho e nos ajustes
 * feitos no painel (abrir/fechar por um período).
 */
import { CONFIG } from "./config.js";
import { fmtHora } from "./lib/format.js";

export const NOMES_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const pad = (n) => String(n).padStart(2, "0");
/** "2026-10-11" no fuso do aparelho */
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "auto" | "aberto" | "fechado" — o ajuste manual só vale até a data `ate`. */
export function modoAtivo(now, cfg = CONFIG) {
  const manual = cfg.modo === "aberto" || cfg.modo === "fechado";
  return manual && cfg.ate && ymd(now) <= cfg.ate ? cfg.modo : "auto";
}

/**
 * @returns {{ aberta: boolean, quando: string, modo: string, aviso: string }}
 *   quando = "hoje às 19h" / "amanhã às 19h" / "sexta às 19h" / "20/10 às 19h"
 */
export function lojaStatus(now = new Date(), cfg = CONFIG) {
  const modo = modoAtivo(now, cfg);
  const hora = now.getHours() + now.getMinutes() / 60;
  const noHorario =
    cfg.diasAbre.includes(now.getDay()) && hora >= cfg.abreHora && hora < cfg.fechaHora;
  const aberta = modo === "aberto" ? true : modo === "fechado" ? false : noHorario;

  let proxima = null;
  for (let i = 0; i < 60; i++) {
    const c = new Date(now);
    c.setDate(now.getDate() + i);
    c.setHours(cfg.abreHora, 0, 0, 0);
    if (c <= now || !cfg.diasAbre.includes(c.getDay())) continue;
    if (modo === "fechado" && ymd(c) <= cfg.ate) continue;
    proxima = c;
    break;
  }

  let quando = "";
  if (proxima) {
    const dias = Math.round(
      (new Date(proxima).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86400000
    );
    const h = fmtHora(cfg.abreHora);
    quando =
      dias === 0
        ? `hoje às ${h}`
        : dias === 1
          ? `amanhã às ${h}`
          : dias < 7
            ? `${NOMES_DIA[proxima.getDay()]} às ${h}`
            : `${pad(proxima.getDate())}/${pad(proxima.getMonth() + 1)} às ${h}`;
  }

  return { aberta, quando, modo, aviso: modo === "fechado" ? cfg.aviso || "" : "" };
}

/** [4,5,6] → "quinta a sábado"; [1,3] → "segunda e quarta" */
export function formatDias(dias) {
  const d = [...new Set(dias)].sort((a, b) => a - b);
  if (!d.length) return "sem dias de funcionamento";
  if (d.length === 7) return "todos os dias";

  const faixas = [];
  let ini = d[0];
  let ant = d[0];
  for (const x of d.slice(1)) {
    if (x === ant + 1) {
      ant = x;
      continue;
    }
    faixas.push([ini, ant]);
    ini = ant = x;
  }
  faixas.push([ini, ant]);

  const partes = faixas.map(([a, b]) =>
    a === b
      ? NOMES_DIA[a]
      : b === a + 1
        ? `${NOMES_DIA[a]} e ${NOMES_DIA[b]}`
        : `${NOMES_DIA[a]} a ${NOMES_DIA[b]}`
  );
  return partes.length === 1
    ? partes[0]
    : partes.slice(0, -1).join(", ") + " e " + partes[partes.length - 1];
}
