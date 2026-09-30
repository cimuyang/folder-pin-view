import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ancestorPaths, comparator, containsPath, entryPath, getZone, normalizeData, remapData, removePath, revealScroll, revealZone, validName } from '../src/model';
import { resolveLanguage, translate } from '../src/i18n';
import FolderPinPlugin from '../src/main';
import { createUntitled } from '../src/create';
import { planMove } from '../src/move';
import { createApp, FuzzySuggestModal, installDom, Menu, Notice, TFile } from './obsidian';
import { MoveFolderModal } from '../src/move-picker';

test('migrate legacy settings without losing pins, selection, sort or expansion', () => {
    const data = normalizeData({ pinnedFolders: ['A', 'B', 'A'], activeFolderPath: 'B', sortOrder: 'desc', expandedFolders: ['A/one', 'B/two'] });
    assert.deepEqual(data.pinnedFolders, ['A', 'B']); assert.equal(data.activeFolderPath, 'B');
    assert.equal(data.sortOrder, 'name-desc'); assert.equal(data.language, 'auto'); assert.equal(data.autoReveal, false);
    assert.deepEqual(getZone(data, 'A').expanded, ['A/one']); assert.deepEqual(getZone(data, 'B').expanded, ['B/two']);
});
test('malformed settings are repaired and defaults never share arrays', () => {
    const data = normalizeData({ pinnedFolders: ['A', 4, null, '../x', '/'], activeFolderPath: 'gone', zones: { '@A': { scrollTop: -3, expanded: 'oops' } } });
    assert.deepEqual(data.pinnedFolders, ['A']); assert.equal(data.activeFolderPath, 'A'); assert.equal(getZone(data).scrollTop, 0);
    data.pinnedFolders.push('B'); assert.deepEqual(normalizeData(null).pinnedFolders, []);
    assert.deepEqual(normalizeData([]).pinnedFolders, []);
});
test('zone keys safely support folder names such as __proto__', () => {
    const data = normalizeData({ pinnedFolders: ['__proto__'] }); getZone(data).scrollTop = 40;
    assert.equal(getZone(normalizeData(JSON.parse(JSON.stringify(data)))).scrollTop, 40);
});
test('path boundaries do not confuse Notes with Notes Archive', () => {
    assert.equal(containsPath('Notes', 'Notes Archive/a.md'), false); assert.equal(containsPath('Notes', 'Notes/a.md'), true);
});
test('reveal prefers current region, otherwise deepest pinned ancestor, and never invents pins', () => {
    const pins = ['A', 'A/B', 'C'];
    assert.equal(revealZone(pins, 'A', 'A/B/c.md'), 'A'); assert.equal(revealZone(pins, 'C', 'A/B/c.md'), 'A/B');
    assert.equal(revealZone(pins, 'A', 'Other/c.md'), undefined); assert.equal(revealZone([], null, 'Other/c.md'), null);
});
test('ancestors stop at the selected root', () => {
    assert.deepEqual(ancestorPaths('A/B/C/d.md', 'A'), ['A/B', 'A/B/C']);
    assert.deepEqual(ancestorPaths('A/B.md', null), ['A']); assert.deepEqual(ancestorPaths('a.md', null), []);
});
test('renaming parent remaps pins, active region and every nested zone but preserves scroll', () => {
    const data = normalizeData({ pinnedFolders: ['A', 'A/Sub', 'AB'], activeFolderPath: 'A/Sub' });
    getZone(data).expanded = ['A/Sub/Deep']; getZone(data).scrollTop = 160;
    remapData(data, 'A', 'Renamed');
    assert.deepEqual(data.pinnedFolders, ['Renamed', 'Renamed/Sub', 'AB']); assert.equal(data.activeFolderPath, 'Renamed/Sub');
    assert.deepEqual(getZone(data), { expanded: ['Renamed/Sub/Deep'], scrollTop: 160 });
});
test('deleting a parent cleans descendants and chooses a surviving neighbouring region', () => {
    const data = normalizeData({ pinnedFolders: ['A', 'A/Sub', 'B'], activeFolderPath: 'A/Sub' });
    removePath(data, 'A'); assert.deepEqual(data.pinnedFolders, ['B']); assert.equal(data.activeFolderPath, 'B');
    removePath(data, 'B'); assert.equal(data.activeFolderPath, null);
});
test('moving a subfolder outside a region removes its expansion state from that region', () => {
    const data = normalizeData({ pinnedFolders: ['A', 'A/Sub'], expandedFolders: ['A/Sub', 'A/Sub/Deep'] });
    remapData(data, 'A/Sub', 'Elsewhere');
    assert.deepEqual(getZone(data, 'A').expanded, []);
    assert.deepEqual(getZone(data, 'Elsewhere').expanded, ['Elsewhere/Deep']);
});
test('six sort modes keep folders first, use natural numbers and stable name ties', () => {
    const a = { name: 'Note 2', folder: false, mtime: 20, ctime: 100 };
    const b = { name: 'Note 10', folder: false, mtime: 100, ctime: 20 };
    for (const [mode, expected] of [['name-asc', -1], ['name-desc', 1], ['mtime-desc', 1], ['mtime-asc', -1], ['ctime-desc', -1], ['ctime-asc', 1]] as const) {
        const compare = comparator(mode, 'en'); assert.equal(Math.sign(compare(a, b)), expected);
        assert.equal(compare({ name: 'Z', folder: true }, a), -1);
    }
    assert.equal(Math.sign(comparator('mtime-desc', 'en')(a, { ...b, mtime: 20 })), -1);
});
test('name validation blocks traversal, reserved names and separators while accepting Chinese', () => {
    for (const name of ['..', '.', '', 'a/b', 'a\\b', 'a:b', 'NUL.md', 'COM1', 'tail.', ' bad', 'bad\n']) assert.equal(validName(name), false, name);
    for (const name of ['教学计划', 'Note 2', 'CONtext', 'a.b']) assert.equal(validName(name), true, name);
});
test('new note and rename paths preserve extensions without duplicating them', () => {
    assert.equal(entryPath('/', '笔记', 'md'), '笔记.md'); assert.equal(entryPath('A', 'test.MD', 'md'), 'A/test.MD');
    assert.equal(entryPath('A', 'paper.pdf', 'pdf'), 'A/paper.pdf'); assert.equal(entryPath('', 'folder'), 'folder');
});
test('minimal horizontal reveal handles both edges, long labels and hidden panels', () => {
    assert.equal(revealScroll(0, 200, 230, 100), 130); assert.equal(revealScroll(150, 200, 80, 100), 80);
    assert.equal(revealScroll(100, 200, 120, 80), 100); assert.equal(revealScroll(0, 200, 100, 300), 100);
    assert.equal(revealScroll(42, 0, 200, 100), 42);
});
test('move planning rejects conflicts and folder cycles before any write', () => {
    const h = createApp();
    ['A/Sub', 'B'].forEach(path => h.add(path, true));
    ['A/one.md', 'A/Sub/deep.md', 'B/one.md'].forEach(path => h.add(path));
    const vault = h.app.vault as any;
    assert.equal(planMove(vault, ['A/one.md', 'A/Sub'], h.files.get('B') as any).error, 'exists');
    assert.equal(planMove(vault, ['A', 'A/Sub'], h.files.get('A/Sub') as any).error, 'invalidMove');
    assert.deepEqual(planMove(vault, ['A/Sub', 'A/Sub/deep.md'], h.files.get('B') as any).moves.map(move => move.path), ['B/Sub']);
    assert.deepEqual(planMove(vault, ['A/one.md'], h.files.get('A') as any).moves, []);
});
test('language follows Chinese variants, respects explicit overrides and has translated sort labels', () => {
    assert.equal(resolveLanguage('auto', 'zh-TW'), 'zh'); assert.equal(resolveLanguage('auto', 'fr'), 'en');
    assert.equal(resolveLanguage('en', 'zh'), 'en'); assert.equal(translate('zh', 'newNote'), '新建笔记');
    assert.equal(translate('en', 'mtime-desc'), 'Modified time (new to old)');
});

