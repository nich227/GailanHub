# GailanHub

Widgets for [Gailan](https://github.com/nich227/Gailan), kept in one repository.

Every widget lives in `widgets/`, is reviewed by pull request, and is checked by
CI before it lands. There is no registry, no account, and nothing to publish: a
widget is a folder with a manifest, and adding one means opening a pull request.

## Installing a widget

Copy its folder into your widget directory:

    ~/Library/Application Support/Gailan/widgets/

Or clone the whole repository somewhere and symlink the ones you want:

```sh
git clone https://github.com/nich227/GailanHub.git
ln -s "$PWD/GailanHub/widgets/clock" \
      ~/Library/Application\ Support/Gailan/widgets/clock
```

Gailan watches the folder, so a widget appears as soon as it is copied in. Open
**Open Widgets Folder** from the menu bar icon if you are not sure where yours is.

## What is in a widget

```
widgets/clock/
  widget.json      the manifest CI reads, and any settings the widget offers
  index.tsx        the widget itself
  README.md        what it does, and anything it needs
  preview.png      a screenshot, 2x, cropped to the widget
```

The folder name is the widget's id, so `widgets/clock/index.tsx` appears in Gailan
as `clock`. Gailan writes a `settings.json` beside the widget for whatever the user
chooses, which is why it is in `.gitignore`.

`widget.json` looks like this:

```json
{
  "name": "clock",
  "title": "Clock",
  "description": "The time, the date, and the day of the year.",
  "author": "Kevin Chen",
  "license": "MIT",
  "version": "1.0.0",
  "entry": "index.tsx",
  "tags": ["time"],
  "minimumGailanVersion": "1.0.0"
}
```

`scripts/validate.js` is the same check CI runs, so you can run it before opening
a pull request:

```sh
npm install
npm run validate
```

It reads every manifest, confirms the files it names exist, and compiles each
widget with esbuild, which is what Gailan itself uses. A widget that does not
compile does not land.

## Adding your own

1. Fork this repository.
2. Copy `widgets/clock` to `widgets/<your-widget>` and make it yours.
3. Run `npm run validate`.
4. Open a pull request.

[CONTRIBUTING.md](CONTRIBUTING.md) has the details, including what review looks
at and why a widget might be sent back.

Widgets keep whatever license their author chooses, declared in the manifest. The
repository itself is GPL-3.0, matching Gailan.
