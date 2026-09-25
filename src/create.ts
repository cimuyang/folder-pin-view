import { TFile, TFolder, Vault } from 'obsidian';
import { entryPath } from './model';

// Shared across views: reserve a name before the asynchronous vault write starts.
const reservations = new WeakMap<Vault, Set<string>>();

export async function createUntitled(vault: Vault, parent: TFolder, folder: boolean, name: string): Promise<TFile | TFolder> {
    let pending = reservations.get(vault);
    if (!pending) reservations.set(vault, pending = new Set());
    for (let suffix = 0; ; suffix++) {
        if (vault.getAbstractFileByPath(parent.path) !== parent) throw new Error('Parent folder no longer exists.');
        const path = entryPath(parent.path, name + (suffix ? ` ${suffix}` : ''), folder ? '' : 'md');
        if (pending.has(path) || vault.getAbstractFileByPath(path)) continue;
        pending.add(path);
        try {
            return folder ? await vault.createFolder(path) : await vault.create(path, '');
        } catch (error) {
            // Another plugin or sync may have claimed the name during the write.
            if (!vault.getAbstractFileByPath(path)) throw error;
        } finally {
            pending.delete(path);
        }
    }
}
