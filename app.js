'use strict';

/* ── Lifespan & category data ── */
const LIFESPANS = {
  'washing-machine': 11, 'tumble-dryer': 13, 'fridge': 13, 'freezer': 12,
  'dishwasher': 9, 'electric-oven': 13, 'gas-hob': 15, 'microwave': 9,
  'boiler': 13, 'vacuum': 8, 'tv': 8, 'laptop': 5, 'desktop': 7,
  'smartphone': 4, 'tablet': 5, 'coffee-machine': 7, 'lawnmower': 9, 'other': null,
};
const CATEGORY_LABELS = {
  'washing-machine': 'Washing machine', 'tumble-dryer': 'Tumble dryer',
  'fridge': 'Fridge / fridge-freezer', 'freezer': 'Freezer',
  'dishwasher': 'Dishwasher', 'electric-oven': 'Electric oven / cooker',
  'gas-hob': 'Gas hob', 'microwave': 'Microwave', 'boiler': 'Boiler',
  'vacuum': 'Vacuum cleaner', 'tv': 'Television', 'laptop': 'Laptop',
  'desktop': 'Desktop PC', 'smartphone': 'Smartphone', 'tablet': 'Tablet',
  'coffee-machine': 'Coffee machine', 'lawnmower': 'Lawnmower', 'other': 'Other',
};

/* ── Auth ── */
const ADMIN_EMAIL = 'rageonblood@gmail.com';
const ADMIN_HASH  = '67363500c70d6acea6e9acd8f5c47dae81bf473ce8c7ea1070271882c1c02381'; // SHA-256 of "Repair2026!"
const FREE_ITEM_LIMIT = 3;

async function hashStr(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSession() {
  try { return JSON.parse(sessionStorage.getItem('rr-session') || 'null'); } catch { return null; }
}
function setSession(data) {
  if (data) sessionStorage.setItem('rr-session', JSON.stringify(data));
  else sessionStorage.removeItem('rr-session');
}
function isLoggedIn() { return !!getSession(); }

/* ── Storage ── */
const STORAGE_KEY = 'warrantyTracker';
const SCHEMA_VERSION = 1;

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { schemaVersion: SCHEMA_VERSION, items: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items)) return { schemaVersion: SCHEMA_VERSION, items: [] };
    return parsed;
  } catch { return { schemaVersion: SCHEMA_VERSION, items: [] }; }
}
let _saveTimer = null;
function saveData(data) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { alert('Storage full — data not saved.'); }
  }, 500);
}
let appData = loadData();

