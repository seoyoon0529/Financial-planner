const STORAGE_KEYS = {
  transactions: 'transactions',
  categories: 'categories',
  settings: 'settings',
};

const DEFAULT_CATEGORIES = [
  { id: 'food', name: '식비', type: 'expense' },
  { id: 'transport', name: '교통', type: 'expense' },
  { id: 'living', name: '주거/관리비', type: 'expense' },
  { id: 'culture', name: '문화', type: 'expense' },
  { id: 'etc', name: '기타', type: 'expense' },
  { id: 'salary', name: '급여', type: 'income' },
  { id: 'freelance', name: '프리랜스', type: 'income' },
  { id: 'gift', name: '선물/용돈', type: 'income' },
];

const CATEGORY_COLORS = [
  '#f97316',
  '#22c55e',
  '#2563eb',
  '#a855f7',
  '#06b6d4',
  '#facc15',
  '#ef4444',
];

const DEFAULT_SETTINGS = {
  monthlyExpenseLimit: null,
  categoryLimits: {},
  fixedExpenseDate: '',
  fixedExpenseMemo: '',
  autoBudgets: {
    enabled: true,
    lastGenerated: null,
    targetMonth: null,
    categoryBudgets: {},
  },
};

const CATEGORY_COLORS = [
  '#f97316',
  '#22c55e',
  '#2563eb',
  '#a855f7',
  '#06b6d4',
  '#facc15',
  '#ef4444',
];

const state = {
  transactions: [],
  categories: [],
  settings: { ...DEFAULT_SETTINGS },
  filters: {
    start: '',
    end: '',
    type: '',
    category: '',
    min: '',
    max: '',
    sort: 'date_desc',
  },
  charts: {
    monthly: null,
    category: null,
    trend: null,
  },
};

const $ = (selector) => document.querySelector(selector);
const formatCurrency = (value) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value || 0);

const generateId = () =>
  window.crypto?.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const elements = {
  transactionForm: $('#transactionForm'),
  transactionId: $('#transactionId'),
  transactionDate: $('#transactionDate'),
  transactionType: $('#transactionType'),
  transactionCategory: $('#transactionCategory'),
  transactionAmount: $('#transactionAmount'),
  transactionMemo: $('#transactionMemo'),
  cancelEditBtn: $('#cancelEditBtn'),
  filterForm: $('#filterForm'),
  filterStart: $('#filterStart'),
  filterEnd: $('#filterEnd'),
  filterType: $('#filterType'),
  filterCategory: $('#filterCategory'),
  filterMin: $('#filterMin'),
  filterMax: $('#filterMax'),
  sortBy: $('#sortBy'),
  resetFilterBtn: $('#resetFilterBtn'),
  transactionTableBody: $('#transactionTableBody'),
  transactionCount: $('#transactionCount'),
  monthlyExpense: $('#monthlyExpense'),
  monthlyIncome: $('#monthlyIncome'),
  netFlow: $('#netFlow'),
  alertCount: $('#alertCount'),
  alertBadge: $('#alertBadge'),
  alertList: $('#alertList'),
  alertTimestamp: $('#alertTimestamp'),
  patternType: $('#patternType'),
  patternDetail: $('#patternDetail'),
  categoryForm: $('#categoryForm'),
  categoryId: $('#categoryId'),
  categoryName: $('#categoryName'),
  categoryType: $('#categoryType'),
  categoryList: $('#categoryList'),
  settingsForm: $('#settingsForm'),
  monthlyLimit: $('#monthlyLimit'),
  categoryLimits: $('#categoryLimits'),
  fixedExpenseDate: $('#fixedExpenseDate'),
  fixedExpenseMemo: $('#fixedExpenseMemo'),
  analysisMonth: $('#analysisMonth'),
  monthlyChart: $('#monthlyChart'),
  categoryChart: $('#categoryChart'),
  trendChart: $('#trendChart'),
  categorySummaryList: $('#categorySummaryList'),
  budgetList: $('#budgetList'),
  refreshBudgetBtn: $('#refreshBudgetBtn'),
};

