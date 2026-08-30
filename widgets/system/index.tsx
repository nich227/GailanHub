/*
 * System Monitor
 *
 * Memory, processor, disk or network, as a number and as a bar. Same language as the
 * clock: monochrome with one red, monospace at every size, hairlines instead of
 * shadows.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

import { constrainDrag, run, styled } from "gailan";

type Source = "ram" | "cpu" | "disk" | "network";

const READINGS: Record<
  Source,
  { label: string; command: string; portion: boolean }
> = {
  /* memory_pressure reports how much is free, which is the number worth trusting:
     macOS fills memory on purpose, so "used" from vm_stat reads alarmingly high for a
     machine that is perfectly happy. Compressed and wired pages come along for the
     ride. */
  ram: {
    label: "RAM usage",
    command:
      "memory_pressure | awk '/System-wide memory free percentage/ " +
      "{ gsub(/%/, \"\", $5); print 100 - $5 }'",
    portion: true,
  },

  /* Two samples a second apart, because the first reading top gives is an average
     since the machine started and says nothing about now. Idle is the field to read;
     user and system do not add up to the rest of it. */
  cpu: {
    label: "CPU usage",
    command:
      "top -l 2 -n 0 -s 1 | grep 'CPU usage' | tail -1 | " +
      "awk '{ gsub(/%/, \"\", $7); print 100 - $7 }'",
    portion: true,
  },

  /* The data volume, not /. On macOS the root is a sealed read-only snapshot and
     reports a quarter full on a disk that is five sixths full, which is the number
     nobody wants. Older systems without that layout fall back to the root. */
  disk: {
    label: "disk usage",
    command:
      "(df -k /System/Volumes/Data 2>/dev/null || df -k /) | tail -1 | " +
      "awk '{ gsub(/%/, \"\", $5); print $5 }'",
    portion: true,
  },

  /* Bytes in and out since the machine started, counted once per interface and with
     the loopback left out, since talking to itself is not traffic. A total is not a
     rate, so the rate is worked out here from the gap between two of them. */
  network: {
    label: "network usage",
    command:
      "netstat -ibn | awk 'NR > 1 && $1 !~ /^lo/ && !seen[$1]++ && " +
      "$7 ~ /^[0-9]+$/ { rx += $7; tx += $10 } END { print rx + tx }'",
    portion: false,
  },
};

/* Which reading was asked for. The command runs on a timer and is handed no settings,
   so render leaves the choice here for the next run to pick up. Every reading carries
   the name of what it measured, so a number is never shown under the wrong label
   while the change is still on its way. */
let wanted: Source = "ram";

/* The counters only mean something next to the ones before them. */
let previousTotal: { bytes: number; at: number } | null = null;

/* A rate has no full mark, so the bar needs something to be full of. The busiest
   moment so far, easing down so one burst does not flatten the scale for good, and
   never below a floor so a quiet line does not look busy. */
const FLOOR = 256 * 1024;
let ceiling = FLOOR;

const measure = (source: Source) => {
  const reading = READINGS[source] || READINGS.ram;

  return run(reading.command).then((text: string) => {
    const value = Number(String(text).trim());
    if (!Number.isFinite(value)) return source + " -";
    if (reading.portion) return source + " " + value;

    const at = Date.now();
    const before = previousTotal;
    previousTotal = { bytes: value, at };

    /* nothing to compare the first one against */
    if (!before || at <= before.at) return source + " -";

    const seconds = (at - before.at) / 1000;
    const rate = Math.max(0, (value - before.bytes) / seconds);
    ceiling = Math.max(FLOOR, rate, ceiling * 0.98);

    return source + " " + Math.round(rate) + " " + Math.round(ceiling);
  });
};

const INTERVALS = [1, 2, 5, 10, 30, 60];

/* How often a reading is wanted, and when the last one was taken. */
let chosenInterval = 5000;
let takenAt = 0;
let lastReading = "";

/* Gailan asks how long to wait after every run, and it asks the object it holds, which
   is a copy of these exports rather than these exports themselves. Setting it here sets
   it on the thing that is actually read.

   The wait is capped well below the longest interval on offer. Waking up costs nothing;
   it is the reading that costs something, and that is only taken when it is due. Without
   the cap, going from a minute down to a second would mean waiting out the minute first. */
const LONGEST_WAIT = 5000;

export function command(this: { refreshFrequency?: number }) {
  if (this) this.refreshFrequency = Math.min(chosenInterval, LONGEST_WAIT);

  /* a little tolerance, so a run that arrives a few milliseconds early is not made to
     wait a whole interval more */
  if (Date.now() - takenAt < chosenInterval - 250) {
    return Promise.resolve(lastReading);
  }

  return take(wanted);
}

const take = (source: Source) => {
  takenAt = Date.now();
  return measure(source).then((reading) => {
    lastReading = reading;
    return reading;
  });
};

