/**
 * WealthAurora - Módulo de Dados
 * Responsável por buscar, cachear e processar dados da planilha
 */

// Dados mock para fallback enquanto a planilha não conecta
const MOCK_DATA = {
  saldoAtual: 4230.50,
  totalReceitas: 7000.00,
  totalDespesas: 5840.00,
  taxaEsforco: 83.4,
  mediaDiaria: 194.67,
  reservaEmergencia: 8500,
  
  categorias: [
    { nome: "Alimentação", gasto: 1240, limite: 1400, cor: "#2DD4BF" },
    { nome: "Transporte", gasto: 620, limite: 600, cor: "#FB7185" },
    { nome: "Lazer", gasto: 480, limite: 550, cor: "#FBBF24" },
    { nome: "Saúde", gasto: 310, limite: 400, cor: "#34D399" },
    { nome: "Ana Lua", gasto: 680, limite: 760, cor: "#A78BFA" },
    { nome: "Mandelinha", gasto: 190, limite: 200, cor: "#F97316" },
    { nome: "Casa", gasto: 1200, limite: 1200, cor: "#06B6D4" },
    { nome: "Outros", gasto: 320, limite: 400, cor: "#64748B" }
  ],
  
  evolucaoMensal: [
    { mes: "Jan", receita: 6800, despesa: 5200 },
    { mes: "Fev", receita: 6800, despesa: 5600 },
    { mes: "Mar", receita: 7200, despesa: 6100 },
    { mes: "Abr", receita: 7000, despesa: 5400 },
    { mes: "Mai", receita: 7000, despesa: 5840 }
  ],
  
  extrato: [
    { data: "2026-05-05", descricao: "PIX QRS 121 SMART", categoria: "Alimentação", valor: 2.19 },
    { data: "2026-05-05", descricao: "PAGAMENTO PARCELA EMPRESTIMO", categoria: "Empréstimo", valor: 500 },
    { data: "2026-05-04", descricao: "FATURA PAGA LATAM PASS", categoria: "Cartão", valor: 1917.54 },
    { data: "2026-04-30", descricao: "PIX QRS 121 SMART", categoria: "Alimentação", valor: 8.99 },
    { data: "2026-04-29", descricao: "TEF CREDITO SALARIO", categoria: "Salário", valor: -1739.69 },
    { data: "2026-04-29", descricao: "PIX TRANSF EMANUEL", categoria: "Transferência", valor: 30 }
  ],
  
  emprestimo: {
    nomeCredor: "Cirlene",
    valorOriginal: 35000,
    parcelasPagas: 0,
    totalParcelas: 30,
    parcelas: [
      { data: "2026-06-05", numero: 1, valorMensal: 500, valorExtra: 4000, total: 4500, saldo: 30500, status: "Pendente" },
      { data: "2026-07-05", numero: 2, valorMensal: 500, valorExtra: 0, total: 500, saldo: 30000, status: "Pendente" },
      { data: "2026-08-05", numero: 3, valorMensal: 500, valorExtra: 0, total: 500, saldo: 29500, status: "Pendente" },
      { data: "2026-09-05", numero: 4, valorMensal: 500, valorExtra: 0, total: 500, saldo: 29000, status: "Pendente" },
      { data: "2026-10-05", numero: 5, valorMensal: 500, valorExtra: 0, total: 500, saldo: 28500, status: "Pendente" },
      { data: "2026-11-05", numero: 6, valorMensal: 500, valorExtra: 0, total: 500, saldo: 28000, status: "Pendente" }
    ]
  },
  
  receitasFixas: [
    { descricao: "Salário Principal", valor: 1761.48, dia: 15 },
    { descricao: "Salário Complementar", valor: 1699.34, dia: 15 },
    { descricao: "Salário Variável", valor: 1819.33, dia: 30 }
  ],
  
  despesasRecorrentes: [
    { descricao: "Faculdade", valor: 328.67, dia: 24 },
    { descricao: "Claro Flex", valor: 39.99, dia: 22 },
    { descricao: "Spotify", valor: 40.90, dia: 10 },
    { descricao: "Google One", valor: 9.99, dia: 27 }
  ],
  
  custosEssenciais: {
    ana_lua: [
      { nome: "Leite Nan", valor: 280 },
      { nome: "Pomada", valor: 40 },
      { nome: "Lenço umedecido", valor: 60 },
      { nome: "Farmácia", valor: 150 },
      { nome: "Comida (papinha)", valor: 50 }
    ],
    mandelinha: [
      { nome: "Fralda pet", valor: 120 },
      { nome: "Plano Pet Love", valor: 59 }
    ]
  }
};