async function harness(options: any = {}) {
    const dom = new JSDOM('<!doctype html><body></body>', { pretendToBeVisual: true });
    (globalThis as any).window = dom.window; (globalThis as any).document = dom.window.document;
    installDom(dom.window as any); Menu.last = null; Notice.messages = [];
    const env = createApp();
    ['A/Sub', 'B/Deep', 'C'].forEach(path => env.add(path, true));
    ['A/one.md', 'A/two.md', 'A/Sub/deep.md', 'B/other.md', 'B/Deep/deeper.md'].forEach(path => env.add(path));
    const plugin = new FolderPinPlugin(env.app as any, {} as any);
    (plugin as any).saved = { pinnedFolders: ['A', 'B', 'C'], activeFolderPath: 'A', ...options };
    await plugin.onload(); await plugin.activateView();
    const view = plugin.views()[0]; const el = view.contentEl;
    return { ...env, dom, plugin, view, el,
        row: (path: string) => [...el.querySelectorAll<HTMLElement>('.fpv-row')].find(row => row.dataset.path === path)!,
        pin: (path: string) => [...el.querySelectorAll<HTMLButtonElement>('.fpv-pin')].find(button => button.dataset.path === path)!,
        tool: (index: number) => el.querySelectorAll<HTMLButtonElement>('.fpv-tool')[index],
        key: (target: Element, key: string, extra = {}) => target.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })),
        async close() { await view.onClose(); plugin.onunload(); (view as any).cleanup.forEach((fn: any) => fn()); (plugin as any).events.forEach((ref: any) => ref.off()); dom.window.close(); },
    };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const subtab = (h: Awaited<ReturnType<typeof harness>>, path: string): HTMLButtonElement =>
    [...h.el.querySelectorAll<HTMLButtonElement>('.fpv-subfolder')].find(button => button.dataset.path === path)!;
const childOrder = (h: Awaited<ReturnType<typeof harness>>) =>
    [...h.el.querySelectorAll<HTMLButtonElement>('.fpv-subfolder')].map(button => button.dataset.path);
function selectPair(h: Awaited<ReturnType<typeof harness>>) {
    for (const path of ['A/one.md', 'A/two.md']) h.row(path).dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
}
function batchPicker(h: Awaited<ReturnType<typeof harness>>): MoveFolderModal {
    h.row('A/two.md').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
    Menu.last!.items.find(item => item.title.startsWith('移动所选项目'))!.action();
    return FuzzySuggestModal.last as MoveFolderModal;
}

test('second row defaults on, has only direct subfolders, filters the tree and parent click always resets it', async () => {
    const h = await harness();
    try {
        h.add('A/Sub/Deep', true); h.add('A/Sub/Deep/note.md'); h.view.renderTree();
        assert.equal(h.plugin.data.showSubfolderBar, true);
        assert.deepEqual(childOrder(h), ['A/Sub']);
        assert.ok(h.row('A/one.md')); assert.ok(h.row('A/Sub'));
        subtab(h, 'A/Sub').click();
        assert.equal(h.plugin.data.activeFolderPath, 'A'); assert.equal(h.plugin.data.activeSubfolderPath, 'A/Sub');
        assert.equal(h.pin('A').getAttribute('aria-selected'), 'true');
        assert.equal(subtab(h, 'A/Sub').getAttribute('aria-selected'), 'true');
        assert.equal(h.row('A/one.md'), undefined); assert.equal(h.row('A/Sub'), undefined);
        assert.ok(h.row('A/Sub/deep.md')); h.row('A/Sub/Deep').click(); assert.ok(h.row('A/Sub/Deep/note.md'));
        h.pin('A').click();
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('A/one.md')); assert.ok(h.row('A/Sub'));
        assert.equal(subtab(h, 'A/Sub').getAttribute('aria-selected'), 'false');
        h.pin('C').click(); assert.equal(h.el.querySelector<HTMLElement>('.fpv-subfolder-bar')!.hidden, true);
    } finally { await h.close(); }
});

test('settings hide subfolder row, return to parent, and retain manual ordering when enabled again', async () => {
    const h = await harness({ subfolderOrders: { '@A': ['A/Sub'] } });
    try {
        subtab(h, 'A/Sub').click();
        const settings = h.plugin.settings[0] as any;
        settings.setControlValue('showSubfolderBar', false);
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('A/one.md'));
        assert.equal(h.el.querySelector<HTMLElement>('.fpv-subfolder-bar')!.hidden, true);
        settings.setControlValue('showSubfolderBar', true);
        assert.deepEqual(childOrder(h), ['A/Sub']); assert.equal(settings.getControlValue('showSubfolderBar'), true);
    } finally { await h.close(); }
});

