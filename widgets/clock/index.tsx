/*
 * Clock
 *
 * Minimalist: monochrome with one red, hairlines instead of shadows, and labels
 * that read like markings on a case rather than words on a page. Two faces, since
 * the same instrument can tell the time two ways.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

// React comes along because the dial groups its marks and hands in fragments, and a
// fragment compiles to React.Fragment. Without it the analog face threw on every
// render and drew nothing at all, while the numerals, which use no fragments, were
// perfectly happy.
import { constrainDrag, React, styled } from "gailan";

/* The machine is asked what time it is, once, and everything shown is worked out from
   that: the two clock forms, the date, and how far through the year it is. Asking `date`
   to format six fields meant the command had to change whenever the display did, and it
   still could not tell a leap year from an ordinary one. */
export const command = "date +%s";

/* Seconds are shown on both faces, so this has to tick like one. */
export const refreshFrequency = 1000;

export const className = `
  left: 24px;
  top: 24px;
`;

/* The numerals are set in a dot matrix, which is where the industrial look comes
   from: a readout built out of lit cells rather than drawn strokes.

   The face is carried here rather than sitting beside this file. Gailan serves a
   widget's files under its folder name, so a path would break the moment anyone
   renamed the folder, and at 2KB for ten digits and a colon there is nothing to be
   saved by keeping it separate. DotGothic16, under the SIL Open Font License, which
   is in dotmatrix-OFL.txt. */
const NUMERALS =
  "data:font/ttf;base64,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";

/* The keyframes go in a style element rather than inside the styled component.
   Emotion serialises a component's css the first time it renders, and an at-rule in
   there took the whole subtree down with it: the dial drew nothing at all, while the
   digital face was fine because it never renders the dial and so never serialises
   its css. */
const Face = () => (
  <style>{`
    @font-face {
      font-family: "Gailan Dot Matrix";
      src: url("${NUMERALS}") format("truetype");
      font-display: block;
    }

    @keyframes gailan-clock-sweep {
      0% { transform: rotate(0deg); }
      97.5% { transform: rotate(360deg); }
      100% { transform: rotate(360deg); }
    }
  `}</style>
);

const Panel = styled("div")`
  --ink: #f4f4f2;
  --dim: rgba(244, 244, 242, 0.42);
  --rule: rgba(244, 244, 242, 0.16);
  --red: #d71921;

  @media (prefers-color-scheme: light) {
    --ink: #0b0b0c;
    --dim: rgba(11, 11, 12, 0.45);
    --rule: rgba(11, 11, 12, 0.18);
  }

  position: relative;
  display: inline-block;
  min-width: 208px;
  padding: 14px 16px 12px;
  /* flat, not glassy: the surface does not pretend to be lit */
  background: rgba(11, 11, 12, 0.82);
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
    background: rgba(244, 244, 242, 0.86);
  }
`;

/* The row of markings across the top, which is what makes the panel read as an
   instrument before you have read a single word. */
const Marks = styled("div")`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--rule);
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
  gap: 6px;
`;

const Time = styled("div")`
  font-family: "Gailan Dot Matrix", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 40px;
  line-height: 0.95;
  letter-spacing: 0.04em;
  /* digits keep their column so the panel never twitches */
  font-variant-numeric: tabular-nums;
`;

/* Small, and not red: the seconds are the thing moving, and am or pm is not. */
const Meridiem = styled("div")`
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dim);
`;

const Seconds = styled("div")`
  font-family: "Gailan Dot Matrix", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--red);
  font-variant-numeric: tabular-nums;
`;

/* ---------- the analog face ---------- */

/* Sixty marks, the quarters longer, no numerals: a dial you read by where the
   hands are rather than by looking anything up. */
const Dial = styled("svg")`
  display: block;
  width: 168px;
  height: 168px;
  margin: 2px auto 0;

  .tick {
    stroke: var(--dim);
    stroke-width: 1;
  }

  .tick-quarter {
    stroke: var(--ink);
    stroke-width: 2;
  }

  .hand-hour,
  .hand-minute {
    stroke: var(--ink);
    stroke-linecap: round;
  }

  .hand-hour {
    stroke-width: 4;
  }

  .hand-minute {
    stroke-width: 2.5;
  }

  /* The Swiss railway hand does not tick and does not quite sweep either: it goes
     round in 58.5 seconds and then waits at the top for the minute pulse. That is
     the whole character of the thing, so the keyframes hold at 360 for the last
     1.5 seconds rather than easing all the way round.

     The rotation is CSS rather than arithmetic because the widget only hears from
     the machine once a second, which is a tick however smoothly it is drawn. */
  .hand-second {
    stroke: var(--red);
    stroke-width: 1;
    stroke-linecap: round;
    transform-box: view-box;
    transform-origin: 50px 50px;
    animation: gailan-clock-sweep 60s linear infinite;
  }

  /* asked for less movement: the hand steps once a second, from the transform the
     render puts on it, which the animation was overriding */
  @media (prefers-reduced-motion: reduce) {
    .hand-second {
      animation: none;
    }
  }

  .cap {
    fill: var(--ink);
  }
`;

const Footer = styled("div")`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--rule);
  font-size: 9px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dim);
`;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const pad = (n: number) => String(n).padStart(2, "0");

/* A year is 366 days one in four, which the old hardcoded 365 could not say. */
const daysInYear = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;

