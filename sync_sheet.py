import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

SHEET_ID = "1BGYyMz9BZ0ypEaJfv5InDWwVZ73iK58p9W-QOsBY3Gk"

# Palavras para IGNORAR (não são gastos reais do dia a dia)
IGNORAR_DESCRICOES = [
    'APLICACAO COFRINHOS', 'TRANSF', 'PIX TRANSF', 'FATURA PAGA',
    'DEPOSITO', 'DEP DIN', 'REND PAGO', 'SALDO DO DIA', 'RESGATE',
    'PAGAMENTO PARCELA EMPRESTIMO', 'PAG BOLETO', 'IOF', 'JUROS', 'MULTA'
]

# Categorias que queremos manter (gastos reais)
CATEGORIAS_REAIS = [
    'Alimentação', 'Transporte', 'Saúde', 'Pet', 'Educação', 
    'Lazer', 'Compras', 'Serviços', 'Vestuário', 'Eletrônicos'
]

def is_real_expense(desc, valor, categoria):
    desc_upper = desc.upper()
    # Ignorar descrições problemáticas
    for ignore in IGNORAR_DESCRICOES:
        if ignore in desc_upper:
            return False
    # Ignorar valores muito altos (acima de 2000 - provavelmente não é gasto do dia)
    if abs(valor) > 2000:
        return False
    # Só considerar categorias reais
    if categoria not in CATEGORIAS_REAIS:
        return False
    # Despesa é valor negativo
    return valor < 0

def is_real_income(desc, valor):
    desc_upper = desc.upper()
    # Salários
    if 'SALARIO' in desc_upper or 'SALÁRIO' in desc_upper or 'REMUNERACAO' in desc_upper:
        return True
    return False

def process_sheet():
    creds_json = os.environ.get('GOOGLE_CREDENTIALS')
    if not creds_json:
        print("❌ ERRO: GOOGLE_CREDENTIALS não encontrado")
        return
    
    creds_dict = json.loads(creds_json)
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    
    sheet = client.open_by_key(SHEET_ID).sheet1
    data = sheet.get_all_records()
    print(f"📊 Lidas {len(data)} linhas da planilha")
    
    total_income = 0
    total_expense = 0
    categories = defaultdict(float)
    
    # Dados mensais para o gráfico
    monthly_expense = defaultdict(float)
    monthly_income = defaultdict(float)
    
    for row in data:
        valor_str = str(row.get('valor', '0')).replace(',', '.')
        try:
            valor = float(valor_str)
        except:
            valor = 0
            
        desc = str(row.get('descricao', ''))
        cat = str(row.get('categoria', 'Outros'))
        data_str = str(row.get('data', ''))
        
        if desc == 'SALDO DO DIA':
            continue
        
        # Extrair mês/ano para agregação
        mes_ano = data_str[:7] if len(data_str) >= 7 else "2026-01"
        
        # Receita real
        if is_real_income(desc, valor) and valor > 0:
            total_income += valor
            monthly_income[mes_ano] += valor
            print(f"💰 Receita: {desc} - R$ {valor}")
        
        # Despesa real
        elif is_real_expense(desc, valor, cat):
            abs_valor = abs(valor)
            total_expense += abs_valor
            categories[cat] += abs_valor
            monthly_expense[mes_ano] += abs_valor
            print(f"💸 Despesa: {desc[:30]}... - {cat} - R$ {abs_valor:.2f}")
    
    # Calcular média diária dos últimos 30 dias
    last_30_days_expense = 0
    thirty_days_ago = datetime.now() - timedelta(days=30)
    for row in data:
        try:
            data_row = datetime.strptime(str(row.get('data', '')), '%Y-%m-%d')
            valor_str = str(row.get('valor', '0')).replace(',', '.')
            valor = float(valor_str)
            desc = str(row.get('descricao', ''))
            cat = str(row.get('categoria', 'Outros'))
            if data_row >= thirty_days_ago and is_real_expense(desc, valor, cat):
                last_30_days_expense += abs(valor)
        except:
            pass
    
    avg_daily = last_30_days_expense / 30 if last_30_days_expense > 0 else 0
    
    # Dados da dívida (Cirlene)
    debt_data = {
        'credor': 'Cirlene',
        'valor_total': 35000,
        'parcela_mensal': 500,
        'parcela_semestral': 4000,
        'proximo_semestre': '2026-08',
        'pago_total': 0,
        'saldo_devedor': 35000
    }
    
    # Calcular quanto já foi pago (baseado nos registros de 'Empréstimo' ou 'Transferência' relevantes)
    for row in data:
        desc = str(row.get('descricao', ''))
        valor_str = str(row.get('valor', '0')).replace(',', '.')
        try:
            valor = float(valor_str)
        except:
            valor = 0
        if 'CIRLENE' in desc.upper() and valor < 0:
            debt_data['pago_total'] += abs(valor)
    
    debt_data['saldo_devedor'] = max(0, 35000 - debt_data['pago_total'])
    
    # Preparar JSON final
    result = {
        'lastUpdate': datetime.now().isoformat(),
        'totalIncome': round(total_income, 2),
        'totalExpense': round(total_expense, 2),
        'balance': round(total_income - total_expense, 2),
        'avgDailyExpense': round(avg_daily, 2),
        'categories': {k: round(v, 2) for k, v in categories.items() if v > 0},
        'topCategories': sorted(categories.items(), key=lambda x: x[1], reverse=True)[:6],
        'monthlyData': {
            'expense': {k: round(v, 2) for k, v in sorted(monthly_expense.items())[-6:]},
            'income': {k: round(v, 2) for k, v in sorted(monthly_income.items())[-6:]}
        },
        'debt': debt_data
    }
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Sucesso!")
    print(f"   Receitas totais: R$ {total_income:.2f}")
    print(f"   Despesas totais: R$ {total_expense:.2f}")
    print(f"   Saldo: R$ {(total_income - total_expense):.2f}")
    print(f"   Média diária (30 dias): R$ {avg_daily:.2f}")
    print(f"   Dívida Cirlene: R$ {debt_data['saldo_devedor']:.2f} restantes")

if __name__ == "__main__":
    process_sheet()
