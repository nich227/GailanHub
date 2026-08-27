# Clock

The time to the minute, the date, and the day of the year.

## What it runs

    date '+%H:%M|%a %d %b|%j'

`date` is part of macOS, so there is nothing to install. Nothing is fetched over
the network.

## Settings

Move it by editing `className` in `index.tsx`. `refreshFrequency` is ten seconds,
which is enough for a clock that only shows minutes; lower it and you are asking
your Mac to redraw for nothing.

## Licence

MIT, © 2026 Kevin Chen.
