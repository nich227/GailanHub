# Screenshot template

Every preview in the hub is the same picture: a Mac desktop, menu bar above, dock
below, and the widget where its author put it. A widget on a blank background says
nothing about where it lives, and previews that each look different make the gallery
hard to read.

## Taking one

```
npm install
npm run screenshot <widget>
```

That writes `widgets/<widget>/preview.jpg` at 1920x1200, around 130KB. The validator
refuses anything over 500KB, which a jpeg of this frame comfortably clears.

What it does, in order: builds your widget twice, once for Node so it can read your
`command` and run it, and once for the browser; fetches the wallpaper into
`.screenshot-cache/`, which git ignores; serves the template; and captures it with
Electron at 2x.

Your widget renders with real output, because the command really runs. If your
`command` is a function rather than a string it cannot be run this way, so pass
`--output` instead.

Better still, pin it. A `screenshotOutput` in your `widget.json` is what the preview
renders with, so regenerating it cannot change the picture behind your back, and a widget
whose reading depends on the machine still looks right on someone else's:

```json
{ "screenshotOutput": "09:41|00|Thu 27 Aug|239" }
```

The clock uses 09:41 because that is the time on the menu bar in the frame, and on
every screenshot Apple has ever published. Its pinned value is a unix timestamp, and
captures run with `TZ=UTC` so a widget that works out the time itself shows the same hour
on everyone's machine.

## Options

```
npm run screenshot clock -- --position=center --theme=dark
```

| Option | What it does |
|---|---|
| `--position=right\|left\|center` | Overrides the placement in your `className` |
| `--theme=light\|dark` | Which appearance to render, since widgets answer `prefers-color-scheme` |
| `--output=<text>` | Stands in for the command output |
| `--settings=<json>` | Renders with particular settings |
| `--arrange=right\|own` | Down the right evenly, or where each widget says |
| `--zoom=<n>` | Scale the widgets in the frame |
| `--wallpaper=<path>` | An image of your own |
| `--out=<path>` | Somewhere else to write it |

One widget sits where your `className` says and is scaled up to fill the frame. Several
are arranged down the right, evenly spaced and slightly enlarged, since that reads as a
desktop rather than a pile.

## Without Electron

Electron is not a dependency here, because it is 170MB and most people taking a
screenshot are already on a Mac. Without it the script serves the page and tells you
the address. Open it, and capture the 1280x800 frame at the top left at 2x.
Cmd-Shift-4 with the pointer snapped to the window does this.

## What is in the frame

The menu bar and the dock are drawn, not Apple's artwork: the dock holds colored
shapes rather than app icons. The wallpaper is fetched when you run the script and is
never committed, since it is not ours to redistribute. Point `--wallpaper` at
something else and nothing about the frame changes.
