// Rule-based analysis written from the logs. Plain sentences; no numbers invented.
import * as E from './scoring.js';
import * as S from './stats.js';

const pct = v => Math.round(v * 100) + '%';
const f3 = S.fmt3;

export function playerAnalysis(games, player, roster) {
  const finals = games.filter(g => g.status === 'final').sort((a, b) => a.date - b.date);
  const s = S.batting(finals, player.id);
  const out = { strengths: [], trends: [], contribution: [], note: '' };
  if (!s.pa) { out.note = `${player.name} has no plate appearances in completed games yet.`; return out; }
  const team = S.teamBatting(finals);
  // Contribution
  const teamRuns = finals.reduce((a, g) => a + g.score.us, 0);
  const teamRbi = finals.reduce((a, g) => a + g.log.filter(l => S.usLog(g, l)).reduce((b, l) => b + (l.rbi || 0), 0), 0);
  const first = player.name.trim().split(/\s+/)[0];
  out.contribution.push(s.avg >= .4 ? `Somebody check ${first}'s bat for a motor. ${s.h} hits in ${s.ab} trips over ${s.games} games — a ${f3(s.avg)} average, ${f3(s.obp)} on-base. Opposing pitchers are filing complaints.` : s.avg >= .3 ? `${first} just keeps showing up with a lunch pail: ${s.h} hits in ${s.ab} at-bats across ${s.games} games. ${f3(s.avg)} / ${f3(s.obp)} / ${f3(s.slg)}. Not flashy, just dependable — the good kind of boring.` : `Rough patch alert: ${s.h} hits in ${s.ab} at-bats over ${s.games} games (${f3(s.avg)}). The swing's fine, the baseball gods just owe ${first} a few. They always pay up.`);
  if (teamRbi) out.contribution.push(s.rbi / teamRbi >= .15 ? `${s.rbi} RBI — ${pct(s.rbi / teamRbi)} of everything the Chromies have driven in. Runners on base see ${first} coming up and start stretching.` : s.rbi ? `${s.rbi} runs driven in, ${pct(s.rbi / teamRbi)} of the team's haul. Pulling the wagon.` : `Still hunting that first RBI. It's out there. Somewhere. Probably hiding in left-center.`);
  if (s.r) out.contribution.push(`Touched home ${s.r} time${s.r === 1 ? '' : 's'}${teamRuns ? ` — ${pct(s.r / teamRuns)} of the Chromies' runs have ${first}'s cleat marks on them` : ''}. Somebody get the plate a new coat of paint.`);
  const ranked = roster.map(p => ({ p, s: S.batting(finals, p.id) })).filter(x => x.s.ab >= 5).sort((a, b) => b.s.avg - a.s.avg);
  const rank = ranked.findIndex(x => x.p.id === player.id);
  if (rank >= 0) out.contribution.push(rank === 0 ? `Top of the roster in batting average. King of the dugout, at least until next week.` : rank < 3 ? `Number ${rank + 1} on the team in average. Top-of-the-order stuff — the leadoff spot is calling.` : rank >= ranked.length - 2 ? `Sitting ${rank + 1} of ${ranked.length} in average. Plenty of runway, and the only direction from here is up.` : `Smack in the middle of the pack, ${rank + 1} of ${ranked.length}. Solidly, proudly average — every team needs the glue.`);
  // Strengths / weaknesses
  if (s.avg >= team.avg + .05) out.strengths.push(`Lapping the field: ${f3(s.avg)} against the team's ${f3(team.avg)}. Doing more than a fair share and making it look easy.`);
  else if (s.avg <= team.avg - .05) out.strengths.push(`Trailing the team's ${f3(team.avg)} pace at ${f3(s.avg)}. Overdue for a heater — buy a lottery ticket the same day.`);
  else out.strengths.push(`Marching right in step with the team at ${f3(s.avg)}. Textbook.`);
  const xbh = s.b2 + s.b3 + s.hr;
  if (s.h && xbh / s.h >= .4) out.strengths.push(`Thunder in the bat: ${xbh} of ${s.h} hits went for extra bases${s.hr ? ` and ${s.hr} left the premises entirely` : ''}. Outfielders, back up. No, further.`);
  else if (s.h && xbh === 0) out.strengths.push(`Death by a thousand singles — all ${s.h} hits were base knocks. Finds grass, keeps the line moving, drives the other team nuts.`);
  const kRate = s.k / s.pa, bbRate = (s.bb + s.hbp) / s.pa;
  if (kRate >= .2) out.strengths.push(`About those strikeouts: ${pct(kRate)} of trips end in a K. It's slowpitch — the ball is basically asking to be hit.`);
  else if (kRate <= .05) out.strengths.push(`Practically allergic to strikeouts (${s.k} in ${s.pa} trips). Puts everything in play and lets the defense sweat.`);
  if (bbRate >= .15) out.strengths.push(`Eagle eyes: on base by walk or HBP ${pct(bbRate)} of the time. Won't chase a thing — the umpire could use the help.`);
  if (s.bip >= 8) {
    const side = s.pull >= .5 && s.pull > s.oppo + .1 ? `pulls the ball (${pct(s.pull)} to the left side)` : s.oppo >= .4 && s.oppo > s.pull + .1 ? `goes the other way (${pct(s.oppo)} to right)` : `sprays the field (${pct(s.pull)} left, ${pct(s.center)} center, ${pct(s.oppo)} right)`;
    out.strengths.push(`Scouting report on ${first}: ${side}. Shade accordingly, if you dare.`);
    const c = s.contact, tot = Object.values(c).reduce((a, b) => a + b, 0) || 1;
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    const names = { GB: 'ground balls', FB: 'fly balls', LD: 'line drives', PU: 'pop-ups' };
    if (top[1] / tot >= .4) out.strengths.push(`${pct(top[1] / tot)} of balls in play are ${names[top[0]]}${top[0] === 'GB' ? ' — lives on the ground, so it comes down to the infield gloves' : top[0] === 'FB' ? ' — lifts it, so the outfield has to be honest' : top[0] === 'LD' ? ' — squares it up. That is the hardest contact you can ask for' : ' — too many balls straight up. Needs to get under it less'}.`);
    const hitsByZone = { L: [0, 0], C: [0, 0], R: [0, 0] };
    for (const p of s.spray) { const z = p.x < 44 ? 'L' : p.x > 56 ? 'R' : 'C'; hitsByZone[z][1]++; if (p.hit) hitsByZone[z][0]++; }
    const best = Object.entries(hitsByZone).filter(([, v]) => v[1] >= 3).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1])[0];
    if (best) out.strengths.push(`Happy place: ${{ L: 'left', C: 'center', R: 'right' }[best[0]]} field, where ${best[1][0]} of ${best[1][1]} balls found grass. The outfielder over there is tired of ${first}.`);
  }
  const f = S.fielding(finals, player.pos);
  if (!['EH', 'UT'].includes(player.pos)) {
    const chances = f.PO + f.A + f.E;
    if (chances) out.strengths.push(f.E === 0 ? `Human vacuum at ${player.pos}: ${f.PO} putouts, ${f.A} assists, zero errors. Nothing gets through.` : (f.PO + f.A) / chances >= .9 ? `Sure hands at ${player.pos} — ${f.PO} putouts, ${f.A} assists, and just ${f.E} hiccup${f.E === 1 ? '' : 's'}.` : `${f.E} error${f.E === 1 ? '' : 's'} at ${player.pos} against ${f.PO + f.A} plays made. The glove's in a slump too — happens to the best of us.`);
  }
  // Trends: first half vs second half, last 3 games, streaks
  if (finals.length >= 4) {
    const mid = Math.floor(finals.length / 2);
    const a = S.batting(finals.slice(0, mid), player.id), b = S.batting(finals.slice(mid), player.id);
    if (a.ab >= 4 && b.ab >= 4) {
      const d = b.avg - a.avg;
      out.trends.push(d >= .075 ? `Somebody's cooking: ${f3(a.avg)} through the first ${mid} games, ${f3(b.avg)} since. Do not, under any circumstances, change the pregame snack.` : d <= -.075 ? `The bat's gone a little quiet — ${f3(a.avg)} early, ${f3(b.avg)} lately. Pitchers figured something out; ${first}'s turn to figure it back.` : `Steady as a metronome: ${f3(a.avg)} early, ${f3(b.avg)} late. You could set your watch by it.`);
    }
  }
  const last3 = finals.slice(-3);
  if (last3.length === 3) { const l = S.batting(last3, player.id); if (l.ab) out.trends.push(`Last three games: ${l.h}-for-${l.ab}${l.rbi ? ` with ${l.rbi} RBI` : ''}${l.bb ? ` and ${l.bb} walk${l.bb === 1 ? '' : 's'}` : ''}${l.h / l.ab >= .4 ? '. Absolutely dialed in.' : l.h === 0 ? '. Still looking for the keys.' : '. Ticking along.'}`); }
  let streak = 0; for (let i = finals.length - 1; i >= 0; i--) { const t = S.batting([finals[i]], player.id); if (!t.pa) continue; if (t.h) streak++; else break; }
  if (streak >= 3) out.trends.push(`${streak}-game hitting streak and counting. Same socks, same parking spot, nobody talk about it.`);
  else if (streak === 0 && s.games >= 2) { let dry = 0; for (let i = finals.length - 1; i >= 0; i--) { const t = S.batting([finals[i]], player.id); if (!t.pa) continue; if (!t.h) dry++; else break; } if (dry >= 2) out.trends.push(`Hitless the last ${dry} games. Slumps are like Mondays — nobody likes them and they always end.`); }
  const withRunners = [], withoutRunners = [];
  for (const g of finals) for (const l of g.log) if (S.usLog(g, l) && l.batter === player.id && !['BB', 'HBP', 'SF'].includes(l.outcome)) ((l.basesBefore || []).some(Boolean) ? withRunners : withoutRunners).push(S.HITS.has(l.outcome) ? 1 : 0);
  if (withRunners.length >= 5 && withoutRunners.length >= 5) {
    const a = withRunners.reduce((x, y) => x + y, 0) / withRunners.length, b = withoutRunners.reduce((x, y) => x + y, 0) / withoutRunners.length;
    if (a - b >= .1) out.trends.push(`Big-moment player: ${f3(a)} with runners on versus ${f3(b)} with the bases empty. Turn the lights up and ${first} turns it up too.`);
    else if (b - a >= .1) out.trends.push(`Loves an empty diamond — ${f3(b)} with nobody on, ${f3(a)} with traffic. Just pretend the runners are cones.`);
  }
  return out;
}

