# WealthAurora 💎
### Dashboard Financeiro Pessoal — Felipe & Manu

Dashboard financeiro conectado ao Google Sheets, com atualização automática via GitHub Actions.

---

## 📁 Estrutura do repositório

```
Dashboard_Felipe-e-Manu/
├── index.html          ← Dashboard (substitua o atual)
├── sync_sheet.py       ← Script que lê a planilha e gera o data.json
├── data.json           ← Gerado automaticamente pelo Actions (não edite)
└── .github/
    └── workflows/
        └── update.yml  ← Automação que roda o sync_sheet.py
```

---

## ⚙️ Configuração inicial (passo a passo)

### 1. Ative a Google Sheets API

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto (ou use um existente)
3. No menu lateral: **APIs e Serviços → Biblioteca**
4. Busque **Google Sheets API** → Ativar
5. Busque **Google Drive API** → Ativar

### 2. Crie uma Conta de Serviço

1. Vá em **APIs e Serviços → Credenciais**
2. Clique em **Criar credenciais → Conta de serviço**
3. Dê um nome (ex: `wealthaurora-bot`) → Criar
4. Na conta criada, clique em **Chaves → Adicionar chave → JSON**
5. Baixe o arquivo `.json` gerado

### 3. Compartilhe a planilha com a conta de serviço

1. Abra o arquivo `.json` baixado
2. Copie o valor do campo `"client_email"` (ex: `wealthaurora-bot@projeto.iam.gserviceaccount.com`)
3. Abra sua planilha Google Sheets
4. Clique em **Compartilhar** e cole o e-mail acima com permissão de **Leitor**

### 4. Adicione o secret no GitHub

1. No seu repositório: **Settings → Secrets and variables → Actions**
2. Clique em **New repository secret**
3. Nome: `GOOGLE_CREDENTIALS`
4. Valor: cole o **conteúdo completo** do arquivo `.json` da conta de serviço
5. Clique em **Add secret**

### 5. Crie o arquivo de workflow

Crie o arquivo `.github/workflows/update.yml` com o conteúdo abaixo:

```yaml
name: Atualizar Dashboard

on:
  schedule:
    - cron: '0 */4 * * *'   # Roda a cada 4 horas automaticamente
  workflow_dispatch:          # Permite rodar manualmente pelo GitHub

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout do repositório
        uses: actions/checkout@v4

      - name: Configurar Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Instalar dependências
        run: pip install gspread oauth2client

      - name: Rodar sync_sheet.py
        env:
          GOOGLE_CREDENTIALS: ${{ secrets.GOOGLE_CREDENTIALS }}
        run: python sync_sheet.py

      - name: Commitar data.json atualizado
        run: |
          git config user.name  "actions-user"
          git config user.email "actions@github.com"
          git add data.json
          git diff --staged --quiet || git commit -m "Atualizar dados [skip ci]"
          git push
```

---

## 🚀 Como usar depois de configurar

- O dashboard atualiza **automaticamente a cada 4 horas**
- Para forçar uma atualização manual: **Actions → Atualizar Dashboard → Run workflow**
- Para ver os dados em tempo real: abra `https://seu-usuario.github.io/Dashboard_Felipe-e-Manu/`

---

## 🧠 Regras de negócio implementadas

### ✅ Pagamento de fatura de cartão (Click / Latam)
O script **ignora automaticamente** qualquer linha que contenha palavras como:
`PAGAMENTO FATURA`, `FATURA PAGA`, `PAGAMENTO CLICK`, `LATAM PASS FATURA`, etc.

**Por quê?** Cada compra no cartão já entra individualmente no extrato. Contabilizar o pagamento da fatura seria contar o mesmo gasto duas vezes.

Se aparecer um nome diferente de fatura no seu extrato, adicione a palavra-chave na lista `PALAVRAS_FATURA` dentro do `sync_sheet.py`.

### ✅ Empréstimo Cirlene — R$ 35.000
- Parcela fixa: **R$ 500/mês** a partir de junho/2026
- Parcela semestral extra: **R$ 4.000** nos meses de recebimento da PLR:
  - **Agosto** (PLR do semestre Jan–Jun, paga em Ago)
  - **Fevereiro** (PLR do semestre Jul–Dez, paga em Fev)
- O dashboard destaca visualmente os meses com parcela de **R$ 4.500**
- O simulador de amortização respeita esse calendário ao calcular a data de quitação

### ✅ Limites por categoria com alertas
Configure os limites no início do `sync_sheet.py`:
```python
LIMITES_CATEGORIA = {
    "Alimentação":  700,
    "Transporte":   500,
    "Saúde":        400,
    "Lazer":        300,
    ...
}
```
- **Verde**: abaixo de 80% do limite
- **Amarelo**: entre 80% e 99% — alerta "ATENÇÃO"
- **Vermelho**: acima de 100% — alerta "PASSOU"

---

## 📊 Abas necessárias na planilha

| Aba | Colunas esperadas |
|-----|-------------------|
| `movimentacoes` | `data`, `descricao`, `valor`, `categoria` |
| `financiamento_emprestimo` | `data_vencimento`, `parcela_numero`, `valor_mensal`, `valor_semestral_extra`, `valor_total_parcela`, `saldo_devedor_apos`, `status` |
| `receitas_fixas` | `descricao`, `valor_esperado`, `dia_previsto`, `ativo` |
| `despesas_recorrentes` | `descricao`, `categoria`, `valor_mensal`, `dia_vencimento`, `ativo` |
| `projecao_mensal` | `mes`, `salario_previsto`, `despesas_recorrentes`, `parcela_emprestimo`, `parcela_semestral` |
| `categorias_padrao` | `palavra_chave`, `categoria`, `tipo` |

---

## 🔧 Personalização

### Alterar a renda base
No topo do `sync_sheet.py`:
```python
RENDA_LIQUIDA_REAL = 3500  # Mude para sua renda atual
```

### Alterar os meses de PLR
```python
MESES_PLR = [2, 8]  # 2 = Fevereiro, 8 = Agosto
```

### Alterar frequência de atualização
No `.github/workflows/update.yml`, mude o cron:
```yaml
- cron: '0 */2 * * *'   # A cada 2 horas
- cron: '0 8,20 * * *'  # Às 8h e 20h
- cron: '0 8 * * *'     # Uma vez por dia às 8h
```

---

## ❓ Problemas comuns

| Problema | Solução |
|----------|---------|
| Dashboard abre zerado | Verifique se o Actions rodou e gerou o `data.json` |
| `GOOGLE_CREDENTIALS` não encontrado | Confirme que o secret foi criado com esse nome exato |
| Planilha não acessível | Verifique se compartilhou com o `client_email` da conta de serviço |
| Gastos duplicados | Verifique se as linhas de fatura estão sendo ignoradas corretamente |
| Fatura com nome diferente | Adicione a palavra na lista `PALAVRAS_FATURA` no `sync_sheet.py` |
| Categoria errada | Edite a aba `categorias_padrao` na planilha com novas palavras-chave |
