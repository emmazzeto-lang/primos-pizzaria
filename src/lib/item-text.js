/**
 * Textos de "sem ingrediente" do pedido, iguais no carrinho, na mensagem do
 * WhatsApp e no painel. No meio a meio cada metade tem os seus ingredientes.
 */
import { ACOMPANHA } from "../menu-data.js";

/**
 * Item do carrinho → o que foi tirado, separado em:
 *   primeira (1ª metade, ou a pizza inteira), meio (2ª metade) e toda (azeitona/orégano).
 */
export function dividirTirar(item) {
  const tirar = item.tirar || [];
  return {
    primeira: tirar.filter((x) => !ACOMPANHA.includes(x)),
    meio: item.tirarMeio || [],
    toda: tirar.filter((x) => ACOMPANHA.includes(x)),
  };
}

/**
 * Frases "sem …". Sem meio a meio sai uma frase só ("sem cebola, azeitona");
 * com meio a meio, uma por metade.
 */
export function frasesSem({ nome, meioNome, primeira, meio, toda }) {
  if (!meioNome) {
    const tudo = [...primeira, ...toda];
    return tudo.length ? ["sem " + tudo.join(", ")] : [];
  }
  const f = [];
  if (primeira.length) f.push(`sem ${primeira.join(", ")} (metade ${nome})`);
  if (meio.length) f.push(`sem ${meio.join(", ")} (metade ${meioNome})`);
  if (toda.length) f.push(`sem ${toda.join(", ")}`);
  return f;
}

/** Atalho para um item do carrinho. */
export const frasesSemDoItem = (it) =>
  frasesSem({ nome: it.nome, meioNome: it.meio?.nome, ...dividirTirar(it) });
