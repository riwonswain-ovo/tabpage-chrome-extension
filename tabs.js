'use strict';

// ─── Tab dashboard renderer ─────────────────────────────────────────

var TABS_ICONS = {
  tabs: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18"/></svg>`,
  close: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>`,
  plus: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/></svg>`,
  bookmark: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"/></svg>`,
};

const LANDING_PATTERNS = [
  { hostname: 'mail.google.com', test: (p) => !p.includes('#inbox/') && !p.includes('#sent/') && !p.includes('#search/') },
  { hostname: 'x.com', pathExact: ['/home'] },
  { hostname: 'www.linkedin.com', pathExact: ['/'] },
  { hostname: 'github.com', pathExact: ['/'] },
  { hostname: 'www.youtube.com', pathExact: ['/'] },
];

const FRIENDLY = {
  'github.com': 'GitHub', 'www.github.com': 'GitHub',
  'youtube.com': 'YouTube', 'www.youtube.com': 'YouTube',
  'twitter.com': 'X', 'x.com': 'X', 'www.x.com': 'X',
  'reddit.com': 'Reddit', 'www.reddit.com': 'Reddit',
  'linkedin.com': 'LinkedIn', 'www.linkedin.com': 'LinkedIn',
  'mail.google.com': 'Gmail', 'chat.openai.com': 'ChatGPT',
  'claude.ai': 'Claude', 'gemini.google.com': 'Gemini',
  'notion.so': 'Notion', 'www.notion.so': 'Notion',
  'figma.com': 'Figma', 'www.figma.com': 'Figma',
  'vercel.com': 'Vercel', 'www.vercel.com': 'Vercel',
  'deepseek.com': 'DeepSeek',
  'xiaohongshu.com': '小红书', 'www.xiaohongshu.com': '小红书',
  'bilibili.com': 'Bilibili', 'www.bilibili.com': 'Bilibili',
  'sdu.edu.cn': '山东大学', 'www.sdu.edu.cn': '山东大学',
  'cnki.net': '中国知网',
  'supabase.com': 'Supabase',
  'doubao.com': '豆包',
};

