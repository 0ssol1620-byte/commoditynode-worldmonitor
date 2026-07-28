import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const blogRoot = resolve(root, 'blog-site');
const source = resolve(blogRoot, 'dist');
const target = resolve(root, 'public', 'commoditynode-site');
const STATIC_SCRIPT_NONCE = 'wm-static-bootstrap';

function htmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.isFile() && entry.name.endsWith('.html') ? [path] : [];
  });
}

function applyStaticScriptNonce(directory) {
  let updatedFiles = 0;
  for (const path of htmlFiles(directory)) {
    const sourceHtml = readFileSync(path, 'utf8');
    const securedHtml = sourceHtml.replace(
      /<script\b(?![^>]*\bnonce=)([^>]*)>/gi,
      `<script nonce="${STATIC_SCRIPT_NONCE}"$1>`,
    );
    if (securedHtml === sourceHtml) continue;
    writeFileSync(path, securedHtml);
    updatedFiles += 1;
  }
  return updatedFiles;
}

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
const securedPageCount = applyStaticScriptNonce(target);
console.log(
  `[commoditynode] copied research site to public/commoditynode-site `
  + `and applied the CSP nonce to ${securedPageCount} HTML files`,
);