// Cache no sessionStorage (5 minutos)
const CACHE_KEY = 'wealthaurora_data';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutos

class DataService {
  constructor() {
    this.data = null;
    this.isLoading = false;
    this.listeners = [];
  }

  // Registrar callback para quando os dados carregarem
  onDataLoaded(callback) {
    this.listeners.push(callback);
  }

  // Notificar listeners
  notifyListeners() {
    this.listeners.forEach(cb => cb(this.data));
  }

  // Buscar dados (prioriza cache, depois API, depois mock)
  async fetchData(forceRefresh = false) {
    if (this.isLoading) {
      return new Promise(resolve => {
        this.onDataLoaded(() => resolve(this.data));
      });
    }

    // Verificar cache
    if (!forceRefresh) {
      const cached = this.getCachedData();
      if (cached) {
        this.data = cached;
        this.notifyListeners();
        return cached;
      }
    }

    this.isLoading = true;
    this.showLoading(true);

    try {
      // Tentar buscar da API (data.json gerado pelo GitHub Actions)
      const response = await fetch('data.json?v=' + Date.now());
      
      if (response.ok) {
        const jsonData = await response.json();
        this.data = this.transformApiData(jsonData);
        this.setCachedData(this.data);
        this.showLoading(false);
        this.notifyListeners();
        return this.data;
      } else {
        throw new Error('API não disponível');
      }
    } catch (error) {
      console.warn('Erro ao carregar dados da API, usando dados mock:', error);
      // Fallback para dados mock
      this.data = MOCK_DATA;
      this.setCachedData(this.data);
      this.showEmptyState(true);
      this.showLoading(false);
      this.notifyListeners();
      return this.data;
    } finally {
      this.isLoading = false;
    }
  }

  // Transformar dados da API para o formato interno
  transformApiData(apiData) {
    // Mapear os campos da API para o formato esperado pelo dashboard
    return {
      saldoAtual: apiData.balance || apiData.saldoTotal || MOCK_DATA.saldoAtual,
      totalReceitas: apiData.totalIncome || apiData.totalReceitas || MOCK_DATA.totalReceitas,
      totalDespesas: apiData.totalExpense || apiData.totalGastos || MOCK_DATA.totalDespesas,
      taxaEsforco: apiData.taxaEsforco || (apiData.totalDespesas / apiData.totalReceitas * 100) || MOCK_DATA.taxaEsforco,
      mediaDiaria: apiData.avgDailyExpense || apiData.mediaDiaria || MOCK_DATA.mediaDiaria,
      reservaEmergencia: MOCK_DATA.reservaEmergencia,
      
      categorias: apiData.categories ? 
        Object.entries(apiData.categories).map(([nome, gasto]) => ({
          nome, gasto, limite: MOCK_DATA.categorias.find(c => c.nome === nome)?.limite || gasto * 1.2
        })) : MOCK_DATA.categorias,
      
      evolucaoMensal: apiData.monthlyData ? 
        Object.keys(apiData.monthlyData.expense || {}).map(mes => ({
          mes, despesa: apiData.monthlyData.expense[mes] || 0, receita: apiData.monthlyData.income?.[mes] || 0
        })) : MOCK_DATA.evolucaoMensal,
      
      extrato: apiData.extrato || MOCK_DATA.extrato,
      emprestimo: apiData.debt || MOCK_DATA.emprestimo,
      receitasFixas: apiData.receitasFixas || MOCK_DATA.receitasFixas,
      despesasRecorrentes: apiData.despesasRecorrentes || MOCK_DATA.despesasRecorrentes,
      custosEssenciais: apiData.custosEssenciais || MOCK_DATA.custosEssenciais
    };
  }

  // Cache no sessionStorage
  getCachedData() {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
    return null;
  }

  setCachedData(data) {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  }

  // Mostrar/esconder loading
  showLoading(show) {
    const loadingEl = document.getElementById('loadingState');
    const dashboardEl = document.getElementById('dashboardContent');
    if (loadingEl && dashboardEl) {
      if (show) {
        loadingEl.classList.remove('hidden');
        dashboardEl.classList.add('hidden');
      } else {
        loadingEl.classList.add('hidden');
        dashboardEl.classList.remove('hidden');
      }
    }
  }

  // Mostrar empty state
  showEmptyState(show) {
    const emptyEl = document.getElementById('emptyState');
    const dashboardEl = document.getElementById('dashboardContent');
    if (emptyEl && dashboardEl) {
      if (show && !this.data) {
        emptyEl.classList.remove('hidden');
        dashboardEl.classList.add('hidden');
      } else {
        emptyEl.classList.add('hidden');
      }
    }
  }
}

// Instância global
const dataService = new DataService();
