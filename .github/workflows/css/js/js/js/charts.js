/**
 * WealthAurora - Módulo de Gráficos
 * Gerencia charts.js: evolução mensal, categorias, limites
 */

class ChartsManager {
  constructor(dataService) {
    this.dataService = dataService;
    this.monthlyChart = null;
    this.categoryChart = null;
  }

  async init() {
    const data = await this.dataService.fetchData();
    this.renderMonthlyChart(data);
    this.renderCategoryChart(data);
    this.renderLimitsList(data);
  }

  renderMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;

    const evolucao = data.evolucaoMensal || [];
    const labels = evolucao.map(e => e.mes);
    const receitas = evolucao.map(e => e.receita);
    const despesas = evolucao.map(e => e.despesa);

    if (this.monthlyChart) this.monthlyChart.destroy();
    
    this.monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Receitas',
            data: receitas,
            borderColor: '#34D399',
            backgroundColor: 'rgba(52,211,153,0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#34D399'
          },
          {
            label: 'Despesas',
            data: despesas,
            borderColor: '#FB7185',
            backgroundColor: 'rgba(251,113,133,0.1)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#FB7185'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: '#94A3B8' } },
          tooltip: { callbacks: { label: (ctx) => `R$ ${ctx.raw.toLocaleString('pt-BR')}` } }
        },
        scales: {
          y: { 
            ticks: { color: '#94A3B8', callback: (v) => `R$ ${v.toLocaleString('pt-BR')}` },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  renderCategoryChart(data) {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;

    const categorias = data.categorias || [];
    const labels = categorias.map(c => c.nome);
    const valores = categorias.map(c => c.gasto);
    const cores = categorias.map(c => c.cor || this.getRandomColor());

    if (this.categoryChart) this.categoryChart.destroy();
    
    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: valores, backgroundColor: cores, borderWidth: 0 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 10 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: R$ ${ctx.raw.toLocaleString('pt-BR')}` } }
        },
        onClick: (event, activeElements) => {
          if (activeElements.length > 0) {
            const index = activeElements[0].index;
            const categoria = labels[index];
            this.filterExtratoByCategory(categoria);
          }
        }
      }
    });

    // Legenda detalhada
    const legendContainer = document.getElementById('categoryLegend');
    if (legendContainer) {
      legendContainer.innerHTML = categorias.map(c => `
        <div class="flex justify-between items-center text-sm">
          <span><span class="inline-block w-3 h-3 rounded-full mr-2" style="background: ${c.cor || '#2DD4BF'}"></span>${c.nome}</span>
          <span class="font-mono">R$ ${c.gasto.toLocaleString('pt-BR')} (${((c.gasto / data.totalDespesas) * 100).toFixed(1)}%)</span>
        </div>
      `).join('');
    }
  }

  renderLimitsList(data) {
    const container = document.getElementById('limitesList');
    if (!container) return;

    const categorias = data.categorias || [];
    
    container.innerHTML = categorias.map(cat => {
      const percent = (cat.gasto / cat.limite) * 100;
      let statusClass = 'green';
      let badge = '';
      
      if (percent >= 90) {
        statusClass = 'red';
        badge = '<span class="limit-badge danger">⚠️ ATENÇÃO</span>';
      } else if (percent >= 70) {
        statusClass = 'yellow';
        badge = '<span class="limit-badge warning">⚡ Alerta</span>';
      }
      
      return `
        <div class="limit-item">
          <div class="limit-header">
            <span>${cat.nome}</span>
            <span>R$ ${cat.gasto.toLocaleString('pt-BR')} / R$ ${cat.limite.toLocaleString('pt-BR')} ${badge}</span>
          </div>
          <div class="limit-bar-bg">
            <div class="limit-bar-fill ${statusClass}" style="width: ${Math.min(100, percent)}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  filterExtratoByCategory(categoria) {
    // Mudar para aba de extrato e aplicar filtro
    const tabBtn = document.querySelector('.tab-btn[data-tab="extrato"]');
    if (tabBtn) tabBtn.click();
    
    const filtroCategoria = document.getElementById('filtroCategoria');
    if (filtroCategoria) {
      filtroCategoria.value = categoria;
      filtroCategoria.dispatchEvent(new Event('change'));
    }
    
    // Scroll até o extrato
    document.querySelector('.extrato-table-container')?.scrollIntoView({ behavior: 'smooth' });
  }

  getRandomColor() {
    const colors = ['#2DD4BF', '#FB7185', '#FBBF24', '#34D399', '#A78BFA', '#F97316', '#06B6D4', '#64748B'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}

// Inicializar
let chartsManager;
document.addEventListener('DOMContentLoaded', async () => {
  chartsManager = new ChartsManager(dataService);
  await chartsManager.init();
});
