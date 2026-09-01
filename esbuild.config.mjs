import esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    external: ['obsidian'],
    format: 'cjs',
    target: 'es2018',
    logLevel: 'info',
    sourcemap: 'inline',
    outfile: 'main.js',
});

if (isWatch) {
    await ctx.watch();
} else {
    await ctx.rebuild();
    await ctx.dispose();
}