function init() {
  bootStorage();
  bindEvents();
  const today = new Date();
  elements.transactionDate.value = today.toISOString().slice(0, 10);
  const monthValue = today.toISOString().slice(0, 7);
  elements.analysisMonth.value = monthValue;
  renderAll();
}

function bootStorage() {
  state.categories = getData(STORAGE_KEYS.categories, []);
  if (!state.categories.length) {
    state.categories = DEFAULT_CATEGORIES;
    saveData(STORAGE_KEYS.categories, state.categories);
  }

  state.transactions = getData(STORAGE_KEYS.transactions, []);

  const savedSettings = getData(STORAGE_KEYS.settings, {});
  state.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
  state.settings.autoBudgets = {
    ...DEFAULT_SETTINGS.autoBudgets,
    ...(savedSettings.autoBudgets || {}),
    targetMonth: savedSettings.autoBudgets?.targetMonth ?? null,
    categoryBudgets: {
      ...(savedSettings.autoBudgets?.categoryBudgets || {}),
    },
  };
}

function getData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.warn(`Failed to parse key ${key}`, e);
    return fallback;
  }
}

function saveData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function bindEvents() {
  elements.transactionForm.addEventListener('submit', handleTransactionSubmit);
  elements.cancelEditBtn.addEventListener('click', resetTransactionForm);
  elements.filterForm.addEventListener('submit', handleFilterSubmit);
  elements.resetFilterBtn.addEventListener('click', resetFilterForm);
  elements.transactionTableBody.addEventListener('click', handleTableActions);
  elements.categoryForm.addEventListener('submit', handleCategorySubmit);
  elements.categoryList.addEventListener('click', handleCategoryActions);
  elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
  elements.refreshBudgetBtn.addEventListener('click', () => generateAutoBudgets());
  elements.analysisMonth.addEventListener('change', () => {
    generateAutoBudgets({ silent: true });
    updateDashboard();
    updateCharts();
    updateAlerts();
  });
}

function renderAll() {
  renderCategoryOptions();
  renderTransactions();
  renderCategoryList();
  hydrateSettingsForm();
  updateDashboard();
  initChartsIfNeeded();
  updateCharts();
  updateAlerts();
  renderBudgetList();
  if (
    !Object.keys(state.settings.autoBudgets.categoryBudgets).length ||
    shouldRefreshAutoBudgets()
  ) {
    generateAutoBudgets({ silent: true });
  }
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  const payload = {
    id: elements.transactionId.value || generateId(),
    type: elements.transactionType.value,
    category: elements.transactionCategory.value,
    amount: Number(elements.transactionAmount.value) || 0,
    memo: elements.transactionMemo.value.trim(),
    date: elements.transactionDate.value,
  };

  const existsIndex = state.transactions.findIndex((t) => t.id === payload.id);
  if (existsIndex >= 0) {
    state.transactions[existsIndex] = payload;
  } else {
    state.transactions.push(payload);
  }

  saveData(STORAGE_KEYS.transactions, state.transactions);
  resetTransactionForm();
  renderTransactions();
  updateDashboard();
  updateCharts();
  updateAlerts();
  generateAutoBudgets({ silent: true });
}

function resetTransactionForm() {
  elements.transactionForm.reset();
  elements.transactionId.value = '';
  elements.transactionType.value = 'expense';
  elements.transactionCategory.value =
    state.categories.find((c) => c.type === 'expense')?.id || '';
  elements.cancelEditBtn.textContent = '새로 작성';
}

function handleFilterSubmit(event) {
  event.preventDefault();
  state.filters = {
    start: elements.filterStart.value,
    end: elements.filterEnd.value,
    type: elements.filterType.value,
    category: elements.filterCategory.value,
    min: elements.filterMin.value,
    max: elements.filterMax.value,
    sort: elements.sortBy.value,
  };
  renderTransactions();
}

