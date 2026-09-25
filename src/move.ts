import { TAbstractFile, TFolder, Vault } from 'obsidian';
import { containsPath, entryPath } from './model';

export type MoveError = 'missing' | 'exists' | 'invalidMove';
export interface Move { file: TAbstractFile; from: string; path: string }

/** Check the whole batch before changing any path. Selected descendants move with their parent. */
export function planMove(vault: Vault, paths: string[], target: TFolder): { moves: Move[]; error?: MoveError } {
    if (vault.getAbstractFileByPath(target.path) !== target) return { moves: [], error: 'missing' };
    const selected = [...new Set(paths)];
    const roots = selected.filter(path => !selected.some(other => other !== path && containsPath(other, path)));
    const moves: Move[] = [];
    const destinations = new Set<string>();
    for (const path of roots) {
        const file = vault.getAbstractFileByPath(path);
        if (!file) return { moves: [], error: 'missing' };
        if (file instanceof TFolder && containsPath(file.path, target.path)) return { moves: [], error: 'invalidMove' };
        if (file.parent === target) continue;
        const destination = entryPath(target.path, file.name);
        const key = destination.normalize('NFC').toLocaleLowerCase();
        if (destinations.has(key) || target.children.some(child => child.name.normalize('NFC').toLocaleLowerCase() === file.name.normalize('NFC').toLocaleLowerCase()))
            return { moves: [], error: 'exists' };
        destinations.add(key);
        moves.push({ file, from: path, path: destination });
    }
    return { moves };
}