/* ── Calculator logic (shared) ── */
function calculate(category, lifespan, age, repairCost, replaceCost) {
  const typicalLife = lifespan;
  const remainingLife = Math.max(0, typicalLife - Math.max(0, age));
  const repairRatio = repairCost / replaceCost;
  const replaceCostPerYear = replaceCost / typicalLife;
  const repairCostPerYear = remainingLife > 0 ? repairCost / remainingLife : Infinity;
  let verdict, theme, reason;

  if (remainingLife === 0) {
    if (repairCost < 0.2 * replaceCost) {
      verdict = 'Repair (short-term fix)'; theme = 'shortterm';
      reason = `This item has exceeded its expected lifespan of ${typicalLife} years, but the repair is only ${pct(repairRatio)} of a replacement — worth a cheap fix to buy more time.`;
    } else {
      verdict = 'Replace'; theme = 'replace';
      reason = `This item has exceeded its expected lifespan of ${typicalLife} years and the repair costs ${pct(repairRatio)} of a new one. Replace it.`;
    }
  } else if (repairRatio >= 0.5) {
    verdict = 'Replace'; theme = 'replace';
    reason = `The repair quote is ${pct(repairRatio)} of the replacement cost — above the 50% rule. Put that money toward a new one.`;
  } else if (repairCostPerYear < replaceCostPerYear) {
    verdict = 'Repair'; theme = 'repair';
    reason = `Repairing costs £${fmt(repairCostPerYear)}/year vs £${fmt(replaceCostPerYear)}/year for a new one. With ${fmtYears(remainingLife)} of life left, the repair is better value.`;
  } else {
    verdict = 'Replace'; theme = 'replace';
    reason = `Repairing costs £${fmt(repairCostPerYear)}/year of remaining life, but a replacement is only £${fmt(replaceCostPerYear)}/year over its full life. Cheaper per year to replace.`;
  }
  return { verdict, theme, reason, remainingLife, repairRatio, repairCostPerYear: repairCostPerYear === Infinity ? null : repairCostPerYear, replaceCostPerYear };
}
function pct(r) { return Math.round(r * 100) + '%'; }
function fmt(n) { return isFinite(n) ? n.toFixed(0) : '—'; }
function fmtYears(n) { return n === 1 ? '1 year' : n.toFixed(1).replace(/\.0$/, '') + ' years'; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── Warranty helpers ── */
function warrantyStatus(purchaseDate, warrantyMonths) {
  if (!purchaseDate || !warrantyMonths) return null;
  const purchase = new Date(purchaseDate);
  if (isNaN(purchase)) return null;
  const expiry = new Date(purchase);
  expiry.setMonth(expiry.getMonth() + parseInt(warrantyMonths, 10));
  const daysLeft = Math.ceil((expiry - Date.now()) / 86400000);
  if (daysLeft < 0) return { label: 'Expired', cls: 'expired', daysLeft };
  if (daysLeft <= 60) return { label: 'Expiring soon', cls: 'expiring', daysLeft };
  return { label: 'Active', cls: 'active', daysLeft };
}
function ageFromDate(purchaseDate) {
  if (!purchaseDate) return null;
  const d = new Date(purchaseDate);
  if (isNaN(d)) return null;
  return Math.max(0, parseFloat(((Date.now() - d) / 31557600000).toFixed(1)));
}
function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ════════════════════════════════════════
   VIEW ROUTING
════════════════════════════════════════ */
function showView(name) {
  ['view-free', 'view-login', 'view-premium'].forEach(id => {
    document.getElementById(id).hidden = id !== name;
  });
}

/* ════════════════════════════════════════
   FREE VIEW
════════════════════════════════════════ */
// Header sign-in / upgrade buttons
document.getElementById('btn-open-login').addEventListener('click', () => showView('view-login'));
document.getElementById('btn-upgrade-strip').addEventListener('click', () => showView('view-login'));
document.getElementById('btn-upgrade-result')?.addEventListener('click', () => showView('view-login'));
document.getElementById('btn-upgrade-limit')?.addEventListener('click', () => showView('view-login'));
document.getElementById('btn-export-free')?.addEventListener('click', () => {
  alert('Export is a Premium feature. Sign in to access it.');
});

// Tabs
const tabs = document.querySelectorAll('.tab');
function switchTab(name) {
  tabs.forEach(t => {
    const a = t.dataset.tab === name;
    t.classList.toggle('tab--active', a);
    t.setAttribute('aria-selected', a);
  });
  ['calculator', 'tracker'].forEach(k => {
    document.getElementById(`panel-${k}`).hidden = k !== name;
  });
}
tabs.forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

// Free calculator
const categoryEl = document.getElementById('category');
const lifespanEl = document.getElementById('lifespan');
const ageEl = document.getElementById('age');
const repairCostEl = document.getElementById('repair-cost');
const replaceCostEl = document.getElementById('replace-cost');
const calcForm = document.getElementById('calc-form');
const resultEl = document.getElementById('result');
const calcMessageEl = document.getElementById('calc-message');

function updateLifespan() {
  const life = LIFESPANS[categoryEl.value];
  lifespanEl.value = life !== null ? life : '';
  if (life === null) lifespanEl.placeholder = 'Enter years';
}
categoryEl.addEventListener('change', updateLifespan);
updateLifespan();

function showMsg(msg) { calcMessageEl.textContent = msg; calcMessageEl.hidden = false; resultEl.hidden = true; }
function hideMsg() { calcMessageEl.hidden = true; }

calcForm.addEventListener('submit', e => {
  e.preventDefault(); hideMsg();
  const category = categoryEl.value;
  const lifespan = parseFloat(lifespanEl.value);
  const age = parseFloat(ageEl.value);
  const repairCost = parseFloat(repairCostEl.value);
  const replaceCost = parseFloat(replaceCostEl.value);
  if (!lifespanEl.value.trim() || isNaN(lifespan) || lifespan <= 0) return showMsg('Please enter the typical lifespan in years.');
  if (ageEl.value.trim() === '' || isNaN(age)) return showMsg('Please enter the item age in years.');
  if (repairCostEl.value.trim() === '' || isNaN(repairCost) || repairCost < 0) return showMsg('Enter £0 or your repair quote to get a recommendation.');
  if (repairCost === 0) return showMsg('No repair needed yet — come back when you have a quote.');
  if (replaceCostEl.value.trim() === '' || isNaN(replaceCost) || replaceCost <= 0) return showMsg('Please enter the replacement cost to compare options.');

  const r = calculate(category, lifespan, age, repairCost, replaceCost);
  resultEl.className = `result result--${r.theme}`;
  document.getElementById('verdict').textContent = r.verdict;
  document.getElementById('verdict-reason').textContent = r.reason;
  document.getElementById('stat-ratio').textContent = pct(r.repairRatio);
  document.getElementById('stat-repair-per-year').textContent = r.repairCostPerYear !== null ? `£${fmt(r.repairCostPerYear)}/yr` : 'Past expected life';
  document.getElementById('stat-replace-per-year').textContent = `£${fmt(r.replaceCostPerYear)}/yr`;
  document.getElementById('stat-remaining').textContent = r.remainingLife > 0 ? fmtYears(r.remainingLife) : 'None — past expected life';
  resultEl.hidden = false;
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  freeAutoSave(category, replaceCost);
});

// Free auto-save (capped at 3)
function freeAutoSave(category, replaceCost) {
  const month = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const label = CATEGORY_LABELS[category] || 'Item';
  const defaultName = `${label} (${month})`;
  let item;
  if (window._autoSavedId) item = appData.items.find(i => i.id === window._autoSavedId);
  if (item) {
    item.category = category; item.price = replaceCost || item.price;
    appData.items[appData.items.findIndex(i => i.id === item.id)] = item;
  } else {
    if (appData.items.length >= FREE_ITEM_LIMIT) {
      // Show limit banner but don't save
      document.getElementById('free-limit-banner').hidden = false;
      return;
    }
    item = { id: crypto.randomUUID(), name: defaultName, category, purchaseDate: '', price: replaceCost ? String(replaceCost) : '', warrantyMonths: '', notes: '' };
    appData.items.push(item);
    window._autoSavedId = item.id;
  }
  saveData(appData);
  renderFreeTracker();
  document.getElementById('saved-name').textContent = item.name;
  document.getElementById('saved-notice').hidden = false;
  document.getElementById('free-limit-banner').hidden = appData.items.length < FREE_ITEM_LIMIT;
}

document.getElementById('btn-rename-item').addEventListener('click', () => {
  if (!window._autoSavedId) return;
  const item = appData.items.find(i => i.id === window._autoSavedId);
  if (item) { openFreeModal(item); switchTab('tracker'); }
});

// Free tracker render
function renderFreeTracker() {
  const items = appData.items || [];
  const emptyEl = document.getElementById('tracker-empty');
  const listEl = document.getElementById('item-list');
  document.getElementById('free-limit-banner').hidden = items.length < FREE_ITEM_LIMIT;
  if (!items.length) { emptyEl.hidden = false; listEl.innerHTML = ''; return; }
  emptyEl.hidden = true;
  const order = { expiring: 0, active: 1, expired: 2 };
  const sorted = [...items].sort((a, b) => {
    const sa = warrantyStatus(a.purchaseDate, a.warrantyMonths);
    const sb = warrantyStatus(b.purchaseDate, b.warrantyMonths);
    return (sa ? (order[sa.cls] ?? 3) : 3) - (sb ? (order[sb.cls] ?? 3) : 3);
  });
  listEl.innerHTML = sorted.map(item => {
    const st = warrantyStatus(item.purchaseDate, item.warrantyMonths);
    const badge = st ? `<span class="badge badge--${st.cls}">${st.label}${st.cls === 'expiring' ? ` — ${st.daysLeft}d left` : ''}</span>` : '';
    const meta = [item.purchaseDate ? `Bought ${item.purchaseDate}` : '', item.price ? `£${item.price}` : '', item.warrantyMonths ? `${item.warrantyMonths}mo warranty` : ''].filter(Boolean).join(' · ');
    return `<li class="item-card" data-id="${item.id}">
      <div class="item-card-header">
        <div><div class="item-name">${escHtml(item.name)}</div><div class="item-category">${CATEGORY_LABELS[item.category] || item.category}</div></div>
        ${badge}
      </div>
      ${meta ? `<div class="item-meta">${escHtml(meta)}</div>` : ''}
      ${item.notes ? `<div class="item-meta">${escHtml(item.notes)}</div>` : ''}
      <div class="item-actions">
        <button class="btn-secondary btn-stc" data-id="${item.id}">Send to calculator</button>
        <button class="btn-secondary btn-edit" data-id="${item.id}">Edit</button>
        <button class="btn-secondary btn-danger btn-del" data-id="${item.id}">Delete</button>
      </div>
    </li>`;
  }).join('');
}

// Free modal
const freeModal = document.getElementById('item-modal');
const freeItemForm = document.getElementById('item-form');
const freeItemCatEl = document.getElementById('item-category');
Object.entries(CATEGORY_LABELS).forEach(([val, label]) => {
  const o = document.createElement('option'); o.value = val; o.textContent = label; freeItemCatEl.appendChild(o);
});
function openFreeModal(existing) {
  document.getElementById('item-id').value = existing ? existing.id : '';
  document.getElementById('modal-title').textContent = existing ? 'Edit item' : 'Add item';
  document.getElementById('item-name').value = existing ? existing.name : '';
  freeItemCatEl.value = existing ? existing.category : 'washing-machine';
  document.getElementById('item-purchase-date').value = existing ? (existing.purchaseDate || '') : '';
  document.getElementById('item-price').value = existing ? (existing.price || '') : '';
  document.getElementById('item-warranty').value = existing ? (existing.warrantyMonths || '') : '';
  document.getElementById('item-notes').value = existing ? (existing.notes || '') : '';
  freeModal.hidden = false;
  document.getElementById('item-name').focus();
}
function closeFreeModal() { freeModal.hidden = true; }
document.getElementById('btn-add-item').addEventListener('click', () => {
  if (appData.items.length >= FREE_ITEM_LIMIT) {
    document.getElementById('free-limit-banner').hidden = false;
    document.getElementById('free-limit-banner').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  openFreeModal(null);
});
document.getElementById('btn-cancel-item').addEventListener('click', closeFreeModal);
freeModal.addEventListener('click', e => { if (e.target === freeModal) closeFreeModal(); });
freeItemForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  if (!name) { document.getElementById('item-name').focus(); return; }
  const id = document.getElementById('item-id').value || crypto.randomUUID();
  const item = { id, name, category: freeItemCatEl.value, purchaseDate: document.getElementById('item-purchase-date').value || '', price: document.getElementById('item-price').value || '', warrantyMonths: document.getElementById('item-warranty').value || '', notes: document.getElementById('item-notes').value.trim() };
  const idx = appData.items.findIndex(i => i.id === id);
  if (idx >= 0) appData.items[idx] = item; else appData.items.push(item);
  saveData(appData); closeFreeModal(); renderFreeTracker();
});
document.getElementById('item-list').addEventListener('click', e => {
  const btn = e.target.closest('button'); if (!btn) return;
  const id = btn.dataset.id;
  const item = appData.items.find(i => i.id === id);
  if (btn.classList.contains('btn-edit') && item) openFreeModal(item);
  if (btn.classList.contains('btn-del') && item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    appData.items = appData.items.filter(i => i.id !== id);
    if (window._autoSavedId === id) window._autoSavedId = null;
    saveData(appData); renderFreeTracker();
  }
  if (btn.classList.contains('btn-stc') && item) {
    categoryEl.value = item.category || 'washing-machine'; updateLifespan();
    const age = ageFromDate(item.purchaseDate);
    if (age !== null) ageEl.value = age;
    if (item.price) replaceCostEl.value = item.price;
    repairCostEl.value = ''; resultEl.hidden = true; hideMsg();
    switchTab('calculator'); repairCostEl.focus();
  }
});
document.getElementById('btn-clear-all').addEventListener('click', () => {
  if (!confirm('Clear ALL data? This permanently deletes every saved item.')) return;
  appData = { schemaVersion: SCHEMA_VERSION, items: [] };
  window._autoSavedId = null; saveData(appData); renderFreeTracker();
});

