/**
 * WealthAurora - Módulo de Insights Automáticos
 * Gera frases dinâmicas baseadas nos dados do mês
 */

class InsightsManager {
  constructor(dataService) {
    this.dataService = dataService;
  }

  async init() {
    const data = await this.dataService.fetchData();
    this.generateInsights(data);
    this.calculateHealthScore(data);
  }

  generateInsights(data) {
    const container = document.getElementById('insightText');
    if (!container) return;

    const insights = [];
    const categorias = data.categorias || [];
    const evolucao = data.evolucaoMensal || [];
    
    // Insight 1: Variação de gastos (comparar último mês com anterior)
    if (evolucao.length >= 2) {
      const ultimo = evolucao[evolucao.length - 1];
      const anterior = evolucao[evolucao.length - 2];
      const variacao = ((ultimo.despesa - anterior.despesa) / anterior.despesa) * 100;
      
      if (variacao < 0) {
        insights.push(`📉 Você gastou ${Math.abs(variacao).toFixed(1)}% MENOS em ${ultimo.mes} comparado ao mês anterior! Continue assim!`);
      } else if (variacao > 0 && variacao < 10) {
        insights.push(`📊 Seus gastos aumentaram ${variacao.toFixed(1)}% em ${ultimo.mes}. Fique de olho!`);
      } else if (variacao >= 10) {
        insights.push(`⚠️ Atenção! Seus gastos aumentaram ${variacao.toFixed(1)}% em ${ultimo.mes}. Revisar urgente!`);
      }
    }
    
    // Insight 2: Categoria mais próxima do limite
    const categoriasProximas = categorias
      .map(c => ({ ...c, percent: (c.gasto / c.limite) * 100 }))
      .filter(c => c.percent >= 80)
      .sort((a, b) => b.percent - a.percent);
    
    if (categoriasProximas.length > 0) {
      const top = categoriasProximas[0];
      const faltam = top.limite - top.gasto;
      insights.push(`🎯 ${top.nome} está em ${top.percent.toFixed(0)}% do limite. Faltam R$ ${faltam.toLocaleString('pt-BR')} para o teto!`);
    }
    
    // Insight 3: Capacidade de poupança
    const poupancaPercent = ((data.saldoAtual / data.totalReceitas) * 100);
    if (poupancaPercent >= 20) {
      insights.push(`💰 Excelente! Sua capacidade de poupança é de ${poupancaPercent.toFixed(0)}% da sua renda.`);
    } else if (poupancaPercent > 0) {
      insights.push(`📈 Este mês você poupou R$ ${data.saldoAtual.toLocaleString('pt-BR')}. Continue firme!`);
    } else if (poupancaPercent <= 0) {
      insights.push(`🔴 Seus gastos superaram sua renda. Revise as categorias em alerta vermelho!`);
    }
    
    // Se não houver insights, mostrar mensagem padrão
    if (insights.length === 0) {
      insights.push('✅ Tudo dentro do esperado! Continue monitorando seus gastos.');
    }
    
    // Mostrar primeiro insight (o mais urgente)
    container.innerHTML = insights[0];
    
    // Adicionar tooltip com os demais insights
    if (insights.length > 1) {
      container.title = insights.slice(1).join('\n');
    }
  }

  calculateHealthScore(data) {
    let score = 0;
    const categorias = data.categorias || [];
    const saldo = data.saldoAtual;
    const receitas = data.totalReceitas;
    const emprestimo = data.emprestimo || {};
    
    // 1. Capacidade de poupança ≥ 20% → +30 pontos
    const poupancaPercent = (saldo / receitas) * 100;
    if (poupancaPercent >= 20) score += 30;
    else if (poupancaPercent >= 10) score += 15;
    else if (poupancaPercent >= 5) score += 5;
    
    // 2. Reserva de emergência ≥ 3 meses → +25 pontos
    const mediaGastoMensal = data.totalDespesas;
    const mesesReserva = data.reservaEmergencia / mediaGastoMensal;
    if (mesesReserva >= 6) score += 25;
    else if (mesesReserva >= 3) score += 15;
    else if (mesesReserva >= 1) score += 5;
    
    // 3. Nenhuma categoria com gasto > 100% do limite → +20 pontos
    const hasOverLimit = categorias.some(c => c.gasto > c.limite);
    if (!hasOverLimit) score += 20;
    else score += 5;
    
    // 4. Dívidas < 30% da renda mensal → +25 pontos
    const parcelaMensal = Math.abs(emprestimo.parcelaMensal || 500);
    const porcentagemDivida = (parcelaMensal / receitas) * 100;
    if (porcentagemDivida < 30) score += 25;
    else if (porcentagemDivida < 50) score += 10;
    
    // Atualizar UI
    const scoreElement = document.getElementById('healthScore');
    const scoreBar = document.getElementById('healthScoreBar');
    const statusElement = document.getElementById('healthStatus');
    
    if (scoreElement) scoreElement.innerText = score;
    if (scoreBar) scoreBar.style.width = `${score}%`;
    
    let status = '', cor = '';
    if (score >= 70) {
      status = '🎉 Finanças Saudáveis! Continue assim!';
      cor = '#34D399';
    } else if (score >= 40) {
      status = '📊 Em construção. Há pontos para melhorar!';
      cor = '#FBBF24';
    } else {
      status = '⚠️ Atenção necessária! Reveja seus gastos urgentemente.';
      cor = '#EF4444';
    }
    
    if (scoreBar) scoreBar.style.backgroundColor = cor;
    if (statusElement) statusElement.innerHTML = status;
  }
}

// Inicializar
let insightsManager;
document.addEventListener('DOMContentLoaded', async () => {
  insightsManager = new InsightsManager(dataService);
  await insightsManager.init();
});
