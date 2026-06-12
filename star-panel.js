'use strict';

// ─── Star bookmark popup panel ───────────────────────────────────────

(async function () {
  const { _pendingStar } = await chrome.storage.local.get('_pendingStar');
  if (!_pendingStar) {
    document.body.innerHTML = '<p style="padding:20px;color:#888;">没有待添加的书签。</p>';
    return;
  }

  document.getElementById('info').textContent = _pendingStar.title || _pendingStar.url;

  const { categories } = await getBookmarks();
  if (categories.length === 0) {
    document.body.innerHTML = '<p style="padding:20px;color:#888;">请先在插件中创建至少一个分类。</p>';
    return;
  }

  // Default: lastUsedCategory, then first
  const prefs = await getPrefs();
  const defaultId = prefs.lastUsedCategory && categories.some(c => c.id === prefs.lastUsedCategory)
    ? prefs.lastUsedCategory
    : categories[0].id;

  const select = document.getElementById('catSelect');
  select.innerHTML = categories.map(c =>
    `<option value="${c.id}"${c.id === defaultId ? ' selected' : ''}>${esc(c.name)}</option>`
  ).join('');

  // Save
  document.getElementById('btnSave').addEventListener('click', async () => {
    const catId = select.value;
    if (!catId) return;
    await addBookmark(catId, _pendingStar.title, _pendingStar.url);
    await setPref('lastUsedCategory', catId);
    await chrome.storage.local.remove('_pendingStar');
    window.close();
  });

  // Cancel
  document.getElementById('btnCancel').addEventListener('click', async () => {
    await chrome.storage.local.remove('_pendingStar');
    window.close();
  });
})();

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
