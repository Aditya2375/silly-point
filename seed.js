/* Match history — finished hostel-turf games so the product
   opens with real-looking scorecards in it. */

function simulateMatch({ id, date, overs, teamA, teamB, prngSeed, aggA, aggB }) {
  const m = Cricket.newMatch({
    teamA: teamA.name, teamB: teamB.name, playersA: teamA.players, playersB: teamB.players,
    overs, tossWinner: "A", elected: "bat"
  });
  m.id = id;
  m.created = date;

  let s = prngSeed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const wkTypes = ["bowled", "caught", "caught", "lbw", "run-out", "stumped"];
  function playInnings(match, batPlayers, bowlPlayers, aggression) {
    Cricket.startInnings(match, batPlayers[0], batPlayers[1], bowlPlayers[bowlPlayers.length - 1]);
    let bowlerIdx = bowlPlayers.length - 1;
    let legal = 0;
    while (true) {
      const d = Cricket.derive(match, match.innings.length - 1);
      if (d.allOut || d.oversUp || (match.innings.length === 2 && d.runs >= Cricket.target(match))) break;
      if (d.legal > 0 && d.legal % 6 === 0 && legal !== d.legal) {
        legal = d.legal;
        let ni = Math.floor(rnd() * (bowlPlayers.length - 1));
        if (bowlPlayers[ni] === d.lastBowler) ni = (ni + 1) % (bowlPlayers.length - 1);
        bowlerIdx = ni;
        match.innings[match.innings.length - 1].currentBowler = bowlPlayers[bowlerIdx];
      }
      const inn = match.innings[match.innings.length - 1];
      const r = rnd();
      let del;
      if (r < 0.055) del = { type: "wd", batRuns: 0, extraRuns: rnd() < 0.2 ? 1 : 0, bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.085) del = { type: "nb", batRuns: rnd() < 0.3 ? 1 : 0, bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.11) del = { type: "bye", batRuns: 1 + (rnd() < 0.2 ? 1 : 0), bowler: inn.currentBowler, striker: d.striker };
      else if (r < 0.11 + (0.055 * aggression)) {
        const who = d.striker;
        del = { type: "run", batRuns: 0, bowler: inn.currentBowler, striker: d.striker, wk: { how: pick(wkTypes), who } };
      } else {
        const weights = [0.34, 0.26, 0.08, 0.01, 0.105, 0.01, 0.085 * aggression];
        let cum = 0, choice = 0;
        const rr = rnd();
        const totalW = weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < weights.length; i++) { cum += weights[i] / totalW; if (rr <= cum) { choice = i; break; } }
        del = { type: "run", batRuns: choice, bowler: inn.currentBowler, striker: d.striker };
      }
      Cricket.addDelivery(match, del);
      if (match.status === "done") break;
    }
    match.innings[match.innings.length - 1].complete = true;
  }

  playInnings(m, teamA.players, teamB.players, aggA);
  if (m.status !== "done") {
    playInnings(m, teamB.players, teamA.players, aggB);
  }
  Cricket.checkResult(m);
  return m;
}

function buildSeedMatches() {
  const tusker = { name: "Tusker XI", players: ["Arjun Nair", "Dev Patel", "Kiran Rao", "Varun Desai", "Rohit Menon", "Sanjay Iyer", "Vikram Joshi", "Nikhil Das", "Farhan Ali", "Omkar Patil", "Manav Shah"] };
  const kestrel = { name: "Kestrel XI", players: ["Rahul Verma", "Ishaan Gupta", "Zaid Khan", "Pranav Hegde", "Arnav Singh", "Karthik R", "Dhruv Malhotra", "Sameer Khan", "Yash Thakur", "Abhay Nair", "Ritvik Sen"] };
  const riverdale = { name: "Riverdale CC", players: ["Adarsh Pillai", "Siddharth Rao", "Gaurav Singh", "Harsh Vardhan", "Jay Mehta", "Kunal Bose", "Lokesh Reddy", "Mihir Joshi", "Nitin Sharma", "Parth Trivedi", "Rakesh Naidu"] };
  const northgate = { name: "Northgate XI", players: ["Aryan Kapoor", "Bhavesh Solanki", "Chirag Menon", "Deepak Yadav", "Eshan Ali", "Farid Sheikh", "Gopal Krishnan", "Hemant Rane", "Imran Qureshi", "Jatin Arora", "Kshitij Bhat"] };
  const sunday = { name: "Sunday Kings", players: ["Akhil Suri", "Bharat Chawla", "Chetan Gowda", "Dinesh Pillai", "Feroz Ahmed", "Girish Kamat", "Harish Babu", "Irfan Sheikh", "Jitendra Pal", "Kapil Rathi", "Lalit Mohan"] };

  return [
    simulateMatch({ id: "match-tusker-kestrel-0920", date: "2026-09-20T17:30:00+05:30", overs: 8, teamA: tusker, teamB: kestrel, prngSeed: 42, aggA: 0.9, aggB: 1.0 }),
    simulateMatch({ id: "match-riverdale-northgate-0913", date: "2026-09-13T16:00:00+05:30", overs: 10, teamA: riverdale, teamB: northgate, prngSeed: 137, aggA: 0.85, aggB: 0.95 }),
    simulateMatch({ id: "match-kestrel-sunday-0906", date: "2026-09-06T17:00:00+05:30", overs: 8, teamA: kestrel, teamB: sunday, prngSeed: 271, aggA: 1.0, aggB: 0.8 }),
  ];
}
