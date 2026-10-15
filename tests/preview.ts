// Browser-only preview of the real view against the same vault double as regression tests.
import FolderPinPlugin from '../src/main';
import { createApp, installDom, Menu, setLanguage } from './obsidian';

async function start() {
    installDom(window);
    setLanguage(new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'zh');
    const env = createApp();
    for (const path of ['教学工作/课程准备', '教学工作/课堂记录', '教学工作/家校沟通', '阅读写作/读书笔记', '阅读写作/写作素材', '个人项目']) env.add(path, true);
    for (const path of ['教学工作/本周教学计划.md', '教学工作/课程准备/第一课教学设计.md', '教学工作/课堂记录/课堂观察.md',
        '教学工作/家校沟通/沟通记录.md', '阅读写作/阅读清单.md', '阅读写作/读书笔记/阅读摘录.md']) env.add(path);
    for (let i = 1; i <= 14; i++) env.add(`归档项目 ${i}`, true);
    for (let i = 1; i <= 10; i++) env.add(`教学工作/专题资料 ${i}`, true);
    for (let i = 1; i <= 16; i++) env.add(`教学工作/备课笔记 ${i}.md`);
    const plugin = new FolderPinPlugin(env.app as any, {} as any);
    (plugin as any).saved = { layout: 'vertical', pinnedFolders: ['教学工作', '阅读写作', '个人项目', ...Array.from({ length: 14 }, (_, i) => `归档项目 ${i + 1}`)],
        activeFolderPath: '教学工作', zones: { '@教学工作': { expanded: ['教学工作/课程准备'], scrollTop: 0 } } };
    await plugin.onload(); await plugin.activateView();
    (window as any).preview = { ...env, plugin, view: plugin.views()[0], Menu };
}
void start();
