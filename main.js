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
    void this.onSubmit(name);
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
    this.drawToolbar();
    this.drawPinBar();
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
        row.addEventListener("click", () => void this.app.workspace.getLeaf().openFile(child));
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQXBwLCBJdGVtVmlldywgTWVudSwgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBTZXR0aW5nLFxuICAgIFRBYnN0cmFjdEZpbGUsIFRGaWxlLCBURm9sZGVyLCBXb3Jrc3BhY2VMZWFmLCBkZWJvdW5jZSwgc2V0SWNvbixcbn0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBWSUVXX1RZUEUgPSAnZm9sZGVyLXBpbi12aWV3JztcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICAgIHBpbm5lZEZvbGRlcnM6IHN0cmluZ1tdO1xuICAgIGFjdGl2ZUZvbGRlclBhdGg6IHN0cmluZyB8IG51bGw7XG4gICAgZXhwYW5kZWRGb2xkZXJzOiBzdHJpbmdbXTtcbiAgICBzb3J0T3JkZXI6ICdhc2MnIHwgJ2Rlc2MnO1xufVxuXG5jb25zdCBERUZBVUxUX0RBVEE6IFBsdWdpbkRhdGEgPSB7IHBpbm5lZEZvbGRlcnM6IFtdLCBhY3RpdmVGb2xkZXJQYXRoOiBudWxsLCBleHBhbmRlZEZvbGRlcnM6IFtdLCBzb3J0T3JkZXI6ICdhc2MnIH07XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFByb21wdE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgdmFsdWU6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBhcHA6IEFwcCxcbiAgICAgICAgcHJpdmF0ZSBoZWFkaW5nOiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgaW5pdGlhbDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIG9uU3VibWl0OiAobmFtZTogc3RyaW5nKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPixcbiAgICApIHsgc3VwZXIoYXBwKTsgdGhpcy52YWx1ZSA9IGluaXRpYWw7IH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQodGhpcy5oZWFkaW5nKTtcbiAgICAgICAgbmV3IFNldHRpbmcodGhpcy5jb250ZW50RWwpLmFkZFRleHQodCA9PiB7XG4gICAgICAgICAgICB0LnNldFZhbHVlKHRoaXMuaW5pdGlhbCkub25DaGFuZ2UodiA9PiAodGhpcy52YWx1ZSA9IHYpKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5zZWxlY3QoKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5mb2N1cygpO1xuICAgICAgICAgICAgdC5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnN1Ym1pdCgpOyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHRoaXMuY29udGVudEVsKVxuICAgICAgICAgICAgLmFkZEJ1dHRvbihiID0+IGIuc2V0QnV0dG9uVGV4dCgnT0snKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHRoaXMuc3VibWl0KCkpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN1Ym1pdCgpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMudmFsdWUudHJpbSgpO1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB2b2lkIHRoaXMub25TdWJtaXQobmFtZSk7XG4gICAgfVxuXG4gICAgb25DbG9zZSgpIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgVmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyUGluVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgICBwcml2YXRlIGRyYWdJbmRleCA9IC0xO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgICAgIHByaXZhdGUgZGF0YTogUGx1Z2luRGF0YSxcbiAgICAgICAgcHJpdmF0ZSBwZXJzaXN0OiAoKSA9PiB2b2lkLFxuICAgICkgeyBzdXBlcihsZWFmKTsgfVxuXG4gICAgZ2V0Vmlld1R5cGUoKSAgICB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgICBnZXREaXNwbGF5VGV4dCgpIHsgcmV0dXJuICdGb2xkZXIgUGluJzsgfVxuICAgIGdldEljb24oKSAgICAgICAgeyByZXR1cm4gJ3Bpbic7IH1cblxuICAgIGFzeW5jIG9uT3BlbigpICB7IHRoaXMuY29udGVudEVsLmFkZENsYXNzKCdmcHYtcm9vdCcpOyB0aGlzLmRyYXcoKTsgfVxuICAgIGFzeW5jIG9uQ2xvc2UoKSB7fVxuXG4gICAgcmVmcmVzaCA9IGRlYm91bmNlKCgpID0+IHRoaXMuZHJhdygpLCAxMDAsIHRydWUpO1xuXG4gICAgZHJhdygpIHtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICAgICAgdGhpcy5kcmF3VG9vbGJhcigpO1xuICAgICAgICB0aGlzLmRyYXdQaW5CYXIoKTtcblxuICAgICAgICBjb25zdCB0cmVlID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtdHJlZScpO1xuICAgICAgICB0cmVlLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHRyZWUpIHRoaXMuc2hvd1Jvb3RNZW51KGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aFxuICAgICAgICAgICAgPyB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpXG4gICAgICAgICAgICA6IHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcblxuICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVEZvbGRlcikgdGhpcy5kcmF3Rm9sZGVyKHRyZWUsIHRhcmdldCk7XG4gICAgICAgIGVsc2UgdHJlZS5jcmVhdGVEaXYoeyBjbHM6ICdmcHYtZW1wdHknLCB0ZXh0OiAnUmlnaHQtY2xpY2sgYSBmb2xkZXIgYW5kIGNob29zZSBcIlBpbiBmb2xkZXJcIi4nIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCB0b29sYmFyIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3VG9vbGJhcigpIHtcbiAgICAgICAgY29uc3QgYmFyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtdG9vbGJhcicpO1xuICAgICAgICBjb25zdCBidG4gPSAoaWNvbjogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBmbjogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYiA9IGJhci5jcmVhdGVEaXYoeyBjbHM6ICdmcHYtdG9vbCcsIGF0dHI6IHsgJ2FyaWEtbGFiZWwnOiBsYWJlbCB9IH0pO1xuICAgICAgICAgICAgc2V0SWNvbihiLCBpY29uKTtcbiAgICAgICAgICAgIGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmbik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGJhc2UgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA/PyAnJztcbiAgICAgICAgYnRuKCdzcXVhcmUtcGVuJywgICAgJ05ldyBub3RlJywgICAgICAgKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgYmFzZSkpO1xuICAgICAgICBidG4oJ2ZvbGRlci1wbHVzJywgICAnTmV3IGZvbGRlcicsICAgICAoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KHRydWUsIGJhc2UpKTtcbiAgICAgICAgYnRuKCdhcnJvdy11cC1heicsICAgJ1NvcnQgJyArICh0aGlzLmRhdGEuc29ydE9yZGVyID09PSAnYXNjJyA/ICdaXHUyMTkyQScgOiAnQVx1MjE5MlonKSwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5kYXRhLnNvcnRPcmRlciA9IHRoaXMuZGF0YS5zb3J0T3JkZXIgPT09ICdhc2MnID8gJ2Rlc2MnIDogJ2FzYyc7XG4gICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnRuKCdjaGV2cm9ucy11cC1kb3duJywgJ0V4cGFuZCBhbGwnLCAgKCkgPT4gdGhpcy5leHBhbmRBbGwoKSk7XG4gICAgICAgIGJ0bignY2hldnJvbnMtZG93bi11cCcsICdDb2xsYXBzZSBhbGwnLCgpID0+IHRoaXMuY29sbGFwc2VBbGwoKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHBhbmRBbGwoKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoXG4gICAgICAgICAgICA/IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aClcbiAgICAgICAgICAgIDogdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICAgICAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBjb2xsZWN0ID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHsgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5wdXNoKGNoaWxkLnBhdGgpOyBjb2xsZWN0KGNoaWxkKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gW107XG4gICAgICAgIGNvbGxlY3QodGFyZ2V0KTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29sbGFwc2VBbGwoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBwaW4gYmFyIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3UGluQmFyKCkge1xuICAgICAgICBjb25zdCBiYXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoJ2Zwdi1iYXInKTtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZm9yRWFjaCgocGF0aCwgaWR4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBidG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgICAgICAgICAgICBjbHM6ICdmcHYtYnRuJyxcbiAgICAgICAgICAgICAgICB0ZXh0OiBwYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgcGF0aCxcbiAgICAgICAgICAgICAgICB0aXRsZTogcGF0aCxcbiAgICAgICAgICAgICAgICBhdHRyOiB7IGRyYWdnYWJsZTogJ3RydWUnIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgYnRuLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcblxuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcGF0aDtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIG5ldyBNZW51KClcbiAgICAgICAgICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdVbnBpbicpLnNldEljb24oJ3gnKS5vbkNsaWNrKCgpID0+IHRoaXMudW5waW4ocGF0aCkpKVxuICAgICAgICAgICAgICAgICAgICAuc2hvd0F0TW91c2VFdmVudChlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBkcmFnLXRvLXJlb3JkZXJcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCAoKSA9PiB7IHRoaXMuZHJhZ0luZGV4ID0gaWR4OyBidG4uYWRkQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7IH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCAgICgpID0+IHsgdGhpcy5kcmFnSW5kZXggPSAtMTsgIGJ0bi5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmcnKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAgZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgYnRuLmFkZENsYXNzKCdkcmFnLW92ZXInKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgKCkgPT4gYnRuLnJlbW92ZUNsYXNzKCdkcmFnLW92ZXInKSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGUgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBidG4ucmVtb3ZlQ2xhc3MoJ2RyYWctb3ZlcicpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRyYWdJbmRleCA8IDAgfHwgdGhpcy5kcmFnSW5kZXggPT09IGlkeCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpbnMgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycztcbiAgICAgICAgICAgICAgICBjb25zdCBbbW92ZWRdID0gcGlucy5zcGxpY2UodGhpcy5kcmFnSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHBpbnMuc3BsaWNlKGlkeCwgMCwgbW92ZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBmaWxlIHRyZWUgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIGRyYXdGb2xkZXIoZWw6IEhUTUxFbGVtZW50LCBmb2xkZXI6IFRGb2xkZXIpIHtcbiAgICAgICAgY29uc3QgZXhwYW5kZWQgPSBuZXcgU2V0KHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMpO1xuICAgICAgICBjb25zdCBhY3RpdmVQYXRoID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKT8ucGF0aDtcblxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4uZm9sZGVyLmNoaWxkcmVuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICBpZiAoKGEgaW5zdGFuY2VvZiBURm9sZGVyKSAhPT0gKGIgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuIGEgaW5zdGFuY2VvZiBURm9sZGVyID8gLTEgOiAxO1xuICAgICAgICAgICAgY29uc3QgY21wID0gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRhdGEuc29ydE9yZGVyID09PSAnYXNjJyA/IGNtcCA6IC1jbXA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygc29ydGVkKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IGV4cGFuZGVkLmhhcyhjaGlsZC5wYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwID0gZWwuY3JlYXRlRGl2KCdmcHYtZm9sZGVyJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZCA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWhlYWQnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnJvdyA9IGhlYWQuY3JlYXRlU3BhbignZnB2LWFycm93Jyk7XG4gICAgICAgICAgICAgICAgc2V0SWNvbihhcnJvdywgb3BlbiA/ICdjaGV2cm9uLWRvd24nIDogJ2NoZXZyb24tcmlnaHQnKTtcbiAgICAgICAgICAgICAgICBoZWFkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjaGlsZC5uYW1lIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWJvZHknKTtcbiAgICAgICAgICAgICAgICBpZiAob3BlbikgeyBib2R5LmFkZENsYXNzKCdpcy1vcGVuJyk7IHRoaXMuZHJhd0ZvbGRlcihib2R5LCBjaGlsZCk7IH1cblxuICAgICAgICAgICAgICAgIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnRvZ2dsZShjaGlsZC5wYXRoKSk7XG4gICAgICAgICAgICAgICAgaGVhZC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4gdGhpcy5zaG93RmlsZU1lbnUoZSwgY2hpbGQpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGVsLmNyZWF0ZURpdignZnB2LWZpbGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQucGF0aCA9PT0gYWN0aXZlUGF0aCkgcm93LmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJyA/IGNoaWxkLmJhc2VuYW1lIDogY2hpbGQubmFtZSB9KTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoY2hpbGQpKTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHRoaXMuc2hvd0ZpbGVNZW51KGUsIGNoaWxkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnM7XG4gICAgICAgIGNvbnN0IGF0ID0gbGlzdC5pbmRleE9mKHBhdGgpO1xuICAgICAgICBpZiAoYXQgPj0gMCkgbGlzdC5zcGxpY2UoYXQsIDEpOyBlbHNlIGxpc3QucHVzaChwYXRoKTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBjb250ZXh0IG1lbnVzIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBzaG93Um9vdE1lbnUoZTogTW91c2VFdmVudCkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmICghdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHJldHVybjtcbiAgICAgICAgbmV3IE1lbnUoKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgbm90ZScpLnNldEljb24oJ2ZpbGUtcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGghKSkpXG4gICAgICAgICAgICAuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBmb2xkZXInKS5zZXRJY29uKCdmb2xkZXItcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeSh0cnVlLCB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCEpKSlcbiAgICAgICAgICAgIC5zaG93QXRNb3VzZUV2ZW50KGUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2hvd0ZpbGVNZW51KGU6IE1vdXNlRXZlbnQsIGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblxuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpbm5lZCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmluY2x1ZGVzKGZpbGUucGF0aCk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpXG4gICAgICAgICAgICAgICAgLnNldFRpdGxlKHBpbm5lZCA/ICdVbnBpbiBmb2xkZXInIDogJ1BpbiBmb2xkZXInKS5zZXRJY29uKCdwaW4nKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHBpbm5lZCA/IHRoaXMudW5waW4oZmlsZS5wYXRoKSA6IHRoaXMucGluKGZpbGUucGF0aCkpKTtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBub3RlJykuc2V0SWNvbignZmlsZS1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KGZhbHNlLCBmaWxlLnBhdGgpKSk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgZm9sZGVyJykuc2V0SWNvbignZm9sZGVyLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkodHJ1ZSwgZmlsZS5wYXRoKSkpO1xuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1JlbmFtZScpLnNldEljb24oJ3BlbmNpbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5yZW5hbWVGaWxlKGZpbGUpKSk7XG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ0RlbGV0ZScpLnNldEljb24oJ3RyYXNoJykub25DbGljaygoKSA9PiB0aGlzLmRlbGV0ZUZpbGUoZmlsZSkpKTtcblxuICAgICAgICBtZW51LnNob3dBdE1vdXNlRXZlbnQoZSk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIGZpbGUgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgY3JlYXRlRW50cnkoaXNGb2xkZXI6IGJvb2xlYW4sIHBhcmVudFBhdGg6IHN0cmluZykge1xuICAgICAgICBuZXcgUHJvbXB0TW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ05ldyBmb2xkZXInIDogJ05ldyBub3RlJyxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ0ZvbGRlciBuYW1lJyA6ICdOb3RlIG5hbWUnLFxuICAgICAgICAgICAgYXN5bmMgbmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IChwYXJlbnRQYXRoID8gcGFyZW50UGF0aCArICcvJyA6ICcnKSArIG5hbWUgKyAoaXNGb2xkZXIgPyAnJyA6ICcubWQnKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpKSB7IG5ldyBOb3RpY2UoJ0FscmVhZHkgZXhpc3RzLicpOyByZXR1cm47IH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGb2xkZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZUZvbGRlcihwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdDb3VsZCBub3QgY3JlYXRlOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICApLm9wZW4oKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlbmFtZUZpbGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuICAgICAgICBjb25zdCBvbGROYW1lID0gZmlsZSBpbnN0YW5jZW9mIFRGaWxlID8gZmlsZS5iYXNlbmFtZSA6IGZpbGUubmFtZTtcbiAgICAgICAgbmV3IFByb21wdE1vZGFsKHRoaXMuYXBwLCAnUmVuYW1lJywgb2xkTmFtZSwgYXN5bmMgbmV3TmFtZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBmaWxlLnBhcmVudD8ucGF0aCA/PyAnJztcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGZpbGUgaW5zdGFuY2VvZiBURmlsZSA/ICcuJyArIGZpbGUuZXh0ZW5zaW9uIDogJyc7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gKHBhcmVudCA/IHBhcmVudCArICcvJyA6ICcnKSArIG5ld05hbWUgKyBzdWZmaXg7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZW5hbWUoZmlsZSwgbmV3UGF0aCk7IH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbmV3IE5vdGljZSgnUmVuYW1lIGZhaWxlZDogJyArIFN0cmluZyhlcnIpKTsgfVxuICAgICAgICB9KS5vcGVuKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgdHJ5IHsgYXdhaXQgdGhpcy5hcHAuZmlsZU1hbmFnZXIudHJhc2hGaWxlKGZpbGUpOyB9XG4gICAgICAgIGNhdGNoIChlcnIpIHsgbmV3IE5vdGljZSgnRGVsZXRlIGZhaWxlZDogJyArIFN0cmluZyhlcnIpKTsgfVxuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBwaW4gbWFuYWdlbWVudCAoY2FsbGVkIGJ5IHBsdWdpbiB0b28pIFx1MjUwMFx1MjUwMFxuXG4gICAgcGluKHBhdGg6IHN0cmluZykge1xuICAgICAgICBpZiAodGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuaW5jbHVkZXMocGF0aCkpIHJldHVybjtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMucHVzaChwYXRoKTtcbiAgICAgICAgaWYgKCF0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSBwYXRoO1xuICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB1bnBpbihwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5maWx0ZXIocCA9PiBwICE9PSBwYXRoKTtcbiAgICAgICAgaWYgKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID09PSBwYXRoKVxuICAgICAgICAgICAgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSB0aGlzLmRhdGEucGlubmVkRm9sZGVyc1swXSA/PyBudWxsO1xuICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgUGx1Z2luIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBGb2xkZXJQaW5QbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuICAgIGRhdGE6IFBsdWdpbkRhdGEgPSB7IC4uLkRFRkFVTFRfREFUQSB9O1xuICAgIHByaXZhdGUgc2F2ZSA9IGRlYm91bmNlKCgpID0+IHRoaXMuc2F2ZURhdGEodGhpcy5kYXRhKSwgNDAwLCB0cnVlKTtcblxuICAgIGFzeW5jIG9ubG9hZCgpIHtcbiAgICAgICAgdGhpcy5kYXRhID0gT2JqZWN0LmFzc2lnbih7IC4uLkRFRkFVTFRfREFUQSB9LCBhd2FpdCB0aGlzLmxvYWREYXRhKCkgYXMgUGFydGlhbDxQbHVnaW5EYXRhPik7XG5cbiAgICAgICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCBsZWFmID0+XG4gICAgICAgICAgICBuZXcgRm9sZGVyUGluVmlldyhsZWFmLCB0aGlzLmRhdGEsICgpID0+IHRoaXMuc2F2ZSgpKVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oJ3BpbicsICdGb2xkZXIgUGluIFZpZXcnLCAoKSA9PiB0aGlzLmFjdGl2YXRlVmlldygpKTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudSwgZmlsZSwgc291cmNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSBWSUVXX1RZUEUgfHwgIShmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikpIHJldHVybjtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1BpbiBmb2xkZXInKS5zZXRJY29uKCdwaW4nKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuZ2V0VmlldygpPy5waW4oZmlsZS5wYXRoKSkpO1xuICAgICAgICB9KSk7XG5cbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAgKCkgICAgICA9PiB0aGlzLnJlZnJlc2goKSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsICBmICAgICAgID0+IHsgdGhpcy5vbkRlbGV0ZShmLnBhdGgpOyB0aGlzLnJlZnJlc2goKTsgfSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsICAoZiwgb2xkKSA9PiB7IHRoaXMub25SZW5hbWUoZi5wYXRoLCBvbGQpOyB0aGlzLnJlZnJlc2goKTsgfSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW9wZW4nLCAoKSA9PiB0aGlzLnJlZnJlc2goKSkpO1xuXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICAgIH1cblxuICAgIG9udW5sb2FkKCkge31cblxuICAgIHByaXZhdGUgb25EZWxldGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGdvbmUgPSAocDogc3RyaW5nKSA9PiBwID09PSBwYXRoIHx8IHAuc3RhcnRzV2l0aChwYXRoICsgJy8nKTtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMgICA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZpbHRlcihwID0+ICFnb25lKHApKTtcbiAgICAgICAgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycyA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMuZmlsdGVyKHAgPT4gIWdvbmUocCkpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggJiYgZ29uZSh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkpXG4gICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzWzBdID8/IG51bGw7XG4gICAgICAgIHRoaXMuc2F2ZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25SZW5hbWUocGF0aDogc3RyaW5nLCBvbGQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZW1hcCA9IChwOiBzdHJpbmcpID0+XG4gICAgICAgICAgICBwID09PSBvbGQgPyBwYXRoIDogcC5zdGFydHNXaXRoKG9sZCArICcvJykgPyBwYXRoICsgcC5zbGljZShvbGQubGVuZ3RoKSA6IHA7XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzICAgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5tYXAocmVtYXApO1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5tYXAocmVtYXApO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcmVtYXAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpO1xuICAgICAgICB0aGlzLnNhdmUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZnJlc2goKSB7IHRoaXMuZ2V0VmlldygpPy5yZWZyZXNoKCk7IH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgICAgICBpZiAodGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpLmxlbmd0aCA+IDApIHJldHVybjtcbiAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlZnRMZWFmKGZhbHNlKT8uc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRWaWV3KCk6IEZvbGRlclBpblZpZXcgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSlbMF0/LnZpZXcgYXMgRm9sZGVyUGluVmlldykgPz8gbnVsbDtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUdPO0FBRVAsSUFBTSxZQUFZO0FBU2xCLElBQU0sZUFBMkIsRUFBRSxlQUFlLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxpQkFBaUIsQ0FBQyxHQUFHLFdBQVcsTUFBTTtBQUlwSCxJQUFNLGNBQU4sY0FBMEIsc0JBQU07QUFBQSxFQUc1QixZQUNJLEtBQ1EsU0FDQSxTQUNBLFVBQ1Y7QUFBRSxVQUFNLEdBQUc7QUFIRDtBQUNBO0FBQ0E7QUFDSSxTQUFLLFFBQVE7QUFBQSxFQUFTO0FBQUEsRUFFdEMsU0FBUztBQUNMLFNBQUssUUFBUSxRQUFRLEtBQUssT0FBTztBQUNqQyxRQUFJLHdCQUFRLEtBQUssU0FBUyxFQUFFLFFBQVEsT0FBSztBQUNyQyxRQUFFLFNBQVMsS0FBSyxPQUFPLEVBQUUsU0FBUyxPQUFNLEtBQUssUUFBUSxDQUFFO0FBQ3ZELFFBQUUsUUFBUSxPQUFPO0FBQ2pCLFFBQUUsUUFBUSxNQUFNO0FBQ2hCLFFBQUUsUUFBUSxpQkFBaUIsV0FBVyxPQUFLO0FBQ3ZDLFlBQUksRUFBRSxRQUFRLFNBQVM7QUFBRSxZQUFFLGVBQWU7QUFBRyxlQUFLLE9BQU87QUFBQSxRQUFHO0FBQUEsTUFDaEUsQ0FBQztBQUFBLElBQ0wsQ0FBQztBQUNELFFBQUksd0JBQVEsS0FBSyxTQUFTLEVBQ3JCLFVBQVUsT0FBSyxFQUFFLGNBQWMs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SyxhQUFhLENBQUM7QUFBQSxFQUM5RDtBQUFBLEVBRUEsV0FBVztBQUFBLEVBQUM7QUFBQSxFQUVKLFNBQVMsTUFBYztBQXRWbkM7QUF1VlEsVUFBTSxPQUFPLENBQUMsTUFBYyxNQUFNLFFBQVEsRUFBRSxXQUFXLE9BQU8sR0FBRztBQUNqRSxTQUFLLEtBQUssZ0JBQWtCLEtBQUssS0FBSyxjQUFjLE9BQU8sT0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3hFLFNBQUssS0FBSyxrQkFBa0IsS0FBSyxLQUFLLGdCQUFnQixPQUFPLE9BQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUMxRSxRQUFJLEtBQUssS0FBSyxvQkFBb0IsS0FBSyxLQUFLLEtBQUssZ0JBQWdCO0FBQzdELFdBQUssS0FBSyxvQkFBbUIsVUFBSyxLQUFLLGNBQWMsQ0FBQyxNQUF6QixZQUE4QjtBQUMvRCxTQUFLLEtBQUs7QUFBQSxFQUNkO0FBQUEsRUFFUSxTQUFTLE1BQWMsS0FBYTtBQUN4QyxVQUFNLFFBQVEsQ0FBQyxNQUNYLE1BQU0sTUFBTSxPQUFPLEVBQUUsV0FBVyxNQUFNLEdBQUcsSUFBSSxPQUFPLEVBQUUsTUFBTSxJQUFJLE1BQU0sSUFBSTtBQUM5RSxTQUFLLEtBQUssZ0JBQWtCLEtBQUssS0FBSyxjQUFjLElBQUksS0FBSztBQUM3RCxTQUFLLEtBQUssa0JBQWtCLEtBQUssS0FBSyxnQkFBZ0IsSUFBSSxLQUFLO0FBQy9ELFFBQUksS0FBSyxLQUFLLGlCQUFrQixNQUFLLEtBQUssbUJBQW1CLE1BQU0sS0FBSyxLQUFLLGdCQUFnQjtBQUM3RixTQUFLLEtBQUs7QUFBQSxFQUNkO0FBQUEsRUFFUSxVQUFVO0FBeFd0QjtBQXdXd0IsZUFBSyxRQUFRLE1BQWIsbUJBQWdCO0FBQUEsRUFBVztBQUFBLEVBRS9DLE1BQWMsZUFBZTtBQTFXakM7QUEyV1EsUUFBSSxLQUFLLElBQUksVUFBVSxnQkFBZ0IsU0FBUyxFQUFFLFNBQVMsRUFBRztBQUM5RCxZQUFNLFVBQUssSUFBSSxVQUFVLFlBQVksS0FBSyxNQUFwQyxtQkFBdUMsYUFBYSxFQUFFLE1BQU0sV0FBVyxRQUFRLEtBQUs7QUFBQSxFQUM5RjtBQUFBLEVBRVEsVUFBZ0M7QUEvVzVDO0FBZ1hRLFlBQVEsZ0JBQUssSUFBSSxVQUFVLGdCQUFnQixTQUFTLEVBQUUsQ0FBQyxNQUEvQyxtQkFBa0QsU0FBbEQsWUFBNEU7QUFBQSxFQUN4RjtBQUNKOyIsCiAgIm5hbWVzIjogW10KfQo=
