const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  target: 'node14',
  sourcemap: true,
  minify: process.argv.includes('--production'),
}).catch(() => process.exit(1));
