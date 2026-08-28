# Clock

The time, the date, and how far through the year you are.

Two faces, chosen in the widget's settings:

The digital face sets the numerals on a dot matrix, which is where the industrial look
comes from: a readout built out of lit cells rather than drawn strokes. Seconds sit beside
the time in red.

The analog face has hands on a dial with sixty marks and no numerals, the quarters longer
than the rest. The hour hand moves through the hour rather than jumping at the top of it,
and the second hand is the one red thing on it.

Both tick every second, because both show seconds.

The dot matrix numerals are [DotGothic16](https://github.com/fontworks-fonts/DotGothic16)
under the SIL Open Font License, which is in `dotmatrix-OFL.txt`. Only the ten digits and
the colon are included, 2KB against the 2MB of the full face, and they are carried inside
`index.tsx` rather than sitting beside it: Gailan serves a widget's files under its folder
name, so a path would break the moment you renamed the folder.

## Settings

Face picks the dot matrix or the dial.

Hours picks a twelve hour clock with am and pm, or a twenty-four hour one. It defaults to
twelve. The dial ignores it, having no use for am and pm.

Both readings come from one timestamp: the widget asks the machine for `date +%s` and works
out the rest, so switching formats is a matter of what it shows rather than what it runs,
and it knows a leap year has 366 days.

Drag to move lets you hold the panel and put it where you like. It needs interaction
turned on in Gailan's preferences, since a widget cannot be dragged if clicks never reach
it, and where you leave it is remembered.