test('child tab sorting persists per parent, appends new folders, and cannot reorder first-row tabs', async () => {
    const h = await harness();
    try {
        h.add('A/Alpha', true); h.add('A/Zeta', true); h.view.renderTree();
        drag(h, subtab(h, 'A/Zeta'), subtab(h, 'A/Alpha'));
        assert.deepEqual(childOrder(h), ['A/Zeta', 'A/Alpha', 'A/Sub']);
        assert.deepEqual(h.app.fileManager.renamed, []);
        h.pin('B').click(); assert.deepEqual(childOrder(h), ['B/Deep']); h.pin('A').click();
        assert.deepEqual(childOrder(h), ['A/Zeta', 'A/Alpha', 'A/Sub']);
        h.add('A/Added', true); h.view.renderTree();
        assert.deepEqual(childOrder(h), ['A/Zeta', 'A/Alpha', 'A/Sub', 'A/Added']);
        drag(h, subtab(h, 'A/Zeta'), h.pin('B'));
        assert.deepEqual(h.plugin.data.pinnedFolders, ['A', 'B', 'C']);
        drag(h, h.pin('B'), subtab(h, 'A/Sub'));
        assert.deepEqual(childOrder(h), ['A/Zeta', 'A/Alpha', 'A/Sub', 'A/Added']);
        const restored = normalizeData(JSON.parse(JSON.stringify(h.plugin.data)));
        assert.deepEqual(restored.subfolderOrders['@A'], ['A/Zeta', 'A/Alpha', 'A/Sub']);
    } finally { await h.close(); }
});

test('parent and child retain separate scroll and expansion across restarts', async () => {
    const h = await harness({ activeSubfolderPath: 'A/Sub', zones: {
        '@A': { expanded: ['A/Sub'], scrollTop: 55 }, '@A/Sub': { expanded: [], scrollTop: 90 },
    } });
    try {
        const tree = h.el.querySelector<HTMLElement>('.fpv-tree')!;
        assert.equal(tree.scrollTop, 90); assert.ok(h.row('A/Sub/deep.md'));
        h.pin('A').click(); assert.equal(tree.scrollTop, 55); assert.ok(h.row('A/Sub/deep.md'));
        subtab(h, 'A/Sub').click(); assert.equal(tree.scrollTop, 90);
        tree.scrollTop = 120; h.view.captureScroll();
        assert.equal(getZone(normalizeData(JSON.parse(JSON.stringify(h.plugin.data)))).scrollTop, 120);
    } finally { await h.close(); }
});

test('renames preserve selected child and ordering; moves outside parent and deletion fall back cleanly', async () => {
    const h = await harness({ subfolderOrders: { '@A': ['A/Sub'] } });
    try {
        subtab(h, 'A/Sub').click();
        await h.app.fileManager.renameFile(h.files.get('A/Sub')!, 'A/Renamed');
        assert.equal(h.plugin.data.activeSubfolderPath, 'A/Renamed'); assert.ok(h.row('A/Renamed/deep.md'));
        assert.deepEqual(childOrder(h), ['A/Renamed']);
        assert.deepEqual(h.plugin.data.subfolderOrders['@A'], ['A/Renamed']);
        await h.app.fileManager.renameFile(h.files.get('A')!, 'Parent');
        assert.equal(h.plugin.data.activeFolderPath, 'Parent'); assert.equal(h.plugin.data.activeSubfolderPath, 'Parent/Renamed');
        assert.deepEqual(h.plugin.data.subfolderOrders['@Parent'], ['Parent/Renamed']);
        await h.app.fileManager.renameFile(h.files.get('Parent/Renamed')!, 'B/Renamed');
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('Parent/one.md'));
        assert.deepEqual(childOrder(h), []);
        h.pin('B').click(); subtab(h, 'B/Renamed').click();
        await h.app.fileManager.trashFile(h.files.get('B/Renamed')!);
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('B/other.md'));
    } finally { await h.close(); }
});

test('child toolbar creates in selected child and delayed creation does not steal parent focus', async () => {
    const h = await harness();
    try {
        subtab(h, 'A/Sub').click(); h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/Sub/未命名.md')); assert.ok(h.row('A/Sub/未命名.md'));
        assert.equal(h.files.has('A/未命名.md'), false);
        const pending = deferred(); const original = h.app.vault.create;
        h.app.vault.create = async (path, content) => { await pending.promise; return original(path, content); };
        const count = h.app.workspace.opened.length;
        h.tool(0).click(); h.pin('A').click(); pending.resolve(); await settle();
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.equal(h.app.workspace.opened.length, count);
        assert.ok(h.files.has('A/Sub/未命名 1.md'));
    } finally { await h.close(); }
});

test('reveal retains child for its notes and returns to parent for sibling notes; keyboard returns with Escape', async () => {
    const h = await harness({ autoReveal: true });
    try {
        subtab(h, 'A/Sub').click(); h.row('A/Sub/deep.md').click(); await settle();
        assert.equal(h.plugin.data.activeSubfolderPath, 'A/Sub');
        await h.app.workspace.getLeaf(false).openFile(h.files.get('A/one.md') as TFile);
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('A/one.md'));
        h.key(subtab(h, 'A/Sub'), 'Home'); assert.equal(h.plugin.data.activeSubfolderPath, 'A/Sub');
        h.key(subtab(h, 'A/Sub'), 'Escape'); assert.equal(h.plugin.data.activeSubfolderPath, null);
        assert.equal(h.dom.window.document.activeElement, h.pin('A'));
    } finally { await h.close(); }
});

