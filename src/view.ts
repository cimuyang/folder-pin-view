import { ItemView, Menu, Notice, setIcon, setTooltip, TAbstractFile, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import type FolderPinPlugin from './main';
import { ancestorPaths, comparator, containsPath, entryPath, getZone, revealScroll, revealZone, SORT_ORDERS, validName, zoneKey } from './model';
import type { TextKey } from './i18n';
import { createUntitled } from './create';
import { planMove } from './move';

export const VIEW_TYPE = 'folder-pin-view';
let nextLabelId = 0;
interface EditorState { el: HTMLElement; input: HTMLInputElement; busy: boolean; commit: () => Promise<void> }

export class FolderPinView extends ItemView {
    private toolbar!: HTMLElement;
    private pinBar!: HTMLElement;
    private tree!: HTMLElement;
    private containerLabels: { el: HTMLElement; key: TextKey }[] = [];
    private pinSignature = '';
    private rows = new Map<string, HTMLElement>();
    private visible: TAbstractFile[] = [];
    private focusedPath: string | null = null;
    private selectedPaths = new Set<string>();
    private selectionAnchor: string | null = null;
    private renderedZone: string | null = null;
    private lastActive: string | null = null;
    private dragPath: string | null = null;
    private fileDrag: string[] | null = null;
    private collapseButton!: HTMLButtonElement;
    private followButton!: HTMLButtonElement;
    private editor: EditorState | null = null;
    private creationId = 0;
    private openingPath: string | null = null;
    private deletingPaths = new Set<string>();
    private frame: number | undefined;
    private closed = false;
    private lastLanguage = '';

    constructor(leaf: WorkspaceLeaf, private plugin: FolderPinPlugin) { super(leaf); }
    get data() { return this.plugin.data; }
    private t = (key: TextKey): string => this.plugin.t(key);
    getViewType(): string { return VIEW_TYPE; }
    getDisplayText(): string { return this.t('title'); }
    getIcon(): string { return 'pin'; }

    async onOpen(): Promise<void> {
        this.closed = false;
        this.contentEl.empty();
        this.contentEl.addClass('fpv-root');
        this.toolbar = this.contentEl.createDiv({ cls: 'nav-header fpv-toolbar', attr: { role: 'toolbar' } });
        this.pinBar = this.contentEl.createDiv({ cls: 'fpv-bar', attr: { role: 'tablist' } });
        this.tree = this.contentEl.createDiv({ cls: 'fpv-tree', attr: { role: 'tree', tabindex: '0' } });
        this.containerLabels = [];
        // Obsidian treats aria-label as a hover tooltip. Structural containers
        // need accessible names, but should not show a panel-sized tooltip.
        for (const [container, key] of [[this.toolbar, 'title'], [this.pinBar, 'regions'], [this.tree, 'files']] as const) {
            const id = `fpv-label-${++nextLabelId}`;
            const label = this.contentEl.createSpan({ attr: { id, hidden: '' } });
            container.setAttribute('aria-labelledby', id);
            this.containerLabels.push({ el: label, key });
        }
        this.registerDomEvent(this.tree, 'scroll', () => { this.captureScroll(); this.plugin.persist(); });
        this.registerDomEvent(this.tree, 'keydown', event => this.onTreeKey(event));
        this.registerDomEvent(this.tree, 'contextmenu', event => {
            if (event.target === this.tree || (event.target as HTMLElement).closest('.fpv-empty')) {
                event.preventDefault();
                this.creationMenu(new Menu(), this.rootPath()).showAtMouseEvent(event);
            }
        });
        this.registerDomEvent(this.pinBar, 'wheel', event => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || this.pinBar.scrollWidth <= this.pinBar.clientWidth) return;
            const old = this.pinBar.scrollLeft;
            this.pinBar.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.pinBar.clientWidth : 1);
            if (old !== this.pinBar.scrollLeft) event.preventDefault();
        }, { passive: false });
        this.registerDomEvent(this.pinBar, 'scroll', () => this.updateOverflow());
        this.localize();
        if (this.data.autoReveal) this.revealActive();
    }
    async onClose(): Promise<void> {
        this.creationId++;
        this.captureScroll();
        this.closed = true;
        this.clearFileDrag();
        if (this.frame !== undefined) this.contentEl.win.cancelAnimationFrame(this.frame);
        this.cancelEditor();
        this.plugin.flushSave();
    }
    onResize(): void { this.schedulePinReveal(); }
    localize(): void {
        if (!this.tree) return;
        this.lastLanguage = this.plugin.language;
        this.containerLabels.forEach(({ el, key }) => el.setText(this.t(key)));
        this.buildToolbar();
        this.sync();
    }
    sync(): void {
        if (!this.tree || this.closed) return;
        if (this.lastLanguage !== this.plugin.language) { this.localize(); return; }
        if (this.renderedZone !== zoneKey(this.data.activeFolderPath) && !this.editor?.busy) {
            this.creationId++;
            this.cancelEditor();
        }
        this.renderPins();
        this.renderTree(false);
    }
    private tool(icon: string, key: TextKey, handler: (event: MouseEvent) => void): HTMLButtonElement {
        const button = this.toolbar.createEl('button', { cls: 'clickable-icon nav-action-button fpv-tool', attr: { type: 'button' } });
        setIcon(button, icon);
        setTooltip(button, this.t(key));
        button.addEventListener('click', handler);
        return button;
    }
    private buildToolbar(): void {
        this.toolbar.empty();
        this.tool('square-pen', 'newNote', () => { void this.startCreate(false, this.rootPath()); });
        this.tool('folder-plus', 'newFolder', () => { void this.startCreate(true, this.rootPath()); });
        const sort = this.tool('arrow-up-narrow-wide', 'sort', () => {
            const menu = new Menu();
            SORT_ORDERS.forEach((order, index) => {
                if (index === 2 || index === 4) menu.addSeparator();
                menu.addItem(item => item.setTitle(this.t(order)).setChecked(this.data.sortOrder === order).onClick(() => {
                    this.data.sortOrder = order;
                    this.plugin.persist();
                    this.plugin.views().forEach(view => view.renderTree());
                }));
            });
            const rect = sort.getBoundingClientRect();
            menu.showAtPosition({ x: rect.left, y: rect.bottom });
        });
        this.followButton = this.tool('gallery-vertical', 'autoReveal', () => {
            this.data.autoReveal = !this.data.autoReveal;
            this.plugin.persist();
            this.plugin.views().forEach(view => {
                view.updateToolbar();
                if (this.data.autoReveal) view.revealActive();
            });
        });
        this.collapseButton = this.tool('chevrons-up-down', 'expand', () => this.toggleAll());
        this.updateToolbar();
    }
    updateToolbar(): void {
        if (!this.collapseButton) return;
        this.followButton.toggleClass('is-active', this.data.autoReveal);
        this.followButton.setAttribute('aria-pressed', String(this.data.autoReveal));
        const hasExpanded = getZone(this.data).expanded.length > 0;
        setIcon(this.collapseButton, hasExpanded ? 'chevrons-down-up' : 'chevrons-up-down');
        setTooltip(this.collapseButton, this.t(hasExpanded ? 'collapse' : 'expand'));
    }
    private rootPath(): string { return this.data.activeFolderPath ?? ''; }
    private rootFolder(): TFolder | null {
        const root = this.data.activeFolderPath ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath) : this.app.vault.getRoot();
        return root instanceof TFolder ? root : null;
    }
    private renderPins(): void {
        const signature = JSON.stringify([this.data.pinnedFolders, this.plugin.language]);
        if (signature !== this.pinSignature) {
            const scroll = this.pinBar.scrollLeft;
            const hadFocus = this.pinBar.contains(this.contentEl.doc.activeElement);
            this.pinBar.empty();
            this.pinSignature = signature;
            this.data.pinnedFolders.forEach(path => {
                const button = this.pinBar.createEl('button', {
                    cls: 'fpv-pin', text: path.split('/').pop() || path,
                    attr: { type: 'button', role: 'tab', draggable: 'true', 'data-path': path, 'aria-label': path },
                });
                setTooltip(button, path);
                button.addEventListener('click', () => this.selectRegion(path));
                button.addEventListener('contextmenu', event => {
                    event.preventDefault();
                    new Menu().addItem(item => item.setTitle(this.t('unpin')).setIcon('pin-off')
                        .onClick(() => { void this.plugin.setPinned(path, false); })).showAtMouseEvent(event);
                });
                button.addEventListener('keydown', event => {
                    const pins = this.data.pinnedFolders;
                    let index = pins.indexOf(path);
                    if (event.key === 'ArrowLeft') index = (index + pins.length - 1) % pins.length;
                    else if (event.key === 'ArrowRight') index = (index + 1) % pins.length;
                    else if (event.key === 'Home') index = 0;
                    else if (event.key === 'End') index = pins.length - 1;
                    else return;
                    event.preventDefault();
                    this.selectRegion(pins[index]);
                    this.activePin()?.focus({ preventScroll: true });
                });
                button.addEventListener('dragstart', event => {
                    this.clearFileDrag();
                    this.dragPath = path;
                    button.addClass('is-dragging');
                    event.dataTransfer?.setData('text/plain', path);
                    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
                });
                button.addEventListener('dragend', () => {
                    this.dragPath = null;
                    this.pinBar.querySelectorAll('.is-dragging, .drag-over').forEach(el => el.classList.remove('is-dragging', 'drag-over'));
                });
                button.addEventListener('dragover', event => {
                    if (this.fileDrag) return;
                    if (!this.dragPath || this.dragPath === path) return;
                    event.preventDefault();
                    button.addClass('drag-over');
                });
                button.addEventListener('dragleave', () => button.removeClass('drag-over'));
                button.addEventListener('drop', event => {
                    if (this.fileDrag) return;
                    event.preventDefault();
                    const from = this.data.pinnedFolders.indexOf(this.dragPath ?? '');
                    const to = this.data.pinnedFolders.indexOf(path);
                    this.dragPath = null;
                    button.removeClass('drag-over');
                    if (from < 0 || to < 0 || from === to) return;
                    const [moved] = this.data.pinnedFolders.splice(from, 1);
                    this.data.pinnedFolders.splice(to, 0, moved);
                    this.plugin.persist();
                    this.plugin.views().forEach(view => view.renderPins());
                });
                this.attachMoveTarget(button, () => this.app.vault.getAbstractFileByPath(path));
            });
            this.pinBar.scrollLeft = scroll;
            this.updatePinSelection();
            if (hadFocus) this.activePin()?.focus({ preventScroll: true });
        } else this.updatePinSelection();
        this.pinBar.hidden = this.data.pinnedFolders.length === 0;
        this.schedulePinReveal();
    }
    private updatePinSelection(): void {
        this.pinBar.querySelectorAll<HTMLButtonElement>('.fpv-pin').forEach(button => {
            const selected = button.dataset.path === this.data.activeFolderPath;
            button.toggleClass('is-active', selected);
            button.setAttribute('aria-selected', String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
    }
    private activePin(): HTMLButtonElement | null { return this.pinBar.querySelector('.fpv-pin.is-active'); }
    private schedulePinReveal(): void {
        if (!this.pinBar || this.closed) return;
        if (this.frame !== undefined) this.contentEl.win.cancelAnimationFrame(this.frame);
        this.frame = this.contentEl.win.requestAnimationFrame(() => {
            this.frame = undefined;
            const button = this.activePin();
            if (button) {
                const bar = this.pinBar.getBoundingClientRect();
                const rect = button.getBoundingClientRect();
                const start = rect.left - bar.left + this.pinBar.scrollLeft;
                this.pinBar.scrollLeft = revealScroll(this.pinBar.scrollLeft, this.pinBar.clientWidth, start - 8, rect.width + 16);
            }
            this.updateOverflow();
        });
    }
    private updateOverflow(): void {
        this.pinBar.toggleClass('has-before', this.pinBar.scrollLeft > 1);
        this.pinBar.toggleClass('has-after', this.pinBar.scrollLeft + this.pinBar.clientWidth < this.pinBar.scrollWidth - 1);
    }
    private selectRegion(path: string): void {
        if (this.editor?.busy || !this.data.pinnedFolders.includes(path)) return;
        this.creationId++;
        this.captureScroll();
        this.cancelEditor();
        this.data.activeFolderPath = path;
        this.focusedPath = null;
        this.selectedPaths.clear();
        this.selectionAnchor = null;
        this.plugin.persist();
        this.plugin.refreshViews();
    }
    captureScroll(): void {
        if (!this.tree || this.renderedZone === null) return;
        const zone = this.data.zones[this.renderedZone];
        if (zone) zone.scrollTop = this.tree.scrollTop;
    }
    renderTree(capture = true): void {
        if (!this.tree || this.closed || this.editor) return;
        if (capture) this.captureScroll();
        const hadFocus = this.tree.contains(this.contentEl.doc.activeElement);
        const previousIndex = this.visible.findIndex(file => file.path === this.focusedPath);
        this.tree.empty();
        this.rows.clear();
        this.visible = [];
        this.renderedZone = zoneKey(this.data.activeFolderPath);
        const root = this.rootFolder();
        if (root) {
            const expanded = new Set(getZone(this.data).expanded);
            const compare = comparator(this.data.sortOrder, this.plugin.language === 'zh' ? 'zh-CN' : 'en');
            const sortInfo = (file: TAbstractFile) => ({ name: file.name, folder: file instanceof TFolder,
                mtime: file instanceof TFile ? file.stat.mtime : 0, ctime: file instanceof TFile ? file.stat.ctime : 0 });
            const stack: { file: TAbstractFile; depth: number; index: number; count: number }[] = [];
            const pushChildren = (folder: TFolder, depth: number) => {
                const sorted = [...folder.children].sort((a, b) => compare(sortInfo(a), sortInfo(b)));
                for (let index = sorted.length - 1; index >= 0; index--)
                    stack.push({ file: sorted[index], depth, index, count: sorted.length });
            };
            pushChildren(root, 0);
            while (stack.length) {
                const { file, depth, index, count } = stack.pop()!;
                this.drawRow(file, depth, index, count, expanded.has(file.path));
                if (file instanceof TFolder && expanded.has(file.path)) pushChildren(file, depth + 1);
            }
        }
        if (!this.visible.length) this.tree.createDiv({ cls: 'fpv-empty', text: root ? this.t('empty') : this.t('missing') });
        const visiblePaths = new Set(this.visible.map(file => file.path));
        this.selectedPaths = new Set([...this.selectedPaths].filter(path => visiblePaths.has(path)));
        if (this.selectionAnchor && !visiblePaths.has(this.selectionAnchor)) this.selectionAnchor = null;
        if (!this.data.pinnedFolders.length) this.tree.createDiv({ cls: 'fpv-empty fpv-hint', text: this.t('pinHint') });
        this.tree.scrollTop = getZone(this.data).scrollTop;
        if (!this.focusedPath || !this.rows.has(this.focusedPath)) {
            const active = this.app.workspace.getActiveFile()?.path;
            this.focusedPath = active && this.rows.has(active) ? active
                : this.visible[Math.max(0, Math.min(previousIndex, this.visible.length - 1))]?.path ?? null;
        }
        this.updateHighlight();
        this.updateSelection();
        this.updateTabStops();
        if (hadFocus) this.focusRow(this.focusedPath, false);
        this.updateToolbar();
    }
    private drawRow(file: TAbstractFile, depth: number, index: number, count: number, expanded: boolean): void {
        const folder = file instanceof TFolder;
        const row = this.tree.createDiv({ cls: 'tree-item-self fpv-row' + (folder ? ' fpv-folder' : ' fpv-file'),
            attr: { role: 'treeitem', tabindex: '-1', draggable: 'true', 'data-path': file.path, 'aria-level': String(depth + 1),
                'aria-posinset': String(index + 1), 'aria-setsize': String(count) } });
        row.style.setProperty('--fpv-depth', String(depth));
        const arrow = row.createSpan({ cls: 'fpv-arrow', attr: { 'aria-hidden': 'true' } });
        if (folder) { setIcon(arrow, 'chevron-right'); row.setAttribute('aria-expanded', String(expanded)); }
        row.createSpan({ cls: 'fpv-name', text: file instanceof TFile && file.extension.toLowerCase() === 'md' ? file.basename : file.name });
        setTooltip(row, file.path);
        this.rows.set(file.path, row);
        this.visible.push(file);
        row.addEventListener('dragstart', event => {
            if (this.editor || !event.dataTransfer) { event.preventDefault(); return; }
            this.dragPath = null;
            this.fileDrag = this.selectedPaths.has(file.path) ? [...this.selectedPaths] : [file.path];
            event.dataTransfer.setData('application/x-folder-pin-view', file.path);
            event.dataTransfer.effectAllowed = 'move';
            this.fileDrag.forEach(path => this.rows.get(path)?.addClass('is-dragging'));
        });
        row.addEventListener('dragend', () => this.clearFileDrag());
        if (folder) this.attachMoveTarget(row, () => this.app.vault.getAbstractFileByPath(file.path));
        row.addEventListener('focus', () => { this.focusedPath = file.path; this.updateTabStops(); });
        row.addEventListener('click', event => {
            if (this.editor) return;
            this.focusedPath = file.path;
            if (event.shiftKey) {
                this.selectRange(file.path, event.ctrlKey || event.metaKey);
                row.focus({ preventScroll: true });
                return;
            }
            if (event.ctrlKey || event.metaKey) {
                this.toggleSelection(file.path);
                row.focus({ preventScroll: true });
                return;
            }
            this.selectOnly(file.path);
            if (folder) { row.focus({ preventScroll: true }); this.toggleFolder(file.path); }
            else if (file instanceof TFile) void this.openFile(file);
        });
        row.addEventListener('auxclick', event => {
            if (event.button === 1 && file instanceof TFile) { event.preventDefault(); void this.openFile(file, true); }
        });
        row.addEventListener('contextmenu', event => {
            event.preventDefault(); event.stopPropagation();
            if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
            this.focusedPath = file.path;
            row.focus({ preventScroll: true });
            this.fileMenu(file).showAtMouseEvent(event);
        });
    }
    private clearFileDrag(): void {
        this.fileDrag = null;
        this.contentEl.querySelectorAll('.fpv-drop-target, .fpv-drop-invalid, .fpv-row.is-dragging')
            .forEach(el => el.classList.remove('fpv-drop-target', 'fpv-drop-invalid', 'is-dragging'));
    }
    private attachMoveTarget(element: HTMLElement, getTarget: () => TAbstractFile | null): void {
        element.addEventListener('dragover', event => {
            if (!this.fileDrag) return;
            event.preventDefault();
            const target = getTarget();
            const plan = target instanceof TFolder ? planMove(this.app.vault, this.fileDrag, target) : null;
            element.toggleClass('fpv-drop-target', !!plan && !plan.error && plan.moves.length > 0);
            element.toggleClass('fpv-drop-invalid', !plan || !!plan.error);
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
        });
        element.addEventListener('dragleave', event => {
            if (event.relatedTarget && element.contains(event.relatedTarget as Node)) return;
            element.removeClass('fpv-drop-target', 'fpv-drop-invalid');
        });
        element.addEventListener('drop', event => {
            if (!this.fileDrag) return;
            event.preventDefault();
            event.stopPropagation();
            const paths = this.fileDrag;
            this.clearFileDrag();
            const target = getTarget();
            if (!(target instanceof TFolder)) { this.reportError(this.t('missing')); return; }
            void this.moveToFolder(paths, target);
        });
    }
    private async moveToFolder(paths: string[], target: TFolder): Promise<void> {
        const plan = planMove(this.app.vault, paths, target);
        if (plan.error) { this.reportError(this.t(plan.error)); return; }
        if (!plan.moves.length) return;
        try {
            for (const move of plan.moves) {
                const { file, from } = move;
                if (this.app.vault.getAbstractFileByPath(from) !== file) throw new Error(this.t('missing'));
                const current = planMove(this.app.vault, [from], target);
                if (current.error) throw new Error(this.t(current.error));
                if (!current.moves.length) { move.path = file.path; continue; }
                move.path = current.moves[0].path;
                await this.app.fileManager.renameFile(file, move.path);
            }
            if (this.closed) return;
            const region = this.data.pinnedFolders.includes(target.path) ? target.path : this.data.activeFolderPath;
            if (region !== this.data.activeFolderPath) {
                this.captureScroll();
                this.data.activeFolderPath = region;
            }
            if (containsPath(region, target.path)) {
                const zone = getZone(this.data);
                zone.expanded = [...new Set([...zone.expanded, ...ancestorPaths(plan.moves[0].path, region), target.path])];
                this.focusedPath = plan.moves[0].path;
                this.selectedPaths = new Set(plan.moves.map(move => move.path));
                this.selectionAnchor = plan.moves[0].path;
            }
            this.plugin.persist();
            this.plugin.refreshViews();
            const row = this.rows.get(plan.moves[0].path);
            if (row) this.revealRow(row);
        } catch (error) { this.reportError(error); }
    }
    private toggleFolder(path: string, open?: boolean): void {
        const zone = getZone(this.data);
        const expanded = new Set(zone.expanded);
        if (open ?? !expanded.has(path)) expanded.add(path); else expanded.delete(path);
        zone.expanded = [...expanded];
        this.plugin.persist();
        this.renderTree();
    }
    private toggleAll(): void {
        if (this.editor) return;
        const zone = getZone(this.data);
        if (zone.expanded.length) zone.expanded = [];
        else {
            const root = this.rootFolder();
            const stack = root ? [...root.children] : [];
            while (stack.length) {
                const file = stack.pop();
                if (file instanceof TFolder) { zone.expanded.push(file.path); for (const child of file.children) stack.push(child); }
            }
        }
        this.plugin.persist();
        this.renderTree();
    }
    activeFileChanged(): void {
        if (!this.tree || this.closed) return;
        const current = this.app.workspace.getActiveFile()?.path ?? null;
        this.updateHighlight();
        if (!current || current === this.lastActive) return;
        if (current !== this.openingPath) this.creationId++;
        this.lastActive = current;
        if (this.data.autoReveal && !this.editor) this.revealActive();
    }
    revealActive(): void {
        const file = this.app.workspace.getActiveFile();
        if (!file || this.editor || this.closed) return;
        const target = revealZone(this.data.pinnedFolders, this.data.activeFolderPath, file.path);
        if (target === undefined) return;
        const switched = target !== this.data.activeFolderPath;
        if (switched) { this.captureScroll(); this.data.activeFolderPath = target; this.renderPins(); }
        const zone = getZone(this.data);
        const expanded = new Set(zone.expanded);
        const size = expanded.size;
        ancestorPaths(file.path, target).forEach(path => expanded.add(path));
        zone.expanded = [...expanded];
        if (switched || size !== expanded.size || this.renderedZone !== zoneKey(target)) {
            this.renderPins();
            this.renderTree(!switched);
        }
        if (switched) this.plugin.views().forEach(view => { if (view !== this) view.sync(); });
        this.updateHighlight();
        const row = this.rows.get(file.path);
        if (row) this.revealRow(row);
        this.lastActive = file.path;
        this.plugin.persist();
    }
    private updateHighlight(): void {
        const path = this.app.workspace.getActiveFile()?.path;
        this.rows.forEach((row, rowPath) => {
            row.toggleClass('is-active', rowPath === path);
        });
    }
    private updateTabStops(): void {
        this.tree.tabIndex = this.rows.size ? -1 : 0;
        this.rows.forEach((row, path) => { row.tabIndex = path === this.focusedPath ? 0 : -1; });
    }
    private revealRow(row: HTMLElement): void {
        const viewport = this.tree.getBoundingClientRect();
        const rect = row.getBoundingClientRect();
        if (rect.top < viewport.top) this.tree.scrollTop -= viewport.top - rect.top;
        else if (rect.bottom > viewport.bottom) this.tree.scrollTop += rect.bottom - viewport.bottom;
        this.captureScroll();
    }
    private focusRow(path: string | null, reveal = true): void {
        this.focusedPath = path;
        this.updateTabStops();
        const row = path ? this.rows.get(path) : null;
        (row ?? this.tree).focus({ preventScroll: true });
        if (row && reveal) this.revealRow(row);
    }
    private updateSelection(): void {
        this.rows.forEach((row, path) => {
            const selected = this.selectedPaths.has(path);
            row.toggleClass('is-selected', selected);
            row.setAttribute('aria-selected', String(selected));
        });
    }
    private selectOnly(path: string): void {
        this.selectedPaths = new Set([path]);
        this.selectionAnchor = path;
        this.updateSelection();
    }
    private toggleSelection(path: string): void {
        if (this.selectedPaths.has(path)) this.selectedPaths.delete(path);
        else this.selectedPaths.add(path);
        this.selectionAnchor = path;
        this.updateSelection();
    }
    private selectRange(path: string, add = false): void {
        const end = this.visible.findIndex(file => file.path === path);
        const start = this.visible.findIndex(file => file.path === this.selectionAnchor);
        if (start < 0 || end < 0) { this.selectOnly(path); return; }
        const selected = add ? new Set(this.selectedPaths) : new Set<string>();
        for (let index = Math.min(start, end); index <= Math.max(start, end); index++) selected.add(this.visible[index].path);
        this.selectedPaths = selected;
        this.updateSelection();
    }
    private onTreeKey(event: KeyboardEvent): void {
        if (this.editor || event.isComposing) return;
        const index = this.visible.findIndex(file => file.path === this.focusedPath);
        const file = this.visible[index];
        if (!file) return;
        let target: TAbstractFile | undefined;
        switch (event.key) {
            case 'ArrowDown': target = this.visible[Math.min(index + 1, this.visible.length - 1)]; break;
            case 'ArrowUp': target = this.visible[Math.max(index - 1, 0)]; break;
            case 'Home': target = this.visible[0]; break;
            case 'End': target = this.visible[this.visible.length - 1]; break;
            case 'ArrowRight':
                if (file instanceof TFolder) {
                    if (!getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, true);
                    else if (this.visible[index + 1]?.parent === file) target = this.visible[index + 1];
                }
                break;
            case 'ArrowLeft':
                if (file instanceof TFolder && getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, false);
                else if (file.parent && this.rows.has(file.parent.path)) target = file.parent;
                break;
            case 'Enter':
                if (file instanceof TFile) void this.openFile(file, event.ctrlKey || event.metaKey);
                else this.toggleFolder(file.path);
                break;
            case 'F2': this.startRename(file); break;
            case 'ContextMenu': this.showKeyboardMenu(file); break;
            case 'F10': if (event.shiftKey) this.showKeyboardMenu(file); else return; break;
            default: return;
        }
        event.preventDefault();
        if (target) {
            if (event.shiftKey) this.selectRange(target.path, event.ctrlKey || event.metaKey);
            else this.selectOnly(target.path);
            this.focusRow(target.path);
        }
    }
    private showKeyboardMenu(file: TAbstractFile): void {
        const rect = this.rows.get(file.path)?.getBoundingClientRect();
        if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
        if (rect) this.fileMenu(file).showAtPosition({ x: rect.left + 24, y: rect.bottom });
    }
    private async openFile(file: TFile, newTab = false): Promise<void> {
        try { await this.app.workspace.getLeaf(newTab ? 'tab' : false).openFile(file); }
        catch (error) { this.reportError(error); }
    }
    private creationMenu(menu: Menu, parent: string): Menu {
        return menu.addItem(item => item.setTitle(this.t('newNote')).setIcon('square-pen').onClick(() => { void this.startCreate(false, parent); }))
            .addItem(item => item.setTitle(this.t('newFolder')).setIcon('folder-plus').onClick(() => { void this.startCreate(true, parent); }));
    }
    private fileMenu(file: TAbstractFile): Menu {
        const menu = new Menu();
        const selected = this.selectedPaths.size > 1 && this.selectedPaths.has(file.path);
        if (selected) {
            menu.addItem(item => item.setTitle(this.t('deleteSelected') + ` (${this.selectedPaths.size})`).setIcon('trash-2').setWarning(true)
                .onClick(() => { void this.deleteSelected(); }));
            this.app.workspace.trigger('file-menu', menu, file, VIEW_TYPE, this.leaf);
            return menu;
        }
        if (file instanceof TFolder) {
            this.creationMenu(menu, file.path);
            const pinned = this.data.pinnedFolders.includes(file.path);
            menu.addItem(item => item.setTitle(this.t(pinned ? 'unpin' : 'pin')).setIcon(pinned ? 'pin-off' : 'pin')
                .onClick(() => { void this.plugin.setPinned(file.path, !pinned); }));
        } else if (file instanceof TFile) {
            menu.addItem(item => item.setTitle(this.t('openTab')).setIcon('file-plus').onClick(() => { void this.openFile(file, true); }));
        }
        menu.addSeparator();
        menu.addItem(item => item.setTitle(this.t('rename')).setIcon('pencil').onClick(() => this.startRename(file)));
        menu.addItem(item => item.setTitle(this.t('delete')).setIcon('trash-2').setWarning(true).onClick(() => { void this.deleteFile(file); }));
        this.app.workspace.trigger('file-menu', menu, file, VIEW_TYPE, this.leaf);
        return menu;
    }
    private async deleteFile(file: TAbstractFile): Promise<void> {
        if (this.deletingPaths.has(file.path)) return;
        this.deletingPaths.add(file.path);
        try {
            if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t('missing'));
            await this.app.fileManager.promptForDeletion(file);
        } catch (error) { this.reportError(error); }
        finally { this.deletingPaths.delete(file.path); }
    }
    private async deleteSelected(): Promise<void> {
        const paths = [...this.selectedPaths];
        for (const path of paths) {
            // Deleting a selected folder also removes selected descendants.
            if (paths.some(other => other !== path && containsPath(other, path))) continue;
            const file = this.app.vault.getAbstractFileByPath(path);
            if (file) await this.deleteFile(file);
        }
    }
    private reportError(error: unknown): void {
        new Notice(this.t('operationFailed') + ': ' + (error instanceof Error ? error.message : String(error)));
    }
    private async startCreate(folder: boolean, parentPath: string): Promise<void> {
        if (this.closed || this.editor?.busy) return;
        this.cancelEditor();
        this.renderTree();
        const parent = !parentPath || parentPath === '/' ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(parentPath);
        if (!(parent instanceof TFolder)) { this.reportError(this.t('missing')); return; }
        if (!containsPath(this.data.activeFolderPath, parent.path === '/' ? '' : parent.path)) return;
        const id = ++this.creationId;
        const region = this.data.activeFolderPath;
        try {
            const created = await createUntitled(this.app.vault, parent, folder, this.t(folder ? 'untitledFolder' : 'untitled'));
            // A completed write must not pull the user back after they moved on.
            if (this.closed || id !== this.creationId || region !== this.data.activeFolderPath) return;
            if (this.app.vault.getAbstractFileByPath(created.path) !== created || !containsPath(region, created.path)) return;
            const zone = getZone(this.data);
            zone.expanded = [...new Set([...zone.expanded, ...ancestorPaths(created.path, region)])];
            this.focusedPath = created.path;
            this.renderTree();
            const row = this.rows.get(created.path);
            if (row) this.revealRow(row);
            this.plugin.persist();
            if (created instanceof TFile) {
                const leaf = this.app.workspace.getLeaf(false);
                this.openingPath = created.path;
                try {
                    await leaf.openFile(created, {
                        active: true, state: { mode: 'source' }, eState: { rename: 'all' },
                    });
                    if (id === this.creationId && this.app.workspace.getActiveFile() === created) {
                        // The view may focus the body while finishing the open transition.
                        leaf.setEphemeralState({ rename: 'all' });
                    }
                } finally {
                    this.openingPath = null;
                }
            } else this.startRename(created);
        } catch (error) {
            this.reportError(error);
        }
    }
    private startRename(file: TAbstractFile): void {
        if (this.editor?.busy) return;
        this.creationId++;
        this.cancelEditor();
        this.renderTree();
        const row = this.rows.get(file.path);
        if (!row) return;
        const host = this.tree.createDiv('fpv-editor-row');
        host.style.setProperty('--fpv-depth', row.style.getPropertyValue('--fpv-depth'));
        row.after(host);
        row.hidden = true;
        const initial = file instanceof TFile && file.extension ? file.basename : file.name;
        this.beginEditor(host, initial, async value => {
            if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t('missing'));
            const path = entryPath(file.parent?.path ?? '', value, file instanceof TFile ? file.extension : '');
            if (path === file.path) return;
            const existing = this.app.vault.getAbstractFileByPath(path);
            if (existing && existing !== file) throw new Error(this.t('exists'));
            await this.app.fileManager.renameFile(file, path);
            this.focusedPath = path;
        });
    }
    private beginEditor(host: HTMLElement, initial: string, action: (value: string) => Promise<void>): void {
        const input = host.createEl('input', { cls: 'fpv-input', type: 'text', value: initial,
            attr: { 'aria-label': this.t('rename'), spellcheck: 'false' } });
        this.tree.querySelectorAll<HTMLElement>('.fpv-empty').forEach(el => { el.hidden = true; });
        const error = host.createDiv({ cls: 'fpv-input-message', text: this.t('editHint'), attr: { role: 'status', 'aria-live': 'polite' } });
        const editor: EditorState = { el: host, input, busy: false, commit: async () => {
            if (editor.busy || this.editor !== editor) return;
            const value = input.value.trim();
            if (!validName(value)) {
                error.setText(this.t('invalidName')); input.setAttribute('aria-invalid', 'true'); input.focus(); return;
            }
            editor.busy = true;
            input.disabled = true;
            try {
                await action(value);
                if (this.editor !== editor || this.closed) return;
                this.editor = null;
                host.remove();
                this.renderTree();
                const row = this.focusedPath ? this.rows.get(this.focusedPath) : null;
                if (row) this.revealRow(row);
                this.focusRow(this.focusedPath, false);
                this.plugin.persist();
            } catch (failure) {
                if (this.editor !== editor || this.closed) return;
                editor.busy = false;
                input.disabled = false;
                error.setText(this.t('operationFailed') + ': ' + (failure instanceof Error ? failure.message : String(failure)));
                input.setAttribute('aria-invalid', 'true'); input.focus();
            }
        } };
        this.editor = editor;
        input.addEventListener('keydown', event => {
            event.stopPropagation();
            if (event.isComposing || composing) return;
            if (event.key === 'Enter') { event.preventDefault(); void editor.commit(); }
            else if (event.key === 'Escape' && !editor.busy) {
                event.preventDefault(); this.cancelEditor(); this.renderTree(); this.focusRow(this.focusedPath, false);
            }
        });
        let composing = false;
        input.addEventListener('compositionstart', () => { composing = true; });
        input.addEventListener('compositionend', () => { composing = false; });
        // Leaving the editor cancels only the rename; the existing item is retained.
        input.addEventListener('input', () => { input.removeAttribute('aria-invalid'); error.setText(this.t('editHint')); });
        input.focus({ preventScroll: true });
        input.select();
        this.revealRow(host);
    }
    private cancelEditor(): void {
        if (!this.editor) return;
        this.editor.el.remove();
        this.editor = null;
    }
}
