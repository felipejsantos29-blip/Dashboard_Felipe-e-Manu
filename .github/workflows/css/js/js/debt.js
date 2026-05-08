/**
 * WealthAurora - Módulo de Dívidas
 * Gerencia o empréstimo Cirlene, parcelas, simulador de amortização
 */

class DebtManager {
  constructor(dataService) {
    this.dataService = dataService;
    this.data = null;
  }

  async init() {
    this.data = await this.dataService.fetchData();
    this.render();
    this.setupSimulator();
  }

  render() {
    const debt = this.data?.emprestimo || {};
    const parcelas = debt.parcelas || [];
    const totalParcelas = debt.totalParcelas || 30;
    const parcelasPagas = debt.parcelasPagas || 0;
    const saldoDevedor = this.calculateCurrentBalance(parcelas);
    const percentPago = ((debt.valorOriginal - saldoDevedor) / debt.valorOriginal) * 100;

    // Atualizar summary
    const summaryHtml = `
      <div class="debt-summary">
        <div><span class="text-slate-400">Credor</span><br><strong class="text-teal-300">${debt.nomeCredor || 'Cirlene'}</strong></div>
        <div><span class="text-slate-400">Valor Original</span><br><strong>R$ ${(debt.valorOriginal || 35000).toLocaleString('pt-BR')}</strong></div>
        <div><span class="text-slate-400">Saldo Devedor</span><br><strong class="text-rose-300">R$ ${saldoDevedor.toLocaleString('pt-BR')}</strong></div>
      </div>
    `;
    
    const debtSummary = document.getElementById('debtSummary');
    const debtProgress = document.getElementById('debtProgressFill');
    const debtStats = document.getElementById('debtStats');
    
    if (debtSummary) debtSummary.innerHTML = summaryHtml;
    if (debtProgress) debtProgress.style.width = `${Math.min(100, percentPago)}%`;
    if (debtStats) {
      debtStats.innerHTML = `
        <span>📊 ${parcelasPagas} de ${totalParcelas} parcelas pagas</span>
        <span>🎯 Quitação prevista: ${this.getPrevisaoQuitacao(parcelas)}</span>
      `;
    }

    // Renderizar lista de parcelas
    this.renderParcelasList(parcelas, parcelasPagas);
    
    // Verificar parcelas pesadas (com pagamento semestral)
    this.checkHeavyInstallments(parcelas);
  }

  calculateCurrentBalance(parcelas) {
    if (!parcelas.length) return 35000;
    const hoje = new Date();
    let saldo = 35000;
    for (const p of parcelas) {
      const dataParcela = new Date(p.data);
      if (dataParcela <= hoje && p.status !== 'Paga') {
        saldo = p.saldo || (saldo - p.total);
      }
    }
    return Math.max(0, saldo);
  }

  getPrevisaoQuitacao(parcelas) {
    const ultimaParcela = parcelas[parcelas.length - 1];
    if (ultimaParcela && ultimaParcela.data) {
      const data = new Date(ultimaParcela.data);
      return data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
    return 'Novembro/2028';
  }

  renderParcelasList(parcelas, parcelasPagas) {
    const container = document.getElementById('parcelasList');
    if (!container) return;

    const hoje = new Date();
    const proximasParcelas = parcelas.slice(0, 12); // Próximas 12 parcelas

    container.innerHTML = proximasParcelas.map(p => {
      const dataParcela = new Date(p.data);
      const isPaga = p.status === 'Paga' || dataParcela < hoje;
      const isHeavy = p.valorExtra !== 0 && p.valorExtra < 0;
      const isNext = !isPaga && dataParcela >= hoje && 
                     (!proximasParcelas.find(p2 => !p2.status && new Date(p2.data) > dataParcela));
      
      let classes = 'parcela-item';
      if (isPaga) classes += ' parcela-paga';
      if (isNext) classes += ' highlight';
      
      const valorTotal = Math.abs(p.total || p.valorMensal + (p.valorExtra || 0));
      
      return `
        <div class="${classes}">
          <div>
            <strong>Parcela ${p.numero}</strong> - ${new Date(p.data).toLocaleDateString('pt-BR')}
            ${isHeavy ? '<span class="limit-badge warning ml-2">⚠️ Semestral</span>' : ''}
          </div>
          <div class="font-mono">R$ ${valorTotal.toLocaleString('pt-BR')}</div>
        </div>
      `;
    }).join('');
  }

  checkHeavyInstallments(parcelas) {
    const alertContainer = document.getElementById('parcelaPesadaAlert');
    if (!alertContainer) return;

    const heavyInstallments = parcelas.filter(p => p.valorExtra && p.valorExtra !== 0 && p.valorExtra < 0);
    if (heavyInstallments.length > 0) {
      const proximaPesada = heavyInstallments.find(p => new Date(p.data) > new Date());
      if (proximaPesada) {
        alertContainer.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i> 
          ⚠️ Atenção! Em ${new Date(proximaPesada.data).toLocaleDateString('pt-BR')} você terá parcela de 
          R$ ${Math.abs(proximaPesada.total).toLocaleString('pt-BR')} (inclui R$ 4.000 do pagamento semestral)
        `;
        alertContainer.classList.remove('hidden');
      } else {
        alertContainer.classList.add('hidden');
      }
    } else {
      alertContainer.classList.add('hidden');
    }
  }

  setupSimulator() {
    const btn = document.getElementById('calcularSimulacao');
    const input = document.getElementById('extraAmort');
    const resultDiv = document.getElementById('simulacaoResultado');
    
    if (!btn || !input || !resultDiv) return;

    btn.addEventListener('click', () => {
      const extra = parseFloat(input.value) || 0;
      const debt = this.data?.emprestimo || {};
      const parcelas = debt.parcelas || [];
      const saldoAtual = this.calculateCurrentBalance(parcelas);
      const parcelaBase = 500;
      const totalMensal = parcelaBase + extra;
      
      const mesesRestantes = Math.ceil(saldoAtual / totalMensal);
      const dataQuitacao = new Date();
      dataQuitacao.setMonth(dataQuitacao.getMonth() + mesesRestantes);
      
      const mesesOriginais = parcelas.length;
      const mesesEconomizados = Math.max(0, mesesOriginais - mesesRestantes);
      const economiaEstimada = mesesEconomizados * parcelaBase;
      
      resultDiv.innerHTML = `
        <i class="fas fa-chart-line"></i>
        Com +R$ ${extra.toLocaleString('pt-BR')}/mês, você quita em ${mesesRestantes} meses 
        (${dataQuitacao.toLocaleDateString('pt-BR')})
        ${mesesEconomizados > 0 ? `<br>📉 Economia de ${mesesEconomizados} meses (~R$ ${economiaEstimada.toLocaleString('pt-BR')} em parcelas)` : ''}
      `;
    });
  }
}

// Inicializar quando o DOM estiver pronto
let debtManager;
document.addEventListener('DOMContentLoaded', async () => {
  debtManager = new DebtManager(dataService);
  await debtManager.init();
});
