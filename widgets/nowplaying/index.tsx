/*
 * Now Playing
 *
 * What Spotify or Music is playing, if either is. Same language as the clock:
 * monochrome with one red, monospace at every size, hairlines instead of shadows.
 *
 * The first time this runs, macOS asks whether Gailan may control Spotify and
 * Music. Say yes or the widget has nothing to read. System Settings, Privacy &
 * Security, Automation, if you say no and change your mind.
 *
 * Copyright (c) 2026 Kevin Chen. MIT licensed.
 */

// React comes along because the transport glyphs group their pixels in fragments, and
// a fragment compiles to React.Fragment. Without it the widget throws and draws nothing.
import { constrainDrag, React, run, styled } from "gailan";

/* Spotify first, then Music, and nothing at all if neither has a track loaded. The
   player's state comes along so a paused track still shows, without its lamp beating.
   Each -e is a line of AppleScript, which keeps this to one command. */
export const command = [
  "osascript",
  '-e \'set a to ""\'',
  "-e 'tell application \"System Events\" to set p to name of processes'",
  "-e 'if p contains \"Spotify\" then tell application \"Spotify\" to" +
    " if player state is not stopped then set a to (name of current track)" +
    ' & "|" & (artist of current track) & "|" & (player state as string)' +
    ' & "|" & (artwork url of current track)\'',
  // Music holds artwork as data rather than at a url, so there is nothing to point
  // at and the cover is left empty there
  "-e 'if a is \"\" and p contains \"Music\" then tell application \"Music\" to" +
    " if player state is not stopped then set a to (name of current track)" +
    ' & "|" & (artist of current track) & "|" & (player state as string)\'',
  "-e 'return a'",
].join(" ");

/* A track lasts minutes, and asking a player what it is playing is not free. */
export const refreshFrequency = 5000;

export const className = `
  left: 24px;
  top: 24px;
`;

const Panel = styled("div")`
  --ink: #f4f4f2;
  --dim: rgba(244, 244, 242, 0.42);
  --rule: rgba(244, 244, 242, 0.16);
  --red: #d71921;
  /* the lamp beats between these two while a track runs, so it reads dark red */
  --red-dark: #7c0d13;
  /* and sits at this one when a track is held rather than running */
  --red-pale: #f2868b;
  /* with nothing loaded there is nothing to be red about, so it goes gray: light
     against a dark panel, dark against a light one */
  --lamp-idle: #9b9b96;

  @media (prefers-color-scheme: light) {
    --ink: #0b0b0c;
    --dim: rgba(11, 11, 12, 0.45);
    --rule: rgba(11, 11, 12, 0.18);
    --red-pale: #e8a0a4;
    --lamp-idle: #55555a;
  }

  position: relative;
  display: inline-block;
  width: 208px;
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

/* A lamp rather than an ornament, and it says which of three things is true: a track
   running, a track held, or no track at all. The system is asked before it beats. */
const Dot = styled("div")`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--lamp-idle);

  &[data-state="playing"] {
    background: var(--red-dark);
    animation: gailan-now-playing-beat 1.3s ease-in-out infinite;
  }

  &[data-state="paused"] {
    background: var(--red-pale);
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-state="playing"] {
      animation: none;
      background: var(--red-dark);
    }
  }
`;

/* The one thing here that is not monochrome. Album art is what the widget is about,
   so it is shown as it is rather than made to match the case around it. */
const Cover = styled("img")`
  display: block;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  object-fit: cover;
  border: 1px solid var(--rule);
  border-radius: 7px;
  background: var(--rule);
`;

/* Nothing to show, but the row should not jump when there is: a player with no
   artwork leaves the same square empty. */
const NoCover = styled("div")`
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border: 1px solid var(--rule);
  border-radius: 7px;
`;

const Track = styled("div")`
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
`;

const Words = styled("div")`
  min-width: 0;
`;

const Title = styled("div")`
  font-size: 15px;
  line-height: 1.25;
  font-weight: 500;
  /* a long title wraps to two lines and then stops, so the panel keeps its shape */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Artist = styled("div")`
  margin-top: 5px;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Silent = styled("div")`
  font-size: 13px;
  letter-spacing: 0.04em;
  color: var(--dim);
`;

/* Whichever player is there, told to do one thing. The same two-step as the reading
   command: Spotify if it is running, Music otherwise. */
function control(action: string) {
  const command = [
    "osascript",
    "-e 'tell application \"System Events\" to set p to name of processes'",
    `-e 'if p contains "Spotify" then tell application "Spotify" to ${action}'`,
    `-e 'if p contains "Music" and not (p contains "Spotify") then` +
      ` tell application "Music" to ${action}'`,
  ].join(" ");

  // nothing to do with the answer: the next read shows what happened
  run(command).catch(() => {});
}