test('right-click move passes the whole selection to integrations and moves the snapshot using one picker', async () => {
    const h = await harness();
    try {
        const single: string[] = [], batch: string[][] = [];
        h.app.workspace.on('file-menu', (_menu, file) => single.push(file.path));
        h.app.workspace.on('files-menu', (_menu, files) => batch.push(files.map((file: any) => file.path)));
        selectPair(h); const picker = batchPicker(h);
        assert.deepEqual(single, []); assert.deepEqual(batch, [['A/one.md', 'A/two.md']]);
        assert.ok(picker.getItems().some(folder => folder.path === '/'));
        assert.equal(picker.getItems().some(folder => folder.path === 'A'), false);
        h.row('A/Sub').click(); // A later click must not change the captured operation.
        picker.onChooseItem(h.files.get('B') as any); await settle();
        assert.deepEqual(h.app.fileManager.renamed, ['B/one.md', 'B/two.md']);
        assert.ok(h.files.has('A/Sub/deep.md')); assert.ok(h.row('B/one.md').classList.contains('is-selected'));
    } finally { await h.close(); }
});

test('batch move checks all conflicts before writing and reports partial failure accurately', async () => {
    const h = await harness();
    try {
        selectPair(h); const picker = batchPicker(h); h.add('B/two.md');
        assert.equal(picker.getItems().some(folder => folder.path === 'B'), false);
        picker.onChooseItem(h.files.get('B') as any); await settle();
        assert.deepEqual(h.app.fileManager.renamed, []); assert.ok(Notice.messages.at(-1)!.includes('同名'));
        const original = h.app.fileManager.renameFile;
        h.app.fileManager.renameFile = async (file, path) => { if (file.path === 'A/two.md') throw new Error('Disk failure'); return original(file, path); };
        picker.onChooseItem(h.files.get('C') as any); await settle();
        assert.ok(h.files.has('C/one.md')); assert.ok(h.files.has('A/two.md'));
        assert.match(Notice.messages.at(-1)!, /1\/2.*Disk failure/);
    } finally { await h.close(); }
});

test('batch picker cancellation and right-clicking unselected items leave the group untouched', async () => {
    const h = await harness();
    try {
        selectPair(h); batchPicker(h).close(); assert.deepEqual(h.app.fileManager.renamed, []);
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        assert.equal(Menu.last!.items.some(item => item.title.startsWith('移动所选项目')), false);
        assert.equal(h.el.querySelectorAll('.fpv-row.is-selected').length, 1);
    } finally { await h.close(); }
});

test('file drag into second row moves files, while folder and descendant batch move only once', async () => {
    const h = await harness();
    try {
        selectPair(h); drag(h, h.row('A/one.md'), subtab(h, 'A/Sub')); await settle();
        assert.ok(h.row('A/Sub/one.md')); assert.ok(h.row('A/Sub/two.md'));
        assert.equal(h.plugin.data.activeSubfolderPath, 'A/Sub');
        h.pin('A').click(); h.row('A/Sub').click();
        h.row('A/Sub/deep.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        Menu.last!.items.find(item => item.title.startsWith('移动所选项目'))!.action();
        const picker = FuzzySuggestModal.last as MoveFolderModal;
        assert.equal(picker.getItems().some(folder => folder.path === 'A/Sub'), false);
        picker.onChooseItem(h.files.get('B') as any); await settle();
        assert.deepEqual(h.app.fileManager.renamed.slice(-1), ['B/Sub']); assert.ok(h.files.has('B/Sub/deep.md'));
    } finally { await h.close(); }
});

test('normalization rejects malformed child paths, preserves default-on upgrade and supports special folder names', () => {
    const data = normalizeData({ pinnedFolders: ['__proto__'], activeSubfolderPath: '__proto__/Sub', subfolderOrders: {
        '@__proto__': ['__proto__/Sub', '__proto__/Sub', '__proto__/Deep/More', '../bad'],
    }, zones: { '@__proto__/Sub': { scrollTop: 60, expanded: ['__proto__/Sub/Deep'] } } });
    assert.equal(data.showSubfolderBar, true); assert.deepEqual(data.subfolderOrders['@__proto__'], ['__proto__/Sub']);
    assert.equal(getZone(data).scrollTop, 60);
    assert.equal(normalizeData({ ...data, showSubfolderBar: false }).activeSubfolderPath, null);
    assert.equal(normalizeData({ ...data, activeSubfolderPath: '__proto__/Sub/Deep' }).activeSubfolderPath, null);
});

test('two views synchronize child filter and its disabled setting without retaining old file selection', async () => {
    const h = await harness();
    const leaf = h.app.workspace.getLeftLeaf(true); await leaf.setViewState({ type: 'folder-pin-view' });
    try {
        selectPair(h); subtab(h, 'A/Sub').click();
        assert.ok(leaf.view.contentEl.querySelector('[data-path="A/Sub/deep.md"]'));
        assert.equal(leaf.view.contentEl.querySelector('.fpv-row[data-path="A/one.md"]'), null);
        assert.equal(h.el.querySelectorAll('.fpv-row.is-selected').length, 0);
        (h.plugin.settings[0] as any).setControlValue('showSubfolderBar', false);
        assert.ok(leaf.view.contentEl.querySelector('.fpv-row[data-path="A/one.md"]'));
        assert.equal(leaf.view.contentEl.querySelector('.fpv-subfolder-bar').hidden, true);
    } finally { await leaf.view.onClose(); await h.close(); }
});

test('a pending batch move cannot steal navigation or be submitted twice', async () => {
    const h = await harness();
    try {
        selectPair(h); const picker = batchPicker(h); const pending = deferred();
        const original = h.app.fileManager.renameFile;
        h.app.fileManager.renameFile = async (file, path) => { await pending.promise; return original(file, path); };
        picker.onChooseItem(h.files.get('B') as any);
        picker.onChooseItem(h.files.get('C') as any);
        h.pin('C').click(); pending.resolve(); await settle();
        assert.deepEqual(h.app.fileManager.renamed, ['B/one.md', 'B/two.md']);
        assert.equal(h.plugin.data.activeFolderPath, 'C'); assert.equal(h.plugin.data.activeSubfolderPath, null);
    } finally { await h.close(); }
});

test('a missing restored child falls back to its parent and invalid saved order entries are ignored', async () => {
    const h = await harness({ activeSubfolderPath: 'A/Gone', subfolderOrders: { '@A': ['A/Gone', 'A/Sub'] } });
    try {
        assert.equal(h.plugin.data.activeSubfolderPath, null); assert.ok(h.row('A/one.md'));
        assert.deepEqual(childOrder(h), ['A/Sub']);
        const button = subtab(h, 'A/Sub'); button.focus();
        h.add('A/New', true); h.view.renderTree();
        assert.equal(h.dom.window.document.activeElement, subtab(h, 'A/Sub'));
        assert.equal(Notice.messages.length, 0);
    } finally { await h.close(); }
});
function drag(h: Awaited<ReturnType<typeof harness>>, source: Element, target: Element): void {
    const dataTransfer = { setData() {}, effectAllowed: 'none', dropEffect: 'none' };
    for (const [element, type] of [[source, 'dragstart'], [target, 'dragover'], [target, 'drop'], [source, 'dragend']] as const) {
        const event = new h.dom.window.Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
        element.dispatchEvent(event);
    }
}
test('dragging a selected group onto a pinned tab moves both files and reveals them', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        h.row('A/two.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        drag(h, h.row('A/one.md'), h.pin('B'));
        await settle();
        assert.ok(h.files.has('B/one.md')); assert.ok(h.files.has('B/two.md'));
        assert.equal(h.plugin.data.activeFolderPath, 'B');
        assert.ok(h.row('B/one.md').classList.contains('is-selected'));
        assert.deepEqual(h.app.fileManager.renamed.slice(-2), ['B/one.md', 'B/two.md']);
    } finally { await h.close(); }
});
test('dragging a folder moves descendants once and rejects cycles or collisions', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true }));
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        h.row('A/Sub/deep.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        drag(h, h.row('A/Sub'), h.pin('B'));
        await settle();
        assert.ok(h.files.has('B/Sub/deep.md'));
        assert.deepEqual(h.app.fileManager.renamed.slice(-1), ['B/Sub']);
        drag(h, h.row('B/Sub'), h.row('B/Deep'));
        await settle();
        assert.ok(h.files.has('B/Deep/Sub/deep.md'));
    } finally { await h.close(); }
});
test('invalid drag leaves the vault unchanged and reports the reason', async () => {
    const h = await harness();
    try {
        h.add('B/one.md');
        const before = h.app.fileManager.renamed.length;
        drag(h, h.row('A/one.md'), h.pin('B'));
        await settle();
        assert.equal(h.app.fileManager.renamed.length, before);
        assert.ok(h.files.has('A/one.md'));
        assert.ok(Notice.messages.some(message => message.includes('同名')));
        drag(h, h.row('A/Sub'), h.row('A/Sub'));
        await settle();
        assert.equal(h.app.fileManager.renamed.length, before);
        assert.ok(Notice.messages.some(message => message.includes('自身')));
    } finally { await h.close(); }
});
test('dragging an unselected row moves only that row; pin dragging still reorders tabs', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        drag(h, h.row('A/two.md'), h.pin('B'));
        await settle();
        assert.ok(h.files.has('A/one.md'));
        assert.ok(h.files.has('B/two.md'));
        drag(h, h.pin('C'), h.pin('A'));
        assert.deepEqual(h.plugin.data.pinnedFolders, ['C', 'A', 'B']);
    } finally { await h.close(); }
});
function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    return { promise, resolve };
}