export function gameAnalysis(g, roster, allGames) {
  const name = id => { const p = roster.find(p => p.id === id); return (p ? p.name : String(id || '')).trim(); };
  const out = { headline: '', summary: [], turning: [], performers: [], defense: [] };
  const plays = g.log.filter(l => !l.manager && !l.scoreOnly);
  const w = g.score.us > g.score.them ? 'win' : g.score.us < g.score.them ? 'loss' : 'tie';
  const margin = Math.abs(g.score.us - g.score.them);
  const line = S.lineScore(g);
  out.headline = g.status !== 'final' ? `Chromies ${g.score.us}, ${g.opp} ${g.score.them} — and we are still playing, folks. Grab a snack.` : w === 'tie' ? `Kissing your cousin: Chromies and ${g.opp} split it ${g.score.us}–${g.score.them}. Everybody goes home mildly unsatisfied.` : w === 'win' ? (margin >= 6 ? `Chromies turn it into a parade, ${g.score.us}–${g.score.them} over ${g.opp}. The only suspense was the postgame snack order.` : margin <= 2 ? `Heart medication, please. Chromies squeak past ${g.opp} ${g.score.us}–${g.score.them}.` : `Chromies handle their business, ${g.score.us}–${g.score.them} over ${g.opp}. Nice and tidy.`) : (margin >= 6 ? `Well. That happened. ${g.opp} take the Chromies to the woodshed, ${g.score.them}–${g.score.us}. Burn the tape.` : margin <= 2 ? `Oof. ${g.opp} slip past the Chromies ${g.score.them}–${g.score.us}. One bounce the other way and we're singing a different tune.` : `${g.opp} got the better of it, ${g.score.them}–${g.score.us}. Shake it off — there's always next week.`);
  // Runs by inning narrative
  const usInn = line.us.map(c => Number(c.v) || 0), themInn = line.them.map(c => Number(c.v) || 0);
  const big = usInn.map((r, i) => [r, i + 1]).filter(([r]) => r >= 3).sort((a, b) => b[0] - a[0])[0];
  if (big) out.turning.push(`The ${E.ordinal(big[1])} was the party inning — ${big[0]} runs came across and the dugout ran out of high-fives.`);
  const bigThem = themInn.map((r, i) => [r, i + 1]).filter(([r]) => r >= 3).sort((a, b) => b[0] - a[0])[0];
  if (bigThem) out.turning.push(`${g.opp} had their own ${bigThem[0]}-run ${E.ordinal(bigThem[1])}. We don't talk about the ${E.ordinal(bigThem[1])}.`);
  let lead = 0, changes = 0, us = 0, them = 0;
  for (const k of line.innings) { us += usInn[k - 1]; them += themInn[k - 1]; const l = Math.sign(us - them); if (l !== 0 && l !== lead && lead !== 0) changes++; if (l !== 0) lead = l; }
  if (changes >= 2) out.turning.push(`A proper seesaw — the lead changed hands ${changes} times. Scorekeeper needed a second pencil.`);
  else if (changes === 0 && g.status === 'final' && w !== 'tie') out.turning.push(w === 'win' ? 'Wire to wire. Chromies scored first, never looked back, barely looked sideways.' : `${g.opp} scored first and the Chromies spent the whole game chasing the bus.`);
  const usPlays = plays.filter(l => S.usLog(g, l)), themPlays = plays.filter(l => S.themLog(g, l));
  const hits = usPlays.filter(l => S.HITS.has(l.outcome)), xbh = hits.filter(l => l.outcome !== '1B');
  const bb = usPlays.filter(l => ['BB', 'HBP'].includes(l.outcome)).length, k = usPlays.filter(l => l.outcome === 'K').length;
  const hr = xbh.filter(l => l.outcome === 'HR').length;
  out.summary.push(`${hits.length >= 12 ? 'The bats were loud enough to wake the neighbors: ' : hits.length <= 5 ? 'Library-quiet at the plate — ' : ''}${hits.length} hits${xbh.length ? `, ${xbh.length} of them for extra bases${hr ? ` and ${hr} that needed a passport` : ''}` : ''}, ${bb} walk${bb === 1 ? '' : 's'} and ${k} strikeout${k === 1 ? '' : 's'} in ${usPlays.length} trips.`);
  let lob = 0; { let cur = null, lastBases = null; for (const l of g.log) { if (l.manager || l.scoreOnly) continue; const key = l.inning + l.half; if (key !== cur) { if (cur && lastBases && lastBases.us) lob += lastBases.b.filter(Boolean).length; cur = key; } lastBases = { b: l.basesAfter || [], us: S.usLog(g, l) }; } if (lastBases && lastBases.us && (g.status === 'final' || (g.inning + g.half) !== cur)) lob += lastBases.b.filter(Boolean).length; } if (lob >= 6) out.summary.push(`${lob} runners left stranded — enough to start their own team. That's the number that keeps the manager up tonight.`); else if (lob) out.summary.push(`Only ${lob} left on base. Efficient. Tidy. Chef's kiss.`);
  const rispAb = usPlays.filter(l => (l.basesBefore || []).slice(1).some(Boolean) && !['BB', 'HBP', 'SF'].includes(l.outcome));
  if (rispAb.length >= 4) { const h = rispAb.filter(l => S.HITS.has(l.outcome)).length; out.summary.push(h / rispAb.length >= .4 ? `${h}-for-${rispAb.length} with runners in scoring position. When the money was on the table, the Chromies took it.` : h === 0 ? `0-for-${rispAb.length} with runners in scoring position. The chances were there; the hits were, uh, elsewhere.` : `${h}-for-${rispAb.length} with runners in scoring position. Some you cash, some you don't.`); }
  if (allGames) { const finals = allGames.filter(x => x.status === 'final' && x.id !== g.id); if (finals.length >= 2) { const t = S.teamBatting(finals); const tg = S.teamBatting([g]); out.summary.push(tg.avg >= t.avg + .05 ? `Hit ${f3(tg.avg)} as a team against a ${f3(t.avg)} season pace. Everybody ate, and there were leftovers.` : tg.avg <= t.avg - .05 ? `${f3(tg.avg)} as a team, well under the ${f3(t.avg)} season pace. Credit their defense, or blame the sun, the wind, and the bats.` : `${f3(tg.avg)} as a team — right on the season's ${f3(t.avg)} pace. Business as usual.`); } }
  // Performers
  const top = S.topPerformers(g);
  for (const [i, p] of top.entries()) { const bits = [`${p.h}-for-${p.ab}`]; if (p.b2 + p.b3 + p.hr) bits.push([p.b2 ? p.b2 + ' 2B' : '', p.b3 ? p.b3 + ' 3B' : '', p.hr ? p.hr + ' HR' : ''].filter(Boolean).join(', ')); if (p.rbi) bits.push(`${p.rbi} RBI`); if (p.bb) bits.push(`${p.bb} BB`); if (p.r) bits.push(`${p.r} R`); out.performers.push(`${i === 0 ? 'Player of the game, hands down — ' : i === 1 ? 'Honorable mention: ' : 'And a tip of the cap to '}${name(p.name)}: ${bits.join(', ')}.`); }
  const quiet = g.lineup.map(id => ({ id, s: S.batting([g], id) })).filter(x => x.s.ab >= 3 && !x.s.h && !x.s.bb);
  if (quiet.length) out.performers.push(`Rough one for ${quiet.map(x => name(x.id)).join(', ')} — nothing fell in. The bats get a good night's sleep and try again.`);
  // Defense
  const errs = themPlays.filter(l => l.outcome === 'E');
  if (errs.length) { const by = {}; for (const l of errs) by[l.fielder || '?'] = (by[l.fielder || '?'] || 0) + 1; out.defense.push(`${errs.length >= 3 ? 'The gloves went on strike: ' : 'A little butterfingers — '}${errs.length} error${errs.length === 1 ? '' : 's'} charged (${Object.entries(by).map(([p, n]) => `${p} ${n}`).join(', ')}).`); }
  else if (themPlays.length) out.defense.push('Flawless in the field. Not one error — the gloves deserve a round of applause and possibly a parade.');
  const outsByPos = {}; for (const l of themPlays) if (l.attr) for (const [k2, p] of Object.entries(l.attr)) if (k2 !== 'E') outsByPos[p] = (outsByPos[p] || 0) + 1;
  const busiest = Object.entries(outsByPos).sort((a, b) => b[1] - a[1])[0];
  if (busiest && busiest[1] >= 4) { const who = roster.find(p => p.pos === busiest[0]); out.defense.push(`${who ? who.name.trim() + ' at ' : ''}${busiest[0]} was everywhere — ${busiest[1]} putouts and assists. Might need a nap.`); }
  const themHits = themPlays.filter(l => S.HITS.has(l.outcome) && l.fieldX != null);
  if (themHits.length >= 4) { const z = { left: 0, center: 0, right: 0 }; for (const l of themHits) z[l.fieldX < 44 ? 'left' : l.fieldX > 56 ? 'right' : 'center']++; const top2 = Object.entries(z).sort((a, b) => b[1] - a[1])[0]; if (top2[1] / themHits.length >= .5) out.defense.push(`${g.opp} kept finding ${top2[0]} field — ${top2[1]} of their ${themHits.length} hits landed there. Maybe put a lawn chair out there next time.`); }
  const dp = themPlays.filter(l => l.outcome === 'DP').length; if (dp) out.defense.push(`Turned ${dp} double play${dp === 1 ? '' : 's'} — two outs for the price of one. Best deal in town.`);
  return out;
}