/* ---------- the controls ---------- */

/* Drawn on a grid, one square per pixel, so they look built rather than
   illustrated. crispEdges keeps the squares square at any size. */
const Glyph = styled("svg")`
  display: block;
  width: 16px;
  height: 16px;
  shape-rendering: crispEdges;

  rect {
    fill: var(--ink);
  }
`;

const Controls = styled("div")`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 12px;
  padding-top: 11px;
  border-top: 1px solid var(--rule);
`;

const Button = styled("button")`
  display: block;
  padding: 3px;
  border: 0;
  background: none;
  cursor: pointer;
  /* the panel is the surface; a button on it is just the glyph */
  opacity: 0.72;

  &:hover {
    opacity: 1;
  }

  &:active rect {
    fill: var(--red);
  }

  &:focus-visible {
    outline: 1px solid var(--red);
    outline-offset: 2px;
  }
`;

/* Eight units across, eight down. A bar and a triangle stepped one pixel at a time,
   which is what gives the stair edges. */
const Triangle = ({ x, flip }: { x: number; flip?: boolean }) => (
  <>
    {[0, 1, 2, 3].map((i) => (
      <rect
        key={i}
        x={flip ? x + 3 - i : x + i}
        y={1 + i}
        width={1}
        height={8 - i * 2}
      />
    ))}
  </>
);

const Previous = () => (
  <Glyph viewBox="0 0 10 10" aria-hidden="true">
    <rect x={1} y={1} width={1} height={8} />
    <Triangle x={3} flip />
  </Glyph>
);

const Next = () => (
  <Glyph viewBox="0 0 10 10" aria-hidden="true">
    <Triangle x={3} />
    <rect x={8} y={1} width={1} height={8} />
  </Glyph>
);

const Play = () => (
  <Glyph viewBox="0 0 10 10" aria-hidden="true">
    <Triangle x={3} />
  </Glyph>
);

const Pause = () => (
  <Glyph viewBox="0 0 10 10" aria-hidden="true">
    <rect x={3} y={1} width={2} height={8} />
    <rect x={6} y={1} width={2} height={8} />
  </Glyph>
);

function Transport({ playing }: { playing: boolean }) {
  return (
    <Controls>
      <Button
        type="button"
        aria-label="Previous track"
        onClick={() => control("previous track")}
      >
        <Previous />
      </Button>
      <Button
        type="button"
        aria-label={playing ? "Pause" : "Play"}
        onClick={() => control("playpause")}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <Button
        type="button"
        aria-label="Next track"
        onClick={() => control("next track")}
      >
        <Next />
      </Button>
    </Controls>
  );
}

/* ---------- moving it about ---------- */

/* Gailan puts a widget where its className says. Dragging has to override that, so
   the position lives outside render, in localStorage, and is written onto the element
   Gailan positions rather than onto the panel inside it. That survives the re-render
   this widget does every second. */
const POSITION_KEY = "gailan.nowplaying.position";

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

/* The keyframes go in a style element rather than inside the styled component.
   Emotion serialises a component's css the first time it renders, and an at-rule in
   there took the whole widget down with it: the panel drew nothing at all. */
const Beat = () => (
  <style>{`
    @keyframes gailan-now-playing-beat {
      0%, 100% { background: var(--red-dark); }
      50% { background: var(--red); }
    }
  `}</style>
);

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
        <Beat />
        <Marks>
          <Mark>now playing</Mark>
          <Dot data-state="idle" />
        </Marks>
        <Mark>{error}</Mark>
      </Panel>
    );
  }

  // artwork urls carry no pipe, so splitting on it is safe
  const [title, artist, state, artwork] = output.trim().split("|");
  const playing = state === "playing";

  if (!title) {
    return (
      <Panel
        data-draggable={draggable}
        ref={place}
        onMouseDown={draggable ? startDrag : undefined}
      >
        <Beat />
        <Marks>
          <Mark>now playing</Mark>
          <Dot data-state="idle" />
        </Marks>
        <Silent>nothing</Silent>
      </Panel>
    );
  }

  return (
    <Panel
      data-draggable={draggable}
      ref={place}
      onMouseDown={draggable ? startDrag : undefined}
    >
      <Beat />
      <Marks>
        <Mark>{playing ? "now playing" : "paused"}</Mark>
        <Dot data-state={playing ? "playing" : "paused"} />
      </Marks>
      <Track>
        {artwork ? (
          <Cover src={artwork} alt={`Cover of ${title}`} />
        ) : (
          <NoCover aria-hidden="true" />
        )}
        <Words>
          <Title>{title}</Title>
          <Artist>{artist || "unknown"}</Artist>
        </Words>
      </Track>

      <Transport playing={playing} />
    </Panel>
  );
};
