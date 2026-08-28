#!/usr/bin/env node
//
//  screenshot.js
//  GailanHub
//
//  Copyright (c) 2026 Kevin Chen.
//
//  Released under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version. See <http://www.gnu.org/licenses/> for
//  details.
//
'use strict';

// Puts a widget on a desktop and photographs it, so every preview in the hub is
// framed the same way.
//
//   npm run screenshot clock
//   npm run screenshot clock -- --position=left --wallpaper=/path/to/your.jpg
//
// With electron available the capture is automatic. Without it, the page is served
// and you are told where to look, which is enough on a Mac where the screenshot
// keys are right there.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const {execFileSync, spawn, spawnSync} = require('child_process');

const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const template = path.join(root, 'template', 'screenshot');
const cache = path.join(root, '.screenshot-cache');

// The desktop this frames is a Mac, so the wallpaper should look like one. It is
// fetched into a cache that git ignores rather than committed: it is not ours to
// redistribute. Point --wallpaper at anything you would rather use.
const WALLPAPER_URL =
  'https://cdn.osxdaily.com/wp-content/uploads/2026/07/' +
  'macos-27-golden-gate-wallpaper-light-2.jpeg';

const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;
// A desktop is mostly wallpaper, and a wallpaper is a photograph. The same frame is
// 1.3MB as a png and 126KB as a jpeg, so it is written as a jpeg at a size that
// still holds up when someone opens it.
const OUTPUT_WIDTH = 1920;
const QUALITY = 86;

function usage(message) {
  console.error(message);
  console.error('\nusage: npm run screenshot <widget> [-- options]');
  console.error('  --position=right|left|centre   overrides the widget\'s own');
  console.error('  --theme=light|dark             which appearance to render');
  console.error('  --output=<text>                stand in for the command output');
  console.error('  --wallpaper=<path>             an image of your own');
  console.error('  --settings=<json>              settings to render with');
  console.error('  --out=<path>                   where to write the png');
  process.exit(1);
}

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith('-'));
if (!name) usage('which widget?');

function option(key, fallback) {
  const found = args.find((a) => a.startsWith(`--${key}=`));
  return found ? found.slice(key.length + 3) : fallback;
}

const widgetDir = path.join(root, 'widgets', name);
if (!fs.existsSync(widgetDir)) usage(`there is no widgets/${name}`);

const manifest = JSON.parse(
  fs.readFileSync(path.join(widgetDir, 'widget.json'), 'utf8')
);
const entry = path.join(widgetDir, manifest.entry);
if (!fs.existsSync(entry)) usage(`${manifest.entry} is not in widgets/${name}`);

const out = path.resolve(option('out', path.join(widgetDir, 'preview.jpg')));
const position = option('position', 'right');
const settings = option('settings', JSON.stringify(defaultSettings(manifest)));

function defaultSettings(m) {
  const values = {};
  (m.settings || []).forEach((setting) => {
    if (setting.default !== undefined) values[setting.key] = setting.default;
  });
  return values;
}

// MARK: - the pieces the page needs

// async because a plugin is involved, and esbuild will not take one otherwise
function buildWidget(dir) {
  const registry = 'globalThis.__gailanWidgets';

  return esbuild.build({
    entryPoints: [entry],
    outfile: path.join(dir, 'widget.js'),
    bundle: true,
    format: 'iife',
    globalName: '__gailanWidget',
    footer: {
      js:
        `${registry}=${registry}||{};` +
        `${registry}[${JSON.stringify(manifest.name)}]=` +
        '__gailanWidget&&__gailanWidget.default!==undefined&&' +
        'Object.keys(__gailanWidget).length===1' +
        '?__gailanWidget.default:__gailanWidget;',
    },
    jsx: 'transform',
    jsxFactory: 'html',
    target: ['safari16.6'],
    platform: 'browser',
    // the widget asks the page for these rather than bundling its own copies,
    // which is also how Gailan runs it
    external: ['gailan', 'uebersicht', 'react'],
    plugins: [hostModules()],
    logLevel: 'warning',
  });
}

// gailan and uebersicht are provided by the page, as they are in the app
function hostModules() {
  return {
    name: 'host-modules',
    setup(build) {
      build.onResolve({filter: /^(gailan|uebersicht|react)$/}, (args) => ({
        path: args.path,
        namespace: 'host',
      }));
      build.onLoad({filter: /.*/, namespace: 'host'}, (args) => ({
        contents: `module.exports = globalThis.require(${JSON.stringify(
          args.path
        )});`,
        loader: 'js',
      }));
    },
  };
}

