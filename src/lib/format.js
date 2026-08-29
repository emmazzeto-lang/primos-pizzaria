/** Formatação de dinheiro e texto. */
export const brl = (n) => "R$ " + n.toFixed(2).replace(".", ","); // R$ 62,00
export const brlS = (n) => "R$ " + Math.round(n); // R$ 62
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
