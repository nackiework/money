/* === MONEYMIND APP.JS === */

// ─── DATA ───────────────────────────────────────────
let categories = JSON.parse(localStorage.getItem('mm_categories')) || {
  expense: [
    { id: 'food',      label: 'อาหาร',       color: '#fda4af' },
    { id: 'travel',    label: 'เดินทาง',     color: '#93c5fd' },
    { id: 'study',     label: 'การศึกษา',    color: '#c084fc' },
    { id: 'health',    label: 'สุขภาพ',      color: '#fca5a5' },
    { id: 'fun',       label: 'บันเทิง',     color: '#fde047' },
    { id: 'shopping',  label: 'ช้อปปิ้ง',    color: '#f472b6' },
    { id: 'phone',     label: 'ค่าโทร/เน็ต', color: '#67e8f9' },
    { id: 'other_exp', label: 'อื่นๆ',       color: '#cbd5e1' },
  ],
  income: [
    { id: 'allowance', label: 'เงินค่าขนม',  color: '#86efac' },
    { id: 'scholarship',label: 'ทุน/กยศ.',   color: '#6ee7b7' },
    { id: 'parttime',  label: 'Part-time',   color: '#5eead4' },
    { id: 'freelance', label: 'Freelance',   color: '#93c5fd' },
    { id: 'gift',      label: 'ของขวัญ',     color: '#fdba74' },
    { id: 'other_inc', label: 'อื่นๆ',       color: '#cbd5e1' },
  ]
};

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

// ─── STATE ───────────────────────────────────────────
let transactions = JSON.parse(localStorage.getItem('mm_transactions') || '[]');
let budgets      = JSON.parse(localStorage.getItem('mm_budgets')      || '{}');
let settings     = JSON.parse(localStorage.getItem('mm_settings')     || '{"accent":"#818cf8","mode":"dark"}');

let currentView         = 'dashboard';
let selectedType        = 'expense';
let selectedCategory    = '';
let editingTransId      = null;
let deleteTargetId      = null;
let dashboardDate       = new Date();
let categoryChart       = null;
let trendChart          = null;
let historyFilter       = { type: 'all', search: '', month: '', category: '' };

// ─── STORAGE ─────────────────────────────────────────
function saveTransactions() { localStorage.setItem('mm_transactions', JSON.stringify(transactions)); }
function saveBudgets()      { localStorage.setItem('mm_budgets',      JSON.stringify(budgets));      }
function saveSettings()     { localStorage.setItem('mm_settings',     JSON.stringify(settings));     }
function saveCategories()   { localStorage.setItem('mm_categories',   JSON.stringify(categories));   }

