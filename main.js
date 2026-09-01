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
var DEFAULT_DATA = { pinnedFolders: [], activeFolderPath: null, expandedFolders: [], sortOrder: "asc" };
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
    this.drawToolbar();
    const tree = this.contentEl.createDiv("fpv-tree");
    tree.addEventListener("contextmenu", (e) => {
      if (e.target === tree) this.showRootMenu(e);
    });
    const target = this.data.activeFolderPath ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath) : this.app.vault.getRoot();
    if (target instanceof import_obsidian.TFolder) this.drawFolder(tree, target);
    else tree.createDiv({ cls: "fpv-empty", text: 'Right-click a folder and choose "Pin folder".' });
  }
  // ── toolbar ──
  drawToolbar() {
    var _a;
    const bar = this.contentEl.createDiv("fpv-toolbar");
    const btn = (icon, label, fn) => {
      const b = bar.createDiv({ cls: "fpv-tool", attr: { "aria-label": label } });
      (0, import_obsidian.setIcon)(b, icon);
      b.addEventListener("click", fn);
    };
    const base = (_a = this.data.activeFolderPath) != null ? _a : "";
    btn("square-pen", "New note", () => this.createEntry(false, base));
    btn("folder-plus", "New folder", () => this.createEntry(true, base));
    btn("arrow-up-az", "Sort " + (this.data.sortOrder === "asc" ? "Z\u2192A" : "A\u2192Z"), () => {
      this.data.sortOrder = this.data.sortOrder === "asc" ? "desc" : "asc";
      this.persist();
      this.draw();
    });
    btn("chevrons-up-down", "Expand all", () => this.expandAll());
    btn("chevrons-down-up", "Collapse all", () => this.collapseAll());
  }
  expandAll() {
    const target = this.data.activeFolderPath ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath) : this.app.vault.getRoot();
    if (!(target instanceof import_obsidian.TFolder)) return;
    const collect = (f) => {
      for (const child of f.children) {
        if (child instanceof import_obsidian.TFolder) {
          this.data.expandedFolders.push(child.path);
          collect(child);
        }
      }
    };
    this.data.expandedFolders = [];
    collect(target);
    this.persist();
    this.draw();
  }
  collapseAll() {
    this.data.expandedFolders = [];
    this.persist();
    this.draw();
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
      const cmp = a.name.localeCompare(b.name);
      return this.data.sortOrder === "asc" ? cmp : -cmp;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQXBwLCBJdGVtVmlldywgTWVudSwgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBTZXR0aW5nLFxuICAgIFRBYnN0cmFjdEZpbGUsIFRGaWxlLCBURm9sZGVyLCBXb3Jrc3BhY2VMZWFmLCBkZWJvdW5jZSwgc2V0SWNvbixcbn0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBWSUVXX1RZUEUgPSAnZm9sZGVyLXBpbi12aWV3JztcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICAgIHBpbm5lZEZvbGRlcnM6IHN0cmluZ1tdO1xuICAgIGFjdGl2ZUZvbGRlclBhdGg6IHN0cmluZyB8IG51bGw7XG4gICAgZXhwYW5kZWRGb2xkZXJzOiBzdHJpbmdbXTtcbiAgICBzb3J0T3JkZXI6ICdhc2MnIHwgJ2Rlc2MnO1xufVxuXG5jb25zdCBERUZBVUxUX0RBVEE6IFBsdWdpbkRhdGEgPSB7IHBpbm5lZEZvbGRlcnM6IFtdLCBhY3RpdmVGb2xkZXJQYXRoOiBudWxsLCBleHBhbmRlZEZvbGRlcnM6IFtdLCBzb3J0T3JkZXI6ICdhc2MnIH07XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFByb21wdE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgdmFsdWU6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBhcHA6IEFwcCxcbiAgICAgICAgcHJpdmF0ZSBoZWFkaW5nOiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgaW5pdGlhbDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIG9uU3VibWl0OiAobmFtZTogc3RyaW5nKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPixcbiAgICApIHsgc3VwZXIoYXBwKTsgdGhpcy52YWx1ZSA9IGluaXRpYWw7IH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQodGhpcy5oZWFkaW5nKTtcbiAgICAgICAgbmV3IFNldHRpbmcodGhpcy5jb250ZW50RWwpLmFkZFRleHQodCA9PiB7XG4gICAgICAgICAgICB0LnNldFZhbHVlKHRoaXMuaW5pdGlhbCkub25DaGFuZ2UodiA9PiAodGhpcy52YWx1ZSA9IHYpKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5zZWxlY3QoKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5mb2N1cygpO1xuICAgICAgICAgICAgdC5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnN1Ym1pdCgpOyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHRoaXMuY29udGVudEVsKVxuICAgICAgICAgICAgLmFkZEJ1dHRvbihiID0+IGIuc2V0QnV0dG9uVGV4dCgnT0snKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHRoaXMuc3VibWl0KCkpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN1Ym1pdCgpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMudmFsdWUudHJpbSgpO1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB0aGlzLm9uU3VibWl0KG5hbWUpO1xuICAgIH1cblxuICAgIG9uQ2xvc2UoKSB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFZpZXcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclBpblZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gICAgcHJpdmF0ZSBkcmFnSW5kZXggPSAtMTtcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBsZWFmOiBXb3Jrc3BhY2VMZWFmLFxuICAgICAgICBwcml2YXRlIGRhdGE6IFBsdWdpbkRhdGEsXG4gICAgICAgIHByaXZhdGUgcGVyc2lzdDogKCkgPT4gdm9pZCxcbiAgICApIHsgc3VwZXIobGVhZik7IH1cblxuICAgIGdldFZpZXdUeXBlKCkgICAgeyByZXR1cm4gVklFV19UWVBFOyB9XG4gICAgZ2V0RGlzcGxheVRleHQoKSB7IHJldHVybiAnRm9sZGVyIFBpbic7IH1cbiAgICBnZXRJY29uKCkgICAgICAgIHsgcmV0dXJuICdwaW4nOyB9XG5cbiAgICBhc3luYyBvbk9wZW4oKSAgeyB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcygnZnB2LXJvb3QnKTsgdGhpcy5kcmF3KCk7IH1cbiAgICBhc3luYyBvbkNsb3NlKCkge31cblxuICAgIHJlZnJlc2ggPSBkZWJvdW5jZSgoKSA9PiB0aGlzLmRyYXcoKSwgMTAwLCB0cnVlKTtcblxuICAgIGRyYXcoKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgICAgIHRoaXMuZHJhd1BpbkJhcigpO1xuICAgICAgICB0aGlzLmRyYXdUb29sYmFyKCk7XG5cbiAgICAgICAgY29uc3QgdHJlZSA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdignZnB2LXRyZWUnKTtcbiAgICAgICAgdHJlZS5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4ge1xuICAgICAgICAgICAgaWYgKGUudGFyZ2V0ID09PSB0cmVlKSB0aGlzLnNob3dSb290TWVudShlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgY29uc3QgdGFyZ2V0ID0gdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGhcbiAgICAgICAgICAgID8gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKVxuICAgICAgICAgICAgOiB0aGlzLmFwcC52YXVsdC5nZXRSb290KCk7XG5cbiAgICAgICAgaWYgKHRhcmdldCBpbnN0YW5jZW9mIFRGb2xkZXIpIHRoaXMuZHJhd0ZvbGRlcih0cmVlLCB0YXJnZXQpO1xuICAgICAgICBlbHNlIHRyZWUuY3JlYXRlRGl2KHsgY2xzOiAnZnB2LWVtcHR5JywgdGV4dDogJ1JpZ2h0LWNsaWNrIGEgZm9sZGVyIGFuZCBjaG9vc2UgXCJQaW4gZm9sZGVyXCIuJyB9KTtcbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgdG9vbGJhciBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgZHJhd1Rvb2xiYXIoKSB7XG4gICAgICAgIGNvbnN0IGJhciA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdignZnB2LXRvb2xiYXInKTtcbiAgICAgICAgY29uc3QgYnRuID0gKGljb246IHN0cmluZywgbGFiZWw6IHN0cmluZywgZm46ICgpID0+IHZvaWQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGIgPSBiYXIuY3JlYXRlRGl2KHsgY2xzOiAnZnB2LXRvb2wnLCBhdHRyOiB7ICdhcmlhLWxhYmVsJzogbGFiZWwgfSB9KTtcbiAgICAgICAgICAgIHNldEljb24oYiwgaWNvbik7XG4gICAgICAgICAgICBiLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZm4pO1xuICAgICAgICB9O1xuICAgICAgICBjb25zdCBiYXNlID0gdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPz8gJyc7XG4gICAgICAgIGJ0bignc3F1YXJlLXBlbicsICAgICdOZXcgbm90ZScsICAgICAgICgpID0+IHRoaXMuY3JlYXRlRW50cnkoZmFsc2UsIGJhc2UpKTtcbiAgICAgICAgYnRuKCdmb2xkZXItcGx1cycsICAgJ05ldyBmb2xkZXInLCAgICAgKCkgPT4gdGhpcy5jcmVhdGVFbnRyeSh0cnVlLCBiYXNlKSk7XG4gICAgICAgIGJ0bignYXJyb3ctdXAtYXonLCAgICdTb3J0ICcgKyAodGhpcy5kYXRhLnNvcnRPcmRlciA9PT0gJ2FzYycgPyAnWlx1MjE5MkEnIDogJ0FcdTIxOTJaJyksICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuZGF0YS5zb3J0T3JkZXIgPSB0aGlzLmRhdGEuc29ydE9yZGVyID09PSAnYXNjJyA/ICdkZXNjJyA6ICdhc2MnO1xuICAgICAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJ0bignY2hldnJvbnMtdXAtZG93bicsICdFeHBhbmQgYWxsJywgICgpID0+IHRoaXMuZXhwYW5kQWxsKCkpO1xuICAgICAgICBidG4oJ2NoZXZyb25zLWRvd24tdXAnLCAnQ29sbGFwc2UgYWxsJywoKSA9PiB0aGlzLmNvbGxhcHNlQWxsKCkpO1xuICAgIH1cblxuICAgIHByaXZhdGUgZXhwYW5kQWxsKCkge1xuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aFxuICAgICAgICAgICAgPyB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpXG4gICAgICAgICAgICA6IHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcbiAgICAgICAgaWYgKCEodGFyZ2V0IGluc3RhbmNlb2YgVEZvbGRlcikpIHJldHVybjtcbiAgICAgICAgY29uc3QgY29sbGVjdCA9IChmOiBURm9sZGVyKSA9PiB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIGYuY2hpbGRyZW4pIHtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMucHVzaChjaGlsZC5wYXRoKTsgY29sbGVjdChjaGlsZCk7IH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICAgICAgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycyA9IFtdO1xuICAgICAgICBjb2xsZWN0KHRhcmdldCk7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNvbGxhcHNlQWxsKCkge1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gW107XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgcGluIGJhciBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgZHJhd1BpbkJhcigpIHtcbiAgICAgICAgY29uc3QgYmFyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtYmFyJyk7XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZvckVhY2goKHBhdGgsIGlkeCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYnRuID0gYmFyLmNyZWF0ZUVsKCdidXR0b24nLCB7XG4gICAgICAgICAgICAgICAgY2xzOiAnZnB2LWJ0bicsXG4gICAgICAgICAgICAgICAgdGV4dDogcGF0aC5zcGxpdCgnLycpLnBvcCgpIHx8IHBhdGgsXG4gICAgICAgICAgICAgICAgdGl0bGU6IHBhdGgsXG4gICAgICAgICAgICAgICAgYXR0cjogeyBkcmFnZ2FibGU6ICd0cnVlJyB9LFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAocGF0aCA9PT0gdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIGJ0bi5hZGRDbGFzcygnaXMtYWN0aXZlJyk7XG5cbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHBhdGg7XG4gICAgICAgICAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBuZXcgTWVudSgpXG4gICAgICAgICAgICAgICAgICAgIC5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnVW5waW4nKS5zZXRJY29uKCd4Jykub25DbGljaygoKSA9PiB0aGlzLnVucGluKHBhdGgpKSlcbiAgICAgICAgICAgICAgICAgICAgLnNob3dBdE1vdXNlRXZlbnQoZSk7XG4gICAgICAgICAgICB9KTtcblxuICAgICAgICAgICAgLy8gZHJhZy10by1yZW9yZGVyXG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ3N0YXJ0JywgKCkgPT4geyB0aGlzLmRyYWdJbmRleCA9IGlkeDsgYnRuLmFkZENsYXNzKCdpcy1kcmFnZ2luZycpOyB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgICAoKSA9PiB7IHRoaXMuZHJhZ0luZGV4ID0gLTE7ICBidG4ucmVtb3ZlQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7IH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgIGUgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGJ0bi5hZGRDbGFzcygnZHJhZy1vdmVyJyk7IH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsICgpID0+IGJ0bi5yZW1vdmVDbGFzcygnZHJhZy1vdmVyJykpO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBlID0+IHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgYnRuLnJlbW92ZUNsYXNzKCdkcmFnLW92ZXInKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5kcmFnSW5kZXggPCAwIHx8IHRoaXMuZHJhZ0luZGV4ID09PSBpZHgpIHJldHVybjtcbiAgICAgICAgICAgICAgICBjb25zdCBwaW5zID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnM7XG4gICAgICAgICAgICAgICAgY29uc3QgW21vdmVkXSA9IHBpbnMuc3BsaWNlKHRoaXMuZHJhZ0luZGV4LCAxKTtcbiAgICAgICAgICAgICAgICBwaW5zLnNwbGljZShpZHgsIDAsIG1vdmVkKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgZmlsZSB0cmVlIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3Rm9sZGVyKGVsOiBIVE1MRWxlbWVudCwgZm9sZGVyOiBURm9sZGVyKSB7XG4gICAgICAgIGNvbnN0IGV4cGFuZGVkID0gbmV3IFNldCh0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzKTtcbiAgICAgICAgY29uc3QgYWN0aXZlUGF0aCA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk/LnBhdGg7XG5cbiAgICAgICAgY29uc3Qgc29ydGVkID0gWy4uLmZvbGRlci5jaGlsZHJlbl0uc29ydCgoYSwgYikgPT4ge1xuICAgICAgICAgICAgaWYgKChhIGluc3RhbmNlb2YgVEZvbGRlcikgIT09IChiIGluc3RhbmNlb2YgVEZvbGRlcikpIHJldHVybiBhIGluc3RhbmNlb2YgVEZvbGRlciA/IC0xIDogMTtcbiAgICAgICAgICAgIGNvbnN0IGNtcCA9IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5kYXRhLnNvcnRPcmRlciA9PT0gJ2FzYycgPyBjbXAgOiAtY21wO1xuICAgICAgICB9KTtcblxuICAgICAgICBmb3IgKGNvbnN0IGNoaWxkIG9mIHNvcnRlZCkge1xuICAgICAgICAgICAgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgICAgICAgIGNvbnN0IG9wZW4gPSBleHBhbmRlZC5oYXMoY2hpbGQucGF0aCk7XG4gICAgICAgICAgICAgICAgY29uc3Qgd3JhcCA9IGVsLmNyZWF0ZURpdignZnB2LWZvbGRlcicpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGhlYWQgPSB3cmFwLmNyZWF0ZURpdignZnB2LWZvbGRlci1oZWFkJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgYXJyb3cgPSBoZWFkLmNyZWF0ZVNwYW4oJ2Zwdi1hcnJvdycpO1xuICAgICAgICAgICAgICAgIHNldEljb24oYXJyb3csIG9wZW4gPyAnY2hldnJvbi1kb3duJyA6ICdjaGV2cm9uLXJpZ2h0Jyk7XG4gICAgICAgICAgICAgICAgaGVhZC5jcmVhdGVTcGFuKHsgdGV4dDogY2hpbGQubmFtZSB9KTtcblxuICAgICAgICAgICAgICAgIGNvbnN0IGJvZHkgPSB3cmFwLmNyZWF0ZURpdignZnB2LWZvbGRlci1ib2R5Jyk7XG4gICAgICAgICAgICAgICAgaWYgKG9wZW4pIHsgYm9keS5hZGRDbGFzcygnaXMtb3BlbicpOyB0aGlzLmRyYXdGb2xkZXIoYm9keSwgY2hpbGQpOyB9XG5cbiAgICAgICAgICAgICAgICBoZWFkLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50b2dnbGUoY2hpbGQucGF0aCkpO1xuICAgICAgICAgICAgICAgIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHRoaXMuc2hvd0ZpbGVNZW51KGUsIGNoaWxkKSk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNoaWxkIGluc3RhbmNlb2YgVEZpbGUpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByb3cgPSBlbC5jcmVhdGVEaXYoJ2Zwdi1maWxlJyk7XG4gICAgICAgICAgICAgICAgaWYgKGNoaWxkLnBhdGggPT09IGFjdGl2ZVBhdGgpIHJvdy5hZGRDbGFzcygnaXMtYWN0aXZlJyk7XG4gICAgICAgICAgICAgICAgcm93LmNyZWF0ZVNwYW4oeyB0ZXh0OiBjaGlsZC5leHRlbnNpb24gPT09ICdtZCcgPyBjaGlsZC5iYXNlbmFtZSA6IGNoaWxkLm5hbWUgfSk7XG4gICAgICAgICAgICAgICAgcm93LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShjaGlsZCkpO1xuICAgICAgICAgICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4gdGhpcy5zaG93RmlsZU1lbnUoZSwgY2hpbGQpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgdG9nZ2xlKHBhdGg6IHN0cmluZykge1xuICAgICAgICBjb25zdCBsaXN0ID0gdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycztcbiAgICAgICAgY29uc3QgYXQgPSBsaXN0LmluZGV4T2YocGF0aCk7XG4gICAgICAgIGlmIChhdCA+PSAwKSBsaXN0LnNwbGljZShhdCwgMSk7IGVsc2UgbGlzdC5wdXNoKHBhdGgpO1xuICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIGNvbnRleHQgbWVudXMgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIHNob3dSb290TWVudShlOiBNb3VzZUV2ZW50KSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgaWYgKCF0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgcmV0dXJuO1xuICAgICAgICBuZXcgTWVudSgpXG4gICAgICAgICAgICAuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBub3RlJykuc2V0SWNvbignZmlsZS1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KGZhbHNlLCB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCEpKSlcbiAgICAgICAgICAgIC5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnTmV3IGZvbGRlcicpLnNldEljb24oJ2ZvbGRlci1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KHRydWUsIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoISkpKVxuICAgICAgICAgICAgLnNob3dBdE1vdXNlRXZlbnQoZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzaG93RmlsZU1lbnUoZTogTW91c2VFdmVudCwgZmlsZTogVEFic3RyYWN0RmlsZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGNvbnN0IG1lbnUgPSBuZXcgTWVudSgpO1xuXG4gICAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikge1xuICAgICAgICAgICAgY29uc3QgcGlubmVkID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuaW5jbHVkZXMoZmlsZS5wYXRoKTtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGlcbiAgICAgICAgICAgICAgICAuc2V0VGl0bGUocGlubmVkID8gJ1VucGluIGZvbGRlcicgOiAnUGluIGZvbGRlcicpLnNldEljb24oJ3BpbicpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gcGlubmVkID8gdGhpcy51bnBpbihmaWxlLnBhdGgpIDogdGhpcy5waW4oZmlsZS5wYXRoKSkpO1xuICAgICAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnTmV3IG5vdGUnKS5zZXRJY29uKCdmaWxlLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkoZmFsc2UsIGZpbGUucGF0aCkpKTtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBmb2xkZXInKS5zZXRJY29uKCdmb2xkZXItcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeSh0cnVlLCBmaWxlLnBhdGgpKSk7XG4gICAgICAgICAgICBtZW51LmFkZFNlcGFyYXRvcigpO1xuICAgICAgICB9XG5cbiAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnUmVuYW1lJykuc2V0SWNvbigncGVuY2lsJykub25DbGljaygoKSA9PiB0aGlzLnJlbmFtZUZpbGUoZmlsZSkpKTtcbiAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnRGVsZXRlJykuc2V0SWNvbigndHJhc2gnKS5vbkNsaWNrKCgpID0+IHRoaXMuZGVsZXRlRmlsZShmaWxlKSkpO1xuXG4gICAgICAgIG1lbnUuc2hvd0F0TW91c2VFdmVudChlKTtcbiAgICB9XG5cbiAgICAvLyBcdTI1MDBcdTI1MDAgZmlsZSBvcGVyYXRpb25zIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBjcmVhdGVFbnRyeShpc0ZvbGRlcjogYm9vbGVhbiwgcGFyZW50UGF0aDogc3RyaW5nKSB7XG4gICAgICAgIG5ldyBQcm9tcHRNb2RhbChcbiAgICAgICAgICAgIHRoaXMuYXBwLFxuICAgICAgICAgICAgaXNGb2xkZXIgPyAnTmV3IGZvbGRlcicgOiAnTmV3IG5vdGUnLFxuICAgICAgICAgICAgaXNGb2xkZXIgPyAnRm9sZGVyIG5hbWUnIDogJ05vdGUgbmFtZScsXG4gICAgICAgICAgICBhc3luYyBuYW1lID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXRoID0gKHBhcmVudFBhdGggPyBwYXJlbnRQYXRoICsgJy8nIDogJycpICsgbmFtZSArIChpc0ZvbGRlciA/ICcnIDogJy5tZCcpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCkpIHsgbmV3IE5vdGljZSgnQWxyZWFkeSBleGlzdHMuJyk7IHJldHVybjsgfVxuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc0ZvbGRlcikge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlRm9sZGVyKHBhdGgpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZShwYXRoLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhZigpLm9wZW5GaWxlKGZpbGUpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyKSB7IG5ldyBOb3RpY2UoJ0NvdWxkIG5vdCBjcmVhdGU6ICcgKyBTdHJpbmcoZXJyKSk7IH1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICkub3BlbigpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVuYW1lRmlsZShmaWxlOiBUQWJzdHJhY3RGaWxlKSB7XG4gICAgICAgIGNvbnN0IG9sZE5hbWUgPSBmaWxlIGluc3RhbmNlb2YgVEZpbGUgPyBmaWxlLmJhc2VuYW1lIDogZmlsZS5uYW1lO1xuICAgICAgICBuZXcgUHJvbXB0TW9kYWwodGhpcy5hcHAsICdSZW5hbWUnLCBvbGROYW1lLCBhc3luYyBuZXdOYW1lID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHBhcmVudCA9IGZpbGUucGFyZW50Py5wYXRoID8/ICcnO1xuICAgICAgICAgICAgY29uc3Qgc3VmZml4ID0gZmlsZSBpbnN0YW5jZW9mIFRGaWxlID8gJy4nICsgZmlsZS5leHRlbnNpb24gOiAnJztcbiAgICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSAocGFyZW50ID8gcGFyZW50ICsgJy8nIDogJycpICsgbmV3TmFtZSArIHN1ZmZpeDtcbiAgICAgICAgICAgIHRyeSB7IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlbmFtZShmaWxlLCBuZXdQYXRoKTsgfVxuICAgICAgICAgICAgY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdSZW5hbWUgZmFpbGVkOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgICAgIH0pLm9wZW4oKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGRlbGV0ZUZpbGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuICAgICAgICB0cnkgeyBhd2FpdCB0aGlzLmFwcC5maWxlTWFuYWdlci50cmFzaEZpbGUoZmlsZSk7IH1cbiAgICAgICAgY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdEZWxldGUgZmFpbGVkOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIHBpbiBtYW5hZ2VtZW50IChjYWxsZWQgYnkgcGx1Z2luIHRvbykgXHUyNTAwXHUyNTAwXG5cbiAgICBwaW4ocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGlubmVkRm9sZGVycy5pbmNsdWRlcyhwYXRoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5wdXNoKHBhdGgpO1xuICAgICAgICBpZiAoIXRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHBhdGg7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVucGluKHBhdGg6IHN0cmluZykge1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZpbHRlcihwID0+IHAgIT09IHBhdGgpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPT09IHBhdGgpXG4gICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzWzBdID8/IG51bGw7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvbGRlclBpblBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gICAgZGF0YTogUGx1Z2luRGF0YSA9IHsgLi4uREVGQVVMVF9EQVRBIH07XG4gICAgcHJpdmF0ZSBzYXZlID0gZGVib3VuY2UoKCkgPT4gdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpLCA0MDAsIHRydWUpO1xuXG4gICAgYXN5bmMgb25sb2FkKCkge1xuICAgICAgICB0aGlzLmRhdGEgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9EQVRBIH0sIGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIGxlYWYgPT5cbiAgICAgICAgICAgIG5ldyBGb2xkZXJQaW5WaWV3KGxlYWYsIHRoaXMuZGF0YSwgKCkgPT4gdGhpcy5zYXZlKCkpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuYWRkUmliYm9uSWNvbigncGluJywgJ0ZvbGRlciBQaW4gVmlldycsICgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuXG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlLCBzb3VyY2UpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IFZJRVdfVFlQRSB8fCAhKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuO1xuICAgICAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnUGluIGZvbGRlcicpLnNldEljb24oJ3BpbicpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5nZXRWaWV3KCk/LnBpbihmaWxlLnBhdGgpKSk7XG4gICAgICAgIH0pKTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2NyZWF0ZScsICAoKSAgICAgID0+IHRoaXMucmVmcmVzaCgpKSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignZGVsZXRlJywgIGYgICAgICAgPT4geyB0aGlzLm9uRGVsZXRlKGYucGF0aCk7IHRoaXMucmVmcmVzaCgpOyB9KSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgIChmLCBvbGQpID0+IHsgdGhpcy5vblJlbmFtZShmLnBhdGgsIG9sZCk7IHRoaXMucmVmcmVzaCgpOyB9KSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtb3BlbicsICgpID0+IHRoaXMucmVmcmVzaCgpKSk7XG5cbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4gdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG4gICAgfVxuXG4gICAgb251bmxvYWQoKSB7fVxuXG4gICAgcHJpdmF0ZSBvbkRlbGV0ZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgZ29uZSA9IChwOiBzdHJpbmcpID0+IHAgPT09IHBhdGggfHwgcC5zdGFydHNXaXRoKHBhdGggKyAnLycpO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyAgID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZmlsdGVyKHAgPT4gIWdvbmUocCkpO1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5maWx0ZXIocCA9PiAhZ29uZShwKSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCAmJiBnb25lKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSlcbiAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnNbMF0gPz8gbnVsbDtcbiAgICAgICAgdGhpcy5zYXZlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblJlbmFtZShwYXRoOiBzdHJpbmcsIG9sZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlbWFwID0gKHA6IHN0cmluZykgPT5cbiAgICAgICAgICAgIHAgPT09IG9sZCA/IHBhdGggOiBwLnN0YXJ0c1dpdGgob2xkICsgJy8nKSA/IHBhdGggKyBwLnNsaWNlKG9sZC5sZW5ndGgpIDogcDtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMgICA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLm1hcChyZW1hcCk7XG4gICAgICAgIHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMgPSB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzLm1hcChyZW1hcCk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSByZW1hcCh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCk7XG4gICAgICAgIHRoaXMuc2F2ZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVmcmVzaCgpIHsgdGhpcy5nZXRWaWV3KCk/LnJlZnJlc2goKTsgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKSB7XG4gICAgICAgIGlmICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVmdExlYWYoZmFsc2UpPy5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFZpZXcoKTogRm9sZGVyUGluVmlldyB8IG51bGwge1xuICAgICAgICByZXR1cm4gKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKVswXT8udmlldyBhcyBGb2xkZXJQaW5WaWV3KSA/PyBudWxsO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBR087QUFFUCxJQUFNLFlBQVk7QUFTbEIsSUFBTSxlQUEyQixFQUFFLGVBQWUsQ0FBQyxHQUFHLGtCQUFrQixNQUFNLGlCQUFpQixDQUFDLEdBQUcsV0FBVyxNQUFNO0FBSXBILElBQU0sY0FBTixjQUEwQixzQkFBTTtBQUFBLEVBRzVCLFlBQ0ksS0FDUSxTQUNBLFNBQ0EsVUFDVjtBQUFFLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFDQTtBQUNJLFNBQUssUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUV0QyxTQUFTO0FBQ0wsU0FBSyxRQUFRLFFBQVEsS0FBSyxPQUFPO0FBQ2pDLFFBQUksd0JBQVEsS0FBSyxTQUFTLEVBQUUsUUFBUSxPQUFLO0FBQ3JDLFFBQUUsU0FBUyxLQUFLLE9BQU8sRUFBRSxTQUFTLE9BQU0sS0FBSyxRQUFRLENBQUU7QUFDdkQsUUFBRSxRQUFRLE9BQU87QUFDakIsUUFBRSxRQUFRLE1BQU07QUFDaEIsUUFBRSxRQUFRLGlCQUFpQixXQUFXLE9BQUs7QUFDdkMsWUFBSSxFQUFFLFFBQVEsU0FBUztBQUFFLFlBQUUsZUFBZTtBQUFHLGVBQUssT0FBTztBQUFBLFFBQUc7QUFBQSxNQUNoRSxDQUFDO0FBQUEsSUFDTCxDQUFDO0FBQ0QsUUFBSSx3QkFBUSxLQUFLLFNBQVMsRUFDckIsVUFBVSxPQUFLLEVBQUUsY0FBYyxJQUFJLEVBQUUs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