function resetFilterForm() {
  elements.filterForm.reset();
  state.filters = {
    start: '',
    end: '',
    type: '',
    category: '',
    min: '',
    max: '',
    sort: 'date_desc',
  };
  elements.sortBy.value = 'date_desc';
  renderTransactions();
}

function renderCategoryOptions() {
  const categories = [...state.categories];
  const transactionSelect = elements.transactionCategory;
  const filterSelect = elements.filterCategory;
  const prevTransaction = transactionSelect.value;
  const prevFilter = filterSelect.value;

  transactionSelect.innerHTML = '';
  filterSelect.innerHTML = '<option value="">전체</option>';

  categories.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = `${cat.name} (${cat.type === 'expense' ? '지출' : '수입'})`;
    transactionSelect.appendChild(option.cloneNode(true));
    filterSelect.appendChild(option);
  });

  transactionSelect.value =
    categories.find((cat) => cat.id === prevTransaction)?.id ||
    categories.find((cat) => cat.type === elements.transactionType.value)?.id ||
    categories[0]?.id ||
    '';
  filterSelect.value = categories.find((cat) => cat.id === prevFilter)?.id || '';
}

function getFilteredTransactions() {
  return state.transactions
    .filter((tx) => {
      if (state.filters.type && tx.type !== state.filters.type) return false;
      if (state.filters.category && tx.category !== state.filters.category) return false;
      if (state.filters.start && tx.date < state.filters.start) return false;
      if (state.filters.end && tx.date > state.filters.end) return false;
      if (state.filters.min && tx.amount < Number(state.filters.min)) return false;
      if (state.filters.max && tx.amount > Number(state.filters.max)) return false;
      return true;
    })
    .sort((a, b) => {
      switch (state.filters.sort) {
        case 'date_asc':
          return a.date.localeCompare(b.date);
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'category':
          return a.category.localeCompare(b.category);
        case 'date_desc':
        default:
          return b.date.localeCompare(a.date);
      }
    });
}

function renderTransactions() {
  const rows = getFilteredTransactions().map((tx) => {
    const category = state.categories.find((cat) => cat.id === tx.category);
    return `
      <tr>
        <td>${tx.date}</td>
        <td><span class="pill ${tx.type}">${tx.type === 'expense' ? '지출' : '수입'}</span></td>
        <td>${category?.name || '미지정'}</td>
        <td>${formatCurrency(tx.amount)}</td>
        <td>${tx.memo || '-'}</td>
        <td>
          <div class="actions">
            <button class="ghost" data-action="edit" data-id="${tx.id}">수정</button>
            <button class="ghost" data-action="delete" data-id="${tx.id}">삭제</button>
          </div>
        </td>
      </tr>
    `;
  });

  elements.transactionTableBody.innerHTML = rows.join('') || `
    <tr>
      <td colspan="6" class="muted">조건에 맞는 거래가 없습니다.</td>
    </tr>
  `;
  elements.transactionCount.textContent = `${rows.length}건 표시 중`;
}

function handleTableActions(event) {
  const target = event.target.closest('button[data-action]');
  if (!target) return;
  const id = target.dataset.id;
  const action = target.dataset.action;
  if (action === 'edit') {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    elements.transactionId.value = tx.id;
    elements.transactionDate.value = tx.date;
    elements.transactionType.value = tx.type;
    elements.transactionCategory.value = tx.category;
    elements.transactionAmount.value = tx.amount;
    elements.transactionMemo.value = tx.memo;
    elements.cancelEditBtn.textContent = '편집 취소';
    elements.transactionForm.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'delete') {
    const confirmed = confirm('해당 거래를 삭제할까요?');
    if (!confirmed) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    saveData(STORAGE_KEYS.transactions, state.transactions);
    renderTransactions();
    updateDashboard();
    updateCharts();
    updateAlerts();
    generateAutoBudgets({ silent: true });
  }
}

