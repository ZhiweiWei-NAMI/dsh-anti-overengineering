// Test-only resolver for a built DSH checkout; never changes its files or dependencies.
// PowerShell: $env:DSH_TEST_RUNTIME='E:\dsh-bot-workspace\dsh-source-analysis'
// node --import ./validation/usage-host-runtime.mjs --test ./validation/usage-host.test.mjs
import { globSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.env.DSH_TEST_RUNTIME;
if (!root) throw new Error('Set DSH_TEST_RUNTIME to a built DSH checkout with node_modules.');
const packages = new Map();
for (const file of globSync(['packages/*/*/package.json', 'vendor/*/package.json'], { cwd: root })) {
  const path = resolve(root, file);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  packages.set(manifest.name, pathToFileURL(path).href);
}
registerHooks({
  resolve(specifier, context, nextResolve) {
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    const parentURL = packages.get(name);
    if (parentURL) return nextResolve(specifier, { ...context, parentURL });
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (error.code !== 'ERR_MODULE_NOT_FOUND' || specifier.startsWith('.') || specifier.includes(':')) throw error;
      return nextResolve(specifier, { ...context, parentURL: pathToFileURL(resolve(root, 'package.json')).href });
    }
  },
});