/* ════════════════════════════════════════
   LOGIN VIEW
════════════════════════════════════════ */
document.getElementById('btn-back-free').addEventListener('click', () => showView('view-free'));
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('btn-login-submit') || e.target.querySelector('button[type=submit]');
  const errEl = document.getElementById('login-error');
  errEl.hidden = true;
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) { errEl.textContent = 'Please enter your email and password.'; errEl.hidden = false; return; }
  if (btn) { btn.textContent = 'Signing in…'; btn.disabled = true; }
  const hash = await hashStr(pass);
  if (btn) { btn.textContent = 'Sign in to Premium'; btn.disabled = false; }
  if (email === ADMIN_EMAIL && hash === ADMIN_HASH) {
    setSession({ email, role: 'admin' });
    showView('view-premium');
    initPremium();
  } else {
    errEl.textContent = 'Incorrect email or password. Please try again.';
    errEl.hidden = false;
  }
});

/* ════════════════════════════════════════
   PREMIUM VIEW
════════════════════════════════════════ */
let premiumInited = false;
function initPremium() {
  if (premiumInited) { refreshPremium(); return; }
  premiumInited = true;

  // Greeting
  const h = new Date().getHours();
  document.getElementById('prm-greeting').textContent = h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.';

  // Sidebar nav
  document.querySelectorAll('.prm-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.prm-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const panelId = btn.dataset.panel;
      document.querySelectorAll('.prm-panel').forEach(p => { p.hidden = p.id !== panelId; });
      if (panelId === 'prm-items') renderPremiumItems();
      if (panelId === 'prm-analytics') renderAnalytics();
    });
  });

  // "View all" links
  document.querySelectorAll('[data-panel]').forEach(el => {
    if (el.classList.contains('prm-nav-btn')) return;
    el.addEventListener('click', () => {
      document.querySelectorAll('.prm-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === el.dataset.panel));
      document.querySelectorAll('.prm-panel').forEach(p => { p.hidden = p.id !== el.dataset.panel; });
      if (el.dataset.panel === 'prm-items') renderPremiumItems();
    });
  });

  // Sign out
  document.getElementById('btn-signout').addEventListener('click', signOut);
  document.getElementById('prm-signout-settings').addEventListener('click', signOut);

  // Add item buttons
  document.getElementById('prm-btn-add').addEventListener('click', () => openPrmModal(null));
  document.getElementById('prm-btn-add-2').addEventListener('click', () => openPrmModal(null));

  // Premium calculator
  const pCatEl = document.getElementById('prm-category');
  const pLifeEl = document.getElementById('prm-lifespan');
  function prmUpdateLifespan() {
    const life = LIFESPANS[pCatEl.value];
    pLifeEl.value = life !== null ? life : '';
    if (life === null) pLifeEl.placeholder = 'Enter years';
  }
  pCatEl.addEventListener('change', prmUpdateLifespan); prmUpdateLifespan();

  document.getElementById('prm-calc-form').addEventListener('submit', e => {
    e.preventDefault();
    const category = pCatEl.value;
    const lifespan = parseFloat(pLifeEl.value);
    const age = parseFloat(document.getElementById('prm-age').value);
    const repair = parseFloat(document.getElementById('prm-repair-cost').value);
    const replace = parseFloat(document.getElementById('prm-replace-cost').value);
    if (!pLifeEl.value || isNaN(lifespan) || lifespan <= 0) return alert('Enter the typical lifespan in years.');
    if (isNaN(age)) return alert('Enter the item age.');
    if (isNaN(repair) || repair < 0) return alert('Enter the repair quote.');
    if (repair === 0) return alert('Enter a repair quote greater than £0.');
    if (isNaN(replace) || replace <= 0) return alert('Enter the replacement cost.');
    const r = calculate(category, lifespan, age, repair, replace);
    const leftEl = document.getElementById('prm-result-left');
    leftEl.className = `prm-result-left theme-${r.theme}`;
    document.getElementById('prm-verdict-big').textContent = r.verdict;
    document.getElementById('prm-verdict-reason').textContent = r.reason;
    document.getElementById('prm-sr').textContent = pct(r.repairRatio);
    document.getElementById('prm-srpy').textContent = r.repairCostPerYear !== null ? `£${fmt(r.repairCostPerYear)}/yr` : '—';
    document.getElementById('prm-srpy2').textContent = `£${fmt(r.replaceCostPerYear)}/yr`;
    document.getElementById('prm-srem').textContent = r.remainingLife > 0 ? fmtYears(r.remainingLife) : 'Past expected life';
    document.getElementById('prm-result').hidden = false;
    prmAutoSave(category, replace);
  });

  // Search + filter
  document.getElementById('prm-search').addEventListener('input', renderPremiumItems);
  document.getElementById('prm-filter').addEventListener('change', renderPremiumItems);

  // Settings
  document.getElementById('prm-export').addEventListener('click', exportData);
  document.getElementById('prm-import-file').addEventListener('change', importData);
  document.getElementById('prm-clear-all').addEventListener('click', () => {
    if (!confirm('Clear ALL data? This cannot be undone.')) return;
    appData = { schemaVersion: SCHEMA_VERSION, items: [] };
    window._prmAutoSavedId = null; saveData(appData); refreshPremium();
  });

  // Premium modal
  const prmModal = document.getElementById('prm-item-modal');
  function closePrmModal() { prmModal.hidden = true; }
  document.getElementById('prm-close-modal').addEventListener('click', closePrmModal);
  document.getElementById('prm-cancel-modal').addEventListener('click', closePrmModal);
  prmModal.addEventListener('click', e => { if (e.target === prmModal) closePrmModal(); });

  // Populate premium category select
  const prmCatEl = document.getElementById('prm-item-cat');
  Object.entries(CATEGORY_LABELS).forEach(([val, label]) => {
    const o = document.createElement('option'); o.value = val; o.textContent = label; prmCatEl.appendChild(o);
  });

  document.getElementById('prm-item-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('prm-item-name').value.trim();
    if (!name) { document.getElementById('prm-item-name').focus(); return; }
    const id = document.getElementById('prm-item-id').value || crypto.randomUUID();
    const item = {
      id, name, category: document.getElementById('prm-item-cat').value,
      purchaseDate: document.getElementById('prm-item-date').value || '',
      price: document.getElementById('prm-item-price').value || '',
      warrantyMonths: document.getElementById('prm-item-warranty').value || '',
      notes: document.getElementById('prm-item-notes').value.trim(),
    };
    const idx = appData.items.findIndex(i => i.id === id);
    if (idx >= 0) appData.items[idx] = item; else appData.items.push(item);
    saveData(appData); closePrmModal(); refreshPremium();
  });

  refreshPremium();
}

