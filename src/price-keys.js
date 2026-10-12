/**
 * Lista única de tudo que tem preço editável. O site e o painel usam as mesmas
 * chaves ("pizza:calabresa", "broto", "borda"…), que também são as linhas da
 * aba "Preços" da planilha.
 */
import { PIZZAS, BROTO, CALZONE, BORDA, ADICIONAIS, BEBIDAS } from "./menu-data.js";

/** @returns {{chave:string, nome:string, grupo:string, get:()=>number, set:(v:number)=>void}[]} */
export function listaPrecos() {
  const itens = [];

  PIZZAS.filter((p) => !p.doce).forEach((p) =>
    itens.push({
      chave: `pizza:${p.id}`,
      nome: p.nome,
      grupo: "Pizzas salgadas — grande",
      get: () => p.preco,
      set: (v) => (p.preco = v),
    })
  );
  PIZZAS.filter((p) => p.doce).forEach((p) =>
    itens.push({
      chave: `pizza:${p.id}`,
      nome: p.nome,
      grupo: "Pizzas doces — grande",
      get: () => p.preco,
      set: (v) => (p.preco = v),
    })
  );

  itens.push(
    { chave: "broto", nome: "Broto (qualquer sabor)", grupo: "Tamanhos e extras", get: () => BROTO.preco, set: (v) => (BROTO.preco = v) },
    { chave: "calzone", nome: "Calzone (qualquer sabor)", grupo: "Tamanhos e extras", get: () => CALZONE.preco, set: (v) => (CALZONE.preco = v) },
    { chave: "borda", nome: "Borda recheada", grupo: "Tamanhos e extras", get: () => BORDA.preco, set: (v) => (BORDA.preco = v) },
    { chave: "adicional", nome: "Cada adicional", grupo: "Tamanhos e extras", get: () => ADICIONAIS.preco, set: (v) => (ADICIONAIS.preco = v) }
  );

  BEBIDAS.forEach((b) =>
    itens.push({
      chave: `bebida:${b.id}`,
      nome: b.nome,
      grupo: "Bebidas",
      get: () => b.preco,
      set: (v) => (b.preco = v),
    })
  );

  return itens;
}
