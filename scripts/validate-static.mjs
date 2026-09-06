import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import assert from 'node:assert/strict';
const root = resolve('dist/client');
const checked = new Set();
async function check(url, base) {
  if (!url || /^(data:|https?:|#|mailto:)/i.test(url)) return;
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  let file = clean.startsWith('/')
    ? resolve(root, '.' + clean)
    : resolve(base, clean);
  assert.ok(
    file === root ||
      file.startsWith(root + '\\') ||
      file.startsWith(root + '/'),
    'Asset escaped static root',
  );
  if (file === root) file = join(root, 'index.html');
  if (checked.has(file)) return;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    if (!/\.[a-z0-9]+$/i.test(file)) file += '.html';
  }
  await stat(file);
  checked.add(file);
}
for (const name of ['index.html', 'brand-kit.html']) {
  const html = await readFile(join(root, name), 'utf8');
  assert.ok(html.includes('Holidays Mode'), 'Brand missing from ' + name);
  for (const match of html.matchAll(/(?:src|href)="([^"<>]+)"/g))
    await check(match[1], root);
}
for (const entry of await readdir(root, {recursive:true,withFileTypes:true})) {
  if (!entry.isFile() || !entry.name.endsWith('.css')) continue;
  const file = join(entry.parentPath, entry.name),
    css = await readFile(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^\s)'";]+)['"]?\s*\)/g))
    await check(match[1], dirname(file));
  assert.ok(!css.includes('url(./files/'), 'Unresolved font path');
}
console.log(
  `Static export verified: 2 pages and ${checked.size} local references; no missing fonts, images, styles or scripts.`,
);
