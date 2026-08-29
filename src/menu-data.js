/**
 * Cardápio da Pizzaria Primos.
 * Para mudar preço, sabor ou ingredientes, edite as listas abaixo.
 *
 *   id    — apelido curto, sem espaço nem acento (uso interno)
 *   nome  — como aparece na tela
 *   preco — número, em reais
 *   ing   — ingredientes que o cliente pode pedir para tirar
 */

export const PIZZAS = [
  { id: "mussarela",      nome: "Mussarela",   preco: 62, ing: ["mussarela", "tomate"] },
  { id: "calabresa",      nome: "Calabresa",   preco: 62, ing: ["mussarela", "calabresa", "cebola"] },
  { id: "baiana",         nome: "Baiana",      preco: 62, ing: ["mussarela", "calabresa moída", "pimenta", "tomate"] },
  { id: "bauru",          nome: "Bauru",       preco: 62, ing: ["mussarela", "presunto", "tomate"] },
  { id: "margherita",     nome: "Margherita",  preco: 62, ing: ["mussarela", "tomate", "manjericão", "parmesão"] },
  { id: "quatro-queijos", nome: "4 Queijos",   preco: 70, ing: ["mussarela", "catupiry", "provolone", "parmesão"] },
  { id: "atum",           nome: "Atum",        preco: 70, ing: ["mussarela", "atum", "cebola"] },
  { id: "caipira",        nome: "Caipira",     preco: 70, ing: ["mussarela", "frango", "catupiry", "milho", "tomate"] },
  { id: "carioca",        nome: "Carioca",     preco: 70, ing: ["mussarela", "bacon", "catupiry"] },
  { id: "portuguesa",     nome: "Portuguesa",  preco: 70, ing: ["mussarela", "presunto", "milho", "ervilha", "palmito", "ovo", "cebola"] },
  { id: "primos",         nome: "Primos",      preco: 70, ing: ["mussarela", "frango", "catupiry", "batata palha"] },
  { id: "brocolis",       nome: "Brócolis",    preco: 72, ing: ["mussarela", "brócolis", "bacon", "catupiry", "alho"] },
  { id: "paulista",       nome: "Paulista",    preco: 72, ing: ["mussarela", "lombo", "bacon", "tomate", "catupiry"] },
  { id: "cinco-queijos",  nome: "5 Queijos",   preco: 75, ing: ["mussarela", "catupiry", "provolone", "parmesão", "gorgonzola"] },
  { id: "aliche",         nome: "Aliche",      preco: 75, ing: ["mussarela", "aliche", "tomate", "cebola"] },
  { id: "florenca",       nome: "Florença",    preco: 75, ing: ["mussarela", "muçarela de búfala", "atum", "tomate", "cebola", "bacon", "rúcula"] },
  { id: "regipa",         nome: "Regipa",      preco: 75, ing: ["mussarela", "muçarela de búfala", "rúcula", "tomate seco"] },
  { id: "vegetariana",    nome: "Vegetariana", preco: 75, ing: ["mussarela", "muçarela de búfala", "brócolis", "palmito", "tomate seco"] },
];

// Vem em toda pizza grande — o cliente pode pedir para tirar
export const ACOMPANHA = ["azeitona", "orégano"];

export const BORDA = { preco: 18, opcoes: ["Catupiry", "Cheddar", "Goiabada"] };
export const MINI = { nome: "Mini pizza", preco: 35 }; // qualquer sabor
export const CALZONE = { nome: "Calzone", preco: 50 }; // qualquer sabor

// Faixas em que o cardápio é agrupado na tela
export const TIERS = [
  { label: "Clássicas", teste: (p) => p.preco <= 62 },
  { label: "Da casa",   teste: (p) => p.preco > 62 && p.preco < 75 },
  { label: "Especiais", teste: (p) => p.preco >= 75 },
];
