# System Monitor

One reading from the machine, as a number and as a twenty-division scale. Which reading
is a setting: memory, processor, disk or network. The last three divisions turn red.

## What each reading is

**RAM Usage** comes from `memory_pressure`, which reports how much is free. That is the
number worth trusting: macOS fills memory on purpose, so "used" out of `vm_stat` looks
alarming on a machine that is perfectly happy. Compressed and wired pages are counted.

**CPU Usage** comes from `top`, taken twice a second apart. The first figure `top` gives
is an average since the machine started and says nothing about now, so the second one is
the one read. Idle is the field taken, since user and system do not account for the rest
of it.

**Disk Usage** is the data volume, `/System/Volumes/Data`, and not `/`. On current macOS
the root is a sealed read-only snapshot: it reports a quarter full on a disk that is five
sixths full. Systems without that layout fall back to the root.

**Network Usage** is bytes in and out per second, counted once per interface with the
loopback left out, since a machine talking to itself is not traffic. `netstat` reports
totals since the machine started rather than a rate, so the rate is worked out from the
gap between two readings. Nothing shows for the first few seconds, because one total on
its own says nothing.

## The scale, when the reading is a rate

A share of memory or disk is out of a hundred and the scale is obvious. A rate has no
full mark, so the bar fills against the busiest moment it has seen, easing down over a
few minutes so one burst does not flatten the scale for the rest of the session, and
never dropping below 256 KB/s so a quiet line does not read as a busy one. Whatever the
bar is currently full of is printed under its right end.

## Settings

- **Reading**: RAM, CPU, disk or network
- **Drag to move**: hold and drag to place it. Needs interaction turned on in Gailan.

Changing the reading takes effect on the next refresh, within five seconds. Until then
the panel shows nothing rather than putting the old number under the new name.