function handleCategorySubmit(event) {
  event.preventDefault();
  const payload = {
    id: elements.categoryId.value || generateId(),
    name: elements.categoryName.value.trim(),
    type: elements.categoryType.value,
  };

  if (!payload.name) return;
  const existsIndex = state.categories.findIndex((c) => c.id === payload.id);
  if (existsIndex >= 0) {
    state.categories[existsIndex] = payload;
  } else {
    state.categories.push(payload);
  }

  saveData(STORAGE_KEYS.categories, state.categories);
  resetCategoryForm();
  renderCategoryOptions();
  renderCategoryList();
  renderTransactions();
}

function resetCategoryForm() {
  elements.categoryForm.reset();
  elements.categoryId.value = '';
}

function renderCategoryList() {
  const totals = getOverallExpenseTotals();
  const sorted = [...state.categories].sort(
    (a, b) => (totals[b.id] || 0) - (totals[a.id] || 0),
  );
  const list = sorted
    .map((cat) => {
      const amount = totals[cat.id] || 0;
      return `
      <li class="category-card">
        <div class="category-card-header">
          <strong>${cat.name}</strong>
          <span class="category-chip ${cat.type}">
            ${cat.type === 'expense' ? '지출' : '수입'}
          </span>
        </div>
        <div class="category-amount">${formatCurrency(amount)}</div>
        <div class="category-meta">누적 지출</div>
        <div class="category-card-actions">
          <button class="ghost" data-action="edit-cat" data-id="${cat.id}">수정</button>
          <button class="ghost" data-action="delete-cat" data-id="${cat.id}">삭제</button>
        </div>
      </li>
    `;
    })
    .join('');
  elements.categoryList.innerHTML = list || '<li class="muted">카테고리를 추가하세요.</li>';
  renderBudgetList();
}

function handleCategoryActions(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  if (action === 'edit-cat') {
    const category = state.categories.find((c) => c.id === id);
    if (!category) return;
    elements.categoryId.value = category.id;
    elements.categoryName.value = category.name;
    elements.categoryType.value = category.type;
    elements.categoryForm.scrollIntoView({ behavior: 'smooth' });
  } else if (action === 'delete-cat') {
    const used = state.transactions.some((tx) => tx.category === id);
    if (used) {
      alert('이미 거래에 사용된 카테고리는 삭제할 수 없습니다.');
      return;
    }
    state.categories = state.categories.filter((c) => c.id !== id);
    saveData(STORAGE_KEYS.categories, state.categories);
    renderCategoryOptions();
    renderCategoryList();
    renderTransactions();
  }
}

function handleSettingsSubmit(event) {
  event.preventDefault();

  const categoryLimits = {};
  const pairs = elements.categoryLimits.value
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean);

  pairs.forEach((pair) => {
    const [id, amount] = pair.split(':').map((value) => value.trim());
    if (id && amount && !Number.isNaN(Number(amount))) {
      categoryLimits[id] = Number(amount);
    }
  });

  state.settings = {
    ...state.settings,
    monthlyExpenseLimit: elements.monthlyLimit.value
      ? Number(elements.monthlyLimit.value)
      : null,
    categoryLimits,
    fixedExpenseDate: elements.fixedExpenseDate.value || '',
    fixedExpenseMemo: elements.fixedExpenseMemo.value.trim(),
  };

  saveData(STORAGE_KEYS.settings, state.settings);
  updateAlerts();
}

function hydrateSettingsForm() {
  if (state.settings.monthlyExpenseLimit) {
    elements.monthlyLimit.value = state.settings.monthlyExpenseLimit;
  }
  const pairs = Object.entries(state.settings.categoryLimits).map(
    ([id, limit]) => `${id}:${limit}`,
  );
  elements.categoryLimits.value = pairs.join(', ');
  elements.fixedExpenseDate.value = state.settings.fixedExpenseDate || '';
  elements.fixedExpenseMemo.value = state.settings.fixedExpenseMemo || '';
}

function getCurrentMonthStr() {
  return elements.analysisMonth.value || new Date().toISOString().slice(0, 7);
}

