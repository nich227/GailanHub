/*
 * Clock
 *
 * Minimalist: monochrome with one red, hairlines instead of shadows, and labels
 * that read like markings on a case rather than words on a page. Two faces, since
 * the same instrument can tell the time two ways.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

import { styled } from "gailan";

/* One command, four fields. The separator saves running `date` four times. */
export const command = "date '+%H:%M|%S|%a %d %b|%j'";

/* Seconds are shown on both faces, so this has to tick like one. */
export const refreshFrequency = 1000;

export const className = `
  left: 24px;
  top: 24px;
`;

/* The numerals are set in a dot matrix, which is where the industrial look comes
   from: a readout built out of lit cells rather than drawn strokes. The file sits
   beside this one and holds only the digits and the colon, so it costs 2KB. */
const Face = () => (
  <style>{`
    @font-face {
      font-family: "Gailan Dot Matrix";
      src: url("dotmatrix.ttf") format("truetype");
      font-display: block;
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
  border-radius: 4px;
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

  .hand-second {
    stroke: var(--red);
    stroke-width: 1;
    stroke-linecap: round;
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

const CENTRE = 50;
const RADIUS = 46;

function pointAt(angle: number, length: number) {
  // twelve o'clock is up, and svg's y counts downward
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: CENTRE + Math.cos(radians) * length,
    y: CENTRE + Math.sin(radians) * length,
  };
}

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
  const second = pointAt(seconds * 6, 38);

  return (
    <>
      <line
        className="hand-hour"
        x1={CENTRE}
        y1={CENTRE}
        x2={hour.x}
        y2={hour.y}
      />
      <line
        className="hand-minute"
        x1={CENTRE}
        y1={CENTRE}
        x2={minute.x}
        y2={minute.y}
      />
      <line
        className="hand-second"
        x1={CENTRE}
        y1={CENTRE}
        x2={second.x}
        y2={second.y}
      />
      <circle className="cap" cx={CENTRE} cy={CENTRE} r={2.5} />
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

type Settings = { face?: string };
type State = { output: string; error?: string; settings?: Settings };

export const render = ({ output, error, settings }: State) => {
  if (error) {
    return (
      <Panel>
        <Marks>
          <Mark>clock</Mark>
        </Marks>
        <Mark>unavailable</Mark>
      </Panel>
    );
  }

  const [time, seconds, date, dayOfYear] = output.trim().split("|");
  const day = Number(dayOfYear);
  const analog = settings?.face === "analog";
  const [hours, minutes] = (time || "").split(":").map(Number);

  return (
    <Panel data-gailan-desktop-glass={4}>
      <Face />

      <Marks>
        <Mark>local time</Mark>
      </Marks>

      {analog ? (
        <Dial viewBox="0 0 100 100" role="img" aria-label={`${time}:${seconds}`}>
          <Ticks />
          <Hands
            hours={hours || 0}
            minutes={minutes || 0}
            seconds={Number(seconds) || 0}
          />
        </Dial>
      ) : (
        <Readout>
          <Time>{time}</Time>
          <Seconds>{seconds}</Seconds>
        </Readout>
      )}

      <Footer>
        <span>{date}</span>
        <span>{String(day).padStart(3, "0")}/365</span>
      </Footer>
    </Panel>
  );
};
