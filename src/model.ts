export const SORT_ORDERS = ['name-asc', 'name-desc', 'mtime-desc', 'mtime-asc', 'ctime-desc', 'ctime-asc'] as const;
export type SortOrder = typeof SORT_ORDERS[number];
export type Language = 'auto' | 'zh' | 'en';
export interface ZoneState { expanded: string[]; scrollTop: number }
export interface PluginData {
    version: 3;
    pinnedFolders: string[];
    activeFolderPath: string | null;
    sortOrder: SortOrder;
    language: Language;
    autoReveal: boolean;
    zones: Record<string, ZoneState>;
}

const record = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const paths = (v: unknown): string[] => Array.isArray(v)
    ? [...new Set(v.filter((p): p is string => typeof p === 'string' && p.length > 0 && p !== '/' && !p.split('/').some(s => !s || s === '.' || s === '..')))] : [];
export const zoneKey = (path: string | null): string => '@' + (path ?? '');
export const containsPath = (folder: string | null, path: string): boolean =>
    !folder || path === folder || path.startsWith(folder + '/');

export function normalizeData(raw: unknown): PluginData {
    const input = record(raw);
    const pins = paths(input.pinnedFolders);
    const active = typeof input.activeFolderPath === 'string' && pins.includes(input.activeFolderPath)
        ? input.activeFolderPath : pins[0] ?? null;
    const sortOrder = SORT_ORDERS.includes(input.sortOrder as SortOrder) ? input.sortOrder as SortOrder
        : input.sortOrder === 'desc' ? 'name-desc' : 'name-asc';
    const data: PluginData = {
        version: 3, pinnedFolders: pins, activeFolderPath: active, sortOrder,
        language: input.language === 'zh' || input.language === 'en' ? input.language : 'auto',
        autoReveal: input.autoReveal === true, zones: Object.create(null) as Record<string, ZoneState>,
    };
    for (const path of [null, ...pins]) {
        const saved = record(record(input.zones)[zoneKey(path)]);
        data.zones[zoneKey(path)] = {
            expanded: paths(saved.expanded ?? input.expandedFolders).filter(p => containsPath(path, p) && p !== path),
            scrollTop: typeof saved.scrollTop === 'number' && Number.isFinite(saved.scrollTop) ? Math.max(0, saved.scrollTop) : 0,
        };
    }
    return data;
}

export function getZone(data: PluginData, path = data.activeFolderPath): ZoneState {
    return data.zones[zoneKey(path)] ?? (data.zones[zoneKey(path)] = { expanded: [], scrollTop: 0 });
}

export function revealZone(pins: string[], current: string | null, file: string): string | null | undefined {
    if (current !== null && containsPath(current, file)) return current;
    if (!pins.length) return null;
    // Prefer the most specific pinned ancestor when switching regions.
    return pins.filter(p => containsPath(p, file)).sort((a, b) => b.length - a.length)[0];
}

export function ancestorPaths(file: string, root: string | null): string[] {
    const parents: string[] = [];
    let path = file.slice(0, file.lastIndexOf('/'));
    if (!file.includes('/')) return parents;
    while (path && path !== root && containsPath(root, path)) {
        parents.unshift(path);
        const index = path.lastIndexOf('/');
        if (index < 0) break;
        path = path.slice(0, index);
    }
    return parents;
}

export function remapData(data: PluginData, oldPath: string, newPath: string): void {
    const remap = (p: string) => containsPath(oldPath, p) ? newPath + p.slice(oldPath.length) : p;
    data.pinnedFolders = [...new Set(data.pinnedFolders.map(remap))];
    if (data.activeFolderPath) data.activeFolderPath = remap(data.activeFolderPath);
    const zones: Record<string, ZoneState> = Object.create(null) as Record<string, ZoneState>;
    for (const [key, state] of Object.entries(data.zones)) {
        const root = remap(key.slice(1)) || null;
        zones[zoneKey(root)] = { ...state, expanded: state.expanded.map(remap).filter(p => containsPath(root, p) && p !== root) };
    }
    data.zones = zones;
}

export function removePath(data: PluginData, path: string): void {
    const oldIndex = data.pinnedFolders.indexOf(data.activeFolderPath ?? '');
    data.pinnedFolders = data.pinnedFolders.filter(p => !containsPath(path, p));
    if (data.activeFolderPath && containsPath(path, data.activeFolderPath))
        data.activeFolderPath = data.pinnedFolders[Math.min(oldIndex, data.pinnedFolders.length - 1)] ?? null;
    for (const [key, zone] of Object.entries(data.zones)) {
        if (containsPath(path, key.slice(1))) delete data.zones[key];
        else zone.expanded = zone.expanded.filter(p => !containsPath(path, p));
    }
}

export interface SortEntry { name: string; folder: boolean; mtime?: number; ctime?: number }
export function comparator(order: SortOrder, locale: string): (a: SortEntry, b: SortEntry) => number {
    const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    const nameCompare = (a: SortEntry, b: SortEntry) => collator.compare(a.name, b.name) || a.name.localeCompare(b.name);
    return (a, b) => {
        if (a.folder !== b.folder) return a.folder ? -1 : 1;
        if (a.folder || order.startsWith('name')) return nameCompare(a, b) * (order === 'name-desc' ? -1 : 1);
        const field = order.startsWith('mtime') ? 'mtime' : 'ctime';
        const diff = (a[field] ?? 0) - (b[field] ?? 0);
        return (order.endsWith('desc') ? -diff : diff) || nameCompare(a, b);
    };
}

export function validName(name: string): boolean {
    return !!name && name === name.trim() && !/[<>:"/\\|?*\u0000-\u001f]/.test(name)
        && !/[. ]$/.test(name) && name !== '.' && name !== '..'
        && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}
export function entryPath(parent: string, name: string, extension = ''): string {
    const suffix = extension && !name.toLowerCase().endsWith('.' + extension.toLowerCase()) ? '.' + extension : '';
    return (parent && parent !== '/' ? parent + '/' : '') + name + suffix;
}

// Pure geometry keeps the selected tab visible without centering/jumping unnecessarily.
export function revealScroll(scroll: number, viewport: number, start: number, width: number): number {
    if (viewport <= 0) return scroll;
    if (start < scroll) return Math.max(0, start);
    if (start + width > scroll + viewport) return Math.max(0, start + Math.min(width, viewport) - viewport);
    return scroll;
}
