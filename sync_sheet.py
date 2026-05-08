import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

SHEET_ID = "1BGYyMz9BZ0ypEaJfv5InDWwVZ73iK58p9W-QOsBY3Gk"

# ============================================================
# 1. LER ABA: categorias_padrao (regras de categorização)
# ============================================================
def load_categoria_rules(sheet):
    try:
        worksheet = sheet.worksheet("categorias_padrao")
        records = worksheet.get_all_records()
        rules = []
        for row in records:
            if row.get('palavra_chave') and row.get('categoria'):
                rules.append({
                    'palavra': row['palavra_chave'].upper(),
                    'categoria': row['categoria'],
                    'subcategoria': row.get('subcategoria', ''),
                    'tipo': row.get('tipo', 'Despesa')
                })
        print(f"📌 Carregadas {len(rules)} regras de categorização")
        return rules
    except Exception as e:
        print(f"⚠️ Erro ao carregar categorias_padrao: {e}")
        return []

def categorizar_descricao(descricao, rules):
    desc_upper = descricao.upper()
    for rule in rules:
        if rule['palavra'] in desc_upper:
            return rule['categoria'], rule['tipo']
    return "Outros", "Despesa"

# ============================================================
# 2. LER ABA: movimentacoes (histórico real)
# ============================================================
def load_movimentacoes(sheet, rules):
    try:
        worksheet = sheet.worksheet("movimentacoes")
        records = worksheet.get_all_records()
        
        gastos_reais = []
        receitas_reais = []
        
        for row in records:
            desc = str(row.get('descricao', ''))
            if desc == 'SALDO DO DIA':
                continue
            
            valor_str = str(row.get('valor', '0')).replace(',', '.')
            try:
                valor = float(valor_str)
            except:
                valor = 0
            
            data_str = str(row.get('data', ''))
            categoria_original = str(row.get('categoria', ''))
            
            # Usar regras de categorização
            categoria, tipo = categorizar_descricao(desc, rules)
            if categoria_original and categoria_original not in ['Outros', '']:
                categoria = categoria_original
            
            # Ignorar transferências e movimentações internas
            if 'TRANSF' in desc.upper() and 'PIX TRANSF' in desc.upper():
                continue
            if 'APLICACAO' in desc.upper() or 'RESGATE' in desc.upper():
                continue
            if 'FATURA PAGA' in desc.upper():
                continue
            
            if tipo == 'Receita' and valor > 0:
                receitas_reais.append({
                    'data': data_str,
                    'descricao': desc,
                    'valor': valor,
                    'categoria': categoria
                })
            elif tipo == 'Despesa' and valor < 0:
                gastos_reais.append({
                    'data': data_str,
                    'descricao': desc,
                    'valor': abs(valor),
                    'categoria': categoria
                })
        
        print(f"📊 Movimentações: {len(gastos_reais)} gastos, {len(receitas_reais)} receitas")
        return gastos_reais, receitas_reais
    except Exception as e:
        print(f"❌ Erro ao carregar movimentacoes: {e}")
        return [], []

# ============================================================
# 3. LER ABA: financiamento_emprestimo (dívida Cirlene)
# ============================================================
def load_amortizacao(sheet):
    try:
        worksheet = sheet.worksheet("financiamento_emprestimo")
        records = worksheet.get_all_records()
        
        amortizacao = []
        for row in records:
            amortizacao.append({
                'data': row.get('data_vencimento', ''),
                'parcela': int(row.get('parcela_numero', 0)),
                'valor_mensal': float(row.get('valor_mensal', 0)),
                'valor_semestral': float(row.get('valor_semestral_extra', 0)),
                'valor_total': float(row.get('valor_total_parcela', 0)),
                'saldo_apos': float(row.get('saldo_devedor_apos', 0)),
                'status': row.get('status', 'Pendente')
            })
        
        # Calcular saldo atual
        hoje = datetime.now()
        saldo_atual = 35000
        for parcela in amortizacao:
            try:
                data_parcela = datetime.strptime(parcela['data'], '%Y-%m-%d')
                if data_parcela <= hoje:
                    saldo_atual = parcela['saldo_apos']
            except:
                pass
        
        print(f"💸 Dívida Cirlene: saldo atual R$ {saldo_atual:.2f}")
        return amortizacao, saldo_atual
    except Exception as e:
        print(f"❌ Erro ao carregar financiamento_emprestimo: {e}")
        return [], 35000