function openPrmModal(existing) {
  document.getElementById('prm-item-id').value = existing ? existing.id : '';
  document.getElementById('prm-modal-title').textContent = existing ? 'Edit item' : 'Add item';
  document.getElementById('prm-item-name').value = existing ? existing.name : '';
  document.getElementById('prm-item-cat').value = existing ? existing.category : 'washing-machine';
  document.getElementById('prm-item-date').value = existing ? (existing.purchaseDate || '') : '';
  document.getElementById('prm-item-price').value = existing ? (existing.price || '') : '';
  document.getElementById('prm-item-warranty').value = existing ? (existing.warrantyMonths || '') : '';
  document.getElementById('prm-item-notes').value = existing ? (existing.notes || '') : '';
  document.getElementById('prm-item-modal').hidden = false;
  document.getElementById('prm-item-name').focus();
}

function prmAutoSave(category, replaceCost) {
  const month = new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' });
  const defaultName = `${CATEGORY_LABELS[category] || 'Item'} (${month})`;
  let item;
  if (window._prmAutoSavedId) item = appData.items.find(i => i.id === window._prmAutoSavedId);
  if (item) {
    item.category = category; item.price = replaceCost || item.price;
    appData.items[appData.items.findIndex(i => i.id === item.id)] = item;
  } else {
    item = { id: crypto.randomUUID(), name: defaultName, category, purchaseDate: '', price: replaceCost ? String(replaceCost) : '', warrantyMonths: '', notes: '' };
    appData.items.push(item);
    window._prmAutoSavedId = item.id;
  }
  saveData(appData);
  document.getElementById('prm-saved-name').textContent = item.name;
  document.getElementById('prm-calc-saved').hidden = false;
  refreshPremium();
}

