# Contributing a widget

Pull requests are the only way in, and every one is reviewed by @nich227 before
merging. CI has to pass first, so run `npm run validate` yourself and save a round
trip.

## The manifest

`widget.json`, one per widget folder. Required:

| field | what it is |
|---|---|
| `name` | must match the folder name: lowercase, digits and hyphens |
| `title` | what a person calls it |
| `description` | one sentence, no trailing period needed |
| `author` | your name, or a handle |
| `license` | an SPDX identifier such as `MIT` or `GPL-3.0` |
| `version` | `x.y.z` |
| `entry` | the widget file, `.tsx` `.jsx` `.ts` or `.js` |

Optional: `tags` (an array of lowercase words), `homepage`, `minimumGailanVersion`,
`screenshot` (otherwise `preview.jpg`, `preview.jpeg` or `preview.png`, whichever is there).

## Settings a widget offers

A widget can declare settings, which Gailan turns into controls in its Widgets
window and hands to `render` as `props.settings`:

```json
{
  "settings": [
    {
      "key": "size",
      "type": "choice",
      "label": "Size",
      "default": "medium",
      "options": ["small", "medium", "large"]
    },
    {"key": "showSeconds", "type": "toggle", "label": "Show seconds", "default": true}
  ]
}
```

`choice`, `toggle`, `number` (with `min`, `max`, `step`), `text` and `color`. Give
every setting a `default`, since that is what the control shows before anyone has
touched it. What the user picks is saved as `settings.json` in the widget's folder,
so add that file to your `.gitignore` rather than committing your own choices.

## What review looks at

- **It compiles.** CI runs esbuild over the entry file, the same bundler Gailan
  uses. Types are stripped, not checked, so a type error will not fail the build,
  but a syntax error will.
- **It says what it runs.** A widget that shells out should say so in its README,
  including anything it expects to be installed. `brew install`-and-hope is fine
  as long as it is written down.
- **It fetches from where it says.** Network calls belong in the README too, with
  the endpoint. A widget that quietly phones somewhere will be sent back.
- **No secrets.** No API keys, tokens, or personal paths in the source. Read them
  from the environment or a file the user creates, and document that.
- **It behaves on a desktop.** No fixed pixel sizes that assume your display, no
  `position: fixed` covering the screen, no polling every 100ms. `refreshFrequency`
  should be the longest interval that still makes the widget useful.
- **It is yours to give.** Only submit code you wrote or can relicense.

## Writing the widget

Gailan widgets are TypeScript or JavaScript modules exporting a few known names.
The [Gailan README](https://github.com/nich227/Gailan#writing-widgets) is the
reference; the short version:

```tsx
import { styled } from "gailan";

export const command = "date +%H:%M";
export const refreshFrequency = 10000;

const Time = styled("div")`
  font-variant-numeric: tabular-nums;
`;

export const className = `
  left: 20px;
  top: 20px;
`;

export const render = ({ output }: { output: string }) => (
  <Time>{output.trim()}</Time>
);
```

Types are stripped when the widget is bundled, so annotate as much or as little
as you like.

## Getting it merged

- One widget per pull request. A pull request touching two widgets will be asked
  to split.
- Editing someone else's widget is welcome, but say why in the description, and
  expect the original author to be asked.
- Bump `version` in every pull request that changes a widget's files. Gailan
  compares the installed version against this index to decide what to offer as an
  update, so a change that ships without a bump never reaches anyone.
- Take the screenshot with `npm run screenshot <widget>`, which frames your widget on
  a Mac desktop the way every other preview is framed. It writes `preview.jpg` into
  your widget's folder. See [the template](template/screenshot/README.md) for the
  options, including where the widget sits and which appearance to render. A
  screenshot pasted into the pull request description is not a substitute: the gallery
  reads the file.
  Crop to the widget, take it at 2x, and keep it under 500KB.

If CI fails and the message is not clear, say so in the pull request rather than
guessing. A confusing failure is a problem with the check, not with you.
