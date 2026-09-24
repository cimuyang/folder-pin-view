import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
await mkdir('.test-build', { recursive: true });
await build({ entryPoints: ['tests/regression.ts'], outfile: '.test-build/regression.cjs', bundle: true,
    platform: 'node', format: 'cjs', external: ['jsdom'], alias: { obsidian: path.resolve('tests/obsidian.ts') } });
const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', '.test-build/regression.cjs'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