test('context creation expands a collapsed parent and reveals the note with auto-reveal off', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        Menu.last!.items[0].action(); await settle();
        assert.ok(h.files.has('A/Sub/未命名.md')); assert.ok(h.row('A/Sub/未命名.md'));
        assert.ok(getZone(h.plugin.data).expanded.includes('A/Sub'));
        assert.equal(h.app.workspace.opened[0].file.path, 'A/Sub/未命名.md');
        assert.equal(h.plugin.data.autoReveal, false);
    } finally { await h.close(); }
});

test('overlapping writes reserve distinct names and only the latest request takes focus', async () => {
    const h = await harness();
    try {
        const gate = deferred(), create = h.app.vault.create;
        h.add('A/未命名.md');
        h.app.vault.create = async (path, content) => { await gate.promise; return create(path, content); };
        h.tool(0).click(); h.tool(0).click();
        assert.equal(h.files.has('A/未命名 1.md'), false);
        gate.resolve(); await settle();
        assert.ok(h.files.has('A/未命名 1.md')); assert.ok(h.files.has('A/未命名 2.md'));
        assert.equal(h.app.workspace.opened.length, 1);
        assert.equal(h.app.workspace.opened[0].file.path, 'A/未命名 2.md');
        assert.deepEqual(Notice.messages, []);
    } finally { await h.close(); }
});

