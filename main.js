"use strict";
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
var import_obsidian3 = require("obsidian");

// src/model.ts
var SORT_ORDERS = ["name-asc", "name-desc", "mtime-desc", "mtime-asc", "ctime-desc", "ctime-asc"];
var record = (v) => v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
var paths = (v) => Array.isArray(v) ? [...new Set(v.filter((p) => typeof p === "string" && p.length > 0 && p !== "/" && !p.split("/").some((s) => !s || s === "." || s === "..")))] : [];
var zoneKey = (path) => "@" + (path != null ? path : "");
var containsPath = (folder, path) => !folder || path === folder || path.startsWith(folder + "/");
function normalizeData(raw) {
  var _a, _b;
  const input = record(raw);
  const pins = paths(input.pinnedFolders);
  const active = typeof input.activeFolderPath === "string" && pins.includes(input.activeFolderPath) ? input.activeFolderPath : (_a = pins[0]) != null ? _a : null;
  const sortOrder = SORT_ORDERS.includes(input.sortOrder) ? input.sortOrder : input.sortOrder === "desc" ? "name-desc" : "name-asc";
  const data = {
    version: 3,
    pinnedFolders: pins,
    activeFolderPath: active,
    sortOrder,
    language: input.language === "zh" || input.language === "en" ? input.language : "auto",
    autoReveal: input.autoReveal === true,
    zones: /* @__PURE__ */ Object.create(null)
  };
  for (const path of [null, ...pins]) {
    const saved = record(record(input.zones)[zoneKey(path)]);
    data.zones[zoneKey(path)] = {
      expanded: paths((_b = saved.expanded) != null ? _b : input.expandedFolders).filter((p) => containsPath(path, p) && p !== path),
      scrollTop: typeof saved.scrollTop === "number" && Number.isFinite(saved.scrollTop) ? Math.max(0, saved.scrollTop) : 0
    };
  }
  return data;
}
function getZone(data, path = data.activeFolderPath) {
  var _a;
  return (_a = data.zones[zoneKey(path)]) != null ? _a : data.zones[zoneKey(path)] = { expanded: [], scrollTop: 0 };
}
function revealZone(pins, current, file) {
  if (current !== null && containsPath(current, file)) return current;
  if (!pins.length) return null;
  return pins.filter((p) => containsPath(p, file)).sort((a, b) => b.length - a.length)[0];
}
function ancestorPaths(file, root) {
  const parents = [];
  let path = file.slice(0, file.lastIndexOf("/"));
  if (!file.includes("/")) return parents;
  while (path && path !== root && containsPath(root, path)) {
    parents.unshift(path);
    const index = path.lastIndexOf("/");
    if (index < 0) break;
    path = path.slice(0, index);
  }
  return parents;
}
function remapData(data, oldPath, newPath) {
  const remap = (p) => containsPath(oldPath, p) ? newPath + p.slice(oldPath.length) : p;
  data.pinnedFolders = [...new Set(data.pinnedFolders.map(remap))];
  if (data.activeFolderPath) data.activeFolderPath = remap(data.activeFolderPath);
  const zones = /* @__PURE__ */ Object.create(null);
  for (const [key, state] of Object.entries(data.zones)) {
    const root = remap(key.slice(1)) || null;
    zones[zoneKey(root)] = { ...state, expanded: state.expanded.map(remap).filter((p) => containsPath(root, p) && p !== root) };
  }
  data.zones = zones;
}
function removePath(data, path) {
  var _a, _b;
  const oldIndex = data.pinnedFolders.indexOf((_a = data.activeFolderPath) != null ? _a : "");
  data.pinnedFolders = data.pinnedFolders.filter((p) => !containsPath(path, p));
  if (data.activeFolderPath && containsPath(path, data.activeFolderPath))
    data.activeFolderPath = (_b = data.pinnedFolders[Math.min(oldIndex, data.pinnedFolders.length - 1)]) != null ? _b : null;
  for (const [key, zone] of Object.entries(data.zones)) {
    if (containsPath(path, key.slice(1))) delete data.zones[key];
    else zone.expanded = zone.expanded.filter((p) => !containsPath(path, p));
  }
}
function comparator(order, locale) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  const nameCompare = (a, b) => collator.compare(a.name, b.name) || a.name.localeCompare(b.name);
  return (a, b) => {
    var _a, _b;
    if (a.folder !== b.folder) return a.folder ? -1 : 1;
    if (a.folder || order.startsWith("name")) return nameCompare(a, b) * (order === "name-desc" ? -1 : 1);
    const field = order.startsWith("mtime") ? "mtime" : "ctime";
    const diff = ((_a = a[field]) != null ? _a : 0) - ((_b = b[field]) != null ? _b : 0);
    return (order.endsWith("desc") ? -diff : diff) || nameCompare(a, b);
  };
}
function validName(name) {
  return !!name && name === name.trim() && !/[<>:"/\\|?*]/.test(name) && ![...name].some((character) => character.charCodeAt(0) < 32) && !/[. ]$/.test(name) && name !== "." && name !== ".." && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name);
}
function entryPath(parent, name, extension = "") {
  const suffix = extension && !name.toLowerCase().endsWith("." + extension.toLowerCase()) ? "." + extension : "";
  return (parent && parent !== "/" ? parent + "/" : "") + name + suffix;
}
function revealScroll(scroll, viewport, start, width) {
  if (viewport <= 0) return scroll;
  if (start < scroll) return Math.max(0, start);
  if (start + width > scroll + viewport) return Math.max(0, start + Math.min(width, viewport) - viewport);
  return scroll;
}

// src/i18n.ts
var en = {
  title: "Folder Pin View",
  newNote: "New note",
  newFolder: "New folder",
  sort: "Change sort order",
  autoReveal: "Auto-reveal active file",
  expand: "Expand all",
  collapse: "Collapse all",
  pin: "Pin folder",
  unpin: "Unpin folder",
  rename: "Rename",
  delete: "Delete",
  deleteSelected: "Delete selected",
  openTab: "Open in new tab",
  empty: "This folder is empty",
  pinHint: "Right-click a folder in the file explorer to pin it here.",
  untitled: "Untitled",
  untitledFolder: "Untitled folder",
  invalidName: "Enter a valid name without path separators or reserved characters.",
  exists: "An item with this name already exists.",
  missing: "This file or folder no longer exists.",
  invalidMove: "A folder cannot be moved into itself or one of its subfolders.",
  operationFailed: "Operation failed",
  saveFailed: "Could not save Folder Pin View settings.",
  editHint: "Enter to save \xB7 Esc to cancel",
  language: "Language",
  followApp: "Follow Obsidian",
  languageDesc: "Applies to this plugin. Native dialogs follow Obsidian.",
  autoRevealDesc: "Follow the active note within pinned folders. Notes outside them leave this view unchanged.",
  openView: "Open folder regions",
  reveal: "Reveal active file",
  regions: "Folder regions",
  files: "Files",
  vault: "Vault",
  "name-asc": "File name (A\u2013Z)",
  "name-desc": "File name (Z\u2013A)",
  "mtime-desc": "Modified time (new to old)",
  "mtime-asc": "Modified time (old to new)",
  "ctime-desc": "Created time (new to old)",
  "ctime-asc": "Created time (old to new)"
};
var zh = {
  title: "\u6587\u4EF6\u533A",
  newNote: "\u65B0\u5EFA\u7B14\u8BB0",
  newFolder: "\u65B0\u5EFA\u6587\u4EF6\u5939",
  sort: "\u66F4\u6539\u6392\u5E8F\u65B9\u5F0F",
  autoReveal: "\u81EA\u52A8\u663E\u793A\u5F53\u524D\u6587\u4EF6",
  expand: "\u5168\u90E8\u5C55\u5F00",
  collapse: "\u5168\u90E8\u6298\u53E0",
  pin: "\u56FA\u5B9A\u6587\u4EF6\u5939",
  unpin: "\u53D6\u6D88\u56FA\u5B9A",
  rename: "\u91CD\u547D\u540D",
  delete: "\u5220\u9664",
  deleteSelected: "\u5220\u9664\u6240\u9009\u9879\u76EE",
  openTab: "\u5728\u65B0\u6807\u7B7E\u9875\u4E2D\u6253\u5F00",
  empty: "\u6B64\u6587\u4EF6\u5939\u4E3A\u7A7A",
  pinHint: "\u5728\u6587\u4EF6\u5217\u8868\u4E2D\u53F3\u952E\u6587\u4EF6\u5939\uFF0C\u5373\u53EF\u5C06\u5B83\u56FA\u5B9A\u5230\u8FD9\u91CC\u3002",
  untitled: "\u672A\u547D\u540D",
  untitledFolder: "\u672A\u547D\u540D\u6587\u4EF6\u5939",
  invalidName: "\u8BF7\u8F93\u5165\u6709\u6548\u540D\u79F0\uFF0C\u4E0D\u5305\u542B\u8DEF\u5F84\u5206\u9694\u7B26\u6216\u4FDD\u7559\u5B57\u7B26\u3002",
  exists: "\u5DF2\u5B58\u5728\u540C\u540D\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u3002",
  missing: "\u6B64\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u5DF2\u4E0D\u5B58\u5728\u3002",
  invalidMove: "\u4E0D\u80FD\u5C06\u6587\u4EF6\u5939\u79FB\u5165\u81EA\u8EAB\u6216\u5176\u5B50\u6587\u4EF6\u5939\u3002",
  operationFailed: "\u64CD\u4F5C\u5931\u8D25",
  saveFailed: "\u65E0\u6CD5\u4FDD\u5B58\u6587\u4EF6\u533A\u8BBE\u7F6E\u3002",
  editHint: "Enter \u4FDD\u5B58 \xB7 Esc \u53D6\u6D88",
  language: "\u754C\u9762\u8BED\u8A00",
  followApp: "\u8DDF\u968F Obsidian",
  languageDesc: "\u9002\u7528\u4E8E\u672C\u63D2\u4EF6\uFF1B\u539F\u751F\u5BF9\u8BDD\u6846\u8DDF\u968F Obsidian \u7684\u8BED\u8A00\u3002",
  autoRevealDesc: "\u5728\u5DF2\u56FA\u5B9A\u7684\u6587\u4EF6\u533A\u5185\u8DDF\u968F\u5F53\u524D\u7B14\u8BB0\uFF1B\u5176\u4ED6\u4F4D\u7F6E\u7684\u7B14\u8BB0\u4E0D\u4F1A\u6539\u53D8\u6B64\u89C6\u56FE\u3002",
  openView: "\u6253\u5F00\u6587\u4EF6\u533A",
  reveal: "\u663E\u793A\u5F53\u524D\u6587\u4EF6",
  regions: "\u6587\u4EF6\u533A\u5207\u6362",
  files: "\u6587\u4EF6\u5217\u8868",
  vault: "\u4ED3\u5E93",
  "name-asc": "\u6587\u4EF6\u540D\uFF08A\u2013Z\uFF09",
  "name-desc": "\u6587\u4EF6\u540D\uFF08Z\u2013A\uFF09",
  "mtime-desc": "\u4FEE\u6539\u65F6\u95F4\uFF08\u4ECE\u65B0\u5230\u65E7\uFF09",
  "mtime-asc": "\u4FEE\u6539\u65F6\u95F4\uFF08\u4ECE\u65E7\u5230\u65B0\uFF09",
  "ctime-desc": "\u521B\u5EFA\u65F6\u95F4\uFF08\u4ECE\u65B0\u5230\u65E7\uFF09",
  "ctime-asc": "\u521B\u5EFA\u65F6\u95F4\uFF08\u4ECE\u65E7\u5230\u65B0\uFF09"
};
function resolveLanguage(language, appLanguage) {
  return language === "auto" ? appLanguage.toLowerCase().startsWith("zh") ? "zh" : "en" : language;
}
function translate(language, key) {
  return (language === "zh" ? zh : en)[key];
}

// src/view.ts
var import_obsidian2 = require("obsidian");

// src/create.ts
var reservations = /* @__PURE__ */ new WeakMap();
async function createUntitled(vault, parent, folder, name) {
  let pending = reservations.get(vault);
  if (!pending) reservations.set(vault, pending = /* @__PURE__ */ new Set());
  for (let suffix = 0; ; suffix++) {
    if (vault.getAbstractFileByPath(parent.path) !== parent) throw new Error("Parent folder no longer exists.");
    const path = entryPath(parent.path, name + (suffix ? ` ${suffix}` : ""), folder ? "" : "md");
    if (pending.has(path) || vault.getAbstractFileByPath(path)) continue;
    pending.add(path);
    try {
      return folder ? await vault.createFolder(path) : await vault.create(path, "");
    } catch (error) {
      if (!vault.getAbstractFileByPath(path)) throw error;
    } finally {
      pending.delete(path);
    }
  }
}

// src/move.ts
var import_obsidian = require("obsidian");
function planMove(vault, paths2, target) {
  if (vault.getAbstractFileByPath(target.path) !== target) return { moves: [], error: "missing" };
  const selected = [...new Set(paths2)];
  const roots = selected.filter((path) => !selected.some((other) => other !== path && containsPath(other, path)));
  const moves = [];
  const destinations = /* @__PURE__ */ new Set();
  for (const path of roots) {
    const file = vault.getAbstractFileByPath(path);
    if (!file) return { moves: [], error: "missing" };
    if (file instanceof import_obsidian.TFolder && containsPath(file.path, target.path)) return { moves: [], error: "invalidMove" };
    if (file.parent === target) continue;
    const destination = entryPath(target.path, file.name);
    const key = destination.normalize("NFC").toLocaleLowerCase();
    if (destinations.has(key) || target.children.some((child) => child.name.normalize("NFC").toLocaleLowerCase() === file.name.normalize("NFC").toLocaleLowerCase()))
      return { moves: [], error: "exists" };
    destinations.add(key);
    moves.push({ file, from: path, path: destination });
  }
  return { moves };
}

// src/view.ts
var VIEW_TYPE = "folder-pin-view";
var nextLabelId = 0;
var FolderPinView = class extends import_obsidian2.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.containerLabels = [];
    this.pinSignature = "";
    this.rows = /* @__PURE__ */ new Map();
    this.visible = [];
    this.focusedPath = null;
    this.selectedPaths = /* @__PURE__ */ new Set();
    this.selectionAnchor = null;
    this.renderedZone = null;
    this.lastActive = null;
    this.dragPath = null;
    this.fileDrag = null;
    this.editor = null;
    this.creationId = 0;
    this.openingPath = null;
    this.deletingPaths = /* @__PURE__ */ new Set();
    this.closed = false;
    this.lastLanguage = "";
    this.t = (key) => this.plugin.t(key);
  }
  get data() {
    return this.plugin.data;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return this.t("title");
  }
  getIcon() {
    return "pin";
  }
  async onOpen() {
    this.closed = false;
    this.contentEl.empty();
    this.contentEl.addClass("fpv-root");
    this.toolbar = this.contentEl.createDiv({ cls: "nav-header fpv-toolbar", attr: { role: "toolbar" } });
    this.pinBar = this.contentEl.createDiv({ cls: "fpv-bar", attr: { role: "tablist" } });
    this.tree = this.contentEl.createDiv({ cls: "fpv-tree", attr: { role: "tree", tabindex: "0" } });
    this.containerLabels = [];
    for (const [container, key] of [[this.toolbar, "title"], [this.pinBar, "regions"], [this.tree, "files"]]) {
      const id = `fpv-label-${++nextLabelId}`;
      const label = this.contentEl.createSpan({ attr: { id, hidden: "" } });
      container.setAttribute("aria-labelledby", id);
      this.containerLabels.push({ el: label, key });
    }
    this.registerDomEvent(this.tree, "scroll", () => {
      this.captureScroll();
      this.plugin.persist();
    });
    this.registerDomEvent(this.tree, "keydown", (event) => this.onTreeKey(event));
    this.registerDomEvent(this.tree, "contextmenu", (event) => {
      if (event.target === this.tree || event.target.closest(".fpv-empty")) {
        event.preventDefault();
        this.creationMenu(new import_obsidian2.Menu(), this.rootPath()).showAtMouseEvent(event);
      }
    });
    this.registerDomEvent(this.pinBar, "wheel", (event) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || this.pinBar.scrollWidth <= this.pinBar.clientWidth) return;
      const old = this.pinBar.scrollLeft;
      this.pinBar.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.pinBar.clientWidth : 1);
      if (old !== this.pinBar.scrollLeft) event.preventDefault();
    }, { passive: false });
    this.registerDomEvent(this.pinBar, "scroll", () => this.updateOverflow());
    this.localize();
    if (this.data.autoReveal) this.revealActive();
  }
  async onClose() {
    this.creationId++;
    this.captureScroll();
    this.closed = true;
    this.clearFileDrag();
    if (this.frame !== void 0) this.contentEl.win.cancelAnimationFrame(this.frame);
    this.cancelEditor();
    this.plugin.flushSave();
  }
  onResize() {
    this.schedulePinReveal();
  }
  localize() {
    if (!this.tree) return;
    this.lastLanguage = this.plugin.language;
    this.containerLabels.forEach(({ el, key }) => el.setText(this.t(key)));
    this.buildToolbar();
    this.sync();
  }
  sync() {
    var _a;
    if (!this.tree || this.closed) return;
    if (this.lastLanguage !== this.plugin.language) {
      this.localize();
      return;
    }
    if (this.renderedZone !== zoneKey(this.data.activeFolderPath) && !((_a = this.editor) == null ? void 0 : _a.busy)) {
      this.creationId++;
      this.cancelEditor();
    }
    this.renderPins();
    this.renderTree(false);
  }
  tool(icon, key, handler) {
    const button = this.toolbar.createEl("button", { cls: "clickable-icon nav-action-button fpv-tool", attr: { type: "button" } });
    (0, import_obsidian2.setIcon)(button, icon);
    (0, import_obsidian2.setTooltip)(button, this.t(key));
    button.addEventListener("click", handler);
    return button;
  }
  buildToolbar() {
    this.toolbar.empty();
    this.tool("square-pen", "newNote", () => {
      void this.startCreate(false, this.rootPath());
    });
    this.tool("folder-plus", "newFolder", () => {
      void this.startCreate(true, this.rootPath());
    });
    const sort = this.tool("arrow-up-narrow-wide", "sort", () => {
      const menu = new import_obsidian2.Menu();
      SORT_ORDERS.forEach((order, index) => {
        if (index === 2 || index === 4) menu.addSeparator();
        menu.addItem((item) => item.setTitle(this.t(order)).setChecked(this.data.sortOrder === order).onClick(() => {
          this.data.sortOrder = order;
          this.plugin.persist();
          this.plugin.views().forEach((view) => view.renderTree());
        }));
      });
      const rect = sort.getBoundingClientRect();
      menu.showAtPosition({ x: rect.left, y: rect.bottom });
    });
    this.followButton = this.tool("gallery-vertical", "autoReveal", () => {
      this.data.autoReveal = !this.data.autoReveal;
      this.plugin.persist();
      this.plugin.views().forEach((view) => {
        view.updateToolbar();
        if (this.data.autoReveal) view.revealActive();
      });
    });
    this.collapseButton = this.tool("chevrons-up-down", "expand", () => this.toggleAll());
    this.updateToolbar();
  }
  updateToolbar() {
    if (!this.collapseButton) return;
    this.followButton.toggleClass("is-active", this.data.autoReveal);
    this.followButton.setAttribute("aria-pressed", String(this.data.autoReveal));
    const hasExpanded = getZone(this.data).expanded.length > 0;
    (0, import_obsidian2.setIcon)(this.collapseButton, hasExpanded ? "chevrons-down-up" : "chevrons-up-down");
    (0, import_obsidian2.setTooltip)(this.collapseButton, this.t(hasExpanded ? "collapse" : "expand"));
  }
  rootPath() {
    var _a;
    return (_a = this.data.activeFolderPath) != null ? _a : "";
  }
  rootFolder() {
    const root = this.data.activeFolderPath ? this.app.vault.getAbstractFileByPath(this.data.activeFolderPath) : this.app.vault.getRoot();
    return root instanceof import_obsidian2.TFolder ? root : null;
  }
  renderPins() {
    var _a;
    const signature = JSON.stringify([this.data.pinnedFolders, this.plugin.language]);
    if (signature !== this.pinSignature) {
      const scroll = this.pinBar.scrollLeft;
      const hadFocus = this.pinBar.contains(this.contentEl.doc.activeElement);
      this.pinBar.empty();
      this.pinSignature = signature;
      this.data.pinnedFolders.forEach((path) => {
        const button = this.pinBar.createEl("button", {
          cls: "fpv-pin",
          text: path.split("/").pop() || path,
          attr: { type: "button", role: "tab", draggable: "true", "data-path": path, "aria-label": path }
        });
        (0, import_obsidian2.setTooltip)(button, path);
        button.addEventListener("click", () => this.selectRegion(path));
        button.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          new import_obsidian2.Menu().addItem((item) => item.setTitle(this.t("unpin")).setIcon("pin-off").onClick(() => {
            void this.plugin.setPinned(path, false);
          })).showAtMouseEvent(event);
        });
        button.addEventListener("keydown", (event) => {
          var _a2;
          const pins = this.data.pinnedFolders;
          let index = pins.indexOf(path);
          if (event.key === "ArrowLeft") index = (index + pins.length - 1) % pins.length;
          else if (event.key === "ArrowRight") index = (index + 1) % pins.length;
          else if (event.key === "Home") index = 0;
          else if (event.key === "End") index = pins.length - 1;
          else return;
          event.preventDefault();
          this.selectRegion(pins[index]);
          (_a2 = this.activePin()) == null ? void 0 : _a2.focus({ preventScroll: true });
        });
        button.addEventListener("dragstart", (event) => {
          var _a2;
          this.clearFileDrag();
          this.dragPath = path;
          button.addClass("is-dragging");
          (_a2 = event.dataTransfer) == null ? void 0 : _a2.setData("text/plain", path);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
        });
        button.addEventListener("dragend", () => {
          this.dragPath = null;
          this.pinBar.querySelectorAll(".is-dragging, .drag-over").forEach((el) => el.classList.remove("is-dragging", "drag-over"));
        });
        button.addEventListener("dragover", (event) => {
          if (this.fileDrag) return;
          if (!this.dragPath || this.dragPath === path) return;
          event.preventDefault();
          button.addClass("drag-over");
        });
        button.addEventListener("dragleave", () => button.removeClass("drag-over"));
        button.addEventListener("drop", (event) => {
          var _a2;
          if (this.fileDrag) return;
          event.preventDefault();
          const from = this.data.pinnedFolders.indexOf((_a2 = this.dragPath) != null ? _a2 : "");
          const to = this.data.pinnedFolders.indexOf(path);
          this.dragPath = null;
          button.removeClass("drag-over");
          if (from < 0 || to < 0 || from === to) return;
          const [moved] = this.data.pinnedFolders.splice(from, 1);
          this.data.pinnedFolders.splice(to, 0, moved);
          this.plugin.persist();
          this.plugin.views().forEach((view) => view.renderPins());
        });
        this.attachMoveTarget(button, () => this.app.vault.getAbstractFileByPath(path));
      });
      this.pinBar.scrollLeft = scroll;
      this.updatePinSelection();
      if (hadFocus) (_a = this.activePin()) == null ? void 0 : _a.focus({ preventScroll: true });
    } else this.updatePinSelection();
    this.pinBar.hidden = this.data.pinnedFolders.length === 0;
    this.schedulePinReveal();
  }
  updatePinSelection() {
    this.pinBar.querySelectorAll(".fpv-pin").forEach((button) => {
      const selected = button.dataset.path === this.data.activeFolderPath;
      button.toggleClass("is-active", selected);
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }
  activePin() {
    return this.pinBar.querySelector(".fpv-pin.is-active");
  }
  schedulePinReveal() {
    if (!this.pinBar || this.closed) return;
    if (this.frame !== void 0) this.contentEl.win.cancelAnimationFrame(this.frame);
    this.frame = this.contentEl.win.requestAnimationFrame(() => {
      this.frame = void 0;
      const button = this.activePin();
      if (button) {
        const bar = this.pinBar.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        const start = rect.left - bar.left + this.pinBar.scrollLeft;
        this.pinBar.scrollLeft = revealScroll(this.pinBar.scrollLeft, this.pinBar.clientWidth, start - 8, rect.width + 16);
      }
      this.updateOverflow();
    });
  }
  updateOverflow() {
    this.pinBar.toggleClass("has-before", this.pinBar.scrollLeft > 1);
    this.pinBar.toggleClass("has-after", this.pinBar.scrollLeft + this.pinBar.clientWidth < this.pinBar.scrollWidth - 1);
  }
  selectRegion(path) {
    var _a;
    if (((_a = this.editor) == null ? void 0 : _a.busy) || !this.data.pinnedFolders.includes(path)) return;
    this.creationId++;
    this.captureScroll();
    this.cancelEditor();
    this.data.activeFolderPath = path;
    this.focusedPath = null;
    this.selectedPaths.clear();
    this.selectionAnchor = null;
    this.plugin.persist();
    this.plugin.refreshViews();
  }
  captureScroll() {
    if (!this.tree || this.renderedZone === null) return;
    const zone = this.data.zones[this.renderedZone];
    if (zone) zone.scrollTop = this.tree.scrollTop;
  }
  renderTree(capture = true) {
    var _a, _b, _c;
    if (!this.tree || this.closed || this.editor) return;
    if (capture) this.captureScroll();
    const hadFocus = this.tree.contains(this.contentEl.doc.activeElement);
    const previousIndex = this.visible.findIndex((file) => file.path === this.focusedPath);
    this.tree.empty();
    this.rows.clear();
    this.visible = [];
    this.renderedZone = zoneKey(this.data.activeFolderPath);
    const root = this.rootFolder();
    if (root) {
      const expanded = new Set(getZone(this.data).expanded);
      const compare = comparator(this.data.sortOrder, this.plugin.language === "zh" ? "zh-CN" : "en");
      const sortInfo = (file) => ({
        name: file.name,
        folder: file instanceof import_obsidian2.TFolder,
        mtime: file instanceof import_obsidian2.TFile ? file.stat.mtime : 0,
        ctime: file instanceof import_obsidian2.TFile ? file.stat.ctime : 0
      });
      const stack = [];
      const pushChildren = (folder, depth) => {
        const sorted = [...folder.children].sort((a, b) => compare(sortInfo(a), sortInfo(b)));
        for (let index = sorted.length - 1; index >= 0; index--)
          stack.push({ file: sorted[index], depth, index, count: sorted.length });
      };
      pushChildren(root, 0);
      while (stack.length) {
        const { file, depth, index, count } = stack.pop();
        this.drawRow(file, depth, index, count, expanded.has(file.path));
        if (file instanceof import_obsidian2.TFolder && expanded.has(file.path)) pushChildren(file, depth + 1);
      }
    }
    if (!this.visible.length) this.tree.createDiv({ cls: "fpv-empty", text: root ? this.t("empty") : this.t("missing") });
    const visiblePaths = new Set(this.visible.map((file) => file.path));
    this.selectedPaths = new Set([...this.selectedPaths].filter((path) => visiblePaths.has(path)));
    if (this.selectionAnchor && !visiblePaths.has(this.selectionAnchor)) this.selectionAnchor = null;
    if (!this.data.pinnedFolders.length) this.tree.createDiv({ cls: "fpv-empty fpv-hint", text: this.t("pinHint") });
    this.tree.scrollTop = getZone(this.data).scrollTop;
    if (!this.focusedPath || !this.rows.has(this.focusedPath)) {
      const active = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path;
      this.focusedPath = active && this.rows.has(active) ? active : (_c = (_b = this.visible[Math.max(0, Math.min(previousIndex, this.visible.length - 1))]) == null ? void 0 : _b.path) != null ? _c : null;
    }
    this.updateHighlight();
    this.updateSelection();
    this.updateTabStops();
    if (hadFocus) this.focusRow(this.focusedPath, false);
    this.updateToolbar();
  }
  drawRow(file, depth, index, count, expanded) {
    const folder = file instanceof import_obsidian2.TFolder;
    const row = this.tree.createDiv({
      cls: "tree-item-self fpv-row" + (folder ? " fpv-folder" : " fpv-file"),
      attr: {
        role: "treeitem",
        tabindex: "-1",
        draggable: "true",
        "data-path": file.path,
        "aria-level": String(depth + 1),
        "aria-posinset": String(index + 1),
        "aria-setsize": String(count)
      }
    });
    row.style.setProperty("--fpv-depth", String(depth));
    const arrow = row.createSpan({ cls: "fpv-arrow", attr: { "aria-hidden": "true" } });
    if (folder) {
      (0, import_obsidian2.setIcon)(arrow, "chevron-right");
      row.setAttribute("aria-expanded", String(expanded));
    }
    row.createSpan({ cls: "fpv-name", text: file instanceof import_obsidian2.TFile && file.extension.toLowerCase() === "md" ? file.basename : file.name });
    (0, import_obsidian2.setTooltip)(row, file.path);
    this.rows.set(file.path, row);
    this.visible.push(file);
    row.addEventListener("dragstart", (event) => {
      if (this.editor || !event.dataTransfer) {
        event.preventDefault();
        return;
      }
      this.dragPath = null;
      this.fileDrag = this.selectedPaths.has(file.path) ? [...this.selectedPaths] : [file.path];
      event.dataTransfer.setData("application/x-folder-pin-view", file.path);
      event.dataTransfer.effectAllowed = "move";
      this.fileDrag.forEach((path) => {
        var _a;
        return (_a = this.rows.get(path)) == null ? void 0 : _a.addClass("is-dragging");
      });
    });
    row.addEventListener("dragend", () => this.clearFileDrag());
    if (folder) this.attachMoveTarget(row, () => this.app.vault.getAbstractFileByPath(file.path));
    row.addEventListener("focus", () => {
      this.focusedPath = file.path;
      this.updateTabStops();
    });
    row.addEventListener("click", (event) => {
      if (this.editor) return;
      this.focusedPath = file.path;
      if (event.shiftKey) {
        this.selectRange(file.path, event.ctrlKey || event.metaKey);
        row.focus({ preventScroll: true });
        return;
      }
      if (event.ctrlKey || event.metaKey) {
        this.toggleSelection(file.path);
        row.focus({ preventScroll: true });
        return;
      }
      this.selectOnly(file.path);
      if (folder) {
        row.focus({ preventScroll: true });
        this.toggleFolder(file.path);
      } else if (file instanceof import_obsidian2.TFile) void this.openFile(file);
    });
    row.addEventListener("auxclick", (event) => {
      if (event.button === 1 && file instanceof import_obsidian2.TFile) {
        event.preventDefault();
        void this.openFile(file, true);
      }
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
      this.focusedPath = file.path;
      row.focus({ preventScroll: true });
      this.fileMenu(file).showAtMouseEvent(event);
    });
  }
  clearFileDrag() {
    this.fileDrag = null;
    this.contentEl.querySelectorAll(".fpv-drop-target, .fpv-drop-invalid, .fpv-row.is-dragging").forEach((el) => el.classList.remove("fpv-drop-target", "fpv-drop-invalid", "is-dragging"));
  }
  attachMoveTarget(element, getTarget) {
    element.addEventListener("dragover", (event) => {
      if (!this.fileDrag) return;
      event.preventDefault();
      const target = getTarget();
      const plan = target instanceof import_obsidian2.TFolder ? planMove(this.app.vault, this.fileDrag, target) : null;
      element.toggleClass("fpv-drop-target", !!plan && !plan.error && plan.moves.length > 0);
      element.toggleClass("fpv-drop-invalid", !plan || !!plan.error);
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    });
    element.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && element.contains(event.relatedTarget)) return;
      element.removeClass("fpv-drop-target", "fpv-drop-invalid");
    });
    element.addEventListener("drop", (event) => {
      if (!this.fileDrag) return;
      event.preventDefault();
      event.stopPropagation();
      const paths2 = this.fileDrag;
      this.clearFileDrag();
      const target = getTarget();
      if (!(target instanceof import_obsidian2.TFolder)) {
        this.reportError(this.t("missing"));
        return;
      }
      void this.moveToFolder(paths2, target);
    });
  }
  async moveToFolder(paths2, target) {
    const plan = planMove(this.app.vault, paths2, target);
    if (plan.error) {
      this.reportError(this.t(plan.error));
      return;
    }
    if (!plan.moves.length) return;
    try {
      for (const move of plan.moves) {
        const { file, from } = move;
        if (this.app.vault.getAbstractFileByPath(from) !== file) throw new Error(this.t("missing"));
        const current = planMove(this.app.vault, [from], target);
        if (current.error) throw new Error(this.t(current.error));
        if (!current.moves.length) {
          move.path = file.path;
          continue;
        }
        move.path = current.moves[0].path;
        await this.app.fileManager.renameFile(file, move.path);
      }
      if (this.closed) return;
      const region = this.data.pinnedFolders.includes(target.path) ? target.path : this.data.activeFolderPath;
      if (region !== this.data.activeFolderPath) {
        this.captureScroll();
        this.data.activeFolderPath = region;
      }
      if (containsPath(region, target.path)) {
        const zone = getZone(this.data);
        zone.expanded = [.../* @__PURE__ */ new Set([...zone.expanded, ...ancestorPaths(plan.moves[0].path, region), target.path])];
        this.focusedPath = plan.moves[0].path;
        this.selectedPaths = new Set(plan.moves.map((move) => move.path));
        this.selectionAnchor = plan.moves[0].path;
      }
      this.plugin.persist();
      this.plugin.refreshViews();
      const row = this.rows.get(plan.moves[0].path);
      if (row) this.revealRow(row);
    } catch (error) {
      this.reportError(error);
    }
  }
  toggleFolder(path, open) {
    const zone = getZone(this.data);
    const expanded = new Set(zone.expanded);
    if (open != null ? open : !expanded.has(path)) expanded.add(path);
    else expanded.delete(path);
    zone.expanded = [...expanded];
    this.plugin.persist();
    this.renderTree();
  }
  toggleAll() {
    if (this.editor) return;
    const zone = getZone(this.data);
    if (zone.expanded.length) zone.expanded = [];
    else {
      const root = this.rootFolder();
      const stack = root ? [...root.children] : [];
      while (stack.length) {
        const file = stack.pop();
        if (file instanceof import_obsidian2.TFolder) {
          zone.expanded.push(file.path);
          for (const child of file.children) stack.push(child);
        }
      }
    }
    this.plugin.persist();
    this.renderTree();
  }
  activeFileChanged() {
    var _a, _b;
    if (!this.tree || this.closed) return;
    const current = (_b = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) != null ? _b : null;
    this.updateHighlight();
    if (!current || current === this.lastActive) return;
    if (current !== this.openingPath) this.creationId++;
    this.lastActive = current;
    if (this.data.autoReveal && !this.editor) this.revealActive();
  }
  revealActive() {
    const file = this.app.workspace.getActiveFile();
    if (!file || this.editor || this.closed) return;
    const target = revealZone(this.data.pinnedFolders, this.data.activeFolderPath, file.path);
    if (target === void 0) return;
    const switched = target !== this.data.activeFolderPath;
    if (switched) {
      this.captureScroll();
      this.data.activeFolderPath = target;
      this.renderPins();
    }
    const zone = getZone(this.data);
    const expanded = new Set(zone.expanded);
    const size = expanded.size;
    ancestorPaths(file.path, target).forEach((path) => expanded.add(path));
    zone.expanded = [...expanded];
    if (switched || size !== expanded.size || this.renderedZone !== zoneKey(target)) {
      this.renderPins();
      this.renderTree(!switched);
    }
    if (switched) this.plugin.views().forEach((view) => {
      if (view !== this) view.sync();
    });
    this.updateHighlight();
    const row = this.rows.get(file.path);
    if (row) this.revealRow(row);
    this.lastActive = file.path;
    this.plugin.persist();
  }
  updateHighlight() {
    var _a;
    const path = (_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path;
    this.rows.forEach((row, rowPath) => {
      row.toggleClass("is-active", rowPath === path);
    });
  }
  updateTabStops() {
    this.tree.tabIndex = this.rows.size ? -1 : 0;
    this.rows.forEach((row, path) => {
      row.tabIndex = path === this.focusedPath ? 0 : -1;
    });
  }
  revealRow(row) {
    const viewport = this.tree.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < viewport.top) this.tree.scrollTop -= viewport.top - rect.top;
    else if (rect.bottom > viewport.bottom) this.tree.scrollTop += rect.bottom - viewport.bottom;
    this.captureScroll();
  }
  focusRow(path, reveal = true) {
    this.focusedPath = path;
    this.updateTabStops();
    const row = path ? this.rows.get(path) : null;
    (row != null ? row : this.tree).focus({ preventScroll: true });
    if (row && reveal) this.revealRow(row);
  }
  updateSelection() {
    this.rows.forEach((row, path) => {
      const selected = this.selectedPaths.has(path);
      row.toggleClass("is-selected", selected);
      row.setAttribute("aria-selected", String(selected));
    });
  }
  selectOnly(path) {
    this.selectedPaths = /* @__PURE__ */ new Set([path]);
    this.selectionAnchor = path;
    this.updateSelection();
  }
  toggleSelection(path) {
    if (this.selectedPaths.has(path)) this.selectedPaths.delete(path);
    else this.selectedPaths.add(path);
    this.selectionAnchor = path;
    this.updateSelection();
  }
  selectRange(path, add = false) {
    const end = this.visible.findIndex((file) => file.path === path);
    const start = this.visible.findIndex((file) => file.path === this.selectionAnchor);
    if (start < 0 || end < 0) {
      this.selectOnly(path);
      return;
    }
    const selected = add ? new Set(this.selectedPaths) : /* @__PURE__ */ new Set();
    for (let index = Math.min(start, end); index <= Math.max(start, end); index++) selected.add(this.visible[index].path);
    this.selectedPaths = selected;
    this.updateSelection();
  }
  onTreeKey(event) {
    var _a;
    if (this.editor || event.isComposing) return;
    const index = this.visible.findIndex((file2) => file2.path === this.focusedPath);
    const file = this.visible[index];
    if (!file) return;
    let target;
    switch (event.key) {
      case "ArrowDown":
        target = this.visible[Math.min(index + 1, this.visible.length - 1)];
        break;
      case "ArrowUp":
        target = this.visible[Math.max(index - 1, 0)];
        break;
      case "Home":
        target = this.visible[0];
        break;
      case "End":
        target = this.visible[this.visible.length - 1];
        break;
      case "ArrowRight":
        if (file instanceof import_obsidian2.TFolder) {
          if (!getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, true);
          else if (((_a = this.visible[index + 1]) == null ? void 0 : _a.parent) === file) target = this.visible[index + 1];
        }
        break;
      case "ArrowLeft":
        if (file instanceof import_obsidian2.TFolder && getZone(this.data).expanded.includes(file.path)) this.toggleFolder(file.path, false);
        else if (file.parent && this.rows.has(file.parent.path)) target = file.parent;
        break;
      case "Enter":
        if (file instanceof import_obsidian2.TFile) void this.openFile(file, event.ctrlKey || event.metaKey);
        else this.toggleFolder(file.path);
        break;
      case "F2":
        this.startRename(file);
        break;
      case "ContextMenu":
        this.showKeyboardMenu(file);
        break;
      case "F10":
        if (event.shiftKey) this.showKeyboardMenu(file);
        else return;
        break;
      default:
        return;
    }
    event.preventDefault();
    if (target) {
      if (event.shiftKey) this.selectRange(target.path, event.ctrlKey || event.metaKey);
      else this.selectOnly(target.path);
      this.focusRow(target.path);
    }
  }
  showKeyboardMenu(file) {
    var _a;
    const rect = (_a = this.rows.get(file.path)) == null ? void 0 : _a.getBoundingClientRect();
    if (!this.selectedPaths.has(file.path)) this.selectOnly(file.path);
    if (rect) this.fileMenu(file).showAtPosition({ x: rect.left + 24, y: rect.bottom });
  }
  async openFile(file, newTab = false) {
    try {
      await this.app.workspace.getLeaf(newTab ? "tab" : false).openFile(file);
    } catch (error) {
      this.reportError(error);
    }
  }
  creationMenu(menu, parent) {
    return menu.addItem((item) => item.setTitle(this.t("newNote")).setIcon("square-pen").onClick(() => {
      void this.startCreate(false, parent);
    })).addItem((item) => item.setTitle(this.t("newFolder")).setIcon("folder-plus").onClick(() => {
      void this.startCreate(true, parent);
    }));
  }
  fileMenu(file) {
    const menu = new import_obsidian2.Menu();
    const selected = this.selectedPaths.size > 1 && this.selectedPaths.has(file.path);
    if (selected) {
      menu.addItem((item) => item.setTitle(this.t("deleteSelected") + ` (${this.selectedPaths.size})`).setIcon("trash-2").setWarning(true).onClick(() => {
        void this.deleteSelected();
      }));
      this.app.workspace.trigger("file-menu", menu, file, VIEW_TYPE, this.leaf);
      return menu;
    }
    if (file instanceof import_obsidian2.TFolder) {
      this.creationMenu(menu, file.path);
      const pinned = this.data.pinnedFolders.includes(file.path);
      menu.addItem((item) => item.setTitle(this.t(pinned ? "unpin" : "pin")).setIcon(pinned ? "pin-off" : "pin").onClick(() => {
        void this.plugin.setPinned(file.path, !pinned);
      }));
    } else if (file instanceof import_obsidian2.TFile) {
      menu.addItem((item) => item.setTitle(this.t("openTab")).setIcon("file-plus").onClick(() => {
        void this.openFile(file, true);
      }));
    }
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(this.t("rename")).setIcon("pencil").onClick(() => this.startRename(file)));
    menu.addItem((item) => item.setTitle(this.t("delete")).setIcon("trash-2").setWarning(true).onClick(() => {
      void this.deleteFile(file);
    }));
    this.app.workspace.trigger("file-menu", menu, file, VIEW_TYPE, this.leaf);
    return menu;
  }
  async deleteFile(file) {
    if (this.deletingPaths.has(file.path)) return;
    this.deletingPaths.add(file.path);
    try {
      if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("missing"));
      await this.app.fileManager.promptForDeletion(file);
    } catch (error) {
      this.reportError(error);
    } finally {
      this.deletingPaths.delete(file.path);
    }
  }
  async deleteSelected() {
    const paths2 = [...this.selectedPaths];
    for (const path of paths2) {
      if (paths2.some((other) => other !== path && containsPath(other, path))) continue;
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) await this.deleteFile(file);
    }
  }
  reportError(error) {
    new import_obsidian2.Notice(this.t("operationFailed") + ": " + (error instanceof Error ? error.message : String(error)));
  }
  async startCreate(folder, parentPath) {
    var _a;
    if (this.closed || ((_a = this.editor) == null ? void 0 : _a.busy)) return;
    this.cancelEditor();
    this.renderTree();
    const parent = !parentPath || parentPath === "/" ? this.app.vault.getRoot() : this.app.vault.getAbstractFileByPath(parentPath);
    if (!(parent instanceof import_obsidian2.TFolder)) {
      this.reportError(this.t("missing"));
      return;
    }
    if (!containsPath(this.data.activeFolderPath, parent.path === "/" ? "" : parent.path)) return;
    const id = ++this.creationId;
    const region = this.data.activeFolderPath;
    try {
      const created = await createUntitled(this.app.vault, parent, folder, this.t(folder ? "untitledFolder" : "untitled"));
      if (this.closed || id !== this.creationId || region !== this.data.activeFolderPath) return;
      if (this.app.vault.getAbstractFileByPath(created.path) !== created || !containsPath(region, created.path)) return;
      const zone = getZone(this.data);
      zone.expanded = [.../* @__PURE__ */ new Set([...zone.expanded, ...ancestorPaths(created.path, region)])];
      this.focusedPath = created.path;
      this.renderTree();
      const row = this.rows.get(created.path);
      if (row) this.revealRow(row);
      this.plugin.persist();
      if (created instanceof import_obsidian2.TFile) {
        const leaf = this.app.workspace.getLeaf(false);
        this.openingPath = created.path;
        try {
          await leaf.openFile(created, {
            active: true,
            state: { mode: "source" },
            eState: { rename: "all" }
          });
          if (id === this.creationId && this.app.workspace.getActiveFile() === created) {
            leaf.setEphemeralState({ rename: "all" });
          }
        } finally {
          this.openingPath = null;
        }
      } else this.startRename(created);
    } catch (error) {
      this.reportError(error);
    }
  }
  startRename(file) {
    var _a;
    if ((_a = this.editor) == null ? void 0 : _a.busy) return;
    this.creationId++;
    this.cancelEditor();
    this.renderTree();
    const row = this.rows.get(file.path);
    if (!row) return;
    const host = this.tree.createDiv("fpv-editor-row");
    host.style.setProperty("--fpv-depth", row.style.getPropertyValue("--fpv-depth"));
    row.after(host);
    row.hidden = true;
    const initial = file instanceof import_obsidian2.TFile && file.extension ? file.basename : file.name;
    this.beginEditor(host, initial, async (value) => {
      var _a2, _b;
      if (this.app.vault.getAbstractFileByPath(file.path) !== file) throw new Error(this.t("missing"));
      const path = entryPath((_b = (_a2 = file.parent) == null ? void 0 : _a2.path) != null ? _b : "", value, file instanceof import_obsidian2.TFile ? file.extension : "");
      if (path === file.path) return;
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing && existing !== file) throw new Error(this.t("exists"));
      await this.app.fileManager.renameFile(file, path);
      this.focusedPath = path;
    });
  }
  beginEditor(host, initial, action) {
    const input = host.createEl("input", {
      cls: "fpv-input",
      type: "text",
      value: initial,
      attr: { "aria-label": this.t("rename"), spellcheck: "false" }
    });
    this.tree.querySelectorAll(".fpv-empty").forEach((el) => {
      el.hidden = true;
    });
    const error = host.createDiv({ cls: "fpv-input-message", text: this.t("editHint"), attr: { role: "status", "aria-live": "polite" } });
    const editor = { el: host, input, busy: false, commit: async () => {
      if (editor.busy || this.editor !== editor) return;
      const value = input.value.trim();
      if (!validName(value)) {
        error.setText(this.t("invalidName"));
        input.setAttribute("aria-invalid", "true");
        input.focus();
        return;
      }
      editor.busy = true;
      input.disabled = true;
      try {
        await action(value);
        if (this.editor !== editor || this.closed) return;
        this.editor = null;
        host.remove();
        this.renderTree();
        const row = this.focusedPath ? this.rows.get(this.focusedPath) : null;
        if (row) this.revealRow(row);
        this.focusRow(this.focusedPath, false);
        this.plugin.persist();
      } catch (failure) {
        if (this.editor !== editor || this.closed) return;
        editor.busy = false;
        input.disabled = false;
        error.setText(this.t("operationFailed") + ": " + (failure instanceof Error ? failure.message : String(failure)));
        input.setAttribute("aria-invalid", "true");
        input.focus();
      }
    } };
    this.editor = editor;
    input.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.isComposing || composing) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void editor.commit();
      } else if (event.key === "Escape" && !editor.busy) {
        event.preventDefault();
        this.cancelEditor();
        this.renderTree();
        this.focusRow(this.focusedPath, false);
      }
    });
    let composing = false;
    input.addEventListener("compositionstart", () => {
      composing = true;
    });
    input.addEventListener("compositionend", () => {
      composing = false;
    });
    input.addEventListener("input", () => {
      input.removeAttribute("aria-invalid");
      error.setText(this.t("editHint"));
    });
    input.focus({ preventScroll: true });
    input.select();
    this.revealRow(host);
  }
  cancelEditor() {
    if (!this.editor) return;
    this.editor.el.remove();
    this.editor = null;
  }
};

