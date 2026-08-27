/*
 * Clock
 *
 * Minimalist: monochrome with one red, monospace at every size, hairlines
 * instead of shadows, and labels that read like markings on a case rather than
 * words on a page.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

import { styled } from "gailan";

/* One command, three fields. The separator saves running `date` three times. */
export const command = "date '+%H:%M|%S|%a %d %b|%j'";

/* Seconds are shown, so this has to tick like one. */
export const refreshFrequency = 1000;

export const className = `
  left: 24px;
  top: 24px;
`;

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

const Dot = styled("div")`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red);
`;

const Readout = styled("div")`
  display: flex;
  align-items: baseline;
  gap: 6px;
`;

const Time = styled("div")`
  font-size: 40px;
  line-height: 0.95;
  letter-spacing: -0.02em;
  font-weight: 500;
  /* digits keep their column so the panel never twitches */
  font-variant-numeric: tabular-nums;
`;

const Seconds = styled("div")`
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--red);
  font-variant-numeric: tabular-nums;
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

type State = { output: string; error?: string };

export const render = ({ output, error }: State) => {
  if (error) {
    return (
      <Panel>
        <Marks>
          <Mark>clock</Mark>
          <Dot />
        </Marks>
        <Mark>unavailable</Mark>
      </Panel>
    );
  }

  const [time, seconds, date, dayOfYear] = output.trim().split("|");
  const day = Number(dayOfYear);

  return (
    <Panel data-gailan-desktop-glass={4}>
      <Marks>
        <Mark>local time</Mark>
        <Dot />
      </Marks>

      <Readout>
        <Time>{time}</Time>
        <Seconds>{seconds}</Seconds>
      </Readout>

      <Footer>
        <span>{date}</span>
        <span>
          {String(day).padStart(3, "0")}/365
        </span>
      </Footer>
    </Panel>
  );
};
