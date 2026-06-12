'use strict';

// ─── Greeting system ────────────────────────────────────────────────

const GREETING_POOLS = {
  morning: [
    '新的一天，从哪个分类开始？',
    '早上好，整理一下标签开始工作吧。',
    '清晨的阳光和干净的书签一样治愈。',
    '今天有什么想读的？',
  ],
  afternoon: [
    '午后时光，专注最重要的事。',
    '趁精神好，关掉不需要的标签。',
    '下午好，别忘了看看待读清单。',
    '来杯茶，整理一下打开的标签。',
  ],
  evening: [
    '收尾时间，该清理标签了。',
    '保存值得再看的，关掉其余的。',
    '好的结束是明天好的开始。',
    '夜深了，还有什么没读完的？',
  ],
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return '早上好';
  if (hour < 17) return '下午好';
  return '晚上好';
}

function getRandomSubtitle(hour) {
  const pool = hour < 12 ? GREETING_POOLS.morning
    : hour < 17 ? GREETING_POOLS.afternoon
    : GREETING_POOLS.evening;
  return pool[Math.floor(Math.random() * pool.length)];
}

function getDateDisplay() {
  return new Date().toLocaleDateString('zh-CN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function updateHeader() {
  const { userName } = await getPrefs();
  const hour = new Date().getHours();
  const name = userName || '';
  const el = document.getElementById('greetingTxt');

  if (name) {
    el.innerHTML = `${getGreeting()}，<span class="greeting-name">${escHtml(name)}</span>。`;
  } else {
    el.innerHTML = `${getGreeting()}。<br><span class="name-placeholder">点击添加你的名字</span>`;
  }

  document.getElementById('dateTxt').textContent = getDateDisplay();
  document.getElementById('subTxt').textContent = getRandomSubtitle(hour);
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

async function setUserName(name) {
  await setPref('userName', name);
  await updateHeader();
}