# ============================================================
# 4. LER ABA: receitas_fixas + despesas_recorrentes
# ============================================================
def load_receitas_fixas(sheet):
    try:
        worksheet = sheet.worksheet("receitas_fixas")
        records = worksheet.get_all_records()
        receitas = []
        for row in records:
            if row.get('ativo', 'True') in [True, 'True', 'true', 1, '1']:
                receitas.append({
                    'descricao': row.get('descricao', ''),
                    'valor': float(row.get('valor_esperado', 0)),
                    'dia_previsto': int(row.get('dia_previsto', 15))
                })
        print(f"💰 Receitas fixas: {len(receitas)} fontes")
        return receitas
    except Exception as e:
        print(f"⚠️ Erro ao carregar receitas_fixas: {e}")
        return []

def load_despesas_recorrentes(sheet):
    try:
        worksheet = sheet.worksheet("despesas_recorrentes")
        records = worksheet.get_all_records()
        despesas = []
        for row in records:
            if row.get('ativo', 'True') in [True, 'True', 'true', 1, '1']:
                despesas.append({
                    'descricao': row.get('descricao', ''),
                    'categoria': row.get('categoria', 'Outros'),
                    'valor': float(row.get('valor_mensal', 0)),
                    'dia_vencimento': int(row.get('dia_vencimento', 0))
                })
        print(f"💸 Despesas recorrentes: {len(despesas)} itens")
        return despesas
    except Exception as e:
        print(f"⚠️ Erro ao carregar despesas_recorrentes: {e}")
        return []

# ============================================================
# 5. LER ABA: projecao_mensal
# ============================================================
def load_projecao_mensal(sheet):
    try:
        worksheet = sheet.worksheet("projecao_mensal")
        records = worksheet.get_all_records()
        projecao = []
        for row in records:
            projecao.append({
                'mes': row.get('mes', ''),
                'salario_previsto': float(row.get('salario_previsto', 0) or 0),
                'despesas_recorrentes': float(row.get('despesas_recorrentes', 0) or 0),
                'parcela_emprestimo': float(row.get('parcela_emprestimo', 0) or 0),
                'parcela_semestral': float(row.get('parcela_semestral', 0) or 0),
                'saldo_projetado': float(row.get('saldo_projetado', 0) or 0)
            })
        print(f"📅 Projeção mensal: {len(projecao)} meses")
        return projecao
    except Exception as e:
        print(f"⚠️ Erro ao carregar projecao_mensal: {e}")
        return []