test('name reservations are shared across views of the same vault', async () => {
    const h = await harness();
    const leaf = h.app.workspace.getLeftLeaf(true); await leaf.setViewState({ type: 'folder-pin-view' });
    try {
        const gate = deferred(), create = h.app.vault.create;
        h.app.vault.create = async (path, content) => { await gate.promise; return create(path, content); };
        h.tool(0).click(); leaf.view.contentEl.querySelector('.fpv-tool').click();
        gate.resolve(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.ok(h.files.has('A/未命名 1.md'));
        assert.deepEqual(Notice.messages, []);
    } finally { await leaf.view.onClose(); await h.close(); }
});

test('a concurrent external creation is retried without overwriting that file', async () => {
    const h = await harness();
    try {
        const create = h.app.vault.create;
        let first = true;
        h.app.vault.create = async (path, content) => {
            if (first) { first = false; h.add(path); }
            return create(path, content);
        };
        h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.ok(h.files.has('A/未命名 1.md'));
        assert.equal(h.app.workspace.opened[0].file.path, 'A/未命名 1.md');
        assert.deepEqual(Notice.messages, []);
    } finally { await h.close(); }
});

test('switching regions during a delayed write does not reopen the original region or steal focus', async () => {
    const h = await harness({ autoReveal: true });
    try {
        const gate = deferred(), create = h.app.vault.create;
        h.app.vault.create = async (path, content) => { await gate.promise; return create(path, content); };
        h.tool(0).click(); h.pin('B').click();
        gate.resolve(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.equal(h.plugin.data.activeFolderPath, 'B');
        assert.equal(h.app.workspace.opened.length, 0);
        h.pin('A').click(); assert.ok(h.row('A/未命名.md'));
    } finally { await h.close(); }
});

test('opening another note during a delayed creation keeps the newly chosen note active', async () => {
    const h = await harness();
    try {
        const gate = deferred(), create = h.app.vault.create;
        h.app.vault.create = async (path, content) => { await gate.promise; return create(path, content); };
        h.tool(0).click(); h.row('A/one.md').click(); await settle();
        gate.resolve(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.equal(h.app.workspace.getActiveFile()?.path, 'A/one.md');
    } finally { await h.close(); }
});

test('closing a view during creation retains the file without opening it', async () => {
    const h = await harness();
    try {
        const gate = deferred(), create = h.app.vault.create;
        h.app.vault.create = async (path, content) => { await gate.promise; return create(path, content); };
        h.tool(0).click(); await h.view.onClose(); gate.resolve(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.equal(h.app.workspace.opened.length, 0);
    } finally { await h.close(); }
});

test('opening failure retains the created note and reports the error', async () => {
    const h = await harness();
    try {
        h.app.workspace.getLeaf = () => ({ openFile: async () => { throw new Error('Cannot open'); } });
        h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.ok(h.row('A/未命名.md'));
        assert.match(Notice.messages[0], /Cannot open/);
    } finally { await h.close(); }
});

test('creation refuses a deleted parent instead of recreating it elsewhere', async () => {
    const h = await harness();
    try {
        const parent = h.files.get('A/Sub')!;
        await h.app.fileManager.trashFile(parent);
        await assert.rejects(createUntitled(h.app.vault as any, parent as any, false, 'Untitled'), /Parent folder/);
        assert.equal(h.files.has('A/Sub/Untitled.md'), false);
    } finally { await h.close(); }
});

test('creation leaves no container tooltip target while preserving button tooltips and accessible names', async () => {
    const h = await harness();
    try {
        h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/未命名.md'));
        for (const [selector, label] of [['.fpv-tree', '文件列表'], ['.fpv-bar', '文件区切换'], ['.fpv-toolbar', '文件区']]) {
            const container = h.el.querySelector(selector)!;
            assert.equal(container.closest('[aria-label]'), null);
            assert.equal(container.hasAttribute('title'), false);
            const name = h.dom.window.document.getElementById(container.getAttribute('aria-labelledby')!);
            assert.equal(name?.textContent, label); assert.equal(name?.hidden, true);
        }
        assert.equal(h.tool(0).getAttribute('aria-label'), '新建笔记');
        h.plugin.data.language = 'en'; h.plugin.refreshLanguage();
        const tree = h.el.querySelector('.fpv-tree')!;
        assert.equal(h.dom.window.document.getElementById(tree.getAttribute('aria-labelledby')!)?.textContent, 'Files');
        assert.equal(tree.hasAttribute('aria-label'), false);
    } finally { await h.close(); }
});

test('accessible container labels remain unique with multiple open views', async () => {
    const h = await harness();
    const leaf = h.app.workspace.getLeftLeaf(true); await leaf.setViewState({ type: 'folder-pin-view' });
    try {
        const containers = [...h.dom.window.document.querySelectorAll('[aria-labelledby]')];
        const ids = containers.map(el => el.getAttribute('aria-labelledby'));
        assert.equal(ids.length, 8); assert.equal(new Set(ids).size, 8);
        for (const id of ids) assert.ok(h.dom.window.document.getElementById(id!)?.textContent);
    } finally { await leaf.view.onClose(); await h.close(); }
});

test('switching pins displays selected contents and keeps pin/toolbar DOM nodes', async () => {
    const h = await harness();
    try {
        const first = h.pin('A'), toolbar = h.tool(0); h.pin('B').click();
        assert.ok(h.row('B/other.md')); assert.equal(h.row('A/one.md'), undefined);
        assert.equal(h.pin('B').getAttribute('aria-selected'), 'true'); assert.equal(h.pin('A'), first); assert.equal(h.tool(0), toolbar);
    } finally { await h.close(); }
});
test('ordinary file-open updates highlight without rebuilding tree or resetting scroll', async () => {
    const h = await harness();
    try {
        const row = h.row('A/one.md'); const tree = h.el.querySelector<HTMLElement>('.fpv-tree')!;
        tree.scrollTop = 180; h.el.querySelector<HTMLElement>('.fpv-bar')!.scrollLeft = 80;
        await h.app.workspace.getLeaf(false).openFile(h.files.get('A/one.md') as TFile);
        assert.equal(h.row('A/one.md'), row); assert.ok(row.classList.contains('is-active'));
        assert.equal(tree.scrollTop, 180); assert.equal(h.el.querySelector<HTMLElement>('.fpv-bar')!.scrollLeft, 80);
    } finally { await h.close(); }
});
test('each region restores its own scroll and collapse does not affect another region', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').click(); const tree = h.el.querySelector<HTMLElement>('.fpv-tree')!; tree.scrollTop = 120;
        h.pin('B').click(); h.row('B/Deep').click(); tree.scrollTop = 75;
        h.pin('A').click(); assert.equal(tree.scrollTop, 120); h.tool(4).click();
        assert.deepEqual(getZone(h.plugin.data, 'A').expanded, []); assert.deepEqual(getZone(h.plugin.data, 'B').expanded, ['B/Deep']);
        h.pin('B').click(); assert.equal(tree.scrollTop, 75);
    } finally { await h.close(); }
});
test('six-option native menu records selection and Chinese context menus are translated', async () => {
    const h = await harness();
    try {
        h.tool(2).click(); assert.equal(Menu.last!.items.length, 6); assert.equal(Menu.last!.separators, 2);
        assert.equal(Menu.last!.items[0].checked, true); Menu.last!.items[2].action(); assert.equal(h.plugin.data.sortOrder, 'mtime-desc');
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        assert.deepEqual(Menu.last!.items.map(item => item.title), ['新建笔记', '新建文件夹', '固定文件夹', '重命名', '删除']);
        h.plugin.data.language = 'en'; h.plugin.refreshLanguage(); assert.equal(h.tool(0).getAttribute('aria-label'), 'New note');
    } finally { await h.close(); }
});
test('auto reveal switches only to existing pinned regions and expands the target ancestors', async () => {
    const h = await harness({ autoReveal: true });
    try {
        await h.app.workspace.getLeaf(false).openFile(h.files.get('B/Deep/deeper.md') as TFile);
        assert.equal(h.plugin.data.activeFolderPath, 'B'); assert.ok(h.row('B/Deep/deeper.md').classList.contains('is-active'));
        const external = h.add('Outside/note.md') as TFile; await h.app.workspace.getLeaf(false).openFile(external);
        assert.equal(h.plugin.data.activeFolderPath, 'B'); assert.equal(h.plugin.data.pinnedFolders.length, 3);
    } finally { await h.close(); }
});
test('turning off auto reveal preserves manually selected region', async () => {
    const h = await harness({ autoReveal: true });
    try {
        h.tool(3).click(); await h.app.workspace.getLeaf(false).openFile(h.files.get('B/other.md') as TFile);
        assert.equal(h.plugin.data.activeFolderPath, 'A'); assert.equal(h.tool(3).getAttribute('aria-pressed'), 'false');
    } finally { await h.close(); }
});
test('new notes open immediately with native title rename state and retain editor focus after refresh', async () => {
    const h = await harness();
    try {
        h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/未命名.md'));
        assert.equal(h.app.workspace.opened.length, 1); assert.equal(h.el.querySelector('.fpv-input'), null);
        assert.deepEqual(h.app.workspace.opened[0].options, { active: true, state: { mode: 'source' }, eState: { rename: 'all' } });
        assert.deepEqual(h.app.workspace.titleFocus, [{ rename: 'all' }]);
        assert.equal(h.dom.window.document.activeElement?.className, 'mock-note-title');
        assert.ok(h.row('A/未命名.md').classList.contains('is-active'));
        const focus = h.dom.window.document.activeElement;
        h.view.renderTree(); assert.equal(h.dom.window.document.activeElement, focus);
        assert.equal(h.el.contains(focus), false);
    } finally { await h.close(); }
});

test('new folders exist before naming; Escape and region switch retain the folder', async () => {
    const h = await harness();
    try {
        h.tool(1).click(); await settle();
        assert.ok(h.files.has('A/未命名文件夹')); assert.equal(h.app.workspace.opened.length, 0);
        h.key(h.el.querySelector('.fpv-input')!, 'Escape'); assert.ok(h.row('A/未命名文件夹'));
        h.tool(1).click(); await settle(); h.pin('B').click();
        assert.equal(h.el.querySelector('.fpv-input'), null); assert.ok(h.files.has('A/未命名文件夹 1'));
    } finally { await h.close(); }
});

test('folder naming supports Chinese IME, rejects duplicates and does not double-submit', async () => {
    const h = await harness();
    try {
        h.tool(1).click(); await settle(); const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = '新文件夹'; h.key(input, 'Enter', { isComposing: true }); await settle();
        assert.equal(h.files.has('A/新文件夹'), false);
        input.value = 'Sub'; h.key(input, 'Enter'); await settle(); assert.equal(input.getAttribute('aria-invalid'), 'true');
        input.value = '新文件夹'; h.key(input, 'Enter'); h.key(input, 'Enter'); await settle();
        assert.ok(h.files.has('A/新文件夹')); assert.equal(h.files.has('A/未命名文件夹'), false);
        assert.deepEqual(h.app.fileManager.renamed, ['A/新文件夹']); assert.equal(h.el.querySelector('.fpv-input'), null);
    } finally { await h.close(); }
});

test('rename goes through FileManager and preserves links API contract and extension', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').focus(); h.key(h.row('A/one.md'), 'F2');
        const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!; input.value = 'renamed.md'; h.key(input, 'Enter'); await settle();
        assert.deepEqual(h.app.fileManager.renamed, ['A/renamed.md']); assert.ok(h.row('A/renamed.md'));
        assert.equal(h.dom.window.document.activeElement, h.row('A/renamed.md'));
    } finally { await h.close(); }
});
test('delete respects native confirmation cancellation and native trash API', async () => {
    const h = await harness();
    try {
        const openMenu = () => h.row('A/one.md').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        h.app.fileManager.allowDelete = false; openMenu(); Menu.last!.items.find(item => item.title === '删除')!.action(); await settle();
        assert.ok(h.files.has('A/one.md')); assert.equal(h.app.fileManager.trashed.length, 0);
        h.app.fileManager.allowDelete = true; openMenu(); Menu.last!.items.find(item => item.title === '删除')!.action(); await settle();
        assert.deepEqual(h.app.fileManager.trashed, ['A/one.md']); assert.equal(h.row('A/one.md'), undefined);
    } finally { await h.close(); }
});

