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

import { styled } from "gailan";

/* Spotify first, then Music, and nothing at all if neither has a track loaded. The
   player's state comes along so a paused track still shows, quietly. Each -e is a
   line of AppleScript, which keeps this to one command. */
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
  top: 376px;
`;

const Panel = styled("div")`
  --ink: #f4f4f2;
  --dim: rgba(244, 244, 242, 0.42);
  --rule: rgba(244, 244, 242, 0.16);
  --red: #d71921;
  /* the lamp beats between these two while a track runs */
  --red-dark: #7c0d13;
  /* and sits at this one when it does not, which reads as off without going out */
  --red-pale: #f2868b;

  @media (prefers-color-scheme: light) {
    --ink: #0b0b0c;
    --dim: rgba(11, 11, 12, 0.45);
    --rule: rgba(11, 11, 12, 0.18);
    --red-pale: #e8a0a4;
  }

  position: relative;
  display: inline-block;
  width: 208px;
  padding: 14px 16px 12px;
  background: rgba(11, 11, 12, 0.82);
  border: 1px solid var(--rule);
  border-radius: 4px;
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

/* A lamp rather than an ornament: beating while a track runs, pale while it is
   held. Anyone who would rather it sat still can say so, and the system is asked
   before it beats at all. */
const Dot = styled("div")`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red-pale);

  @keyframes gailan-now-playing-beat {
    0%,
    100% {
      background: var(--red);
    }
    50% {
      background: var(--red-dark);
    }
  }

  &[data-playing="true"] {
    background: var(--red);
    animation: gailan-now-playing-beat 1.3s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &[data-playing="true"] {
      animation: none;
      background: var(--red);
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
  border-radius: 2px;
  background: var(--rule);
`;

/* Nothing to show, but the row should not jump when there is: a player with no
   artwork leaves the same square empty. */
const NoCover = styled("div")`
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border: 1px solid var(--rule);
  border-radius: 2px;
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

type State = { output: string; error?: string };

export const render = ({ output, error }: State) => {
  if (error) {
    return (
      <Panel>
        <Marks>
          <Mark>now playing</Mark>
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
      <Panel>
        <Marks>
          <Mark>now playing</Mark>
        </Marks>
        <Silent>nothing</Silent>
      </Panel>
    );
  }

  return (
    <Panel>
      <Marks>
        <Mark>{playing ? "now playing" : "paused"}</Mark>
        <Dot data-playing={playing} />
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
    </Panel>
  );
};
