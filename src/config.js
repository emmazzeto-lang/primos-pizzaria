/**
 * Configurações da pizzaria.
 * Pode editar à vontade — depois de salvar, publique o site de novo.
 */
export const CONFIG = {
  whatsapp: "5514997824261", // só números: 55 (país) + DDD + número
  instagram: "primosprizzaria._",
  cidade: "Reginópolis-SP",

  // Dias que abre: 0=domingo 1=segunda 2=terça 3=quarta 4=quinta 5=sexta 6=sábado
  diasAbre: [4, 5, 6],
  abreHora: 19, // 19h
  fechaHora: 22, // 22h

  // Controle de estoque (opcional): cole a URL do Apps Script (termina em /exec).
  // Deixe "" para não registrar nada. Passo a passo em apps-script/README.md
  estoque: "",
};
