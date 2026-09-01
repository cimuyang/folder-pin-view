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
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7XG4gICAgQXBwLCBJdGVtVmlldywgTWVudSwgTW9kYWwsIE5vdGljZSwgUGx1Z2luLCBTZXR0aW5nLFxuICAgIFRBYnN0cmFjdEZpbGUsIFRGaWxlLCBURm9sZGVyLCBXb3Jrc3BhY2VMZWFmLCBkZWJvdW5jZSwgc2V0SWNvbixcbn0gZnJvbSAnb2JzaWRpYW4nO1xuXG5jb25zdCBWSUVXX1RZUEUgPSAnZm9sZGVyLXBpbi12aWV3JztcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuICAgIHBpbm5lZEZvbGRlcnM6IHN0cmluZ1tdO1xuICAgIGFjdGl2ZUZvbGRlclBhdGg6IHN0cmluZyB8IG51bGw7XG4gICAgZXhwYW5kZWRGb2xkZXJzOiBzdHJpbmdbXTtcbn1cblxuY29uc3QgREVGQVVMVF9EQVRBOiBQbHVnaW5EYXRhID0geyBwaW5uZWRGb2xkZXJzOiBbXSwgYWN0aXZlRm9sZGVyUGF0aDogbnVsbCwgZXhwYW5kZWRGb2xkZXJzOiBbXSB9O1xuXG4vLyBcdTI1MDBcdTI1MDAgUHJvbXB0IG1vZGFsIFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFx1MjUwMFxuXG5jbGFzcyBQcm9tcHRNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgICBwcml2YXRlIHZhbHVlOiBzdHJpbmc7XG5cbiAgICBjb25zdHJ1Y3RvcihcbiAgICAgICAgYXBwOiBBcHAsXG4gICAgICAgIHByaXZhdGUgaGVhZGluZzogc3RyaW5nLFxuICAgICAgICBwcml2YXRlIGluaXRpYWw6IHN0cmluZyxcbiAgICAgICAgcHJpdmF0ZSBvblN1Ym1pdDogKG5hbWU6IHN0cmluZykgPT4gdm9pZCxcbiAgICApIHsgc3VwZXIoYXBwKTsgdGhpcy52YWx1ZSA9IGluaXRpYWw7IH1cblxuICAgIG9uT3BlbigpIHtcbiAgICAgICAgdGhpcy50aXRsZUVsLnNldFRleHQodGhpcy5oZWFkaW5nKTtcbiAgICAgICAgbmV3IFNldHRpbmcodGhpcy5jb250ZW50RWwpLmFkZFRleHQodCA9PiB7XG4gICAgICAgICAgICB0LnNldFZhbHVlKHRoaXMuaW5pdGlhbCkub25DaGFuZ2UodiA9PiAodGhpcy52YWx1ZSA9IHYpKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5zZWxlY3QoKTtcbiAgICAgICAgICAgIHQuaW5wdXRFbC5mb2N1cygpO1xuICAgICAgICAgICAgdC5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCBlID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyB0aGlzLnN1Ym1pdCgpOyB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIG5ldyBTZXR0aW5nKHRoaXMuY29udGVudEVsKVxuICAgICAgICAgICAgLmFkZEJ1dHRvbihiID0+IGIuc2V0QnV0dG9uVGV4dCgnT0snKS5zZXRDdGEoKS5vbkNsaWNrKCgpID0+IHRoaXMuc3VibWl0KCkpKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHN1Ym1pdCgpIHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHRoaXMudmFsdWUudHJpbSgpO1xuICAgICAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICB0aGlzLm9uU3VibWl0KG5hbWUpO1xuICAgIH1cblxuICAgIG9uQ2xvc2UoKSB7IHRoaXMuY29udGVudEVsLmVtcHR5KCk7IH1cbn1cblxuLy8gXHUyNTAwXHUyNTAwIFZpZXcgXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmNsYXNzIEZvbGRlclBpblZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG4gICAgcHJpdmF0ZSBkcmFnSW5kZXggPSAtMTtcblxuICAgIGNvbnN0cnVjdG9yKFxuICAgICAgICBsZWFmOiBXb3Jrc3BhY2VMZWFmLFxuICAgICAgICBwcml2YXRlIGRhdGE6IFBsdWdpbkRhdGEsXG4gICAgICAgIHByaXZhdGUgcGVyc2lzdDogKCkgPT4gdm9pZCxcbiAgICApIHsgc3VwZXIobGVhZik7IH1cblxuICAgIGdldFZpZXdUeXBlKCkgICAgeyByZXR1cm4gVklFV19UWVBFOyB9XG4gICAgZ2V0RGlzcGxheVRleHQoKSB7IHJldHVybiAnRm9sZGVyIFBpbic7IH1cbiAgICBnZXRJY29uKCkgICAgICAgIHsgcmV0dXJuICdwaW4nOyB9XG5cbiAgICBhc3luYyBvbk9wZW4oKSAgeyB0aGlzLmNvbnRlbnRFbC5hZGRDbGFzcygnZnB2LXJvb3QnKTsgdGhpcy5kcmF3KCk7IH1cbiAgICBhc3luYyBvbkNsb3NlKCkge31cblxuICAgIHJlZnJlc2ggPSBkZWJvdW5jZSgoKSA9PiB0aGlzLmRyYXcoKSwgMTAwLCB0cnVlKTtcblxuICAgIGRyYXcoKSB7XG4gICAgICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gICAgICAgIHRoaXMuZHJhd1BpbkJhcigpO1xuXG4gICAgICAgIGNvbnN0IHRyZWUgPSB0aGlzLmNvbnRlbnRFbC5jcmVhdGVEaXYoJ2Zwdi10cmVlJyk7XG4gICAgICAgIHRyZWUuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHtcbiAgICAgICAgICAgIGlmIChlLnRhcmdldCA9PT0gdHJlZSkgdGhpcy5zaG93Um9vdE1lbnUoZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIGNvbnN0IHRhcmdldCA9IHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoXG4gICAgICAgICAgICA/IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aCh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aClcbiAgICAgICAgICAgIDogdGhpcy5hcHAudmF1bHQuZ2V0Um9vdCgpO1xuXG4gICAgICAgIGlmICh0YXJnZXQgaW5zdGFuY2VvZiBURm9sZGVyKSB0aGlzLmRyYXdGb2xkZXIodHJlZSwgdGFyZ2V0KTtcbiAgICAgICAgZWxzZSB0cmVlLmNyZWF0ZURpdih7IGNsczogJ2Zwdi1lbXB0eScsIHRleHQ6ICdSaWdodC1jbGljayBhIGZvbGRlciBhbmQgY2hvb3NlIFwiUGluIGZvbGRlclwiLicgfSk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIHBpbiBiYXIgXHUyNTAwXHUyNTAwXG5cbiAgICBwcml2YXRlIGRyYXdQaW5CYXIoKSB7XG4gICAgICAgIGNvbnN0IGJhciA9IHRoaXMuY29udGVudEVsLmNyZWF0ZURpdignZnB2LWJhcicpO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5mb3JFYWNoKChwYXRoLCBpZHgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGJ0biA9IGJhci5jcmVhdGVFbCgnYnV0dG9uJywge1xuICAgICAgICAgICAgICAgIGNsczogJ2Zwdi1idG4nLFxuICAgICAgICAgICAgICAgIHRleHQ6IHBhdGguc3BsaXQoJy8nKS5wb3AoKSB8fCBwYXRoLFxuICAgICAgICAgICAgICAgIHRpdGxlOiBwYXRoLFxuICAgICAgICAgICAgICAgIGF0dHI6IHsgZHJhZ2dhYmxlOiAndHJ1ZScgfSxcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgaWYgKHBhdGggPT09IHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSBidG4uYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpO1xuXG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPSBwYXRoO1xuICAgICAgICAgICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuZHJhdygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgbmV3IE1lbnUoKVxuICAgICAgICAgICAgICAgICAgICAuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1VucGluJykuc2V0SWNvbigneCcpLm9uQ2xpY2soKCkgPT4gdGhpcy51bnBpbihwYXRoKSkpXG4gICAgICAgICAgICAgICAgICAgIC5zaG93QXRNb3VzZUV2ZW50KGUpO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIGRyYWctdG8tcmVvcmRlclxuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsICgpID0+IHsgdGhpcy5kcmFnSW5kZXggPSBpZHg7IGJ0bi5hZGRDbGFzcygnaXMtZHJhZ2dpbmcnKTsgfSk7XG4gICAgICAgICAgICBidG4uYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsICAgKCkgPT4geyB0aGlzLmRyYWdJbmRleCA9IC0xOyAgYnRuLnJlbW92ZUNsYXNzKCdpcy1kcmFnZ2luZycpOyB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsICBlID0+IHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBidG4uYWRkQ2xhc3MoJ2RyYWctb3ZlcicpOyB9KTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCAoKSA9PiBidG4ucmVtb3ZlQ2xhc3MoJ2RyYWctb3ZlcicpKTtcbiAgICAgICAgICAgIGJ0bi5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZSA9PiB7XG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgIGJ0bi5yZW1vdmVDbGFzcygnZHJhZy1vdmVyJyk7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuZHJhZ0luZGV4IDwgMCB8fCB0aGlzLmRyYWdJbmRleCA9PT0gaWR4KSByZXR1cm47XG4gICAgICAgICAgICAgICAgY29uc3QgcGlucyA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzO1xuICAgICAgICAgICAgICAgIGNvbnN0IFttb3ZlZF0gPSBwaW5zLnNwbGljZSh0aGlzLmRyYWdJbmRleCwgMSk7XG4gICAgICAgICAgICAgICAgcGlucy5zcGxpY2UoaWR4LCAwLCBtb3ZlZCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5kcmF3KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIGZpbGUgdHJlZSBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgZHJhd0ZvbGRlcihlbDogSFRNTEVsZW1lbnQsIGZvbGRlcjogVEZvbGRlcikge1xuICAgICAgICBjb25zdCBleHBhbmRlZCA9IG5ldyBTZXQodGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycyk7XG4gICAgICAgIGNvbnN0IGFjdGl2ZVBhdGggPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpPy5wYXRoO1xuXG4gICAgICAgIGNvbnN0IHNvcnRlZCA9IFsuLi5mb2xkZXIuY2hpbGRyZW5dLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgICAgICAgIGlmICgoYSBpbnN0YW5jZW9mIFRGb2xkZXIpICE9PSAoYiBpbnN0YW5jZW9mIFRGb2xkZXIpKSByZXR1cm4gYSBpbnN0YW5jZW9mIFRGb2xkZXIgPyAtMSA6IDE7XG4gICAgICAgICAgICByZXR1cm4gYS5uYW1lLmxvY2FsZUNvbXBhcmUoYi5uYW1lKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBzb3J0ZWQpIHtcbiAgICAgICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICAgICAgICBjb25zdCBvcGVuID0gZXhwYW5kZWQuaGFzKGNoaWxkLnBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHdyYXAgPSBlbC5jcmVhdGVEaXYoJ2Zwdi1mb2xkZXInKTtcbiAgICAgICAgICAgICAgICBjb25zdCBoZWFkID0gd3JhcC5jcmVhdGVEaXYoJ2Zwdi1mb2xkZXItaGVhZCcpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGFycm93ID0gaGVhZC5jcmVhdGVTcGFuKCdmcHYtYXJyb3cnKTtcbiAgICAgICAgICAgICAgICBzZXRJY29uKGFycm93LCBvcGVuID8gJ2NoZXZyb24tZG93bicgOiAnY2hldnJvbi1yaWdodCcpO1xuICAgICAgICAgICAgICAgIGhlYWQuY3JlYXRlU3Bhbih7IHRleHQ6IGNoaWxkLm5hbWUgfSk7XG5cbiAgICAgICAgICAgICAgICBjb25zdCBib2R5ID0gd3JhcC5jcmVhdGVEaXYoJ2Zwdi1mb2xkZXItYm9keScpO1xuICAgICAgICAgICAgICAgIGlmIChvcGVuKSB7IGJvZHkuYWRkQ2xhc3MoJ2lzLW9wZW4nKTsgdGhpcy5kcmF3Rm9sZGVyKGJvZHksIGNoaWxkKTsgfVxuXG4gICAgICAgICAgICAgICAgaGVhZC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMudG9nZ2xlKGNoaWxkLnBhdGgpKTtcbiAgICAgICAgICAgICAgICBoZWFkLmFkZEV2ZW50TGlzdGVuZXIoJ2NvbnRleHRtZW51JywgZSA9PiB0aGlzLnNob3dGaWxlTWVudShlLCBjaGlsZCkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjaGlsZCBpbnN0YW5jZW9mIFRGaWxlKSB7XG4gICAgICAgICAgICAgICAgY29uc3Qgcm93ID0gZWwuY3JlYXRlRGl2KCdmcHYtZmlsZScpO1xuICAgICAgICAgICAgICAgIGlmIChjaGlsZC5wYXRoID09PSBhY3RpdmVQYXRoKSByb3cuYWRkQ2xhc3MoJ2lzLWFjdGl2ZScpO1xuICAgICAgICAgICAgICAgIHJvdy5jcmVhdGVTcGFuKHsgdGV4dDogY2hpbGQuZXh0ZW5zaW9uID09PSAnbWQnID8gY2hpbGQuYmFzZW5hbWUgOiBjaGlsZC5uYW1lIH0pO1xuICAgICAgICAgICAgICAgIHJvdy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRMZWFmKCkub3BlbkZpbGUoY2hpbGQpKTtcbiAgICAgICAgICAgICAgICByb3cuYWRkRXZlbnRMaXN0ZW5lcignY29udGV4dG1lbnUnLCBlID0+IHRoaXMuc2hvd0ZpbGVNZW51KGUsIGNoaWxkKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHRvZ2dsZShwYXRoOiBzdHJpbmcpIHtcbiAgICAgICAgY29uc3QgbGlzdCA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnM7XG4gICAgICAgIGNvbnN0IGF0ID0gbGlzdC5pbmRleE9mKHBhdGgpO1xuICAgICAgICBpZiAoYXQgPj0gMCkgbGlzdC5zcGxpY2UoYXQsIDEpOyBlbHNlIGxpc3QucHVzaChwYXRoKTtcbiAgICAgICAgdGhpcy5wZXJzaXN0KCk7XG4gICAgICAgIHRoaXMuZHJhdygpO1xuICAgIH1cblxuICAgIC8vIFx1MjUwMFx1MjUwMCBjb250ZXh0IG1lbnVzIFx1MjUwMFx1MjUwMFxuXG4gICAgcHJpdmF0ZSBzaG93Um9vdE1lbnUoZTogTW91c2VFdmVudCkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGlmICghdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHJldHVybjtcbiAgICAgICAgbmV3IE1lbnUoKVxuICAgICAgICAgICAgLmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgbm90ZScpLnNldEljb24oJ2ZpbGUtcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeShmYWxzZSwgdGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGghKSkpXG4gICAgICAgICAgICAuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBmb2xkZXInKS5zZXRJY29uKCdmb2xkZXItcGx1cycpXG4gICAgICAgICAgICAgICAgLm9uQ2xpY2soKCkgPT4gdGhpcy5jcmVhdGVFbnRyeSh0cnVlLCB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCEpKSlcbiAgICAgICAgICAgIC5zaG93QXRNb3VzZUV2ZW50KGUpO1xuICAgIH1cblxuICAgIHByaXZhdGUgc2hvd0ZpbGVNZW51KGU6IE1vdXNlRXZlbnQsIGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBjb25zdCBtZW51ID0gbmV3IE1lbnUoKTtcblxuICAgICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIFRGb2xkZXIpIHtcbiAgICAgICAgICAgIGNvbnN0IHBpbm5lZCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmluY2x1ZGVzKGZpbGUucGF0aCk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpXG4gICAgICAgICAgICAgICAgLnNldFRpdGxlKHBpbm5lZCA/ICdVbnBpbiBmb2xkZXInIDogJ1BpbiBmb2xkZXInKS5zZXRJY29uKCdwaW4nKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHBpbm5lZCA/IHRoaXMudW5waW4oZmlsZS5wYXRoKSA6IHRoaXMucGluKGZpbGUucGF0aCkpKTtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ05ldyBub3RlJykuc2V0SWNvbignZmlsZS1wbHVzJylcbiAgICAgICAgICAgICAgICAub25DbGljaygoKSA9PiB0aGlzLmNyZWF0ZUVudHJ5KGZhbHNlLCBmaWxlLnBhdGgpKSk7XG4gICAgICAgICAgICBtZW51LmFkZEl0ZW0oaSA9PiBpLnNldFRpdGxlKCdOZXcgZm9sZGVyJykuc2V0SWNvbignZm9sZGVyLXBsdXMnKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuY3JlYXRlRW50cnkodHJ1ZSwgZmlsZS5wYXRoKSkpO1xuICAgICAgICAgICAgbWVudS5hZGRTZXBhcmF0b3IoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1JlbmFtZScpLnNldEljb24oJ3BlbmNpbCcpLm9uQ2xpY2soKCkgPT4gdGhpcy5yZW5hbWVGaWxlKGZpbGUpKSk7XG4gICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ0RlbGV0ZScpLnNldEljb24oJ3RyYXNoJykub25DbGljaygoKSA9PiB0aGlzLmRlbGV0ZUZpbGUoZmlsZSkpKTtcblxuICAgICAgICBtZW51LnNob3dBdE1vdXNlRXZlbnQoZSk7XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIGZpbGUgb3BlcmF0aW9ucyBcdTI1MDBcdTI1MDBcblxuICAgIHByaXZhdGUgY3JlYXRlRW50cnkoaXNGb2xkZXI6IGJvb2xlYW4sIHBhcmVudFBhdGg6IHN0cmluZykge1xuICAgICAgICBuZXcgUHJvbXB0TW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ05ldyBmb2xkZXInIDogJ05ldyBub3RlJyxcbiAgICAgICAgICAgIGlzRm9sZGVyID8gJ0ZvbGRlciBuYW1lJyA6ICdOb3RlIG5hbWUnLFxuICAgICAgICAgICAgYXN5bmMgbmFtZSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgcGF0aCA9IChwYXJlbnRQYXRoID8gcGFyZW50UGF0aCArICcvJyA6ICcnKSArIG5hbWUgKyAoaXNGb2xkZXIgPyAnJyA6ICcubWQnKTtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHBhdGgpKSB7IG5ldyBOb3RpY2UoJ0FscmVhZHkgZXhpc3RzLicpOyByZXR1cm47IH1cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoaXNGb2xkZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LmNyZWF0ZUZvbGRlcihwYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgJycpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlYWYoKS5vcGVuRmlsZShmaWxlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdDb3VsZCBub3QgY3JlYXRlOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgICAgICAgICB9LFxuICAgICAgICApLm9wZW4oKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlbmFtZUZpbGUoZmlsZTogVEFic3RyYWN0RmlsZSkge1xuICAgICAgICBjb25zdCBvbGROYW1lID0gZmlsZSBpbnN0YW5jZW9mIFRGaWxlID8gZmlsZS5iYXNlbmFtZSA6IGZpbGUubmFtZTtcbiAgICAgICAgbmV3IFByb21wdE1vZGFsKHRoaXMuYXBwLCAnUmVuYW1lJywgb2xkTmFtZSwgYXN5bmMgbmV3TmFtZSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJlbnQgPSBmaWxlLnBhcmVudD8ucGF0aCA/PyAnJztcbiAgICAgICAgICAgIGNvbnN0IHN1ZmZpeCA9IGZpbGUgaW5zdGFuY2VvZiBURmlsZSA/ICcuJyArIGZpbGUuZXh0ZW5zaW9uIDogJyc7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXRoID0gKHBhcmVudCA/IHBhcmVudCArICcvJyA6ICcnKSArIG5ld05hbWUgKyBzdWZmaXg7XG4gICAgICAgICAgICB0cnkgeyBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZW5hbWUoZmlsZSwgbmV3UGF0aCk7IH1cbiAgICAgICAgICAgIGNhdGNoIChlcnIpIHsgbmV3IE5vdGljZSgnUmVuYW1lIGZhaWxlZDogJyArIFN0cmluZyhlcnIpKTsgfVxuICAgICAgICB9KS5vcGVuKCk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBkZWxldGVGaWxlKGZpbGU6IFRBYnN0cmFjdEZpbGUpIHtcbiAgICAgICAgdHJ5IHsgYXdhaXQgdGhpcy5hcHAudmF1bHQudHJhc2goZmlsZSwgdHJ1ZSk7IH1cbiAgICAgICAgY2F0Y2ggKGVycikgeyBuZXcgTm90aWNlKCdEZWxldGUgZmFpbGVkOiAnICsgU3RyaW5nKGVycikpOyB9XG4gICAgfVxuXG4gICAgLy8gXHUyNTAwXHUyNTAwIHBpbiBtYW5hZ2VtZW50IChjYWxsZWQgYnkgcGx1Z2luIHRvbykgXHUyNTAwXHUyNTAwXG5cbiAgICBwaW4ocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGlmICh0aGlzLmRhdGEucGlubmVkRm9sZGVycy5pbmNsdWRlcyhwYXRoKSkgcmV0dXJuO1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5wdXNoKHBhdGgpO1xuICAgICAgICBpZiAoIXRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoKSB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHBhdGg7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHVucGluKHBhdGg6IHN0cmluZykge1xuICAgICAgICB0aGlzLmRhdGEucGlubmVkRm9sZGVycyA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZpbHRlcihwID0+IHAgIT09IHBhdGgpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggPT09IHBhdGgpXG4gICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzWzBdID8/IG51bGw7XG4gICAgICAgIHRoaXMucGVyc2lzdCgpO1xuICAgICAgICB0aGlzLmRyYXcoKTtcbiAgICB9XG59XG5cbi8vIFx1MjUwMFx1MjUwMCBQbHVnaW4gXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXHUyNTAwXG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEZvbGRlclBpblBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gICAgZGF0YTogUGx1Z2luRGF0YSA9IHsgLi4uREVGQVVMVF9EQVRBIH07XG4gICAgcHJpdmF0ZSBzYXZlID0gZGVib3VuY2UoKCkgPT4gdGhpcy5zYXZlRGF0YSh0aGlzLmRhdGEpLCA0MDAsIHRydWUpO1xuXG4gICAgYXN5bmMgb25sb2FkKCkge1xuICAgICAgICB0aGlzLmRhdGEgPSBPYmplY3QuYXNzaWduKHsgLi4uREVGQVVMVF9EQVRBIH0sIGF3YWl0IHRoaXMubG9hZERhdGEoKSk7XG5cbiAgICAgICAgdGhpcy5yZWdpc3RlclZpZXcoVklFV19UWVBFLCBsZWFmID0+XG4gICAgICAgICAgICBuZXcgRm9sZGVyUGluVmlldyhsZWFmLCB0aGlzLmRhdGEsICgpID0+IHRoaXMuc2F2ZSgpKVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmFkZFJpYmJvbkljb24oJ3BpbicsICdGb2xkZXIgUGluIFZpZXcnLCAoKSA9PiB0aGlzLmFjdGl2YXRlVmlldygpKTtcblxuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW1lbnUnLCAobWVudSwgZmlsZSwgc291cmNlKSA9PiB7XG4gICAgICAgICAgICBpZiAoc291cmNlID09PSBWSUVXX1RZUEUgfHwgIShmaWxlIGluc3RhbmNlb2YgVEZvbGRlcikpIHJldHVybjtcbiAgICAgICAgICAgIG1lbnUuYWRkSXRlbShpID0+IGkuc2V0VGl0bGUoJ1BpbiBmb2xkZXInKS5zZXRJY29uKCdwaW4nKVxuICAgICAgICAgICAgICAgIC5vbkNsaWNrKCgpID0+IHRoaXMuZ2V0VmlldygpPy5waW4oZmlsZS5wYXRoKSkpO1xuICAgICAgICB9KSk7XG5cbiAgICAgICAgdGhpcy5yZWdpc3RlckV2ZW50KHRoaXMuYXBwLnZhdWx0Lm9uKCdjcmVhdGUnLCAgKCkgICAgICA9PiB0aGlzLnJlZnJlc2goKSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ2RlbGV0ZScsICBmICAgICAgID0+IHsgdGhpcy5vbkRlbGV0ZShmLnBhdGgpOyB0aGlzLnJlZnJlc2goKTsgfSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAudmF1bHQub24oJ3JlbmFtZScsICAoZiwgb2xkKSA9PiB7IHRoaXMub25SZW5hbWUoZi5wYXRoLCBvbGQpOyB0aGlzLnJlZnJlc2goKTsgfSkpO1xuICAgICAgICB0aGlzLnJlZ2lzdGVyRXZlbnQodGhpcy5hcHAud29ya3NwYWNlLm9uKCdmaWxlLW9wZW4nLCAoKSA9PiB0aGlzLnJlZnJlc2goKSkpO1xuXG4gICAgICAgIHRoaXMuYXBwLndvcmtzcGFjZS5vbkxheW91dFJlYWR5KCgpID0+IHRoaXMuYWN0aXZhdGVWaWV3KCkpO1xuICAgIH1cblxuICAgIG9udW5sb2FkKCkgeyB0aGlzLmFwcC53b3Jrc3BhY2UuZGV0YWNoTGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSk7IH1cblxuICAgIHByaXZhdGUgb25EZWxldGUocGF0aDogc3RyaW5nKSB7XG4gICAgICAgIGNvbnN0IGdvbmUgPSAocDogc3RyaW5nKSA9PiBwID09PSBwYXRoIHx8IHAuc3RhcnRzV2l0aChwYXRoICsgJy8nKTtcbiAgICAgICAgdGhpcy5kYXRhLnBpbm5lZEZvbGRlcnMgICA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzLmZpbHRlcihwID0+ICFnb25lKHApKTtcbiAgICAgICAgdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycyA9IHRoaXMuZGF0YS5leHBhbmRlZEZvbGRlcnMuZmlsdGVyKHAgPT4gIWdvbmUocCkpO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGggJiYgZ29uZSh0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCkpXG4gICAgICAgICAgICB0aGlzLmRhdGEuYWN0aXZlRm9sZGVyUGF0aCA9IHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzWzBdID8/IG51bGw7XG4gICAgICAgIHRoaXMuc2F2ZSgpO1xuICAgIH1cblxuICAgIHByaXZhdGUgb25SZW5hbWUocGF0aDogc3RyaW5nLCBvbGQ6IHN0cmluZykge1xuICAgICAgICBjb25zdCByZW1hcCA9IChwOiBzdHJpbmcpID0+XG4gICAgICAgICAgICBwID09PSBvbGQgPyBwYXRoIDogcC5zdGFydHNXaXRoKG9sZCArICcvJykgPyBwYXRoICsgcC5zbGljZShvbGQubGVuZ3RoKSA6IHA7XG4gICAgICAgIHRoaXMuZGF0YS5waW5uZWRGb2xkZXJzICAgPSB0aGlzLmRhdGEucGlubmVkRm9sZGVycy5tYXAocmVtYXApO1xuICAgICAgICB0aGlzLmRhdGEuZXhwYW5kZWRGb2xkZXJzID0gdGhpcy5kYXRhLmV4cGFuZGVkRm9sZGVycy5tYXAocmVtYXApO1xuICAgICAgICBpZiAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpIHRoaXMuZGF0YS5hY3RpdmVGb2xkZXJQYXRoID0gcmVtYXAodGhpcy5kYXRhLmFjdGl2ZUZvbGRlclBhdGgpO1xuICAgICAgICB0aGlzLnNhdmUoKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZnJlc2goKSB7IHRoaXMuZ2V0VmlldygpPy5yZWZyZXNoKCk7IH1cblxuICAgIHByaXZhdGUgYXN5bmMgYWN0aXZhdGVWaWV3KCkge1xuICAgICAgICBpZiAodGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShWSUVXX1RZUEUpLmxlbmd0aCA+IDApIHJldHVybjtcbiAgICAgICAgYXdhaXQgdGhpcy5hcHAud29ya3NwYWNlLmdldExlZnRMZWFmKGZhbHNlKT8uc2V0Vmlld1N0YXRlKHsgdHlwZTogVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRWaWV3KCk6IEZvbGRlclBpblZpZXcgfCBudWxsIHtcbiAgICAgICAgcmV0dXJuICh0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKFZJRVdfVFlQRSlbMF0/LnZpZXcgYXMgRm9sZGVyUGluVmlldykgPz8gbnVsbDtcbiAgICB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLHNCQUdPO0FBRVAsSUFBTSxZQUFZO0FBUWxCLElBQU0sZUFBMkIsRUFBRSxlQUFlLENBQUMsR0FBRyxrQkFBa0IsTUFBTSxpQkFBaUIsQ0FBQyxFQUFFO0FBSWxHLElBQU0sY0FBTixjQUEwQixzQkFBTTtBQUFBLEVBRzVCLFlBQ0ksS0FDUSxTQUNBLFNBQ0EsVUFDVjtBQUFFLFVBQU0sR0FBRztBQUhEO0FBQ0E7QUFDQTtBQUNJLFNBQUssUUFBUTtBQUFBLEVBQVM7QUFBQSxFQUV0QyxTQUFTO0FBQ0wsU0FBSyxRQUFRLFFBQVEsS0FBSyxPQUFPO0FBQ2pDLFFBQUksd0JBQVEsS0FBSyxTQUFTLEVBQUUsUUFBUSxPQUFLO0FBQ3JDLFFBQUUsU0FBUyxLQUFLLE9BQU8sRUFBRSxTQUFTLE9BQU0sS0FBSyxRQUFRLENBQUU7QUFDdkQsUUFBRSxRQUFRLE9BQU87QUFDakIsUUFBRSxRQUFRLE1BQU07QUFDaEIsUUFBRSxRQUFRLGlCQUFpQixXQUFXLE9BQUs7QUFDdkMsWUFBSSxFQUFFLFFBQVEsU0FBUztBQUFFLFlBQUUsZUFBZTtBQUFHLGVBQUssT0FBTztBQUFBLFFBQUc7QUFBQSxNQUNoRSxDQUFDO0FBQUEsSUFDTCxDQUFDO0FBQ0QsUUFBSSx3QkFBUSxLQUFLLFNBQVMsRUFDckIsVUFBVSxPQUFLLEVBQUUsY0FBYyxJQUFJLEVBQUUsT0FBTyxFQUFFLFFBQVEsTUFBTSxLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDbkY7QUFBQSxFQUVRLFNBQVM7QUFDYixVQUFNLE9BQU8sS0FBSyxNQUFNLEtBQUs7QUFDN0IsUUFB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