function refreshPremium() {
  renderDashboard();
  renderPremiumItems();
}

function renderDashboard() {
  const items = appData.items || [];
  const statuses = items.map(i => warrantyStatus(i.purchaseDate, i.warrantyMonths));
  const active = statuses.filter(s => s && s.cls === 'active').length;
  const expiring = statuses.filter(s => s && s.cls === 'expiring').length;
  const totalVal = items.reduce((sum, i) => sum + (parseFloat(i.price) || 0), 0);

  document.getElementById('ds-total').textContent = items.length;
  document.getElementById('ds-active').textContent = active;
  document.getElementById('ds-expiring').textContent = expiring;
  document.getElementById('ds-value').textContent = `£${totalVal.toLocaleString('en-GB')}`;

  // Alerts
  const alertsEl = document.getElementById('prm-alerts');
  const alerts = items
    .map(i => ({ item: i, st: warrantyStatus(i.purchaseDate, i.warrantyMonths) }))
    .filter(x => x.st && (x.st.cls === 'expiring' || x.st.cls === 'expired'))
    .sort((a, b) => a.st.daysLeft - b.st.daysLeft);
  if (!alerts.length) {
    alertsEl.innerHTML = '<p class="prm-muted">No upcoming expirations — you\'re all clear.</p>';
  } else {
    alertsEl.innerHTML = alerts.map(({ item, st }) => {
      const dotCls = st.cls === 'expiring' ? 'prm-alert-dot--expiring' : 'prm-alert-dot--expired';
      const days = st.cls === 'expired' ? 'Expired' : `${st.daysLeft} days left`;
      return `<div class="prm-alert-item"><div class="prm-alert-dot ${dotCls}"></div><span class="prm-alert-name">${escHtml(item.name)}</span><span class="prm-alert-days">${days}</span></div>`;
    }).join('');
  }

  // Recent (last 5)
  const recentEl = document.getElementById('prm-recent');
  const recent = [...items].slice(-5).reverse();
  if (!recent.length) { recentEl.innerHTML = '<p class="prm-muted">No items yet.</p>'; return; }
  recentEl.innerHTML = recent.map(item => {
    const st = warrantyStatus(item.purchaseDate, item.warrantyMonths);
    const badgeCls = st ? st.cls : 'none';
    const badgeLabel = st ? st.label : 'No warranty';
    return `<div class="prm-recent-card"><div class="prm-rc-name">${escHtml(item.name)}</div><div class="prm-rc-cat">${CATEGORY_LABELS[item.category] || item.category}</div><span class="prm-badge prm-badge--${badgeCls}">${badgeLabel}</span>${item.price ? `<div class="prm-rc-val">£${item.price}</div>` : ''}</div>`;
  }).join('');
}

