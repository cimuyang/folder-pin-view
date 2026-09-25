import type { Language, SortOrder } from './model';

const en = {
    title: 'Folder Pin View', newNote: 'New note', newFolder: 'New folder',
    sort: 'Change sort order', autoReveal: 'Auto-reveal active file', expand: 'Expand all', collapse: 'Collapse all',
    pin: 'Pin folder', unpin: 'Unpin folder', rename: 'Rename', delete: 'Delete', deleteSelected: 'Delete selected',
    openTab: 'Open in new tab', empty: 'This folder is empty',
    pinHint: 'Right-click a folder in the file explorer to pin it here.',
    untitled: 'Untitled', untitledFolder: 'Untitled folder',
    invalidName: 'Enter a valid name without path separators or reserved characters.',
    exists: 'An item with this name already exists.', missing: 'This file or folder no longer exists.',
    invalidMove: 'A folder cannot be moved into itself or one of its subfolders.',
    operationFailed: 'Operation failed', saveFailed: 'Could not save Folder Pin View settings.',
    editHint: 'Enter to save · Esc to cancel', language: 'Language', followApp: 'Follow Obsidian',
    languageDesc: 'Applies to this plugin. Native dialogs follow Obsidian.',
    autoRevealDesc: 'Follow the active note within pinned folders. Notes outside them leave this view unchanged.',
    openView: 'Open folder regions', reveal: 'Reveal active file', regions: 'Folder regions',
    files: 'Files', vault: 'Vault',
    'name-asc': 'File name (A–Z)', 'name-desc': 'File name (Z–A)',
    'mtime-desc': 'Modified time (new to old)', 'mtime-asc': 'Modified time (old to new)',
    'ctime-desc': 'Created time (new to old)', 'ctime-asc': 'Created time (old to new)',
};
export type TextKey = keyof typeof en;
const zh: Record<TextKey, string> = {
    title: '文件区', newNote: '新建笔记', newFolder: '新建文件夹',
    sort: '更改排序方式', autoReveal: '自动显示当前文件', expand: '全部展开', collapse: '全部折叠',
    pin: '固定文件夹', unpin: '取消固定', rename: '重命名', delete: '删除', deleteSelected: '删除所选项目',
    openTab: '在新标签页中打开', empty: '此文件夹为空',
    pinHint: '在文件列表中右键文件夹，即可将它固定到这里。',
    untitled: '未命名', untitledFolder: '未命名文件夹',
    invalidName: '请输入有效名称，不包含路径分隔符或保留字符。',
    exists: '已存在同名文件或文件夹。', missing: '此文件或文件夹已不存在。',
    invalidMove: '不能将文件夹移入自身或其子文件夹。',
    operationFailed: '操作失败', saveFailed: '无法保存文件区设置。',
    editHint: 'Enter 保存 · Esc 取消', language: '界面语言', followApp: '跟随 Obsidian',
    languageDesc: '适用于本插件；原生对话框跟随 Obsidian 的语言。',
    autoRevealDesc: '在已固定的文件区内跟随当前笔记；其他位置的笔记不会改变此视图。',
    openView: '打开文件区', reveal: '显示当前文件', regions: '文件区切换',
    files: '文件列表', vault: '仓库',
    'name-asc': '文件名（A–Z）', 'name-desc': '文件名（Z–A）',
    'mtime-desc': '修改时间（从新到旧）', 'mtime-asc': '修改时间（从旧到新）',
    'ctime-desc': '创建时间（从新到旧）', 'ctime-asc': '创建时间（从旧到新）',
};
export function resolveLanguage(language: Language, appLanguage: string): 'zh' | 'en' {
    return language === 'auto' ? appLanguage.toLowerCase().startsWith('zh') ? 'zh' : 'en' : language;
}
export function translate(language: 'zh' | 'en', key: TextKey | SortOrder): string {
    return (language === 'zh' ? zh : en)[key];
}
