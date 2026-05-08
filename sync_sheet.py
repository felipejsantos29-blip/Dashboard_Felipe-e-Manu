import gspread
from oauth2client.service_account import ServiceAccountCredentials
import json
import os
from datetime import datetime, timedelta
from collections import defaultdict

SHEET_ID = "1BGYyMz9BZ0ypEaJfv5InDWwVZ73iK58p9W-QOsBY3Gk"
RENDA_LIQUIDA_REAL = 3500  # Sua renda líquida mensal real

# ============================================================
# 1. REGRAS DE CATEGORIZAÇÃO (aba categorias_padrao)
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
    except:
        return []

def categorizar_descricao(descricao, rules):
    desc_upper = descricao.upper()
    for rule in rules:
        if rule['palavra'] in desc_upper:
            return rule['categoria'], rule['tipo']
    return "Outros", "Despesa"

# ============================================================
# 2. MOVIMENTAÇÕES (aba movimentacoes) - GASTOS REAIS
# ============================================================
def load_movimentacoes(sheet, rules):
    try:
        worksheet = sheet.worksheet("movimentacoes")
        records = worksheet.get_all_records()
        
        gastos = []
        receitas = []
        
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
            
            # Ignorar transferências e movimentações internas
            desc_upper = desc.upper()
            if 'TRANSF' in desc_upper and 'PIX TRANSF' in desc_upper:
                continue
            if 'PAGAMENTO PARCELA EMPRESTIMO' in desc_upper:
                continue
            if 'FATURA PAGA' in desc_upper:
                continue
            if 'APLICACAO' in desc_upper:
                continue
            
            # Categorizar
            categoria, tipo = categorizar_descricao(desc, rules)
            if categoria_original and categoria_original not in ['Outros', '']:
                categoria = categoria_original
            
            if tipo == 'Receita' and valor > 0 and valor < 20000:
                receitas.append({
                    'data': data_str,
                    'descricao': desc[:40],
                    'valor': round(valor, 2),
                    'categoria': categoria
                })
            elif tipo == 'Despesa' and valor < 0 and abs(valor) < 2000:
                gastos.append({
                    'data': data_str,
                    'descricao': desc[:40],
                    'valor': round(abs(valor), 2),
                    'categoria': categoria
                })
        
        print(f"📊 Movimentações: {len(gastos)} gastos, {len(receitas)} receitas")
        return gastos, receitas
    except Exception as e:
        print(f"❌ Erro: {e}")
        return [], []

# ============================================================
# 3. DÍVIDA CIRLENE (aba financiamento_emprestimo)
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
        
        # Calcular saldo atual baseado na data atual
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
    except:
        return [], 35000

# ============================================================
# 4. RECEITAS FIXAS E DESPESAS RECORRENTES
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
        return receitas
    except:
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
                    'valor': abs(float(row.get('valor_mensal', 0))),
                    'dia_vencimento': int(row.get('dia_vencimento', 0))
                })
        return despesas
    except:
        return []

# ============================================================
# 5. PROJEÇÃO MENSAL
# ============================================================
def load_projecao_mensal(sheet):
    try:
        worksheet = sheet.worksheet("projecao_mensal")
        records = worksheet.get_all_records()
        projecao = []
        for row in records:
            mes = row.get('mes', '')
            if mes:
                projecao.append({
                    'mes': mes,
                    'salario_previsto': float(row.get('salario_previsto', 0) or 0),
                    'despesas_recorrentes': abs(float(row.get('despesas_recorrentes', 0) or 0)),
                    'parcela_emprestimo': abs(float(row.get('parcela_emprestimo', 0) or 0)),
                    'parcela_semestral': abs(float(row.get('parcela_semestral', 0) or 0))
                })
        return projecao
    except:
        return []

