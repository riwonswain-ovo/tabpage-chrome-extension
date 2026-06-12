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

// ─── Event listeners ─────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => updateBadge());
chrome.runtime.onStartup.addListener(() => updateBadge());
chrome.tabs.onCreated.addListener(() => updateBadge());
chrome.tabs.onRemoved.addListener(() => updateBadge());
chrome.tabs.onUpdated.addListener(() => updateBadge());

updateBadge();
