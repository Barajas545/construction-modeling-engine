import { cp, mkdir, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/server', { recursive: true });
await mkdir('dist/client/src', { recursive: true });
await cp('index.html', 'dist/client/index.html');
await cp('src', 'dist/client/src', { recursive: true });
await cp('public/og-dimensions-layer.png', 'dist/client/og-dimensions-layer.png');
await cp('package.json', 'dist/client/package.json');
await writeFile('dist/server/index.js', `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
`);