// src/main.ts
var FolderPinPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.data = normalizeData(null);
    this.writeQueue = Promise.resolve();
    this.stopping = false;
    this.t = (key) => translate(this.language, key);
    this.persist = () => {
      if (this.stopping) return;
      if (this.saveTimer !== void 0) window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        this.saveTimer = void 0;
        this.flushSave();
      }, 200);
    };
  }
  get language() {
    return resolveLanguage(this.data.language, (0, import_obsidian3.getLanguage)());
  }
  async onload() {
    this.data = normalizeData(await this.loadData());
    this.registerView(VIEW_TYPE, (leaf) => new FolderPinView(leaf, this));
    this.ribbon = this.addRibbonIcon("pin", this.t("title"), () => {
      void this.activateView();
    });
    this.addCommand({ id: "open-view", name: this.t("openView"), callback: () => {
      void this.activateView();
    } });
    this.addCommand({ id: "reveal-active-file", name: this.t("reveal"), callback: () => {
      void this.activateView().then(() => this.views().forEach((view) => view.revealActive()));
    } });
    this.addSettingTab(new FolderPinSettings(this.app, this));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
      if (source === VIEW_TYPE || !(file instanceof import_obsidian3.TFolder) || file.isRoot()) return;
      const pinned = this.data.pinnedFolders.includes(file.path);
      menu.addItem((item) => item.setTitle(this.t(pinned ? "unpin" : "pin")).setIcon("pin").onClick(() => {
        void this.setPinned(file.path, !pinned);
      }));
    }));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      this.views().forEach((view) => view.captureScroll());
      removePath(this.data, file.path);
      this.persist();
      this.refreshViews();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.views().forEach((view) => view.captureScroll());
      remapData(this.data, oldPath, file.path);
      this.persist();
      this.refreshViews();
    }));
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian3.TFile && this.data.sortOrder.startsWith("mtime")) this.scheduleRefresh();
    }));
    this.registerEvent(this.app.workspace.on("file-open", () => this.views().forEach((view) => view.activeFileChanged())));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.views().forEach((view) => view.activeFileChanged())));
    this.app.workspace.onLayoutReady(() => {
      if (this.stopping) return;
      for (const path of [...this.data.pinnedFolders]) {
        if (!(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian3.TFolder)) removePath(this.data, path);
      }
      for (const zone of Object.values(this.data.zones))
        zone.expanded = zone.expanded.filter((path) => this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian3.TFolder);
      this.refreshViews();
      if (!this.views().length) void this.activateView(false);
      this.persist();
    });
  }
  views() {
    return this.app.workspace.getLeavesOfType(VIEW_TYPE).map((leaf) => leaf.view).filter((view) => view instanceof FolderPinView);
  }
  async activateView(reveal = true) {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const created = this.app.workspace.getLeftLeaf(true);
      if (!created) return;
      leaf = created;
      await leaf.setViewState({ type: VIEW_TYPE, active: reveal });
    }
    if (reveal) await this.app.workspace.revealLeaf(leaf);
  }
  async setPinned(path, pinned) {
    var _a;
    if (pinned && !(this.app.vault.getAbstractFileByPath(path) instanceof import_obsidian3.TFolder)) return;
    this.views().forEach((view) => view.captureScroll());
    const index = this.data.pinnedFolders.indexOf(path);
    if (pinned) {
      if (index === -1) this.data.pinnedFolders.push(path);
      this.data.activeFolderPath = path;
    } else {
      if (index === -1) return;
      this.data.pinnedFolders.splice(index, 1);
      delete this.data.zones[zoneKey(path)];
      if (this.data.activeFolderPath === path)
        this.data.activeFolderPath = (_a = this.data.pinnedFolders[Math.min(index, this.data.pinnedFolders.length - 1)]) != null ? _a : null;
    }
    this.persist();
    this.refreshViews();
    if (pinned) await this.activateView();
  }
  refreshViews() {
    this.views().forEach((view) => view.sync());
  }
  refreshLanguage() {
    var _a;
    (_a = this.ribbon) == null ? void 0 : _a.setAttribute("aria-label", this.t("title"));
    this.views().forEach((view) => view.localize());
    this.persist();
  }
  scheduleRefresh() {
    if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = void 0;
      if (!this.stopping) this.views().forEach((view) => view.renderTree());
    }, 100);
  }
  // Serialize snapshots so a slow previous write cannot overwrite newer settings.
  flushSave() {
    if (this.saveTimer !== void 0) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = void 0;
    }
    const snapshot = JSON.parse(JSON.stringify(this.data));
    this.writeQueue = this.writeQueue.then(() => this.saveData(snapshot)).catch((error) => {
      console.error("[folder-pin-view] Settings save failed", error);
      new import_obsidian3.Notice(this.t("saveFailed"));
    });
  }
  onunload() {
    this.stopping = true;
    if (this.refreshTimer !== void 0) window.clearTimeout(this.refreshTimer);
    this.views().forEach((view) => view.captureScroll());
    this.flushSave();
  }
};
var FolderPinSettings = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  // Obsidian 1.13+ indexes these definitions for settings search.
  getSettingDefinitions() {
    return [
      {
        name: this.plugin.t("language"),
        desc: this.plugin.t("languageDesc"),
        control: { type: "dropdown", key: "language", options: {
          auto: this.plugin.t("followApp"),
          zh: "\u7B80\u4F53\u4E2D\u6587",
          en: "English"
        } }
      },
      {
        name: this.plugin.t("autoReveal"),
        desc: this.plugin.t("autoRevealDesc"),
        control: { type: "toggle", key: "autoReveal" }
      }
    ];
  }
  getControlValue(key) {
    if (key === "language") return this.plugin.data.language;
    if (key === "autoReveal") return this.plugin.data.autoReveal;
    return void 0;
  }
  setControlValue(key, value) {
    if (key === "language") {
      this.plugin.data.language = value === "zh" || value === "en" ? value : "auto";
      this.plugin.refreshLanguage();
      this.update();
    } else if (key === "autoReveal") {
      this.plugin.data.autoReveal = value === true;
      this.plugin.persist();
      this.plugin.views().forEach((view) => {
        view.updateToolbar();
        if (this.plugin.data.autoReveal) view.revealActive();
      });
    }
  }
  // Obsidian < 1.13 still calls display().
  display() {
    const { containerEl, plugin } = this;
    containerEl.empty();
    new import_obsidian3.Setting(containerEl).setName(plugin.t("language")).setDesc(plugin.t("languageDesc")).addDropdown((dropdown) => dropdown.addOptions({ auto: plugin.t("followApp"), zh: "\u7B80\u4F53\u4E2D\u6587", en: "English" }).setValue(plugin.data.language).onChange((value) => {
      plugin.data.language = value === "zh" || value === "en" ? value : "auto";
      plugin.refreshLanguage();
      this.display();
    }));
    new import_obsidian3.Setting(containerEl).setName(plugin.t("autoReveal")).setDesc(plugin.t("autoRevealDesc")).addToggle((toggle) => toggle.setValue(plugin.data.autoReveal).onChange((value) => {
      plugin.data.autoReveal = value;
      plugin.persist();
      plugin.views().forEach((view) => {
        view.updateToolbar();
        if (value) view.revealActive();
      });
    }));
  }
};
