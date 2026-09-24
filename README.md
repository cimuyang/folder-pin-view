# Folder Pin View

将常用文件夹固定为侧栏标签，一键切换，只显示当前文件区的内容。

Pin frequently used folders as sidebar tabs and focus on one folder at a time.

**版本 / Version:** 2.2.1 · **Obsidian:** 1.8.7+

![](https://github.com/cimuyang/folder-pin-view/blob/main/Promotion-2.2.1.png)

## 功能

- **快速切换**：固定任意层级的文件夹，拖拽标签排序，右键取消固定。
- **原生风格**：紧凑工具栏与文件列表，适配深浅主题和窄侧栏。
- **中英双语**：默认跟随 Obsidian，也可在插件设置中手动切换。
- **顺手操作**：内联新建与重命名、右键菜单、键盘导航、新标签打开。

## 2.2.1 更新说明

- 修复选中文件区标签被遮挡、刷新后滚动位置跳回的问题。
- 工具栏统一为：新建笔记、新建文件夹、排序、自动显示当前文件、全部折叠/展开。
- 增加文件名、修改时间、创建时间的正反序排序。
- 自动定位当前笔记，必要时切换到对应的已固定文件区并展开父目录；区外笔记不打断浏览。
- 各文件区独立保存展开与滚动状态，兼容旧版配置迁移。
- 补齐中英文菜单和提示，优化长文件名显示，修复多余的“文件列表”悬浮提示。
- 新建与重命名支持 Enter 保存、Esc 取消，避免输入法误提交和重复扩展名。
- 重命名与删除使用 Obsidian 文件管理接口，遵循链接更新、删除确认及回收站行为。

## 安装与使用

1. 从 [Releases](https://github.com/cimuyang/folder-pin-view/releases) 下载 `main.js`、`manifest.json`、`styles.css`。
2. 将三个文件放入笔记库的 `.obsidian/plugins/folder-pin-view/`。
3. 在 Obsidian → 设置 → 第三方插件中启用 **Folder Pin View**。

更新时先停用插件，覆盖上述三个文件后重新启用，**保留原有 `data.json`**。

在原生文件列表中右键文件夹 → **固定文件夹**。工具栏新建操作作用于当前文件区；右键子文件夹可在其中新建。自动显示当前文件默认关闭，可通过工具栏开启。

键盘：上下键移动，左右键展开/折叠，Enter 打开，F2 重命名。Ctrl/Cmd 点击或鼠标中键在新标签页打开。

## Features

- **Quick switching:** pin folders at any depth, drag tabs to reorder, and right-click to unpin.
- **Native styling:** a compact toolbar and file list for light/dark themes and narrow sidebars.
- **Bilingual UI:** follow Obsidian's language or choose Chinese/English in plugin settings.
- **Efficient navigation:** inline creation and renaming, context menus, keyboard controls, and new-tab opening.

## What's new in 2.2.1

- Fixed hidden selected tabs and scroll positions resetting on refresh.
- Unified toolbar: new note, new folder, sort, auto-reveal active file, and expand/collapse all.
- Added ascending/descending sorting by file name, modified time, and created time.
- Auto-reveal locates the active note within pinned regions and expands its ancestors; notes outside these regions leave the view unchanged.
- Preserved independent expansion and scroll state per region, with legacy settings migration.
- Completed Chinese/English menus and hints, improved long file names, and removed the unwanted “Files” container tooltip.
- Added Enter-to-save and Esc-to-cancel inline editing, with IME and duplicate-extension handling.
- Used Obsidian's file-management APIs for link-aware renaming, deletion confirmation, and trash handling.

## Installation and usage

1. Download `main.js`, `manifest.json`, and `styles.css` from [Releases](https://github.com/cimuyang/folder-pin-view/releases).
2. Place them in `.obsidian/plugins/folder-pin-view/` inside your vault.
3. Enable **Folder Pin View** under Settings → Community plugins.

To update, disable the plugin, replace these three files, and enable it again. **Keep your existing `data.json`.**

Right-click a folder in the native file explorer → **Pin folder**. Toolbar creation targets the current region; a subfolder's context menu creates items inside that folder. Auto-reveal is off by default and can be enabled in the toolbar.

Keyboard: Up/Down to navigate, Left/Right to collapse/expand, Enter to open, and F2 to rename. Ctrl/Cmd-click or middle-click opens a new tab.

## 开发 / Development

Node.js 24:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

`npm run dev` 启用监听构建。/ `npm run dev` starts watch mode.

## 隐私与许可 / Privacy and license

插件不包含联网请求或遥测；配置保存在插件目录的 `data.json`，文件操作仅作用于本地笔记库。

The plugin contains no network requests or telemetry. Settings are stored in the plugin's `data.json`; file operations target the local vault.

[MIT License](LICENSE) · [cimuyang/folder-pin-view](https://github.com/cimuyang/folder-pin-view)
