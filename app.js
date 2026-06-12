'use strict';

// ─── App controller ─────────────────────────────────────────────────

// Global favicon error handler (capture phase; replaces inline onerror to satisfy CSP)
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.classList.contains('chip-fav')) {
    e.target.style.display = 'none';
  }
}, true);

// ─── Bootstrap ──────────────────────────────────────────────────────

(async function init() {
  await updateHeader();

  // Restore last active view
  const { lastActiveView } = await getPrefs();
  switchView(lastActiveView || 'bookmarks', false);

  // Render initial views
  await renderBookmarks();
  await renderTabs();
  await renderDeferred();

  // Init drag-and-drop
  initDragAndDrop();

  // Check for pending star bookmark interception
  await checkPendingStar();
})();

// ─── View switching ─────────────────────────────────────────────────

function switchView(view, save = true) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tabBtn = document.querySelector(`[data-view="${view}"]`);
  if (tabBtn) tabBtn.classList.add('active');

  document.getElementById('view-bookmarks').style.display = view === 'bookmarks' ? 'block' : 'none';
  document.getElementById('view-tabs').style.display = view === 'tabs' ? 'block' : 'none';

  const search = document.getElementById('searchInput');
  if (view === 'bookmarks') {
    search.style.visibility = 'visible';
    search.placeholder = '搜索收藏...';
  } else {
    search.style.visibility = 'hidden';
  }

  if (save) setPref('lastActiveView', view);
}

// ─── Event delegation ───────────────────────────────────────────────

document.addEventListener('click', async (e) => {
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  // ── Tab bar ──
  if (action === 'switch-view') {
    switchView(actionEl.dataset.view);
    return;
  }

  // ── Bookmarks view ──
  if (action === 'add-bm') {
    showAddBookmark(actionEl.dataset.cat);
    return;
  }
  if (action === 'delete-bm') {
    await deleteBookmarkAction(actionEl.dataset.cat, actionEl.dataset.bm);
    return;
  }
  if (action === 'delete-cat') {
    await deleteCategoryAction(actionEl.dataset.cat);
    return;
  }
  if (action === 'click-bm') {
    await clickBookmark(actionEl);
    return;
  }
  if (action === 'add-category-empty') {
    showAddCategory();
    return;
  }
  if (action === 'rename-cat') {
    startRenameCategory(actionEl.dataset.catId);
    return;
  }

  // ── Tabs view ──
  if (action === 'focus-tab') {
    await focusTab(actionEl.dataset.url);
    return;
  }
  if (action === 'close-single-tab') {
    await closeSingleTab(actionEl.dataset.url);
    return;
  }
  if (action === 'close-domain') {
    await closeDomainTabs(actionEl.dataset.domain);
    return;
  }
  if (action === 'close-all-tabs') {
    await closeAllTabs();
    return;
  }
  if (action === 'dedup') {
    await dedupTabs(actionEl.dataset.domain);
    return;
  }
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupesAction();
    return;
  }

  // ── Deferred ──
  if (action === 'save-for-later') {
    await saveForLaterAction(actionEl.dataset.url, actionEl.dataset.title);
    return;
  }
  if (action === 'check-def') {
    await deferredCheckAction(actionEl.dataset.id);
    return;
  }
  if (action === 'dismiss-def') {
    await deferredDismissAction(actionEl.dataset.id);
    return;
  }

  // ── Cross-interaction ──
  if (action === 'add-to-bookmarks') {
    await showAddToBookmarks(actionEl.dataset.url, actionEl.dataset.title);
    return;
  }
});

// ── Tab bar clicks ──
document.querySelector('.tab-bar').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  switchView(tab.dataset.view);
});

// ── Archive toggle ──
document.getElementById('archiveToggle').addEventListener('click', toggleArchive);

// ── Greeting click to edit name ──
document.getElementById('greetingTxt').addEventListener('click', async () => {
  const { userName } = await getPrefs();
  const name = prompt('你的名字？', userName || '');
  if (name !== null) {
    await setUserName(name.trim());
  }
});

// ── Search ──
document.getElementById('searchInput').addEventListener('input', function () {
  renderBookmarks(this.value);
});

// ── Archive search ──
const archSearchEl = document.getElementById('archiveSearch');
if (archSearchEl) {
  archSearchEl.addEventListener('input', function () {
    renderDeferred();
  });
}

// ── Modal: Add bookmark ──
document.getElementById('btnNewCat').addEventListener('click', showAddCategory);
document.getElementById('btnCancelBm').addEventListener('click', closeModalBm);
document.getElementById('btnSaveBm').addEventListener('click', async () => {
  const name = document.getElementById('bmName').value;
  const url = document.getElementById('bmUrl').value;
  const catSelect = document.getElementById('bmCatSelect');
  const catId = catSelect.value;
  if (!catId) return;
  await saveBookmarkAction(catId, name, url);
  closeModalBm();
});

// ── Modal: Add category ──
document.getElementById('btnCancelCat').addEventListener('click', closeModalCat);
document.getElementById('btnSaveCat').addEventListener('click', async () => {
  const name = document.getElementById('catName').value;
  await addCategoryAction(name);
  closeModalCat();
});

// ── Modal: Add tab to bookmarks ──
document.getElementById('btnCancelTabBm').addEventListener('click', () => {
  document.getElementById('modalTabBm').classList.remove('show');
});
document.getElementById('btnSaveTabBm').addEventListener('click', saveTabToBookmarkAction);

// ── Toast undo button ──
document.getElementById('toastUndo').addEventListener('click', undoLastDelete);

