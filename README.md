# SILLY POINT — live cricket scoring

Score a cricket match ball by ball; everyone else watches it live on a link.

## What it is

- **Scorer console** — runs, wides, no-balls, byes, leg-byes, wickets with dismissal types, per-over bowler rotation (no consecutive overs), undo, manual innings close.
- **Self-writing scorecard** — batting and bowling figures, extras breakdown, fall of wickets, run rates, all derived by replaying the ball list.
- **Watch link** — every ball publishes live. Watchers open the link on any phone and see the score bug, current pair, bowler figures, this-over dots and a ball-by-ball feed update themselves.
- **Chase math** — second innings gets target, runs needed, balls left and required rate automatically.

## Run it

Static site — open `index.html` or serve the folder. Live sync uses a free public MQTT broker (broker.emqx.io) over WebSockets via CDN, so no accounts or backend are needed. If the CDN/broker is unreachable, scoring still works locally and same-browser tabs stay in sync; cross-device watching pauses.

## Notes

- Matches persist in the browser's local storage.
- Ships with one clearly-marked sample match (Tusker XI v Uniworld Strikers) — removable from the home screen.
- The public broker means anyone with the link could technically publish to the match topic. Fine for hostel cricket; a private broker is the upgrade path.
