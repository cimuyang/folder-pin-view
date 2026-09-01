import {
    App, ItemView, Menu, Modal, Notice, Plugin, Setting,
    TAbstractFile, TFile, TFolder, WorkspaceLeaf, debounce, setIcon,
} from 'obsidian';

const VIEW_TYPE = 'folder-pin-view';

interface PluginData {
    pinnedFolders: string[];
    activeFolderPath: string | null;
    expandedFolders: string[];
}

const DEFAULT_DATA: PluginData = { pinnedFolders: [], activeFolderPath: null, expandedFolders: [] };

// ── Prompt modal ──────────────────────────────────────────────────────────────

class PromptModal extends Modal {
    private value: string;

    constructor(
        app: App,
        private heading: string,
        private initial: string,
        private onSubmit: (name: string) => void | Promise<void>,
    ) { super(app); this.value = initial; }

    onOpen() {
        this.titleEl.setText(this.heading);
        new Setting(this.contentEl).addText(t => {
            t.setValue(this.initial).onChange(v => (this.value = v));
            t.inputEl.select();
            t.inputEl.focus();
            t.inputEl.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
            });
        });
        new Setting(this.contentEl)
            .addButton(b => b.setButtonText('OK').setCta().onClick(() => this.submit()));
    }

    private submit() {
        const name = this.value.trim();
        if (!name) return;
        this.close();
        this.onSubmit(name);
    }

    onClose() { this.contentEl.empty(); }
}

// ── View ──────────────────────────────────────────────────────────────────────

class FolderPinView extends ItemView {
    private dragIndex = -1;

    constructor(
        leaf: WorkspaceLeaf,
        private data: PluginData,
        private persist: () => void,
    ) { super(leaf); }

    getViewType()    { return VIEW_TYPE; }
    getDisplayText() { return 'Folder Pin'; }
    getIcon()        { return 'pin'; }

    async onOpen()  { this.contentEl.addClass('fpv-root'); this.draw(); }
    async onClose() {}

    refresh = debounce(() => this.draw(), 100, true);

    draw() {
        this.contentEl.empty();
        this.drawPinBar();

        const tree = this.contentEl.createDiv('fpv-tree');
        tree.addEventListener('contextmenu', e => {
            if (e.target === tree) this.showRootMenu(e);
        });

        const target = this.data.activeFolderPath
            ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath)
            : this.app.vault.getRoot();

