/**
 * Configurações da pizzaria.
 * Pode editar à vontade — depois de salvar, publique o site de novo.
 */
export const CONFIG = {
  whatsapp: "5514997824261", // só números: 55 (país) + DDD + número
  instagram: "primosprizzaria._",
  cidade: "Reginópolis-SP",
  endereco: "Antônio da Cruz Neto, 274 — Jardim Primavera",

  // Dias que abre: 0=domingo 1=segunda 2=terça 3=quarta 4=quinta 5=sexta 6=sábado
  diasAbre: [4, 5, 6],
  abreHora: 19, // 19h
  fechaHora: 22, // 22h

  // Tempo de entrega mostrado no site
  entregaMin: 20,
  entregaMax: 40,

  // Só entrega na área urbana (não atende sítio / zona rural). Retirada no balcão liberada.
  retiradaBalcao: true,

  // Promoções por dia da semana (mesmo código de diasAbre)
  promos: [
    {
      dia: 4, // quinta
      sabor: "calabresa",
      tamanho: "grande",
      preco: 50,
      texto: "Quinta é dia de calabresa: grande por R$ 50",
    },
  ],

  // Controle de estoque (opcional): cole a URL do Apps Script (termina em /exec).
  // Deixe "" para não registrar nada. Passo a passo em apps-script/README.md
  estoque: "",
};
