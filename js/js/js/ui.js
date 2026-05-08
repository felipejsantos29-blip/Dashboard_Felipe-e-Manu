/**
 * WealthAurora - Módulo de Interface do Usuário
 * Gerencia tabs, dark mode, filtros do extrato, localStorage
 */

class UIManager {
  constructor(dataService) {
    this.dataService = dataService;
    this.currentTab = 'results';
    this.isDarkMode = true;
  }

  async init() {
    this.setupTabs();
    this.setupDarkMode();
    this.setupRefreshButton();
    this.setupExtratoFilters();
    this.setupMetas();
    this.loadDarkModePreference();
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        
        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.add('hidden'));
        
        tab.classList.add('active');
        const activeContent = document.getElementById(`tab-${tabId}`);
        if (activeContent) activeContent.classList.remove('hidden');
        
        this.currentTab = tabId;
      });
    });
  }

  setupDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    
    btn.addEventListener('click', () => {
      this.isDarkMode = !this.isDarkMode;
      if (this.isDarkMode) {
        document.body.classList.remove('light-mode');
        btn.innerHTML = '<i class="fas fa-moon"></i>';
      } else {
        document.body.classList.add('light-mode');
        btn.innerHTML = '<i class="fas fa-sun"></i>';
      }
      localStorage.setItem('wealthaurora_darkmode', this.isDarkMode);
    });
  }

  loadDarkModePreference() {
    const saved = localStorage.getItem('wealthaurora_darkmode');
    if (saved !== null) {
      this.isDarkMode = saved === 'true';
      if (!this.isDarkMode) {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('darkModeToggle');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
      }
    }
  }

  setupRefreshButton() {
    const btn = document.getElementById('refreshBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const data = await this.dataService.fetchData(true);
        this.updateLastUpdateTime(data);
        // Recarregar todos os módulos
        if (chartsManager) await chartsManager.init();
        if (debtManager) await debtManager.init();
        if (insightsManager) await insightsManager.init();
        this.renderEssenciais(data);
        this.renderReservaEmergencia(data);
        this.renderVariacoes(data);
      });
    }
    
    this.updateLastUpdateTime();
  }

  updateLastUpdateTime(data) {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement) {
      const now = new Date();
      timeElement.innerHTML = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
  }

  setupExtratoFilters() {
    const filtroMes = document.getElementById('filtroMes');
    const filtroCategoria = document.getElementById('filtroCategoria');
    const buscaInput = document.getElementById('buscaExtrato');
    const limparBtn = document.getElementById('limparFiltros');
    
    if (!filtroMes || !filtroCategoria) return;
    
    // Popular meses
    const meses = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
    filtroMes.innerHTML = '<option value="todos">Todos os meses</option>' + 
      meses.map(m => `<option value="${m}">${this.formatMonth(m)}</option>`).join('');
    
    // Eventos
    filtroMes.addEventListener('change', () => this.renderExtrato());
    filtroCategoria.addEventListener('change', () => this.renderExtrato());
    if (buscaInput) buscaInput.addEventListener('input', () => this.renderExtrato());
    if (limparBtn) limparBtn.addEventListener('click', () => {
      filtroMes.value = 'todos';
      filtroCategoria.value = 'todas';
      if (buscaInput) buscaInput.value = '';
      this.renderExtrato();
    });
    
    this.renderExtrato();
  }

  async renderExtrato() {
    const data = await this.dataService.fetchData();
    const extrato = data.extrato || [];
    const mes = document.getElementById('filtroMes')?.value || 'todos';
    const categoria = document.getElementById('filtroCategoria')?.value || 'todas';
    const busca = document.getElementById('buscaExtrato')?.value.toLowerCase() || '';
    
    let filtered = [...extrato];
    
    if (mes !== 'todos') {
      filtered = filtered.filter(e => e.data?.startsWith(mes));
    }
    if (categoria !== 'todas') {
      filtered = filtered.filter(e => e.categoria === categoria);
    }
    if (busca) {
      filtered = filtered.filter(e => e.descricao?.toLowerCase().includes(busca) || e.categoria?.toLowerCase().includes(busca));
    }
    
    const tbody = document.getElementById('extratoBody');
    const total = filtered.reduce((s, e) => s + (Math.abs(e.valor) || 0), 0);
    
    if (tbody) {
      tbody.innerHTML = filtered.slice(0, 100).map(e => `
        <tr>
          <td>${e.data || '-'}</td>
          <td>${e.descricao || '-'}</td>
          <td><span class="bg-slate-700/50 px-2 py-0.5 rounded-full text-xs">${e.categoria || 'Outros'}</span></td>
          <td class="${e.valor < 0 ? 'text-emerald-300' : 'text-rose-300'}">${e.valor < 0 ? 'R$' : '-R$'} ${Math.abs(e.valor).toLocaleString('pt-BR')}</td>
        </tr>
      `).join('');
    }
    
    const totalEl = document.getElementById('totalFiltro');
    if (totalEl) totalEl.innerHTML = `R$ ${total.toLocaleString('pt-BR')}`;
  }

  async renderEssenciais(data) {
    const essenciais = data.custosEssenciais || { ana_lua: [], mandelinha: [] };
    
    // Sidebar Ana Lua
    const anaContainer = document.getElementById('anaLuaSidebar');
    if (anaContainer) {
      let total = 0;
      anaContainer.innerHTML = essenciais.ana_lua.map(i => {
        total += i.valor;
        return `<div class="flex justify-between"><span>${i.nome}</span><span>R$ ${i.valor}</span></div>`;
      }).join('');
      document.getElementById('anaLuaSidebarTotal').innerHTML = `R$ ${total}`;
    }
    
    // Sidebar Mandelinha
    const mandiContainer = document.getElementById('mandelinhaSidebar');
    if (mandiContainer) {
      let total = 0;
      mandiContainer.innerHTML = essenciais.mandelinha.map(i => {
        total += i.valor;
        return `<div class="flex justify-between"><span>${i.nome}</span><span>R$ ${i.valor}</span></div>`;
      }).join('');
      document.getElementById('mandelinhaSidebarTotal').innerHTML = `R$ ${total}`;
    }
  }

  async renderReservaEmergencia(data) {
    const reservaAtual = data.reservaEmergencia || 8500;
    const mediaGastoMensal = data.totalDespesas || 0;
    const metaReserva = mediaGastoMensal * 6;
    const percent = Math.min(100, (reservaAtual / metaReserva) * 100);
    const meses = (reservaAtual / mediaGastoMensal).toFixed(1);
    
    const reservaAtualEl = document.getElementById('reservaAtual');
    const reservaMetaEl = document.getElementById('reservaMeta');
    const reservaProgress = document.getElementById('reservaProgress');
    const reservaMsg = document.getElementById('reservaMsg');
    
    if (reservaAtualEl) reservaAtualEl.innerHTML = `R$ ${reservaAtual.toLocaleString('pt-BR')}`;
    if (reservaMetaEl) reservaMetaEl.innerHTML = `R$ ${metaReserva.toLocaleString('pt-BR')}`;
    if (reservaProgress) reservaProgress.style.width = `${percent}%`;
    if (reservaMsg) {
      if (reservaAtual >= metaReserva) {
        reservaMsg.innerHTML = '🎉 Parabéns! Você atingiu sua meta de reserva de emergência!';
      } else {
        reservaMsg.innerHTML = `📌 Faltam R$ ${(metaReserva - reservaAtual).toLocaleString('pt-BR')} para atingir sua meta (${meses} meses de despesas)`;
      }
    }
  }

  async renderVariacoes(data) {
    const evolucao = data.evolucaoMensal || [];
    if (evolucao.length >= 2) {
      const ultimo = evolucao[evolucao.length - 1];
      const anterior = evolucao[evolucao.length - 2];
      const varReceitas = ((ultimo.receita - anterior.receita) / anterior.receita) * 100;
      const varDespesas = ((ultimo.despesa - anterior.despesa) / anterior.despesa) * 100;
      
      const receitasVarEl = document.getElementById('receitasVariacao');
      const despesasVarEl = document.getElementById('despesasVariacao');
      
      if (receitasVarEl) {
        receitasVarEl.innerHTML = `${varReceitas >= 0 ? '↑' : '↓'} ${Math.abs(varReceitas).toFixed(1)}% vs ${anterior.mes}`;
        receitasVarEl.className = `card-footer ${varReceitas >= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
      }
      if (despesasVarEl) {
        despesasVarEl.innerHTML = `${varDespesas <= 0 ? '↓' : '↑'} ${Math.abs(varDespesas).toFixed(1)}% vs ${anterior.mes}`;
        despesasVarEl.className = `card-footer ${varDespesas <= 0 ? 'text-emerald-300' : 'text-rose-300'}`;
      }
    }
  }

  setupMetas() {
    this.loadMetas();
    const addBtn = document.getElementById('addMetaBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addMeta());
    }
  }

  loadMetas() {
    const metas = JSON.parse(localStorage.getItem('wealthaurora_metas') || '[]');
    const container = document.getElementById('metasList');
    if (!container) return;
    
    container.innerHTML = metas.map((meta, idx) => `
      <div class="meta-item" data-idx="${idx}">
        <div class="meta-info">
          <div class="meta-nome">${meta.nome}</div>
          <div class="meta-progresso">Alvo: R$ ${meta.valor.toLocaleString('pt-BR')} até ${meta.data}</div>
        </div>
        <div class="meta-valor">R$ ${(meta.valor / (this.getMesesAteData(meta.data))).toLocaleString('pt-BR')}/mês</div>
        <button class="delete-meta" onclick="uiManager.deleteMeta(${idx})"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  }

  addMeta() {
    const nome = document.getElementById('novaMetaNome')?.value;
    const valor = parseFloat(document.getElementById('novaMetaValor')?.value);
    const data = document.getElementById('novaMetaData')?.value;
    
    if (!nome || !valor || !data) {
      alert('Preencha todos os campos da meta!');
      return;
    }
    
    const metas = JSON.parse(localStorage.getItem('wealthaurora_metas') || '[]');
    metas.push({ nome, valor, data });
    localStorage.setItem('wealthaurora_metas', JSON.stringify(metas));
    
    document.getElementById('novaMetaNome').value = '';
    document.getElementById('novaMetaValor').value = '';
    document.getElementById('novaMetaData').value = '';
    
    this.loadMetas();
  }

  deleteMeta(idx) {
    const metas = JSON.parse(localStorage.getItem('wealthaurora_metas') || '[]');
    metas.splice(idx, 1);
    localStorage.setItem('wealthaurora_metas', JSON.stringify(metas));
    this.loadMetas();
  }

  getMesesAteData(dataStr) {
    const hoje = new Date();
    const alvo = new Date(dataStr);
    const diffMeses = (alvo.getFullYear() - hoje.getFullYear()) * 12 + (alvo.getMonth() - hoje.getMonth());
    return Math.max(1, diffMeses);
  }

  formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${meses[parseInt(month)-1]}/${year}`;
  }
}

// Inicializar
let uiManager;
document.addEventListener('DOMContentLoaded', async () => {
  uiManager = new UIManager(dataService);
  await uiManager.init();
  
  // Renderizar componentes adicionais
  const data = await dataService.fetchData();
  uiManager.renderEssenciais(data);
  uiManager.renderReservaEmergencia(data);
  uiManager.renderVariacoes(data);
});
