  // =========================================================================
  // Hybrid Dash 4.0: THE VIRTUAL RACE ENGINEER / SPOTTER
  // =========================================================================
  //
  // A voice on the radio for player 1: gaps to the cars ahead and behind, tyre life, fuel laps,
  // the pit window with a compound call and the traffic on exit, weather and track state,
  // failures. Spoken through the app's announcement queue (so it never talks over the race
  // director), shown as a caption in the cockpit and kept in a radio log.
  //
  // RULES THAT KEEP IT USEFUL INSTEAD OF NOISY:
  //   - every kind of message has its own cool-down, and two messages are at least 5 s apart;
  //   - the engineer speaks on the straight after start/finish (messages raised by a lap) or
  //     when something changes - never a running commentary;
  //   - numbers are rounded the way an engineer says them ("one point four", "half a second").

  var hd4Ing = { log: [], zuletzt: {}, letzteAt: 0, runden: -1, pos: null, lebenStufe: 3, spritStufe: 3, boxGerufen: 0, regen: false, gummi: false,
                 nahHinten: 0, nahVorn: 0, wearStart: null, wearJeRunde: [], startGesagt: false, letzteRunde: false, untertitel: null, untertitelBis: 0 };
  var HD4_FUNK_GRUPPE = { abstand: 'abstand', pos: 'abstand', nah: 'abstand', reifen: 'reifen', platt: 'reifen', sprit: 'sprit', box: 'box', boxlimit: 'box', wetter: 'wetter', strecke: 'wetter' };

  // Speak. `key` picks the cool-down bucket; prio 0..50 (higher = more urgent, shorter spacing).
  function hd4Funk(key, text, prio, pauseS) {
    if (!hd4 || !hd4.cfg.ingenieur.an || !text) return false;
    const gruppe = HD4_FUNK_GRUPPE[key];
    if (gruppe && hd4.cfg.ingenieur[gruppe] === false) return false;
    const jetzt = Date.now();
    prio = prio || 10;
    if (jetzt - (hd4Ing.zuletzt[key] || 0) < (pauseS === undefined ? 25 : pauseS) * 1000) return false;
    if (jetzt - hd4Ing.letzteAt < (prio >= 30 ? 1500 : 5000)) return false;
    hd4Ing.zuletzt[key] = jetzt; hd4Ing.letzteAt = jetzt;
    let zeit = '';
    try { zeit = raceStartedAt ? hd4Zeit(Math.max(0, rennZeitJetzt() - raceStartedAt)) : ''; } catch (e) { zeit = ''; }
    hd4Ing.log.unshift({ t: zeit, text, key });
    if (hd4Ing.log.length > 60) hd4Ing.log.pop();
    hd4Ing.untertitel = text; hd4Ing.untertitelBis = jetzt + 3500 + text.length * 55;
    hd4FunkMalen();
    try {
      if (typeof hdSprechen === 'function' && typeof rennAnsagen !== 'undefined') hdSprechen(text, 10 + prio);
      else if (window.speechSynthesis && soundEnabled) { const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 1.08; window.speechSynthesis.speak(u); }
    } catch (e) { /* no voice: the caption and the log remain */ }
    return true;
  }
  function hd4FunkEl() {
    let el = document.getElementById('hd4-funk');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'hd4-funk'; el.hidden = true; el.setAttribute('data-i18n-skip', ''); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    return el;
  }
  function hd4FunkMalen() {
    const el = hd4FunkEl();
    const an = !!hd4Ing.untertitel && Date.now() < hd4Ing.untertitelBis && !hd4HubOffen();
    if (el.hidden === an) el.hidden = !an;
    if (an && el.dataset.text !== hd4Ing.untertitel) {
      el.dataset.text = hd4Ing.untertitel;
      el.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v5a3 3 0 0 0 3 3h1v-7H6v-1a6 6 0 0 1 12 0v1h-2v7h1a3 3 0 0 0 3-3v-5a8 8 0 0 0-8-8Z" fill="currentColor"/></svg><span>' + hd4Esc(hd4Ing.untertitel) + '</span>';
    }
  }

  // ---- how an engineer says a number ---------------------------------------------------------
  function hd4SagSek(s) {
    if (!(s >= 0)) return '';
    if (s < 0.35) return 'two tenths';
    if (s < 0.75) return 'half a second';
    if (s < 1.25) return 'one second';
    if (s < 10) { const g = Math.floor(s), z = Math.round((s - g) * 10); return z === 10 ? (g + 1) + ' seconds' : z ? g + ' point ' + z : g + ' seconds'; }
    return Math.round(s) + ' seconds';
  }
  function hd4SagPlatz(p) { return 'P ' + p; }
  var HD4_MIX_NAME = { weich: 'Softs', mittel: 'Mediums', hart: 'Hards', regen: 'Wets' };

  // ---- the field as the engineer sees it -----------------------------------------------------
  // [{ id, name, ort, laps, ich }], leader first. `ort` in track pieces, monotone over laps.
  function hd4Feld() {
    let n = 1, feld = [];
    try { n = currentTrackTiles.length || 1; } catch (e) { n = 1; }
    try {
      feld = raceAllCars().filter((c) => !c.dnf && !c.dsq).map((c) => ({
        id: c.id, name: c.alias || c.name, laps: (c.laps || []).length, ich: c.role === 'player',
        ort: c.ort !== null && c.ort !== undefined ? c.ort : (c.laps || []).length * n,
      }));
    } catch (e) { feld = []; }
    feld.sort((a, b) => b.ort - a.ort);
    return feld;
  }
  function hd4KachelMs() {
    try {
      const n = currentTrackTiles.length || 1;
      const l = raceLapTimes.length ? raceLapTimes[raceLapTimes.length - 1].ms : null;
      return l ? l / n : null;
    } catch (e) { return null; }
  }
  // Laps still to drive for player 1, or null when the race has no end.
  function hd4RestRunden() {
    try {
      const gefahren = raceLapTimes.length;
      if (raceMode === 'laps') return Math.max(0, raceLimit - gefahren);
      if (raceLimit > 0 && raceGreenAt) {
        const restMs = raceLimit * 60000 - (rennZeitJetzt() - raceGreenAt);
        const ms = raceLapTimes.slice(-3).map((x) => x.ms);
        if (!ms.length) return null;
        return Math.max(0, restMs / (ms.reduce((a, b) => a + b, 0) / ms.length));
      }
    } catch (e) { /* no race */ }
    return null;
  }
  // Which compound for the next stint: the fastest one that lasts to the flag.
  function hd4MixRat(rest) {
    let regen = 0;
    try { regen = wxRainLevel(); } catch (e) { regen = 0; }
    if (regen > 0.4) return 'regen';
    const je = hd4Ing.wearJeRunde.length ? hd4Ing.wearJeRunde.reduce((a, b) => a + b, 0) / hd4Ing.wearJeRunde.length : null;
    if (!je || rest === null) return 'mittel';
    let jetzt = 'mittel';
    try { jetzt = tyres; } catch (e) { jetzt = 'mittel'; }
    const rate = (m) => { try { return je * mischungWert(m, 'verschleiss') / Math.max(0.1, mischungWert(jetzt, 'verschleiss')); } catch (e) { return je; } };
    for (const m of ['weich', 'mittel', 'hart']) {
      let erlaubt = true;
      try { erlaubt = mischungErlaubt(m); } catch (e) { erlaubt = true; }
      if (erlaubt && HD4_KLIPPE[m].ab / Math.max(1e-6, rate(m)) >= rest + 0.5) return m;
    }
    return 'hart';
  }
  // Where would we come out after a stop? "clear" or the name of the car we would follow.
  function hd4VerkehrNachBox(feld, ich) {
    const kms = hd4KachelMs();
    if (!kms || !ich) return null;
    const verlust = 9000 / kms;                    // about nine seconds lost, in track pieces
    const dann = ich.ort - verlust;
    let naechster = null;
    feld.forEach((c) => { if (c !== ich && c.ort > dann && c.ort - dann < 1.5 && (!naechster || c.ort < naechster.ort)) naechster = c; });
    const hinten = feld.some((c) => c !== ich && c.ort <= dann && dann - c.ort < 1.0);
    if (!naechster && !hinten) return { frei: true };
    return { frei: false, name: naechster ? naechster.name : null };
  }

  // ---- the engineer's loop (1 Hz is plenty) ----------------------------------------------------
  var hd4IngTakt = 0, hd4IngWarRennen = false;
  hd4Takt((dt, jetzt) => {
    hd4FunkMalen();
    const laeuft = hd4RennenLaeuft();
    if (!laeuft) {
      if (hd4IngWarRennen) hd4IngEnde();
      hd4IngWarRennen = false;
      return;
    }
    if (!hd4IngWarRennen) {
      Object.assign(hd4Ing, { zuletzt: {}, runden: 0, pos: null, lebenStufe: 3, spritStufe: 3, boxGerufen: 0, regen: false, gummi: false, nahHinten: 0, nahVorn: 0,
        wearStart: null, wearJeRunde: [], startGesagt: false, letzteRunde: false, log: [] });
      hd4IngWarRennen = true;
    }
    if (!hd4.cfg.ingenieur.an || jetzt - hd4IngTakt < 1000) return;
    hd4IngTakt = jetzt;
    let state = 'idle', formation = false, gelb = false;
    try { state = raceState; formation = !!raceFormationLap; gelb = flagState !== 'green'; } catch (e) { return; }
    if (state !== 'racing' || formation) return;
    let rennen = true;
    try { rennen = raceMode !== 'practice' && raceMode !== 'qualifying' && raceMode !== 'bestzeit'; } catch (e) { rennen = true; }
    const feld = hd4Feld();
    const ich = feld.find((c) => c.ich);
    const pos = ich ? feld.indexOf(ich) + 1 : null;
    const kms = hd4KachelMs();
    const vorn = ich && pos > 1 ? feld[pos - 2] : null, hinten = ich && pos < feld.length ? feld[pos] : null;
    const gapVorn = vorn && kms ? (vorn.ort - ich.ort) * kms / 1000 : null;
    const gapHinten = hinten && kms ? (ich.ort - hinten.ort) * kms / 1000 : null;
    let runden = 0;
    try { runden = raceLapTimes.length; } catch (e) { runden = 0; }
    const rest = hd4RestRunden();
    const p = hd4SimPlatz(1);

    if (!hd4Ing.startGesagt) {
      hd4Ing.startGesagt = true;
      hd4Funk('start', rennen ? 'Green, green, green! ' + hd4Modus(1).name + ' map. Look after the tyres in the first laps.' : 'Track is clear. Build up to it.', 30, 0);
    }

    // ---- once per completed lap ----
    if (runden > hd4Ing.runden) {
      hd4Ing.runden = runden;
      // wear per lap, for the compound call
      const wear = physEngine.state.tyreWear || 0;
      if (hd4Ing.wearStart !== null && wear > hd4Ing.wearStart) { hd4Ing.wearJeRunde.push(wear - hd4Ing.wearStart); if (hd4Ing.wearJeRunde.length > 4) hd4Ing.wearJeRunde.shift(); }
      hd4Ing.wearStart = wear;
      if (rennen && rest !== null && rest <= 1.05 && rest > 0.2 && !hd4Ing.letzteRunde) {
        hd4Ing.letzteRunde = true;
        hd4Funk('letzte', 'Last lap' + (pos ? ', you are ' + hd4SagPlatz(pos) : '') + '. Bring it home.', 30, 0);
      } else if (rennen && pos && feld.length > 1 && runden % Math.max(1, hd4.cfg.ingenieur.jedeRunde) === 0 && !gelb) {
        const teile = [hd4SagPlatz(pos) + '.'];
        if (gapVorn !== null && gapVorn < 30) teile.push('Gap ahead, ' + hd4SagSek(gapVorn) + (vorn ? ' to ' + vorn.name : '') + '.');
        if (gapHinten !== null && gapHinten < 30) teile.push('Behind, ' + hd4SagSek(gapHinten) + '.');
        if (teile.length > 1) hd4Funk('abstand', teile.join(' '), 10, 8);
      }
      // ---- pit calls belong to the lap: there is one chance per lap to come in ----
      let pflicht = 0;
      try { pflicht = Math.max(0, racePitRequired - racePitDone); } catch (e) { pflicht = 0; }
      const leben = hd4ReifenLeben(1, physEngine);
      const imTank = hd4RundenImTank(1);
      let reifenAn = true, spritAn = true;
      try { reifenAn = tyreSimOn(); spritAn = fuelSimOn(); } catch (e) { /* default on */ }
      const reifenFaellig = reifenAn && (leben <= 0.12 || p.platt > 0.5);
      const spritFaellig = spritAn && imTank !== null && imTank < 2.2 && (rest === null || rest > imTank - 0.2);
      const pflichtFaellig = pflicht > 0 && rest !== null && rest <= pflicht * 2 + 1;
      const fenster = typeof hd4KarriereFenster === 'function' ? hd4KarriereFenster() : null;   // { offen, text }
      if (rennen && (reifenFaellig || spritFaellig || pflichtFaellig || (fenster && fenster.offen && pflicht > 0)) && runden - hd4Ing.boxGerufen >= 2 && (rest === null || rest > 1.2)) {
        hd4Ing.boxGerufen = runden;
        const mix = hd4MixRat(rest === null ? 99 : rest - 1);
        const verkehr = hd4VerkehrNachBox(feld, ich);
        const warum = fenster && fenster.offen && pflicht > 0 ? 'Pit window is open. ' : spritFaellig ? '' : reifenFaellig ? '' : 'Mandatory stop still to do. ';
        hd4Funk('box', warum + 'Box this lap for ' + HD4_MIX_NAME[mix] + (spritFaellig ? ' and fuel' : '') + '. '
          + (verkehr ? (verkehr.frei ? 'Traffic is clearing ahead, you come out in free air.' : 'You will come out ' + (verkehr.name ? 'behind ' + verkehr.name : 'in traffic') + '.') : ''), 35, 0);
      } else if (rennen && spritAn && imTank !== null && rest !== null && rest > 1.5 && imTank < rest && imTank > rest - 1.2 && p.modus !== 'lean' && hd4.cfg.sim.motorModi) {
        hd4Funk('sprit', 'We are ' + (rest - imTank < 0.6 ? 'half a lap' : 'one lap') + ' short on fuel. Switch to Lean and lift early, and we can skip the stop.', 25, 60);
      }
    }

    // ---- between the laps: things that change ----
    if (rennen && pos && hd4Ing.pos && pos !== hd4Ing.pos && !gelb && runden >= 1) {
      if (pos < hd4Ing.pos) hd4Funk('pos', 'Good move. ' + hd4SagPlatz(pos) + ' now.' + (vorn && gapVorn !== null && gapVorn < 8 ? ' Next is ' + vorn.name + ', ' + hd4SagSek(gapVorn) + ' up the road.' : pos === 1 ? ' You lead the race.' : ''), 20, 6);
      else hd4Funk('pos', 'Lost a place. ' + hd4SagPlatz(pos) + '.' + (vorn ? ' ' + vorn.name + ' is right ahead, stay with him.' : ''), 20, 6);
    }
    hd4Ing.pos = pos;
    if (rennen && !gelb && gapHinten !== null && gapHinten < 0.6) {
      if (!hd4Ing.nahHinten) hd4Ing.nahHinten = jetzt;
      if (jetzt - hd4Ing.nahHinten > 2500) hd4Funk('nah', (hinten ? hinten.name : 'Car') + ' right behind, ' + hd4SagSek(gapHinten) + '. Defend the inside.', 15, 40);
    } else hd4Ing.nahHinten = 0;
    if (rennen && !gelb && gapVorn !== null && gapVorn < 0.7) {
      if (!hd4Ing.nahVorn) hd4Ing.nahVorn = jetzt;
      if (jetzt - hd4Ing.nahVorn > 3000) hd4Funk('nah', 'You are in the tow of ' + (vorn ? vorn.name : 'the car ahead') + '. ' + (p.modus !== 'rich' && hd4.cfg.sim.motorModi ? 'Rich map and go for it.' : 'Go for it.'), 15, 45);
    } else hd4Ing.nahVorn = 0;

    // tyres
    let reifenAn2 = true;
    try { reifenAn2 = tyreSimOn(); } catch (e) { reifenAn2 = true; }
    if (reifenAn2) {
      const leben = hd4ReifenLeben(1, physEngine);
      const stufe = leben <= 0 ? 0 : leben < 0.2 ? 1 : leben < 0.5 ? 2 : 3;
      if (stufe < hd4Ing.lebenStufe) {
        const je = hd4Ing.wearJeRunde.length ? hd4Ing.wearJeRunde.reduce((a, b) => a + b, 0) / hd4Ing.wearJeRunde.length : null;
        const k = HD4_KLIPPE[hd4MixVon(1)] || HD4_KLIPPE.mittel;
        const nochRunden = je ? Math.max(0, (k.ab - (physEngine.state.tyreWear || 0)) / je) : null;
        if (stufe === 2) hd4Funk('reifen', 'Tyres are at half life.' + (nochRunden ? ' About ' + Math.round(nochRunden) + ' laps left in them.' : ''), 12, 20);
        else if (stufe === 1) hd4Funk('reifen', 'Tyre wear is getting critical.' + (nochRunden !== null ? ' ' + (nochRunden < 1.5 ? 'One more lap' : Math.round(nochRunden) + ' laps') + ' before they fall off.' : '') + ' Smooth inputs.', 22, 10);
        else hd4Funk('reifen', 'The tyres have gone over the cliff. You are losing a lot of grip, we need to box.', 30, 5);
      }
      hd4Ing.lebenStufe = stufe;
    }
    // fuel
    let spritAn2 = true;
    try { spritAn2 = fuelSimOn(); } catch (e) { spritAn2 = true; }
    if (spritAn2) {
      const imTank = hd4RundenImTank(1);
      const stufe = imTank === null ? 3 : imTank < 1.3 ? 0 : imTank < 3.3 ? 1 : 2;
      if (stufe < hd4Ing.spritStufe && imTank !== null && (rest === null || rest > imTank)) {
        if (stufe === 1) hd4Funk('sprit', 'Fuel for ' + Math.max(2, Math.round(imTank)) + ' more laps.', 15, 10);
        else if (stufe === 0) hd4Funk('sprit', 'Fuel is critical. This is the last lap in the tank.', 30, 5);
      }
      hd4Ing.spritStufe = stufe;
    }
    // weather and track
    let regen = 0;
    try { regen = wxRainLevel(); } catch (e) { regen = 0; }
    if (regen > 0.15 && !hd4Ing.regen) { hd4Ing.regen = true; hd4Funk('wetter', 'Rain is here. ' + (hd4MixVon(1) === 'regen' ? 'You are on the right tyre.' : 'Slicks will not last in this, think about Wets.'), 25, 20); }
    else if (regen < 0.05 && hd4Ing.regen) { hd4Ing.regen = false; hd4Funk('wetter', 'The rain has stopped. Track is drying.', 15, 20); }
    if (hd4Sim.gummi > 0.66 && !hd4Ing.gummi) { hd4Ing.gummi = true; hd4Funk('strecke', 'The track is rubbered in now. Grip is up, you can brake a little later.', 8, 60); }
    else if (hd4Sim.gummi < 0.3) hd4Ing.gummi = false;
  });
  function hd4IngEnde() {
    if (!hd4.cfg.ingenieur.an || hd4Ing.runden < 1) return;
    const feld = hd4Feld();
    const ich = feld.find((c) => c.ich);
    let rennen = true;
    try { rennen = raceMode !== 'practice' && raceMode !== 'qualifying' && raceMode !== 'bestzeit'; } catch (e) { rennen = true; }
    if (rennen && ich && feld.length > 1) {
      const pos = feld.indexOf(ich) + 1;
      hd4Funk('ziel', 'Chequered flag. ' + hd4SagPlatz(pos) + '. ' + (pos === 1 ? 'That is the win! Brilliant drive.' : pos <= 3 ? 'Podium! Great job.' : 'Good effort. Bring the car back.'), 40, 0);
    }
  }

  hd4Schirm({
    id: 'ingenieur', titel: 'Race engineer', kurz: 'Engineer', icon: HD4_ICON.ingenieur,
    zeichnen(host) {
      const log = hd4Ing.log.length ? '<ol class="hd4-funklog">' + hd4Ing.log.map((x) => '<li><time>' + hd4Esc(x.t) + '</time><span>' + hd4Esc(x.text) + '</span></li>').join('') + '</ol>'
        : '<p class="hd4-leer">No radio traffic yet. The engineer speaks during a race.</p>';
      host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Race engineer</h2><p>A voice on the radio for player 1, with a caption in the cockpit. It uses the app’s announcement voice and follows the mute button.</p></div>'
        + '<div class="hd4-raster2">' + hd4Karte('Callouts', hd4Schalter('ingenieur.an', 'Engineer radio', 'Master switch for all callouts.')
          + hd4Schalter('ingenieur.abstand', 'Gaps and positions', 'Position and the gaps ahead and behind, cars closing, places won and lost.')
          + hd4Schalter('ingenieur.reifen', 'Tyres', 'Half life, critical wear, the cliff, flat spots.')
          + hd4Schalter('ingenieur.sprit', 'Fuel', 'Laps left in the tank and fuel-saving calls.')
          + hd4Schalter('ingenieur.box', 'Pit window', '“Box this lap for Mediums, traffic clearing ahead” – compound call and traffic on exit.')
          + hd4Schalter('ingenieur.wetter', 'Weather and track', 'Rain, drizzle and a rubbered-in track.')
          + hd4Wahl('ingenieur.jedeRunde', 'Gap report', [[1, 'Every lap'], [2, 'Every 2 laps'], [4, 'Every 4 laps']])
          + '<div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-haupt" id="hd4-funk-test">Radio check</button></div>')
        + hd4Karte('Radio log (this race)', log) + '</div></div>';
      hd4SchalterVerdrahten(host);
      host.querySelector('#hd4-funk-test').addEventListener('click', () => {
        hd4Ing.letzteAt = 0; hd4Ing.zuletzt.test = 0;
        const an = hd4.cfg.ingenieur.an; hd4.cfg.ingenieur.an = true;
        hd4Funk('test', 'Radio check. Box this lap for Mediums, traffic clearing ahead.', 40, 0);
        hd4.cfg.ingenieur.an = an;
        hd4Neu();
      });
    },
  });
