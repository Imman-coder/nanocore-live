import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('Tailwind is configured through PostCSS for the Vite build', () => {
  const config = read('tailwind.config.js');
  const postcss = read('postcss.config.js');
  const pkg = JSON.parse(read('package.json'));
  assert.match(config, /content:.*\.\/index\.html/s);
  assert.match(config, /src\/\*\*\/\*\.\{svelte,js\}/);
  assert.match(config, /accent: '#ffb454'/);
  assert.match(postcss, /tailwindcss: \{\}/);
  assert.match(postcss, /autoprefixer: \{\}/);
  assert.ok(pkg.devDependencies.tailwindcss);
  assert.ok(pkg.devDependencies.postcss);
  assert.ok(pkg.devDependencies.autoprefixer);
  assert.ok(!pkg.dependencies?.['@tailwindcss/vite']);
  assert.doesNotMatch(read('vite.config.js'), /@tailwindcss\/vite/);
});

test('the Tailwind entry stylesheet contains only the three directives', () => {
  const css = read('src/app.css').trim();
  assert.equal(css, '@tailwind base;\n@tailwind components;\n@tailwind utilities;');
  for (const file of readdirSync(new URL('src/lib/components', root))) {
    if (!file.endsWith('.svelte')) continue;
    const source = read(`src/lib/components/${file}`);
    assert.doesNotMatch(source, /<style[\s>]/, `${file} has no component stylesheet`);
  }
});
