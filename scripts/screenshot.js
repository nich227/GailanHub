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

// Puts widgets on a desktop and photographs them, so every preview in the hub is
// framed the same way.
//
//   npm run screenshot clock                       one widget, filling the frame
//   npm run screenshot -- --widgets=clock,system    several, where each sits
//   npm run screenshot clock -- --theme=dark
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
// 1.3MB as a png and 130KB as a jpeg, so it is written as a jpeg at a size that
// still holds up when someone opens it.
const OUTPUT_WIDTH = 1920;
const QUALITY = 86;

const args = process.argv.slice(2);

function usage(message) {
  console.error(message);
  console.error('\nusage: npm run screenshot <widget> [-- options]');
  console.error('  --widgets=a,b,c       several widgets on one desktop');
  console.error('  --fill / --no-fill    scale a lone widget up to fill the frame');
  console.error('  --position=right|left|center   overrides the widget\'s own');
  console.error('  --theme=light|dark    which appearance to render');
  console.error('  --output=<text>       stand in for the command output');
  console.error('  --outputs=<json>      per widget, as {"system": "ram 45"}');
  console.error('  --arrange=right|own   down the right, or where each says');
  console.error('  --zoom=<n>            scale the widgets in the frame');
  console.error('  --settings=<json>     settings to render with');
  console.error('  --wallpaper=<path>    an image of your own');
  console.error('  --assets=<dir>        more files the widgets load');
  console.error('  --dir=<path>          a widget folder somewhere else');
  console.error('  --out=<path>          where to write it');
  process.exit(1);
}

function option(key, fallback) {
  const found = args.find((a) => a.startsWith(`--${key}=`));
  return found ? found.slice(key.length + 3) : fallback;
}

function flag(key) {
  if (args.includes(`--no-${key}`)) return false;
  if (args.includes(`--${key}`)) return true;
  return null;
}

// MARK: - which widgets, and where they live

const supplied = option('dir', null);
const named = option('widgets', null);
const positional = args.find((a) => !a.startsWith('-'));

if (!named && !positional && !supplied) usage('which widget?');

