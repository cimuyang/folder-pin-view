# Folder Pin View

将常用文件夹固定为侧栏标签，快速切换父目录与子目录，专注当前文件区。

Pin frequently used folders as sidebar tabs and switch between parent folders and subfolders with one click.

![](https://github.com/cimuyang/folder-pin-view/blob/main/Folder%20Pin%20View-2.2.5-%E5%AE%A3%E4%BC%A0%E4%BB%8B%E7%BB%8D%E5%9B%BE.png)

**版本 / Version:** 2.2.5 · **Obsidian:** 1.13.0+

## 功能 / Features

- **两层快捷栏：**第一排显示父目录完整内容，第二排切换到直接子文件夹；第二排默认开启，可在设置中关闭。
- **自由排序：**两排标签均可拖动排序，子文件夹顺序按父目录分别保存。
- **文件管理：**新建、重命名、删除、批量移动；支持 Ctrl/Cmd 多选、Shift 连选和拖动移动。
- **浏览体验：**六种文件排序、键盘导航、可选自动定位，以及各目录独立的展开和滚动记忆。
- **界面与同步：**中英双语、深浅主题适配，文件夹改名、移动或删除后自动更新。

- **Two shortcut rows:** Parent tabs show the full folder contents; child tabs open direct subfolders. The second row is enabled by default and can be disabled in settings.
- **Custom tab order:** Drag either row to reorder tabs. Subfolder order is saved separately for each parent.
- **File management:** Create, rename, delete and move items in batches. Supports Ctrl/Cmd toggling, Shift range selection and drag-to-move.
- **Navigation:** Six file sort modes, keyboard navigation, optional auto-reveal, and separate expansion and scroll state for each folder.
- **Interface and sync:** Chinese and English, light and dark themes, and automatic updates when folders are renamed, moved or deleted.

## 安装 / Installation

从 [Releases](https://github.com/cimuyang/folder-pin-view/releases) 下载 `main.js`、`manifest.json`、`styles.css`，放入笔记库的 `.obsidian/plugins/folder-pin-view/`，然后启用插件。

Download `main.js`, `manifest.json` and `styles.css` from [Releases](https://github.com/cimuyang/folder-pin-view/releases), copy them to `.obsidian/plugins/folder-pin-view/` in your vault, and enable the plugin.

**更新时先停用插件，替换这三个文件，保留 `data.json`，再启用。**

**To update, disable the plugin, replace these three files, keep `data.json`, and enable it again.**

## 使用 / Usage

1. 在原生文件浏览器中右键文件夹，选择“固定文件夹”。
2. 点击第一排浏览父目录；点击第二排浏览子目录。再次点击父目录标签即可返回。更深层文件夹仍可在文件树中展开。
3. 拖动标签调整快捷栏顺序；将文件拖到文件夹或标签上可移动文件。
4. 多选后右键选择“移动所选项目（数量）…”，搜索并选择目标文件夹。移动前检查重名和循环目录，沿用 Obsidian 的链接更新。

1. Right-click a folder in the native file explorer and choose **Pin folder**.
2. Click a parent tab to browse its full contents, or a child tab to browse that subfolder. Click the parent tab again to return. Deeper folders remain expandable in the tree.
3. Drag tabs to reorder shortcuts; drop files onto folders or tabs to move them.
4. Select multiple items, choose **Move selected items (count)…**, and search for a destination folder. Name conflicts and folder cycles are checked before moving, and Obsidian handles link updates.

**快捷键 / Shortcuts:** 方向键 / Arrow keys：导航 / Navigate · Enter：打开 / Open · F2：重命名 / Rename · Ctrl/Cmd：多选 / Toggle selection · Shift：连选 / Range selection

## 更新说明 / Changelog

### 2.2.5

- 新增默认开启的子文件夹快捷栏，支持按父目录独立拖动排序。
- 点击父目录显示完整内容，点击子目录聚焦其内容；分别保留展开和滚动位置。
- 修复多选后右键移动只处理一个项目的问题，增加可搜索的批量移动目标选择框。
- 完善目录变更同步、多窗口同步及异步操作期间的导航处理。

- Added default-on subfolder shortcuts with per-parent drag ordering.
- Parent tabs show full contents; child tabs focus on a subfolder. Each directory retains its expansion and scroll state.
- Fixed context-menu moves handling only one selected item; added a searchable batch destination picker.
- Improved folder-change synchronization, multiple-view synchronization and navigation during asynchronous operations.

### 2.2.4

调整最低 Obsidian 版本为 1.13.0；新增批量拖动移动，改进设置接口和构建兼容性。

Raised the minimum Obsidian version to 1.13.0; added batch drag-to-move and improved settings and build compatibility.

### 2.2.1–2.2.3

改进双语界面、文件排序、目录状态记忆、新建命名、多选和删除操作。

Improved the bilingual interface, file sorting, folder state persistence, creation and naming, selection and deletion.

## 开发 / Development

使用 Node.js 24。 / Use Node.js 24.

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm run dev` 监听源码变化。 / `npm run dev` watches source changes.

## 隐私 / Privacy

插件不发送网络请求，不收集遥测数据。文件操作仅作用于当前笔记库，配置保存在本地 `data.json` 中。

The plugin makes no network requests and collects no telemetry. File operations stay within the current vault; settings are stored locally in `data.json`.

## 许可 / License

[MIT](LICENSE)
