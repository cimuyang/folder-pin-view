var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FolderPinPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var VIEW_TYPE = "folder-pin-view";
var DEFAULT_DATA = { pinnedFolders: [], activeFolderPath: null, expandedFolders: [] };
var PromptModal = class extends import_obsidian.Modal {
  constructor(app, heading, initial, onSubmit) {
    super(app);
    this.heading = heading;
    this.initial = initial;
    this.onSubmit = onSubmit;
    this.value = initial;
  }
  onOpen() {
    this.titleEl.setText(this.heading);
    new import_obsidian.Setting(this.contentEl).addText((t) => {
      t.setValue(this.initial).onChange((v) => this.value = v);
      t.inputEl.select();
      t.inputEl.focus();
      t.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.submit();
        }
      });
    });
    new import_obsidian.Setting(this.contentEl).addButton((b) => b.setButtonText("OK").setCta().onClick(() => this.submit()));
  }
  submit() {
    const name = this.value.trim();
    if (!name) return;
    this.close();
    this.onSubmit(name);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var FolderPinView = class extends import_obsidian.ItemView {
  constructor(leaf, data, persist) {
    super(leaf);
    this.data = data;
    this.persist = persist;
    this.dragIndex = -1;
    this.refresh = (0, import_obsidian.debounce)(() => this.draw(), 100, true);
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "Folder Pin";
  }
  getIcon() {
    return "pin";
  }
  async onOpen() {
    this.contentEl.addClass("fpv-root");
    this.draw();
  }
  async onClose() {
  }
  draw() {
    this.contentEl.empty();
    this.drawPinBar();
    const tree = this.contentEl.createDiv("fpv-tree");
    tree.addEventListener("contextmenu", (e) => {
      if (e.target === tree) this.showRootMenu(e);
    });
    const target = this.data.activeFolderPath ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath) : this.app.vault.getRoot();
    if (target instanceof import_obsidian.TFolder) this.drawFolder(tree, target);
    else tree.createDiv({ cls: "fpv-empty", text: 'Right-click a folder and choose "Pin folder".' });
  }
  // ── pin bar ──
  drawPinBar() {
    const bar = this.contentEl.createDiv("fpv-bar");
    this.data.pinnedFolders.forEach((path, idx) => {
      const btn = bar.createEl("button", {
        cls: "fpv-btn",
        text: path.split("/").pop() || path,
        title: path,
        attr: { draggable: "true" }
      });
      if (path === this.data.activeFolderPath) btn.addClass("is-active");
      btn.addEventListener("click", () => {
        this.data.activeFolderPath = path;
        this.persist();
        this.draw();
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        new import_obsidian.Menu().addItem((i) => i.setTitle("Unpin").setIcon("x").onClick(() => this.unpin(path))).showAtMouseEvent(e);
      });
      btn.addEventListener("dragstart", () => {
        this.dragIndex = idx;
        btn.addClass("is-dragging");
      });
      btn.addEventListener("dragend", () => {
        this.dragIndex = -1;
        btn.removeClass("is-dragging");
      });
      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
        btn.addClass("drag-over");
      });
      btn.addEventListener("dragleave", () => btn.removeClass("drag-over"));
      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        btn.removeClass("drag-over");
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
  drawFolder(el, folder) {
    var _a;
    const expanded = new Set(this.data.expandedFolders);
    const activePath = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path;
    const sorted = [...folder.children].sort((a, b) => {
      if (a instanceof import_obsidian.TFolder !== b instanceof import_obsidian.TFolder) return a instanceof import_obsidian.TFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of sorted) {
      if (child instanceof import_obsidian.TFolder) {
        const open = expanded.has(child.path);
        const wrap = el.createDiv("fpv-folder");
        const head = wrap.createDiv("fpv-folder-head");
        const arrow = head.createSpan("fpv-arrow");
        (0, import_obsidian.setIcon)(arrow, open ? "chevron-down" : "chevron-right");
        head.createSpan({ text: child.name });
        const body = wrap.createDiv("fpv-folder-body");
        if (open) {
          body.addClass("is-open");
          this.drawFolder(body, child);
        }
        head.addEventListener("click", () => this.toggle(child.path));
        head.addEventListener("contextmenu", (e) => this.showFileMenu(e, child));
      } else if (child instanceof import_obsidian.TFile) {
        const row = el.createDiv("fpv-file");
        if (child.path === activePath) row.addClass("is-active");
        row.createSpan({ text: child.extension === "md" ? child.basename : child.name });
        row.addEventListener("click", () => this.app.workspace.getLeaf().openFile(child));
        row.addEventListener("contextmenu", (e) => this.showFileMenu(e, child));
      }
    }
  }
  toggle(path) {
    const list = this.data.expandedFolders;
    const at = list.indexOf(path);
    if (at >= 0) list.splice(at, 1);
    else list.push(path);
    this.persist();
    this.draw();
  }
  // ── context menus ──
  showRootMenu(e) {
    e.preventDefault();
    if (!this.data.activeFolderPath) return;
    new import_obsidian.Menu().addItem((i) => i.setTitle("New note").setIcon("file-plus").onClick(() => this.createEntry(false, this.data.activeFolderPath))).addItem((i) => i.setTitle("New folder").setIcon("folder-plus").onClick(() => this.createEntry(true, this.data.activeFolderPath))).showAtMouseEvent(e);
  }
  showFileMenu(e, file) {
    e.preventDefault();
    const menu = new import_obsidian.Menu();
    if (file instanceof import_obsidian.TFolder) {
      const pinned = this.data.pinnedFolders.includes(file.path);
      menu.addItem((i) => i.setTitle(pinned ? "Unpin folder" : "Pin folder").setIcon("pin").onClick(() => pinned ? this.unpin(file.path) : this.pin(file.path)));
      menu.addItem((i) => i.setTitle("New note").setIcon("file-plus").onClick(() => this.createEntry(false, file.path)));
      menu.addItem((i) => i.setTitle("New folder").setIcon("folder-plus").onClick(() => this.createEntry(true, file.path)));
      menu.addSeparator();
    }
    menu.addItem((i) => i.setTitle("Rename").setIcon("pencil").onClick(() => this.renameFile(file)));
    menu.addItem((i) => i.setTitle("Delete").setIcon("trash").onClick(() => this.deleteFile(file)));
    menu.showAtMouseEvent(e);
  }
  // ── file operations ──
  createEntry(isFolder, parentPath) {
    new PromptModal(
      this.app,
      isFolder ? "New folder" : "New note",
      isFolder ? "Folder name" : "Note name",
      async (name) => {
        const path = (parentPath ? parentPath + "/" : "") + name + (isFolder ? "" : ".md");
        if (this.app.vault.getAbstractFileByPath(path)) {
          new import_obsidian.Notice("Already exists.");
          return;
        }
        try {
          if (isFolder) {
            await this.app.vault.createFolder(path);
          } else {
            const file = await this.app.vault.create(path, "");
            await this.app.workspace.getLeaf().openFile(file);
          }
        } catch (err) {
          new import_obsidian.Notice("Could not create: " + String(err));
        }
      }
    ).open();
  }
  renameFile(file) {
    const oldName = file instanceof import_obsidian.TFile ? file.basename : file.name;
    new PromptModal(this.app, "Rename", oldName, async (newName) => {
      var _a, _b;
      const parent = (_b = (_a = file.parent) == null ? void 0 : _a.path) != null ? _b : "";
      const suffix = file instanceof import_obsidian.TFile ? "." + file.extension : "";
      const newPath = (parent ? parent + "/" : "") + newName + suffix;
      try {
        await this.app.vault.rename(file, newPath);
      } catch (err) {
        new import_obsidian.Notice("Rename failed: " + String(err));
      }
    }).open();
  }
  async deleteFile(file) {
    try {
      await this.app.fileManager.trashFile(file);
    } catch (err) {
      new import_obsidian.Notice("Delete failed: " + String(err));
    }
  }
  // ── pin management (called by plugin too) ──
  pin(path) {
    if (this.data.pinnedFolders.includes(path)) return;
    this.data.pinnedFolders.push(path);
    if (!this.data.activeFolderPath) this.data.activeFolderPath = path;
    this.persist();
    this.draw();
  }
  unpin(path) {
    var _a;
    this.data.pinnedFolders = this.data.pinnedFolders.filter((p) => p !== path);
    if (this.data.activeFolderPath === path)
      this.data.activeFolderPath = (_a = this.data.pinnedFolders[0]) != null ? _a : null;
    this.persist();
    this.draw();
  }
};
var FolderPinPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    this.data = { ...DEFAULT_DATA };
    this.save = (0, import_obsidian.debounce)(() => this.saveData(this.data), 400, true);
  }
  async onload() {
    this.data = Object.assign({ ...DEFAULT_DATA }, await this.loadData());
    this.registerView(
      VIEW_TYPE,
      (leaf) => new FolderPinView(leaf, this.data, () => this.save())
    );
    this.addRibbonIcon("pin", "Folder Pin View", () => this.activateView());
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
      if (source === VIEW_TYPE || !(file instanceof import_obsidian.TFolder)) return;
      menu.addItem((i) => i.setTitle("Pin folder").setIcon("pin").onClick(() => {
        var _a;
        return (_a = this.getView()) == null ? void 0 : _a.pin(file.path);
      }));
    }));
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", (f) => {
      this.onDelete(f.path);
      this.refresh();
    }));
    this.registerEvent(this.app.vault.on("rename", (f, old) => {
      this.onRename(f.path, old);
      this.refresh();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.app.workspace.onLayoutReady(() => this.activateView());
  }
  onunload() {
  }
  onDelete(path) {
    var _a;
    const gone = (p) => p === path || p.startsWith(path + "/");
    this.data.pinnedFolders = this.data.pinnedFolders.filter((p) => !gone(p));
    this.data.expandedFolders = this.data.expandedFolders.filter((p) => !gone(p));
    if (this.data.activeFolderPath && gone(this.data.activeFolderPath))
      this.data.activeFolderPath = (_a = this.data.pinnedFolders[0]) != null ? _a : null;
    this.save();
  }
  onRename(path, old) {
    const remap = (p) => p === old ? path : p.startsWith(old + "/") ? path + p.slice(old.length) : p;
    this.data.pinnedFolders = this.data.pinnedFolders.map(remap);
    this.data.expandedFolders = this.data.expandedFolders.map(remap);
    if (this.data.activeFolderPath) this.data.activeFolderPath = remap(this.data.activeFolderPath);
    this.save();
  }
  refresh() {
    var _a;
    (_a = this.getView()) == null ? void 0 : _a.refresh();
  }
  async activateView() {
    var _a;
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length > 0) return;
    await ((_a = this.app.workspace.getLeftLeaf(false)) == null ? void 0 : _a.setViewState({ type: VIEW_TYPE, active: true }));
  }
  getView() {
    var _a, _b;
    return (_b = (_a = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]) == null ? void 0 : _a.view) != null ? _b : null;
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQXBwLCBJdGVtVmlldywgTWVudSwgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBTZXR0aW5nLFxuICAgIFRBYnN0cmFjdEZpbGUsIFRGaWxlLCBURm9sZGVyLCBXb3Jrc3BhY2VMZWFmLCBkZWJvdW5jZSwgc2V0SWNvbixcbn0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBWSUVXX1RZUEUgPSAnZm9sZGVyLXBpbi12aWV3JztcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICAgIHBpbm5lZEZvbGRlcnM6IHN0cmluZ1tdO1xuICAgIGFjdGl2ZUZvbGRlclBhdGg6IHN0cmluZyB8IG51bGw7XG4gICAgZXhwYW5kZWRGb2xkZXJzOiBzdHJpbmdbXTtcbn1cblxuY29uc3QgREVGQVVMVF9EQVRBOiBQbHVnaW5EYXRhID0geyBwaW5uZWRGb2xkZXJzOiBbXSwgYWN0aXZlRm9sZGVyUGF0aDogbnVsbCwgZXhwYW5kZWRGb2xkZXJzOiBbXSB9O1xuXG4vLyBcdTI1MDBcdTI1MDAgUHJvbXB0IG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBQcm9tcHRNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgICBwcml2YXRlIHZhbHVlOiBzdHJpbmc7XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgYXBwOiBBcHAsXG4gICAgICAgIHByaXZhdGUgaGVhZGluZzogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIGluaXRpYWw6IHN0cmluZyxcbiAgICAgICAgcHJpdmF0ZSBvblN1Ym1pdDogKG5hbWU6IHN0cmluZykgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4sXG4gICAgKSB7IHN1cGVyKGFwcCk7IHRoaXMudmFsdWUgPSBpbml0aWFsOyB9XG5cbiAgICBvbk9wZW4oKSB7XG4gICAgICAgIHRoaXMudGl0bGVFbC5zZXRUZXh0KHRoaXMuaGVhZGluZyk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHRoaXMuY29udGVudEVsKS5hZGRUZXh0KHQgPT4ge1xuICAgICAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLmluaXRpYWwpLm9uQ2hhbmdlKHYgPT4gKHRoaXMudmFsdWUgPSB2KSk7XG4gICAgICAgICAgICB0LmlucHV0RWwuc2VsZWN0KCk7XG4gICAgICAgICAgICB0LmlucHV0RWwuZm9jdXMoKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5hZGRFdmVudExpc3RlbmVyKCdrZXlkb3duJywgZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7IGUucHJldmVudERlZmF1bHQoKTsgdGhpcy5zdWJtaXQoKTsgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICBuZXcgU2V0dGluZyh0aGlzLmNvbnRlbnRFbClcbiAgICAgICAgICAgIC5hZGRCdXR0b24oYiA9PiBiLnNldEJ1dHRvblRleHQoJ09LJykuc2V0Q3RhKCkub25DbGljaygoKSA9PiB0aGlzLnN1Ym1pdCgpKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzdWJtaXQoKSB7XG4gICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLnZhbHVlLnRyaW0oKTtcbiAgICAgICAgaWYgKCFuYW1lKSByZXR1cm47XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgICAgdGhpcy5vblN1Ym1pdChuYW1lKTtcbiAgICB9XG5cbiAgICBvbkNsb3NlKCkgeyB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpOyB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBWaWV3IFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBGb2xkZXJQaW5WaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuICAgIHByaXZhdGUgZHJhZ0luZGV4ID0gLTE7XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgbGVhZjogV29ya3NwYWNlTGVhZixcbiAgICAgICAgcHJpdmF0ZSBkYXRhOiBQbHVnaW5EYXRhLFxuICAgICAgICBwcml2YXRlIHBlcnNpc3Q6ICgpID0+IHZvaWQsXG4gICAgKSB7IHN1cGVyKGxlYWYpOyB9XG5cbiAgICBnZXRWaWV3VHlwZSgpICAgIHsgcmV0dXJuIFZJRVdfVFlQRTsgfVxuICAgIGdldERpc3BsYXlUZXh0KCkgeyByZXR1cm4gJ0ZvbGRlciBQaW4nOyB9XG4gICAgZ2V0SWNvbigpICAgICAgICB7IHJldHVybiAncGluJzsgfVxuXG4gICAgYXN5bmMgb25PcGVuKCkgIHsgdGhpcy5jb250ZW50RWwuYWRkQ2xhc3MoJ2Zwdi1yb290Jyk7IHRoaXMuZHJhdygpOyB9XG4gICAgYXN5bmMgb25DbG9zZSgpIHt9XG5cbiAgICByZWZyZXNoID0gZGVib3VuY2UoKCkgPT4gdGhpcy5kcmF3KCksIDEwMCwgdHJ1ZSk7XG5cbiAgICBkcmF3KCkge1xuICAgICAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICAgICAgICB0aGlzLmRyYXdQaW5CYXIoKTtcblxuICAgICAgICBjb25zdCB0cmVlID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtdHJlZScpO1xuICAgICAgICB0cmVlLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHRyZWUpIHRoaXMuc2hvd1Jvb3RNZW51KGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aFxuICAgICAgICAgICAgPyB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpXG4gICAgICAgICAgICA6IHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcblxuICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVEZvbGRlcikgdGhpcy5kcmF3Rm9sZGVyKHRyZWUsIHRhcmdldCk7XG4gICAgICAgIGVsc2UgdHJlZS5jcmVhdGVEaXYoeyBjbHM6ICdmcHYtZW1wdHknLCB0ZXh0OiAnUmlnaHQtY2xpY2sgYSBmb2xkZXIgYW5kIGNob29zZSBcIlBpbiBmb2xkZXJcIi4nIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBwaW4gYmFyIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3UGluQmFyKCkge1xuICAgICAgICBjb25zdCBiYXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoJ2Zwdi1iYXInKTtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZm9yRWFjaCgocGF0aCwgaWR4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBidG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgICAgICAgICAgICBjbHM6ICdmcHYtYnRuJyxcbiAgICAgICAgICAgICAgICB0ZXh0OiBwYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgcGF0aCxcbiAgICAgICAgICAgICAgICB0aXRsZTogcGF0aCxcbiAgICAgICAgICAgICAgICBhdHRyOiB7IGRyYWdnYWJsZTogJ3RydWUnIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgYnRuLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcblxuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcGF0aDtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIG5ldyBNZW51KClcbiAgICAgICAgICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdVbnBpbicpLnNldEljb24oJ3gnKS5vbkNsaWNrKCgpID0+IHRoaXMudW5waW4ocGF0aCkpKVxuICAgICAgICAgICAgICAgICAgICAuc2hvd0F0TW91c2VFdmVudChlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBkcmFnLXRvLXJlb3JkZXJcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCAoKSA9PiB7IHRoaXMuZHJhZ0luZGV4ID0gaWR4OyBidG4uYWRkQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7IH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCAgICgpID0+IHsgdGhpcy5kcmFnSW5kZXggPSAtMTsgIGJ0bi5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmcnKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAgZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgYnRuLmFkZENsYXNzKCdkcmFnLW92ZXInKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgKCkgPT4gYnRuLnJlbW92ZUNsYXNzKCdkcmFnLW92ZXInKSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGUgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBidG4ucmVtb3ZlQ2xhc3MoJ2RyYWctb3ZlcicpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRyYWdJbmRleCA8IDAgfHwgdGhpcy5kcmFnSW5kZXggPT09IGlkeCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpbnMgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycztcbiAgICAgICAgICAgICAgICBjb25zdCBbbW92ZWRdID0gcGlucy5zcGxpY2UodGhpcy5kcmFnSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHBpbnMuc3BsaWNlKGlkeCwgMCwgbW92ZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBmaWxlIHRyZWUgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIGRyYXdGb2xkZXIoZWw6IEhUTUxFbGVtZW50LCBmb2xkZXI6IFRGb2xkZXIpIHtcbiAgICAgICAgY29uc3QgZXhwYW5kZWQgPSBuZXcgU2V0KHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMpO1xuICAgICAgICBjb25zdCBhY3RpdmVQYXRoID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKT8ucGF0aDtcblxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4uZm9sZGVyLmNoaWxkcmVuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICBpZiAoKGEgaW5zdGFuY2VvZiBURm9sZGVyKSAhPT0gKGIgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuIGEgaW5zdGFuY2VvZiBURm9sZGVyID8gLTEgOiAxO1xuICAgICAgICAgICAgcmV0dXJuIGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygc29ydGVkKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IGV4cGFuZGVkLmhhcyhjaGlsZC5wYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwID0gZWwuY3JlYXRlRGl2KCdmcHYtZm9sZGVyJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZCA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWhlYWQnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnJvdyA9IGhlYWQuY3JlYXRlU3BhbignZnB2LWFycm93Jyk7XG4gICAgICAgICAgICAgICAgc2V0SWNvbihhcnJvdywgb3BlbiA/ICdjaGV2cm9uLWRvd24nIDogJ2NoZXZyb24tcmlnaHQnKTtcbiAgICAgICAgICAgICAgICBoZWFkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjaGlsZC5uYW1lIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWJvZHknKTtcbiAgICAgICAgICAgICAgICBpZiAob3BlbikgeyBib2R5LmFkZENsYXNzKCdpcy1vcGVuJyk7IHRoaXMuZHJhd0ZvbGRlcihib2R5LCBjaGlsZCk7IH1cblxuICAgICAgICAgICAgICAgIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnRvZ2dsZShjaGlsZC5wYXRoKSk7XG4gICAgICAgICAgICAgICAgaGVhZC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4gdGhpcy5zaG93RmlsZU1lbnUoZSwgY2hpbGQpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGVsLmNyZWF0ZURpdignZnB2LWZpbGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQucGF0aCA9PT0gYWN0aXZlUGF0aCkgcm93LmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJyA/IGNoaWxkLmJhc2VuYW1lIDogY2hpbGQubmFtZSB9KTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGNoaWxkKSk7XG4gICAgICAgICAgICAgICAgcm93LmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB0aGlzLnNob3dGaWxlTWVudShlLCBjaGlsZCkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b2dnbGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGxpc3QgPSB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzO1xuICAgICAgICBjb25zdCBhdCA9IGxpc3QuaW5kZXhPZihwYXRoKTtcbiAgICAgICAgaWYgKGF0ID49IDApIGxpc3Quc3BsaWNlKGF0LCAxKTsgZWxzZSBsaXN0LnB1c2gocGF0aCk7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgY29udGV4dCBtZW51cyBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgc2hvd1Jvb3RNZW51KGU6IE1vdXNlRXZlbnQpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBpZiAoIXRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSByZXR1cm47XG4gICAgICAgIG5ldyBNZW51KClcbiAgICAgICAgICAgIC5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnTmV3IG5vdGUnKS5zZXRJY29uKCdmaWxlLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkoZmFsc2UsIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoISkpKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgZm9sZGVyJykuc2V0SWNvbignZm9sZGVyLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkodHJ1ZSwgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGghKSkpXG4gICAgICAgICAgICAuc2hvd0F0TW91c2VFdmVudChlKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHNob3dGaWxlTWVudShlOiBNb3VzZUV2ZW50LCBmaWxlOiBUQWJzdHJhY3RGaWxlKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgY29uc3QgbWVudSA9IG5ldyBNZW51KCk7XG5cbiAgICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgICBjb25zdCBwaW5uZWQgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5pbmNsdWRlcyhmaWxlLnBhdGgpO1xuICAgICAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaVxuICAgICAgICAgICAgICAgIC5zZXRUaXRsZShwaW5uZWQgPyAnVW5waW4gZm9sZGVyJyA6ICdQaW4gZm9sZGVyJykuc2V0SWNvbigncGluJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiBwaW5uZWQgPyB0aGlzLnVucGluKGZpbGUucGF0aCkgOiB0aGlzLnBpbihmaWxlLnBhdGgpKSk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgbm90ZScpLnNldEljb24oJ2ZpbGUtcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgZmlsZS5wYXRoKSkpO1xuICAgICAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnTmV3IGZvbGRlcicpLnNldEljb24oJ2ZvbGRlci1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KHRydWUsIGZpbGUucGF0aCkpKTtcbiAgICAgICAgICAgIG1lbnUuYWRkU2VwYXJhdG9yKCk7XG4gICAgICAgIH1cblxuICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdSZW5hbWUnKS5zZXRJY29uKCdwZW5jaWwnKS5vbkNsaWNrKCgpID0+IHRoaXMucmVuYW1lRmlsZShmaWxlKSkpO1xuICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdEZWxldGUnKS5zZXRJY29uKCd0cmFzaCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5kZWxldGVGaWxlKGZpbGUpKSk7XG5cbiAgICAgICAgbWVudS5zaG93QXRNb3VzZUV2ZW50KGUpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBmaWxlIG9wZXJhdGlvbnMgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIGNyZWF0ZUVudHJ5KGlzRm9sZGVyOiBib29sZWFuLCBwYXJlbnRQYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgbmV3IFByb21wdE1vZGFsKFxuICAgICAgICAgICAgdGhpcy5hcHAsXG4gICAgICAgICAgICBpc0ZvbGRlciA/ICdOZXcgZm9sZGVyJyA6ICdOZXcgbm90ZScsXG4gICAgICAgICAgICBpc0ZvbGRlciA/ICdGb2xkZXIgbmFtZScgOiAnTm90ZSBuYW1lJyxcbiAgICAgICAgICAgIGFzeW5jIG5hbWUgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGggPSAocGFyZW50UGF0aCA/IHBhcmVudFBhdGggKyAnLycgOiAnJykgKyBuYW1lICsgKGlzRm9sZGVyID8gJycgOiAnLm1kJyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKSkgeyBuZXcgTm90aWNlKCdBbHJlYWR5IGV4aXN0cy4nKTsgcmV0dXJuOyB9XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzRm9sZGVyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIocGF0aCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKHBhdGgsICcnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoZmlsZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9IGNhdGNoIChlcnIpIHsgbmV3IE5vdGljZSgnQ291bGQgbm90IGNyZWF0ZTogJyArIFN0cmluZyhlcnIpKTsgfVxuICAgICAgICAgICAgfSxcbiAgICAgICAgKS5vcGVuKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZW5hbWVGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgY29uc3Qgb2xkTmFtZSA9IGZpbGUgaW5zdGFuY2VvZiBURmlsZSA/IGZpbGUuYmFzZW5hbWUgOiBmaWxlLm5hbWU7XG4gICAgICAgIG5ldyBQcm9tcHRNb2RhbCh0aGlzLmFwcCwgJ1JlbmFtZScsIG9sZE5hbWUsIGFzeW5jIG5ld05hbWUgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50ID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gJyc7XG4gICAgICAgICAgICBjb25zdCBzdWZmaXggPSBmaWxlIGluc3RhbmNlb2YgVEZpbGUgPyAnLicgKyBmaWxlLmV4dGVuc2lvbiA6ICcnO1xuICAgICAgICAgICAgY29uc3QgbmV3UGF0aCA9IChwYXJlbnQgPyBwYXJlbnQgKyAnLycgOiAnJykgKyBuZXdOYW1lICsgc3VmZml4O1xuICAgICAgICAgICAgdHJ5IHsgYXdhaXQgdGhpcy5hcHAudmF1bHQucmVuYW1lKGZpbGUsIG5ld1BhdGgpOyB9XG4gICAgICAgICAgICBjYXRjaCAoZXJyKSB7IG5ldyBOb3RpY2UoJ1JlbmFtZSBmYWlsZWQ6ICcgKyBTdHJpbmcoZXJyKSk7IH1cbiAgICAgICAgfSkub3BlbigpO1xuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgZGVsZXRlRmlsZShmaWxlOiBUQWJzdHJhY3RGaWxlKSB7XG4gICAgICAgIHRyeSB7IGF3YWl0IHRoaXMuYXBwLmZpbGVNYW5hZ2VyLnRyYXNoRmlsZShmaWxlKTsgfVxuICAgICAgICBjYXRjaCAoZXJyKSB7IG5ldyBOb3RpY2UoJ0RlbGV0ZSBmYWlsZWQ6ICcgKyBTdHJpbmcoZXJyKSk7IH1cbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgcGluIG1hbmFnZW1lbnQgKGNhbGxlZCBieSBwbHVnaW4gdG9vKSBcdTI1MDBcdTI1MDBcblxuICAgIHBpbihwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmluY2x1ZGVzKHBhdGgpKSByZXR1cm47XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLnB1c2gocGF0aCk7XG4gICAgICAgIGlmICghdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcGF0aDtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgdW5waW4ocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZmlsdGVyKHAgPT4gcCAhPT0gcGF0aCk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9PT0gcGF0aClcbiAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnNbMF0gPz8gbnVsbDtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFBsdWdpbiBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRm9sZGVyUGluUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcbiAgICBkYXRhOiBQbHVnaW5EYXRhID0geyAuLi5ERUZBVUxUX0RBVEEgfTtcbiAgICBwcml2YXRlIHNhdmUgPSBkZWJvdW5jZSgoKSA9PiB0aGlzLnNhdmVEYXRhKHRoaXMuZGF0YSksIDQwMCwgdHJ1ZSk7XG5cbiAgICBhc3luYyBvbmxvYWQoKSB7XG4gICAgICAgIHRoaXMuZGF0YSA9IE9iamVjdC5hc3NpZ24oeyAuLi5ERUZBVUxUX0RBVEEgfSwgYXdhaXQgdGhpcy5sb2FkRGF0YSgpIGFzIFBhcnRpYWw8UGx1Z2luRGF0YT4pO1xuXG4gICAgICAgIHRoaXMucmVnaXN0ZXJWaWV3KFZJRVdfVFlQRSwgbGVhZiA9PlxuICAgICAgICAgICAgbmV3IEZvbGRlclBpblZpZXcobGVhZiwgdGhpcy5kYXRhLCAoKSA9PiB0aGlzLnNhdmUoKSlcbiAgICAgICAgKTtcbiAgICAgICAgdGhpcy5hZGRSaWJib25JY29uKCdwaW4nLCAnRm9sZGVyIFBpbiBWaWV3JywgKCkgPT4gdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG5cbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1tZW51JywgKG1lbnUsIGZpbGUsIHNvdXJjZSkgPT4ge1xuICAgICAgICAgICAgaWYgKHNvdXJjZSA9PT0gVklFV19UWVBFIHx8ICEoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpKSByZXR1cm47XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdQaW4gZm9sZGVyJykuc2V0SWNvbigncGluJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmdldFZpZXcoKT8ucGluKGZpbGUucGF0aCkpKTtcbiAgICAgICAgfSkpO1xuXG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignY3JlYXRlJywgICgpICAgICAgPT4gdGhpcy5yZWZyZXNoKCkpKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdkZWxldGUnLCAgZiAgICAgICA9PiB7IHRoaXMub25EZWxldGUoZi5wYXRoKTsgdGhpcy5yZWZyZXNoKCk7IH0pKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdyZW5hbWUnLCAgKGYsIG9sZCkgPT4geyB0aGlzLm9uUmVuYW1lKGYucGF0aCwgb2xkKTsgdGhpcy5yZWZyZXNoKCk7IH0pKTtcbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLndvcmtzcGFjZS5vbignZmlsZS1vcGVuJywgKCkgPT4gdGhpcy5yZWZyZXNoKCkpKTtcblxuICAgICAgICB0aGlzLmFwcC53b3Jrc3BhY2Uub25MYXlvdXRSZWFkeSgoKSA9PiB0aGlzLmFjdGl2YXRlVmlldygpKTtcbiAgICB9XG5cbiAgICBvbnVubG9hZCgpIHt9XG5cbiAgICBwcml2YXRlIG9uRGVsZXRlKHBhdGg6IHN0cmluZykge1xuICAgICAgICBjb25zdCBnb25lID0gKHA6IHN0cmluZykgPT4gcCA9PT0gcGF0aCB8fCBwLnN0YXJ0c1dpdGgocGF0aCArICcvJyk7XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzICAgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5maWx0ZXIocCA9PiAhZ29uZShwKSk7XG4gICAgICAgIHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMgPSB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzLmZpbHRlcihwID0+ICFnb25lKHApKTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoICYmIGdvbmUodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpKVxuICAgICAgICAgICAgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSB0aGlzLmRhdGEucGlubmVkRm9sZGVyc1swXSA/PyBudWxsO1xuICAgICAgICB0aGlzLnNhdmUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIG9uUmVuYW1lKHBhdGg6IHN0cmluZywgb2xkOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgcmVtYXAgPSAocDogc3RyaW5nKSA9PlxuICAgICAgICAgICAgcCA9PT0gb2xkID8gcGF0aCA6IHAuc3RhcnRzV2l0aChvbGQgKyAnLycpID8gcGF0aCArIHAuc2xpY2Uob2xkLmxlbmd0aCkgOiBwO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyAgID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMubWFwKHJlbWFwKTtcbiAgICAgICAgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycyA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMubWFwKHJlbWFwKTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHJlbWFwKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKTtcbiAgICAgICAgdGhpcy5zYXZlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSByZWZyZXNoKCkgeyB0aGlzLmdldFZpZXcoKT8ucmVmcmVzaCgpOyB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGFjdGl2YXRlVmlldygpIHtcbiAgICAgICAgaWYgKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKS5sZW5ndGggPiAwKSByZXR1cm47XG4gICAgICAgIGF3YWl0IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWZ0TGVhZihmYWxzZSk/LnNldFZpZXdTdGF0ZSh7IHR5cGU6IFZJRVdfVFlQRSwgYWN0aXZlOiB0cnVlIH0pO1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0VmlldygpOiBGb2xkZXJQaW5WaWV3IHwgbnVsbCB7XG4gICAgICAgIHJldHVybiAodGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpWzBdPy52aWV3IGFzIEZvbGRlclBpblZpZXcpID8/IG51bGw7XG4gICAgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxzQkFHTztBQUVQLElBQU0sWUFBWTtBQVFsQixJQUFNLGVBQTJCLEVBQUUsZUFBZSxDQUFDLEdBQUcsa0JBQWtCLE1BQU0saUJBQWlCLENBQUMsRUFBRTtBQUlsRyxJQUFNLGNBQU4sY0FBMEIsc0JBQU07QUFBQSxFQUc1QixZQUNJLEtBQ1EsU0FDQSxTQUNBLFVBQ1Y7QUFBRSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQ0E7QUFDSSxTQUFLLFFBQVE7QUFBQSxFQUFTO0FBQUEsRUFFdEMsU0FBUztBQUNMLFNBQUssUUFBUSxRQUFRLEtBQUssT0FBTztBQUNqQyxRQUFJLHdCQUFRLEtBQUssU0FBUyxFQUFFLFFBQVEsT0FBSztBQUNyQyxRQUFFLFNBQVMsS0FBSyxPQUFPLEVBQUUsU0FBUyxPQUFNLEtBQUssUUFBUSxDQUFFO0FBQ3ZELFFBQUUsUUFBUSxPQUFPO0FBQ2pCLFFBQUUsUUFBUSxNQUFNO0FBQ2hCLFFBQUUsUUFBUSxpQkFBaUIsV0FBVyxPQUFLO0FBQ3ZDLFlBQUksRUFBRSxRQUFRLFNBQVM7QUFBRSxZQUFFLGVBQWU7QUFBRyxlQUFLLE9BQU87QUFBQSxRQUFHO0FBQUEsTUFDaEUsQ0FBQztBQUFBLElBQ0wsQ0FBQztBQUNELFFBQUksd0JBQVEsS0FBSyxTQUFTLEVBQ3JCLFVBQVUsT0FBSyxFQUFFLGNBQWMsSUFBSSxFQUFFLE9BQU8sRUFBRSxRQUFRLE1BQU0sS0FBSyxPQUFPLENBQUMsQ0FBQztBQUFBLEVBQ25GO0FBQUEsRUFFUSxTQUFTO0FBQ2IsVUFBTSxPQUFPLEtBQUssTUFBTSxLQUFLO0FBQzdCLFFBQUksQ0FBQyxL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
