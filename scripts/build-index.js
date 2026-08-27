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
      screenshot: `widgets/${name}/${manifest.screenshot || 'preview.png'}`,
    };
  });

// No timestamp: the file has to be reproducible or CI can never tell whether it
// is stale. Git already records when it changed.
const index = {count: widgets.length, widgets};
fs.writeFileSync(path.join(root, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`index.json written with ${widgets.length} widget(s)`);
