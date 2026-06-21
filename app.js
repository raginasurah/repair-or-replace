'use strict';

/* ── Lifespan table ── */
const LIFESPANS = {
  'washing-machine': 11,
  'tumble-dryer': 13,
  'fridge': 13,
  'freezer': 12,
  'dishwasher': 9,
  'electric-oven': 13,
  'gas-hob': 15,
  'microwave': 9,
  'boiler': 13,
  'vacuum': 8,
  'tv': 8,
  'laptop': 5,
  'desktop': 7,
  'smartphone': 4,
  'tablet': 5,
  'coffee-machine': 7,
  'lawnmower': 9,
  'other': null,
};

const CATEGORY_LABELS = {
  'washing-machine': 'Washing machine',
  'tumble-dryer': 'Tumble dryer',
  'fridge': 'Fridge / fridge-freezer',
  'freezer': 'Freezer',
  'dishwasher': 'Dishwasher',
  'electric-oven': 'Electric oven / cooker',
  'gas-hob': 'Gas hob',
  'microwave': 'Microwave',
  'boiler': 'Boiler',
  'vacuum': 'Vacuum cleaner',
  'tv': 'Television',
  'laptop': 'Laptop',
  'desktop': 'Desktop PC',
  'smartphone': 'Smartphone',
  'tablet': 'Tablet',
  'coffee-machine': 'Coffee machine',
  'lawnmower': 'Lawnmower',
  'other': 'Other',
};

/* ── Storage ── */
const SCHEMA_VERSION = 1;
const STORAGE_KEY = 'warranty-tracker-v1';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) {
      return { schemaVersion: SCHEMA_VERSION, items: [] };
    }
    return parsed;
  } catch {
    return { schemaVersion: SCHEMA_VERSION, items: [] };
  }
}

let _saveTimer = null;
function saveData(data) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      showStorageError();
    }
  }, 500);
}

function showStorageError() {
  alert('Storage full — your data wasn\'t saved. Try clearing old browser data.');
}

let appData = loadData();

/* ── Calculator logic ── */
function calculate(category, lifespan, age, repairCost, replaceCost) {
  const typicalLife = lifespan;
  const safeAge = Math.max(0, age);
  const remainingLife = Math.max(0, typicalLife - safeAge);
  const repairRatio = repairCost / replaceCost;
  const replaceCostPerYear = replaceCost / typicalLife;
  const repairCostPerYear = remainingLife > 0 ? repairCost / remainingLife : Infinity;

  let verdict, theme, reason;

  if (remainingLife === 0) {
    if (repairCost < 0.2 * replaceCost) {
      verdict = 'Repair (short-term fix)';
      theme = 'shortterm';
      reason = `This item has exceeded its expected lifespan of ${typicalLife} years, but the repair is only ${pct(repairRatio)} of a replacement — it's worth a cheap fix to buy more time. Don't expect many more years from it.`;
    } else {
      verdict = 'Replace';
      theme = 'replace';
      reason = `This item has exceeded its expected lifespan of ${typicalLife} years and the repair costs ${pct(repairRatio)} of a new one. You'd be spending good money on a machine that's already past its life — replace it.`;
    }
  } else if (repairRatio >= 0.5) {
    verdict = 'Replace';
    theme = 'replace';
    reason = `The repair quote is ${pct(repairRatio)} of the replacement cost — above the 50% rule of thumb. At this price, you're better off putting that money toward a new one.`;
  } else if (repairCostPerYear < replaceCostPerYear) {
    verdict = 'Repair';
    theme = 'repair';
    reason = `Repairing costs £${fmt(repairCostPerYear)}/year of life remaining, versus £${fmt(replaceCostPerYear)}/year for a new one. With ${fmtYears(remainingLife)} of expected life left, the repair is the better value.`;
  } else {
    verdict = 'Replace';
    theme = 'replace';
    reason = `Repairing costs £${fmt(repairCostPerYear)}/year of remaining life, but a replacement only costs £${fmt(replaceCostPerYear)}/year over its full life. It's cheaper per year to replace.`;
  }

  return {
    verdict, theme, reason,
    remainingLife,
    repairRatio,
    repairCostPerYear: repairCostPerYear === Infinity ? null : repairCostPerYear,
    replaceCostPerYear,
  };
}

