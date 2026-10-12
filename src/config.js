/**
 * Configurações da pizzaria.
 * Pode editar à vontade — depois de salvar, publique o site de novo.
 */
export const CONFIG = {
  whatsapp: "5514997824261", // só números: 55 (país) + DDD + número
  instagram: "primospizzaria._",
  cidade: "Reginópolis-SP",
  endereco: "Antônio da Cruz Neto, 274 — Jardim Primavera",

  // Dias que abre: 0=domingo 1=segunda 2=terça 3=quarta 4=quinta 5=sexta 6=sábado
  diasAbre: [4, 5, 6],
  abreHora: 19, // 19h (aceita 19.5 = 19h30)
  fechaHora: 22, // 22h

  // Ajuste manual feito no painel (/admin). Os valores abaixo são o padrão;
  // o painel sobrescreve em tempo real.
  //   modo: "auto" segue o horário | "aberto" abre mesmo fora do horário | "fechado" fecha
  //   ate:  "AAAA-MM-DD" — último dia em que o ajuste vale (depois volta ao normal)
  modo: "auto",
  ate: "",
  aviso: "",

  // Tempo de entrega mostrado no site
  entregaMin: 20,
  entregaMax: 40,

  // Só entrega na área urbana (não atende sítio / zona rural). Retirada no balcão liberada.
  retiradaBalcao: true,

  // Promoções por dia da semana (mesmo código de diasAbre; -1 = todos os dias)
  promos: [
    {
      dia: 4, // quinta
      sabor: "calabresa",
      tamanho: "grande",
      preco: 50,
      texto: "Quinta é dia de calabresa: grande por R$ 50",
    },
  ],

  // URL do Apps Script (termina em /exec). Serve para três coisas: registrar pedidos
  // (estoque), entregar os ajustes do painel ao site e atender o painel /admin.
  // Deixe "" para desligar tudo isso. Passo a passo em apps-script/README.md
  estoque: "https://script.google.com/macros/s/AKfycbwMg2tBLYWIlWfy2AF_dLj1AeOEgpzvpUD8YDfoM2fQFNCRMhas3MbnLQMsPOySh245SA/exec",
};