function updateDashboard() {
  const month = getCurrentMonthStr();
  const { totalExpense, totalIncome } = calculateMonthlyTotals(month);
  elements.monthlyExpense.textContent = formatCurrency(totalExpense);
  elements.monthlyIncome.textContent = formatCurrency(totalIncome);
  elements.netFlow.textContent = formatCurrency(totalIncome - totalExpense);
  updateSpendingPattern(month, totalExpense, totalIncome);
  renderBudgetList();
}

function calculateMonthlyTotals(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  return state.transactions.reduce(
    (acc, tx) => {
      if (tx.date >= startStr && tx.date <= endStr) {
        if (tx.type === 'expense') acc.totalExpense += tx.amount;
        else acc.totalIncome += tx.amount;
      }
      return acc;
    },
    { totalExpense: 0, totalIncome: 0 },
  );
}

function initChartsIfNeeded() {
  if (!state.charts.monthly) {
    state.charts.monthly = new Chart(elements.monthlyChart, {
      type: 'bar',
      data: {
        labels: ['수입', '지출'],
        datasets: [
          {
            label: '금액',
            data: [0, 0],
            backgroundColor: ['#4ade80', '#f87171'],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
      },
    });
  }

  if (!state.charts.category) {
    state.charts.category = new Chart(elements.categoryChart, {
      type: 'doughnut',
      data: {
        labels: [],
        datasets: [
          {
            data: [],
            backgroundColor: CATEGORY_COLORS,
            borderWidth: 0,
          },
        ],
      },
      options: {
        plugins: {
          legend: { display: false },
        },
        cutout: '65%',
      },
    });
  }

  if (!state.charts.trend) {
    state.charts.trend = new Chart(elements.trendChart, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: '최근 7일 지출',
            data: [],
            fill: false,
            borderColor: '#ef4444',
            tension: 0.2,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
      },
    });
  }
}

function updateCharts() {
  const month = getCurrentMonthStr();
  const { totalExpense, totalIncome } = calculateMonthlyTotals(month);
  state.charts.monthly.data.datasets[0].data = [totalIncome, totalExpense];
  state.charts.monthly.update();

  const categoryTotals = getMonthlyExpenseTotals(month);

  const labels = Object.keys(categoryTotals).map(
    (id) => state.categories.find((c) => c.id === id)?.name || id,
  );
  const values = Object.values(categoryTotals);
  state.charts.category.data.labels = labels;
  state.charts.category.data.datasets[0].data = values;
  state.charts.category.update();
  renderCategorySummary(categoryTotals, totalExpense);

  const { labels: trendLabels, values: trendValues } = getLast7DaysData();
  state.charts.trend.data.labels = trendLabels;
  state.charts.trend.data.datasets[0].data = trendValues;
  state.charts.trend.update();
}

function getLast7DaysData() {
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;
    const iso = date.toISOString().slice(0, 10);
    const total = state.transactions
      .filter((tx) => tx.type === 'expense' && tx.date === iso)
      .reduce((sum, tx) => sum + tx.amount, 0);
    labels.push(label);
    values.push(total);
  }
  return { labels, values };
}

