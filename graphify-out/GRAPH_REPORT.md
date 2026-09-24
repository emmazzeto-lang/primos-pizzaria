# Graph Report - primos-site  (2026-08-31)

## Corpus Check
- 18 files · ~7,858 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 105 nodes · 238 edges · 8 communities (7 shown, 1 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d2e23ba3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- builder.js
- order.js
- package.json
- Pizzaria Primos — cardápio digital
- main.js
- store.js
- openBuilder
- CLAUDE.md

## God Nodes (most connected - your core abstractions)
1. `openBuilder()` - 16 edges
2. `initOrder()` - 11 edges
3. `renderOrder()` - 9 edges
4. `Pizzaria Primos — cardápio digital` - 9 edges
5. `brl()` - 8 edges
6. `renderMenu()` - 8 edges
7. `brlS()` - 7 edges
8. `persist()` - 7 edges
9. `cartTotal()` - 7 edges
10. `keywords` - 6 edges

## Surprising Connections (you probably didn't know these)
- `openBuilder()` --calls--> `brlS()`  [EXTRACTED]
  src/builder.js → src/lib/format.js
- `openBuilder()` --calls--> `cap()`  [EXTRACTED]
  src/builder.js → src/lib/format.js
- `openBuilder()` --calls--> `addItem()`  [EXTRACTED]
  src/builder.js → src/store.js
- `openBuilder()` --calls--> `replaceItem()`  [EXTRACTED]
  src/builder.js → src/store.js
- `flavButton()` --calls--> `openBuilder()`  [EXTRACTED]
  src/menu-view.js → src/builder.js

## Import Cycles
- None detected.

## Communities (8 total, 1 thin omitted)

### Community 0 - "builder.js"
Cohesion: 0.24
Nodes (16): sheet, brlS(), cap(), ACOMPANHA, ADICIONAIS, BEBIDAS, BORDA, BROTO_PRECO (+8 more)

### Community 1 - "order.js"
Cohesion: 0.25
Nodes (16): brl(), buildMessage(), collect(), dlg, initOrder(), logForStock(), modoEntrega(), openOrder() (+8 more)

### Community 2 - "package.json"
Cohesion: 0.12
Nodes (15): description, keywords, license, name, private, scripts, dev, start (+7 more)

### Community 3 - "Pizzaria Primos — cardápio digital"
Cohesion: 0.13
Nodes (13): Controle de estoque — planilha do fim da noite, Depois: consumo de ingredientes, Instalação (uma vez, ~5 minutos), Resumo automático por e-mail (opcional), Controle de estoque (opcional), Deploy na Vercel, Editando o cardápio, Estrutura (+5 more)

### Community 4 - "main.js"
Cohesion: 0.33
Nodes (8): CONFIG, ig, promoDoDia(), lojaStatus(), NOMES_DIA, cartCount(), paintCart(), paintStatus()

### Community 5 - "store.js"
Cohesion: 0.27
Nodes (11): emit(), listeners, on(), addBebida(), addItem(), cart, forgetCliente(), persist() (+3 more)

### Community 6 - "openBuilder"
Cohesion: 0.50
Nodes (8): chipsHTML(), openBuilder(), precoBase(), refresh(), unitPrice(), usouPromo(), precoComPromo(), pizzaById()

## Knowledge Gaps
- **30 isolated node(s):** `name`, `version`, `private`, `description`, `type` (+25 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 32 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `openBuilder()` connect `openBuilder` to `builder.js`, `order.js`, `store.js`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `brl()` connect `order.js` to `builder.js`, `main.js`, `openBuilder`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _30 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._
- **Should `Pizzaria Primos — cardápio digital` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._