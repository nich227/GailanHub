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
   from: a readout built out of lit cells rather than drawn strokes.

   The face is carried here rather than sitting beside this file. Gailan serves a
   widget's files under its folder name, so a path would break the moment anyone
   renamed the folder, and at 2KB for ten digits and a colon there is nothing to be
   saved by keeping it separate. DotGothic16, under the SIL Open Font License, which
   is in dotmatrix-OFL.txt. */
const NUMERALS =
  "data:font/ttf;base64,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";

const Face = () => (
  <style>{`
    @font-face {
      font-family: "Gailan Dot Matrix";
      src: url("${NUMERALS}") format("truetype");
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