// Extract base domain: chat.deepseek.com → deepseek.com
function baseDomain(hostname) {
  if (!hostname || hostname === 'localhost' || hostname.startsWith('localhost:')) return hostname;
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  // For known longer patterns (e.g., .co.uk, .com.cn), keep last 3
  const tld2 = parts[parts.length - 2] + '.' + parts[parts.length - 1];
  if (['co.uk','com.cn','com.br','co.jp','co.kr','com.au','net.cn','org.cn'].includes(tld2) && parts.length > 3) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

function friendlyDomain(hostname) {
  // Try exact match first, then base domain
  if (FRIENDLY[hostname]) return FRIENDLY[hostname];
  const base = baseDomain(hostname);
  if (FRIENDLY[base]) return FRIENDLY[base];
  // Clean: remove www, remove TLD
  return hostname.replace(/^www\./, '').replace(/\.(com|org|net|io|co|ai|dev|app)(\.[a-z]{2})?$/, '');
}

function stripTitleNoise(title) {
  if (!title) return '';
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  return title.trim();
}

function isLandingPage(url) {
  try {
    const p = new URL(url);
    return LANDING_PATTERNS.some(r => {
      if (p.hostname !== r.hostname) return false;
      if (r.test) return r.test(p.pathname, url);
      if (r.pathExact) return r.pathExact.includes(p.pathname);
      return p.pathname === '/';
    });
  } catch { return false; }
}

// ─── Main render ────────────────────────────────────────────────────

async function renderTabs() {
  const grid = document.getElementById('tabsGrid');
  if (!grid) return;

  let openTabs = [];
  try {
    const extId = chrome.runtime.id;
    const newtabUrl = `chrome-extension://${extId}/index.html`;
    const tabs = await chrome.tabs.query({});
    openTabs = tabs.filter(t => {
      const u = t.url || '';
      return !u.startsWith('chrome://') && !u.startsWith('chrome-extension://')
        && !u.startsWith('about:') && !u.startsWith('edge://') && !u.startsWith('brave://');
    }).map(t => ({
      id: t.id, url: t.url, title: t.title,
      windowId: t.windowId, active: t.active,
      isNewtab: t.url === newtabUrl,
    }));
  } catch {
    grid.innerHTML = '<div class="empty-card"><p>无法获取标签页。</p></div>';
    return;
  }

  // Separate landing pages
  const landing = [];
  const groupMap = {};

  for (const tab of openTabs) {
    if (isLandingPage(tab.url)) {
      landing.push(tab);
      continue;
    }
    try {
      const hostname = new URL(tab.url).hostname;
      const base = hostname.startsWith('localhost') ? hostname : baseDomain(hostname);
      const label = friendlyDomain(hostname);
      if (!groupMap[base]) groupMap[base] = { base, label, tabs: [], domains: new Set() };
      groupMap[base].tabs.push(tab);
      groupMap[base].domains.add(hostname);
    } catch { /* skip */ }
  }

  let domainGroups = Object.values(groupMap);

  // Detect duplicates within each group
  domainGroups.forEach(g => {
    const cnt = {};
    g.tabs.forEach(t => cnt[t.url] = (cnt[t.url] || 0) + 1);
    g.dupes = Object.entries(cnt).filter(([, c]) => c > 1);
    g.extra = g.dupes.reduce((s, [, c]) => s + c - 1, 0);
  });

  // Sort by tab count
  domainGroups.sort((a, b) => b.tabs.length - a.tabs.length);

  let html = '';

  // Duplicate TabPage tabs banner
  const tabOutDupes = openTabs.filter(t => t.isNewtab);
  if (tabOutDupes.length > 1) {
    html += `<div class="tab-cleanup-banner">
      <div class="text">你有 <strong>${tabOutDupes.length}</strong> 个 TabPage 标签页打开，只保留这一个？</div>
      <button data-action="close-tabout-dupes">关闭多余的</button>
    </div>`;
  }

  // Homepages card
  if (landing.length > 0) {
    html += buildDomainCard('首页', landing, '__landing__');
  }

  // Domain cards
  domainGroups.forEach(g => {
    const displayName = g.domains.size > 1
      ? `${g.label}（${[...g.domains].map(d => d.split('.')[0]).join('、')}）`
      : g.label;
    html += buildDomainCard(g.label, g.tabs, g.base, g);
  });

  grid.innerHTML = html;

  const totalTabs = openTabs.length;
  const totalDomains = domainGroups.length + (landing.length > 0 ? 1 : 0);
  document.getElementById('tabsDomainCount').innerHTML =
    `${totalDomains} 个分组 &nbsp;&middot;&nbsp; <button class="act-btn close-group" data-action="close-all-tabs" style="font-size:11px;padding:3px 10px;">${TABS_ICONS.close} 关闭全部 ${totalTabs} 个标签</button>`;

  document.getElementById('footerCount').textContent = totalTabs;
}

function buildDomainCard(name, tabs, domainKey, group) {
  const shown = tabs.slice(0, 8);
  const more = tabs.length - shown.length;

  const dupes = group ? group.dupes : [];
  const extra = group ? group.extra : 0;

  return `<div class="card" data-domain="${domainKey}">
    <div class="card-top">
      <span class="card-name">${esc(name)}</span>
      <span class="card-badge">${TABS_ICONS.tabs} ${tabs.length} 个标签</span>
      ${extra > 0 ? `<span class="card-badge">${extra} 个重复</span>` : ''}
    </div>
    <div class="chip-list">
      ${shown.map(t => {
        const cnt = dupes.find(([u]) => u === t.url);
        return `<div class="chip" data-action="focus-tab" data-url="${esc(t.url)}" title="${esc(t.url)}">
          <img class="chip-fav" src="https://www.google.com/s2/favicons?domain=${host(t.url)}&sz=16" loading="lazy">
          <span class="chip-text">${domainKey.startsWith('localhost:') ? domainKey.split(':')[1] + ' ' : ''}${esc(stripTitleNoise(t.title || t.url))}</span>
          ${cnt && cnt[1] > 1 ? `<span class="chip-dupe">(${cnt[1]}x)</span>` : ''}
          <div class="chip-actions">
            <button class="chip-act save" data-action="save-for-later" data-url="${esc(t.url)}" data-title="${esc(stripTitleNoise(t.title || t.url))}" title="保存待读">${TABS_ICONS.bookmark}</button>
            <button class="chip-act bkm-add" data-action="add-to-bookmarks" data-url="${esc(t.url)}" data-title="${esc(stripTitleNoise(t.title || t.url))}" title="添加到收藏">${TABS_ICONS.plus}</button>
            <button class="chip-act close" data-action="close-single-tab" data-url="${esc(t.url)}" title="关闭">${TABS_ICONS.close}</button>
          </div>
        </div>`;
      }).join('')}
      ${more > 0 ? `<div class="chip" style="font-size:12px;color:var(--muted);cursor:default;">+${more} 个标签</div>` : ''}
    </div>
    <div class="actions">
      <button class="act-btn close-group" data-action="close-domain" data-domain="${domainKey}">${TABS_ICONS.close} 关闭 ${tabs.length} 个标签</button>
      ${extra > 0 ? `<button class="act-btn" data-action="dedup" data-domain="${domainKey}">关闭 ${extra} 个重复</button>` : ''}
    </div>
  </div>`;
}

function host(url) { try { return new URL(url).hostname; } catch { return ''; } }

// ─── Tab actions ────────────────────────────────────────────────────

async function closeSingleTab(url) {
  const tabs = await chrome.tabs.query({});
  const match = tabs.find(t => t.url === url);
  if (match) await chrome.tabs.remove(match.id);
  playCloseSound();
  shootConfettiFromCard(url);
  await renderTabs();
  setTabUndoAction(
    () => restoreLastClosedTab(),
    '标签已恢复'
  );
  showToast('标签已关闭', true);
}

async function closeDomainTabs(key) {
  let tabs = await chrome.tabs.query({});
  if (key === '__landing__') {
    tabs = tabs.filter(t => isLandingPage(t.url));
  } else {
    tabs = tabs.filter(t => {
      try { return baseDomain(new URL(t.url).hostname) === key; } catch { return false; }
    });
  }
  const count = tabs.length;
  await chrome.tabs.remove(tabs.map(t => t.id));
  playCloseSound();
  shootConfetti();
  await renderTabs();
  setTabUndoAction(
    () => restoreLastClosedTab(),
    '标签已恢复'
  );
  showToast(`已关闭 ${count} 个标签`, true);
}

async function closeAllTabs() {
  const tabs = await chrome.tabs.query({});
  const toClose = tabs.filter(t => {
    const u = t.url || '';
    return !u.startsWith('chrome://') && !u.startsWith('chrome-extension://') && !u.startsWith('about:');
  });
  await chrome.tabs.remove(toClose.map(t => t.id));
  playCloseSound();
  shootConfetti();
  await renderTabs();
  showToast('全部标签已关闭，新开始。');
}

async function dedupTabs(key) {
  const tabs = await chrome.tabs.query({});
  const matching = tabs.filter(t => {
    try { return baseDomain(new URL(t.url).hostname) === key; } catch { return false; }
  });
  const seen = new Map();
  const toClose = [];
  for (const t of matching) {
    if (seen.has(t.url)) { toClose.push(t.id); }
    else { seen.set(t.url, t.id); }
  }
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await renderTabs();
  showToast(`已关闭 ${toClose.length} 个重复标签`);
}

async function closeTabOutDupesAction() {
  const extId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extId}/index.html`;
  const tabs = await chrome.tabs.query({});
  const dupeTabs = tabs.filter(t => t.url === newtabUrl);
  if (dupeTabs.length <= 1) return;
  const keep = dupeTabs.find(t => t.active) || dupeTabs[0];
  const toClose = dupeTabs.filter(t => t.id !== keep.id).map(t => t.id);
  await chrome.tabs.remove(toClose);
  showToast('已关闭多余的 TabPage 标签');
}

// ─── Sound + Confetti ───────────────────────────────────────────────

function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 2.0;
    const t = ctx.currentTime;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t);
    setTimeout(() => ctx.close(), 500);
  } catch { /* audio not supported */ }
}

function shootConfetti() {
  const x = window.innerWidth / 2;
  const y = window.innerHeight / 2;
  doConfetti(x, y, 17);
}

function shootConfettiFromCard(url) {
  const chip = document.querySelector(`.chip[data-url="${esc(url)}"]`);
  if (chip) {
    const rect = chip.getBoundingClientRect();
    doConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 12);
  }
}

function doConfetti(x, y, count) {
  const colors = ['#c8713a','#e8a070','#5a7a62','#8aaa92','#5a6b7a','#d4b896','#b35a5a'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    const size = 4 + Math.random() * 6;
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>0.5?'50%':'2px'};pointer-events:none;z-index:9999;`;
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 100;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 70;
    const gravity = 180;
    const start = performance.now();
    const dur = 600 + Math.random() * 200;
    (function frame(now) {
      const e = (now - start) / 1000;
      if (e >= dur / 1000) { el.remove(); return; }
      el.style.transform = `translate(calc(-50% + ${vx*e}px), calc(-50% + ${vy*e + 0.5*gravity*e*e}px))`;
      el.style.opacity = e < 0.5 ? 1 : 1 - (e - 0.5) * 2;
      requestAnimationFrame(frame);
    })(start);
  }
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }

// ─── Auto-refresh on tab changes ────────────────────────────────────

let _tabsRenderTimer;
function scheduleTabsRender() {
  clearTimeout(_tabsRenderTimer);
  _tabsRenderTimer = setTimeout(renderTabs, 300);
}

// Listen for tab events to auto-refresh the tabs view
if (chrome && chrome.tabs) {
  chrome.tabs.onCreated.addListener(() => scheduleTabsRender());
  chrome.tabs.onRemoved.addListener(() => scheduleTabsRender());
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') scheduleTabsRender();
  });
}

// ─── Restore last closed tab ────────────────────────────────────────

async function restoreLastClosedTab() {
  // Try direct restore first
  try {
    return await chrome.sessions.restore();
  } catch (_) {
    // Fallback: find by recently closed list
  }
  const sessions = await chrome.sessions.getRecentlyClosed();
  if (!sessions || sessions.length === 0) {
    throw new Error('No recently closed tabs');
  }
  const session = sessions[0];
  if (session.tab) {
    return chrome.sessions.restore(session.tab.sessionId);
  }
  // Could be a window session
  if (session.window) {
    return chrome.sessions.restore(session.window.sessionId);
  }
  throw new Error('No restorable session');
}

// ─── Focus tab ──────────────────────────────────────────────────────

async function focusTab(url) {
  if (!url) return;
  const tabs = await chrome.tabs.query({});
  const match = tabs.find(t => t.url === url)
    || tabs.find(t => { try { return new URL(t.url).hostname === host(url); } catch { return false; } });
  if (match) {
    await chrome.tabs.update(match.id, { active: true });
    await chrome.windows.update(match.windowId, { focused: true });
  }
}