// Gailan runs a widget's command and hands it the output, so a screenshot taken
// without doing the same shows an empty widget. The widget is built a second time
// for node, purely to read what it exports.
function readExports(dir) {
  const file = path.join(dir, 'widget.node.cjs');

  return esbuild
    .build({
      entryPoints: [entry],
      outfile: file,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      jsx: 'transform',
      jsxFactory: 'html',
      plugins: [
        {
          name: 'host-stubs',
          setup(build) {
            build.onResolve({filter: /^(gailan|uebersicht|react)$/}, (args) => ({
              path: args.path,
              namespace: 'stub',
            }));
            // enough of the module for the top of a widget file to run: it builds
            // styled components, which never render here
            build.onLoad({filter: /.*/, namespace: 'stub'}, () => ({
              contents: `
                const component = () => null;
                const tag = () => component;
                module.exports = {
                  styled: new Proxy(tag, {get: () => tag}),
                  css: () => '',
                  React: {createElement: () => null},
                  createElement: () => null,
                  run: async () => '',
                  default: {createElement: () => null},
                };
              `,
              loader: 'js',
            }));
          },
        },
      ],
      logLevel: 'silent',
    })
    .then(() => {
      globalThis.html = () => null;
      // eslint-disable-next-line
      return require(file);
    })
    .catch(() => ({}));
}

function runCommand(command) {
  if (typeof command !== 'string' || !command.trim()) return '';

  try {
    return execFileSync(process.env.SHELL || '/bin/sh', ['-c', command], {
      encoding: 'utf8',
      timeout: 10000,
    });
  } catch (err) {
    console.warn(`the widget's command failed, so it renders with nothing: ${err.message}`);
    return '';
  }
}

function buildHost(dir) {
  const source = `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import styled from '@emotion/styled';
    import {css} from '@emotion/css';

    window.React = React;
    window.html = React.createElement;
    globalThis.require = (name) => {
      if (name === 'gailan' || name === 'uebersicht') {
        return {styled, css, React, run: () => Promise.resolve('')};
      }
      if (name === 'react') return React;
      throw new Error('the page does not provide ' + name);
    };
    window.__mount = (element, node) => createRoot(node).render(element);
  `;

  // written inside the repo so react and emotion resolve from node_modules
  const temp = path.join(root, '.screenshot-host.js');
  fs.writeFileSync(temp, source);
  try {
    esbuild.buildSync({
      entryPoints: [temp],
      outfile: path.join(dir, 'host.bundle.js'),
      bundle: true,
      format: 'iife',
      define: {'process.env.NODE_ENV': '"production"'},
      logLevel: 'warning',
    });
  } finally {
    fs.unlinkSync(temp);
  }
}

function wallpaper(dir) {
  const supplied = option('wallpaper', null);
  if (supplied) {
    fs.copyFileSync(supplied, path.join(dir, 'wallpaper.jpg'));
    return true;
  }

  fs.mkdirSync(cache, {recursive: true});
  const cached = path.join(cache, 'wallpaper.jpg');

  if (!fs.existsSync(cached)) {
    console.log('fetching the wallpaper, once');
    try {
      execFileSync('curl', ['-fsSL', '--max-time', '120', '-o', cached, WALLPAPER_URL]);
    } catch (err) {
      console.warn('could not fetch it, so the gradient stands in');
      return false;
    }
  }

  fs.copyFileSync(cached, path.join(dir, 'wallpaper.jpg'));
  return true;
}

// MARK: - serving and capturing

function serve(dir, callback) {
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
  };

  const server = http.createServer((req, res) => {
    const file = path.join(dir, decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(dir) || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end('not here');
    }
    res.writeHead(200, {'content-type': types[path.extname(file)] || 'text/plain'});
    fs.createReadStream(file).pipe(res);
  });

  server.listen(0, '127.0.0.1', () => callback(server, server.address().port));
}

function electron() {
  const local = path.join(root, 'node_modules', '.bin', 'electron');
  if (fs.existsSync(local)) return local;

  const which = spawnSync('which', ['electron'], {encoding: 'utf8'});
  return which.status === 0 ? which.stdout.trim() : null;
}

