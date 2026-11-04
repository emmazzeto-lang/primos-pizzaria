/** Formatação de dinheiro, hora e texto. */
export const brl = (n) => "R$ " + n.toFixed(2).replace(".", ","); // R$ 62,00
// Sem centavos quando o valor é redondo (R$ 62); com centavos quando não é (R$ 55,50)
export const numS = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));
export const brlS = (n) => "R$ " + numS(n);
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Escapa texto para colocar dentro de innerHTML. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** 19 → "19h", 19.5 → "19h30" */
export function fmtHora(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
}
