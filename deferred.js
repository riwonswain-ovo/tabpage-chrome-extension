'use strict';

// ─── Deferred checklist renderer ────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const m = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + ' min ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' hr' + (h !== 1 ? 's' : '') + ' ago';
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  return d + ' days ago';
}

async function renderDeferred() {
  const col = document.getElementById('deferredCol');
  const list = document.getElementById('deferredList');
  const empty = document.getElementById('deferredEmpty');
  const countEl = document.getElementById('deferredCount');
  const archWrap = document.getElementById('archiveWrap');
  const archList = document.getElementById('archiveList');
  const archCount = document.getElementById('archiveCount');

  const { active, archived } = await getDeferred();

  if (active.length === 0 && archived.length === 0) {
    col.style.display = 'none';
    return;
  }
  col.style.display = 'block';

  if (active.length > 0) {
    list.innerHTML = active.map(d => {
      const dom = (() => { try { return new URL(d.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      return `<div class="def-item" data-id="${d.id}">
        <input type="checkbox" class="def-cb" data-action="check-def" data-id="${d.id}">
        <div class="def-info">
          <a href="${esc(d.url)}" target="_blank" class="def-title" title="${esc(d.title)}">
            <img src="https://www.google.com/s2/favicons?domain=${dom}&sz=16" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" class="chip-fav">${esc(d.title)}
          </a>
          <div class="def-meta"><span>${dom}</span><span>${timeAgo(d.savedAt)}</span></div>
        </div>
        <button class="def-dismiss" data-action="dismiss-def" data-id="${d.id}" title="Dismiss">${TABS_ICONS.close}</button>
      </div>`;
    }).join('');
    list.style.display = 'block';
    empty.style.display = 'none';
    countEl.textContent = `${active.length} item${active.length !== 1 ? 's' : ''}`;
  } else {
    list.style.display = 'none';
    empty.style.display = 'block';
    countEl.textContent = '';
  }

  if (archived.length > 0) {
    archWrap.style.display = 'block';
    archCount.textContent = `(${archived.length})`;

    const archSearch = document.getElementById('archiveSearch');
    const q = archSearch ? archSearch.value.toLowerCase().trim() : '';

    const filtered = q
      ? archived.filter(d =>
          d.title.toLowerCase().includes(q) ||
          (() => { try { return new URL(d.url).hostname; } catch { return ''; } })().includes(q))
      : archived;

    archList.innerHTML = filtered.length > 0
      ? filtered.map(d => `<div class="archive-item">
          <a href="${esc(d.url)}" target="_blank">${esc(d.title)}</a>
          <span class="when">${timeAgo(d.completedAt || d.savedAt)}</span>
        </div>`).join('')
      : '<div class="archive-item" style="color:var(--muted);">没有匹配的结果。</div>';
  } else {
    archWrap.style.display = 'none';
  }
}

// ─── Deferred actions ───────────────────────────────────────────────

async function deferredCheckAction(id) {
  await checkOffDeferred(id);
  await renderDeferred();
  showToast('已归档');
}

async function deferredDismissAction(id) {
  await dismissDeferred(id);
  await renderDeferred();
  showToast('已移除');
}

async function saveForLaterAction(url, title) {
  await saveForLater(url, title);
  await renderDeferred();
  showToast('已保存到待读清单');
}

// ─── Archive toggle ─────────────────────────────────────────────────

function toggleArchive() {
  const t = document.getElementById('archiveToggle');
  const b = document.getElementById('archiveBody');
  if (!t || !b) return;
  t.classList.toggle('open');
  b.style.display = b.style.display === 'none' ? 'block' : 'none';
}

// ─── Add-to-bookmarks from tabs ─────────────────────────────────────

let pendingTabUrl = '';
let pendingTabTitle = '';

async function showAddToBookmarks(url, title) {
  const { categories } = await getBookmarks();
  if (categories.length === 0) {
    showToast('请先在收藏视图创建至少一个分类', false);
    return;
  }

  pendingTabUrl = url;
  pendingTabTitle = title;

  document.getElementById('tabBmInfo').textContent = title;

  // Smart suggestion
  const suggestEl = document.getElementById('tabBmSuggest');
  const suggestion = suggestCategory(url, title, categories);
  if (suggestion) {
    suggestEl.textContent = `建议分类：${suggestion.catName}（基于已有类似书签）`;
    suggestEl.style.display = 'block';
  } else {
    suggestEl.style.display = 'none';
  }

  // Default category: suggestion first, then lastUsedCategory, then first category
  const prefs = await getPrefs();
  const defaultCatId = suggestion
    ? suggestion.catId
    : (prefs.lastUsedCategory && categories.some(c => c.id === prefs.lastUsedCategory)
      ? prefs.lastUsedCategory
      : (categories.length > 0 ? categories[0].id : null));

  document.getElementById('tabBmCat').innerHTML = categories.map(c =>
    `<option value="${c.id}"${defaultCatId && c.id === defaultCatId ? ' selected' : ''}>${esc(c.name)}</option>`
  ).join('');
  document.getElementById('modalTabBm').classList.add('show');
}

async function saveTabToBookmarkAction() {
  const catId = document.getElementById('tabBmCat').value;
  if (catId && pendingTabUrl) {
    await addBookmark(catId, pendingTabTitle, pendingTabUrl);
    await setPref('lastUsedCategory', catId);
    await renderBookmarks(getSearchValue ? getSearchValue() : '');
    showToast('已添加到分类', false);
  }
  document.getElementById('modalTabBm').classList.remove('show');
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

// Uses TABS_ICONS from tabs.js (loaded before this file)