test('Shift selects the visible range without opening notes; plain click resets selection', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').click(); await settle();
        const opened = h.app.workspace.opened.length;
        h.row('A/two.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, shiftKey: true }));
        assert.equal(h.app.workspace.opened.length, opened);
        assert.ok(h.row('A/one.md').classList.contains('is-selected'));
        assert.ok(h.row('A/two.md').classList.contains('is-selected'));
        h.row('A/Sub').click();
        assert.equal(h.row('A/one.md').getAttribute('aria-selected'), 'false');
    } finally { await h.close(); }
});

test('Ctrl toggles selection and context menu deletes selected files once each', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').click(); await settle();
        h.row('A/two.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        assert.equal(h.app.workspace.opened.length, 1);
        h.row('A/two.md').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        const deletion = Menu.last!.items.find(item => /删除所选项目 \(2\)/.test(item.title))!;
        deletion.action(); await settle();
        assert.deepEqual(h.app.fileManager.trashed, ['A/one.md', 'A/two.md']);
        assert.equal(Notice.messages.length, 0);
    } finally { await h.close(); }
});

test('selected folder and descendant are deleted once; cancel keeps both', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').click();
        h.row('A/Sub/deep.md').dispatchEvent(new h.dom.window.MouseEvent('click', { bubbles: true, ctrlKey: true }));
        h.app.fileManager.allowDelete = false;
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        Menu.last!.items.find(item => item.title.startsWith('删除所选项目'))!.action(); await settle();
        assert.ok(h.files.has('A/Sub/deep.md')); assert.equal(h.app.fileManager.trashed.length, 0);
        h.app.fileManager.allowDelete = true;
        h.row('A/Sub').dispatchEvent(new h.dom.window.MouseEvent('contextmenu', { bubbles: true }));
        Menu.last!.items.find(item => item.title.startsWith('删除所选项目'))!.action(); await settle();
        assert.deepEqual(h.app.fileManager.trashed, ['A/Sub']);
        assert.equal(Notice.messages.length, 0);
    } finally { await h.close(); }
});

