'use strict';

// ─── Storage helpers ───────────────────────────────────────────────

const STORAGE_KEY = 'tabout_data';
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

async function loadData() {
  const [localResult, syncResult] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEY),
    chrome.storage.sync.get(STORAGE_KEY)
  ]);

  const localData = localResult[STORAGE_KEY];
  const syncData = syncResult[STORAGE_KEY];

  // Local is the primary source (fast, always current)
  if (localData) {
    const data = normalize(localData);
    // Keep sync copy up to date (best-effort, may fail on quota)
    if (!syncData || JSON.stringify(localData) !== JSON.stringify(syncData)) {
      chrome.storage.sync.set({ [STORAGE_KEY]: data }).catch(() => {});
    }
    return data;
  }

  // Local empty — reinstall scenario, restore from sync (Google account)
  if (syncData) {
    const data = normalize(syncData);
    // Restore local cache
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
    return data;
  }

  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

async function saveData(updateFn) {
  const data = await loadData();
  updateFn(data);
  // Write to both: local for speed, sync for cross-device + reinstall survival
  await Promise.all([
    chrome.storage.local.set({ [STORAGE_KEY]: data }),
    chrome.storage.sync.set({ [STORAGE_KEY]: data }).catch(() => {
      // Sync may fail if quota exceeded (>100KB). Local still works.
    })
  ]);
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