export function playerGameAnalysis(g, player, allGames) {
  const first = player.name.trim().split(/\s+/)[0];
  const t = S.batting([g], player.id);
  const out = { headline: '', lines: [] };
  if (!t.pa) { out.headline = `${first} rode the pine this one — no plate appearances. Best seat in the house, though.`; return out; }
  const line = `${t.h}-for-${t.ab}${t.rbi ? `, ${t.rbi} RBI` : ''}${t.bb ? `, ${t.bb} BB` : ''}${t.r ? `, ${t.r} R` : ''}`;
  const xbh = t.b2 + t.b3 + t.hr;
  out.headline = t.ab && t.h === t.ab && t.ab >= 2 ? `Perfect night! ${first} goes ${line} against ${g.opp}. Frame it.` : t.h >= 3 ? `${first} was seeing beach balls: ${line} against ${g.opp}.` : t.hr ? `${first} sent one into orbit. ${line} against ${g.opp}.` : t.h === 0 && t.bb === 0 ? `One for the shredder — ${first} finishes ${line} against ${g.opp}. Tomorrow's a new day.` : t.h === 0 ? `No hits, but ${first} still found a way on: ${line} against ${g.opp}. Sneaky.` : `${first} punches the clock: ${line} against ${g.opp}.`;
  const pas = g.log.filter(l => S.usLog(g, l) && l.batter === player.id);
  const seq = pas.map(l => E.LABEL[l.outcome] + (l.fielder && !['1B','2B','3B','HR'].includes(l.outcome) ? ' to ' + l.fielder : l.fielder ? ' to ' + l.fielder : ''));
  out.lines.push(`Trip by trip: ${seq.join(' → ')}.`);
  if (xbh) out.lines.push(`${xbh} extra-base hit${xbh === 1 ? '' : 's'}${t.hr ? ` including ${t.hr} home run${t.hr === 1 ? '' : 's'}` : ''}. Somebody owes the outfield an apology.`);
  if (t.rbi >= 3) out.lines.push(`${t.rbi} runs driven in. ${first} was running a taxi service to home plate.`);
  else if (t.rbi) out.lines.push(`Drove in ${t.rbi}. Gets the job done.`);
  const rispAb = pas.filter(l => (l.basesBefore || []).slice(1).some(Boolean) && !['BB','HBP','SF'].includes(l.outcome));
  if (rispAb.length) { const h = rispAb.filter(l => S.HITS.has(l.outcome)).length; out.lines.push(h === rispAb.length ? `${h}-for-${rispAb.length} with runners in scoring position. Ice in the veins.` : h ? `${h}-for-${rispAb.length} with runners in scoring position. Not bad, not bad at all.` : `0-for-${rispAb.length} with runners in scoring position — the ones that got away. They always do, eventually.`); }
  if (t.k >= 2) out.lines.push(`${t.k} strikeouts. In slowpitch. We're not going to dwell on it. (We're dwelling on it a little.)`);
  const bip = t.spray; if (bip.length >= 2) { const zones = { L: 0, C: 0, R: 0 }; for (const p of bip) zones[p.x < 44 ? 'L' : p.x > 56 ? 'R' : 'C']++; const top = Object.entries(zones).sort((a, b) => b[1] - a[1])[0]; if (top[1] === bip.length) out.lines.push(`Every ball in play went to ${{ L: 'left', C: 'center', R: 'right' }[top[0]]} field. ${g.opp} could have shaded over and didn't. Their loss, literally.`); }
  const flds = Object.entries(t.contact).filter(([, v]) => v).sort((a, b) => b[1] - a[1])[0];
  if (flds && bip.length >= 3 && flds[1] === bip.length) out.lines.push({ GB: 'Everything on the ground tonight — a worm-burner special.', FB: 'Lifted everything. The outfield got its cardio in.', LD: 'Line drives all night. Frozen ropes. Hard, square, beautiful contact.', PU: 'Under the ball all game — pop-ups galore. The infield thanks you for the easy work.' }[flds[0]]);
  const fin = (allGames || []).filter(x => x.status === 'final'); if (fin.length >= 3) { const s = S.batting(fin, player.id); if (s.ab >= 8) out.lines.push(t.ab && t.h / t.ab >= s.avg + .15 ? `Way above the ${f3(s.avg)} season clip. One of ${first}'s best nights — circle it on the calendar.` : t.ab && t.h / t.ab <= s.avg - .15 ? `Below the ${f3(s.avg)} season average. An off night, not a trend. Blame the lighting.` : `Right around the ${f3(s.avg)} season average — ${first} being ${first}. Comfortingly predictable.`); }
  if (!['EH', 'UT'].includes(player.pos)) { const f = { PO: 0, A: 0, E: 0 }; for (const l of g.log) if (S.themLog(g, l) && l.attr) for (const k of Object.keys(l.attr)) if (l.attr[k] === player.pos && f[k] != null) f[k]++; const ch = f.PO + f.A + f.E; if (ch) out.lines.push(f.E ? `In the field at ${player.pos}: ${f.PO + f.A} plays made, ${f.E} error${f.E === 1 ? '' : 's'}. The glove had a moment.` : `Clean sheet at ${player.pos}: ${f.PO + f.A} plays, zero errors. Glove of the night.`); }
  return out;
}
