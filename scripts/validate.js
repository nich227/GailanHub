#!/usr/bin/env node
//
//  validate.js
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

// Checks every widget the way CI does: the manifest says what it should, the
// files it names are there, and the widget compiles with the bundler Gailan
// itself uses. Run it before opening a pull request.

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const root = path.join(__dirname, '..');
const widgetsDir = path.join(root, 'widgets');

const REQUIRED = [
  'name',
  'title',
  'description',
  'author',
  'license',
  'version',
  'entry',
];

const ENTRY_EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js'];
const MAX_SCREENSHOT_BYTES = 500 * 1024;

const problems = [];

function fail(widget, message) {
  problems.push(`${widget}: ${message}`);
}

function readManifest(dir, widget) {
  const file = path.join(dir, 'widget.json');
  if (!fs.existsSync(file)) {
    fail(widget, 'has no widget.json');
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    fail(widget, `widget.json is not valid JSON: ${err.message}`);
    return null;
  }
}

function checkManifest(manifest, widget) {
  REQUIRED.forEach((field) => {
    if (!manifest[field]) fail(widget, `widget.json is missing "${field}"`);
  });

  if (manifest.name && manifest.name !== widget) {
    fail(widget, `widget.json name is "${manifest.name}"; use the folder name`);
  }

  if (manifest.name && !/^[a-z0-9-]+$/.test(manifest.name)) {
    fail(widget, 'name may only contain lowercase letters, digits and hyphens');
  }

  if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    fail(widget, `version "${manifest.version}" is not x.y.z`);
  }

  if (manifest.tags && !Array.isArray(manifest.tags)) {
    fail(widget, 'tags must be an array');
  }

  if (Array.isArray(manifest.tags)) {
    manifest.tags.forEach((tag) => {
      if (typeof tag !== 'string' || !/^[a-z0-9-]+$/.test(tag)) {
        fail(widget, `tag "${tag}" should be lowercase words`);
      }
    });
  }
}

function checkFiles(dir, manifest, widget) {
  if (!manifest.entry) return null;

  const entry = path.join(dir, manifest.entry);
  if (!fs.existsSync(entry)) {
    fail(widget, `entry "${manifest.entry}" is not in the folder`);
    return null;
  }

  if (!ENTRY_EXTENSIONS.includes(path.extname(manifest.entry))) {
    fail(
      widget,
      `entry must be one of ${ENTRY_EXTENSIONS.join(', ')}, not ` +
        path.extname(manifest.entry)
    );
    return null;
  }

  if (!fs.existsSync(path.join(dir, 'README.md'))) {
    fail(widget, 'has no README.md saying what it does');
  }

  // a screenshot of a desktop is a photograph, so preview.jpg is the usual answer,
  // and a widget that would rather ship a png is not made to change
  const named = manifest.screenshot
    ? [manifest.screenshot]
    : ['preview.jpg', 'preview.jpeg', 'preview.png'];
  const screenshot = named
    .map((file) => path.join(dir, file))
    .find((file) => fs.existsSync(file));

  if (!screenshot) {
    fail(widget, `has no screenshot at ${named.join(' or ')}`);
  } else if (fs.statSync(screenshot).size > MAX_SCREENSHOT_BYTES) {
    fail(widget, 'screenshot is over 500KB');
  }

  return entry;
}

// Widgets ask for gailan at runtime; the app provides it, so it is external here
const hostModule = {
  name: 'host',
  setup(build) {
    build.onResolve({filter: /^(gailan|uebersicht)$/}, (args) => ({
      path: args.path,
      namespace: 'host',
    }));
    build.onLoad({filter: /.*/, namespace: 'host'}, () => ({
      contents: 'module.exports = {}',
      loader: 'js',
    }));
  },
};

async function checkCompiles(entry, widget) {
  try {
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'iife',
      // the oldest webkit Gailan runs on
      target: ['safari16.6'],
      platform: 'browser',
      jsx: 'transform',
      jsxFactory: 'html',
      logLevel: 'silent',
      plugins: [hostModule],
    });
  } catch (err) {
    const first = (err.errors && err.errors[0]) || {};
    const where = first.location
      ? ` at ${path.basename(entry)}:${first.location.line}`
      : '';
    fail(widget, `does not compile${where}: ${first.text || err.message}`);
  }
}

async function main() {
  if (!fs.existsSync(widgetsDir)) {
    console.error('there is no widgets/ directory');
    process.exit(1);
  }

  const widgets = fs
    .readdirSync(widgetsDir, {withFileTypes: true})
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (widgets.length === 0) {
    console.error('widgets/ is empty');
    process.exit(1);
  }

  for (const widget of widgets) {
    const dir = path.join(widgetsDir, widget);
    const manifest = readManifest(dir, widget);
    if (!manifest) continue;

    checkManifest(manifest, widget);
    const entry = checkFiles(dir, manifest, widget);
    if (entry) await checkCompiles(entry, widget);
  }

  if (problems.length > 0) {
    console.error(`${problems.length} problem(s):\n`);
    problems.forEach((problem) => console.error(`  ${problem}`));
    console.error('');
    process.exit(1);
  }

  console.log(`${widgets.length} widget(s) checked, all good`);
}

main();