# ============================================================
# PROCESSAMENTO PRINCIPAL
# ============================================================
def process_sheet():
    creds_json = os.environ.get('GOOGLE_CREDENTIALS')
    if not creds_json:
        print("❌ ERRO: GOOGLE_CREDENTIALS não encontrado")
        return
    
    creds_dict = json.loads(creds_json)
    scope = ['https://spreadsheets.google.com/feeds', 'https://www.googleapis.com/auth/drive']
    creds = ServiceAccountCredentials.from_json_keyfile_dict(creds_dict, scope)
    client = gspread.authorize(creds)
    
    sheet = client.open_by_key(SHEET_ID)
    print(f"📂 Planilha carregada: {sheet.title}")
    
    # Carregar regras
    rules = load_categoria_rules(sheet)
    
    # Carregar movimentações
    gastos_reais, receitas_reais = load_movimentacoes(sheet, rules)
    
    # Carregar dívida
    amortizacao, saldo_devedor = load_amortizacao(sheet)
    
    # Carregar planejamento
    receitas_fixas = load_receitas_fixas(sheet)
    despesas_recorrentes = load_despesas_recorrentes(sheet)
    projecao_mensal = load_projecao_mensal(sheet)
    
    # Totais
    total_gastos = sum(g['valor'] for g in gastos_reais)
    total_receitas = sum(r['valor'] for r in receitas_reais)
    
    # Gastos por categoria
    categorias = defaultdict(float)
    for g in gastos_reais:
        categorias[g['categoria']] += g['valor']
    
    # Gastos mensais
    gastos_mensais = defaultdict(float)
    receitas_mensais = defaultdict(float)
    
    for g in gastos_reais:
        mes = g['data'][:7] if g['data'] else '2026-01'
        gastos_mensais[mes] += g['valor']
    
    for r in receitas_reais:
        mes = r['data'][:7] if r['data'] else '2026-01'
        receitas_mensais[mes] += r['valor']
    
    # Média diária dos últimos 30 dias
    trinta_dias_atras = datetime.now() - timedelta(days=30)
    gastos_ultimos_30 = 0
    for g in gastos_reais:
        try:
            data_g = datetime.strptime(g['data'], '%Y-%m-%d')
            if data_g >= trinta_dias_atras:
                gastos_ultimos_30 += g['valor']
        except:
            pass
    media_diaria = gastos_ultimos_30 / 30 if gastos_ultimos_30 > 0 else 0
    
    # Custos Essenciais Filha + Pet (fixos)
    custos_essenciais = {
        'ana_lua': [
            {'nome': 'Leite Nan', 'valor': 280},
            {'nome': 'Pomada', 'valor': 40},
            {'nome': 'Lenço umedecido', 'valor': 60},
            {'nome': 'Farmácia', 'valor': 150},
            {'nome': 'Comida (papinha)', 'valor': 50}
        ],
        'mandelinha': [
            {'nome': 'Fralda pet', 'valor': 120},
            {'nome': 'Plano Pet Love', 'valor': 59}
        ]
    }
    
    # Montar JSON final
    result = {
        'lastUpdate': datetime.now().isoformat(),
        'totalIncome': round(total_receitas, 2),
        'totalExpense': round(total_gastos, 2),
        'balance': round(total_receitas - total_gastos, 2),
        'avgDailyExpense': round(media_diaria, 2),
        'categories': {k: round(v, 2) for k, v in sorted(categorias.items(), key=lambda x: x[1], reverse=True)},
        'topCategories': sorted(categorias.items(), key=lambda x: x[1], reverse=True)[:6],
        'monthlyData': {
            'expense': {k: round(v, 2) for k, v in sorted(gastos_mensais.items())[-6:]},
            'income': {k: round(v, 2) for k, v in sorted(receitas_mensais.items())[-6:]}
        },
        'debt': {
            'credor': 'Cirlene',
            'valor_total': 35000,
            'saldo_devedor': round(saldo_devedor, 2),
            'parcela_mensal': 500,
            'parcela_semestral': 4000,
            'amortizacao': amortizacao
        },
        'fixedPlaning': {
            'receitas_fixas': receitas_fixas,
            'despesas_recorrentes': despesas_recorrentes,
            'projecao_mensal': projecao_mensal
        },
        'essentialExpenses': custos_essenciais,
        'stats': {
            'total_transactions': len(gastos_reais) + len(receitas_reais),
            'total_gastos': len(gastos_reais),
            'total_receitas': len(receitas_reais)
        }
    }
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ SUCESSO! Dashboard atualizado:")
    print(f"   📊 {len(gastos_reais)} gastos processados")
    print(f"   💰 Receitas: R$ {total_receitas:.2f}")
    print(f"   💸 Despesas: R$ {total_gastos:.2f}")
    print(f"   ⚖️  Saldo: R$ {(total_receitas - total_gastos):.2f}")
    print(f"   📅 Média diária: R$ {media_diaria:.2f}")
    print(f"   🏦 Dívida Cirlene: R$ {saldo_devedor:.2f}")

if __name__ == "__main__":
    process_sheet()
