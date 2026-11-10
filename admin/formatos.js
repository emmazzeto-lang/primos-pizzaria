/** Formatações do painel (telefone, quantidades, dias da semana, datas). */

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const DIAS_PLURAL = ["domingos", "segundas", "terças", "quartas", "quintas", "sextas", "sábados"];

/** 14997824261 → (14) 99782-4261 */
export function fmtTelefone(d) {
  const s = String(d || "").replace(/\D/g, "");
  if (s.length === 11) return `(${s.slice(0, 2)}) ${s.slice(2, 7)}-${s.slice(7)}`;
  if (s.length === 10) return `(${s.slice(0, 2)}) ${s.slice(2, 6)}-${s.slice(6)}`;
  return s;
}

/** 1250 g → "1,25 kg" · 340 g → "340 g" · 20 un → "20 un" */
export function fmtQtd(qtd, un) {
  if (un === "un") return `${Math.round(qtd)} un`;
  if (qtd >= 1000) return `${(qtd / 1000).toFixed(2).replace(".", ",")} kg`;
  return `${Math.round(qtd)} g`;
}

/** "2026-11-06" → "06/11" */
export const diaCurto = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Dias entre "AAAA-MM-DD" e hoje (0 = hoje). */
export function diasDesde(iso, agora = new Date()) {
  const a = Date.parse(iso + "T12:00:00");
  const b = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12).getTime();
  return Math.round((b - a) / 86400000);
}

export const textoDias = (n) => (n <= 0 ? "hoje" : n === 1 ? "ontem" : `há ${n} dias`);

/** Soma `n` dias a um "AAAA-MM-DD" (sem depender do fuso do aparelho). */
export function somaDias(iso, n) {
  return new Date(Date.parse(iso + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10);
}