function pct(ratio) {
  return Math.round(ratio * 100) + '%';
}
function fmt(n) {
  if (!isFinite(n)) return '—';
  return n.toFixed(0);
}
function fmtYears(n) {
  if (n === 1) return '1 year';
  return n.toFixed(1).replace(/\.0$/, '') + ' years';
}

/* ── Calculator UI ── */
const categoryEl = document.getElementById('category');
const lifespanEl = document.getElementById('lifespan');
const ageEl = document.getElementById('age');
const repairCostEl = document.getElementById('repair-cost');
const replaceCostEl = document.getElementById('replace-cost');
const calcForm = document.getElementById('calc-form');
const resultEl = document.getElementById('result');
const calcMessageEl = document.getElementById('calc-message');

function updateLifespan() {
  const cat = categoryEl.value;
  const life = LIFESPANS[cat];
  if (life !== null) {
    lifespanEl.value = life;
    lifespanEl.readOnly = false;
  } else {
    lifespanEl.value = '';
    lifespanEl.readOnly = false;
    lifespanEl.placeholder = 'Enter years';
  }
}

categoryEl.addEventListener('change', updateLifespan);
updateLifespan();

function showMessage(msg) {
  calcMessageEl.textContent = msg;
  calcMessageEl.hidden = false;
  resultEl.hidden = true;
}

function hideMessage() {
  calcMessageEl.hidden = true;
}

calcForm.addEventListener('submit', (e) => {
  e.preventDefault();
  hideMessage();

  const category = categoryEl.value;
  const lifespan = parseFloat(lifespanEl.value);
  const age = parseFloat(ageEl.value);
  const repairCost = parseFloat(repairCostEl.value);
  const replaceCost = parseFloat(replaceCostEl.value);

  // Validate
  if (!lifespanEl.value.trim() || isNaN(lifespan) || lifespan <= 0) {
    showMessage('Please enter the typical lifespan in years for this item.');
    return;
  }
  if (ageEl.value.trim() === '' || isNaN(age)) {
    showMessage('Please enter the item\'s age in years.');
    return;
  }
  if (repairCostEl.value.trim() === '' || isNaN(repairCost) || repairCost < 0) {
    showMessage('No repair needed yet? Enter £0 or your repair quote to get a recommendation.');
    return;
  }
  if (repairCost === 0) {
    showMessage('No repair needed yet — come back when you have a repair quote.');
    return;
  }
  if (replaceCostEl.value.trim() === '' || isNaN(replaceCost) || replaceCost <= 0) {
    showMessage('Please enter the replacement cost so we can compare your options.');
    return;
  }

  const result = calculate(category, lifespan, age, repairCost, replaceCost);

  // Render result
  resultEl.className = `result result--${result.theme}`;
  document.getElementById('verdict').textContent = result.verdict;
  document.getElementById('verdict-reason').textContent = result.reason;
  document.getElementById('stat-ratio').textContent = pct(result.repairRatio);
  document.getElementById('stat-repair-per-year').textContent =
    result.repairCostPerYear !== null ? `£${fmt(result.repairCostPerYear)}/yr` : 'Past expected life';
  document.getElementById('stat-replace-per-year').textContent = `£${fmt(result.replaceCostPerYear)}/yr`;
  document.getElementById('stat-remaining').textContent =
    result.remainingLife > 0 ? fmtYears(result.remainingLife) : 'None — past expected life';

  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Auto-save to tracker
  autoSaveToTracker(category, replaceCost);
});

/* ── Auto-save to tracker ── */
function autoSaveToTracker(category, replaceCost) {
  const month = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const label = CATEGORY_LABELS[category] || 'Item';
  const defaultName = `${label} (${month})`;

  // Reuse existing auto-saved item for this session if we already saved one
  let item;
  if (window._autoSavedId) {
    item = appData.items.find(i => i.id === window._autoSavedId);
  }

  if (item) {
    item.category = category;
    item.price = replaceCost || item.price;
    const idx = appData.items.findIndex(i => i.id === item.id);
    appData.items[idx] = item;
  } else {
    item = {
      id: crypto.randomUUID(),
      name: defaultName,
      category,
      purchaseDate: '',
      price: replaceCost ? String(replaceCost) : '',
      warrantyMonths: '',
      notes: '',
    };
    appData.items.push(item);
    window._autoSavedId = item.id;
  }

  saveData(appData);
  renderTracker();

  // Show saved notice
  document.getElementById('saved-name').textContent = item.name;
  document.getElementById('saved-notice').hidden = false;
}

