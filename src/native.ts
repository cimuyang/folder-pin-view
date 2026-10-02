import { App, TAbstractFile, TFile, TFolder } from 'obsidian';

// Core drag/search internals are kept here; the rest of the view uses public APIs.
// These signatures match the native file explorer. Check capabilities before use.
interface NativeDragManager {
    draggable: unknown;
    dragFile(event: DragEvent, file: TFile): unknown;
    dragFolder(event: DragEvent, folder: TFolder): unknown;
    dragFiles(event: DragEvent, files: TAbstractFile[]): unknown;
    onDragStart(event: DragEvent, payload: unknown): void;
    onDragEnd(): void;
    updateSource?(elements: HTMLElement[], className: string): void;
}

interface NativeApp {
    dragManager?: NativeDragManager;
    internalPlugins?: { getEnabledPluginById(id: string): unknown };
}

export const FILE_MENU_SOURCE = 'file-explorer-context-menu';

export function startNativeDrag(app: App, event: DragEvent, files: TAbstractFile[], elements: HTMLElement[]): (() => void) | null {
    const manager = (app as App & NativeApp).dragManager;
    if (!event.dataTransfer || !files.length || !manager || typeof manager.onDragStart !== 'function'
        || typeof manager.onDragEnd !== 'function' || typeof manager.dragFiles !== 'function'
        || typeof manager.dragFile !== 'function' || typeof manager.dragFolder !== 'function') return null;
    const first = files[0];
    const payload = files.length > 1 ? manager.dragFiles(event, files)
        : first instanceof TFile ? manager.dragFile(event, first) : manager.dragFolder(event, first as TFolder);
    if (!payload) return null;
    try {
        manager.updateSource?.(elements, 'is-being-dragged');
        manager.onDragStart(event, payload);
    } catch (error) {
        if (manager.draggable === payload) manager.onDragEnd();
        throw error;
    }
    return () => { if (manager.draggable === payload) manager.onDragEnd(); };
}

export function searchAvailable(app: App): boolean {
    const plugins = (app as App & NativeApp).internalPlugins;
    return !!plugins && typeof plugins.getEnabledPluginById === 'function' && !!plugins.getEnabledPluginById('global-search');
}

export function folderSearchQuery(path: string): string {
    // Anchor to the vault-relative path and include the slash: A must not match AB or Other/A.
    const escaped = path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    return `path:/^${escaped}\\// ()`;
}

export async function openFolderSearch(app: App, path: string): Promise<void> {
    const query = folderSearchQuery(path);
    const leaf = await app.workspace.ensureSideLeaf('search', 'left', { active: true, reveal: true, state: { query } });
    // Keep OR terms inside the group while retaining the native search UI and syntax.
    const input = leaf.view.containerEl.querySelector<HTMLInputElement>('.search-row input');
    if (input && input.value === query) {
        input.focus();
        input.setSelectionRange(query.length - 1, query.length - 1);
    }
}
