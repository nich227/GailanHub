/*
 * Memory
 *
 * How much of the machine's memory is in use, as a number and as a bar. Same
 * language as the clock: monochrome with one red, monospace at every size,
 * hairlines instead of shadows.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

import { styled } from "gailan";

/* memory_pressure reports how much is free, which is the number worth trusting:
   macOS fills memory on purpose, so "used" from vm_stat reads alarmingly high for
   a machine that is perfectly happy. Compressed and wired pages come along for
   the ride. */
export const command =
  "memory_pressure | awk '/System-wide memory free percentage/ " +
  "{ gsub(/%/, \"\", $5); print 100 - $5 }'";

/* Memory moves, but not in the way a clock does. */
export const refreshFrequency = 5000;

export const className = `
  left: 24px;
  top: 200px;
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
  gap: 4px;
`;

const Percent = styled("div")`
  font-size: 40px;
  line-height: 0.95;
  letter-spacing: -0.02em;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
`;

const Unit = styled("div")`
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--dim);
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
    background: var(--red);
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
    /* far enough onto the screen to still be caught hold of */
    const left = Math.max(
      0,
      Math.min(window.innerWidth - rect.width, moved.clientX - grabX)
    );
    const top = Math.max(
      0,
      Math.min(window.innerHeight - 40, moved.clientY - grabY)
    );
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

type Settings = { draggable?: boolean };
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
          <Mark>memory</Mark>
        </Marks>
        <Mark>{error}</Mark>
      </Panel>
    );
  }

  const used = Math.max(0, Math.min(100, Math.round(Number(output.trim()))));
  if (!Number.isFinite(used)) {
    return (
      <Panel
        data-draggable={draggable}
        ref={place}
        onMouseDown={draggable ? startDrag : undefined}
      >
        <Marks>
          <Mark>memory</Mark>
        </Marks>
        <Mark>no reading</Mark>
      </Panel>
    );
  }

  const lit = Math.round((used / 100) * DIVISIONS);

  return (
    <Panel
      data-draggable={draggable}
      ref={place}
      onMouseDown={draggable ? startDrag : undefined}
    >
      <Marks>
        <Mark>memory in use</Mark>
        <Mark>{used >= 90 ? "high" : ""}</Mark>
      </Marks>

      <Readout>
        <Percent>{used}</Percent>
        <Unit>%</Unit>
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
        <div>100</div>
      </Footer>
    </Panel>
  );
};
