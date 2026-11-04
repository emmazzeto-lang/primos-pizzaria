/**
 * Código curto do pedido (ex.: K7P3X). Vai na mensagem do WhatsApp e na planilha,
 * para a pizzaria achar o pedido certo no painel sem precisar de nome ou telefone.
 * Sem O, I, 0 e 1 para não confundir quando alguém lê em voz alta.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 letras: sorteio sem viés

export function gerarCodigo(tamanho = 5) {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}
