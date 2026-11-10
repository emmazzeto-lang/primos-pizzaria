/**
 * Quantidades informadas pela pizzaria (pizza GRANDE, em gramas; azeitona em unidades).
 *
 * Servem só de PONTO DE PARTIDA: na primeira vez que a aba Receitas abre (planilha ainda sem
 * receitas), o painel preenche com isto e pede para conferir e salvar. Depois de salvo, o que
 * vale é a planilha — mudar este arquivo não altera mais nada.
 *
 * Origem: mensagem da pizzaria. Pontos que NÃO vieram e foram deduzidos:
 *   - broto = 50% da grande (calabresa broto: 80/100/50 g contra 160/200/100 g da grande);
 *   - azeitona da grande = 20 un (a broto leva 10);
 *   - calzone = 100% de uma grande (não informado);
 *   - Caipira usa o catupiry padrão (100 g, o do Primos), pois a lista dela não citou catupiry.
 */
export const PADRAO_INICIAL = {
  "mussarela": [200, "g"],
  "catupiry": [100, "g"],
  "cebola": [100, "g"],
  "calabresa": [160, "g"],
  "presunto": [200, "g"],
  "palmito": [30, "g"],
  "milho": [30, "g"],
  "ervilha": [30, "g"],
  "tomate": [80, "g"],
  "frango": [120, "g"],
  "atum": [170, "g"],
  "pepperoni": [160, "g"],
  "bacon": [45, "g"],
  "brócolis": [160, "g"],
  "gorgonzola": [50, "g"],
  "provolone": [50, "g"],
  "parmesão": [50, "g"],
  "muçarela de búfala": [50, "g"],
  "azeitona": [20, "un"],
};

// Onde um sabor usa quantidade diferente do padrão: { "Sabor": { ingrediente: gramas } }
export const EXCECOES_INICIAIS = {
  "Portuguesa": { "cebola": 60 },
};

// Proporção de uma pizza grande
export const FATORES_INICIAIS = { broto: 0.5, calzone: 1 };

// Unidade dos ingredientes que não são em gramas
export const UNIDADE_PADRAO = { "azeitona": "un", "ovo": "un" };