// ── Footer restore tab button ──
document.getElementById('btnRestoreTab').addEventListener('click', async () => {
  try {
    await restoreLastClosedTab();
    showToast('标签已恢复', false);
  } catch {
    showToast('没有可恢复的标签', false);
  }
});

// ── Modal helpers ──
async function showAddBookmark(catId) {
  const { categories } = await getBookmarks();
  const catSelect = document.getElementById('bmCatSelect');
  const suggestEl = document.getElementById('bmSuggest');

  catSelect.innerHTML = categories.map(c =>
    `<option value="${c.id}">${esc(c.name)}</option>`
  ).join('');

  // Pre-select and show suggestion if catId was passed
  if (catId) {
    catSelect.value = catId;
    suggestEl.style.display = 'none';
  } else {
    // No pre-selected category — show first one, with suggestion hint if available
    suggestEl.style.display = 'none';
    if (categories.length > 0) {
      catSelect.value = categories[0].id;
    }
  }

  document.getElementById('modalBmTitle').textContent = '新建书签';
  document.getElementById('bmName').value = '';
  document.getElementById('bmUrl').value = '';
  document.getElementById('modalBm').classList.add('show');
  document.getElementById('bmName').focus();
}

function showAddCategory() {
  document.getElementById('catName').value = '';
  document.getElementById('modalCat').classList.add('show');
  document.getElementById('catName').focus();
}

function closeModalBm() { document.getElementById('modalBm').classList.remove('show'); }
function closeModalCat() { document.getElementById('modalCat').classList.remove('show'); }

// ─── Delete & tab undo management ───────────────────────────────────

let _lastDeleteSnapshot = null;
let _undoTimer = null;
let _tabUndoAction = null; // { action: fn, label: string }
let _tabUndoTimer = null;

async function saveDeleteSnapshot() {
  const { categories } = await getBookmarks();
  _lastDeleteSnapshot = JSON.parse(JSON.stringify(categories));
  // Clear old timer, set new 5s expiry
  clearTimeout(_undoTimer);
  _undoTimer = setTimeout(() => { _lastDeleteSnapshot = null; }, 5000);
}

async function undoLastDelete() {
  // Check for tab undo first
  if (_tabUndoAction) {
    try {
      await _tabUndoAction.action();
      showToast(_tabUndoAction.label || '标签已恢复', false);
    } catch {
      showToast('无法恢复标签', false);
    }
    _tabUndoAction = null;
    clearTimeout(_tabUndoTimer);
    return;
  }

  if (!_lastDeleteSnapshot) return;
  await saveBookmarks({ categories: _lastDeleteSnapshot });
  await renderBookmarks(getSearchValue ? getSearchValue() : '');
  _lastDeleteSnapshot = null;
  clearTimeout(_undoTimer);
  showToast('已恢复', false);
}

// Called from tabs.js to register a tab undo action
function setTabUndoAction(actionFn, label) {
  _tabUndoAction = { action: actionFn, label };
  clearTimeout(_tabUndoTimer);
  _tabUndoTimer = setTimeout(() => { _tabUndoAction = null; }, 5000);
}

// ─── Toast ──────────────────────────────────────────────────────────

let _toastTimer;
function showToast(msg, showUndo = false) {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;

  const undoBtn = document.getElementById('toastUndo');
  if (showUndo) {
    undoBtn.style.display = '';
  } else {
    undoBtn.style.display = 'none';
  }

  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ─── Star interception ──────────────────────────────────────────────

// Listen for star interception from background.js (real-time when new tab is open)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes._pendingStar && changes._pendingStar.newValue) {
    checkPendingStar();
  }
});

async function checkPendingStar() {
  const { _pendingStar } = await chrome.storage.local.get('_pendingStar');
  if (!_pendingStar) return;

  // Only show if the star was created within the last 30 seconds
  if (Date.now() - _pendingStar.time > 30000) {
    await chrome.storage.local.remove('_pendingStar');
    return;
  }

  await chrome.storage.local.remove('_pendingStar');
  showAddToBookmarks(_pendingStar.url, _pendingStar.title);
}

// ─── Category rename ────────────────────────────────────────────────

function startRenameCategory(catId) {
  const nameSpan = document.querySelector(`.card-name[data-cat-id="${catId}"]`);
  if (!nameSpan) return;
  const oldName = nameSpan.textContent;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cat-rename-input';
  input.value = oldName;
  input.style.cssText = 'font-weight:600;font-size:15px;color:var(--ink);border:1px solid var(--accent-amber);border-radius:4px;padding:2px 6px;width:160px;font-family:inherit;';

  nameSpan.replaceWith(input);
  input.focus();
  input.select();

  async function save() {
    const newName = input.value.trim();
    if (newName && newName !== oldName) {
      await renameCategory(catId, newName);
      await renderBookmarks(getSearchValue ? getSearchValue() : '');
      showToast('分类已重命名');
    } else if (!newName) {
      // Empty name — restore original, don't save
      await renderBookmarks(getSearchValue ? getSearchValue() : '');
    } else {
      // Same name — restore original display
      const span = document.createElement('span');
      span.className = 'card-name';
      span.dataset.catId = catId;
      span.textContent = oldName;
      input.replaceWith(span);
    }
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') {
      const span = document.createElement('span');
      span.className = 'card-name';
      span.dataset.catId = catId;
      span.textContent = oldName;
      input.replaceWith(span);
    }
  });
  input.addEventListener('blur', save);
}

// ─── Keyboard shortcuts ─────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); switchView('bookmarks'); }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); switchView('tabs'); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    switchView('bookmarks');
    document.getElementById('searchInput').focus();
  }
});
