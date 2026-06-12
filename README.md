# TabPage

> 你的新标签页 — 收藏整理 + 标签管理，一切从这里开始。

TabPage 是在 [Tab Out](https://github.com/zarazhangrui/tab-out)（作者：张咋啦 / [zarazhangrui](https://github.com/zarazhangrui)）基础上的扩展增强版，在保留 Tab Out 极简纸质感设计和标签管理功能的同时，新增了**收藏分类系统**和**收藏与标签的互通交互**。

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-blue" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Chrome-Extension-green" alt="Chrome Extension">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="License MIT">
</p>

---

## 与原版 Tab Out 的区别

| | 原版 Tab Out | TabPage |
|---|---|---|
| 默认首页 | 标签仪表盘 | **收藏分类** |
| 收藏系统 | 无 | ✅ 分类卡片 + 书签 chip + 拖拽排序 |
| 标签管理 | ✅ | ✅ 保留全部功能 |
| 待读清单 | ✅ | ✅ 保留 + **归档搜索** |
| 收藏 ↔ 标签互通 | 无 | ✅ 点击书签智能跳转已有标签；标签一键添加到收藏 |
| 问候语 | 英文 "Good morning" | **中文**，时间段问候 + 随机趣味副标题 |
| 域名分组 | 基础 | ✅ 子域名智能合并（chat.deepseek.com + platform.deepseek.com → DeepSeek） |
| 重复标签检测 | 无 | ✅ 自动检测 + 一键去重 |
| 拖拽排序 | 无 | ✅ 分类和书签均支持拖拽 |

---

## 功能一览

### 📂 收藏视图

- 自定义分类管理书签（如 "AI Coding"、"学校事务"、"娱乐"）
- 书签以 chip 形式排列，显示网站 favicon 和名称
- **拖拽排序**：分类卡片之间、书签 chip 之间均可拖拽调整顺序，支持跨分类移动
- 实时搜索过滤（名称 + URL）
- 点击书签自动检测该域名是否已有打开标签 → 有则跳转，无则新建

### 🌐 标签视图

- 自动按域名分组显示所有已打开标签
- 首页类标签（Gmail、X、YouTube 等）自动归入"首页"分组
- 点击标签直接跳转（跨窗口）
- 关闭单个标签或整个域名组
- 关闭动画：swoosh 音效 + confetti 粒子

### 📋 待读清单

- 从标签视图保存网页到待读清单
- 勾选完成 → 归档
- 归档搜索过滤

### 🎨 视觉设计

- Tab Out 极简纸质感：Newsreader 衬线字体 + DM Sans 无衬线字体
- 暖色调纸纹背景（SVG noise texture）
- 卡片式布局（CSS columns）
- 微妙的 hover 动画和入场效果

---

## 安装方法

### 方法一：从源码加载（推荐）

1. 点击本页面右上角绿色 **Code** 按钮 → **Download ZIP**，解压到本地
2. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions` 并回车
3. 打开右上角**开发者模式**开关
4. 点击左上角**加载已解压的扩展程序**
5. 选择解压后的 `extension` 文件夹
6. 完成！打开新标签页即可看到 TabPage

### 方法二：Git 克隆

```bash
git clone https://github.com/riwonswain-ovo/tabpage-chrome-extension.git
```

然后按照方法一的第 2–6 步操作。

### 更新扩展

如果已安装，拉取最新代码后：

1. 打开 `chrome://extensions`
2. 找到 TabPage，点击右下角刷新图标 🔄
3. 打开新标签页即可看到最新版本

---

## 技术栈

- **纯 HTML / CSS / JS** — 零构建工具，零 npm 依赖
- **Manifest V3** — Chrome 扩展最新标准
- **chrome.storage.local** — 数据持久化（收藏、待读清单、偏好设置）
- **chrome.tabs API** — 标签查询、切换、关闭
- **Web Audio API** — swoosh 音效合成
- **HTML Drag and Drop API** — 拖拽排序
- **Google Fonts** — Newsreader + DM Sans 字体

---

## 项目结构

```
extension/
├── manifest.json      # 扩展配置
├── index.html         # 主页面
├── style.css          # 设计系统（Tab Out 纸质感）
├── app.js             # 主控：视图切换、事件代理、键盘快捷键
├── background.js      # Service worker：工具栏 badge
├── bookmarks.js       # 收藏视图 + 拖拽排序
├── tabs.js            # 标签仪表盘 + 音效/动画
├── deferred.js        # 待读清单 + 归档搜索
├── greeting.js        # 问候语系统
├── storage.js         # chrome.storage 数据层
└── icons/             # 扩展图标 (16/48/128)
```

---

## 致谢

- **[Tab Out](https://github.com/zarazhangrui/tab-out)** by [zarazhangrui](https://github.com/zarazhangrui)（张咋啦）— 提供了标签管理核心功能和极简纸质感设计系统，TabPage 在此基础之上扩展开发

---

## License

MIT
