// The root package.json declares "type": "module", which would make the
// compiled main process parse as ESM and crash on require(). A nested
// manifest scopes the CommonJS override to dist-electron/ only.
import { mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('dist-electron', { recursive: true });
writeFileSync('dist-electron/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
console.log('wrote dist-electron/package.json (type: commonjs)');