function exportData() {
  const data = {
    transactions,
    budgets,
    settings,
    categories,
    version: '1.0',
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `moneymind_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ ส่งออกข้อมูลสำเร็จ');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.transactions && data.budgets) {
        transactions = data.transactions;
        budgets = data.budgets;
        if (data.settings) settings = data.settings;
        if (data.categories) categories = data.categories;

        saveTransactions();
        saveBudgets();
        saveSettings();
        saveCategories();

        applyTheme();
        if (currentView === 'dashboard') renderDashboard();
        if (currentView === 'history')   renderHistory();

        showToast('✅ นำเข้าข้อมูลสำเร็จ');
      } else {
        showToast('❌ รูปแบบไฟล์ไม่ถูกต้อง');
      }
    } catch (err) {
      showToast('❌ ไม่สามารถอ่านไฟล์ได้');
    }
    // Reset file input so same file can be selected again
    event.target.value = '';
  };
  reader.readAsText(file);
}

// ─── THEME ───────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', settings.mode);
  const acc = settings.accent;
  document.documentElement.style.setProperty('--accent', acc);
  const r = parseInt(acc.slice(1,3),16), g = parseInt(acc.slice(3,5),16), b = parseInt(acc.slice(5,7),16);
  document.documentElement.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);

  document.getElementById('modeDark').classList.toggle('active', settings.mode === 'dark');
  document.getElementById('modeLight').classList.toggle('active', settings.mode === 'light');
  document.getElementById('customColorPicker').value = acc;
  document.getElementById('colorHexLabel').textContent = acc;

  document.querySelectorAll('.preset-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === acc);
  });
}

// ─── NAVIGATION ──────────────────────────────────────
function switchView(viewId) {
  currentView = viewId;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('view-' + viewId).classList.add('active');
  document.getElementById('tab-' + viewId).classList.add('active');

  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'history')   renderHistory();
}

// ─── FORMAT ──────────────────────────────────────────
function fmt(n) {
  return '฿' + Math.abs(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;
}
function monthKey(d) {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
}
function getCat(type, id) {
  return categories[type]?.find(c => c.id === id) || { label: id, color: '#cbd5e1' };
}
function getAllCats() { return [...categories.expense, ...categories.income]; }

function showToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  
  // force reflow
  void toast.offsetWidth;
  
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300); // match transition
  }, 3000);
}

// ─── DASHBOARD ───────────────────────────────────────
function renderDashboard() {
  const mk  = monthKey(dashboardDate);
  const thisMonth = transactions.filter(t => monthKey(t.date) === mk);

  const income  = thisMonth.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0);
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0);
  const balance = income - expense;

  document.getElementById('balanceAmount').textContent = fmt(balance);
  document.getElementById('balanceAmount').style.color = balance >= 0 ? 'white' : '#fca5a5';
  document.getElementById('dashboardMonthLabel').textContent = `${THAI_MONTHS[dashboardDate.getMonth()]} ${dashboardDate.getFullYear()+543}`;
  document.getElementById('totalIncome').textContent   = fmt(income);
  document.getElementById('totalExpense').textContent  = fmt(expense);

  renderCategoryChart(thisMonth.filter(t => t.type === 'expense'));
  renderTrendChart();
  renderRecentTransactions();
}

function renderCategoryChart(expenses) {
  const canvas = document.getElementById('categoryChart');
  const legend = document.getElementById('categoryLegend');

  const grouped = {};
  expenses.forEach(t => {
    grouped[t.category] = (grouped[t.category] || 0) + t.amount;
  });

  const cats   = Object.keys(grouped);
  const values = Object.values(grouped);
  const COLORS  = ['#818cf8','#f472b6','#34d399','#fb923c','#60a5fa','#a78bfa','#2dd4bf','#facc15'];

  if (categoryChart) categoryChart.destroy();

  if (cats.length === 0) {
    canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div><p>ยังไม่มีรายจ่าย</p></div>';
    legend.innerHTML = '';
    return;
  }

  categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: cats.map(c => getCat('expense', c).label),
      datasets: [{ data: values, backgroundColor: COLORS, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { display: false }, tooltip: {
        callbacks: { label: ctx => ` ${fmt(ctx.parsed)}` }
      }}
    }
  });

  legend.innerHTML = cats.map((c,i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${COLORS[i]}"></span>
      ${getCat('expense', c).label}
    </div>`).join('');
}

function renderTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (trendChart) trendChart.destroy();

  const now    = new Date();
  const months = [];
  const incArr = [];
  const expArr = [];

  for (let i = 5; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mk = monthKey(d);
    const mTx = transactions.filter(t => monthKey(t.date) === mk);
    months.push(THAI_MONTHS[d.getMonth()].slice(0,3));
    incArr.push(mTx.filter(t => t.type === 'income').reduce((s,t) => s+t.amount, 0));
    expArr.push(mTx.filter(t => t.type === 'expense').reduce((s,t) => s+t.amount, 0));
  }

  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();

  trendChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: months,
      datasets: [
        {
          label: 'รายรับ', data: incArr,
          borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.08)',
          tension: 0.4, fill: true, pointRadius: 4, borderWidth: 2
        },
        {
          label: 'รายจ่าย', data: expArr,
          borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)',
          tension: 0.4, fill: true, pointRadius: 4, borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8892ab', font: { family: 'Prompt' } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8892ab', font: { family: 'Prompt' }, callback: v => '฿'+v.toLocaleString() } }
      }
    }
  });
}

