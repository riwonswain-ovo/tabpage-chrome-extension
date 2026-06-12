'use strict';

// ─── Storage helpers ───────────────────────────────────────────────

const STORAGE_KEY = 'tabout_data';
const SYNC_CHUNK_COUNT_KEY = 'tabout_data_chunks';
const SYNC_CHUNK_PREFIX = 'tabout_c_';
const MAX_CHUNK = 7000; // bytes, under 8192 per-item limit

const DEFAULT_DATA = {
  version: 2,
  bookmarks: { categories: [] },
  deferred: [],
  preferences: { lastActiveView: 'bookmarks' }
};

function normalize(data) {
  const merged = { ...DEFAULT_DATA, ...data };
  merged.bookmarks = { categories: [], ...merged.bookmarks };
  merged.deferred = merged.deferred || [];
  merged.preferences = { lastActiveView: 'bookmarks', ...merged.preferences };
  return merged;
}

// ── Sync chunked read/write ─────────────────────────────────────────

async function readSyncChunked() {
  const { [SYNC_CHUNK_COUNT_KEY]: count } = await chrome.storage.sync.get(SYNC_CHUNK_COUNT_KEY);
  if (!count) return null;

  const keys = [];
  for (let i = 0; i < count; i++) keys.push(SYNC_CHUNK_PREFIX + i);
  const result = await chrome.storage.sync.get(keys);

  let json = '';
  for (let i = 0; i < count; i++) {
    const chunk = result[SYNC_CHUNK_PREFIX + i];
    if (!chunk) return null; // corrupted
    json += chunk;
  }
  try { return JSON.parse(json); } catch { return null; }
}

async function writeSyncChunked(data) {
  const json = JSON.stringify(data);
  const total = Math.ceil(json.length / MAX_CHUNK);

  // Get old chunk count for cleanup
  const { [SYNC_CHUNK_COUNT_KEY]: oldCount } = await chrome.storage.sync.get(SYNC_CHUNK_COUNT_KEY);
  const prev = oldCount || 0;

  // Write new chunks
  const setObj = { [SYNC_CHUNK_COUNT_KEY]: total };
  for (let i = 0; i < total; i++) {
    setObj[SYNC_CHUNK_PREFIX + i] = json.substring(i * MAX_CHUNK, (i + 1) * MAX_CHUNK);
  }
  await chrome.storage.sync.set(setObj);

  // Clean up excess old chunks (if data shrunk)
  if (total < prev) {
    const removeKeys = [];
    for (let i = total; i < prev; i++) removeKeys.push(SYNC_CHUNK_PREFIX + i);
    if (removeKeys.length > 0) await chrome.storage.sync.remove(removeKeys);
  }
}

// ── Main load / save ────────────────────────────────────────────────

let _lastSyncTime = 0;
const SYNC_COOLDOWN = 10000; // 10s between background syncs

async function loadData() {
  // 1. Local first (fast, always current)
  const { [STORAGE_KEY]: localData } = await chrome.storage.local.get(STORAGE_KEY);
  if (localData) {
    const data = normalize(localData);
    // Throttled background sync — don't slow down reads
    const now = Date.now();
    if (now - _lastSyncTime > SYNC_COOLDOWN) {
      _lastSyncTime = now;
      writeSyncChunked(data).catch(e => console.warn('[TabPage] bg sync:', e.message));
    }
    return data;
  }

  // 2. Local empty — reinstall. Try chunked sync first
  console.log('[TabPage] local empty, trying sync restore...');
  const chunked = await readSyncChunked();
  if (chunked) {
    console.log('[TabPage] restored from chunked sync, keys:', chunked.bookmarks?.categories?.length, 'categories');
    const data = normalize(chunked);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    return data;
  }

  // 3. Fallback: old single-key sync (migration from before chunking)
  const { [STORAGE_KEY]: syncData } = await chrome.storage.sync.get(STORAGE_KEY);
  if (syncData) {
    console.log('[TabPage] restored from legacy sync key');
    const data = normalize(syncData);
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    // Migrate to chunked format
    writeSyncChunked(data).catch(e => console.warn('[TabPage] migrate to chunked:', e.message));
    chrome.storage.sync.remove(STORAGE_KEY).catch(() => {});
    return data;
  }

  console.log('[TabPage] no data found, using defaults');
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

async function saveData(updateFn) {
  const data = await loadData();
  updateFn(data);

  // Local: full data under single key
  await chrome.storage.local.set({ [STORAGE_KEY]: data });

  // Sync: chunked — await to catch errors, but don't block on failure
  try {
    await writeSyncChunked(data);
    console.log('[TabPage] synced to cloud,', JSON.stringify(data).length, 'bytes');
  } catch (e) {
    console.warn('[TabPage] sync write failed:', e.message, '(local data safe)');
  }

  return data;
}

// ─── Bookmarks ──────────────────────────────────────────────────────

async function getBookmarks() {
  const data = await loadData();
  return data.bookmarks;
}

async function saveBookmarks(bookmarks) {
  await saveData(d => { d.bookmarks = bookmarks; });
}

async function addCategory(name) {
  return saveData(d => {
    d.bookmarks.categories.push({
      id: crypto.randomUUID(),
      name,
      order: d.bookmarks.categories.length,
      items: []
    });
  });
}

async function deleteCategory(id) {
  return saveData(d => {
    d.bookmarks.categories = d.bookmarks.categories.filter(c => c.id !== id);
  });
}

async function addBookmark(catId, name, url) {
  return saveData(d => {
    const cat = d.bookmarks.categories.find(c => c.id === catId);
    if (cat) {
      cat.items.push({
        id: crypto.randomUUID(),
        name, url,
        order: cat.items.length,
        addedAt: new Date().toISOString()
      });
    }
  });
}

async function deleteBookmark(catId, bmId) {
  return saveData(d => {
    const cat = d.bookmarks.categories.find(c => c.id === catId);
    if (cat) cat.items = cat.items.filter(i => i.id !== bmId);
  });
}

async function renameCategory(catId, newName) {
  return saveData(d => {
    const cat = d.bookmarks.categories.find(c => c.id === catId);
    if (cat) cat.name = newName;
  });
}

async function reorderCategories(categories) {
  return saveBookmarks({ categories: categories.map((c, i) => ({ ...c, order: i })) });
}

async function reorderBookmarks(catId, items) {
  return saveData(d => {
    const cat = d.bookmarks.categories.find(c => c.id === catId);
    if (cat) cat.items = items.map((it, i) => ({ ...it, order: i }));
  });
}

// ─── Deferred ───────────────────────────────────────────────────────

async function getDeferred() {
  const data = await loadData();
  return {
    active: data.deferred.filter(d => !d.completed && !d.dismissed),
    archived: data.deferred.filter(d => d.completed && !d.dismissed),
  };
}

async function saveForLater(url, title) {
  return saveData(d => {
    d.deferred.unshift({
      id: Date.now().toString(),
      url, title,
      savedAt: new Date().toISOString(),
      completed: false,
      dismissed: false,
    });
  });
}

async function checkOffDeferred(id) {
  return saveData(d => {
    const item = d.deferred.find(t => t.id === id);
    if (item) { item.completed = true; item.completedAt = new Date().toISOString(); }
  });
}

async function dismissDeferred(id) {
  return saveData(d => {
    const item = d.deferred.find(t => t.id === id);
    if (item) item.dismissed = true;
  });
}

// ─── Preferences ────────────────────────────────────────────────────

async function getPrefs() {
  const data = await loadData();
  return data.preferences;
}

async function setPref(key, value) {
  return saveData(d => { d.preferences[key] = value; });
}