function updateAlerts() {
  const alerts = [];
  const month = getCurrentMonthStr();
  const { totalExpense } = calculateMonthlyTotals(month);
  if (
    state.settings.monthlyExpenseLimit &&
    totalExpense > state.settings.monthlyExpenseLimit
  ) {
    alerts.push({
      title: '월 지출 한도 초과',
      detail: `${formatCurrency(totalExpense)} / ${formatCurrency(
        state.settings.monthlyExpenseLimit,
      )}`,
    });
  }

  const categoryTotals = getMonthlyExpenseTotals(month);

  Object.entries(state.settings.categoryLimits).forEach(([id, limit]) => {
    if (!categoryTotals[id]) return;
    if (categoryTotals[id] > limit) {
      const name = state.categories.find((c) => c.id === id)?.name || id;
      alerts.push({
        title: `${name} 카테고리 한도 초과`,
        detail: `${formatCurrency(categoryTotals[id])} / ${formatCurrency(limit)}`,
      });
    }
  });

  const autoBudgets = state.settings.autoBudgets?.categoryBudgets || {};
  Object.entries(autoBudgets).forEach(([id, limit]) => {
    if (!categoryTotals[id] || !limit) return;
    if (categoryTotals[id] > limit) {
      const name = state.categories.find((c) => c.id === id)?.name || id;
      alerts.push({
        title: `${name} 자동 예산 초과`,
        detail: `${formatCurrency(categoryTotals[id])} / ${formatCurrency(limit)}`,
      });
    }
  });

  if (state.settings.fixedExpenseDate) {
    const today = new Date().toISOString().slice(0, 10);
    if (today === state.settings.fixedExpenseDate) {
      alerts.push({
        title: '고정 지출일 알림',
        detail: state.settings.fixedExpenseMemo || '고정 지출을 확인하세요.',
      });
    }
  }

  elements.alertCount.textContent = `${alerts.length}건`;
  elements.alertBadge.textContent =
    alerts[0]?.title ?? '지출 상황이 안정적입니다.';
  elements.alertTimestamp.textContent = `업데이트 ${new Date()
    .toLocaleTimeString('ko-KR')
    .slice(0, 8)}`;

  elements.alertList.innerHTML =
    alerts
      .map(
        (alert) => `
      <li class="alert-item">
        <div>
          <strong>${alert.title}</strong>
          <div class="alert-meta">${alert.detail}</div>
        </div>
        <span>!</span>
      </li>
    `,
      )
      .join('') || '<li class="muted">현재 알림이 없습니다.</li>';
}

function renderCategorySummary(totals, monthExpense) {
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const total = monthExpense || entries.reduce((sum, [, amount]) => sum + amount, 0);
  const list = entries
    .map(([id, amount], index) => {
      const percent = total ? Math.round((amount / total) * 100) : 0;
      const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
      const label = state.categories.find((c) => c.id === id)?.name || id;
      return `
        <li class="category-summary-item">
          <div class="category-summary-label">
            <span class="category-dot" style="background:${color}"></span>
            ${label}
          </div>
          <div>
            <strong>${formatCurrency(amount)}</strong>
            <div class="muted">${percent}%</div>
          </div>
        </li>
      `;
    })
    .join('');
  elements.categorySummaryList.innerHTML =
    list ||
    '<li class="category-summary-item empty">이번 달 지출 데이터가 없습니다.</li>';
}

function generateAutoBudgets(options = {}) {
  const { silent = false, baseMonth } = options;
  const month = baseMonth || getCurrentMonthStr();
  const lookbackKeys = getLookbackMonthKeys(month, 3);
  const history = {};

  state.transactions.forEach((tx) => {
    if (tx.type !== 'expense') return;
    const key = tx.date.slice(0, 7);
    if (!lookbackKeys.includes(key)) return;
    if (!history[tx.category]) history[tx.category] = {};
    history[tx.category][key] = (history[tx.category][key] || 0) + tx.amount;
  });

  const budgets = {};
  Object.entries(history).forEach(([id, monthMap]) => {
    const values = Object.values(monthMap);
    if (!values.length) return;
    const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
    budgets[id] = Math.round(avg * 1.1);
  });

  state.settings.autoBudgets = {
    ...state.settings.autoBudgets,
    categoryBudgets: budgets,
    lastGenerated: new Date().toISOString(),
    targetMonth: month,
  };
  saveData(STORAGE_KEYS.settings, state.settings);
  renderBudgetList();
  updateAlerts();

  if (!options.silent) {
    if (Object.keys(budgets).length) {
      alert('최근 지출 데이터를 바탕으로 예산을 업데이트했습니다.');
    } else {
      alert('최근 3개월 지출 데이터가 부족해 예산을 생성할 수 없습니다.');
    }
  }
}