function renderRecentTransactions() {
  const el = document.getElementById('recentTransactions');
  const mk = monthKey(dashboardDate);
  const monthTx = transactions.filter(t => monthKey(t.date) === mk);
  const recent = [...monthTx].sort((a,b) => new Date(b.date)-new Date(a.date)).slice(0,5);

  if (recent.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div><p>ยังไม่มีรายการสำหรับเดือนนี้</p><p class="empty-sub">กด + เพื่อเพิ่มรายการแรก</p></div>`;
    return;
  }
  el.innerHTML = recent.map(t => txHTML(t)).join('');
  el.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
  });
}

function txHTML(t) {
  const cat = getCat(t.type, t.category);
  const dotColor = cat.color || 'var(--accent)';
  return `
    <div class="transaction-item">
      <div class="tx-icon-dot-container"><div class="tx-icon-dot" style="background:${dotColor}"></div></div>
      <div class="tx-info">
        <div class="tx-category">${cat.label}</div>
        <div class="tx-note">${t.note || fmtDate(t.date)}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}</div>
        <div class="tx-date">${fmtDate(t.date)}</div>
      </div>
      <button class="tx-delete" data-id="${t.id}" title="ลบ">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2"/></svg>
      </button>
    </div>`;
}

// ─── HISTORY ─────────────────────────────────────────
function renderHistory() {
  populateHistoryFilters();
  applyHistoryFilter();
}

function populateHistoryFilters() {
  const months = [...new Set(transactions.map(t => monthKey(t.date)))].sort().reverse();
  const mSel   = document.getElementById('filterMonth');
  mSel.innerHTML = '<option value="">ทุกเดือน</option>' +
    months.map(m => {
      const [y,mo] = m.split('-');
      return `<option value="${m}">${THAI_MONTHS[parseInt(mo)-1]} ${parseInt(y)+543}</option>`;
    }).join('');

  const cSel = document.getElementById('filterCategory');
  cSel.innerHTML = '<option value="">ทุกหมวด</option>' +
    getAllCats().map(c => `<option value="${c.id}">${c.label}</option>`).join('');
}

function applyHistoryFilter() {
  let filtered = [...transactions];
  if (historyFilter.type !== 'all')     filtered = filtered.filter(t => t.type === historyFilter.type);
  if (historyFilter.search)             filtered = filtered.filter(t => {
    const cat = getCat(t.type, t.category);
    return cat.label.includes(historyFilter.search) || (t.note||'').includes(historyFilter.search);
  });
  if (historyFilter.month)              filtered = filtered.filter(t => monthKey(t.date) === historyFilter.month);
  if (historyFilter.category)           filtered = filtered.filter(t => t.category === historyFilter.category);

  filtered.sort((a,b) => new Date(b.date)-new Date(a.date));

  const el = document.getElementById('historyList');
  if (filtered.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg></div><p>ไม่พบรายการ</p></div>`;
    return;
  }

  const groups = {};
  filtered.forEach(t => {
    const dk = t.date;
    if (!groups[dk]) groups[dk] = [];
    groups[dk].push(t);
  });

  el.innerHTML = Object.keys(groups).sort((a,b) => new Date(b)-new Date(a)).map(dk => `
    <div>
      <div class="date-group-header">${fmtDate(dk)}</div>
      <div class="date-group-items">${groups[dk].map(t => txHTML(t)).join('')}</div>
    </div>`).join('');

  el.querySelectorAll('.tx-delete').forEach(btn => {
    btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
  });
}



// ─── ADD TRANSACTION ─────────────────────────────────
function openAddModal() {
  editingTransId = null;
  selectedType   = 'expense';
  selectedCategory = '';
  document.getElementById('modalTitle').textContent = 'เพิ่มรายการ';
  document.getElementById('amountInput').value = '';
  document.getElementById('noteInput').value   = '';
  document.getElementById('dateInput').value   = new Date().toISOString().split('T')[0];
  setTypeUI('expense');
  renderCategoryGrid();
  document.getElementById('addModal').classList.remove('hidden');
}

function setTypeUI(type) {
  selectedType = type;
  document.getElementById('typeExpense').classList.toggle('active', type === 'expense');
  document.getElementById('typeIncome').classList.toggle('active',  type === 'income');
  renderCategoryGrid();
}

function renderCategoryGrid() {
  const grid = document.getElementById('categoryGrid');
  grid.innerHTML = categories[selectedType].map(c => `
    <button class="cat-btn ${selectedCategory === c.id ? 'selected' : ''}" data-id="${c.id}">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span class="cat-label">${c.label}</span>
    </button>`).join('');
  grid.querySelectorAll('.cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedCategory = btn.dataset.id;
      renderCategoryGrid();
    });
  });
}

