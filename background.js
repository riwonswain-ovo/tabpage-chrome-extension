'use strict';

// ─── Badge updater ──────────────────────────────────────────────────

async function updateBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.filter(t => {
      const url = t.url || '';
      return (
        !url.startsWith('chrome://') &&
        !url.startsWith('chrome-extension://') &&
        !url.startsWith('about:') &&
        !url.startsWith('edge://') &&
        !url.startsWith('brave://')
      );
    }).length;

    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });

    if (count === 0) return;

    let color;
    if (count <= 10)      color = '#3d7a4a'; // green
    else if (count <= 20) color = '#b8892e'; // amber
    else                  color = '#b35a5a'; // rose

    await chrome.action.setBadgeBackgroundColor({ color });
  } catch {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ─── Star bookmark interception ──────────────────────────────────────

let _lastStarTime = 0;

chrome.bookmarks.onCreated.addListener(async (id, bookmark) => {
  // Skip folders and bookmark bar items
  if (!bookmark.url) return;

  // 500ms debounce
  const now = Date.now();
  if (now - _lastStarTime < 500) return;
  _lastStarTime = now;

  try {
    // Store pending star info for the new tab page to pick up
    const pending = { url: bookmark.url, title: bookmark.title, time: now };
    await chrome.storage.local.set({ _pendingStar: pending });

    // Delete the native bookmark
    await chrome.bookmarks.remove(id);

    // Open the extension page so the user sees the categorization panel immediately
    const extUrl = `chrome-extension://${chrome.runtime.id}/index.html`;
    const existing = await chrome.tabs.query({ url: extUrl });
    if (existing && existing.length > 0) {
      // Focus existing extension tab
      await chrome.tabs.update(existing[0].id, { active: true });
      await chrome.windows.update(existing[0].windowId, { focused: true });
    } else {
      // Create a new extension tab
      await chrome.tabs.create({ url: extUrl });
    }
  } catch {
    // Silent fail — the native bookmark stays, star panel won't show
  }
});

// ─── Event listeners ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => updateBadge());
chrome.runtime.onStartup.addListener(() => updateBadge());
chrome.tabs.onCreated.addListener(() => updateBadge());
chrome.tabs.onRemoved.addListener(() => updateBadge());
chrome.tabs.onUpdated.addListener(() => updateBadge());

updateBadge();
