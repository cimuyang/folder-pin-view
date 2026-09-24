import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { ancestorPaths, comparator, containsPath, entryPath, getZone, normalizeData, remapData, removePath, revealScroll, revealZone, validName } from '../src/model';
import { resolveLanguage, translate } from '../src/i18n';
import FolderPinPlugin from '../src/main';
import { createApp, installDom, Menu, Notice, TFile } from './obsidian';

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

test('creation leaves no container tooltip target while preserving button tooltips and accessible names', async () => {
    const h = await harness();
    try {
        h.tool(0).click(); const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = 'tooltip regression'; h.key(input, 'Enter'); await settle();
        assert.ok(h.files.has('A/tooltip regression.md'));
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
        assert.equal(ids.length, 6); assert.equal(new Set(ids).size, 6);
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
test('inline create supports Chinese IME, rejects duplicate names and does not double-submit', async () => {
    const h = await harness();
    try {
        h.tool(0).click(); const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = '新笔记.md'; h.key(input, 'Enter', { isComposing: true }); await settle();
        assert.equal(h.files.has('A/新笔记.md'), false);
        input.value = 'one'; h.key(input, 'Enter'); await settle(); assert.equal(input.getAttribute('aria-invalid'), 'true');
        input.value = '新笔记.md'; h.key(input, 'Enter'); h.key(input, 'Enter'); await settle();
        assert.ok(h.files.has('A/新笔记.md')); assert.equal(h.files.has('A/新笔记.md.md'), false);
        assert.equal(h.app.workspace.opened.length, 1); assert.equal(h.el.querySelector('.fpv-input'), null);
    } finally { await h.close(); }
});
test('Escape and region switch cancel drafts without creating empty notes', async () => {
    const h = await harness();
    try {
        h.tool(0).click(); h.key(h.el.querySelector('.fpv-input')!, 'Escape'); assert.equal(h.files.has('A/未命名.md'), false);
        h.tool(0).click(); h.pin('B').click(); assert.equal(h.el.querySelector('.fpv-input'), null); assert.equal(h.files.has('A/未命名.md'), false);
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
        h.tool(0).click(); const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = 'root note'; h.key(input, 'Enter'); await settle(); assert.ok(h.files.has('root note.md'));
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
test('failed creation keeps the input and error visible without a half-created note', async () => {
    const h = await harness();
    try {
        h.app.vault.create = async () => { throw new Error('Disk full'); };
        h.tool(0).click(); const input = h.el.querySelector<HTMLInputElement>('.fpv-input')!;
        input.value = 'Will fail'; h.key(input, 'Enter'); await settle();
        assert.equal(input.disabled, false); assert.equal(input.getAttribute('aria-invalid'), 'true');
        assert.match(h.el.querySelector('.fpv-input-message')!.textContent!, /Disk full/); assert.equal(h.files.has('A/Will fail.md'), false);
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