        if (target instanceof TFolder) this.drawFolder(tree, target);
        else tree.createDiv({ cls: 'fpv-empty', text: 'Right-click a folder and choose "Pin folder".' });
    }

    // ── pin bar ──

    private drawPinBar() {
        const bar = this.contentEl.createDiv('fpv-bar');
        this.data.pinnedFolders.forEach((path, idx) => {
            const btn = bar.createEl('button', {
                cls: 'fpv-btn',
                text: path.split('/').pop() || path,
                title: path,
                attr: { draggable: 'true' },
            });
            if (path === this.data.activeFolderPath) btn.addClass('is-active');

            btn.addEventListener('click', () => {
                this.data.activeFolderPath = path;
                this.persist();
                this.draw();
            });
            btn.addEventListener('contextmenu', e => {
                e.preventDefault();
                new Menu()
                    .addItem(i => i.setTitle('Unpin').setIcon('x').onClick(() => this.unpin(path)))
                    .showAtMouseEvent(e);
            });

            // drag-to-reorder
            btn.addEventListener('dragstart', () => { this.dragIndex = idx; btn.addClass('is-dragging'); });
            btn.addEventListener('dragend',   () => { this.dragIndex = -1;  btn.removeClass('is-dragging'); });
            btn.addEventListener('dragover',  e => { e.preventDefault(); btn.addClass('drag-over'); });
            btn.addEventListener('dragleave', () => btn.removeClass('drag-over'));
            btn.addEventListener('drop', e => {
                e.preventDefault();
                btn.removeClass('drag-over');
                if (this.dragIndex < 0 || this.dragIndex === idx) return;
                const pins = this.data.pinnedFolders;
                const [moved] = pins.splice(this.dragIndex, 1);
                pins.splice(idx, 0, moved);
                this.persist();
                this.draw();
            });
        });
    }

    // ── file tree ──

    private drawFolder(el: HTMLElement, folder: TFolder) {
        const expanded = new Set(this.data.expandedFolders);
        const activePath = this.app.workspace.getActiveFile()?.path;

        const sorted = [...folder.children].sort((a, b) => {
            if ((a instanceof TFolder) !== (b instanceof TFolder)) return a instanceof TFolder ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        for (const child of sorted) {
            if (child instanceof TFolder) {
                const open = expanded.has(child.path);
                const wrap = el.createDiv('fpv-folder');
                const head = wrap.createDiv('fpv-folder-head');
                const arrow = head.createSpan('fpv-arrow');
                setIcon(arrow, open ? 'chevron-down' : 'chevron-right');
                head.createSpan({ text: child.name });

                const body = wrap.createDiv('fpv-folder-body');
                if (open) { body.addClass('is-open'); this.drawFolder(body, child); }

                head.addEventListener('click', () => this.toggle(child.path));
                head.addEventListener('contextmenu', e => this.showFileMenu(e, child));
            } else if (child instanceof TFile) {
                const row = el.createDiv('fpv-file');
                if (child.path === activePath) row.addClass('is-active');
                row.createSpan({ text: child.extension === 'md' ? child.basename : child.name });
                row.addEventListener('click', () => this.app.workspace.getLeaf().openFile(child));
                row.addEventListener('contextmenu', e => this.showFileMenu(e, child));
            }
        }
    }

    private toggle(path: string) {
        const list = this.data.expandedFolders;
        const at = list.indexOf(path);
        if (at >= 0) list.splice(at, 1); else list.push(path);
        this.persist();
        this.draw();
    }

    // ── context menus ──

    private showRootMenu(e: MouseEvent) {
        e.preventDefault();
        if (!this.data.activeFolderPath) return;
        new Menu()
            .addItem(i => i.setTitle('New note').setIcon('file-plus')
                .onClick(() => this.createEntry(false, this.data.activeFolderPath!)))
            .addItem(i => i.setTitle('New folder').setIcon('folder-plus')
                .onClick(() => this.createEntry(true, this.data.activeFolderPath!)))
            .showAtMouseEvent(e);
    }

    private showFileMenu(e: MouseEvent, file: TAbstractFile) {
        e.preventDefault();
        const menu = new Menu();

        if (file instanceof TFolder) {
            const pinned = this.data.pinnedFolders.includes(file.path);
            menu.addItem(i => i
                .setTitle(pinned ? 'Unpin folder' : 'Pin folder').setIcon('pin')
                .onClick(() => pinned ? this.unpin(file.path) : this.pin(file.path)));
            menu.addItem(i => i.setTitle('New note').setIcon('file-plus')
                .onClick(() => this.createEntry(false, file.path)));
            menu.addItem(i => i.setTitle('New folder').setIcon('folder-plus')
                .onClick(() => this.createEntry(true, file.path)));
            menu.addSeparator();
        }

        menu.addItem(i => i.setTitle('Rename').setIcon('pencil').onClick(() => this.renameFile(file)));
        menu.addItem(i => i.setTitle('Delete').setIcon('trash').onClick(() => this.deleteFile(file)));

        menu.showAtMouseEvent(e);
    }

    // ── file operations ──

    private createEntry(isFolder: boolean, parentPath: string) {
        new PromptModal(
            this.app,
            isFolder ? 'New folder' : 'New note',
            isFolder ? 'Folder name' : 'Note name',
            async name => {
                const path = (parentPath ? parentPath + '/' : '') + name + (isFolder ? '' : '.md');
                if (this.app.vault.getAbstractFileByPath(path)) { new Notice('Already exists.'); return; }
                try {
                    if (isFolder) {
                        await this.app.vault.createFolder(path);
                    } else {
                        const file = await this.app.vault.create(path, '');
                        await this.app.workspace.getLeaf().openFile(file);
                    }
                } catch (err) { new Notice('Could not create: ' + String(err)); }
            },
        ).open();
    }

    private renameFile(file: TAbstractFile) {
        const oldName = file instanceof TFile ? file.basename : file.name;
        new PromptModal(this.app, 'Rename', oldName, async newName => {
            const parent = file.parent?.path ?? '';
            const suffix = file instanceof TFile ? '.' + file.extension : '';
            const newPath = (parent ? parent + '/' : '') + newName + suffix;
            try { await this.app.vault.rename(file, newPath); }
            catch (err) { new Notice('Rename failed: ' + String(err)); }
        }).open();
    }

    private async deleteFile(file: TAbstractFile) {
        try { await this.app.fileManager.trashFile(file); }
        catch (err) { new Notice('Delete failed: ' + String(err)); }
    }

    // ── pin management (called by plugin too) ──

    pin(path: string) {
        if (this.data.pinnedFolders.includes(path)) return;
        this.data.pinnedFolders.push(path);
        if (!this.data.activeFolderPath) this.data.activeFolderPath = path;
        this.persist();
        this.draw();
    }

    private unpin(path: string) {
        this.data.pinnedFolders = this.data.pinnedFolders.filter(p => p !== path);
        if (this.data.activeFolderPath === path)
            this.data.activeFolderPath = this.data.pinnedFolders[0] ?? null;
        this.persist();
        this.draw();
    }
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default class FolderPinPlugin extends Plugin {
    data: PluginData = { ...DEFAULT_DATA };
    private save = debounce(() => this.saveData(this.data), 400, true);

    async onload() {
        this.data = Object.assign({ ...DEFAULT_DATA }, await this.loadData() as Partial<PluginData>);

        this.registerView(VIEW_TYPE, leaf =>
            new FolderPinView(leaf, this.data, () => this.save())
        );
        this.addRibbonIcon('pin', 'Folder Pin View', () => this.activateView());

        this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
            if (source === VIEW_TYPE || !(file instanceof TFolder)) return;
            menu.addItem(i => i.setTitle('Pin folder').setIcon('pin')
                .onClick(() => this.getView()?.pin(file.path)));
        }));

        this.registerEvent(this.app.vault.on('create',  ()      => this.refresh()));
        this.registerEvent(this.app.vault.on('delete',  f       => { this.onDelete(f.path); this.refresh(); }));
        this.registerEvent(this.app.vault.on('rename',  (f, old) => { this.onRename(f.path, old); this.refresh(); }));
        this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()));

        this.app.workspace.onLayoutReady(() => this.activateView());
    }

    onunload() {}

    private onDelete(path: string) {
        const gone = (p: string) => p === path || p.startsWith(path + '/');
        this.data.pinnedFolders   = this.data.pinnedFolders.filter(p => !gone(p));
        this.data.expandedFolders = this.data.expandedFolders.filter(p => !gone(p));
        if (this.data.activeFolderPath && gone(this.data.activeFolderPath))
            this.data.activeFolderPath = this.data.pinnedFolders[0] ?? null;
        this.save();
    }

    private onRename(path: string, old: string) {
        const remap = (p: string) =>
            p === old ? path : p.startsWith(old + '/') ? path + p.slice(old.length) : p;
        this.data.pinnedFolders   = this.data.pinnedFolders.map(remap);
        this.data.expandedFolders = this.data.expandedFolders.map(remap);
        if (this.data.activeFolderPath) this.data.activeFolderPath = remap(this.data.activeFolderPath);
        this.save();
    }

    private refresh() { this.getView()?.refresh(); }

    private async activateView() {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
        await this.app.workspace.getLeftLeaf(false)?.setViewState({ type: VIEW_TYPE, active: true });
    }

    private getView(): FolderPinView | null {
        return (this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view as FolderPinView) ?? null;
    }
}
