import { build } from 'esbuild';
await build({
  entryPoints: ['src/index.js'], bundle: true, minify: true, format: 'iife', target: ['es2020'],
  outfile: 'www/game.js', legalComments: 'eof', logLevel: 'info',
});
