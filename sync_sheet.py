import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

# ID DA SUA PLANILHA
SHEET_ID = "SHEET_ID = "1BGYyMz9BZ0ypEaJfv5InDWwVZ73iK58p9W-QOsBY3Gk"

def process_sheet():
    # Autenticar usando o secret do GitHub
    creds_json = os.environ.get('GOOGLE_CREDENTIALS')
    if not creds_json:
        print("❌ ERRO: GOOGLE_CREDENTIALS não encontrado")
        return
    
    creds_dict = json.loads(creds_json)
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    
    # Abrir planilha
    sheet = client.open_by_key(SHEET_ID).sheet1
    data = sheet.get_all_records()
    print(f"📊 Lidas {len(data)} linhas da planilha")
    
    # Processar dados
    total_income = 0
    total_expense = 0
    categories = {}
    
    for row in data:
        valor_str = str(row.get('valor', '0')).replace(',', '.')
        try:
            valor = float(valor_str)
        except:
            valor = 0
            
        desc = str(row.get('descricao', ''))
        cat = str(row.get('categoria', 'Outros'))
        
        if desc == 'SALDO DO DIA':
            continue
        
        if 'SALARIO' in desc or desc in ['REMUNERACAO/SALARIO', 'TEF CREDITO SALARIO']:
            total_income += abs(valor)
        elif valor < 0:
            total_expense += abs(valor)
            categories[cat] = categories.get(cat, 0) + abs(valor)
        elif valor > 0 and 'SALARIO' not in desc:
            total_income += valor
    
    # Calcular média diária
    last_30_days_expense = 0
    thirty_days_ago = datetime.now() - timedelta(days=30)
    for row in data:
        try:
            data_row = datetime.strptime(str(row.get('data', '')), '%Y-%m-%d')
            valor_str = str(row.get('valor', '0')).replace(',', '.')
            valor = float(valor_str)
            if data_row >= thirty_days_ago and valor < 0:
                last_30_days_expense += abs(valor)
        except:
            pass
    
    avg_daily = last_30_days_expense / 30 if last_30_days_expense > 0 else 0
    
    # Resultado
    result = {
        'lastUpdate': datetime.now().isoformat(),
        'totalIncome': round(total_income, 2),
        'totalExpense': round(total_expense, 2),
        'balance': round(total_income - total_expense, 2),
        'categories': {k: round(v, 2) for k, v in categories.items()},
        'avgDailyExpense': round(avg_daily, 2),
        'topCategories': sorted(categories.items(), key=lambda x: x[1], reverse=True)[:5]
    }
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Sucesso! Saldo: R$ {result['balance']:.2f}")

if __name__ == "__main__":
    process_sheet()
