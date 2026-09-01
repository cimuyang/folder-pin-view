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
      await this.app.vault.trash(file, true);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQXBwLCBJdGVtVmlldywgTWVudSwgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBTZXR0aW5nLFxuICAgIFRBYnN0cmFjdEZpbGUsIFRGaWxlLCBURm9sZGVyLCBXb3Jrc3BhY2VMZWFmLCBkZWJvdW5jZSwgc2V0SWNvbixcbn0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBWSUVXX1RZUEUgPSAnZm9sZGVyLXBpbi12aWV3JztcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICAgIHBpbm5lZEZvbGRlcnM6IHN0cmluZ1tdO1xuICAgIGFjdGl2ZUZvbGRlclBhdGg6IHN0cmluZyB8IG51bGw7XG4gICAgZXhwYW5kZWRGb2xkZXJzOiBzdHJpbmdbXTtcbiAgICBzb3J0T3JkZXI6ICdhc2MnIHwgJ2Rlc2MnO1xufVxuXG5jb25zdCBERUZBVUxUX0RBVEE6IFBsdWdpbkRhdGEgPSB7IHBpbm5lZEZvbGRlcnM6IFtdLCBhY3RpdmVGb2xkZXJQYXRoOiBudWxsLCBleHBhbmRlZEZvbGRlcnM6IFtdLCBzb3J0T3JkZXI6ICdhc2MnIH07XG5cbi8vIFx1MjUwMFx1MjUwMCBQcm9tcHQgbW9kYWwgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIFByb21wdE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICAgIHByaXZhdGUgdmFsdWU6IHN0cmluZztcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBhcHA6IEFwcCxcbiAgICAgICAgcHJpdmF0ZSBoZWFkaW5nOiBzdHJpbmcsXG4gICAgICAgIHByaXZhdGUgaW5pdGlhbDogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIG9uU3VibWl0OiAobmFtZTogc3RyaW5nKSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPixcbiAgICApIHsgc3VwZXIoYXBwKTsgdGhpcy52YWx1ZSA9IGluaXRpYWw7IH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQodGhpcy5oZWFkaW5nKTtcbiAgICAgICAgbmV3IFNldHRpbmcodGhpcy5jb250ZW50RWwpLmFkZFRleHQodCA9PiB7XG4gICAgICAgICAgICB0LnNldFZhbHVlKHRoaXMuaW5pdGlhbCkub25DaGFuZ2UodiA9PiAodGhpcy52YWx1ZSA9IHYpKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5zZWxlY3QoKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5mb2N1cygpO1xuICAgICAgICAgICAgdC5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnN1Ym1pdCgpOyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHRoaXMuY29udGVudEVsKVxuICAgICAgICAgICAgLmFkZEJ1dHRvbihiID0+IGIuc2V0QnV0dG9uVGV4dCgnT0snKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHRoaXMuc3VibWl0KCkpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN1Ym1pdCgpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMudmFsdWUudHJpbSgpO1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB2b2lkIHRoaXMub25TdWJtaXQobmFtZSk7XG4gICAgfVxuXG4gICAgb25DbG9zZSgpIHsgdGhpcy5jb250ZW50RWwuZW1wdHkoKTsgfVxufVxuXG4vLyBcdTI1MDBcdTI1MDAgVmlldyBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcdTI1MDBcblxuY2xhc3MgRm9sZGVyUGluVmlldyBleHRlbmRzIEl0ZW1WaWV3IHtcbiAgICBwcml2YXRlIGRyYWdJbmRleCA9IC0xO1xuXG4gICAgY29uc3RydWN0b3IoXG4gICAgICAgIGxlYWY6IFdvcmtzcGFjZUxlYWYsXG4gICAgICAgIHByaXZhdGUgZGF0YTogUGx1Z2luRGF0YSxcbiAgICAgICAgcHJpdmF0ZSBwZXJzaXN0OiAoKSA9PiB2b2lkLFxuICAgICkgeyBzdXBlcihsZWFmKTsgfVxuXG4gICAgZ2V0Vmlld1R5cGUoKSAgICB7IHJldHVybiBWSUVXX1RZUEU7IH1cbiAgICBnZXREaXNwbGF5VGV4dCgpIHsgcmV0dXJuICdGb2xkZXIgUGluJzsgfVxuICAgIGdldEljb24oKSAgICAgICAgeyByZXR1cm4gJ3Bpbic7IH1cblxuICAgIGFzeW5jIG9uT3BlbigpICB7IHRoaXMuY29udGVudEVsLmFkZENsYXNzKCdmcHYtcm9vdCcpOyB0aGlzLmRyYXcoKTsgfVxuICAgIGFzeW5jIG9uQ2xvc2UoKSB7fVxuXG4gICAgcmVmcmVzaCA9IGRlYm91bmNlKCgpID0+IHRoaXMuZHJhdygpLCAxMDAsIHRydWUpO1xuXG4gICAgZHJhdygpIHtcbiAgICAgICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgICAgICAgdGhpcy5kcmF3VG9vbGJhcigpO1xuICAgICAgICB0aGlzLmRyYXdQaW5CYXIoKTtcblxuICAgICAgICBjb25zdCB0cmVlID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtdHJlZScpO1xuICAgICAgICB0cmVlLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICBpZiAoZS50YXJnZXQgPT09IHRyZWUpIHRoaXMuc2hvd1Jvb3RNZW51KGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aFxuICAgICAgICAgICAgPyB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpXG4gICAgICAgICAgICA6IHRoaXMuYXBwLnZhdWx0LmdldFJvb3QoKTtcblxuICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVEZvbGRlcikgdGhpcy5kcmF3Rm9sZGVyKHRyZWUsIHRhcmdldCk7XG4gICAgICAgIGVsc2UgdHJlZS5jcmVhdGVEaXYoeyBjbHM6ICdmcHYtZW1wdHknLCB0ZXh0OiAnUmlnaHQtY2xpY2sgYSBmb2xkZXIgYW5kIGNob29zZSBcIlBpbiBmb2xkZXJcIi4nIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCB0b29sYmFyIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3VG9vbGJhcigpIHtcbiAgICAgICAgY29uc3QgYmFyID0gdGhpcy5jb250ZW50RWwuY3JlYXRlRGl2KCdmcHYtdG9vbGJhcicpO1xuICAgICAgICBjb25zdCBidG4gPSAoaWNvbjogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBmbjogKCkgPT4gdm9pZCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYiA9IGJhci5jcmVhdGVEaXYoeyBjbHM6ICdmcHYtdG9vbCcsIGF0dHI6IHsgJ2FyaWEtbGFiZWwnOiBsYWJlbCB9IH0pO1xuICAgICAgICAgICAgc2V0SWNvbihiLCBpY29uKTtcbiAgICAgICAgICAgIGIuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmbik7XG4gICAgICAgIH07XG4gICAgICAgIGNvbnN0IGJhc2UgPSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA/PyAnJztcbiAgICAgICAgYnRuKCdzcXVhcmUtcGVuJywgICAgJ05ldyBub3RlJywgICAgICAgKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgYmFzZSkpO1xuICAgICAgICBidG4oJ2ZvbGRlci1wbHVzJywgICAnTmV3IGZvbGRlcicsICAgICAoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KHRydWUsIGJhc2UpKTtcbiAgICAgICAgYnRuKCdhcnJvdy11cC1heicsICAgJ1NvcnQgJyArICh0aGlzLmRhdGEuc29ydE9yZGVyID09PSAnYXNjJyA/ICdaXHUyMTkyQScgOiAnQVx1MjE5MlonKSwgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5kYXRhLnNvcnRPcmRlciA9IHRoaXMuZGF0YS5zb3J0T3JkZXIgPT09ICdhc2MnID8gJ2Rlc2MnIDogJ2FzYyc7XG4gICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnRuKCdjaGV2cm9ucy11cC1kb3duJywgJ0V4cGFuZCBhbGwnLCAgKCkgPT4gdGhpcy5leHBhbmRBbGwoKSk7XG4gICAgICAgIGJ0bignY2hldnJvbnMtZG93bi11cCcsICdDb2xsYXBzZSBhbGwnLCgpID0+IHRoaXMuY29sbGFwc2VBbGwoKSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBleHBhbmRBbGwoKSB7XG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoXG4gICAgICAgICAgICA/IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aClcbiAgICAgICAgICAgIDogdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuICAgICAgICBpZiAoISh0YXJnZXQgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuO1xuICAgICAgICBjb25zdCBjb2xsZWN0ID0gKGY6IFRGb2xkZXIpID0+IHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2YgZi5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHsgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5wdXNoKGNoaWxkLnBhdGgpOyBjb2xsZWN0KGNoaWxkKTsgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gW107XG4gICAgICAgIGNvbGxlY3QodGFyZ2V0KTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgY29sbGFwc2VBbGwoKSB7XG4gICAgICAgIHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBwaW4gYmFyIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBkcmF3UGluQmFyKCkge1xuICAgICAgICBjb25zdCBiYXIgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoJ2Zwdi1iYXInKTtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZm9yRWFjaCgocGF0aCwgaWR4KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBidG4gPSBiYXIuY3JlYXRlRWwoJ2J1dHRvbicsIHtcbiAgICAgICAgICAgICAgICBjbHM6ICdmcHYtYnRuJyxcbiAgICAgICAgICAgICAgICB0ZXh0OiBwYXRoLnNwbGl0KCcvJykucG9wKCkgfHwgcGF0aCxcbiAgICAgICAgICAgICAgICB0aXRsZTogcGF0aCxcbiAgICAgICAgICAgICAgICBhdHRyOiB7IGRyYWdnYWJsZTogJ3RydWUnIH0sXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChwYXRoID09PSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgYnRuLmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcblxuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcGF0aDtcbiAgICAgICAgICAgICAgICB0aGlzLnBlcnNpc3QoKTtcbiAgICAgICAgICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIG5ldyBNZW51KClcbiAgICAgICAgICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdVbnBpbicpLnNldEljb24oJ3gnKS5vbkNsaWNrKCgpID0+IHRoaXMudW5waW4ocGF0aCkpKVxuICAgICAgICAgICAgICAgICAgICAuc2hvd0F0TW91c2VFdmVudChlKTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBkcmFnLXRvLXJlb3JkZXJcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnc3RhcnQnLCAoKSA9PiB7IHRoaXMuZHJhZ0luZGV4ID0gaWR4OyBidG4uYWRkQ2xhc3MoJ2lzLWRyYWdnaW5nJyk7IH0pO1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCAgICgpID0+IHsgdGhpcy5kcmFnSW5kZXggPSAtMTsgIGJ0bi5yZW1vdmVDbGFzcygnaXMtZHJhZ2dpbmcnKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAgZSA9PiB7IGUucHJldmVudERlZmF1bHQoKTsgYnRuLmFkZENsYXNzKCdkcmFnLW92ZXInKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgKCkgPT4gYnRuLnJlbW92ZUNsYXNzKCdkcmFnLW92ZXInKSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGUgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBidG4ucmVtb3ZlQ2xhc3MoJ2RyYWctb3ZlcicpO1xuICAgICAgICAgICAgICAgIGlmICh0aGlzLmRyYWdJbmRleCA8IDAgfHwgdGhpcy5kcmFnSW5kZXggPT09IGlkeCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgIGNvbnN0IHBpbnMgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycztcbiAgICAgICAgICAgICAgICBjb25zdCBbbW92ZWRdID0gcGlucy5zcGxpY2UodGhpcy5kcmFnSW5kZXgsIDEpO1xuICAgICAgICAgICAgICAgIHBpbnMuc3BsaWNlKGlkeCwgMCwgbW92ZWQpO1xuICAgICAgICAgICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBmaWxlIHRyZWUgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIGRyYXdGb2xkZXIoZWw6IEhUTUxFbGVtZW50LCBmb2xkZXI6IFRGb2xkZXIpIHtcbiAgICAgICAgY29uc3QgZXhwYW5kZWQgPSBuZXcgU2V0KHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMpO1xuICAgICAgICBjb25zdCBhY3RpdmVQYXRoID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKT8ucGF0aDtcblxuICAgICAgICBjb25zdCBzb3J0ZWQgPSBbLi4uZm9sZGVyLmNoaWxkcmVuXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgICAgICBpZiAoKGEgaW5zdGFuY2VvZiBURm9sZGVyKSAhPT0gKGIgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuIGEgaW5zdGFuY2VvZiBURm9sZGVyID8gLTEgOiAxO1xuICAgICAgICAgICAgY29uc3QgY21wID0gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmRhdGEuc29ydE9yZGVyID09PSAnYXNjJyA/IGNtcCA6IC1jbXA7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGZvciAoY29uc3QgY2hpbGQgb2Ygc29ydGVkKSB7XG4gICAgICAgICAgICBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURm9sZGVyKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgb3BlbiA9IGV4cGFuZGVkLmhhcyhjaGlsZC5wYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCB3cmFwID0gZWwuY3JlYXRlRGl2KCdmcHYtZm9sZGVyJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgaGVhZCA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWhlYWQnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBhcnJvdyA9IGhlYWQuY3JlYXRlU3BhbignZnB2LWFycm93Jyk7XG4gICAgICAgICAgICAgICAgc2V0SWNvbihhcnJvdywgb3BlbiA/ICdjaGV2cm9uLWRvd24nIDogJ2NoZXZyb24tcmlnaHQnKTtcbiAgICAgICAgICAgICAgICBoZWFkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjaGlsZC5uYW1lIH0pO1xuXG4gICAgICAgICAgICAgICAgY29uc3QgYm9keSA9IHdyYXAuY3JlYXRlRGl2KCdmcHYtZm9sZGVyLWJvZHknKTtcbiAgICAgICAgICAgICAgICBpZiAob3BlbikgeyBib2R5LmFkZENsYXNzKCdpcy1vcGVuJyk7IHRoaXMuZHJhd0ZvbGRlcihib2R5LCBjaGlsZCk7IH1cblxuICAgICAgICAgICAgICAgIGhlYWQuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnRvZ2dsZShjaGlsZC5wYXRoKSk7XG4gICAgICAgICAgICAgICAgaGVhZC5hZGRFdmVudExpc3RlbmVyKCdjb250ZXh0bWVudScsIGUgPT4gdGhpcy5zaG93RmlsZU1lbnUoZSwgY2hpbGQpKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoY2hpbGQgaW5zdGFuY2VvZiBURmlsZSkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHJvdyA9IGVsLmNyZWF0ZURpdignZnB2LWZpbGUnKTtcbiAgICAgICAgICAgICAgICBpZiAoY2hpbGQucGF0aCA9PT0gYWN0aXZlUGF0aCkgcm93LmFkZENsYXNzKCdpcy1hY3RpdmUnKTtcbiAgICAgICAgICAgICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IGNoaWxkLmV4dGVuc2lvbiA9PT0gJ21kJyA/IGNoaWxkLmJhc2VuYW1lIDogY2hpbGQubmFtZSB9KTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB2b2lkIHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoY2hpbGQpKTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHRoaXMuc2hvd0ZpbGVNZW51KGUsIGNoaWxkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnM7XG4gICAgICAgIGNvbnN0IGF0ID0gbGlzdC5pbmRleE9mKHBhdGgpO1xuICAgICAgICBpZiAoYXQgPj0gMCkgbGlzdC5zcGxpY2UoYXQsIDEpOyBlbHNlIGxpc3QucHVzaChwYXRoKTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBjb250ZXh0IG1lbnVzIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBzaG93Um9vdE1lbnUoZTogTW91c2VFdmVudCkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmICghdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHJldHVybjtcbiAgICAgICAgbmV3IE1lbnUoKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgbm90ZScpLnNldEljb24oJ2ZpbGUtcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGghKSkpXG4gICAgICAgICAgICAuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBmb2xkZXInKS5zZXRJY29uKCdmb2xkZXItcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeSh0cnVlLCB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCEpKSlcbiAgICAgICAgICAgIC5zaG93QXRNb3VzZUV2ZW50KGUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2hvd0ZpbGVNZW51KGU6IE1vdXNlRXZlbnQsIGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblxuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpbm5lZCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmluY2x1ZGVzKGZpbGUucGF0aCk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpXG4gICAgICAgICAgICAgICAgLnNldFRpdGxlKHBpbm5lZCA/ICdVbnBpbiBmb2xkZXInIDogJ1BpbiBmb2xkZXInKS5zZXRJY29uKCdwaW4nKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHBpbm5lZCA/IHRoaXMudW5waW4oZmlsZS5wYXRoKSA6IHRoaXMucGluKGZpbGUucGF0aCkpKTtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBub3RlJykuc2V0SWNvbignZmlsZS1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KGZhbHNlLCBmaWxlLnBhdGgpKSk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgZm9sZGVyJykuc2V0SWNvbignZm9sZGVyLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkodHJ1ZSwgZmlsZS5wYXRoKSkpO1xuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1JlbmFtZScpLnNldEljb24oJ3BlbmNpbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5yZW5hbWVGaWxlKGZpbGUpKSk7XG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ0RlbGV0ZScpLnNldEljb24oJ3RyYXNoJykub25DbGljaygoKSA9PiB0aGlzLmRlbGV0ZUZpbGUoZmlsZSkpKTtcblxuICAgICAgICBtZW51LnNob3dBdE1vdXNlRXZlbnQoZSk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIGZpbGUgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgY3JlYXRlRW50cnkoaXNGb2xkZXI6IGJvb2xlYW4sIHBhcmVudFBhdGg6IHN0cmluZykge1xuICAgICAgICBuZXcgUHJvbXB0TW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ05ldyBmb2xkZXInIDogJ05ldyBub3RlJyxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ0ZvbGRlciBuYW1lJyA6ICdOb3RlIG5hbWUnLFxuICAgICAgICAgICAgYXN5bmMgbmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IChwYXJlbnRQYXRoID8gcGFyZW50UGF0aCArICcvJyA6ICcnKSArIG5hbWUgKyAoaXNGb2xkZXIgPyAnJyA6ICcubWQnKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpKSB7IG5ldyBOb3RpY2UoJ0FscmVhZHkgZXhpc3RzLicpOyByZXR1cm47IH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGb2xkZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZUZvbGRlcihwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdDb3VsZCBub3QgY3JlYXRlOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICApLm9wZW4oKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlbmFtZUZpbGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuICAgICAgICBjb25zdCBvbGROYW1lID0gZmlsZSBpbnN0YW5jZW9mIFRGaWxlID8gZmlsZS5iYXNlbmFtZSA6IGZpbGUubmFtZTtcbiAgICAgICAgbmV3IFByb21wdE1vZGFsKHRoaXMuYXBwLCAnUmVuYW1lJywgb2xkTmFtZSwgYXN5bmMgbmV3TmFtZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBmaWxlLnBhcmVudD8ucGF0aCA/PyAnJztcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGZpbGUgaW5zdGFuY2VvZiBURmlsZSA/ICcuJyArIGZpbGUuZXh0ZW5zaW9uIDogJyc7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gKHBhcmVudCA/IHBhcmVudCArICcvJyA6ICcnKSArIG5ld05hbWUgKyBzdWZmaXg7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZW5hbWUoZmlsZSwgbmV3UGF0aCk7IH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbmV3IE5vdGljZSgnUmVuYW1lIGZhaWxlZDogJyArIFN0cmluZyhlcnIpKTsgfVxuICAgICAgICB9KS5vcGVuKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgdHJ5IHsgYXdhaXQgdGhpcy5hcHAudmF1bHQudHJhc2goZmlsZSwgdHJ1ZSk7IH1cbiAgICAgICAgY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdEZWxldGUgZmFpbGVkOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIHBpbiBtYW5hZ2VtZW50IChjYWxsZWQgYnkgcGx1Z2luIHRvbykgXHUyNTAwXHUyNTAwXG5cbiAgICBwaW4ocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGlubmVkRm9sZGVycy5pbmNsdWRlcyhwYXRoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5wdXNoKHBhdGgpO1xuICAgICAgICBpZiAoIXRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHBhdGg7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVucGluKHBhdGg6IHN0cmluZykge1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZpbHRlcihwID0+IHAgIT09IHBhdGgpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPT09IHBhdGgpXG4gICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzWzBdID8/IG51bGw7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvbGRlclBpblBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gICAgZGF0YTogUGx1Z2luRGF0YSA9IHsgLi4uREVGQVVMVF9EQVRBIH07XG4gICAgcHJpdmF0ZSBzYXZlID0gZGVib3VuY2UoKCkgPT4gdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpLCA0MDAsIHRydWUpO1xuXG4gICAgYXN5bmMgb25sb2FkKCkge1xuICAgICAgICB0aGlzLmRhdGEgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9EQVRBIH0sIGF3YWl0IHRoaXMubG9hZERhdGEoKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+KTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyVmlldyhWSUVXX1RZUEUsIGxlYWYgPT5cbiAgICAgICAgICAgIG5ldyBGb2xkZXJQaW5WaWV3KGxlYWYsIHRoaXMuZGF0YSwgKCkgPT4gdGhpcy5zYXZlKCkpXG4gICAgICAgICk7XG4gICAgICAgIHRoaXMuYWRkUmliYm9uSWNvbigncGluJywgJ0ZvbGRlciBQaW4gVmlldycsICgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuXG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtbWVudScsIChtZW51LCBmaWxlLCBzb3VyY2UpID0+IHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UgPT09IFZJRVdfVFlQRSB8fCAhKGZpbGUgaW5zdGFuY2VvZiBURm9sZGVyKSkgcmV0dXJuO1xuICAgICAgICAgICAgbWVudS5hZGRJdGVtKGkgPT4gaS5zZXRUaXRsZSgnUGluIGZvbGRlcicpLnNldEljb24oJ3BpbicpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5nZXRWaWV3KCk/LnBpbihmaWxlLnBhdGgpKSk7XG4gICAgICAgIH0pKTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2NyZWF0ZScsICAoKSAgICAgID0+IHRoaXMucmVmcmVzaCgpKSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbignZGVsZXRlJywgIGYgICAgICAgPT4geyB0aGlzLm9uRGVsZXRlKGYucGF0aCk7IHRoaXMucmVmcmVzaCgpOyB9KSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC52YXVsdC5vbigncmVuYW1lJywgIChmLCBvbGQpID0+IHsgdGhpcy5vblJlbmFtZShmLnBhdGgsIG9sZCk7IHRoaXMucmVmcmVzaCgpOyB9KSk7XG4gICAgICAgIHRoaXMucmVnaXN0ZXJFdmVudCh0aGlzLmFwcC53b3Jrc3BhY2Uub24oJ2ZpbGUtb3BlbicsICgpID0+IHRoaXMucmVmcmVzaCgpKSk7XG5cbiAgICAgICAgdGhpcy5hcHAud29ya3NwYWNlLm9uTGF5b3V0UmVhZHkoKCkgPT4gdGhpcy5hY3RpdmF0ZVZpZXcoKSk7XG4gICAgfVxuXG4gICAgb251bmxvYWQoKSB7fVxuXG4gICAgcHJpdmF0ZSBvbkRlbGV0ZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgZ29uZSA9IChwOiBzdHJpbmcpID0+IHAgPT09IHBhdGggfHwgcC5zdGFydHNXaXRoKHBhdGggKyAnLycpO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyAgID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMuZmlsdGVyKHAgPT4gIWdvbmUocCkpO1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5maWx0ZXIocCA9PiAhZ29uZShwKSk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCAmJiBnb25lKHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSlcbiAgICAgICAgICAgIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnNbMF0gPz8gbnVsbDtcbiAgICAgICAgdGhpcy5zYXZlKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBvblJlbmFtZShwYXRoOiBzdHJpbmcsIG9sZDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IHJlbWFwID0gKHA6IHN0cmluZykgPT5cbiAgICAgICAgICAgIHAgPT09IG9sZCA/IHBhdGggOiBwLnN0YXJ0c1dpdGgob2xkICsgJy8nKSA/IHBhdGggKyBwLnNsaWNlKG9sZC5sZW5ndGgpIDogcDtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMgICA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLm1hcChyZW1hcCk7XG4gICAgICAgIHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMgPSB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzLm1hcChyZW1hcCk7XG4gICAgICAgIGlmICh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSByZW1hcCh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCk7XG4gICAgICAgIHRoaXMuc2F2ZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcmVmcmVzaCgpIHsgdGhpcy5nZXRWaWV3KCk/LnJlZnJlc2goKTsgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVZpZXcoKSB7XG4gICAgICAgIGlmICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSkubGVuZ3RoID4gMCkgcmV0dXJuO1xuICAgICAgICBhd2FpdCB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVmdExlYWYoZmFsc2UpPy5zZXRWaWV3U3RhdGUoeyB0eXBlOiBWSUVXX1RZUEUsIGFjdGl2ZTogdHJ1ZSB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFZpZXcoKTogRm9sZGVyUGluVmlldyB8IG51bGwge1xuICAgICAgICByZXR1cm4gKHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoVklFV19UWVBFKVswXT8udmlldyBhcyBGb2xkZXJQaW5WaWV3KSA/PyBudWxsO1xuICAgIH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsc0JBR087QUFFUCxJQUFNLFlBQVk7QUFTbEIsSUFBTSxlQUEyQixFQUFFLGVBQWUsQ0FBQyxHQUFHLGtCQUFrQixNQUFNLGlCQUFpQixDQUFDLEdBQUcsV0FBVyxNQUFNO0FBSXBILElBQU0sY0FBTixjQUEwQixzQkFBTTtBQUFBLEVBRzVCLFlBQ0ksS0FDUSxTQUNBLFNBQ0EsVUFDVjtBQUFFLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFDQTtBQUNJLFNBQUssUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUV0QyxTQUFTO0FBQ0wsU0FBSyxRQUFRLFFBQVEsS0FBSyxPQUFPO0FBQ2pDLFFBQUksd0JBQVEsS0FBSyxTQUFTLEVBQUUsUUFBUSxPQUFLO0FBQ3JDLFFBQUUsU0FBUyxLQUFLLE9BQU8sRUFBRSxTQUFTLE9BQU0sS0FBSyxRQUFRLENBQUU7QUFDdkQsUUFBRSxRQUFRLE9BQU87QUFDakIsUUFBRSxRQUFRLE1BQU07QUFDaEIsUUFBRSxRQUFRLGlCQUFpQixXQUFXLE9BQUs7QUFDdkMsWUFBSSxFQUFFLFFBQVEsU0FBUztBQUFFLFlBQUUsZUFBZTtBQUFHLGVBQUssT0FBTztBQUFBLFFBQUc7QUFBQSxNQUNoRSxDQUFDO0FBQUEsSUFDTCxDQUFDO0FBQ0QsUUFBSSx3QkFBUSxLQUFLLFNBQVMsRUFDckIsVUFBVSxPQUFLLEVBQUUsY0FBYyxJQUFJ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QUssYUFBYSxDQUFDO0FBQUEsRUFDOUQ7QUFBQSxFQUVBLFdBQVc7QUFBQSxFQUFDO0FBQUEsRUFFSixTQUFTLE1BQWM7QUF0Vm5DO0FBdVZRLFVBQU0sT0FBTyxDQUFDLE1BQWMsTUFBTSxRQUFRLEVBQUUsV0FBVyxPQUFPLEdBQUc7QUFDakUsU0FBSyxLQUFLLGdCQUFrQixLQUFLLEtBQUssY0FBYyxPQUFPLE9BQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4RSxTQUFLLEtBQUssa0JBQWtCLEtBQUssS0FBSyxnQkFBZ0IsT0FBTyxPQUFLLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDMUUsUUFBSSxLQUFLLEtBQUssb0JBQW9CLEtBQUssS0FBSyxLQUFLLGdCQUFnQjtBQUM3RCxXQUFLLEtBQUssb0JBQW1CLFVBQUssS0FBSyxjQUFjLENBQUMsTUFBekIsWUFBOEI7QUFDL0QsU0FBSyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRVEsU0FBUyxNQUFjLEtBQWE7QUFDeEMsVUFBTSxRQUFRLENBQUMsTUFDWCxNQUFNLE1BQU0sT0FBTyxFQUFFLFdBQVcsTUFBTSxHQUFHLElBQUksT0FBTyxFQUFFLE1BQU0sSUFBSSxNQUFNLElBQUk7QUFDOUUsU0FBSyxLQUFLLGdCQUFrQixLQUFLLEtBQUssY0FBYyxJQUFJLEtBQUs7QUFDN0QsU0FBSyxLQUFLLGtCQUFrQixLQUFLLEtBQUssZ0JBQWdCLElBQUksS0FBSztBQUMvRCxRQUFJLEtBQUssS0FBSyxpQkFBa0IsTUFBSyxLQUFLLG1CQUFtQixNQUFNLEtBQUssS0FBSyxnQkFBZ0I7QUFDN0YsU0FBSyxLQUFLO0FBQUEsRUFDZDtBQUFBLEVBRVEsVUFBVTtBQXhXdEI7QUF3V3dCLGVBQUssUUFBUSxNQUFiLG1CQUFnQjtBQUFBLEVBQVc7QUFBQSxFQUUvQyxNQUFjLGVBQWU7QUExV2pDO0FBMldRLFFBQUksS0FBSyxJQUFJLFVBQVUsZ0JBQWdCLFNBQVMsRUFBRSxTQUFTLEVBQUc7QUFDOUQsWUFBTSxVQUFLLElBQUksVUFBVSxZQUFZLEtBQUssTUFBcEMsbUJBQXVDLGFBQWEsRUFBRSxNQUFNLFdBQVcsUUFBUSxLQUFLO0FBQUEsRUFDOUY7QUFBQSxFQUVRLFVBQWdDO0FBL1c1QztBQWdYUSxZQUFRLGdCQUFLLElBQUksVUFBVSxnQkFBZ0IsU0FBUyxFQUFFLENBQUMsTUFBL0MsbUJBQWtELFNBQWxELFlBQTRFO0FBQUEsRUFDeEY7QUFDSjsiLAogICJuYW1lcyI6IFtdCn0K