function renderPremiumItems() {
  const items = appData.items || [];
  const search = (document.getElementById('prm-search')?.value || '').toLowerCase();
  const filterStatus = document.getElementById('prm-filter')?.value || '';
  const emptyEl = document.getElementById('prm-items-empty');
  const tableEl = document.getElementById('prm-table');
  const tbody = document.getElementById('prm-tbody');

  let filtered = items;
  if (search) filtered = filtered.filter(i => i.name.toLowerCase().includes(search) || (CATEGORY_LABELS[i.category] || '').toLowerCase().includes(search));
  if (filterStatus) filtered = filtered.filter(i => {
    const st = warrantyStatus(i.purchaseDate, i.warrantyMonths);
    return st && st.cls === filterStatus;
  });

  document.getElementById('prm-items-count').textContent = `${items.length} item${items.length !== 1 ? 's' : ''}`;

  if (!filtered.length) {
    emptyEl.hidden = false; tableEl.hidden = true; return;
  }
  emptyEl.hidden = true; tableEl.hidden = false;

  const order = { expiring: 0, active: 1, expired: 2 };
  filtered.sort((a, b) => {
    const sa = warrantyStatus(a.purchaseDate, a.warrantyMonths);
    const sb = warrantyStatus(b.purchaseDate, b.warrantyMonths);
    return (sa ? (order[sa.cls] ?? 3) : 3) - (sb ? (order[sb.cls] ?? 3) : 3);
  });

  tbody.innerHTML = filtered.map(item => {
    const st = warrantyStatus(item.purchaseDate, item.warrantyMonths);
    const badgeCls = st ? st.cls : 'none';
    const badgeLabel = st ? (st.cls === 'expiring' ? `${st.label} (${st.daysLeft}d)` : st.label) : '—';
    return `<tr>
      <td><span class="prm-td-name">${escHtml(item.name)}</span>${item.notes ? `<br><span style="font-size:.75rem;color:rgba(255,255,255,.3)">${escHtml(item.notes)}</span>` : ''}</td>
      <td>${CATEGORY_LABELS[item.category] || item.category}</td>
      <td>${fmtDate(item.purchaseDate)}</td>
      <td>${item.warrantyMonths ? `${item.warrantyMonths} mo` : '—'}</td>
      <td><span class="prm-badge prm-badge--${badgeCls}">${badgeLabel}</span></td>
      <td>${item.price ? `£${item.price}` : '—'}</td>
      <td><div class="prm-td-actions">
        <button class="prm-tbl-btn prm-stc" data-id="${item.id}">Send to calc</button>
        <button class="prm-tbl-btn prm-edit" data-id="${item.id}">Edit</button>
        <button class="prm-tbl-btn prm-tbl-btn--danger prm-del" data-id="${item.id}">Delete</button>
      </div></td>
    </tr>`;
  }).join('');

  // Table actions (re-bind)
  tbody.querySelectorAll('.prm-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appData.items.find(i => i.id === btn.dataset.id);
      if (item) openPrmModal(item);
    });
  });
  tbody.querySelectorAll('.prm-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appData.items.find(i => i.id === btn.dataset.id);
      if (!item || !confirm(`Delete "${item.name}"?`)) return;
      appData.items = appData.items.filter(i => i.id !== btn.dataset.id);
      saveData(appData); refreshPremium();
    });
  });
  tbody.querySelectorAll('.prm-stc').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = appData.items.find(i => i.id === btn.dataset.id);
      if (!item) return;
      // Switch to calculator panel
      document.querySelectorAll('.prm-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.panel === 'prm-calculator'));
      document.querySelectorAll('.prm-panel').forEach(p => { p.hidden = p.id !== 'prm-calculator'; });
      document.getElementById('prm-category').value = item.category || 'washing-machine';
      const pCatEl2 = document.getElementById('prm-category');
      const pLifeEl2 = document.getElementById('prm-lifespan');
      const life = LIFESPANS[pCatEl2.value]; pLifeEl2.value = life !== null ? life : '';
      const age = ageFromDate(item.purchaseDate);
      if (age !== null) document.getElementById('prm-age').value = age;
      if (item.price) document.getElementById('prm-replace-cost').value = item.price;
      document.getElementById('prm-repair-cost').value = '';
      document.getElementById('prm-result').hidden = true;
      document.getElementById('prm-repair-cost').focus();
    });
  });
}

