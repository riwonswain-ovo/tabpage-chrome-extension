'use strict';

// ─── Bookmarks renderer ─────────────────────────────────────────────

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
function host(url) { try { return new URL(url).hostname; } catch { return ''; } }

const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`;
const ICON_DRAG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width:12px;height:12px;opacity:0.3;flex-shrink:0;cursor:grab;"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`;

async function renderBookmarks(filterText) {
  const grid = document.getElementById('bookmarkGrid');
  const { categories } = await getBookmarks();
  let cats = categories;

  if (filterText) {
    const q = filterText.toLowerCase();
    cats = cats.map(c => ({
      ...c,
      items: c.items.filter(i =>
        i.name.toLowerCase().includes(q) || i.url.toLowerCase().includes(q))
    })).filter(c => c.items.length > 0);
  }

  if (cats.length === 0) {
    grid.innerHTML = filterText
      ? '<div class="empty-card"><p>没有匹配的书签。</p></div>'
      : '<div class="empty-card"><p>还没有分类。</p><span data-action="add-category-empty">创建第一个分类</span></div>';
  } else {
    grid.innerHTML = cats.map(c => `
      <div class="card drag-card" draggable="true" data-drag-type="category" data-cat-id="${c.id}">
        <div class="card-top">
          <span class="drag-handle" title="拖拽排序">${ICON_DRAG}</span>
          <span class="card-name">${esc(c.name)}</span>
          <span class="card-badge neutral">${c.items.length} 个书签</span>
        </div>
        <div class="chip-list" data-cat-id="${c.id}">
          ${c.items.map(i => `
            <div class="chip drag-chip" draggable="true" data-drag-type="bookmark" data-bm-id="${i.id}" data-cat-id="${c.id}" data-url="${esc(i.url)}" data-name="${esc(i.name)}" data-action="click-bm" title="${esc(i.url)}">
              <span class="drag-handle chip-drag" title="拖拽排序">${ICON_DRAG}</span>
              <img class="chip-fav" src="https://www.google.com/s2/favicons?domain=${host(i.url)}&sz=16" loading="lazy">
              <span class="chip-text">${esc(i.name)}</span>
              <div class="chip-actions">
                <button class="chip-act close" data-action="delete-bm" data-cat="${c.id}" data-bm="${i.id}" title="Remove">${ICON_CLOSE}</button>
              </div>
            </div>
          `).join('')}
          <div class="chip add-new" data-action="add-bm" data-cat="${c.id}">+ 添加书签</div>
        </div>
        <div class="actions">
          <button class="chip-act close" data-action="delete-cat" data-cat="${c.id}" style="opacity:0.5;font-size:11px;margin-left:auto;" title="删除分类">${ICON_CLOSE} 删除</button>
        </div>
      </div>
    `).join('');
  }

  const total = categories.reduce((s, c) => s + c.items.length, 0);
  document.getElementById('bmCount').textContent =
    `${categories.length} 个分类 · ${total} 个书签`;
}

// ─── Bookmark actions ───────────────────────────────────────────────

async function clickBookmark(el) {
  const url = el.dataset.url;
  const name = el.dataset.name;
  if (!url) return;

  try {
    // Check if domain already open
    const targetHost = host(url);
    const tabs = await chrome.tabs.query({});
    const currentWindow = await chrome.windows.getCurrent();

    // Find matching tabs by hostname
    const matches = tabs.filter(t => {
      try { return new URL(t.url).hostname === targetHost; }
      catch { return false; }
    });

    if (matches.length > 0) {
      // Prefer a match in a different window
      const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
      await chrome.tabs.update(match.id, { active: true });
      await chrome.windows.update(match.windowId, { focused: true });
      showToast(`已切换到已有标签 — ${name}`);
    } else {
      await chrome.tabs.create({ url });
      showToast(`已打开 ${name}`);
    }
  } catch {
    // Fallback: just open new tab
    window.open(url, '_blank');
    showToast(`Opened ${name}`);
  }
}

async function addBookmarkAction(catId) {
  showAddBookmark(catId);
}

async function deleteBookmarkAction(catId, bmId) {
  await deleteBookmark(catId, bmId);
  await renderBookmarks(getSearchValue());
  showToast('书签已删除');
}

async function deleteCategoryAction(catId) {
  await deleteCategory(catId);
  await renderBookmarks(getSearchValue());
  showToast('分类已删除');
}

async function addCategoryAction(name) {
  if (!name || !name.trim()) return;
  await addCategory(name.trim());
  await renderBookmarks(getSearchValue());
  showToast('分类已创建');
}

async function saveBookmarkAction(catId, name, url) {
  if (!name || !name.trim() || !url || !url.trim()) return;
  let finalUrl = url.trim();
  if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
  await addBookmark(catId, name.trim(), finalUrl);
  await renderBookmarks(getSearchValue());
  showToast('书签已添加');
}

