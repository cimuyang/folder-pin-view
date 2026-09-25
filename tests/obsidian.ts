// Small public-API test double. Used only by the test/visual harness, never shipped.
export function installDom(win: Window & typeof globalThis): void {
    const proto = win.HTMLElement.prototype as any;
    proto.empty = function () { this.replaceChildren(); };
    proto.addClass = function (...names: string[]) { this.classList.add(...names); };
    proto.removeClass = function (...names: string[]) { this.classList.remove(...names); };
    proto.toggleClass = function (name: string, value: boolean) { this.classList.toggle(name, value); };
    proto.setText = function (text: string) { this.textContent = text; };
    proto.createEl = function (tag: string, info: any = {}) {
        const el = this.ownerDocument.createElement(tag);
        if (typeof info === 'string') info = { cls: info };
        if (info.cls) el.className = info.cls;
        if (info.text) el.textContent = info.text;
        if (info.type) el.type = info.type;
        if (info.value) el.value = info.value;
        for (const [key, value] of Object.entries(info.attr ?? {})) el.setAttribute(key, String(value));
        this.append(el);
        return el;
    };
    proto.createDiv = function (info: any) { return this.createEl('div', info); };
    proto.createSpan = function (info: any) { return this.createEl('span', info); };
    Object.defineProperty(proto, 'doc', { get() { return this.ownerDocument; }, configurable: true });
    Object.defineProperty(proto, 'win', { get() { return this.ownerDocument.defaultView; }, configurable: true });
}
export let appLanguage = 'zh';
export function getLanguage() { return appLanguage; }
export function setLanguage(value: string) { appLanguage = value; }
const icons: Record<string, string> = {
    'square-pen': '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M16 3l5 5M10 14l1-5 8-8 4 4-8 8z"/>',
    'folder-plus': '<path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2ZM12 10v7M8.5 13.5h7"/>',
    'arrow-up-narrow-wide': '<path d="m3 8 4-4 4 4M7 4v16M14 5h2M14 10h4M14 15h6M14 20h8"/>',
    'gallery-vertical': '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M3 2h18"/>',
    'chevrons-up-down': '<path d="m7 8 5-5 5 5M7 16l5 5 5-5"/>',
    'chevrons-down-up': '<path d="m7 3 5 5 5-5M7 21l5-5 5 5"/>',
    'chevron-right': '<path d="m9 5 7 7-7 7"/>',
};
export function setIcon(el: HTMLElement, icon: string): void {
    el.dataset.icon = icon;
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' + (icons[icon] ?? '') + '</svg>';
}
export function setTooltip(el: HTMLElement, label: string): void { el.setAttribute('aria-label', label); el.title = label; }
export class Notice { static messages: string[] = []; constructor(message: string) { Notice.messages.push(message); } }
export class Events {
    listeners = new Map<string, Set<(...args: any[]) => void>>();
    on(name: string, callback: (...args: any[]) => void) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name)!.add(callback);
        return { off: () => this.listeners.get(name)?.delete(callback) };
    }
    trigger(name: string, ...args: any[]) { this.listeners.get(name)?.forEach(fn => fn(...args)); }
}
export class TAbstractFile {
    parent: TFolder | null = null;
    constructor(public path: string) {}
    get name() { return this.path.split('/').pop() ?? ''; }
}
export class TFile extends TAbstractFile {
    stat = { mtime: 0, ctime: 0, size: 0 };
    get extension() { return this.name.includes('.') ? this.name.split('.').pop()! : ''; }
    get basename() { return this.extension ? this.name.slice(0, -(this.extension.length + 1)) : this.name; }
}
export class TFolder extends TAbstractFile { children: TAbstractFile[] = []; isRoot() { return this.path === '/'; } }
export class ItemView {
    app: any; contentEl: HTMLElement;
    cleanup: (() => void)[] = [];
    constructor(public leaf: any) {
        this.app = leaf.app;
        const container = document.createElement('div');
        container.className = 'workspace-leaf-content';
        container.dataset.type = 'folder-pin-view';
        this.contentEl = document.createElement('div'); this.contentEl.className = 'view-content';
        container.append(this.contentEl); document.body.append(container);
    }
    registerDomEvent(el: HTMLElement, type: string, callback: EventListener, options?: any) {
        el.addEventListener(type, callback, options);
        this.cleanup.push(() => el.removeEventListener(type, callback, options));
    }
}
export class Plugin {
    saved: any = null; savedSnapshots: any[] = []; events: any[] = []; settings: any[] = [];
    constructor(public app: any, public manifest: any = {}) {}
    async loadData() { return this.saved; }
    async saveData(data: any) { this.saved = data; this.savedSnapshots.push(data); }
    registerView(type: string, factory: any) { this.app.workspace.factories.set(type, factory); }
    registerEvent(ref: any) { this.events.push(ref); }
    addRibbonIcon(_icon: string, _title: string, _handler: any) { return document.createElement('button'); }
    addCommand(_command: any) {}
    addSettingTab(tab: any) { this.settings.push(tab); }
}
export class PluginSettingTab { containerEl = document.createElement('div'); constructor(public app: any, public plugin: any) {} }
export class Setting {
    constructor(_el: HTMLElement) {}
    setName(_name: string) { return this; } setDesc(_desc: string) { return this; }
    addDropdown(_cb: any) { return this; } addToggle(_cb: any) { return this; }
}
class MenuItem {
    title = ''; checked = false; action: () => any = () => {};
    setTitle(value: string) { this.title = value; return this; }
    setIcon(_icon: string) { return this; }
    setWarning(_value: boolean) { return this; }
    setChecked(value: boolean) { this.checked = value; return this; }
    onClick(action: () => any) { this.action = action; return this; }
}
export class Menu {
    static last: Menu | null = null;
    items: MenuItem[] = []; separators = 0;
    addItem(callback: (item: MenuItem) => any) { const item = new MenuItem(); callback(item); this.items.push(item); return this; }
    addSeparator() { this.separators++; return this; }
    showAtMouseEvent(event: MouseEvent) { this.showAtPosition({ x: event.clientX, y: event.clientY }); }
    showAtPosition(pos: { x: number; y: number }) {
        Menu.last = this;
        // Rendering is used only for the browser preview; test assertions use items.
        document.querySelector('.mock-menu')?.remove();
        const el = document.createElement('div'); el.className = 'mock-menu';
        el.style.left = pos.x + 'px'; el.style.top = pos.y + 'px';
        this.items.forEach(item => {
            const button = document.createElement('button');
            button.textContent = item.title + (item.checked ? '  ✓' : '');
            button.addEventListener('click', () => { item.action(); el.remove(); }); el.append(button);
        });
        document.body.append(el);
    }
}
export class WorkspaceLeaf {}
export class App {}

