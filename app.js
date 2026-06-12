'use strict';

// ─── App controller ─────────────────────────────────────────────────

const USER_NAME = 'Celia';

// Global favicon error handler (capture phase; replaces inline onerror to satisfy CSP)
document.addEventListener('error', function(e) {
  if (e.target.tagName === 'IMG' && e.target.classList.contains('chip-fav')) {
    e.target.style.display = 'none';
  }
}, true);

// ─── Bootstrap ──────────────────────────────────────────────────────

(async function init() {
  updateHeader(USER_NAME);

  // Restore last active view
  const { lastActiveView } = await getPrefs();
  switchView(lastActiveView || 'bookmarks', false);

  // Render initial views
  await renderBookmarks();
  await renderTabs();
  await renderDeferred();
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

// ── Search ──
document.getElementById('searchInput').addEventListener('input', function () {
  renderBookmarks(this.value);
});

// ── Modal: Add bookmark ──
document.getElementById('btnNewCat').addEventListener('click', showAddCategory);
document.getElementById('btnCancelBm').addEventListener('click', closeModalBm);
document.getElementById('btnSaveBm').addEventListener('click', async () => {
  const name = document.getElementById('bmName').value;
  const url = document.getElementById('bmUrl').value;
  const catId = document.getElementById('bmCatId').value;
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

// ── Modal helpers ──
function showAddBookmark(catId) {
  document.getElementById('modalBmTitle').textContent = '新建书签';
  document.getElementById('bmName').value = '';
  document.getElementById('bmUrl').value = '';
  document.getElementById('bmCatId').value = catId;
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

// ── Toast ──
let _toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === '1') { e.preventDefault(); switchView('bookmarks'); }
  if ((e.metaKey || e.ctrlKey) && e.key === '2') { e.preventDefault(); switchView('tabs'); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    switchView('bookmarks');
    document.getElementById('searchInput').focus();
  }
});
