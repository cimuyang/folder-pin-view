import { App, getLanguage, Notice, Plugin, PluginSettingTab, TFile, TFolder } from 'obsidian';
import type { SettingDefinitionItem } from 'obsidian';
import { normalizeData, PluginData, remapData, removePath, zoneKey } from './model';
import { resolveLanguage, TextKey, translate } from './i18n';
import { FolderPinView, VIEW_TYPE } from './view';

export default class FolderPinPlugin extends Plugin {
    data: PluginData = normalizeData(null);
    private saveTimer: number | undefined;
    private refreshTimer: number | undefined;
    private writeQueue: Promise<void> = Promise.resolve();
    private stopping = false;
    private ribbon: HTMLElement | undefined;
    get language(): 'zh' | 'en' { return resolveLanguage(this.data.language, getLanguage()); }
    t = (key: TextKey): string => translate(this.language, key);

    async onload(): Promise<void> {
        this.data = normalizeData(await this.loadData());
        this.registerView(VIEW_TYPE, leaf => new FolderPinView(leaf, this));
        this.ribbon = this.addRibbonIcon('pin', this.t('title'), () => { void this.activateView(); });
        this.addCommand({ id: 'open-view', name: this.t('openView'), callback: () => { void this.activateView(); } });
        this.addCommand({ id: 'reveal-active-file', name: this.t('reveal'), callback: () => {
            void this.activateView().then(() => this.views().forEach(view => view.revealActive()));
        } });
        this.addSettingTab(new FolderPinSettings(this.app, this));
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file, source) => {
            if (source === VIEW_TYPE || !(file instanceof TFolder) || file.isRoot()) return;
            const pinned = this.data.pinnedFolders.includes(file.path);
            menu.addItem(item => item.setTitle(this.t(pinned ? 'unpin' : 'pin')).setIcon('pin')
                .onClick(() => { void this.setPinned(file.path, !pinned); }));
        }));
        this.registerEvent(this.app.vault.on('create', () => this.scheduleRefresh()));
        this.registerEvent(this.app.vault.on('delete', file => {
            this.views().forEach(view => view.captureScroll());
            removePath(this.data, file.path);
            this.persist();
            this.refreshViews();
        }));
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            this.views().forEach(view => view.captureScroll());
            remapData(this.data, oldPath, file.path);
            this.persist();
            this.refreshViews();
        }));
        this.registerEvent(this.app.vault.on('modify', file => {
            if (file instanceof TFile && this.data.sortOrder.startsWith('mtime')) this.scheduleRefresh();
        }));
        this.registerEvent(this.app.workspace.on('file-open', () => this.views().forEach(view => view.activeFileChanged())));
        this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.views().forEach(view => view.activeFileChanged())));
        this.app.workspace.onLayoutReady(() => {
            if (this.stopping) return;
            for (const path of [...this.data.pinnedFolders]) {
                if (!(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)) removePath(this.data, path);
            }
            for (const zone of Object.values(this.data.zones))
                zone.expanded = zone.expanded.filter(path => this.app.vault.getAbstractFileByPath(path) instanceof TFolder);
            this.refreshViews();
            if (!this.views().length) void this.activateView(false);
            this.persist();
        });
    }
    views(): FolderPinView[] {
        return this.app.workspace.getLeavesOfType(VIEW_TYPE)
            .map(leaf => leaf.view).filter((view): view is FolderPinView => view instanceof FolderPinView);
    }
    async activateView(reveal = true): Promise<void> {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
        if (!leaf) {
            const created = this.app.workspace.getLeftLeaf(true);
            if (!created) return;
            leaf = created;
            await leaf.setViewState({ type: VIEW_TYPE, active: reveal });
        }
        if (reveal) await this.app.workspace.revealLeaf(leaf);
    }
    async setPinned(path: string, pinned: boolean): Promise<void> {
        if (pinned && !(this.app.vault.getAbstractFileByPath(path) instanceof TFolder)) return;
        this.views().forEach(view => view.captureScroll());
        const index = this.data.pinnedFolders.indexOf(path);
        if (pinned) {
            if (index === -1) this.data.pinnedFolders.push(path);
            this.data.activeFolderPath = path;
        } else {
            if (index === -1) return;
            this.data.pinnedFolders.splice(index, 1);
            delete this.data.zones[zoneKey(path)];
            if (this.data.activeFolderPath === path)
                this.data.activeFolderPath = this.data.pinnedFolders[Math.min(index, this.data.pinnedFolders.length - 1)] ?? null;
        }
        this.persist();
        this.refreshViews();
        if (pinned) await this.activateView();
    }
    refreshViews(): void { this.views().forEach(view => view.sync()); }
    refreshLanguage(): void {
        this.ribbon?.setAttribute('aria-label', this.t('title'));
        this.views().forEach(view => view.localize());
        this.persist();
    }
    private scheduleRefresh(): void {
        if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = undefined;
            if (!this.stopping) this.views().forEach(view => view.renderTree());
        }, 100);
    }
    persist = (): void => {
        if (this.stopping) return;
        if (this.saveTimer !== undefined) window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => { this.saveTimer = undefined; this.flushSave(); }, 200);
    };
    // Serialize snapshots so a slow previous write cannot overwrite newer settings.
    flushSave(): void {
        if (this.saveTimer !== undefined) { window.clearTimeout(this.saveTimer); this.saveTimer = undefined; }
        const snapshot = JSON.parse(JSON.stringify(this.data)) as PluginData;
        this.writeQueue = this.writeQueue.then(() => this.saveData(snapshot)).catch(error => {
            console.error('[folder-pin-view] Settings save failed', error);
            new Notice(this.t('saveFailed'));
        });
    }
    onunload(): void {
        this.stopping = true;
        if (this.refreshTimer !== undefined) window.clearTimeout(this.refreshTimer);
        this.views().forEach(view => view.captureScroll());
        this.flushSave();
    }
}

class FolderPinSettings extends PluginSettingTab {
    constructor(app: App, private plugin: FolderPinPlugin) { super(app, plugin); }
    getSettingDefinitions(): SettingDefinitionItem[] {
        return [
            { name: this.plugin.t('language'), desc: this.plugin.t('languageDesc'),
                control: { type: 'dropdown', key: 'language', options: {
                    auto: this.plugin.t('followApp'), zh: '简体中文', en: 'English',
                } } },
            { name: this.plugin.t('autoReveal'), desc: this.plugin.t('autoRevealDesc'),
                control: { type: 'toggle', key: 'autoReveal' } },
        ];
    }
    getControlValue(key: string): unknown {
        if (key === 'language') return this.plugin.data.language;
        if (key === 'autoReveal') return this.plugin.data.autoReveal;
        return undefined;
    }
    setControlValue(key: string, value: unknown): void {
        if (key === 'language') {
            this.plugin.data.language = value === 'zh' || value === 'en' ? value : 'auto';
            this.plugin.refreshLanguage();
            this.update();
        } else if (key === 'autoReveal') {
            this.plugin.data.autoReveal = value === true;
            this.plugin.persist();
            this.plugin.views().forEach(view => {
                view.updateToolbar();
                if (this.plugin.data.autoReveal) view.revealActive();
            });
        }
    }
}
