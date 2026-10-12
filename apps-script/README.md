# Controle de estoque — planilha do fim da noite

O site pode registrar cada pedido enviado numa planilha Google. No fechamento,
sai um resumo do dia (sabores vendidos, bordas, faturamento) e, se você quiser,
esse resumo chega no seu e-mail.

**O que é enviado para a planilha:** data/hora, bairro, forma de pagamento,
valor total e os itens do pedido. **Não vai** nome, telefone nem endereço —
isso fica só na mensagem do WhatsApp.

> Observação honesta: a planilha conta os pedidos **enviados pelo site**, não os
> confirmados no WhatsApp. Se um cliente montar e não enviar, ou a pizzaria
> recusar, a contagem fica um pouco acima do real.

---

## Instalação (uma vez, ~5 minutos) FEITO

1. Abra <https://sheets.new> e dê um nome à planilha, ex.: **Pizzaria Primos — Pedidos**.
2. Menu **Extensões → Apps Script**.
3. Apague o conteúdo que aparecer, cole todo o conteúdo de **`estoque.gs`** (nesta pasta) e clique no disquete (salvar).
4. Clique em **Implantar → Nova implantação**.
   - Engrenagem ⚙️ → **App da Web**.
   - *Descrição:* qualquer coisa (ex.: "site").
   - *Executar como:* **Eu**.
   - *Quem pode acessar:* **Qualquer pessoa**.
   - **Implantar**. Vai pedir para autorizar a conta Google — aceite.
5. Copie o **URL do app da Web** (termina em `/exec`).
6. Abra o **`src/config.js`**, ache a linha `estoque: ""` dentro de `CONFIG` e cole o URL entre as aspas:

   ```js
   estoque: "https://script.google.com/macros/s/AKfy....../exec"
   ```

Pronto. A partir daí, todo pedido enviado vira uma linha na aba **Pedidos**.

---

## Resumo automático por e-mail (opcional) FEITO

1. No Apps Script, na linha `const EMAIL_RESUMO = '';`, coloque o e-mail entre as aspas.
2. Salve.
3. No menu lateral, ícone de **relógio (Acionadores) → Adicionar acionador**:
   - Função: **`resumoDoDia`**
   - Fonte do evento: **Baseado no tempo**
   - Tipo: **Timer diário** → entre **22:00 e 23:00**
   - Salvar.

Todo dia nesse horário o resumo é escrito na aba **Resumo do dia** e enviado
para o e-mail. (Se quiser só nos dias de funcionamento, dá para trocar depois
por um acionador semanal para quinta, sexta e sábado.)

Para testar na hora: no Apps Script, escolha `resumoDoDia` na lista de funções
e clique em **Executar**.

---

## Painel admin (horário, preços, promoções e insumos)

O painel fica em **`/admin`** do site (ex.: `https://seu-site.vercel.app/admin`).
Ele usa a **mesma planilha e o mesmo link `/exec`** do estoque: o que a dona
altera é gravado em abas da planilha (`Config`, `Preços`, `Promoções`, `Insumos`)
e o site lê isso quando alguém abre o cardápio.

> **Os arquivos novos precisam ser colados no Apps Script e o app reimplantado.**
> Só trocar o código no GitHub não atualiza o Apps Script.

### Ativar (uma vez, ~10 minutos)

1. Abra a planilha → **Extensões → Apps Script**.
2. Substitua o conteúdo de `estoque.gs` pelo desta pasta (mudou: agora distingue pedidos de ações do painel e protege a planilha de texto malicioso).
3. Clique em **+** (Arquivo) → **Script** → nome **`admin`** e cole o conteúdo de **`admin.gs`**. Salve tudo.
4. **Defina a senha do painel** (ela NÃO fica no código):
   **⚙️ Configurações do projeto → Propriedades do script → Adicionar propriedade**
   - Propriedade: `ADMIN_SENHA`
   - Valor: uma senha com pelo menos 10 caracteres, só da dona.
   Sem essa propriedade o painel recusa qualquer entrada.
5. **Reimplante mantendo o mesmo link:** **Implantar → Gerenciar implantações → ✏️ (editar) → Versão: _Nova versão_ → Implantar.**
   (Não crie uma "Nova implantação": ela geraria outro link e o site pararia de achar a planilha.)
6. Teste: abra `https://seu-site/admin`, entre com a senha, mude algo, salve e confira no site.

### Como funciona (e o que protege)

| Quem | Faz o quê |
| --- | --- |
| Qualquer visitante | Lê os ajustes públicos (`GET ?action=config`): horário, abrir/fechar, preços e promoções. **Insumos nunca saem aqui.** |
| Só quem sabe a senha | `login` devolve um token que vale 6 horas; `get`/`save` exigem o token. |

- A senha é conferida **no Apps Script**, nunca no navegador (o site é público).
- 5 senhas erradas seguidas bloqueiam novas tentativas por 10 minutos (vale para
  todos, inclusive a dona — é o preço de não dar para adivinhar a senha).
- O servidor valida tudo o que recebe (faixas de preço, datas, limites de tamanho)
  e **não grava nada** se alguma parte estiver inválida.
- Textos que começam com `=`, `+`, `-` ou `@` ganham um espaço na frente para nunca
  virarem fórmula da planilha.
- Se a planilha ficar fora do ar, o site continua com o último ajuste que baixou
  (ou com os valores padrão de `src/config.js` e `src/menu-data.js`).
- O ajuste "Fechar / Abrir fora do horário" tem **data limite**: depois dela o
  site volta sozinho ao horário normal (ninguém esquece a pizzaria fechada).

### Mudar a senha

Edite a propriedade `ADMIN_SENHA`. Quem já estava logado continua com acesso até a
sessão vencer (no máximo 6 horas) — a troca vale para as próximas entradas.

---

## Depois: consumo de ingredientes

Quando você tiver quanto de cada ingrediente entra numa pizza grande
(ex.: 200 g de mussarela, 120 g de calabresa…), me passe a lista que eu
adiciono ao script um bloco que transforma "18 calabresas" em
"3,6 kg de mussarela + 2,2 kg de calabresa + …" no resumo do dia.
