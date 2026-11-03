# SILLY POINT / cricket scoring

Score a match locally, then optionally share a public live-watch link.

Live: https://aditya2375.github.io/silly-point/

## Run and test

Serve this directory with `python3 -m http.server 8000`. No build step. `npm test` runs the engine and snapshot-validation tests. MQTT.js 5.10.1 is pinned with an integrity hash on the CDN script; npm lockfile records its dependency audit. Fonts are local and their licences are included.

## Privacy and live sync

Matches you create stay in browser storage. No public broker connection is made until you explicitly enable public sync for that match. The opt-in lasts for the current page, not future visits. Public sync sends team names, player names and scores to broker.emqx.io. Do not enter private information. The broker may retain the latest snapshot. Anyone can read or forge messages on this public broker. This is not authenticated scoring, not private storage and not suitable for official results.

The scorer never accepts remote snapshots as its local score. Watch snapshots are validated, bounded and kept in a separate in-memory cache; they do not grant scorer access. Watch pages label feeds unverified. Schema validation prevents malformed data from crashing the renderer but does not authenticate the publisher. Same-browser tabs can follow without public sync. Cross-device delivery is best effort and stops when the broker or network is unavailable. Closing or leaving the route cleans up the connection. Local scoring still works if MQTT.js cannot load.

Browser storage is not a backup. Clearing site data loses local matches. Storage failures warn that changes remain in memory only. Unreadable stored data is left untouched on load; a subsequent save replaces it. Three opening match records are illustrative samples, not actual games. Old browser records from before this update cannot be retrospectively authenticated.

## Scoring scope

Ball-by-ball runs, wides, no-balls with runs off the bat, byes, leg-byes, six dismissal options, undo, innings close, chase maths, batting and bowling figures. The engine handles byes/leg-byes without charging the bowler, keeps no-ball penalty separate from batting runs, and replaces the named run-out batter without changing opening history. Wides with completed runs rotate strike.

This is a casual cricket scorer, not a complete implementation of every law. No-ball plus bye/leg-bye combinations, penalties, free-hit competition rules, unusual dismissals, interruptions/DLS, player replacements and run-out end/crossing ambiguity are not represented. For unusual run-outs, check the striker/non-striker state before continuing; do not use this as the sole official record.

Rules references: https://www.lords.org/mcc/the-laws/no-ball and https://www.lords.org/mcc/the-laws/run-out .

## Security boundary

Incoming snapshots are capped at512KB and rate-limited for rendering, with allowlisted fields, numeric/text limits and at most two innings/3,000 deliveries each. Names are escaped in scorecards and commentary. CSP restricts scripts and network destinations; GitHub Pages owns response headers. No account, payment, private backend or queue. An authenticated/private broker would require a separate service and user decision, not a hidden credential in client code.