const dayOfYear = (at: Date) => {
  const start = new Date(at.getFullYear(), 0, 0);
  return Math.floor((at.getTime() - start.getTime()) / 86400000);
};

const CENTER = 50;
const RADIUS = 46;

function pointAt(angle: number, length: number) {
  // twelve o'clock is up, and svg's y counts downward
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(radians) * length,
    y: CENTER + Math.sin(radians) * length,
  };
}

/* Starts the sweep where the minute already is, and only once: setting the delay on
   every render would restart the animation each second, which is the stutter this is
   here to avoid. */
const startSweep = (el: SVGLineElement | null) => {
  if (!el || el.dataset.sweeping === "yes") return;
  el.dataset.sweeping = "yes";

  const at = new Date();
  const into = at.getSeconds() + at.getMilliseconds() / 1000;
  el.style.animationDelay = `-${into.toFixed(3)}s`;
};

function Hands({
  hours,
  minutes,
  seconds,
}: {
  hours: number;
  minutes: number;
  seconds: number;
}) {
  // the hour hand moves through the hour rather than jumping at the top of it
  const hour = pointAt(((hours % 12) + minutes / 60) * 30, 24);
  const minute = pointAt((minutes + seconds / 60) * 6, 34);
  // straight up, and turned by the animation. The inline rotation is what shows when
  // movement is turned off, since an animation outranks it while it is running.
  const second = pointAt(0, 38);

  return (
    <>
      <line
        className="hand-hour"
        x1={CENTER}
        y1={CENTER}
        x2={hour.x}
        y2={hour.y}
      />
      <line
        className="hand-minute"
        x1={CENTER}
        y1={CENTER}
        x2={minute.x}
        y2={minute.y}
      />
      <line
        className="hand-second"
        ref={startSweep}
        style={{transform: `rotate(${seconds * 6}deg)`}}
        x1={CENTER}
        y1={CENTER}
        x2={second.x}
        y2={second.y}
      />
      <circle className="cap" cx={CENTER} cy={CENTER} r={2.5} />
    </>
  );
}

function Ticks() {
  return (
    <>
      {Array.from({ length: 60 }, (_, i) => {
        const quarter = i % 15 === 0;
        const outer = pointAt(i * 6, RADIUS);
        const inner = pointAt(i * 6, RADIUS - (quarter ? 7 : i % 5 === 0 ? 5 : 2.5));
        return (
          <line
            key={i}
            className={quarter ? "tick tick-quarter" : "tick"}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
          />
        );
      })}
    </>
  );
}

type Settings = { face?: string; hours?: string; draggable?: boolean };
/* ---------- moving it about ---------- */

/* Gailan puts a widget where its className says. Dragging has to override that, so
   the position lives outside render, in localStorage, and is written onto the element
   Gailan positions rather than onto the panel inside it. That survives the re-render
   this widget does every second. */
const POSITION_KEY = "gailan.clock.position";

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

type State = { output: string; error?: string; settings?: Settings };

export const render = ({ output, error, settings }: State) => {
  const draggable = settings?.draggable === true;

  if (error) {
    return (
      <Panel
        data-draggable={draggable}
        ref={place}
        onMouseDown={draggable ? startDrag : undefined}
      >
        <Marks>
          <Mark>clock</Mark>
        </Marks>
        <Mark>unavailable</Mark>
      </Panel>
    );
  }

  const at = new Date(Number(output.trim()) * 1000);
  if (Number.isNaN(at.getTime())) {
    return (
      <Panel
        data-draggable={draggable}
        ref={place}
        onMouseDown={draggable ? startDrag : undefined}
      >
        <Marks>
          <Mark>clock</Mark>
        </Marks>
        <Mark>unavailable</Mark>
      </Panel>
    );
  }

  const analog = settings?.face === "analog";
  const twelve = settings?.hours !== "24";

  // the hands are worked out from the twenty-four hour reading whichever face is
  // showing, since a dial has no use for am and pm
  const hours = at.getHours();
  const minutes = at.getMinutes();
  const seconds = pad(at.getSeconds());

  const shown = twelve
    ? `${hours % 12 || 12}:${pad(minutes)}`
    : `${pad(hours)}:${pad(minutes)}`;
  const meridiem = hours < 12 ? "am" : "pm";

  const date = `${WEEKDAYS[at.getDay()]} ${at.getDate()} ${MONTHS[at.getMonth()]}`;
  const day = dayOfYear(at);
  const lengthOfYear = daysInYear(at.getFullYear());

  return (
    <Panel
      data-gailan-desktop-glass={4}
      data-draggable={draggable}
      ref={place}
      onMouseDown={draggable ? startDrag : undefined}
    >
      <Face />

      <Marks>
        <Mark>local time</Mark>
      </Marks>

      {analog ? (
        <Dial viewBox="0 0 100 100" role="img" aria-label={`${shown} ${seconds}`}>
          <Ticks />
          <Hands
            hours={hours || 0}
            minutes={minutes || 0}
            seconds={Number(seconds) || 0}
          />
        </Dial>
      ) : (
        <Readout>
          <Time>{shown}</Time>
          <Seconds>{seconds}</Seconds>
          {twelve && meridiem ? <Meridiem>{meridiem}</Meridiem> : null}
        </Readout>
      )}

      <Footer>
        <span>{date}</span>
        <span>
          {String(day).padStart(3, "0")}/{lengthOfYear}
        </span>
      </Footer>
    </Panel>
  );
};