test('settings definitions search both options and preserve their side effects', async () => {
    const h = await harness();
    try {
        const settings = h.plugin.settings[0] as any;
        assert.deepEqual(settings.getSettingDefinitions().map((item: any) => item.name), ['界面语言', '自动显示当前文件', '显示子文件夹快捷栏']);
        settings.setControlValue('language', 'en');
        assert.equal(settings.getControlValue('language'), 'en');
        assert.equal(settings.updates, 1);
        assert.equal(h.tool(0).getAttribute('aria-label'), 'New note');
        settings.setControlValue('autoReveal', true);
        assert.equal(settings.getControlValue('autoReveal'), true);
        assert.equal(h.tool(3).getAttribute('aria-pressed'), 'true');
    } finally { await h.close(); }
});

test('folder rename ignores composition Enter and commits on the next deliberate Enter', async () => {
    const h = await harness();
    try {
        h.tool(1).click(); await settle();
        const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = '中文';
        input.dispatchEvent(new h.dom.window.CompositionEvent('compositionstart', { bubbles: true }));
        h.key(input, 'Enter'); await settle();
        assert.ok(h.files.has('A/未命名文件夹'));
        input.dispatchEvent(new h.dom.window.CompositionEvent('compositionend', { bubbles: true }));
        h.key(input, 'Enter'); await settle();
        assert.ok(h.files.has('A/中文'));
    } finally { await h.close(); }
});

test('Shift plus arrow keys extends selection and changing regions clears it', async () => {
    const h = await harness();
    try {
        h.row('A/one.md').click(); await settle();
        h.key(h.row('A/one.md'), 'ArrowDown', { shiftKey: true });
        assert.equal(h.el.querySelectorAll('.fpv-row.is-selected').length, 2);
        h.pin('B').click(); h.pin('A').click();
        assert.equal(h.el.querySelectorAll('.fpv-row.is-selected').length, 0);
    } finally { await h.close(); }
});
test('keyboard navigation opens folders, moves focus and opens files in a new tab', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').focus(); h.key(h.row('A/Sub'), 'ArrowRight'); assert.ok(h.row('A/Sub/deep.md'));
        h.key(h.row('A/Sub'), 'ArrowRight'); assert.equal(h.dom.window.document.activeElement, h.row('A/Sub/deep.md'));
        h.key(h.row('A/Sub/deep.md'), 'Enter', { ctrlKey: true }); await settle(); assert.equal(h.app.workspace.opened[0].mode, 'tab');
    } finally { await h.close(); }
});
test('external parent rename remaps selected region and deletion falls back to a real region', async () => {
    const h = await harness();
    try {
        h.row('A/Sub').click(); h.el.querySelector<HTMLElement>('.fpv-tree')!.scrollTop = 100;
        await h.app.fileManager.renameFile(h.files.get('A')!, 'Renamed');
        assert.equal(h.plugin.data.activeFolderPath, 'Renamed'); assert.ok(h.row('Renamed/Sub/deep.md'));
        assert.equal(getZone(h.plugin.data).scrollTop, 100);
        await h.app.fileManager.trashFile(h.files.get('Renamed')!); assert.equal(h.plugin.data.activeFolderPath, 'B'); assert.ok(h.row('B/other.md'));
    } finally { await h.close(); }
});
test('root view can create notes before any region is pinned', async () => {
    const h = await harness({ pinnedFolders: [], activeFolderPath: null });
    try {
        h.tool(0).click(); await settle(); assert.ok(h.files.has('未命名.md'));
    } finally { await h.close(); }
});

test('restart restores selected region and its per-region state', async () => {
    const h = await harness({ pinnedFolders: ['A', 'B'], activeFolderPath: 'B', zones: {
        '@A': { expanded: ['A/Sub'], scrollTop: 60 }, '@B': { expanded: ['B/Deep'], scrollTop: 120 },
    } });
    try {
        assert.equal(h.pin('B').getAttribute('aria-selected'), 'true'); assert.ok(h.row('B/Deep/deeper.md'));
        assert.equal(h.el.querySelector<HTMLElement>('.fpv-tree')!.scrollTop, 120);
        h.pin('A').click(); assert.equal(h.el.querySelector<HTMLElement>('.fpv-tree')!.scrollTop, 60);
    } finally { await h.close(); }
});
test('auto-reveal keeps two open views in sync', async () => {
    const h = await harness({ autoReveal: true });
    const leaf = h.app.workspace.getLeftLeaf(true); await leaf.setViewState({ type: 'folder-pin-view' });
    try {
        await h.app.workspace.getLeaf(false).openFile(h.files.get('B/Deep/deeper.md') as TFile);
        for (const view of h.plugin.views()) {
            assert.equal(view.contentEl.querySelector<HTMLElement>('.fpv-pin.is-active')!.dataset.path, 'B');
            assert.ok([...view.contentEl.querySelectorAll<HTMLElement>('.fpv-row')].some(row => row.dataset.path === 'B/Deep/deeper.md'));
        }
    } finally { await leaf.view.onClose(); await h.close(); }
});
test('failed creation reports an error and releases the name for a retry', async () => {
    const h = await harness();
    try {
        const create = h.app.vault.create;
        h.app.vault.create = async () => { throw new Error('Disk full'); };
        h.tool(0).click(); await settle();
        assert.match(Notice.messages[0], /Disk full/); assert.equal(h.files.has('A/未命名.md'), false);
        assert.equal(h.app.workspace.opened.length, 0); assert.equal(h.el.querySelector('.fpv-input'), null);
        h.app.vault.create = create; h.tool(0).click(); await settle();
        assert.ok(h.files.has('A/未命名.md')); assert.equal(h.app.workspace.opened.length, 1);
    } finally { await h.close(); }
});

test('slow settings saves are serialized and the newest snapshot wins', async () => {
    const h = await harness();
    try {
        const writes: string[] = []; let release!: () => void;
        (h.plugin as any).saveData = async (data: any) => {
            if (writes.length === 0) await new Promise<void>(resolve => { release = resolve; });
            writes.push(data.language);
        };
        h.plugin.data.language = 'zh'; h.plugin.flushSave(); await settle();
        h.plugin.data.language = 'en'; h.plugin.flushSave(); await settle();
        assert.equal(writes.length, 0); release(); await settle();
        assert.deepEqual(writes, ['zh', 'en']);
    } finally { await h.close(); }
});