function saveTransaction() {
  const amount = parseFloat(document.getElementById('amountInput').value);
  const date   = document.getElementById('dateInput').value;
  const note   = document.getElementById('noteInput').value.trim();

  if (!amount || amount <= 0) { alert('กรุณาใส่จำนวนเงิน'); return; }
  if (!selectedCategory)      { alert('กรุณาเลือกหมวดหมู่'); return; }
  if (!date)                  { alert('กรุณาเลือกวันที่'); return; }

  const tx = {
    id:       editingTransId || Date.now().toString(),
    type:     selectedType,
    amount,
    category: selectedCategory,
    date,
    note,
    createdAt: Date.now()
  };

  if (editingTransId) {
    const idx = transactions.findIndex(t => t.id === editingTransId);
    if (idx !== -1) transactions[idx] = tx;
  } else {
    transactions.push(tx);
  }

  saveTransactions();
  document.getElementById('addModal').classList.add('hidden');
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'history')   renderHistory();
}

// ─── DELETE ──────────────────────────────────────────
function openConfirmDelete(id) {
  deleteTargetId = id;
  document.getElementById('confirmModal').classList.remove('hidden');
}

function confirmDelete() {
  transactions = transactions.filter(t => t.id !== deleteTargetId);
  saveTransactions();
  deleteTargetId = null;
  document.getElementById('confirmModal').classList.add('hidden');
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'history')   renderHistory();
}



// ─── THEME & SETTINGS PANEL ──────────────────────────
let activeSettingsTab = 'theme';
let activeSettingsType = 'expense';

function toggleThemePanel() {
  const overlay = document.getElementById('themePanelOverlay');
  overlay.classList.toggle('hidden');
  if (!overlay.classList.contains('hidden')) {
    switchSettingsTab(activeSettingsTab);
    renderSettingsCategories();
  }
}

function switchSettingsTab(tabId) {
  activeSettingsTab = tabId;
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
  });
  document.querySelectorAll('.settings-content').forEach(c => {
    c.classList.toggle('active', c.id === `settingsContent${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  });
}

function switchSettingsCategoryType(type) {
  activeSettingsType = type;
  document.getElementById('settingsTypeExpense').classList.toggle('active', type === 'expense');
  document.getElementById('settingsTypeIncome').classList.toggle('active', type === 'income');
  renderSettingsCategories();
}

function renderSettingsCategories() {
  const listEl = document.getElementById('settingsCategoryList');
  const catList = categories[activeSettingsType];
  
  if (catList.length === 0) {
    listEl.innerHTML = `<div class="empty-state-sm">ไม่มีหมวดหมู่</div>`;
    return;
  }

  listEl.innerHTML = catList.map(c => `
    <div class="settings-cat-item">
      <div class="settings-cat-left">
        <span class="cat-dot" style="background:${c.color}"></span>
        <span class="settings-cat-label">${c.label}</span>
      </div>
      <button class="settings-cat-delete-btn" data-id="${c.id}" title="ลบหมวดหมู่">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join('');

  listEl.querySelectorAll('.settings-cat-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      deleteCategory(activeSettingsType, btn.dataset.id);
    });
  });
}

function deleteCategory(type, catId) {
  if (categories[type].length <= 1) {
    alert('ต้องมีหมวดหมู่เหลืออยู่อย่างน้อย 1 หมวดหมู่');
    return;
  }
  
  categories[type] = categories[type].filter(c => c.id !== catId);
  saveCategories();
  renderSettingsCategories();
  renderCategoryGrid();
  applyHistoryFilter();
  if (currentView === 'dashboard') renderDashboard();
  showToast('🗑️ ลบหมวดหมู่สำเร็จ');
}

function addCategory() {
  const input = document.getElementById('newCategoryName');
  const name = input.value.trim();
  const color = document.getElementById('newCategoryColor').value;
  
  if (!name) { alert('กรุณาระบุชื่อหมวดหมู่'); return; }
  
  const exists = categories[activeSettingsType].some(c => c.label.toLowerCase() === name.toLowerCase());
  if (exists) { alert('มีหมวดหมู่นี้อยู่แล้ว'); return; }

  const id = 'custom_' + Date.now();
  categories[activeSettingsType].push({ id, label: name, color });
  saveCategories();
  input.value = '';
  
  renderSettingsCategories();
  renderCategoryGrid();
  applyHistoryFilter();
  if (currentView === 'dashboard') renderDashboard();
  showToast('✅ เพิ่มหมวดหมู่สำเร็จ');
}