/* Where it starts, before the first run has had a chance to say otherwise. */
export const refreshFrequency = 5000;

export const className = `
  left: 24px;
  top: 24px;
`;

const BACKGROUNDS = [
  "follow",
  "light",
  "dark",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "indigo",
  "violet",
  "pink",
  "gray",
  "brown",
];

/* The style the panel should wear, and nothing at all when it should follow the system,
   so the stylesheet's own behaviour is left alone. */
/* The accent a name stands for. A widget is told which one, not which colour, so the
   names in widget.json and the colours here are the same list. Tailwind's 500s, which is
   the palette most current interfaces are built from, with the red this app has always
   used in place of theirs. */
const ACCENTS: Record<string, string> = {
  red: "#d71921",
  orange: "#ff692a",
  yellow: "#f0b13b",
  green: "#31c950",
  teal: "#36bba7",
  blue: "#2b7fff",
  indigo: "#615fff",
  violet: "#8e51ff",
  pink: "#f6339a",
  brown: "#973c08",
  neutral: "#737373",
  black: "#0b0b0c",
  white: "#f4f4f2",
};

/* Nothing at all when it should follow the system, so the stylesheet's own
   answer stands. A name that is not offered any more is treated the same way,
   rather than being passed through to a stylesheet. */
const accentOf = (chosen?: string) =>
  chosen && chosen !== "follow" ? ACCENTS[chosen] : undefined;

const surfaceOf = (chosen?: string) =>
  chosen && chosen !== "follow" && BACKGROUNDS.indexOf(chosen) > -1
    ? chosen
    : undefined;

const Panel = styled("div")`
  --surface: rgba(11, 11, 12, var(--fill, 0.82));
  --ink: #f4f4f2;
  --dim: rgba(244, 244, 242, 0.42);
  --rule: rgba(244, 244, 242, 0.16);
  /* The accent is a setting. Left alone it is the colour macOS is set to, which Gailan
     puts on the document; the red covers anywhere that has not been set. A name chosen in
     settings arrives as a property and wins over both. */
  --accent: var(--gailan-system-accent, #d71921);

  @media (prefers-color-scheme: light) {
    --ink: #0b0b0c;
    --dim: rgba(11, 11, 12, 0.45);
    --rule: rgba(11, 11, 12, 0.18);
  }


  /* Left to itself the panel follows the system. Told otherwise it stays put.
     The tinted styles are the light scheme with a wash of one hue in place of
     the near-white, and the ink is a very dark version of that same hue, so the
     two belong to each other rather than one being dropped on the other. */
  &[data-background="dark"] {
    --surface: rgba(11, 11, 12, var(--fill, 0.82));
    --ink: #f4f4f2;
    --dim: rgba(244, 244, 242, 0.42);
    --rule: rgba(244, 244, 242, 0.16);
  }

  &[data-background="light"] {
    --surface: rgba(244, 244, 242, var(--fill, 0.9));
    --ink: #0b0b0c;
    --dim: rgba(11, 11, 12, 0.45);
    --rule: rgba(11, 11, 12, 0.18);
  }

  &[data-background="red"] {
    --surface: rgba(255, 226, 226, var(--fill, 0.92));
    --ink: #460809;
  }

  &[data-background="orange"] {
    --surface: rgba(255, 237, 212, var(--fill, 0.92));
    --ink: #441306;
  }

  &[data-background="yellow"] {
    --surface: rgba(254, 249, 194, var(--fill, 0.92));
    --ink: #432004;
  }

  &[data-background="green"] {
    --surface: rgba(220, 252, 231, var(--fill, 0.92));
    --ink: #032e15;
  }

  &[data-background="teal"] {
    --surface: rgba(203, 251, 241, var(--fill, 0.92));
    --ink: #022f2e;
  }

  &[data-background="blue"] {
    --surface: rgba(219, 234, 254, var(--fill, 0.92));
    --ink: #162456;
  }

  &[data-background="indigo"] {
    --surface: rgba(224, 231, 255, var(--fill, 0.92));
    --ink: #1e1a4d;
  }

  &[data-background="violet"] {
    --surface: rgba(237, 233, 254, var(--fill, 0.92));
    --ink: #2f0d68;
  }

  &[data-background="pink"] {
    --surface: rgba(255, 214, 230, var(--fill, 0.92));
    --ink: #1f1013;
  }

  &[data-background="gray"] {
    --surface: rgba(245, 245, 245, var(--fill, 0.92));
    --ink: #0f0f10;
  }

  &[data-background="brown"] {
    --surface: rgba(240, 230, 217, var(--fill, 0.92));
    --ink: #231710;
  }

  /* Every wash takes its quieter tones from its own ink, so a hue is described
     once and the rest follows from it. */
  &[data-background="red"],
  &[data-background="orange"],
  &[data-background="yellow"],
  &[data-background="green"],
  &[data-background="teal"],
  &[data-background="blue"],
  &[data-background="indigo"],
  &[data-background="violet"],
  &[data-background="pink"],
  &[data-background="gray"],
  &[data-background="brown"] {
    --dim: color-mix(in srgb, var(--ink) 55%, transparent);
    --rule: color-mix(in srgb, var(--ink) 18%, transparent);
  }

  position: relative;
  display: inline-block;
  min-width: 208px;
  padding: 14px 16px 12px;
  background: var(--surface);
  border: 1px solid var(--rule);
  /* A squircle, as far as the web will allow. corner-shape is new enough that the
     WebKit Gailan runs on does not have it, so a generous radius carries the shape
     and the real thing is taken where it is offered. */
  border-radius: 18px;

  @supports (corner-shape: squircle) {
    corner-shape: squircle;
    border-radius: 26%;
  }
  &[data-draggable="true"] {
    cursor: grab;
  }

  &[data-draggable="true"]:active {
    cursor: grabbing;
  }
  color: var(--ink);
  font-family: "SF Mono", ui-monospace, Menlo, monospace;

  @media (prefers-color-scheme: light) {
    --surface: rgba(244, 244, 242, var(--fill, 0.9));
  }
`;