function getSearchValue() {
  const s = document.getElementById('searchInput');
  return s ? s.value : '';
}

// ─── Drag-and-drop ──────────────────────────────────────────────────

let dragState = { type: null, catId: null, bmId: null, el: null };

function initDragAndDrop() {
  const grid = document.getElementById('bookmarkGrid');
  if (!grid) return;

  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.drag-card');
    const chip = e.target.closest('.drag-chip');

    if (card && !e.target.closest('.chip-actions') && !e.target.closest('button')) {
      // Dragging a category card
      dragState = { type: 'category', catId: card.dataset.catId, bmId: null, el: card };
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', card.dataset.catId);
    } else if (chip && !e.target.closest('.chip-actions') && !e.target.closest('button')) {
      // Dragging a bookmark chip
      dragState = { type: 'bookmark', catId: chip.dataset.catId, bmId: chip.dataset.bmId, el: chip };
      chip.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chip.dataset.bmId);
    } else {
      e.preventDefault();
    }
  });

  grid.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!dragState.el) return;
    e.dataTransfer.dropEffect = 'move';

    // Remove previous indicators
    grid.querySelectorAll('.drag-over, .drag-insert-above, .drag-insert-below').forEach(el => {
      el.classList.remove('drag-over', 'drag-insert-above', 'drag-insert-below');
    });

    if (dragState.type === 'category') {
      const card = e.target.closest('.drag-card');
      if (!card || card === dragState.el) return;
      const rect = card.getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        card.classList.add('drag-insert-above');
      } else {
        card.classList.add('drag-insert-below');
      }
    } else if (dragState.type === 'bookmark') {
      const chip = e.target.closest('.drag-chip');
      const chipList = e.target.closest('.chip-list');

      if (chip && chip !== dragState.el) {
        const rect = chip.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) {
          chip.classList.add('drag-insert-above');
        } else {
          chip.classList.add('drag-insert-below');
        }
      } else if (chipList) {
        chipList.closest('.drag-card')?.classList.add('drag-over');
      }
    }
  });

  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    grid.querySelectorAll('.drag-over, .drag-insert-above, .drag-insert-below, .dragging').forEach(el => {
      el.classList.remove('drag-over', 'drag-insert-above', 'drag-insert-below', 'dragging');
    });

    if (!dragState.el) return;

    if (dragState.type === 'category') {
      const card = e.target.closest('.drag-card');
      if (!card || card === dragState.el) { dragState = {}; return; }

      const { categories } = await getBookmarks();
      const fromIdx = categories.findIndex(c => c.id === dragState.catId);
      let toIdx = categories.findIndex(c => c.id === card.dataset.catId);
      if (fromIdx === -1 || toIdx === -1) { dragState = {}; return; }

      const rect = card.getBoundingClientRect();
      if (e.clientY > rect.top + rect.height / 2) toIdx++;

      const [moved] = categories.splice(fromIdx, 1);
      categories.splice(toIdx > fromIdx ? toIdx - 1 : toIdx, 0, moved);
      await reorderCategories(categories);
      await renderBookmarks(getSearchValue());
      showToast('分类已重新排序');
    } else if (dragState.type === 'bookmark') {
      const chip = e.target.closest('.drag-chip');
      const chipList = e.target.closest('.chip-list');
      const targetCatId = chip ? chip.dataset.catId : (chipList ? chipList.dataset.catId : null);
      if (!targetCatId) { dragState = {}; return; }

      const { categories } = await getBookmarks();
      const srcCat = categories.find(c => c.id === dragState.catId);
      const dstCat = categories.find(c => c.id === targetCatId);
      if (!srcCat || !dstCat) { dragState = {}; return; }

      const srcIdx = srcCat.items.findIndex(i => i.id === dragState.bmId);
      if (srcIdx === -1) { dragState = {}; return; }
      const [moved] = srcCat.items.splice(srcIdx, 1);

      if (chip && chip !== dragState.el) {
        let toIdx = dstCat.items.findIndex(i => i.id === chip.dataset.bmId);
        const rect = chip.getBoundingClientRect();
        if (e.clientY > rect.top + rect.height / 2) toIdx++;
        if (toIdx === -1) toIdx = dstCat.items.length;
        dstCat.items.splice(toIdx, 0, moved);
      } else {
        dstCat.items.push(moved);
      }

      await saveBookmarks({ categories });
      await renderBookmarks(getSearchValue());
      if (srcCat.id !== dstCat.id) {
        showToast(`书签已移动到「${esc(dstCat.name)}」`);
      } else {
        showToast('书签已重新排序');
      }
    }
    dragState = {};
  });

  grid.addEventListener('dragend', () => {
    grid.querySelectorAll('.drag-over, .drag-insert-above, .drag-insert-below, .dragging').forEach(el => {
      el.classList.remove('drag-over', 'drag-insert-above', 'drag-insert-below', 'dragging');
    });
    dragState = {};
  });
}
