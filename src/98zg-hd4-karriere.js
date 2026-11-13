  // =========================================================================
  // Hybrid Dash 4.0: CAREER MODE in the GT World Challenge format
  // =========================================================================
  //
  // THE FORMAT (what is taken from the real series):
  //
  //   SPRINT CUP round     Qualifying 1 -> Race 1 -> Qualifying 2 -> Race 2. Each race is one
  //                        hour with ONE mandatory pit stop inside the pit window in the middle
  //                        of the race (minutes 25 to 35). Points per race
  //                        16.5 - 12 - 9.5 - 7.5 - 6 - 4.5 - 3 - 2 - 1 - 0.5, one point for pole.
  //   ENDURANCE CUP round  Qualifying -> one race of 3 hours (or 6, or the 24 Hours). A stint
  //                        may last 65 minutes at most, which makes two mandatory stops in a
  //                        3-hour race. Points 25 - 18 - 15 - 12 - 10 - 8 - 6 - 4 - 2 - 1 (a 6-hour
  //                        race 33 - 24 - 19 - 15 - 12 - 9 - 6 - 4 - 2 - 1; the 24 Hours also pays
  //                        12 - 9 - 7 - 6 - 5 - 4 - 3 - 2 - 1 at a quarter and at half distance),
  //                        one point for pole.
  //   ROLLING STARTS       every race.
  //   THREE TITLES         Overall, Sprint Cup and Endurance Cup.
  //   LICENCES             Bronze, Silver, Gold, Pro - the player's grade; it sets how strong the
  //                        AI field drives and is earned by results.
  //
  // WHAT THE PLAYER DECIDES: the calendar - how many rounds, which type each one is, and which
  // of his own tracks (saved layouts or the one in the editor) hosts it - and the race length
  // (how many real minutes one race hour takes).
  //
  // THE PROGRESSION LOOP: sessions pay XP (driver level), prize money (team upgrades) and
  // licence points (promotion); every round has two sponsor objectives; seasons end with titles
  // and a tougher field. Results also feed the showroom: wins and podiums raise a car's card.

  var HD4_KARRIERE_STORE = 'karriere.v1';
  var HD4_LIZENZ = [
    { id: 'bronze', name: 'Bronze', farbe: '#c98a52', ki: 0.955, text: 'A gentleman-driver field.' },
    { id: 'silber', name: 'Silver', farbe: '#c9d1dc', ki: 0.985, text: 'Young chargers and quick amateurs.' },
    { id: 'gold', name: 'Gold', farbe: '#f5c542', ki: 1.01, text: 'Seasoned professionals.' },
    { id: 'pro', name: 'Pro', farbe: '#ff5a4d', ki: 1.04, text: 'Factory drivers. No gifts.' },
  ];
  var HD4_PUNKTE = {
    sprint: [16.5, 12, 9.5, 7.5, 6, 4.5, 3, 2, 1, 0.5],
    endurance: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],
    endurance6: [33, 24, 19, 15, 12, 9, 6, 4, 2, 1],
    zwischen: [12, 9, 7, 6, 5, 4, 3, 2, 1],
  };
  var HD4_PREISGELD = [12000, 9000, 7500, 6000, 5000, 4200, 3500, 3000, 2500, 2000];
  var HD4_ORTE = ['Paul Ricard', 'Brands Hatch', 'Monza', 'Misano', 'Spa-Francorchamps', 'Hockenheim', 'Nürburgring', 'Magny-Cours', 'Valencia', 'Barcelona'];
  var HD4_SAISON_VOLL = [['endurance', 3], ['sprint', 1], ['endurance', 3], ['sprint', 1], ['endurance', 24], ['sprint', 1], ['endurance', 3], ['sprint', 1], ['sprint', 1], ['endurance', 6]];
  var HD4_SAISON_KURZ = [['sprint', 1], ['endurance', 3], ['sprint', 1], ['endurance', 3]];
  var HD4_UPGRADES = [
    { id: 'crew', name: 'Pit crew', text: 'Stationary pit time −6% per level.' },
    { id: 'sprit', name: 'Fuel efficiency', text: 'Fuel burn −4% per level.' },
    { id: 'reifen', name: 'Tyre programme', text: 'Tyre wear −5% per level.' },
    { id: 'zuverlaessig', name: 'Reliability', text: 'Failures 20% less likely per level.' },
  ];
  var HD4_UPGRADE_PREIS = [15000, 30000, 55000];
  var HD4_ZIELE = {
    podium: { text: 'Finish a race on the podium' },
    sauber: { text: 'Finish a race without an incident' },
    fl: { text: 'Set the fastest lap of a race' },
    pole: { text: 'Take pole position' },
    fenster: { text: 'Serve every mandatory stop without a penalty' },
    aufholen: { text: 'Gain two places from your grid slot' },
  };
  var hd4K = { d: hd4Lesen(HD4_KARRIERE_STORE, null), warten: null, ansicht: 'gesamt', bericht: null };
  function hd4KSpeichern() { hd4Schreiben(HD4_KARRIERE_STORE, hd4K.d); }
  // a session that was running when the app closed is not scored: it is simply open again
  if (hd4K.d && hd4K.d.laeuft) { hd4K.d.laeuft = null; hd4KSpeichern(); }

  // ---- the calendar -------------------------------------------------------------------------
  function hd4KRunde(typ, stunden, i) {
    const sessions = typ === 'sprint'
      ? [{ art: 'quali', name: 'Qualifying 1' }, { art: 'rennen', name: 'Race 1' }, { art: 'quali', name: 'Qualifying 2' }, { art: 'rennen', name: 'Race 2' }]
      : [{ art: 'quali', name: 'Qualifying' }, { art: 'rennen', name: stunden === 24 ? '24 Hours' : stunden + ' Hours' }];
    const pool = Object.keys(HD4_ZIELE);
    const z1 = pool[hd4Hash('z' + i + Date.now()) % pool.length];
    let z2 = pool[hd4Hash('y' + i + Date.now()) % pool.length];
    if (z2 === z1) z2 = pool[(pool.indexOf(z1) + 1) % pool.length];
    return { typ, stunden, ort: HD4_ORTE[i % HD4_ORTE.length], strecke: 'aktuell', wetter: Math.random() < 0.2 ? 'wechsel' : 'dry',
             sessions: sessions.map((s) => Object.assign({ erledigt: false, reihe: null }, s)), ziele: [{ id: z1, erfuellt: false }, { id: z2, erfuellt: false }] };
  }
  function hd4KNeu(name, lang, minProStunde, stufe, saison) {
    const plan = lang === 'voll' ? HD4_SAISON_VOLL : HD4_SAISON_KURZ;
    return { v: 1, fahrer: name || 'Driver', stufe: stufe || 0, xp: 0, credits: 0, lp: 0, saison: saison || 1, minProStunde: minProStunde || 6,
             kalender: plan.map(([typ, st], i) => hd4KRunde(typ, st, i)), idx: 0, tabelle: {}, laeuft: null,
             upgrades: { crew: 0, sprit: 0, reifen: 0, zuverlaessig: 0 }, trophaeen: [], fertig: false, lang };
  }
  function hd4KLevel(xp) { return Math.floor(Math.sqrt(Math.max(0, xp) / 150)) + 1; }
  function hd4KLevelXp(level) { return (level - 1) * (level - 1) * 150; }
  function hd4KMinuten(runde, session) {
    const m = hd4K.d.minProStunde;
    if (session.art === 'quali') return Math.max(2, Math.round(m / 3));
    // the 24 Hours is run compressed: eight "hours" - it stays the longest race of the season
    return Math.max(2, Math.round(m * (runde.stunden === 24 ? 8 : runde.stunden)));
  }
  function hd4KStopps(runde) {
    if (runde.typ === 'sprint') return 1;
    return Math.min(3, runde.stunden === 24 ? 3 : Math.ceil(runde.stunden * 60 / 65) - 1);
  }
  function hd4KNaechste() {
    const d = hd4K.d;
    if (!d || d.fertig) return null;
    const runde = d.kalender[d.idx];
    if (!runde) return null;
    const si = runde.sessions.findIndex((s) => !s.erledigt);
    return si < 0 ? null : { runde, si, session: runde.sessions[si] };
  }
  function hd4KStrecken() {
    let s = {};
    try { s = loadTrackStore(); } catch (e) { s = {}; }
    return Object.keys(s).sort((a, b) => a.localeCompare(b));
  }

  // ---- starting a session -------------------------------------------------------------------
  function hd4KStarten() {
    const d = hd4K.d, n = hd4KNaechste();
    if (!d || !n) return;
    let laeuft = false;
    try { laeuft = kRennenLaeuft(); } catch (e) { laeuft = false; }
    if (laeuft) { hd4Toast('Finish the running race first'); return; }
    const { runde, si, session } = n;
    // the track of this round
    try {
      if (runde.strecke !== 'aktuell') {
        if (hd4KStrecken().indexOf(runde.strecke) >= 0) trackLaden(runde.strecke);
        else hd4Toast('Saved track not found – using the track in the editor');
      }
      meisterBahn(true);
    } catch (e) { /* track stays */ }
    let teile = 0;
    try { teile = currentTrackTiles.length; } catch (e) { teile = 0; }
    if (teile < 4) { hd4Toast('This round needs a track: scan, load or design one first'); return; }
    const minuten = hd4KMinuten(runde, session);
    const rennen = session.art === 'rennen';
    const stopps = rennen ? hd4KStopps(runde) : 0;
    try {
      chSetzen('race-mode', rennen ? 'endurance' : 'qualifying');
      chSetzen('race-limit', minuten);
      if (String(raceLimit) !== String(minuten)) raceLimit = minuten;
      chSetzen('race-wx-start', rennen ? (runde.wetter === 'wechsel' ? 'dry' : runde.wetter) : 'dry');
      chSetzen('race-wx-change', rennen && runde.wetter === 'wechsel');
      chSetzen('race-flying', rennen);                       // rolling starts
      chSetzen('race-pit-required', String(stopps));
    } catch (e) { hd4Toast('Could not apply the race settings'); return; }
    // the grid: the order of the qualifying before this race
    if (rennen) {
      const q = runde.sessions.slice(0, si).reverse().find((s) => s.art === 'quali' && s.reihe);
      try { if (q && q.reihe && q.reihe.length) raceGridOrder = q.reihe.map((x) => x.id).filter((id) => garage.some((c) => hd4AutoId(c) === id)); } catch (e) { /* default grid */ }
    }
    d.laeuft = { idx: d.idx, si, art: session.art, seit: Date.now(), minuten, stopps, typ: runde.typ, stunden: runde.stunden,
                 fensterVon: runde.typ === 'sprint' && rennen ? 25 / 60 : null, fensterBis: runde.typ === 'sprint' && rennen ? 35 / 60 : null,
                 stoppsBei: [], pitVor: 0, zwischen: [], zwischenDone: 0, vorfaelleVor: null, fensterGesagt: 0 };
    hd4KSpeichern();
    // career rules for player 1: licence sets the field's strength, upgrades apply
    hd4Ki.klasse = HD4_LIZENZ[d.stufe].ki + 0.01 * Math.min(3, d.saison - 1);
    hd4SimPlatz(1).upgrades = Object.assign({}, d.upgrades);
    hd4Schliessen();
    hd4Toast('Career · ' + runde.ort + ' · ' + session.name);
    try { konsoleLosfahren(); } catch (e) { hd4Toast('Could not start the session'); }
  }
  function hd4KarriereAktiv() { return !!(hd4K.d && hd4K.d.laeuft); }
  // For the engineer and the cockpit: the sprint pit window.
  function hd4KarriereFenster() {
    const l = hd4K.d && hd4K.d.laeuft;
    if (!l || l.fensterVon === null || !hd4RennenLaeuft()) return null;
    let anteil = 0;
    try { anteil = raceGreenAt ? (rennZeitJetzt() - raceGreenAt) / (l.minuten * 60000) : 0; } catch (e) { anteil = 0; }
    const offen = anteil >= l.fensterVon && anteil <= l.fensterBis;
    const bis = offen ? (l.fensterBis - anteil) * l.minuten * 60 : anteil < l.fensterVon ? (l.fensterVon - anteil) * l.minuten * 60 : 0;
    return { offen, vorbei: anteil > l.fensterBis, anteil, bisS: Math.max(0, bis), bedient: l.stoppsBei.some((a) => a >= l.fensterVon && a <= l.fensterBis) };
  }
  function hd4KarriereHud() {
    const f = hd4KarriereFenster();
    if (!f) return '';
    const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    if (f.bedient) return ' · <b class="hd4-gut">PIT WINDOW SERVED</b>';
    if (f.offen) return ' · <b class="hd4-fenster-offen">PIT WINDOW OPEN ' + mmss(f.bisS) + '</b>';
    if (f.vorbei) return ' · <b class="hd4-schlecht">PIT WINDOW MISSED</b>';
    return ' · pit window opens in ' + mmss(f.bisS);
  }
  // while a career race runs: note every stop of player 1, pay the 24 Hours' intermediate points
  hd4Takt(() => {
    const l = hd4K.d && hd4K.d.laeuft;
    if (!l || !hd4RennenLaeuft() || l.art !== 'rennen') return;
    let anteil = 0, pit = 0;
    try { anteil = raceGreenAt ? (rennZeitJetzt() - raceGreenAt) / (l.minuten * 60000) : 0; pit = racePitDone; } catch (e) { return; }
    if (pit > l.pitVor) { l.stoppsBei.push(anteil); l.pitVor = pit; }
    if (l.fensterVon !== null) {
      const f = hd4KarriereFenster();
      if (f && f.offen && !l.fensterGesagt && typeof hd4Funk === 'function') { l.fensterGesagt = 1; hd4Funk('box', 'The pit window is open. You have until minute thirty-five to make the mandatory stop.', 30, 0); hd4Toast('PIT WINDOW OPEN'); }
      if (f && f.offen && !f.bedient && f.bisS < 20 && l.fensterGesagt < 2 && typeof hd4Funk === 'function') { l.fensterGesagt = 2; hd4Funk('box', 'Pit window closes in twenty seconds. Box now, box now!', 40, 0); }
    }
    if (l.stunden === 24) {
      [0.25, 0.5].forEach((marke, i) => {
        if (anteil >= marke && l.zwischenDone <= i) {
          l.zwischenDone = i + 1;
          const reihe = hd4KKlassieren(false).filter((x) => x.laps > 0);
          l.zwischen.push(reihe.map((x) => x.id));
          hd4Toast((i ? '12' : '6') + '-hour points: ' + (reihe[0] ? reihe[0].name + ' leads' : ''));
        }
      });
    }
  });

  // ---- the result of a session -----------------------------------------------------------------
  function hd4KKlassieren(quali) {
    let feld = [];
    try {
      feld = raceAllCars().map((c) => {
        const ms = (c.laps || []).map((l) => l.ms);
        let total = ms.reduce((a, b) => a + b, 0) + (c.strafeMs || 0);
        let platz = 0;
        try { platz = spielerPlatzVonRolle(c.role); if (platz) total += strafeMsVon(platz); } catch (e) { platz = 0; }
        return { id: c.id || 'spieler', name: c.alias || c.name, farbe: c.farbe, rolle: c.role, laps: ms.length, total, beste: ms.length ? Math.min.apply(null, ms) : Infinity, raus: !!(c.dnf || c.dsq), platz };
      });
    } catch (e) { feld = []; }
    feld.sort((a, b) => (a.raus - b.raus) || (quali ? a.beste - b.beste : (b.laps - a.laps) || (a.total - b.total)));
    return feld;
  }
  // Wait until the NPCs have taken the flag, then call fn (the same patience as the championship).
  function hd4NachZiel(fn) {
    if (hd4K.warten) clearInterval(hd4K.warten);
    const bis = Date.now() + 95000;
    hd4K.warten = setInterval(() => {
      let rollt = false;
      try { rollt = garage.some((c) => c.role === 'ghost' && c.ghost && c.ghost.auslauf); } catch (e) { rollt = false; }
      if (rollt && Date.now() < bis) return;
      clearInterval(hd4K.warten); hd4K.warten = null;
      try { fn(); } catch (e) { try { console.error('Hybrid Dash 4.0 result', e); } catch (e2) { /* none */ } }
    }, 500);
  }
  // Hook from finishRace(): regulaer = the race ran to its end (false = stopped by hand).
  function hd4RennenEnde(regulaer) {
    if (!hd4) return;
    let modus = '';
    try { modus = raceMode; } catch (e) { modus = ''; }
    const quali = modus === 'qualifying';
    const karriere = hd4K.d && hd4K.d.laeuft;
    if (karriere && !regulaer) {
      hd4K.d.laeuft = null; hd4KSpeichern(); hd4KAufraeumen();
      hd4Toast('Career session abandoned – it is not scored. Restart it from the career page.');
      return;
    }
    hd4NachZiel(() => {
      const feld = hd4KKlassieren(quali);
      if (typeof hd4StatErfassen === 'function' && regulaer !== false) { try { hd4StatErfassen(feld, modus); } catch (e) { /* stats */ } }
      if (karriere && hd4K.d && hd4K.d.laeuft) hd4KWerten(feld);
    });
  }
  function hd4KAufraeumen() {
    hd4Ki.klasse = 1;
    hd4SimPlatz(1).upgrades = null;
  }
  function hd4KWerten(feld) {
    const d = hd4K.d, l = d.laeuft;
    const runde = d.kalender[l.idx], session = runde && runde.sessions[l.si];
    d.laeuft = null;
    hd4KAufraeumen();
    if (!runde || !session) { hd4KSpeichern(); return; }
    const quali = l.art === 'quali';
    const ich = feld.find((x) => x.rolle === 'player');
    // sprint: the mandatory stop must be inside the window - otherwise the equivalent of a drive-through
    let fensterStrafe = false;
    if (!quali && l.fensterVon !== null && ich && !l.stoppsBei.some((a) => a >= l.fensterVon && a <= l.fensterBis)) {
      fensterStrafe = true;
      ich.total += 30000;
      feld.sort((a, b) => (a.raus - b.raus) || (b.laps - a.laps) || (a.total - b.total));
    }
    const gewertet = feld.filter((x) => x.laps > 0 && !x.raus);
    session.erledigt = true;
    session.reihe = gewertet.map((x) => ({ id: x.id, name: x.name, beste: Number.isFinite(x.beste) ? Math.round(x.beste) : null, laps: x.laps }));
    feld.forEach((x) => { if (!d.tabelle[x.id]) d.tabelle[x.id] = { name: x.name, farbe: x.farbe, ich: x.rolle === 'player', pkt: 0, sprint: 0, endurance: 0, siege: 0, podien: 0 }; d.tabelle[x.id].name = x.name; if (x.farbe) d.tabelle[x.id].farbe = x.farbe; });
    const bericht = { titel: runde.ort + ' · ' + session.name, zeilen: [], xp: 0, credits: 0, lp: 0, ziele: [], fensterStrafe, quali };
    const pos = ich ? gewertet.indexOf(ich) + 1 : 0;
    const zielErfuellt = (id) => { runde.ziele.forEach((z) => { if (z.id === id && !z.erfuellt) { z.erfuellt = true; bericht.ziele.push(HD4_ZIELE[id].text); bericht.credits += 4000; bericht.xp += 40; } }); };
    if (quali) {
      bericht.xp += 20;
      if (pos === 1) { bericht.xp += 30; zielErfuellt('pole'); }
      gewertet.forEach((x, i) => bericht.zeilen.push({ pos: i + 1, name: x.name, wert: hd4Zeit(x.beste), pkt: '', ich: x === ich }));
    } else {
      const tab = runde.typ === 'sprint' ? HD4_PUNKTE.sprint : runde.stunden === 6 ? HD4_PUNKTE.endurance6 : HD4_PUNKTE.endurance;
      const feldTyp = runde.typ === 'sprint' ? 'sprint' : 'endurance';
      const geben = (id, p) => { const e = d.tabelle[id]; if (e && p) { e.pkt += p; e[feldTyp] += p; } };
      // pole: one point to the winner of the qualifying before this race
      const q = runde.sessions.slice(0, l.si).reverse().find((s) => s.art === 'quali' && s.reihe && s.reihe.length);
      if (q) geben(q.reihe[0].id, 1);
      // the 24 Hours: points at a quarter and at half distance
      (l.zwischen || []).forEach((reihe) => reihe.forEach((id, i) => geben(id, HD4_PUNKTE.zwischen[i] || 0)));
      let fl = null;
      gewertet.forEach((x) => { if (!fl || x.beste < fl.beste) fl = x; });
      gewertet.forEach((x, i) => {
        const p = tab[i] || 0;
        geben(x.id, p);
        const e = d.tabelle[x.id];
        if (i === 0) e.siege++;
        if (i < 3) e.podien++;
        bericht.zeilen.push({ pos: i + 1, name: x.name, wert: x.laps + ' laps' + (x === fl ? ' · fastest lap ' + hd4Zeit(x.beste) : ''), pkt: p + (q && q.reihe[0].id === x.id ? ' +1' : ''), ich: x === ich });
      });
      if (pos) {
        const n = Math.max(2, gewertet.length);
        const mult = runde.typ === 'sprint' ? 1 : runde.stunden === 24 ? 3 : runde.stunden === 6 ? 2.4 : 1.8;
        bericht.xp += 60 + Math.round(100 * (n - pos) / (n - 1)) + (fl === ich ? 25 : 0);
        bericht.credits += Math.round((HD4_PREISGELD[pos - 1] || 1500) * mult);
        bericht.lp += pos === 1 ? 3 : pos === 2 ? 2 : pos === 3 ? 1 : 0;
        if (pos <= 3) zielErfuellt('podium');
        if (fl === ich) zielErfuellt('fl');
        // clean race: nothing recorded against player 1 since the start of this session
        let vorfaelle = 0;
        try { const v = hd4An.vorfaelle[hd4StreckeKey()]; vorfaelle = v ? v.liste.filter((x) => x.w === 'p1' && x.t >= l.seit && x.a !== 'lost').length : 0; } catch (e) { vorfaelle = 0; }
        if (!vorfaelle) { bericht.xp += 30; bericht.lp += 1; zielErfuellt('sauber'); }
        let strafe = 0;
        try { strafe = strafeMsVon(1) + (hdStrafeMs(ich.id) || 0); } catch (e) { strafe = 0; }
        if (!strafe && !fensterStrafe && l.stopps > 0) zielErfuellt('fenster');
        const start = q ? q.reihe.findIndex((x) => x.id === ich.id) + 1 : 0;
        if (start && start - pos >= 2) zielErfuellt('aufholen');
        if (pos === 1) d.trophaeen.push({ saison: d.saison, text: 'Winner · ' + runde.ort + ' · ' + session.name });
      }
    }
    bericht.xp = Math.round(bericht.xp * (1 + 0.25 * d.stufe));
    const levelVor = hd4KLevel(d.xp);
    d.xp += bericht.xp; d.credits += bericht.credits; d.lp += bericht.lp;
    bericht.levelUp = hd4KLevel(d.xp) > levelVor ? hd4KLevel(d.xp) : 0;
    // promotion between rounds: twelve licence points
    if (d.lp >= 12 && d.stufe < HD4_LIZENZ.length - 1) { d.stufe++; d.lp = 0; bericht.aufstieg = HD4_LIZENZ[d.stufe].name; d.trophaeen.push({ saison: d.saison, text: HD4_LIZENZ[d.stufe].name + ' licence' }); }
    // next round, or the end of the season
    if (runde.sessions.every((s) => s.erledigt)) {
      d.idx++;
      if (d.idx >= d.kalender.length) hd4KSaisonEnde(bericht);
    }
    hd4K.bericht = bericht;
    hd4KSpeichern();
    // after the podium and the race summary had their moment
    setTimeout(() => { if (!hd4RennenLaeuft()) hd4Oeffnen('karriere'); }, 9000);
  }
  function hd4KTabelle(feld) {
    const d = hd4K.d;
    return Object.keys(d.tabelle).map((id) => Object.assign({ id }, d.tabelle[id])).filter((x) => feld === 'pkt' || x[feld] > 0 || x.ich)
      .sort((a, b) => (b[feld] - a[feld]) || (b.siege - a.siege) || (b.podien - a.podien));
  }
  function hd4KSaisonEnde(bericht) {
    const d = hd4K.d;
    d.fertig = true;
    const titel = [];
    [['pkt', 'Overall'], ['sprint', 'Sprint Cup'], ['endurance', 'Endurance Cup']].forEach(([feld, name]) => {
      const t = hd4KTabelle(feld);
      if (!t.length || !(t[0][feld] > 0)) return;
      const platz = t.findIndex((x) => x.ich) + 1;
      if (platz === 1) { titel.push(name + ' champion'); d.trophaeen.push({ saison: d.saison, text: name + ' champion · season ' + d.saison, titel: true }); d.credits += 40000; d.xp += 300; }
      else if (platz && platz <= 3 && feld === 'pkt') { titel.push('P' + platz + ' overall'); d.credits += 15000; d.xp += 120; }
    });
    const gesamt = hd4KTabelle('pkt').findIndex((x) => x.ich) + 1;
    if (gesamt && gesamt <= 3 && d.stufe < HD4_LIZENZ.length - 1 && !bericht.aufstieg) { d.stufe++; d.lp = 0; bericht.aufstieg = HD4_LIZENZ[d.stufe].name; d.trophaeen.push({ saison: d.saison, text: HD4_LIZENZ[d.stufe].name + ' licence' }); }
    bericht.saison = { titel, gesamt };
  }
  function hd4KNeueSaison() {
    const alt = hd4K.d;
    const neu = hd4KNeu(alt.fahrer, alt.lang, alt.minProStunde, alt.stufe, alt.saison + 1);
    Object.assign(neu, { xp: alt.xp, credits: alt.credits, lp: alt.lp, upgrades: alt.upgrades, trophaeen: alt.trophaeen });
    // the tracks the player chose stay with their rounds
    neu.kalender.forEach((r, i) => { if (alt.kalender[i]) { r.strecke = alt.kalender[i].strecke; r.ort = alt.kalender[i].ort; } });
    hd4K.d = neu; hd4K.bericht = null; hd4KSpeichern();
  }

  // ---- THE CAREER PAGE -------------------------------------------------------------------------
  function hd4KBerichtHtml(b) {
    let h = '<section class="hd4-karte hd4-bericht hd4-breit"><h3>Result · ' + hd4Esc(b.titel) + '</h3><div class="hd4-bericht-raster"><table class="hd4-tab"><tbody>'
      + b.zeilen.slice(0, 12).map((z) => '<tr' + (z.ich ? ' class="hd4-ich"' : '') + '><td>P' + z.pos + '</td><td>' + hd4Esc(z.name) + '</td><td>' + hd4Esc(z.wert) + '</td><td>' + (z.pkt !== '' ? hd4Esc(z.pkt) + ' pts' : '') + '</td></tr>').join('')
      + '</tbody></table><div class="hd4-beute"><div><small>XP</small><b>+' + b.xp + '</b></div><div><small>Prize money</small><b>+' + b.credits.toLocaleString('en-GB') + '</b></div><div><small>Licence points</small><b>+' + b.lp + '</b></div>';
    if (b.levelUp) h += '<p class="hd4-jubel">Driver level ' + b.levelUp + '!</p>';
    if (b.aufstieg) h += '<p class="hd4-jubel">Promoted: ' + hd4Esc(b.aufstieg) + ' licence</p>';
    if (b.fensterStrafe) h += '<p class="hd4-schlecht">No stop inside the pit window: +30 s.</p>';
    b.ziele.forEach((z) => { h += '<p class="hd4-gut">✓ Sponsor objective: ' + hd4Esc(z) + ' (+4,000)</p>'; });
    if (b.saison) h += '<p class="hd4-jubel">Season complete' + (b.saison.titel.length ? ': ' + hd4Esc(b.saison.titel.join(', ')) : b.saison.gesamt ? ': P' + b.saison.gesamt + ' overall' : '') + '</p>';
    return h + '</div></div></section>';
  }
  hd4Schirm({
    id: 'karriere', titel: 'Career', kurz: 'Career', icon: HD4_ICON.karriere,
    zeichnen(host) {
      const d = hd4K.d;
      const formatKarte = hd4Karte('The format', '<ul class="hd4-liste"><li><b>Sprint Cup round:</b> Qualifying 1 → Race 1 → Qualifying 2 → Race 2. One mandatory stop per race inside the pit window (minute 25–35 of 60). 16.5 points for a win.</li>'
        + '<li><b>Endurance Cup round:</b> Qualifying → 3 Hours (also 6 Hours and the 24 Hours). 65-minute maximum stint, so two mandatory stops. 25 points for a win; the 24 Hours also pays points at 6 and 12 hours.</li>'
        + '<li><b>Rolling starts</b>, one point for pole, three titles: Overall, Sprint Cup, Endurance Cup.</li><li><b>Licences:</b> Bronze → Silver → Gold → Pro. Twelve licence points (podiums, clean races) or a top-three season promote you – and the field gets faster.</li></ul>');
      if (!d) {
        host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Career</h2><p>A season in the GT World Challenge format on your own tracks. Start with a Bronze licence and race your way to Pro.</p></div>'
          + '<div class="hd4-raster2">' + hd4Karte('New career', '<label class="hd4-feld hd4-feld-gross">Driver name <input type="text" id="hd4-k-name" maxlength="24" value="" placeholder="Your name" autocomplete="off"></label>'
            + '<div class="hd4-wahl"><span class="hd4-schalter-text"><b>Season</b><small>Full: 5 Sprint and 5 Endurance rounds (incl. 6 Hours and the 24 Hours). Short: 2 + 2.</small></span><span class="hd4-segment" id="hd4-k-lang"><button type="button" data-w="kurz" class="an">Short · 4 rounds</button><button type="button" data-w="voll">Full · 10 rounds</button></span></div>'
            + '<div class="hd4-wahl"><span class="hd4-schalter-text"><b>Race length</b><small>Real minutes per race hour. A sprint race is one hour, an endurance race three.</small></span><span class="hd4-segment" id="hd4-k-min"><button type="button" data-w="4">4 min</button><button type="button" data-w="6" class="an">6 min</button><button type="button" data-w="10">10 min</button><button type="button" data-w="15">15 min</button></span></div>'
            + '<div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-haupt" id="hd4-k-los">Start career</button></div>')
          + formatKarte + '</div></div>';
        const seg = (id) => { const el = host.querySelector(id); el.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { el.querySelectorAll('button').forEach((x) => x.classList.toggle('an', x === b)); })); return () => el.querySelector('button.an').dataset.w; };
        const lang = seg('#hd4-k-lang'), min = seg('#hd4-k-min');
        host.querySelector('#hd4-k-los').addEventListener('click', () => {
          hd4K.d = hd4KNeu(host.querySelector('#hd4-k-name').value.trim() || 'Driver', lang(), Number(min()), 0, 1);
          hd4K.bericht = null; hd4KSpeichern(); hd4Neu();
        });
        return;
      }
      const liz = HD4_LIZENZ[d.stufe], level = hd4KLevel(d.xp);
      const xp0 = hd4KLevelXp(level), xp1 = hd4KLevelXp(level + 1);
      const n = hd4KNaechste();
      const strecken = hd4KStrecken();
      let autos = 0, npcs = 0;
      try { autos = garage.filter((c) => c.device && c.role !== 'none' && c.role !== 'safetycar' && c.role !== 'reinig').length; npcs = garage.filter((c) => c.device && c.role === 'ghost').length; } catch (e) { autos = 0; }
      let h = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Career · Season ' + d.saison + '</h2></div>';
      if (hd4K.bericht) h += hd4KBerichtHtml(hd4K.bericht);
      h += '<div class="hd4-raster2">';
      // driver card
      h += '<section class="hd4-karte hd4-profil" style="--c:' + liz.farbe + '"><div class="hd4-profil-kopf"><span class="hd4-lizenz">' + liz.name.toUpperCase() + '</span><div><b>' + hd4Esc(d.fahrer) + '</b><small>' + liz.text + '</small></div></div>'
        + '<div class="hd4-kennzahlen"><div><small>Driver level</small><b>' + level + '</b></div><div><small>Credits</small><b>' + d.credits.toLocaleString('en-GB') + '</b></div><div><small>Trophies</small><b>' + d.trophaeen.length + '</b></div></div>'
        + '<div class="hd4-fortschritt"><span>XP ' + d.xp + ' / ' + xp1 + '</span><span class="hd4-balken"><span style="width:' + Math.round((d.xp - xp0) / Math.max(1, xp1 - xp0) * 100) + '%"></span></span></div>'
        + (d.stufe < HD4_LIZENZ.length - 1 ? '<div class="hd4-fortschritt"><span>Licence points ' + d.lp + ' / 12 to ' + HD4_LIZENZ[d.stufe + 1].name + '</span><span class="hd4-balken"><span style="width:' + Math.round(Math.min(1, d.lp / 12) * 100) + '%;background:' + HD4_LIZENZ[d.stufe + 1].farbe + '"></span></span></div>' : '<p class="hd4-klein">Top licence reached.</p>')
        + '</section>';
      // next session
      if (n) {
        const { runde, session, si } = n;
        const minuten = hd4KMinuten(runde, session), stopps = session.art === 'rennen' ? hd4KStopps(runde) : 0;
        h += '<section class="hd4-karte hd4-naechste"><h3>Round ' + (d.idx + 1) + ' of ' + d.kalender.length + ' · ' + (runde.typ === 'sprint' ? 'Sprint Cup' : 'Endurance Cup') + '</h3>'
          + '<p class="hd4-ort">' + hd4Esc(runde.ort) + '</p>'
          + '<ol class="hd4-sessions">' + runde.sessions.map((s, i) => '<li class="' + (s.erledigt ? 'fertig' : i === si ? 'jetzt' : '') + '"><span>' + s.name + '</span><small>' + (s.erledigt && s.reihe ? (() => { const p = s.reihe.findIndex((x) => d.tabelle[x.id] && d.tabelle[x.id].ich) + 1; return p ? 'P' + p : 'done'; })() : hd4KMinuten(runde, s) + ' min') + '</small></li>').join('') + '</ol>'
          + '<label class="hd4-feld">Track for this round <select id="hd4-k-strecke"><option value="aktuell"' + (runde.strecke === 'aktuell' ? ' selected' : '') + '>Track in the editor now</option>'
          + strecken.map((s) => '<option value="' + hd4Esc(s) + '"' + (runde.strecke === s ? ' selected' : '') + '>' + hd4Esc(s) + '</option>').join('') + '</select></label>'
          + '<p class="hd4-klein">' + session.name + ': ' + minuten + ' min' + (session.art === 'rennen' ? ' · rolling start · ' + stopps + ' mandatory stop' + (stopps > 1 ? 's' : '') + (runde.typ === 'sprint' ? ' inside the pit window (' + Math.round(minuten * 25 / 60 * 10) / 10 + '–' + Math.round(minuten * 35 / 60 * 10) / 10 + ' min)' : '') + (runde.wetter === 'wechsel' ? ' · changeable weather' : '') : ' · fastest lap sets the grid') + '</p>'
          + (autos < 2 ? '<p class="hd4-hinweis">Connect at least two cars (give the others the role “NPC” in the garage) – a field of ' + autos + ' cannot be scored.</p>' : npcs ? '<p class="hd4-klein">' + autos + ' cars on the grid, ' + npcs + ' AI drivers at ' + liz.name + ' pace.</p>' : '')
          + '<div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-haupt" id="hd4-k-start">Start ' + session.name + '</button><button type="button" class="hd4-knopf" id="hd4-k-editor">Design a track</button></div></section>';
        h += hd4Karte('Sponsor objectives this round', '<ul class="hd4-ziele">' + runde.ziele.map((z) => '<li class="' + (z.erfuellt ? 'fertig' : '') + '">' + (z.erfuellt ? '✓ ' : '') + HD4_ZIELE[z.id].text + ' <small>+4,000 · +40 XP</small></li>').join('') + '</ul>');
      } else {
        h += hd4Karte('Season complete', '<p>All rounds are driven. Start the next season to defend your titles against a faster field.</p><div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-haupt" id="hd4-k-saison">Start season ' + (d.saison + 1) + '</button></div>');
      }
      // standings
      const ans = [['pkt', 'Overall', 'gesamt'], ['sprint', 'Sprint Cup', 'sprint'], ['endurance', 'Endurance Cup', 'endurance']];
      const aktiv = ans.find((a) => a[2] === hd4K.ansicht) || ans[0];
      const tab = hd4KTabelle(aktiv[0]);
      h += hd4Karte('Standings', '<span class="hd4-segment">' + ans.map((a) => '<button type="button" data-hd4-stand="' + a[2] + '"' + (a === aktiv ? ' class="an"' : '') + '>' + a[1] + '</button>').join('') + '</span>'
        + (tab.length ? '<table class="hd4-tab"><thead><tr><th></th><th>Driver</th><th>Wins</th><th>Podiums</th><th>Points</th></tr></thead><tbody>' + tab.map((x, i) => '<tr' + (x.ich ? ' class="hd4-ich"' : '') + '><td>' + (i + 1) + '</td><td><span class="hd4-punkt" style="background:' + (x.farbe || '#888') + '"></span>' + hd4Esc(x.name) + '</td><td>' + x.siege + '</td><td>' + x.podien + '</td><td><b>' + x[aktiv[0]] + '</b></td></tr>').join('') + '</tbody></table>'
          : '<p class="hd4-leer">No points yet – the first race fills this table.</p>'));
      // calendar
      h += hd4Karte('Calendar', '<ol class="hd4-kalender">' + d.kalender.map((r, i) => {
        const letzte = r.sessions.filter((s) => s.art === 'rennen' && s.reihe && s.reihe.length).pop();
        return '<li class="' + (i < d.idx ? 'fertig' : i === d.idx ? 'jetzt' : '') + '"><span class="hd4-rnr">' + (i + 1) + '</span><span class="hd4-rtyp hd4-' + r.typ + '">' + (r.typ === 'sprint' ? 'Sprint' : r.stunden === 24 ? '24 H' : r.stunden + ' H') + '</span>'
          + (i >= d.idx && !d.fertig ? '<input type="text" class="hd4-ort-feld" data-hd4-ort="' + i + '" value="' + hd4Esc(r.ort) + '" maxlength="28" aria-label="Name of round ' + (i + 1) + '">' : '<span class="hd4-rort">' + hd4Esc(r.ort) + '</span>')
          + (letzte ? '<small>Winner: ' + hd4Esc(letzte.reihe[0].name) + '</small>'
            : i >= d.idx && !d.fertig ? '<select data-hd4-rs="' + i + '" aria-label="Track of round ' + (i + 1) + '"><option value="aktuell"' + (r.strecke === 'aktuell' ? ' selected' : '') + '>Editor track</option>'
              + strecken.map((s) => '<option value="' + hd4Esc(s) + '"' + (r.strecke === s ? ' selected' : '') + '>' + hd4Esc(s) + '</option>').join('') + '</select>'
              + (i > d.idx ? '<button type="button" class="hd4-mini" data-hd4-rtyp="' + i + '" title="Switch this round between Sprint and Endurance">⇄</button>' : '')
            : '<small>' + hd4Esc(r.strecke === 'aktuell' ? 'editor track' : r.strecke) + '</small>') + '</li>'; }).join('') + '</ol>'
        + '<p class="hd4-klein">Pick one of your saved tracks for every round, rename the venue, or switch an upcoming round between Sprint and Endurance. Save layouts in the track editor to see them here.</p>');
      // upgrades
      h += hd4Karte('Team upgrades', '<ul class="hd4-upgrades">' + HD4_UPGRADES.map((u) => { const lv = d.upgrades[u.id] || 0, preis = HD4_UPGRADE_PREIS[lv];
        return '<li><div><b>' + u.name + '</b><small>' + u.text + '</small><span class="hd4-stufen">' + [0, 1, 2].map((i) => '<i' + (i < lv ? ' class="an"' : '') + '></i>').join('') + '</span></div>'
          + (lv >= 3 ? '<span class="hd4-klein">Maxed</span>' : '<button type="button" class="hd4-knopf" data-hd4-kauf="' + u.id + '"' + (d.credits < preis ? ' disabled' : '') + '>' + preis.toLocaleString('en-GB') + '</button>') + '</li>'; }).join('') + '</ul><p class="hd4-klein">Upgrades apply to your car in career sessions.</p>');
      h += hd4Karte('Trophy cabinet', d.trophaeen.length ? '<ul class="hd4-trophaeen">' + d.trophaeen.slice().reverse().map((t) => '<li' + (t.titel ? ' class="hd4-titel"' : '') + '>🏆 ' + hd4Esc(t.text) + '</li>').join('') + '</ul>' : '<p class="hd4-leer">Race wins, licences and titles are collected here.</p>');
      h += formatKarte + hd4Karte('Career file', '<p class="hd4-klein">Race length: ' + d.minProStunde + ' min per race hour.</p><div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-gefahr" id="hd4-k-ende">Delete this career</button></div>');
      host.innerHTML = h + '</div></div>';
      const q = (s) => host.querySelector(s);
      if (q('#hd4-k-start')) q('#hd4-k-start').addEventListener('click', () => { hd4K.bericht = null; hd4KStarten(); });
      if (q('#hd4-k-strecke')) q('#hd4-k-strecke').addEventListener('change', (e) => { n.runde.strecke = e.target.value; hd4KSpeichern(); hd4Neu(); });
      if (q('#hd4-k-editor')) q('#hd4-k-editor').addEventListener('click', () => { try { showTab('fahren'); $('fa-editor').click(); } catch (e) { hd4Toast('Open the track editor from Race Control'); } });
      if (q('#hd4-k-saison')) q('#hd4-k-saison').addEventListener('click', () => { hd4KNeueSaison(); hd4Neu(); });
      host.querySelectorAll('[data-hd4-stand]').forEach((b) => b.addEventListener('click', () => { hd4K.ansicht = b.dataset.hd4Stand; hd4Neu(); }));
      host.querySelectorAll('[data-hd4-ort]').forEach((el) => el.addEventListener('change', () => { d.kalender[Number(el.dataset.hd4Ort)].ort = el.value.trim() || 'Round'; hd4KSpeichern(); hd4Neu(); }));
      host.querySelectorAll('[data-hd4-rs]').forEach((el) => el.addEventListener('change', () => { d.kalender[Number(el.dataset.hd4Rs)].strecke = el.value; hd4KSpeichern(); hd4Neu(); }));
      host.querySelectorAll('[data-hd4-rtyp]').forEach((b) => b.addEventListener('click', () => {
        const i = Number(b.dataset.hd4Rtyp), alt = d.kalender[i];
        const neu = hd4KRunde(alt.typ === 'sprint' ? 'endurance' : 'sprint', alt.typ === 'sprint' ? 3 : 1, i);
        neu.ort = alt.ort; neu.strecke = alt.strecke; d.kalender[i] = neu; hd4KSpeichern(); hd4Neu();
      }));
      host.querySelectorAll('[data-hd4-kauf]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.hd4Kauf, lv = d.upgrades[id] || 0, preis = HD4_UPGRADE_PREIS[lv];
        if (lv >= 3 || d.credits < preis) return;
        d.credits -= preis; d.upgrades[id] = lv + 1; hd4KSpeichern(); hd4Toast('Upgrade bought'); hd4Neu();
      }));
      if (q('#hd4-k-ende')) q('#hd4-k-ende').addEventListener('click', (e) => {
        if (e.target.dataset.arm !== '1') { e.target.dataset.arm = '1'; e.target.textContent = 'Click again to delete for good'; return; }
        hd4K.d = null; hd4K.bericht = null; try { localStorage.removeItem('hybriddash4.' + HD4_KARRIERE_STORE); } catch (e2) { /* private */ } hd4Neu();
      });
    },
  });