const widgets = (named ? named.split(',') : [positional])
  .filter(Boolean)
  .map((name) => {
    const dir = supplied ? path.resolve(supplied) : path.join(root, 'widgets', name);
    if (!fs.existsSync(dir)) usage(`there is nothing at ${dir}`);

    const manifestPath = path.join(dir, 'widget.json');
    if (!fs.existsSync(manifestPath)) usage(`there is no widget.json in ${dir}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // a manifest need not name its entry: a widget in a folder is usually an index
    const candidates = manifest.entry
      ? [manifest.entry]
      : ['index.tsx', 'index.jsx', 'index.ts', 'index.js'];
    const entry = candidates
      .map((file) => path.join(dir, file))
      .find((file) => fs.existsSync(file));
    if (!entry) usage(`none of ${candidates.join(', ')} is in ${dir}`);

    return {
      id: manifest.name || path.basename(dir),
      dir,
      entry,
      manifest,
    };
  });

const single = widgets.length === 1;
// one widget on its own is a portrait of that widget, so it fills the frame unless
// told otherwise. several are a desktop, and sit where their authors put them.
const fill = flag('fill') === null ? single : flag('fill');

const out = path.resolve(
  option(
    'out',
    single
      ? path.join(widgets[0].dir, 'preview.jpg')
      : path.join(process.cwd(), 'desktop.jpg')
  )
);

const position = option('position', '');
const theme = option('theme', 'light');
// several widgets are a desktop, and a desktop reads better tidy: down the right,
// evenly spaced, and a little larger than life so they can be seen
const arrange = option('arrange', single ? 'own' : 'right');
const zoom = option('zoom', single ? '1' : '1.25');

function defaultSettings(manifest) {
  const values = {};
  (manifest.settings || []).forEach((setting) => {
    if (setting.default !== undefined) values[setting.key] = setting.default;
  });
  return values;
}

// MARK: - reading what a widget exports, so its command can be run

function hostStubs() {
  return {
    name: 'host-stubs',
    setup(build) {
      build.onResolve({filter: /^(gailan|uebersicht|react)$/}, (args) => ({
        path: args.path,
        namespace: 'stub',
      }));
      // enough of the module for the top of a widget file to run: it builds styled
      // components, which never render here
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
  };
}

// Gailan runs a widget's command and hands it the output, so a screenshot taken
// without doing the same shows an empty widget.
function readExports(widget, dir) {
  const file = path.join(dir, `${widget.id}.node.cjs`);

  return esbuild
    .build({
      entryPoints: [widget.entry],
      outfile: file,
      bundle: true,
      format: 'cjs',
      platform: 'node',
      jsx: 'transform',
      jsxFactory: 'html',
      plugins: [hostStubs()],
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
      timeout: 15000,
    });
  } catch (err) {
    // a widget that reads something this machine does not have is not a failure
    console.warn(`${command.split(' ')[0]} said nothing useful, so --outputs helps`);
    return '';
  }
}

// MARK: - building for the browser

function buildWidget(widget, dir) {
  const registry = 'globalThis.__gailanWidgets';

  return esbuild.build({
    entryPoints: [widget.entry],
    outfile: path.join(dir, `${widget.id}.js`),
    bundle: true,
    format: 'iife',
    globalName: '__gailanWidget',
    footer: {
      js:
        `${registry}=${registry}||{};` +
        `${registry}[${JSON.stringify(widget.id)}]=` +
        '__gailanWidget&&__gailanWidget.default!==undefined&&' +
        'Object.keys(__gailanWidget).length===1' +
        '?__gailanWidget.default:__gailanWidget;',
    },
    jsx: 'transform',
    jsxFactory: 'html',
    target: ['safari16.6'],
    platform: 'browser',
    plugins: [browserHostModules()],
    logLevel: 'warning',
  });
}

// gailan and uebersicht are provided by the page, as they are in the app
function browserHostModules() {
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
      execFileSync('curl', [
        '-fsSL',
        '--max-time',
        '120',
        '-o',
        cached,
        WALLPAPER_URL,
      ]);
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
    res.writeHead(200, {
      'content-type': types[path.extname(file)] || 'text/plain',
    });
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

function report(measured) {
  const [width, height] = measured.desktop;
  (measured.fonts || []).forEach((font) => console.log(`  font: ${font}`));
  (measured.images || []).forEach((image) => console.log(`  image: ${image}`));
  (measured.states || []).forEach((state) => console.log(`  state: ${state}`));
  (measured.animations || []).forEach((animation) =>
    console.log(`  moving: ${animation}`)
  );
  measured.widgets.forEach((widget) => {
    const across = ((widget.width / width) * 100).toFixed(0);
    const down = ((widget.height / height) * 100).toFixed(0);
    console.log(
      `  ${widget.width}x${widget.height} at ${widget.x},${widget.y}` +
        ` (${across}% across, ${down}% down)` +
        (widget.lines ? ` ${widget.lines} drawn lines` : '') +
        (widget.text ? ` "${widget.text}"` : '')
    );
  });
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
      // fonts, the wallpaper, the first render, and any scaling after it
      await new Promise((r) => setTimeout(r, 4500));

      // what actually landed on the desktop, so a run can be checked without
      // opening the file
      const measured = await win.webContents.executeJavaScript(\`
        JSON.stringify({
          desktop: [
            document.getElementById('desktop').clientWidth,
            document.getElementById('desktop').clientHeight,
          ],
          // a widget may ship a typeface, and a fallback looks fine until you
          // compare it to the real thing
          fonts: [...document.fonts].map((f) => f.family + ' ' + f.status),
          // anything a widget marks with a state, and the color it ended up: a
          // lamp meant to change with what it reports is worth checking
          states: [...document.querySelectorAll('.slot [data-state]')].map(
            (el) =>
              el.dataset.state + ' ' + getComputedStyle(el).backgroundColor
          ),
          // an image that did not arrive leaves a gap the capture will happily keep
          images: [...document.querySelectorAll('.slot img')].map(
            (img) =>
              (img.naturalWidth ? 'loaded' : 'MISSING') +
              ' ' +
              img.src.split('/').pop().slice(0, 44)
          ),
          // anything set to move, so a widget that should beat can be seen to
          animations: [...document.querySelectorAll('.slot *')]
            .map((el) => getComputedStyle(el))
            .filter((style) => style.animationName !== 'none')
            .map((style) => style.animationName + ' ' + style.animationDuration),
          widgets: [...document.querySelectorAll('.slot')].map((slot) => {
            // the slot takes the widget's size, so it is the honest thing to
            // measure: a widget may render a <style> first, which has none
            let box = slot.getBoundingClientRect();

            // Unless the widget draws itself out of flow, which the starter widget
            // does: it covers the desktop and puts a window somewhere inside. Measuring
            // the slot then reports either nothing at all or the whole screen, and
            // neither says where the thing you can see ended up, so what it painted is
            // measured instead.
            const covers =
              box.width >= ${WIDTH} - 1 && box.height >= ${HEIGHT} - 1;
            if (!box.width || !box.height || covers) {
              let union = null;
              slot.querySelectorAll('*').forEach((node) => {
                const inner = node.getBoundingClientRect();
                if (!inner.width || !inner.height) return;
                union = union
                  ? {
                      left: Math.min(union.left, inner.left),
                      top: Math.min(union.top, inner.top),
                      right: Math.max(union.right, inner.right),
                      bottom: Math.max(union.bottom, inner.bottom),
                    }
                  : {left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom};
              });
              if (union) {
                box = {
                  x: union.left,
                  y: union.top,
                  width: union.right - union.left,
                  height: union.bottom - union.top,
                };
              }
            }
            return {
              // innerText, so a font-face rule is not mistaken for the readout
              text: (slot.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 48),
              lines: slot.querySelectorAll('svg line').length,
              x: Math.round(box.x), y: Math.round(box.y),
              width: Math.round(box.width), height: Math.round(box.height),
            };
          }),
        })
      \`);
      console.log('GEOMETRY ' + measured);

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
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      // A widget that works out the time itself reads the machine's timezone, so a
      // pinned reading would show a different hour on every contributor's screen.
      // Captures run in UTC, which is the one place everybody agrees on.
      env: {...process.env, TZ: 'UTC'},
    }
  );

  let noise = '';
  run.stderr.on('data', (chunk) => (noise += chunk));
  run.stdout.on('data', (chunk) => {
    String(chunk)
      .split('\n')
      .filter((line) => line.startsWith('GEOMETRY '))
      .forEach((line) => report(JSON.parse(line.slice(9))));
  });

  run.on('error', (err) => done(err.message));
  run.on('exit', (code) => {
    if (code === 0 && fs.existsSync(out)) return done(null);
    done(noise.trim() || `electron exited with ${code}`);
  });
}

// MARK: - go

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'gailan-shot-'));
fs.copyFileSync(path.join(template, 'desktop.html'), path.join(work, 'index.html'));

// a widget may sit beside files it loads, images among them
function stage(from) {
  fs.readdirSync(from).forEach((file) => {
    const source = path.join(from, file);
    if (fs.statSync(source).isFile() && !/\.(tsx?|jsx?)$/.test(file)) {
      fs.copyFileSync(source, path.join(work, file));
    }
  });
}

widgets.forEach((widget) => stage(widget.dir));

// and it may load files kept alongside the whole widgets folder rather than its own,
// which --assets brings along
const assets = option('assets', null);
if (assets) {
  if (!fs.existsSync(assets)) usage(`there is nothing at ${assets}`);
  stage(path.resolve(assets));
}

buildHost(work);
const framed = wallpaper(work);

let overrides = {};
try {
  overrides = JSON.parse(option('outputs', '{}'));
} catch (err) {
  usage('--outputs is not readable json');
}

Promise.all(
  widgets.map((widget) =>
    readExports(widget, work).then((exports) => {
      // asked for beats pinned, pinned beats running the command: a flag given on
      // the command line is the whole point of giving it
      const asked = args.some((a) => a.startsWith('--output='))
        ? option('output', '')
        : undefined;
      const pinned = widget.manifest.screenshotOutput;
      const output =
        overrides[widget.id] !== undefined
          ? overrides[widget.id]
          : asked !== undefined
            ? asked
            : pinned !== undefined
              ? pinned
              : runCommand(exports.command);

      return buildWidget(widget, work).then(() => ({
        id: widget.id,
        output,
        // the author says where their widget sits, unless asked for somewhere else
        placement: position ? '' : exports.className || '',
        settings: option('settings', null)
          ? JSON.parse(option('settings'))
          : defaultSettings(widget.manifest),
      }));
    })
  )
)
  .then(start)
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });

function start(mounted) {
  serve(work, (server, port) => {
    const query =
      `?widgets=${encodeURIComponent(JSON.stringify(mounted))}` +
      `&position=${encodeURIComponent(position)}` +
      `&fill=${fill ? '1' : '0'}` +
      `&arrange=${encodeURIComponent(arrange === 'own' ? '' : arrange)}` +
      `&zoom=${encodeURIComponent(zoom)}` +
      (framed ? '' : '&wallpaper=');

    const url = `http://127.0.0.1:${port}/index.html${query}`;
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