function renderBudgetList() {
  if (!elements.budgetList) return;
  const budgets = state.settings.autoBudgets?.categoryBudgets || {};
  const entries = Object.entries(budgets);
  const month = getCurrentMonthStr();
  const totals = getMonthlyExpenseTotals(month);
  if (!entries.length) {
    elements.budgetList.innerHTML =
      '<li class="budget-item empty">최근 3개월 지출 데이터가 부족합니다.</li>';
    return;
  }

  const html = entries
    .map(([id, limit]) => {
      const spent = totals[id] || 0;
      const percent = limit ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
      let status = 'safe';
      if (percent >= 100) status = 'danger';
      else if (percent >= 80) status = 'warn';
      const categoryName = state.categories.find((c) => c.id === id)?.name || id;
      return `
        <li class="budget-item">
          <div class="budget-item-header">
            <strong>${categoryName}</strong>
            <div>${formatCurrency(spent)} / ${formatCurrency(limit || 0)}</div>
          </div>
          <div class="budget-progress">
            <div class="budget-progress-fill" style="width:${percent}%;"></div>
          </div>
          <div class="budget-status ${status}">
            ${status === 'safe' ? '안정' : status === 'warn' ? '주의' : '초과'} · ${percent}%
          </div>
        </li>
      `;
    })
    .join('');
  elements.budgetList.innerHTML = html;
}

function getLookbackMonthKeys(baseMonthStr, count) {
  const base = new Date(`${baseMonthStr}-01T00:00:00`);
  const keys = [];
  for (let i = 1; i <= count; i += 1) {
    const d = new Date(base);
    d.setMonth(d.getMonth() - i);
    keys.push(d.toISOString().slice(0, 7));
  }
  return keys;
}

function shouldRefreshAutoBudgets() {
  const targetMonth = state.settings.autoBudgets?.targetMonth;
  const currentMonth = getCurrentMonthStr();
  return targetMonth !== currentMonth;
}

function getMonthlyExpenseTotals(month) {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = new Date(year, monthIndex - 1, 1).toISOString().slice(0, 10);
  const end = new Date(year, monthIndex, 0).toISOString().slice(0, 10);
  return state.transactions.reduce((acc, tx) => {
    if (tx.type !== 'expense') return acc;
    if (tx.date < start || tx.date > end) return acc;
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

function getOverallExpenseTotals() {
  return state.transactions.reduce((acc, tx) => {
    if (tx.type !== 'expense') return acc;
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

function updateSpendingPattern(month, totalExpense, totalIncome) {
  const ratio =
    totalIncome > 0 ? totalExpense / totalIncome : totalExpense > 0 ? Infinity : 0;
  let pattern = {
    type: '데이터 부족',
    detail: '월간 수입/지출 데이터를 추가하세요.',
  };

  if (totalExpense === 0 && totalIncome === 0) {
    pattern = { type: '데이터 없음', detail: '이번 달 기록이 없습니다.' };
  } else if (ratio === Infinity) {
    pattern = {
      type: '수입 미기록',
      detail: '지출만 기록되어 있습니다. 수입도 입력해 주세요.',
    };
  } else if (ratio <= 0.6) {
    pattern = { type: '절약형', detail: '지출이 수입 대비 안정적으로 관리되고 있어요.' };
  } else if (ratio <= 0.9) {
    pattern = { type: '균형형', detail: '수입과 지출이 균형을 이루고 있어요.' };
  } else if (ratio <= 1.1) {
    pattern = { type: '주의형', detail: '지출이 수입에 근접했습니다. 모니터링이 필요해요.' };
  } else if (ratio > 1.1) {
    pattern = { type: '지출형', detail: '지출이 수입을 초과했습니다. 한도를 확인하세요.' };
  }

  const categoryTotals = getMonthlyExpenseTotals(month);
  const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCategoryEntry && totalExpense > 0) {
    const [catId, amount] = topCategoryEntry;
    const categoryName = state.categories.find((c) => c.id === catId)?.name || catId;
    const percent = Math.round((amount / totalExpense) * 100);
    pattern.detail = `${categoryName} 비중 ${percent}% · ${pattern.detail}`;
  }

  elements.patternType.textContent = pattern.type;
  elements.patternDetail.textContent = pattern.detail;
}

document.addEventListener('DOMContentLoaded', init);

