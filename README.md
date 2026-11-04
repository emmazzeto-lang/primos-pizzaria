# Pizzaria Primos — cardápio digital

Site de cardápio para a Pizzaria Primos (Reginópolis-SP). O cliente abre o link
pelo Instagram, monta a pizza do jeito dele e o pedido sai pronto no WhatsApp da
pizzaria. **O site não fecha o pedido** — ele só prepara a mensagem; a
confirmação acontece na conversa.

> _(a versão publicada na Vercel entra aqui quando o cardápio de adicionais estiver fechado)_

<p align="center">
  <img src="assets/screenshots/mobile.png" alt="Tela inicial no celular" width="270">
  <img src="assets/screenshots/builder.png" alt="Montando a pizza" width="270">
</p>

<!-- Para gerar os screenshots: rode o site (npm run dev), abra no navegador em
     modo responsivo (largura ~390px) e salve as imagens em assets/screenshots/ -->

## Funcionalidades

- **Cardápio** gerado a partir de um arquivo de dados: salgadas por faixa de preço,
  doces, calzone e bebidas.
- **Montar a pizza:** tamanho **broto ou grande**, sabor único ou **meio a meio**
  (só salgadas, cobra o mais caro), **borda recheada** (só grande), **adicionais**,
  **tirar ingredientes** (de cada metade, no meio a meio), observação e quantidade.
- **Calzone** e **bebidas** entram no mesmo carrinho.
- **Entrega ou retirada no balcão** — o formulário e a mensagem se ajustam.
- **Promoção por dia da semana** (ex.: calabresa de quinta) — faixa no topo e preço
  automático no montador.
- **Pedido no WhatsApp:** a mensagem é montada e aberta via link `wa.me`, com
  botão "Copiar pedido em texto" como alternativa.
- **Dados salvos no aparelho:** nome, telefone e endereço voltam preenchidos na
  próxima visita (`localStorage`).
- **Aberto / fechado automático:** calculado pelo horário do aparelho; fora do
  expediente o envio fica travado, mas dá para montar e copiar o pedido.
- **Painel admin (`/admin`):** com senha, a dona acompanha e confirma os pedidos
  (inclusive os feitos fora do site), abre ou fecha a pizzaria por um período, muda
  dias e horário, altera preços, cria promoções por dia da semana e
  cadastra o preço dos insumos — tudo gravado na planilha Google e lido pelo site
  (ver [`apps-script/`](apps-script/README.md)).
- **Controle de estoque opcional:** cada pedido enviado pode ser registrado numa
  planilha Google (ver [`apps-script/`](apps-script/README.md)).
- Acessível: foco de teclado visível, diálogos nativos (`<dialog>`), `prefers-reduced-motion`.

## Tecnologias e decisões

| Área | Escolha | Por quê |
| --- | --- | --- |
| Marcação | HTML5 semântico, elemento `<dialog>` | Modais acessíveis sem biblioteca. |
| Estilo | CSS puro com custom properties, Grid e `clamp()` | Um tema (`styles/main.css`), sem framework de UI. |
| Lógica | JavaScript com **ES Modules**, sem framework | O escopo é pequeno; um framework seria peso morto. |
| Build | **Nenhum** | O dono do negócio precisa editar preço num arquivo e publicar. Sem build, não há build para quebrar. |
| Dados | `sessionStorage` (carrinho) e `localStorage` (cliente) | Nada de servidor para uma tarefa que não precisa. |
| Integração | Link `wa.me` + Google Apps Script | Pedido pelo WhatsApp; relatório do dia numa planilha grátis. |
| Hospedagem | Site estático (Vercel) | Deploy sem configuração, carrega rápido no link do Instagram. |

## Estrutura

```
primos-site/
├── index.html            # única página; carrega o CSS e o src/main.js
├── styles/
│   ├── main.css           # tema do cardápio ("forno a lenha, à noite")
│   └── admin.css          # tema do painel
├── src/
│   ├── main.js            # ponto de entrada: liga os eventos e inicia
│   ├── config.js          # telefone, Instagram, horário, URL do estoque
│   ├── menu-data.js       # o cardápio (sabores, preços, ingredientes)
│   ├── menu-view.js       # monta a lista do cardápio na tela
│   ├── builder.js         # diálogo "montar a pizza"
│   ├── order.js           # diálogo do pedido + mensagem do WhatsApp
│   ├── store.js           # carrinho e dados do cliente
│   ├── ui.js              # repinta cabeçalho / hero / barra / promoção
│   ├── shop-status.js     # aberto ou fechado agora
│   ├── promos.js          # promoções por dia da semana
│   ├── remote.js          # lê da planilha os ajustes feitos no painel (validados)
│   ├── price-keys.js      # lista única do que tem preço editável
│   └── lib/
│       ├── dom.js         # atalhos $ e $$
│       ├── format.js      # formatação de dinheiro/texto
│       └── bus.js         # event bus mínimo ("cart:changed")
├── admin/                 # painel da dona (app.js = ajustes, pedidos.js = pedidos)
├── assets/
│   └── logo.png
└── apps-script/           # servidor na planilha Google (Google Apps Script)
    ├── estoque.gs         # registra pedidos e monta o resumo do dia
    ├── admin.gs           # API do painel: login, ajustes públicos, gravação
    └── README.md
```

## Rodando localmente

Os ES Modules não abrem por `file://` — é preciso um servidor local.

```bash
npm run dev
```

Sem Node, qualquer um destes serve:

```bash
npx serve .
# ou
python -m http.server 8000
```

Depois abra o endereço que o comando mostrar (ex.: `http://localhost:3000`).
No VS Code, a extensão **Live Server** também funciona.

## Editando o cardápio

Tudo em dois arquivos, sem tocar em lógica:

- [`src/menu-data.js`](src/menu-data.js) — sabores, preços, ingredientes, borda, mini pizza, calzone.
- [`src/config.js`](src/config.js) — WhatsApp, Instagram, cidade, dias e horário de funcionamento.

Salve e publique de novo. Esses arquivos guardam os valores **padrão**: quando o
painel está ativo, o que a dona altera nele vale por cima (e se a planilha ficar
fora do ar, o site volta a usar estes).

Preços, horário e promoções do dia a dia **não precisam** de código: a dona muda em `/admin`.

## Painel admin e controle de estoque (opcional)

Passo a passo em [`apps-script/README.md`](apps-script/README.md). Resumo: cria-se
uma planilha Google com o script `apps-script/estoque.gs`, publica-se como "app da
web" e cola-se a URL em `CONFIG.estoque`. Cada pedido enviado vira uma linha; no
fim da noite sai um resumo (sabores, bordas, faturamento), com opção de e-mail
automático. O site envia só bairro, pagamento, total e itens — **sem** nome,
telefone ou endereço.

## Deploy na Vercel

1. Suba este repositório para o GitHub.
2. Em [vercel.com](https://vercel.com), **Add New → Project** e importe o repositório.
3. Framework Preset: **Other**. Sem build command, sem output directory.
4. **Deploy**. Cada `git push` na branch principal republica o site.

## Licença

[MIT](LICENSE).