function setAccent(color) {
  settings.accent = color;
  saveSettings();
  applyTheme();
  if (currentView === 'dashboard') renderDashboard();
}

function setMode(mode) {
  settings.mode = mode;
  saveSettings();
  applyTheme();
}

// ─── EVENT LISTENERS ─────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  renderDashboard();

  // Navigation
  document.querySelectorAll('.nav-tab, .btn-text').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  // FAB
  document.getElementById('fabAdd').addEventListener('click', openAddModal);

  // Add modal close
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('addModal').classList.add('hidden');
  });
  document.getElementById('addModal').addEventListener('click', e => {
    if (e.target === document.getElementById('addModal'))
      document.getElementById('addModal').classList.add('hidden');
  });

  // Type buttons
  document.getElementById('typeExpense').addEventListener('click', () => setTypeUI('expense'));
  document.getElementById('typeIncome').addEventListener('click',  () => setTypeUI('income'));

  // Save transaction
  document.getElementById('saveTransactionBtn').addEventListener('click', saveTransaction);

  // Export / Import
  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', importData);

  // Theme & Settings toggle
  document.getElementById('themeToggleBtn').addEventListener('click', toggleThemePanel);
  document.getElementById('closeThemePanel').addEventListener('click', () => {
    document.getElementById('themePanelOverlay').classList.add('hidden');
  });
  document.getElementById('themePanelOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('themePanelOverlay'))
      document.getElementById('themePanelOverlay').classList.add('hidden');
  });

  // Settings Tabs Listeners
  document.getElementById('settingsTabTheme').addEventListener('click', () => switchSettingsTab('theme'));
  document.getElementById('settingsTabCategories').addEventListener('click', () => switchSettingsTab('categories'));

  // Settings Type Listeners
  document.getElementById('settingsTypeExpense').addEventListener('click', () => switchSettingsCategoryType('expense'));
  document.getElementById('settingsTypeIncome').addEventListener('click', () => switchSettingsCategoryType('income'));

  // Save Category Listener
  document.getElementById('saveNewCategoryBtn').addEventListener('click', addCategory);

  // Mode buttons
  document.getElementById('modeDark').addEventListener('click',  () => setMode('dark'));
  document.getElementById('modeLight').addEventListener('click', () => setMode('light'));

  // Preset colors
  document.querySelectorAll('.preset-dot').forEach(btn => {
    btn.addEventListener('click', () => setAccent(btn.dataset.color));
  });

  // Custom color
  document.getElementById('customColorPicker').addEventListener('input', e => {
    document.getElementById('colorHexLabel').textContent = e.target.value;
  });
  document.getElementById('applyCustomColor').addEventListener('click', () => {
    setAccent(document.getElementById('customColorPicker').value);
  });

  // History filters
  document.querySelectorAll('.chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
      c.classList.add('active');
      historyFilter.type = c.dataset.filter;
      applyHistoryFilter();
    });
  });
  document.getElementById('searchInput').addEventListener('input', e => {
    historyFilter.search = e.target.value;
    applyHistoryFilter();
  });
  document.getElementById('filterMonth').addEventListener('change', e => {
    historyFilter.month = e.target.value;
    applyHistoryFilter();
  });
  document.getElementById('filterCategory').addEventListener('change', e => {
    historyFilter.category = e.target.value;
    applyHistoryFilter();
  });

  // Dashboard month navigation
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    dashboardDate.setMonth(dashboardDate.getMonth() - 1);
    renderDashboard();
  });
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    dashboardDate.setMonth(dashboardDate.getMonth() + 1);
    renderDashboard();
  });



  // Confirm delete
  document.getElementById('cancelDelete').addEventListener('click', () => {
    document.getElementById('confirmModal').classList.add('hidden');
  });
  document.getElementById('confirmDelete').addEventListener('click', confirmDelete);
});