const Marks = styled("div")`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 12px;
`;

const Mark = styled("div")`
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dim);
`;

const Readout = styled("div")`
  display: flex;
  align-items: baseline;
  gap: 4px;
`;

/* The reading is set in the same dot matrix the clock tells the time in. This cut
   carries letters and a full stop as well as figures, which a rate needs and the
   clock's does not. Carried here rather than shared from the clock: a widget has to
   stand on its own. DotGothic16, under the SIL Open Font License, which is in
   dotmatrix-OFL.txt. */
const NUMERALS =
  "data:font/woff2;base64,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";

/* The at-rule goes in a style element and not in a styled component. Emotion
   serialises a component's css when the component is built, and an at-rule in there
   takes the whole widget down with it. */
const Face = () => (
  <style>{`
    @font-face {
      font-family: "Gailan Dot Matrix";
      src: url("${NUMERALS}") format("woff2");
      font-display: block;
    }
  `}</style>
);

const Percent = styled("div")`
  font-family: "Gailan Dot Matrix", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 40px;
  line-height: 0.95;
  /* a touch wider than the clock sets its time, since there are only two figures here
     and they have room to breathe */
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
`;

const Unit = styled("div")`
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--accent);
`;

/* Twenty divisions rather than a smooth fill: a scale you can read a value off,
   which is the point of a gauge. */
const Scale = styled("div")`
  display: flex;
  gap: 2px;
  margin-top: 14px;
`;

const Division = styled("div")`
  height: 8px;
  flex: 1;
  background: var(--rule);

  &[data-on="true"] {
    background: var(--ink);
  }

  /* the last few divisions are where you would rather not be */
  &[data-on="true"][data-high="true"] {
    background: var(--accent);
  }
`;

const Footer = styled("div")`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dim);
`;

const DIVISIONS = 20;

/* ---------- moving it about ---------- */

/* Gailan puts a widget where its className says. Dragging has to override that, so
   the position lives outside render, in localStorage, and is written onto the element
   Gailan positions rather than onto the panel inside it. That survives the re-render
   this widget does every second. */
const POSITION_KEY = "gailan.memory.position";

let position: { left: number; top: number } | null = null;
try {
  position = JSON.parse(localStorage.getItem(POSITION_KEY) || "null");
} catch (err) {
  /* first run, or a browser that will not remember */
}

/* the panel is inside the box Gailan positions, which is the one that has to move */
const boxOf = (el: HTMLElement) => (el.parentElement as HTMLElement) || el;

const place = (el: HTMLElement | null) => {
  if (!el || !position) return;
  const box = boxOf(el);
  box.style.left = `${position.left}px`;
  box.style.top = `${position.top}px`;
  /* whichever edge the className pinned it to, it is not pinned there now */
  box.style.right = "auto";
  box.style.bottom = "auto";
};