function renderAnalytics() {
  const items = appData.items || [];
  const statuses = items.map(i => warrantyStatus(i.purchaseDate, i.warrantyMonths));
  const active = statuses.filter(s => s && s.cls === 'active').length;
  const expiring = statuses.filter(s => s && s.cls === 'expiring').length;
  const expired = statuses.filter(s => s && s.cls === 'expired').length;
  const noWarranty = items.length - active - expiring - expired;

  // Donut
  const donutEl = document.getElementById('prm-donut');
  const legendEl = document.getElementById('prm-donut-legend');
  const donutData = [
    { label: 'Active', count: active, color: '#4ade80' },
    { label: 'Expiring', count: expiring, color: '#fbbf24' },
    { label: 'Expired', count: expired, color: '#f87171' },
    { label: 'No warranty', count: noWarranty, color: 'rgba(255,255,255,.15)' },
  ].filter(d => d.count > 0);
  const total = items.length || 1;
  let offset = 0;
  const r = 45, cx = 60, cy = 60, circumference = 2 * Math.PI * r;
  if (!donutData.length) {
    donutEl.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="16"/><text x="${cx}" y="${cy+5}" text-anchor="middle" fill="rgba(255,255,255,.3)" font-size="10" font-family="system-ui">No data</text>`;
  } else {
    donutEl.innerHTML = donutData.map(d => {
      const pct2 = d.count / total;
      const dash = pct2 * circumference;
      const gap = circumference - dash;
      const rotate = -90 + (offset * 360);
      offset += pct2;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color}" stroke-width="16" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="0" transform="rotate(${rotate} ${cx} ${cy})"/>`;
    }).join('') + `<text x="${cx}" y="${cy-4}" text-anchor="middle" fill="white" font-size="22" font-weight="700" font-family="system-ui">${items.length}</text><text x="${cx}" y="${cy+12}" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="9" font-family="system-ui">ITEMS</text>`;
  }
  legendEl.innerHTML = donutData.map(d => `<div class="prm-legend-item"><div class="prm-legend-dot" style="background:${d.color}"></div>${d.label} (${d.count})</div>`).join('');

  // Category bar chart
  const catCounts = {};
  items.forEach(i => { catCounts[i.category] = (catCounts[i.category] || 0) + 1; });
  const maxCat = Math.max(...Object.values(catCounts), 1);
  document.getElementById('prm-bar-cat').innerHTML = Object.entries(catCounts).sort((a,b) => b[1]-a[1]).map(([cat, n]) =>
    `<div class="prm-bar-row"><span class="prm-bar-label">${CATEGORY_LABELS[cat] || cat}</span><div class="prm-bar-track"><div class="prm-bar-fill" style="width:${Math.round(n/maxCat*100)}%"></div></div><span class="prm-bar-count">${n}</span></div>`
  ).join('') || '<p class="prm-muted">No data yet.</p>';

  // Value bar chart
  const catVals = {};
  items.forEach(i => { if (i.price) catVals[i.category] = (catVals[i.category] || 0) + (parseFloat(i.price) || 0); });
  const maxVal = Math.max(...Object.values(catVals), 1);
  document.getElementById('prm-bar-val').innerHTML = Object.entries(catVals).sort((a,b) => b[1]-a[1]).map(([cat, v]) =>
    `<div class="prm-bar-row"><span class="prm-bar-label">${CATEGORY_LABELS[cat] || cat}</span><div class="prm-bar-track"><div class="prm-bar-fill" style="width:${Math.round(v/maxVal*100)}%;background:linear-gradient(90deg,#a78bfa,#c084fc)"></div></div><span class="prm-bar-count">£${v}</span></div>`
  ).join('') || '<p class="prm-muted">Add purchase prices to see value breakdown.</p>';
}

function signOut() {
  setSession(null);
  showView('view-free');
  renderFreeTracker();
}

/* ── Export / Import ── */
function exportData() {
  const json = JSON.stringify(appData, null, 2);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  a.download = `repair-pro-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function importData(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      if (!parsed || !Array.isArray(parsed.items)) throw new Error();
      if (!confirm(`Import ${parsed.items.length} item(s)? This replaces your current data.`)) return;
      appData = parsed; saveData(appData); refreshPremium();
    } catch { alert('Import failed — not a valid backup file.'); }
  };
  reader.readAsText(file); e.target.value = '';
}

/* ════════════════════════════════════════
   INIT
════════════════════════════════════════ */
renderFreeTracker();
if (isLoggedIn()) { showView('view-premium'); initPremium(); }
else showView('view-free');
