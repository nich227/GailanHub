# Clock

The time, the date, and how far through the year you are.

Two faces, chosen in the widget's settings:

- **Digital** shows the numerals on a dot matrix, which is where the industrial look
  comes from: a readout built out of lit cells rather than drawn strokes. Seconds sit
  beside the time in red.
- **Analog** shows hands on a dial with sixty marks and no numerals, the quarters
  longer than the rest. The hour hand moves through the hour rather than jumping at the
  top of it, and the second hand is the one red thing on it.

Both tick every second, because both show seconds.

The dot matrix numerals are [DotGothic16](https://github.com/fontworks-fonts/DotGothic16)
under the SIL Open Font License, which is in `dotmatrix-OFL.txt`. Only the ten digits and
the colon are included, 2KB against the 2MB of the full face, and they are carried inside
`index.tsx` rather than sitting beside it: Gailan serves a widget's files under its folder
name, so a path would break the moment you renamed the folder.
