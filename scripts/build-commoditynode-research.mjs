import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const blogRoot = resolve(root, 'blog-site');
const source = resolve(blogRoot, 'dist');
const target = resolve(root, 'public', 'commoditynode-site');

execFileSync('npm', ['run', 'build'], {
  cwd: blogRoot,
  env: {
    ...process.env,
    PUBLIC_SITE_VARIANT: 'commoditynode',
  },
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (!existsSync(source)) {
  throw new Error('CommodityNode research build did not produce blog-site/dist.');
}

rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log('[commoditynode] copied research site to public/commoditynode-site');