export function createApp() {
    const root = new TFolder('/');
    const files = new Map<string, TAbstractFile>([['/', root]]);
    const vault = Object.assign(new Events(), {
        getRoot: () => root,
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        createFolder: async (path: string) => add(path, true),
        create: async (path: string, _content: string) => add(path, false),
    });
    function add(path: string, folder = false): TAbstractFile {
        if (files.has(path)) throw new Error('Already exists');
        const parentPath = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '/';
        let parent = files.get(parentPath);
        if (!parent) parent = add(parentPath, true);
        if (!(parent instanceof TFolder)) throw new Error('Missing parent');
        const file = folder ? new TFolder(path) : new TFile(path);
        file.parent = parent; parent.children.push(file); files.set(path, file); vault.trigger('create', file);
        return file;
    }
    const workspace = Object.assign(new Events(), {
        factories: new Map<string, any>(), leaves: [] as any[], active: null as TFile | null,
        opened: [] as { file: TFile; mode: any; options: any }[], layoutCallback: () => {},
        getActiveFile: () => workspace.active,
        getLeavesOfType: (type: string) => workspace.leaves.filter(leaf => leaf.type === type),
        onLayoutReady: (cb: () => void) => { workspace.layoutCallback = cb; },
        revealLeaf: async (_leaf: any) => {},
        getLeaf: (mode: any) => ({ openFile: async (file: TFile, options?: any) => {
            workspace.active = file; workspace.opened.push({ file, mode, options });
            // Model focus transfer only, not Obsidian's private title editor behavior.
            let editor = document.querySelector<HTMLTextAreaElement>('.mock-note-editor');
            if (!editor) { editor = document.createElement('textarea'); editor.className = 'mock-note-editor'; document.body.append(editor); }
            editor.focus();
            workspace.trigger('file-open', file);
        } }),
        getLeftLeaf: (_split: boolean) => {
            const leaf: any = { app, type: '', view: null, setViewState: async (state: any) => {
                leaf.type = state.type; leaf.view = workspace.factories.get(state.type)(leaf); await leaf.view.onOpen();
            } };
            workspace.leaves.push(leaf); return leaf;
        },
    });
    const manager = {
        allowDelete: true, renamed: [] as string[], trashed: [] as string[],
        promptForDeletion: async (_file: TAbstractFile) => manager.allowDelete,
        trashFile: async (file: TAbstractFile) => {
            manager.trashed.push(file.path);
            for (const [path] of files) if (path === file.path || path.startsWith(file.path + '/')) files.delete(path);
            if (file.parent) file.parent.children = file.parent.children.filter(child => child !== file);
            vault.trigger('delete', file);
        },
        renameFile: async (file: TAbstractFile, path: string) => {
            const old = file.path; manager.renamed.push(path);
            for (const [key, child] of [...files]) if (key === old || key.startsWith(old + '/')) {
                files.delete(key); child.path = path + key.slice(old.length); files.set(child.path, child);
            }
            vault.trigger('rename', file, old);
        },
    };
    const app = { vault, workspace, fileManager: manager };
    return { app, add, files };
}
