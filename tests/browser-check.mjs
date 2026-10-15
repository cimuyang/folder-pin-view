// Optional browser QA. Install Playwright or set FPV_PLAYWRIGHT_MODULE to its package directory.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const output = path.resolve('artifacts/browser');
await mkdir(output, { recursive: true });
await build({ entryPoints: ['tests/preview.ts'], outfile: path.join(output, 'preview.js'), bundle: true,
    platform: 'browser', format: 'iife', alias: { obsidian: path.resolve('tests/obsidian.ts') } });
const css = await readFile('styles.css', 'utf8');
await writeFile(path.join(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<style>
:root { --background-primary:#fff; --text-normal:#24272d; --text-muted:#636975; --text-faint:#858b96;
--background-modifier-hover:#eceef1; --background-modifier-border:#e2e5e9; --interactive-accent:#7462c7;
--text-error:#ce4141; --icon-color:#68707c; --font-ui-small:13px; --font-ui-smaller:12px;
--font-ui-medium:14px; --font-ui-smaller:12px; --radius-s:4px; --icon-m:18px; }
:root.dark { --background-primary:#202126; --text-normal:#dedee4; --text-muted:#a5a7b2; --text-faint:#787d8b;
--background-modifier-hover:#30323b; --background-modifier-border:#383a44; --icon-color:#a5a7b2; --interactive-accent:#aa96ef; }
* { box-sizing:border-box; } body { margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Microsoft YaHei', sans-serif;
background:var(--background-primary); color:var(--text-normal); } button,input { font:inherit; }
.workspace-leaf-content { width:100vw; height:100vh; background:var(--background-primary); }
.mock-note-editor,.mock-note-title { display:none; } ${css}</style><body><script src="preview.js"></script></body></html>`);
const { chromium } = await import(process.env.FPV_PLAYWRIGHT_MODULE
    ? pathToFileURL(path.join(process.env.FPV_PLAYWRIGHT_MODULE, 'index.mjs')).href : 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.FPV_BROWSER_EXECUTABLE ? { executablePath: process.env.FPV_BROWSER_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 320, height: 720 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error('Preview error:', error.message); });
const checks = [];
async function load(width = 320, height = 720, language = 'zh') {
    await page.setViewportSize({ width, height });
    await page.goto(pathToFileURL(path.join(output, 'index.html')).href + '?lang=' + language);
    await page.waitForFunction(() => window.preview?.view.contentEl.querySelector('.fpv-pin'), undefined, { timeout:5000 });
    await page.evaluate(() => window.scrollTo(0,0));
}
const pin = path => page.locator(`.fpv-pin[data-path="${path}"]`);
const row = path => page.locator(`.fpv-row[data-path="${path}"]`);
async function geometry() {
    return page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right }; };
        return { nav:rect('.fpv-navigation'), parent:rect('.fpv-bar'), child:rect('.fpv-subfolder-bar'), tree:rect('.fpv-tree'), toolbar:rect('.fpv-toolbar'),
            overflow:document.documentElement.scrollWidth > innerWidth,
            tools:[...document.querySelectorAll('.fpv-tool')].map(el => el.getBoundingClientRect().right) };
    });
}
try {
    for (const [width, height, theme] of [[320,720,'light'],[240,620,'dark'],[175,320,'light']]) {
        await load(width, height);
        if (theme === 'dark') await page.evaluate(() => document.documentElement.classList.add('dark'));
        const g = await geometry();
        assert.ok(g.parent.x < g.child.x && Math.abs(g.parent.y - g.child.y) < 1);
        assert.ok(g.tree.y > g.nav.y && g.tree.h > height * .3 && g.tree.b <= height + 1);
        assert.ok(!g.overflow && g.tools.length === 6 && g.tools.every(right => right <= width + 1));
        assert.ok(g.parent.h > 20 && g.child.h > 20);
        await page.screenshot({ path:path.join(output, `vertical-${theme}-${width}.png`) });
        checks.push(`vertical ${width}x${height} ${theme}: geometry, six tools, no overflow`);
    }
    await load();
    const separator = page.locator('.fpv-separator');
    const box = await separator.boundingBox();
    await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width/2, box.y + box.height/2 + 72, { steps:8 }); await page.mouse.up();
    const height = await page.evaluate(() => window.preview.plugin.data.navigationHeight);
    assert.ok(Math.abs(height - 46) < .5); checks.push('actual pointer resize: 36% to 46%');
    await separator.focus(); await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => window.preview.plugin.data.navigationHeight), 20);
    await page.keyboard.press('End'); assert.equal(await page.evaluate(() => window.preview.plugin.data.navigationHeight), 60);
    await separator.dblclick(); assert.equal(await page.evaluate(() => window.preview.plugin.data.navigationHeight), 36);
    checks.push('separator keyboard bounds and double-click reset');
    // Verify actual wheel scroll is native vertical scrolling, without lateral interception.
    const bar = page.locator('.fpv-column').first().locator('.fpv-bar');
    await bar.hover(); await page.mouse.wheel(0, 220);
    await page.waitForFunction(() => document.querySelector('.fpv-bar').scrollTop > 0);
    assert.equal(await page.locator('.fpv-subfolder-bar').evaluate(el => el.scrollTop), 0);
    checks.push('independent parent-column wheel scrolling');

    await load();
    // The browser creates the HTML5 drag; no synthetic drop is used for this check.
    await page.evaluate(() => {
        window.dragTrace = [];
        for (const type of ['dragstart','dragover','drop','dragend','blur']) document.addEventListener(type, event =>
            window.dragTrace.push({ type, path:event.target.closest?.('[data-path]')?.dataset.path, x:event.clientX,y:event.clientY }), true);
    });
    const source = row('教学工作/本周教学计划.md');
    await source.scrollIntoViewIfNeeded();
    await source.evaluate(el => window.dragSource = el);
    const s = await source.boundingBox(), p = await pin('阅读写作').boundingBox();
    await page.mouse.move(s.x+60,s.y+s.height/2); await page.mouse.down();
    await page.mouse.move(s.x+68,s.y+s.height/2,{steps:4});
    await page.mouse.move(p.x+45,p.y+p.height/2,{steps:16});
    await page.mouse.move(p.x+46,p.y+p.height/2);
    await page.waitForFunction(() => document.querySelector('.fpv-subfolder[data-path="阅读写作/读书笔记"]'), undefined, { timeout:4000 });
    assert.equal(await page.evaluate(() => window.dragSource.isConnected && window.preview.plugin.data.activeFolderPath === '教学工作'), true);
    const target = await pin('阅读写作/读书笔记').boundingBox();
    await page.mouse.move(target.x+45,target.y+target.height/2,{steps:10}); await page.mouse.up();
    await page.waitForFunction(() => window.preview.files.has('阅读写作/读书笔记/本周教学计划.md'));
    assert.equal(await page.evaluate(() => window.preview.plugin.data.activeSubfolderPath), '阅读写作/读书笔记');
    checks.push('actual HTML5 drag: hover another parent, retain source, move into its child and reveal result');

    await load();
    const scrollSource = row('教学工作/本周教学计划.md'); await scrollSource.scrollIntoViewIfNeeded();
    const scrollStart = await scrollSource.boundingBox(), scrollBar = await page.locator('.fpv-bar').first().boundingBox();
    await page.mouse.move(scrollStart.x+60,scrollStart.y+scrollStart.height/2); await page.mouse.down();
    await page.mouse.move(scrollStart.x+68,scrollStart.y+scrollStart.height/2,{steps:4});
    await page.mouse.move(scrollBar.x+35,scrollBar.y+scrollBar.height-4,{steps:16});
    await page.mouse.move(scrollBar.x+36,scrollBar.y+scrollBar.height-4);
    await page.waitForFunction(() => document.querySelector('.fpv-bar').scrollTop > 60, undefined, { timeout:4000 });
    await page.keyboard.press('Escape'); await page.mouse.up();
    assert.equal(await page.evaluate(() => window.preview.app.fileManager.renamed.length),0);
    await page.waitForFunction(() => window.preview.app.dragManager.draggable === null);
    assert.equal(await page.locator('.fpv-drop-target').count(),0);
    checks.push('actual HTML5 drag auto-scrolls the folder column; Escape cancels without moving notes');

    await load(); await page.evaluate(() => window.preview.plugin.setLayout('horizontal'));
    const horizontal = await geometry(); assert.ok(horizontal.child.y > horizontal.parent.y && horizontal.tree.y > horizontal.child.y);
    assert.ok(horizontal.toolbar.y >= 0 && horizontal.toolbar.h > 0);
    assert.equal(await separator.isVisible(), false);
    await page.screenshot({ path:path.join(output,'horizontal-light-320.png') });
    checks.push('horizontal layout retained');
    await load(320,720,'en');
    assert.equal(await page.locator('.fpv-heading').count(),0);
    assert.equal(await page.locator('.fpv-subfolder-bar').getAttribute('aria-orientation'),'vertical');
    assert.equal(await separator.getAttribute('aria-label'),'Resize folder area'); checks.push('English localization');
    const touchContext = await browser.newContext({ viewport:{ width:375,height:740 }, isMobile:true, hasTouch:true, deviceScaleFactor:1 });
    const touchPage = await touchContext.newPage();
    await touchPage.goto(pathToFileURL(path.join(output,'index.html')).href);
    await touchPage.waitForFunction(() => window.preview?.view.contentEl.querySelector('.fpv-pin'));
    assert.ok(await touchPage.locator('.fpv-pin').first().evaluate(el => el.getBoundingClientRect().height >= 36));
    assert.ok(await touchPage.locator('.fpv-separator').evaluate(el => el.getBoundingClientRect().height >= 16));
    await touchContext.close(); checks.push('touch viewport keeps larger folder targets and resize handle');
    assert.deepEqual(errors, []);
    await writeFile(path.join(output,'result.json'),JSON.stringify({ checks, errors },null,2));
    console.log(JSON.stringify({ checks, errors },null,2));
} catch (error) {
    console.error(JSON.stringify({ checks, errors, trace:await page.evaluate(() => window.dragTrace) },null,2));
    await page.screenshot({ path:path.join(output,'failure.png') });
    throw error;
} finally { await browser.close(); }
