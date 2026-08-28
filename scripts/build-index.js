#!/usr/bin/env node
//
//  build-index.js
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

// Collects every manifest into one file, so the website can list widgets without
// walking the repository.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const widgetsDir = path.join(root, 'widgets');

// Everything a widget is made of, so anything installing one can fetch it file by
// file. GitHub serves whole repositories as archives but never a single folder, and
// walking the tree over the API costs a request and counts against a rate limit.
// A user's own settings.json is not part of the widget.
// a screenshot of a desktop is a photograph, so most widgets ship a jpeg, but a
// widget that would rather ship a png is not made to change
function previewFor(name) {
  const candidates = ['preview.jpg', 'preview.jpeg', 'preview.png'];
  const found = candidates.find((file) =>
    fs.existsSync(path.join(widgetsDir, name, file))
  );
  return found || 'preview.png';
}

function filesIn(dir, prefix = '') {
  return fs
    .readdirSync(dir, {withFileTypes: true})
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const name = prefix + entry.name;
      if (entry.isDirectory()) {
        return filesIn(path.join(dir, entry.name), `${name}/`);
      }
      if (name === 'settings.json') return [];
      return [{path: name, bytes: fs.statSync(path.join(dir, entry.name)).size}];
    });
}

const widgets = fs
  .readdirSync(widgetsDir, {withFileTypes: true})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()
  .map((name) => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(widgetsDir, name, 'widget.json'), 'utf8')
    );
    return {
      name: manifest.name,
      title: manifest.title,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      version: manifest.version,
      tags: manifest.tags || [],
      homepage: manifest.homepage || null,
      path: `widgets/${name}`,
      screenshot: `widgets/${name}/${manifest.screenshot || previewFor(name)}`,
      entry: manifest.entry,
      files: filesIn(path.join(widgetsDir, name)),
    };
  });

// No timestamp: the file has to be reproducible or CI can never tell whether it
// is stale. Git already records when it changed.
const index = {count: widgets.length, widgets};
fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`index.json written with ${widgets.length} widget(s)`);
