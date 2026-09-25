# Folder Pin View

Obsidian 1.8.7+ 

将常用文件夹固定为侧栏标签，一键切换，专注当前文件区。支持拖拽排序、文件管理、键盘导航与中英双语，适配深浅主题。

Pin frequently used folders as sidebar tabs and switch between them with one click. Includes draggable tabs, file management, keyboard navigation, Chinese and English, and light and dark theme support.

## 安装 / Installation

从 [Releases](https://github.com/cimuyang/folder-pin-view/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入笔记库的 `.obsidian/plugins/folder-pin-view/`，然后在 Obsidian 的第三方插件设置中启用。更新时先停用插件，覆盖这三个文件后重新启用，**保留原有 `data.json`**。

Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/cimuyang/folder-pin-view/releases), place them in your vault's `.obsidian/plugins/folder-pin-view/`, and enable the plugin in Obsidian's community plugin settings. To update, disable the plugin, replace those three files, and enable it again. **Keep your existing `data.json`.**

## 使用 / Usage

在原生文件列表中右键文件夹，选择“固定文件夹”。点击标签切换文件区，拖拽调整顺序，右键取消固定。工具栏在当前文件区新建，右键子文件夹可在其中新建；“自动显示当前文件”默认关闭，可按需开启。

Right-click a folder in the native file explorer and choose **Pin folder**. Click a tab to switch regions, drag to reorder, or right-click to unpin. Toolbar buttons create items in the current region; a subfolder's context menu creates items inside it. **Auto-reveal active file** is off by default and can be enabled from the toolbar.

方向键导航，Enter 打开，F2 重命名；Shift 点击连续多选，Ctrl/Cmd 点击增减选择，右键可删除所选项目。鼠标中键或右键菜单可在新标签页打开。

Use arrow keys to navigate, Enter to open, and F2 to rename. Shift-click selects a range, while Ctrl/Cmd-click toggles individual items; right-click to delete the selection. Middle-click or the context menu opens a file in a new tab.

## 开发 / Development

使用 Node.js 24，安装依赖后执行类型检查、测试和构建。`npm run dev` 可监听源码变化。

Use Node.js 24 to install dependencies, check types, run tests, and build. `npm run dev` rebuilds on source changes.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

## 隐私 / Privacy

插件不发送网络请求，不收集遥测数据。文件操作仅作用于当前笔记库，插件配置保存在本地 `data.json` 中。

The plugin makes no network requests and collects no telemetry. File operations stay within the current vault, and plugin settings are stored locally in `data.json`.

## 更新说明 / What's new

### 2.2.3

**删除与选择**修复删除成功后重复删除引起的报错。支持 Shift 连续多选、Ctrl/Cmd 增减选择及所选项目删除，父文件夹与其子项同时选中时只处理一次。

**Deletion and selection** Fixed the error caused by deleting an item twice. Added Shift range selection, Ctrl/Cmd toggling, and deletion of selected items. A selected folder and its descendants are processed once.

**标题与兼容性**在新笔记打开后再次触发原生标题编辑；改进弹出窗口定时器、中文输入法、设置搜索和界面样式的兼容性。

**Title and compatibility** Re-enter native title editing after a new note opens, and improved timer, Chinese IME, settings search, and styling compatibility.

### 2.2.2

**新建与命名**新笔记立即打开，在 Obsidian 原生标题处命名；新文件夹立即创建并在侧栏命名，Esc 或切换文件区仅取消改名。新建后自动展开父目录并定位，连续创建自动避让重名；写入失败可重试，打开失败保留文件，异步创建完成后不会抢回已切换的焦点。

**Creation and naming** New notes open immediately with Obsidian's native title editing. New folders appear immediately for sidebar renaming; Escape or switching regions cancels only the rename. Creation reveals the new item, avoids duplicate names during concurrent writes, supports retrying failed writes, retains files if opening fails, and avoids taking focus back after you move on.

### 2.2.1

**浏览与排序**统一新建、排序、自动定位和折叠/展开工具栏；支持文件名、修改时间、创建时间的正反序排序。各文件区独立记忆展开与滚动位置，兼容旧配置；自动定位可切换到对应置顶文件区，区外笔记不打断浏览。

**Navigation and sorting** A unified toolbar provides creation, sorting, auto-reveal, and collapse/expand controls. Sort by name, modification time, or creation time in either direction. Each region remembers its expansion and scroll state, with legacy settings migration. Auto-reveal can switch to the matching pinned region without reacting to notes outside pinned folders.

**交互与修复**改善标签可见性、滚动稳定性、长文件名显示及中英文菜单提示。侧栏重命名支持 Enter 保存、Esc 取消，避免输入法误提交和重复扩展名；重命名与删除遵循 Obsidian 的链接更新、删除确认及回收站设置。

**Polish and fixes** Improved tab visibility, scroll stability, long file names, and bilingual menus and tooltips. Sidebar renaming supports Enter to save and Escape to cancel, with IME safeguards and extension handling. Renaming and deletion follow Obsidian's link updates, confirmation prompts, and trash preferences.
