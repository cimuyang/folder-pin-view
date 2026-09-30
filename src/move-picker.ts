import { App, FuzzySuggestModal, TFolder } from 'obsidian';
import { planMove } from './move';

/** A public-API picker shared by single and batch moves; cancellation has no side effects. */
export class MoveFolderModal extends FuzzySuggestModal<TFolder> {
    constructor(app: App, private paths: string[], private rootLabel: string, placeholder: string,
        private choose: (target: TFolder) => void) {
        super(app);
        this.setPlaceholder(placeholder);
    }
    getItems(): TFolder[] {
        return [...new Set([this.app.vault.getRoot(), ...this.app.vault.getAllLoadedFiles()])].filter((file): file is TFolder => file instanceof TFolder)
            .filter(folder => { const plan = planMove(this.app.vault, this.paths, folder); return !plan.error && plan.moves.length > 0; })
            .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    }
    getItemText(folder: TFolder): string { return folder.isRoot() ? this.rootLabel : folder.path; }
    onChooseItem(folder: TFolder): void { this.choose(folder); }
}