/* ── Rename from saved notice ── */
document.getElementById('btn-rename-item').addEventListener('click', () => {
  if (!window._autoSavedId) return;
  const item = appData.items.find(i => i.id === window._autoSavedId);
  if (item) { openItemModal(item, null); switchTab('tracker'); }
});

/* ── Tabs ── */
const tabs = document.querySelectorAll('.tab');
const panels = {
  calculator: document.getElementById('panel-calculator'),
  tracker: document.getElementById('panel-tracker'),
};

function switchTab(name) {
  tabs.forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('tab--active', active);
    t.setAttribute('aria-selected', active);
  });
  Object.entries(panels).forEach(([k, el]) => { el.hidden = k !== name; });
}

tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

/* ── Tracker ── */
function warrantyStatus(purchaseDate, warrantyMonths) {
  if (!purchaseDate || !warrantyMonths) return null;
  const purchase = new Date(purchaseDate);
  if (isNaN(purchase)) return null;
  const expiry = new Date(purchase);
  expiry.setMonth(expiry.getMonth() + parseInt(warrantyMonths, 10));
  const now = new Date();
  const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) return { label: 'Expired', cls: 'expired', daysLeft };
  if (daysLeft <= 60) return { label: 'Expiring soon', cls: 'expiring', daysLeft };
  return { label: 'Active', cls: 'active', daysLeft };
}

function ageFromDate(purchaseDate) {
  if (!purchaseDate) return null;
  const purchase = new Date(purchaseDate);
  if (isNaN(purchase)) return null;
  const years = (Date.now() - purchase) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, parseFloat(years.toFixed(1)));
}

function renderTracker() {
  const items = appData.items || [];
  const emptyEl = document.getElementById('tracker-empty');
  const listEl = document.getElementById('item-list');

  if (items.length === 0) {
    emptyEl.hidden = false;
    listEl.innerHTML = '';
    return;
  }
  emptyEl.hidden = true;

  // Sort: expiring soon first, then active, then expired, then no-warranty
  const order = { expiring: 0, active: 1, expired: 2 };
  const sorted = [...items].sort((a, b) => {
    const sa = warrantyStatus(a.purchaseDate, a.warrantyMonths);
    const sb = warrantyStatus(b.purchaseDate, b.warrantyMonths);
    const oa = sa ? (order[sa.cls] ?? 3) : 3;
    const ob = sb ? (order[sb.cls] ?? 3) : 3;
    return oa - ob;
  });

  listEl.innerHTML = sorted.map(item => {
    const status = warrantyStatus(item.purchaseDate, item.warrantyMonths);
    const badge = status
      ? `<span class="badge badge--${status.cls}">${status.label}${status.cls === 'expiring' ? ` — ${status.daysLeft}d left` : ''}</span>`
      : '';
    const meta = [
      item.purchaseDate ? `Bought ${item.purchaseDate}` : '',
      item.price ? `£${item.price}` : '',
      item.warrantyMonths ? `${item.warrantyMonths}mo warranty` : '',
    ].filter(Boolean).join(' · ');

    return `<li class="item-card" data-id="${item.id}">
      <div class="item-card-header">
        <div>
          <div class="item-name">${escHtml(item.name)}</div>
          <div class="item-category">${CATEGORY_LABELS[item.category] || item.category}</div>
        </div>
        ${badge}
      </div>
      ${meta ? `<div class="item-meta">${escHtml(meta)}</div>` : ''}
      ${item.notes ? `<div class="item-meta">${escHtml(item.notes)}</div>` : ''}
      <div class="item-actions">
        <button class="btn-secondary btn-send-to-calc" data-id="${item.id}">Send to calculator</button>
        <button class="btn-secondary btn-edit-item" data-id="${item.id}">Edit</button>
        <button class="btn-secondary btn-danger btn-delete-item" data-id="${item.id}">Delete</button>
      </div>
    </li>`;
  }).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Item modal ── */
const modal = document.getElementById('item-modal');
const itemForm = document.getElementById('item-form');
const modalTitle = document.getElementById('modal-title');

// Populate category select in modal
const itemCategoryEl = document.getElementById('item-category');
Object.entries(CATEGORY_LABELS).forEach(([val, label]) => {
  const opt = document.createElement('option');
  opt.value = val;
  opt.textContent = label;
  itemCategoryEl.appendChild(opt);
});

function openItemModal(existingItem, prefill) {
  document.getElementById('item-id').value = existingItem ? existingItem.id : '';
  modalTitle.textContent = existingItem ? 'Edit item' : 'Add item';
  document.getElementById('item-name').value = existingItem ? existingItem.name : '';
  itemCategoryEl.value = existingItem ? existingItem.category : (prefill && prefill.category ? prefill.category : 'washing-machine');
  document.getElementById('item-purchase-date').value = existingItem ? (existingItem.purchaseDate || '') : '';
  document.getElementById('item-price').value = existingItem ? (existingItem.price || '') : (prefill && prefill.replaceCost ? prefill.replaceCost : '');
  document.getElementById('item-warranty').value = existingItem ? (existingItem.warrantyMonths || '') : '';
  document.getElementById('item-notes').value = existingItem ? (existingItem.notes || '') : '';
  modal.hidden = false;
  document.getElementById('item-name').focus();
}

function closeItemModal() {
  modal.hidden = true;
}

document.getElementById('btn-add-item').addEventListener('click', () => openItemModal(null, null));
document.getElementById('btn-cancel-item').addEventListener('click', closeItemModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeItemModal(); });

itemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  if (!name) { document.getElementById('item-name').focus(); return; }

  const id = document.getElementById('item-id').value || crypto.randomUUID();
  const item = {
    id,
    name,
    category: itemCategoryEl.value,
    purchaseDate: document.getElementById('item-purchase-date').value || '',
    price: document.getElementById('item-price').value || '',
    warrantyMonths: document.getElementById('item-warranty').value || '',
    notes: document.getElementById('item-notes').value.trim(),
  };

  const idx = appData.items.findIndex(i => i.id === id);
  if (idx >= 0) {
    appData.items[idx] = item;
  } else {
    appData.items.push(item);
  }

  saveData(appData);
  closeItemModal();
  renderTracker();
});

/* ── Item list actions (delegated) ── */
document.getElementById('item-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const item = appData.items.find(i => i.id === id);

  if (btn.classList.contains('btn-edit-item') && item) {
    openItemModal(item, null);
  }

  if (btn.classList.contains('btn-delete-item') && item) {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    appData.items = appData.items.filter(i => i.id !== id);
    saveData(appData);
    renderTracker();
  }

  if (btn.classList.contains('btn-send-to-calc') && item) {
    const age = ageFromDate(item.purchaseDate);
    categoryEl.value = item.category || 'washing-machine';
    updateLifespan();
    if (age !== null) ageEl.value = age;
    if (item.price) replaceCostEl.value = item.price;
    repairCostEl.value = '';
    resultEl.hidden = true;
    hideMessage();
    switchTab('calculator');
    repairCostEl.focus();
  }
});

/* ── Export / Import / Clear ── */
document.getElementById('btn-export').addEventListener('click', () => {
  const json = JSON.stringify(appData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warranty-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('btn-import').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed || !Array.isArray(parsed.items)) throw new Error('Invalid format');
      if (!confirm(`Import ${parsed.items.length} item(s)? This will replace your current data.`)) return;
      appData = parsed;
      saveData(appData);
      renderTracker();
    } catch {
      alert('Import failed — the file doesn\'t look like a valid backup.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (!confirm('Clear ALL data? This permanently deletes every saved item and cannot be undone.')) return;
  appData = { schemaVersion: SCHEMA_VERSION, items: [] };
  saveData(appData);
  renderTracker();
});

/* ── Init ── */
renderTracker();
