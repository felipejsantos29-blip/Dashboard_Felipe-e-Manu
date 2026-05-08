/**
 * WealthAurora - Main Entry Point
 * Inicializa todos os módulos e orquestra o carregamento
 */

// Variáveis globais para acesso entre módulos
window.dataService = dataService;
window.chartsManager = null;
window.debtManager = null;
window.insightsManager = null;
window.uiManager = null;

// Atualizar cards principais
async function updateMainCards() {
  const data = await dataService.fetchData();
  
  const saldoEl = document.getElementById('saldoAtual');
  const receitasEl = document.getElementById('totalReceitas');
  const despesasEl = document.getElementById('totalDespesas');
  const taxaEl = document.getElementById('taxaEsforco');
  const mediaDaily = document.getElementById('mediaDiaria');
  const diasReserva = document.getElementById('diasReserva');
  const capPoupanca = document.getElementById('capPoupanca');
  const poupancaBar = document.getElementById('poupancaBar');
  
  if (saldoEl) saldoEl.innerHTML = `R$ ${data.saldoAtual?.toLocaleString('pt-BR') || '0,00'}`;
  if (receitasEl) receitasEl.innerHTML = `R$ ${data.totalReceitas?.toLocaleString('pt-BR') || '0,00'}`;
  if (despesasEl) despesasEl.innerHTML = `R$ ${data.totalDespesas?.toLocaleString('pt-BR') || '0,00'}`;
  if (taxaEl) taxaEl.innerHTML = `${data.taxaEsforco?.toFixed(1) || 0}%`;
  if (mediaDaily) mediaDaily.innerHTML = `R$ ${data.mediaDiaria?.toLocaleString('pt-BR') || '0,00'}`;
  
  const dias = (data.reservaEmergencia / data.mediaDiaria).toFixed(0);
  if (diasReserva) diasReserva.innerHTML = dias || '0';
  
  const poupancaPercent = ((data.saldoAtual / data.totalReceitas) * 100).toFixed(1);
  if (capPoupanca) capPoupanca.innerHTML = `${poupancaPercent}%`;
  if (poupancaBar) poupancaBar.style.width = `${Math.min(100, poupancaPercent)}%`;
}

// Inicialização completa
document.addEventListener('DOMContentLoaded', async () => {
  // Mostrar loading
  const loadingEl = document.getElementById('loadingState');
  const dashboardEl = document.getElementById('dashboardContent');
  
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (dashboardEl) dashboardEl.classList.add('hidden');
  
  try {
    // Carregar dados primeiro
    const data = await dataService.fetchData();
    
    // Inicializar módulos sequencialmente
    window.chartsManager = new ChartsManager(dataService);
    window.debtManager = new DebtManager(dataService);
    window.insightsManager = new InsightsManager(dataService);
    window.uiManager = new UIManager(dataService);
    
    await Promise.all([
      window.chartsManager.init(),
      window.debtManager.init(),
      window.insightsManager.init(),
      window.uiManager.init()
    ]);
    
    await updateMainCards();
    
    // Esconder loading, mostrar dashboard
    if (loadingEl) loadingEl.classList.add('hidden');
    if (dashboardEl) dashboardEl.classList.remove('hidden');
    
    // Atualizar data/hora da última atualização
    const timeEl = document.getElementById('lastUpdateTime');
    if (timeEl) {
      const now = new Date();
      timeEl.innerHTML = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    
    console.log('✅ WealthAurora inicializado com sucesso!');
  } catch (error) {
    console.error('❌ Erro na inicialização:', error);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div class="text-center p-8">
          <i class="fas fa-exclamation-triangle text-amber-400 text-4xl mb-3"></i>
          <p class="text-red-300">Erro ao carregar o dashboard</p>
          <p class="text-xs text-slate-400 mt-2">${error.message}</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-teal-500 rounded-lg">Tentar novamente</button>
        </div>
      `;
    }
  }
});

// Recarregar dados periodicamente (a cada 5 minutos)
setInterval(async () => {
  if (window.dataService) {
    await window.dataService.fetchData(true);
    await updateMainCards();
    if (window.chartsManager) await window.chartsManager.init();
    if (window.debtManager) await window.debtManager.init();
    if (window.insightsManager) await window.insightsManager.init();
  }
}, 5 * 60 * 1000);