function capture(binary, url, done) {
  const script = path.join(cache, 'capture.js');
  fs.writeFileSync(
    script,
    `
    const {app, BrowserWindow, nativeTheme} = require('electron');
    const fs = require('fs');
    app.commandLine.appendSwitch('no-sandbox');
    app.disableHardwareAcceleration();

    app.whenReady().then(async () => {
      // widgets answer prefers-color-scheme, so the screenshot has to pick one
      nativeTheme.themeSource = ${JSON.stringify(theme)};
      const win = new BrowserWindow({
        width: ${WIDTH}, height: ${HEIGHT}, show: false, useContentSize: true,
      });
      await win.loadURL(${JSON.stringify(url)});
      // fonts, the wallpaper and any first render
      await new Promise((r) => setTimeout(r, 4000));
      const shot = await win.webContents.capturePage({
        x: 0, y: 0, width: ${WIDTH}, height: ${HEIGHT},
      });
      const image = shot.resize({width: ${OUTPUT_WIDTH}, quality: 'best'});
      const png = ${JSON.stringify(out)}.endsWith('.png');
      fs.writeFileSync(
        ${JSON.stringify(out)},
        png ? image.toPNG() : image.toJPEG(${QUALITY})
      );
      app.quit();
    });
    `
  );

  // not spawnSync: the page it is loading is served by this process, and a blocked
  // event loop cannot answer the request, which is a wait with no end to it
  const run = spawn(
    binary,
    ['--no-sandbox', `--force-device-scale-factor=${SCALE}`, script],
    {stdio: ['ignore', 'pipe', 'pipe']}
  );

  let noise = '';
  run.stderr.on('data', (chunk) => (noise += chunk));

  run.on('error', (err) => done(err.message));
  run.on('exit', (code) => {
    if (code === 0 && fs.existsSync(out)) return done(null);
    done(noise.trim() || `electron exited with ${code}`);
  });
}

// MARK: - go

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gailan-shot-'));
fs.copyFileSync(
  path.join(template, 'desktop.html'),
  path.join(work, 'index.html')
);

// a widget may sit beside files it loads, images among them
fs.readdirSync(widgetDir).forEach((file) => {
  const from = path.join(widgetDir, file);
  if (fs.statSync(from).isFile() && !/\.(tsx?|jsx?)$/.test(file)) {
    fs.copyFileSync(from, path.join(work, file));
  }
});

buildHost(work);
const framed = wallpaper(work);

const theme = option('theme', 'light');

function pageURL(port, output, placement) {
  return (
    `http://127.0.0.1:${port}/index.html` +
    `?id=${encodeURIComponent(manifest.name)}` +
    `&position=${encodeURIComponent(position)}` +
    `&settings=${encodeURIComponent(settings)}` +
    `&output=${encodeURIComponent(output || '')}` +
    `&placement=${encodeURIComponent(placement || '')}` +
    (framed ? '' : '&wallpaper=')
  );
}

readExports(work)
  .then((exports) => {
    const output = option('output', runCommand(exports.command));
    // the author says where their widget sits, unless asked for somewhere else
    const placement = args.some((a) => a.startsWith('--position='))
      ? ''
      : exports.className || '';
    return buildWidget(work).then(() => start(output, placement));
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });

function start(output, placement) {
  serve(work, (server, port) => {
  const url = pageURL(port, output, placement);
  const binary = electron();

  if (!binary) {
    console.log('\nelectron is not here, so nothing was captured for you.');
    console.log(`the desktop is at ${url}`);
    console.log(
      `capture the ${WIDTH}x${HEIGHT} frame at the top left, at 2x, and save it as`
    );
    console.log(`  ${out}`);
    console.log('\npress ctrl-c when you have it.');
    return;
  }

  capture(binary, url, (err) => {
    server.close();
    fs.rmSync(work, {recursive: true, force: true});

    if (err) {
      console.error('the capture did not work:', err);
      process.exit(1);
    }

    const {size} = fs.statSync(out);
    console.log(
      `${path.relative(process.cwd(), out)}: ${OUTPUT_WIDTH}x${Math.round(
        (OUTPUT_WIDTH * HEIGHT) / WIDTH
      )}, ${(size / 1024).toFixed(0)}KB`
    );
  });
  });
}