# ============================================================
# 6. PROCESSAMENTO PRINCIPAL
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
    
    # Carregar todas as abas
    rules = load_categoria_rules(sheet)
    gastos, receitas = load_movimentacoes(sheet, rules)
    amortizacao, saldo_devedor = load_amortizacao(sheet)
    receitas_fixas = load_receitas_fixas(sheet)
    despesas_recorrentes = load_despesas_recorrentes(sheet)
    projecao_mensal = load_projecao_mensal(sheet)
    
    # Totais gerais
    total_receitas = sum(r['valor'] for r in receitas) + sum(r['valor'] for r in receitas_fixas)
    total_gastos = sum(g['valor'] for g in gastos) + sum(d['valor'] for d in despesas_recorrentes)
    saldo_total = total_receitas - total_gastos
    
    # Gastos por categoria (para gráfico de donut)
    categorias = defaultdict(float)
    for g in gastos:
        categorias[g['categoria']] += g['valor']
    for d in despesas_recorrentes:
        categorias[d['categoria']] += d['valor']
    
    # Gastos mensais (para gráfico de evolução)
    gastos_mensais = defaultdict(float)
    for g in gastos:
        mes = g['data'][:7] if g['data'] else '2026-01'
        gastos_mensais[mes] += g['valor']
    
    receitas_mensais = defaultdict(float)
    for r in receitas:
        mes = r['data'][:7] if r['data'] else '2026-01'
        receitas_mensais[mes] += r['valor']
    
    # Média diária (últimos 30 dias)
    trinta_dias_atras = datetime.now() - timedelta(days=30)
    gastos_ultimos_30 = 0
    for g in gastos:
        try:
            data_g = datetime.strptime(g['data'], '%Y-%m-%d')
            if data_g >= trinta_dias_atras:
                gastos_ultimos_30 += g['valor']
        except:
            pass
    media_diaria = gastos_ultimos_30 / 30 if gastos_ultimos_30 > 0 else 0
    
    # Calcular taxa de esforço
    taxa_esforco = (total_gastos / total_receitas) * 100 if total_receitas > 0 else 0
    
    # Calcular dias de reserva
    dias_reserva = saldo_total / media_diaria if media_diaria > 0 else 0
    
    # Sugestões de limites por categoria (baseado na renda real)
    limites_sugeridos = {
        'Alimentação': round(RENDA_LIQUIDA_REAL * 0.22, 2),
        'Transporte': round(RENDA_LIQUIDA_REAL * 0.10, 2),
        'Saúde': round(RENDA_LIQUIDA_REAL * 0.08, 2),
        'Pet': round(RENDA_LIQUIDA_REAL * 0.05, 2),
        'Educação': round(RENDA_LIQUIDA_REAL * 0.08, 2),
        'Lazer': round(RENDA_LIQUIDA_REAL * 0.07, 2),
        'Compras': round(RENDA_LIQUIDA_REAL * 0.05, 2),
        'Serviços': round(RENDA_LIQUIDA_REAL * 0.03, 2)
    }
    
    # Gastos essenciais Ana Lua + Mandelinha
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
        'rendaLiquida': RENDA_LIQUIDA_REAL,
        'totalReceitas': round(total_receitas, 2),
        'totalGastos': round(total_gastos, 2),
        'saldoTotal': round(saldo_total, 2),
        'mediaDiaria': round(media_diaria, 2),
        'taxaEsforco': round(taxa_esforco, 1),
        'diasReserva': round(dias_reserva, 1),
        'gastosMensais': {k: round(v, 2) for k, v in sorted(gastos_mensais.items())[-6:]},
        'receitasMensais': {k: round(v, 2) for k, v in sorted(receitas_mensais.items())[-6:]},
        'gastosPorCategoria': {k: round(v, 2) for k, v in sorted(categorias.items(), key=lambda x: x[1], reverse=True)},
        'limitesSugeridos': limites_sugeridos,
        'debt': {
            'valor_total': 35000,
            'saldo_devedor': round(saldo_devedor, 2),
            'parcela_mensal': 500,
            'parcela_semestral': 4000,
            'amortizacao': amortizacao[-12:]  # últimos 12 meses para gráfico
        },
        'extrato': gastos[:100],  # últimas 100 transações
        'receitasFixas': receitas_fixas,
        'despesasRecorrentes': despesas_recorrentes,
        'projecaoMensal': projecao_mensal[:12],
        'custosEssenciais': custos_essenciais,
        'stats': {
            'total_gastos': len(gastos),
            'total_receitas': len(receitas),
            'total_transacoes': len(gastos) + len(receitas)
        }
    }
    
    with open('data.json', 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ SUCESSO! Dashboard atualizado:")
    print(f"   📊 {len(gastos)} gastos processados")
    print(f"   💰 Receitas: R$ {total_receitas:.2f}")
    print(f"   💸 Despesas: R$ {total_gastos:.2f}")
    print(f"   ⚖️  Saldo: R$ {saldo_total:.2f}")
    print(f"   📅 Média diária: R$ {media_diaria:.2f}")
    print(f"   🏦 Dívida Cirlene: R$ {saldo_devedor:.2f}")

if __name__ == "__main__":
    process_sheet()
