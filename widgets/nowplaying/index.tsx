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

/* The title is set in the face the clock tells the time in, so the widgets read as one
   set. This one carries letters as well as figures, which the clock's does not need, and
   is compressed because a title needs the whole alphabet: 4KB against 15KB uncompressed.
   Anything outside Latin, a Japanese title for instance, falls back to the panel's own
   face for those characters. DotGothic16, under the SIL Open Font License, which is in
   dotmatrix-OFL.txt. */
const LETTERS =
  "d09GMgABAAAAAA+8AAoAAAAAOqgAAA9tAAEZmgAAAAAAAAAAAAAAAAAAAAAAAAAABmAAgX4K5hjSVgE2AiQDhQwLgkgABCAFghQHIBvtLrOidjBWEhT/ZUIUub7Ihk4ns4d9855m2sw5ca5pq6yu8rwviktfEav8cbsuHFTRRBONyyMkmTXQjprgAOdsVeSzE1WKWsTB7WSp5QlnkEuq4jxYVR557O2UA4D/aZYGTSalihRqFalJysyf5bDUfA8j/4HsguhSGofhygJ9bmvRSXQhjW0ah54535tklxm7K+N6zuX/AID27lXpfFk6G/XxABhCG9T5s5w5W97A/v3mmJGduHc0umt/QgbdyTMaMs1Kh8QZf3fsZKPqS5yV7v5rzT47/RkUHJE84YDVvxOKjEleuvO2u9OZbLKbv1lgnE7PbE1gDhiE/IhZd0xCgpDn7KmTp6BehTkVjnObv19d4YbuQ2dlOfCRprHEEmusFfp5SwBn5zIPMgCdpnkBiaNDkpI8EhUoVcDhnoPA8G3GdGImwoiyYW0mA58kAgABAGrMtAAIsgAo8FwbJWm3crzmLl2/JIcqChXp0W+H/c4654LrbrrnuQ++++kfSUgYCBNhIwEIRYr1osiJredduvYtD7zwify6rBH6wni/0iNUegjSEVvfElfaYrN5NgZpnbU6rLaqwxUPFwR3aud2xq4jWLDyycsUKddowqQp02bMUq9SjVLFKlQ3fDVsBQGJsWzX1C21Cu01myaQgz7DwFl+Yvx0RKhiqOhxwQkQbNgzjLueUDZkZNh6IdB5so4wRsWOYWywx5GPxo5jiqJIwqExgQwN58+Qte2BNz/XoxPSnQ6EmK7/zo97dqfFcBP35sn7NbY5IHtDs100+tFk3immJufWlZ39TanGfywtmgxOkrgXaXm5njwAADtjJrGvZpTwxHqdLXNWhdI1wTG6FHm+BYJ8E/MhlpCWlMtkKHMt2LPrJmXsBK+TUcaSwTMvwka6/MsVd3n4JB2WrDIBUE5oevrSmKVygNXC4Quw8JkjsuXKHIHPcaD/GS4E9AxThZFjMRi0EqYVggwnFfWSQ0MYByKJSgGHbgtltWFCEI4UDknWBypiCCT79RBDEtLjvNKuhsI0km8G8biLgUQGN5IjtjcwpXoLEJnc4ZdTGddUwxsAvzhrVXmyju2jJtoRCgiFnETjSGm6CvI4ekhgvwmieLslmnKxxPiKW1vix/hNjDYNC+un1NhDUGQNcLc4xOcjS+m2nXmXPpEYCT82FWSLRdPjwQRmBTp9YeinZhZRkLlL1nYlaggYrc4WwLoifU6wPFmmVqqBkT1N3aONlTAV/XoR0ssB/kFqUDHZTKCaPNAJ4+uQjMbRnGQRLMIe46XZwAOiQiLH9gydFJ+/CFiRT12lTUfGxNmud2ooGfFa5J06k/5UARvgkWJF2S4Ws1PCSoq20hx/Ro7UhXb4HOgib5wi2+yBTDgfep5iIQwYhDkIntqKtg3mmUhloFGkTUJmw5JgNnJbOoFeOnQiPWehzy4jgdb0rcQC7vlcPFGVo0lBW8xS2y1FxlnENC3rJMuhCx9VtzuMMlJDjtdCSNYatZvVdPT3UbiKvFEbsIpBGE+aRc0FYXAaW+TkI66i3AhYzHiWZXqgfKZ2B7CW4SFcEj1CBgXm3r4qOVYGEWOPopJSI2T0y3FgjoNdN6YitdV1U37fntcqbAcUYZV2ESvaNDQ0hUQRNCk1YxTavyvHZhGdIEbCVNKGwiwNLV4oC5WRgBhNDk2YLxk3+kMUxpOb6okHeqD2YhsnuIJT8WYLUW1Lwbj0y5v0FUpixCy90TdR3tOKArmPyoLCqarYtPUDYo/HojIIRw5ye9wCgLIH1nETnNZbjRD6DEucohYxu/CWuwX5RiW4T7/ptJ/60/iC6vk3iMEy6GFuaKy7vTXFreqCQqx79rhWihA76g6UuIBWT4T6VfOZjLFwFT1Zk7Olrfg5AhJWD52BnrhGLRrrVokpXG1U7OlFuC+gRVuljlU79upiwzmGcNp8t2geui5IDOJMU0w6MwrLx1UgIyPxcUQXU68LaJHAHsuaI6y7AodwlNPDzljTuUJm5R1kUWyj0gWZg+2bmIXm9YBahTVDmJQK2WIAIRP39MVO6wBcwR+HJh0iPYCNCglmOBTfG4btvHDJWlY8tIuYf1pSPdYbmnzeUWYZgy/wqAnvGEc06juz2WrqJs9XNwjMYkwVCwbylivIwhvcLJJHpM74f+YZbqqB0Jgh5mhMYGTkPkyxvmnC3iahdwyp5Pcr3AZUvl7cTryXa50Z/btKX//I0IYwkJPYqk0MVI46Bjg+lQkBipVbhZU+m/TwQD+pgcyXS6ci7cQi0jGCraZQRXJBe/w41pb+8NLhq10VKmP1NadaPv0Yil1gM03Z4VBFQjw7HQvYXYtxCj6OdY/X1fnqBmQqf53FF2JeZEIiYAL8F9gH6mNDWXOaNNOf2qud2hOP1gDR/eMQuLUMAAhOWR8Yqeu6iWMqMVcspCp7XEWhV9L4SrFbeyovbWR1wd7Aw5KBtOoBSnRRSHzC9SX/jZz7BAC9wbR3/ejG4srGGV8R5rxP9udp2o1rDKE5ZwNzJiRGJiZEl5kYkZgY2aiZTO3ckhgAck7CDpYffogO3CI7YsvoSdThdWcgsyQjCXZkRxQ/eCDDAUgm4u7Sr72PyD4BHaK+uIK8a/KtkhFc/VMZlhIi1REJCfjgDBTNB835cx9enZ4R4n+7espDv7Po//0TnVVi1cSjHh1oJYKwD6AYLZJd0KGJKHoWJsqOrjMTSnqE/pAhI2TkKoL0D02cjR1w/IvHNN7JTlBPpV3Izrzseo6s9lOBZgNtbg+BjhtxRagvbJ903kxS6ywjiURVmhpGGQ4DvdpkSjLNZeOartHGXBxEkklOC84oFeG83RGlWW92M/Bz1F3Nf7BOriV1D0z/RRP8tOhsr90zzpQrJrDGbwFiDXyAKfZQb0+v1njdn7D4ZMM9TllLzdtEuDWrLlZ/q6aVAWo3LCiusGDDfV1VK7896UiRws6wV+NtaWve3l53bQfVv5b/uri7cmuJ070mBL3G5t4sR7bEL89OW+uymrlZ9ag6Jh/zjqd/62HvJgtb5ieHLPV13akslLbU604pKd9jnnZdH3TztoUgyWyOjNcwNJNMX7bmVo3seEf1lzmW4CN6jjKyZ9TX9SvZ5FPtRr4Cx+PTXS5nmlKWx94vohzzDS4VmQzheNxv/0SEbd5TPkYE+sxiPz4Is0vBE9490d/dAZaDHb/PWgxsZpImtdU9rGczA4PerV25Ie7dPvDXf6rI5Ggn/o+RvfQcOeqEIwob18BMUjv3R2XExm04ylGdc6MbbgROqQbmNjFBEJlsFlKITUbN/EyksO7EVhtJuVSHofEGh+AOO/iCai46kCK944jhXF84rms9AgRCEnqhysIdNL4U/WAOihl1uDV404SLReupPOsQCUtS88zpV2r+AYmsZKR7/X5nY3eQfLacEPfo1QY7WDu+AIaDuwbQb4QDAaq1W6zPWTp5RGZxZDlbFxa8tNYpTwrsaqnq6id0rGz0G7Xy8Ljy90z7y+CpZvZcuLyEYHa3RpseGLR0RctXd6ByZn3XTijr4j/EUWZkS1ra7UV30L06C1W4sZpf6QPPJ3jgzR1d68SdcEYfJ358VDaT2WOs+/VgmtF8JlLIxDyDcUo2NMO+cQbAszgOA5X8j34l5AOHEAgAhvDRm8elNsjjcKeZ1ThQVjo98D2TBLc8aiJyN/VjXTk9jT88f2FpY1AKBy3kAzVAfazubufOdEtmTVU3I+H2YQu9Rfsirr6TBWZbs/L3E1N3X08I3meilEnBO5OkuoSYNSNj2/jL0pfo4b1c1oar51nKGlh3ceKrWabVTMbllVFsK0GXQuxkunhKgvUGlaBln2WyDyx7I3rTTO57RSiWRMX3brRAxvjsLPk/pOOSzBovU3g5+kyagzJFlC/byM4FebMdQ5DzQKrRTfYozqHIYrLHE31Qs0VCFYI2F27rfHfTJvODoFy7f+Mj4JTCNj87YvqzBMPaX7mvzGbWtq0hYwrDVTxTUwe6C5NsNoMpdXlLH1ePHSzF/39zc+O+WVTTgmAsIpyvsF/VNGqGYA7C/tdOG/f5kOqEiITwD9Zbr5xE/edpLID9A8S8yEB+2p2nU3KXU/6WmHxz9yZUYX9rp3b39KK72X34w93zd83FkadZ8FacpeH6KSeQidL3r5PgkfrgNYiBsMZJtjaUDPv65FJ9M/KGN6HKfdz0fWB49mHXde970p89UUhojnQMLOjf/MtDPFw+PcAhtkoWX7MZOUECdL8puJdU/ulqRThknbgyEqt09Hj4slvCzc+WH/ZygG04su/OYMvhwygm8TA86Uv3MMNcRRIhZf71209elfOr6XWfQIAHB2/Y8C1grbsRfOyuHZxxZw6u+a+qf3dLxF2tCfnmj0X+AmrusQYIO+TcQwEvzkw1Au8u8u7Xe9+nvj79isC6O+5V4obL+oOEtD1yZrz8exHIfP6Ca9ivVvqRy+7zPc36ew7bAWVFB2lGXKIXzxqFcOeX+uhyIslXZEWVBixo9ueuXq7Lr8avusTTDIOl3X5ZhAwEvbMTJL8mOIizKYYKnvb3WAe6drttbkfdBHyGSRuJ3NPcsyN27o8B0nBM5xsbhVE+OxWXsQc7/GfBR8EzF+oz83Kt1MnltibV+g0LkRYmbY11vBcTkLN+HOXKFkTzHSghHgJ4XyqV9yroVde2jIAUeXMLX6uMYGMM7QEzf1V9rkE9jnzP0ZnZ9iL1wBCa5dVeVJdNAd63UPpDsShI8xI/EKTQlm5xuPr0+JK4VJv5w8cMpt0UknADmJUvUoQh2QXDdkyX1FNlpovpDeNVRjMa3lSMP1tzgh111BfdG0a/dVOdp0drvMzNDRod9Bma2xL9Tx33FAQ/+KOtuzoiMbstC78IoexlmpFwJAsCcaNx4MxjJXoC9txxHNpz4xPjdePfKq888dw8CDIo0WDR/BOxW0vVgr6ZEnsJwN0J8dGZP+IPKk3eeFuALCh2CJ/8/xBmqihoDxzXD3x1vas3XwHINbJgpfFKCjvy0x8KIKE5gWdMBIWMByv3QbMy0KYoDw25dlsb+39GQWgxfU2+QAZBFrBZWXBzA9Uho/a3MCLXVGCrqEgq9AgOTMHMxoQmC5YvwEj+c83iB0PWoMYkoss2QbiGDYepskjBQLhCD9GlR66kUIXulQxBrK7ksFF2pQwMjXPZ6swVorTqEjuUdf/L3OXOR4aaWqtbk3Idee4C3E1NDRQjV6LM2AU+j7N1A70xwXNymQ6dXZlWLQrDLkaoFMPh/qQleQAAAAA=";

/* In a style element, not in a styled component: Emotion serialises a component's css
   when the component is built, and an at-rule in there blanks the whole widget. */
const Face = () => (
  <style>{`
    @font-face {
      font-family: "Gailan Dot Matrix Text";
      src: url("${LETTERS}") format("woff2");
      font-display: block;
    }
  `}</style>
);

const Title = styled("div")`
  font-family: "Gailan Dot Matrix Text", "SF Mono", ui-monospace, Menlo, monospace;
  font-size: 15px;
  line-height: 1.25;
  letter-spacing: 0.04em;
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
      <Face />

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
