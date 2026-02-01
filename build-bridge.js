// build-bridge.js
// Bundles all bridge and overlays files into bridge/bridge-bundle.js
// Adds a comment header to each file for error tracing

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// Use a single entry point for bundling
const entryPoint = 'bridge/entry.js';

// Plugin to inject a comment header with the source file name
const headerPlugin = {
  name: 'header-plugin',
  setup(build) {
    build.onLoad({ filter: /\.js$/ }, async (args) => {
      const source = await fs.promises.readFile(args.path, 'utf8');
      const relPath = path.relative(process.cwd(), args.path).replace(/\\/g, '/');
      const header = `// [SOURCE: ${relPath}]\n`;
      return { contents: header + source, loader: 'js' };
    });
  }
};

esbuild.build({
  entryPoints: [entryPoint],
  bundle: true,
  outfile: 'bridge/bridge-bundle.js',
  format: 'iife',
  globalName: 'window',
  sourcemap: true,
  plugins: [headerPlugin],
  logLevel: 'info',
}).catch(() => process.exit(1));
