/*
 * Clock
 *
 * The template every other widget in this repository started from: one shell
 * command, one styled component, one render.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

import { styled } from "gailan";

/* `date` is in every shell, so this needs nothing installed. The separator makes
   one command return three fields without three commands. */
export const command = "date '+%H:%M|%a %d %b|%j'";

/* A clock only has to be right to the minute, so once a second is waste. Ten
   seconds is close enough that it never looks stale. */
export const refreshFrequency = 10000;

export const className = `
  left: 24px;
  top: 24px;
`;

const Panel = styled("div")`
  --ink: #f2f2f4;
  --dim: rgba(242, 242, 244, 0.55);

  @media (prefers-color-scheme: light) {
    --ink: #16161a;
    --dim: rgba(22, 22, 26, 0.55);
  }

  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 18px;
  border-radius: 12px;
  background: rgba(20, 20, 26, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
  color: var(--ink);
  font-family: "SF Mono", ui-monospace, Menlo, monospace;
`;

const Time = styled("div")`
  font-size: 34px;
  line-height: 1;
  letter-spacing: -0.5px;
  /* digits keep their column, so the width does not jitter every minute */
  font-variant-numeric: tabular-nums;
`;

const Line = styled("div")`
  font-size: 11px;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: var(--dim);
`;

type State = { output: string; error?: string };

export const render = ({ output, error }: State) => {
  if (error) return <Panel><Line>clock unavailable</Line></Panel>;

  const [time, date, dayOfYear] = output.trim().split("|");

  return (
    <Panel>
      <Time>{time}</Time>
      <Line>{date}</Line>
      <Line>day {Number(dayOfYear)} of 365</Line>
    </Panel>
  );
};
