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

## Instalação (uma vez, ~5 minutos)

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

## Resumo automático por e-mail (opcional)

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

## Depois: consumo de ingredientes

Quando você tiver quanto de cada ingrediente entra numa pizza grande
(ex.: 200 g de mussarela, 120 g de calabresa…), me passe a lista que eu
adiciono ao script um bloco que transforma "18 calabresas" em
"3,6 kg de mussarela + 2,2 kg de calabresa + …" no resumo do dia.