const startDrag = (event: any) => {
  if (event.button !== 0) return;
  const box = boxOf(event.currentTarget as HTMLElement);
  event.preventDefault();

  const rect = box.getBoundingClientRect();
  const grabX = event.clientX - rect.left;
  const grabY = event.clientY - rect.top;

  const onMove = (moved: MouseEvent) => {
    /* Up against the other widgets but not through them, and never off the screen */
    const { left, top } = constrainDrag(box, {
      left: moved.clientX - grabX,
      top: moved.clientY - grabY,
    });
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.right = "auto";
    box.style.bottom = "auto";
    position = { left, top };
  };

  const onUp = () => {
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    try {
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    } catch (err) {
      /* it holds for this session either way */
    }
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
};

type Settings = { draggable?: boolean; source?: Source; interval?: string | number; background?: string; accent?: string; opacity?: number };
type State = { output: string; error?: string; settings?: Settings };

/* Bytes per second into something two or three figures wide, because the panel has room
   for a number and not for a sentence. */
const asRate = (perSecond: number) => {
  if (perSecond >= 1024 * 1024 * 10) {
    return { value: String(Math.round(perSecond / (1024 * 1024))), unit: "MB/s" };
  }
  if (perSecond >= 1024 * 1024) {
    return { value: (perSecond / (1024 * 1024)).toFixed(1), unit: "MB/s" };
  }
  return { value: String(Math.round(perSecond / 1024)), unit: "KB/s" };
};

export const render = (
  { output, error, settings }: State,
  dispatch: (event: { output?: string; error?: string }) => void
) => {
  const draggable = settings?.draggable === true;
  const surface = surfaceOf(settings?.background);
  const accent = accentOf(settings?.accent);
  /* how solid the panel is, as a fraction */
  const fill = Number(settings?.opacity);
  const solidity = Number.isFinite(fill) ? Math.min(Math.max(fill, 10), 100) / 100 : null;
  const source: Source = READINGS[settings?.source as Source]
    ? (settings?.source as Source)
    : "ram";
  const reading = READINGS[source];

  const chosen = Number(settings?.interval);
  chosenInterval = (INTERVALS.indexOf(chosen) > -1 ? chosen : 5) * 1000;

  /* Asking for something else should not mean waiting out the rest of the interval,
     which at a minute is a long time to look at nothing. The choice is taken now and
     the reading fetched straight away; the timer carries on from wherever it was. */
  if (source !== wanted) {
    wanted = source;
    take(source).then(
      (fetched) => dispatch({ output: fetched }),
      (err) => dispatch({ error: String((err && err.message) || err) })
    );
  }

  const frame = (children: unknown) => (
    <Panel
      /* Gailan asks macOS for frosted wallpaper behind exactly this rectangle. The
         corner is left for Gailan to read off the panel, so it cannot be written here
         as one number and in the stylesheet as another. */
      id="gailan-system"
      data-gailan-desktop-glass=""
      data-draggable={draggable}
      data-background={surface}
      style={{
        ...(accent ? { ["--accent" as string]: accent } : {}),
        ...(solidity !== null ? { ["--fill" as string]: String(solidity) } : {}),
      }}
      ref={place}
      onMouseDown={draggable ? startDrag : undefined}
    >
      {children}
    </Panel>
  );

  if (error) {
    return frame(
      <>
        <Marks>
          <Mark>{reading.label}</Mark>
        </Marks>
        <Mark>{error}</Mark>
      </>
    );
  }

  const parts = output.trim().split(/\s+/);
  const measured = parts[0] as Source;
  const value = Number(parts[1]);

  /* A reading of something else is a reading of the last choice, still on its way out.
     Better to say nothing for a moment than to put one measurement under another's
     name. */
  const stale = measured !== source;

  if (stale || !Number.isFinite(value)) {
    return frame(
      <>
        <Marks>
          <Mark>{reading.label}</Mark>
        </Marks>

        <Face />

        <Readout>
          <Percent>--</Percent>
          <Unit>{reading.portion ? "%" : ""}</Unit>
        </Readout>

        <Scale>
          {Array.from({ length: DIVISIONS }, (_, i) => (
            <Division key={i} data-on={false} data-high={i >= DIVISIONS - 3} />
          ))}
        </Scale>
      </>
    );
  }

  const full = reading.portion ? 100 : Math.max(1, Number(parts[2]) || ceiling);
  const shown = reading.portion
    ? { value: String(Math.max(0, Math.min(100, Math.round(value)))), unit: "%" }
    : asRate(value);
  const share = Math.max(0, Math.min(1, value / full));
  const lit = Math.round(share * DIVISIONS);

  return frame(
    <>
      <Marks>
        <Mark>{reading.label}</Mark>
        <Mark>{share >= 0.9 ? "high" : ""}</Mark>
      </Marks>

      <Face />

      <Readout>
        <Percent>{shown.value}</Percent>
        <Unit>{shown.unit}</Unit>
      </Readout>

      <Scale>
        {Array.from({ length: DIVISIONS }, (_, i) => (
          <Division
            key={i}
            data-on={i < lit}
            data-high={i >= DIVISIONS - 3}
          />
        ))}
      </Scale>

      <Footer>
        <div>0</div>
        {/* a share is out of a hundred; a rate is out of whatever the bar is full of */}
        <div>
          {reading.portion
            ? "100"
            : asRate(full).value + " " + asRate(full).unit}
        </div>
      </Footer>
    </>
  );
};
