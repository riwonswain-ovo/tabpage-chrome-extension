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
    // Store pending star info for the popup panel
    const pending = { url: bookmark.url, title: bookmark.title, time: now };
    await chrome.storage.local.set({ _pendingStar: pending });

    // Open a small popup panel on top of the current page
    // Note: the native bookmark stays in Chrome's bookmark bar
    await chrome.windows.create({
      url: `chrome-extension://${chrome.runtime.id}/star-panel.html`,
      type: 'popup',
      width: 380,
      height: 280
    });
  } catch {
    // Silent fail
  }
});

// ─── Event listeners ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => updateBadge());
chrome.runtime.onStartup.addListener(() => updateBadge());
chrome.tabs.onCreated.addListener(() => updateBadge());
chrome.tabs.onRemoved.addListener(() => updateBadge());
chrome.tabs.onUpdated.addListener(() => updateBadge());

updateBadge();
