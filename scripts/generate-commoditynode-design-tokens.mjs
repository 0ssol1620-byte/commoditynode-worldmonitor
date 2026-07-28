import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'shared/commoditynode-design-tokens.json');
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

function kebab(value) {
  return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
}

function variables(prefix, record) {
  return Object.entries(record)
    .map(([key, value]) => `  --${prefix}-${kebab(key)}: ${value};`)
    .join('\n');
}

const dark = source.color.dark;
const light = source.color.light;
const output = `/*
 * Generated from shared/commoditynode-design-tokens.json.
 * Run: npm run commoditynode:tokens
 */
:root {
  --cn-font-ui: ${source.typography.ui};
  --cn-font-data: ${source.typography.data};
${variables('cn-font-weight', source.typography.weights)}
${variables('cn-space', source.space)}
${variables('cn-radius', source.radius)}
${variables('cn-motion', source.motion)}
${variables('cn-z', source.zIndex)}
${variables('cn-color', dark)}
}

:root[data-theme='light'],
:root[data-cn-theme='light'] {
${variables('cn-color', light)}
}
`;

for (const target of [
  'src/styles/commoditynode-tokens.generated.css',
  'blog-site/src/styles/commoditynode-tokens.generated.css',
]) {
  writeFileSync(resolve(root, target), output, 'utf8');
  console.log(`[commoditynode] wrote ${target}`);
}
