  // =========================================================================
  // Hybrid Dash 4.0: ANALYSIS (distance-based traces, consistency, incidents)
  // =========================================================================
  //
  // The data is the telemetry the app already records (70b-telemetrie.js): per lap the time at
  // every track piece and about ten samples a second of speed, throttle, brake, gear, steering.
  //
  // THE X AXIS IS DISTANCE, not time. Two laps are only comparable at the same PLACE: a lap that
  // is slower is also longer in time, and plotted over time every corner after the first loss
  // would be shifted. The place of a sample is its track piece (known exactly from the piece
  // change) plus the share of that piece's distance covered - integrated from the speed samples,
  // so a car that brakes late sits further along the piece than a clock would put it.
  //
  //   SPEED TRACE      straights rise, braking zones drop, corners are valleys; the lowest point
  //                    of each valley is labelled as minimum corner speed.
  //   TIME DELTA       lap A minus lap B at every place. Rising = A is losing time there.
  //   THROTTLE/BRAKE   both laps, so early or abrupt braking and lifts on exit are visible.
  //   SECTOR MATRIX    up to 20 laps of the last stint by sector, with the standard deviation
  //                    per sector - where does consistency break down?
  //   INCIDENT MAP     every barrier contact, off-track excursion, tracking loss and lock-up
  //                    as a marker on the track map.

  var HD4_VORFALL_STORE = 'vorfaelle.v1';
  var HD4_VORFALL_ART = {
    crash: { name: 'Barrier contact', farbe: '#ff5c5c' },
    off: { name: 'Off track', farbe: '#ffb02e' },
    lost: { name: 'Tracking lost', farbe: '#b08cff' },
    lock: { name: 'Lock-up', farbe: '#4db8ff' },
  };
  var hd4An = { vorfaelle: hd4Lesen(HD4_VORFALL_STORE, {}), wahl: { strecke: null, a: null, b: null, wer: 'alle' }, reiter: 'spuren', ab: {}, lostSeit: 0, lostGemeldet: false };

  // ---- INCIDENT RECORDER --------------------------------------------------------------------
  function hd4VorfallOrt(nr) {
    try {
      if (nr === 1) return dashMinimapIndex === null || dashMinimapIndex === undefined ? null : dashMinimapIndex + dashTilePhase();
      const z = zusatzPlatz(nr);
      return z && z.car ? ghostOrt(z.car) : null;
    } catch (e) { return null; }
  }
  function hd4VorfallBei(art, wer, ort) {
    if (!hd4 || !hd4RennenLaeuft() || ort === null || ort === undefined || !Number.isFinite(ort)) return;
    const sk = hd4StreckeKey();
    if (!sk) return;
    let code = '';
    try { code = trackToCode(currentTrackTiles, 0); } catch (e) { return; }
    let e = hd4An.vorfaelle[sk];
    if (!e || e.code !== code) e = hd4An.vorfaelle[sk] = { code, liste: [] };
    e.datum = Date.now();
    e.liste.push({ a: art, w: wer, o: Math.round(ort * 100) / 100, t: Date.now() });
    if (e.liste.length > 500) e.liste.splice(0, e.liste.length - 500);
    hd4An.schmutzig = true;
  }
  function hd4VorfallMerken(art, nr) { hd4VorfallBei(art, 'p' + (nr || 1), hd4VorfallOrt(nr || 1)); }
  function hd4VorfallSichern() {
    if (!hd4An.schmutzig) return;
    const keys = Object.keys(hd4An.vorfaelle).sort((a, b) => (hd4An.vorfaelle[b].datum || 0) - (hd4An.vorfaelle[a].datum || 0));
    keys.slice(12).forEach((k) => delete hd4An.vorfaelle[k]);
    hd4Schreiben(HD4_VORFALL_STORE, hd4An.vorfaelle);
    hd4An.schmutzig = false;
  }
  var hd4AnGespeichert = 0, hd4AnNpcOffs = {};
  hd4Takt((dt, jetzt) => {
    if (!hd4RennenLaeuft()) { if (hd4An.schmutzig) hd4VorfallSichern(); hd4An.ab = {}; hd4AnNpcOffs = {}; hd4An.lostSeit = 0; return; }
    // off-track excursions of the local players (rising edge)
    hd4Spieler().forEach((sp) => {
      let ab = false;
      try { ab = sp.nr === 1 ? istAbseits() : !!(sp.z && sp.z.abseits && sp.z.abseits.aktiv); } catch (e) { ab = false; }
      if (ab && !hd4An.ab[sp.nr]) hd4VorfallMerken('off', sp.nr);
      hd4An.ab[sp.nr] = ab;
    });
    // optical tracking loss of player 1: moving, on a scanned track, but no piece read for a while
    try {
      const v = Math.abs(physEngine.state.speedKmh || 0) / Math.max(0.01, physEngine.config.topSpeedKmh || 1);
      const bahn = !!($('setting-ontrack') || {}).checked && currentTrackTiles.length >= 3;
      const still = rennZeitJetzt() - dashTileAt;
      if (bahn && v > 0.3 && dashTileAt > 0 && still > Math.max(2500, 4 * (dashTileMs || 0)) && !istAbseits()) {
        if (!hd4An.lostGemeldet) { hd4An.lostGemeldet = true; hd4VorfallMerken('lost', 1); }
      } else if (still < 800) hd4An.lostGemeldet = false;
    } catch (e) { /* no track */ }
    // NPC offs
    try {
      garage.forEach((car) => {
        if (car.role !== 'ghost' || !car.ghost) return;
        const id = hd4AutoId(car), offs = (car.race && car.race.offLap) || 0;
        if (hd4AnNpcOffs[id] !== undefined && offs > hd4AnNpcOffs[id]) hd4VorfallBei('off', 'npc', ghostOrt(car));
        hd4AnNpcOffs[id] = offs;
      });
    } catch (e) { /* no garage */ }
    if (jetzt - hd4AnGespeichert > 15000) { hd4AnGespeichert = jetzt; hd4VorfallSichern(); }
  });

  // ---- GEOMETRY: the track as distance ----------------------------------------------------------
  function hd4AnGeo(tiles) {
    const pts = trackCenterline(tiles), n = tiles.length;
    const tab = trackKachelTabelle(pts, n);
    const lang = [];
    for (let k = 0; k < n; k++) {
      const a = tab.start[k], b = k + 1 < n ? tab.start[k + 1] : pts.length - 1;
      let l = 0;
      for (let i = a; i < b && i + 1 < pts.length; i++) l += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
      lang.push(Math.max(1e-6, l));
    }
    let cm = 1;
    try { cm = 1 / TRACK_UNITS_PER_CM; } catch (e) { cm = 1; }
    const S = [0];
    for (let k = 0; k < n; k++) S.push(S[k] + lang[k] * cm);
    const kurve = tiles.map((x) => { try { return chKlasse(x.type) !== 'G'; } catch (e) { return false; } });
    return { pts, tab, n, S, gesamt: S[n], kurve };
  }
  // One lap as points over distance: [{ s (cm), t (ms), v, gas, br }], piece boundaries included.
  function hd4AnRunde(spur, teile, geo) {
    const n = geo.n, pr = spur.proben || [];
    const out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
      const t0 = teile[k], t1 = k + 1 < n ? teile[k + 1] : spur.ms;
      const hier = [];
      while (j < pr.length && pr[j][0] < t1) { if (pr[j][0] >= t0) hier.push(pr[j]); j++; }
      // distance within the piece: integrate speed over the samples (trapezoid), then normalise
      const zeiten = [t0].concat(hier.map((p) => p[0]), [t1]);
      const vs = [hier.length ? hier[0][1] : null].concat(hier.map((p) => p[1]), [hier.length ? hier[hier.length - 1][1] : null]);
      const weg = [0];
      for (let i = 1; i < zeiten.length; i++) {
        const v = vs[i - 1] === null ? 1 : Math.max(0.5, (vs[i - 1] + vs[i]) / 2);
        weg.push(weg[i - 1] + v * (zeiten[i] - zeiten[i - 1]));
      }
      const ges = weg[weg.length - 1] || 1;
      const laenge = geo.S[k + 1] - geo.S[k];
      out.push({ s: geo.S[k], t: t0, v: hier.length ? hier[0][1] : null, gas: hier.length ? hier[0][2] : null, br: hier.length ? hier[0][3] : null, grenze: true });
      hier.forEach((p, i) => out.push({ s: geo.S[k] + laenge * weg[i + 1] / ges, t: p[0], v: p[1], gas: p[2], br: p[3] }));
    }
    out.push({ s: geo.gesamt, t: spur.ms, v: out.length ? out[out.length - 1].v : null, gas: null, br: null, grenze: true });
    // fill the boundary points that had no sample of their own
    for (let i = 0; i < out.length; i++) {
      if (out[i].v !== null) continue;
      let a = i - 1, b = i + 1;
      while (a >= 0 && out[a].v === null) a--;
      while (b < out.length && out[b].v === null) b++;
      const q = a >= 0 ? out[a] : (b < out.length ? out[b] : null);
      out[i].v = q ? q.v : 0; out[i].gas = q ? q.gas : 0; out[i].br = q ? q.br : 0;
    }
    return out;
  }
  // value of `feld` at distance s (linear between points; points are sorted by s)
  function hd4AnBei(punkte, s, feld) {
    let lo = 0, hi = punkte.length - 1;
    if (s <= punkte[0].s) return punkte[0][feld];
    if (s >= punkte[hi].s) return punkte[hi][feld];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (punkte[m].s <= s) lo = m; else hi = m; }
    const a = punkte[lo], b = punkte[hi], d = b.s - a.s;
    return d > 1e-9 ? a[feld] + (b[feld] - a[feld]) * (s - a.s) / d : a[feld];
  }
  function hd4AnRaster(punkte, gesamt, N) {
    const r = [];
    for (let i = 0; i <= N; i++) {
      const s = gesamt * i / N;
      r.push({ s, t: hd4AnBei(punkte, s, 't'), v: hd4AnBei(punkte, s, 'v'), gas: hd4AnBei(punkte, s, 'gas'), br: hd4AnBei(punkte, s, 'br') });
    }
    return r;
  }
  function hd4AnKmh(prozent) {
    let top = 272;
    try { top = (physEngine.config.topSpeedKmh || 4) * TACHO_SCALE; } catch (e) { top = 272; }
    return prozent / 100 * top;
  }
  // sector boundaries as piece indices: N parts of equal distance, snapped to piece boundaries
  function hd4AnSektoren(geo, N) {
    const g = [0];
    for (let i = 1; i < N; i++) {
      const ziel = geo.gesamt * i / N;
      let best = 1, d = Infinity;
      for (let k = 1; k < geo.n; k++) { const x = Math.abs(geo.S[k] - ziel); if (x < d) { d = x; best = k; } }
      g.push(Math.max(g[g.length - 1] + 1, Math.min(geo.n - (N - i), best)));
    }
    g.push(geo.n);
    return g;
  }

  // ---- CHARTS --------------------------------------------------------------------------------
  var HD4_AN_W = 1000, HD4_AN_L = 46, HD4_AN_R = 10;
  function hd4AnX(s, gesamt) { return HD4_AN_L + (HD4_AN_W - HD4_AN_L - HD4_AN_R) * s / gesamt; }
  function hd4AnRahmen(geo, H, oben, unten, sekt) {
    let s = '';
    // corners as shaded bands, piece boundaries as hairlines, sectors as labelled lines
    for (let k = 0; k < geo.n; k++) {
      const x0 = hd4AnX(geo.S[k], geo.gesamt), x1 = hd4AnX(geo.S[k + 1], geo.gesamt);
      if (geo.kurve[k]) s += '<rect x="' + x0.toFixed(1) + '" y="' + oben + '" width="' + (x1 - x0).toFixed(1) + '" height="' + (H - oben - unten) + '" class="hd4-ch-kurve"/>';
    }
    (sekt || []).forEach((k, i) => {
      if (i === 0 || i === sekt.length - 1) return;
      const x = hd4AnX(geo.S[k], geo.gesamt).toFixed(1);
      s += '<line x1="' + x + '" y1="' + oben + '" x2="' + x + '" y2="' + (H - unten) + '" class="hd4-ch-sektor"/><text x="' + (+x + 4) + '" y="' + (oben + 11) + '" class="hd4-ch-klein">S' + (i + 1) + '</text>';
    });
    return s;
  }
  function hd4AnPfad(raster, gesamt, yVon, feld) {
    return raster.map((p, i) => (i ? 'L' : 'M') + hd4AnX(p.s, gesamt).toFixed(1) + ' ' + yVon(p[feld]).toFixed(1)).join(' ');
  }
  function hd4AnAchseY(werte, yVon, einheit, links) {
    return werte.map((w) => '<line x1="' + HD4_AN_L + '" y1="' + yVon(w).toFixed(1) + '" x2="' + (HD4_AN_W - HD4_AN_R) + '" y2="' + yVon(w).toFixed(1) + '" class="hd4-ch-gitter"/>'
      + '<text x="' + (links - 6) + '" y="' + (yVon(w) + 3.5).toFixed(1) + '" text-anchor="end" class="hd4-ch-klein">' + w + (einheit || '') + '</text>').join('');
  }
  function hd4AnTempoChart(geo, rA, rB, sekt) {
    const H = 250, oben = 14, unten = 22;
    const max = Math.max(60, ...rA.map((p) => hd4AnKmh(p.v)), ...(rB || []).map((p) => hd4AnKmh(p.v)));
    const top = Math.ceil(max / 50) * 50;
    const y = (kmh) => H - unten - (H - oben - unten) * kmh / top;
    const yP = (prozent) => y(hd4AnKmh(prozent));
    const ticks = []; for (let w = 0; w <= top; w += top > 200 ? 100 : 50) ticks.push(w);
    let s = '<svg class="hd4-chart" viewBox="0 0 ' + HD4_AN_W + ' ' + H + '" role="img" aria-label="Speed over lap distance">' + hd4AnRahmen(geo, H, oben, unten, sekt) + hd4AnAchseY(ticks, y, '', HD4_AN_L);
    if (rB) s += '<path d="' + hd4AnPfad(rB, geo.gesamt, yP, 'v') + '" class="hd4-ch-b"/>';
    s += '<path d="' + hd4AnPfad(rA, geo.gesamt, yP, 'v') + '" class="hd4-ch-a"/>';
    // minimum corner speed: lowest point of A inside every run of corner pieces
    let k = 0, nr = 0;
    while (k < geo.n) {
      if (!geo.kurve[k]) { k++; continue; }
      let e = k; while (e + 1 < geo.n && geo.kurve[e + 1]) e++;
      nr++;
      const s0 = geo.S[k], s1 = geo.S[e + 1];
      let tief = null;
      rA.forEach((p) => { if (p.s >= s0 && p.s <= s1 && (!tief || p.v < tief.v)) tief = p; });
      if (tief) {
        const x = hd4AnX(tief.s, geo.gesamt), yy = yP(tief.v);
        s += '<circle cx="' + x.toFixed(1) + '" cy="' + yy.toFixed(1) + '" r="3.2" class="hd4-ch-min"/>'
          + '<text x="' + Math.min(HD4_AN_W - HD4_AN_R - 26, x).toFixed(1) + '" y="' + Math.min(H - unten - 3, yy + 14).toFixed(1) + '" text-anchor="middle" class="hd4-ch-minlabel">T' + nr + ' · ' + Math.round(hd4AnKmh(tief.v)) + '</text>';
      }
      k = e + 1;
    }
    return s + '<text x="4" y="11" class="hd4-ch-klein">km/h</text></svg>';
  }
  function hd4AnDeltaChart(geo, rA, rB, sekt) {
    const H = 170, oben = 12, unten = 22;
    const d = rA.map((p, i) => (p.t - rB[i].t) / 1000);
    const max = Math.max(0.1, ...d.map(Math.abs));
    const grenze = max < 0.25 ? 0.25 : max < 0.5 ? 0.5 : Math.ceil(max);
    const mitte = (H - unten + oben) / 2;
    const y = (w) => mitte + (H - oben - unten) / 2 * w / grenze;     // up = A gains, down... see below
    // "If the line slopes upward, time is being lost": losses are plotted upwards.
    const yv = (w) => mitte - (H - oben - unten) / 2 * w / grenze;
    void y;
    const pfad = d.map((w, i) => (i ? 'L' : 'M') + hd4AnX(rA[i].s, geo.gesamt).toFixed(1) + ' ' + yv(w).toFixed(1)).join(' ');
    const flaeche = pfad + ' L' + hd4AnX(geo.gesamt, geo.gesamt).toFixed(1) + ' ' + mitte + ' L' + HD4_AN_L + ' ' + mitte + ' Z';
    const ende = d[d.length - 1];
    return '<svg class="hd4-chart" viewBox="0 0 ' + HD4_AN_W + ' ' + H + '" role="img" aria-label="Time delta over lap distance">' + hd4AnRahmen(geo, H, oben, unten, sekt)
      + hd4AnAchseY([grenze, grenze / 2, 0, -grenze / 2, -grenze].map((w) => +w.toFixed(2)), yv, '', HD4_AN_L)
      + '<path d="' + flaeche + '" class="' + (ende > 0 ? 'hd4-ch-verlust' : 'hd4-ch-gewinn') + '"/><path d="' + pfad + '" class="hd4-ch-delta"/>'
      + '<text x="4" y="11" class="hd4-ch-klein">s</text><text x="' + (HD4_AN_W - HD4_AN_R - 4) + '" y="' + (oben + 10) + '" text-anchor="end" class="hd4-ch-klein">↑ A loses time · ↓ A gains time</text></svg>';
  }
  function hd4AnPedalChart(geo, rA, rB, sekt) {
    const H = 210, oben = 12, unten = 22, halb = (H - oben - unten - 14) / 2;
    const yG = (w) => oben + halb - halb * Math.min(100, w) / 100;
    const yB = (w) => oben + halb + 14 + halb - halb * Math.min(100, w) / 100;
    let s = '<svg class="hd4-chart" viewBox="0 0 ' + HD4_AN_W + ' ' + H + '" role="img" aria-label="Throttle and brake over lap distance">' + hd4AnRahmen(geo, H, oben, unten, sekt)
      + '<line x1="' + HD4_AN_L + '" y1="' + yG(0) + '" x2="' + (HD4_AN_W - HD4_AN_R) + '" y2="' + yG(0) + '" class="hd4-ch-gitter"/><line x1="' + HD4_AN_L + '" y1="' + yB(0) + '" x2="' + (HD4_AN_W - HD4_AN_R) + '" y2="' + yB(0) + '" class="hd4-ch-gitter"/>'
      + '<text x="' + (HD4_AN_L - 6) + '" y="' + (yG(50) + 3) + '" text-anchor="end" class="hd4-ch-klein hd4-ch-gas-t">THR</text><text x="' + (HD4_AN_L - 6) + '" y="' + (yB(50) + 3) + '" text-anchor="end" class="hd4-ch-klein hd4-ch-br-t">BRK</text>';
    if (rB) s += '<path d="' + hd4AnPfad(rB, geo.gesamt, yG, 'gas') + '" class="hd4-ch-b"/><path d="' + hd4AnPfad(rB, geo.gesamt, yB, 'br') + '" class="hd4-ch-b"/>';
    s += '<path d="' + hd4AnPfad(rA, geo.gesamt, yG, 'gas') + '" class="hd4-ch-gas"/><path d="' + hd4AnPfad(rA, geo.gesamt, yB, 'br') + '" class="hd4-ch-br"/>';
    // distance axis
    const schritt = geo.gesamt > 1500 ? 500 : geo.gesamt > 600 ? 200 : 100;
    for (let w = 0; w <= geo.gesamt; w += schritt) s += '<text x="' + hd4AnX(w, geo.gesamt).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="hd4-ch-klein">' + (w / 100).toFixed(w % 100 ? 1 : 0) + ' m</text>';
    return s + '</svg>';
  }
  // What the traces say, in words: the biggest single loss and gain by corner / straight.
  function hd4AnBefund(geo, rA, rB) {
    const teile = [];
    let k = 0, kurveNr = 0;
    while (k < geo.n) {
      const art = geo.kurve[k];
      let e = k; while (e + 1 < geo.n && geo.kurve[e + 1] === art) e++;
      if (art) kurveNr++;
      const s0 = geo.S[k], s1 = geo.S[e + 1];
      const d = (hd4AnBei(rA, s1, 't') - hd4AnBei(rA, s0, 't')) - (hd4AnBei(rB, s1, 't') - hd4AnBei(rB, s0, 't'));
      let minA = Infinity, minB = Infinity;
      rA.forEach((p) => { if (p.s >= s0 && p.s <= s1) minA = Math.min(minA, p.v); });
      rB.forEach((p) => { if (p.s >= s0 && p.s <= s1) minB = Math.min(minB, p.v); });
      teile.push({ name: art ? 'T' + kurveNr : 'the straight before T' + (kurveNr + 1), kurve: art, d, minA, minB });
      k = e + 1;
    }
    const verlust = teile.slice().sort((a, b) => b.d - a.d)[0], gewinn = teile.slice().sort((a, b) => a.d - b.d)[0];
    const saetze = [];
    if (verlust && verlust.d > 15) {
      let warum = '';
      if (verlust.kurve && Number.isFinite(verlust.minA) && Number.isFinite(verlust.minB)) {
        const dv = Math.round(hd4AnKmh(verlust.minA - verlust.minB));
        warum = dv < -3 ? ' Minimum speed is ' + (-dv) + ' km/h lower: you are over-slowing or missing the apex.' : dv > 3 ? ' Minimum speed is ' + dv + ' km/h higher, yet time is lost: too much entry speed is costing the exit.' : ' Minimum speed matches, so the loss is on entry or exit – compare the brake and throttle traces.';
      }
      saetze.push('<b>Biggest loss:</b> ' + (verlust.d / 1000).toFixed(2) + ' s in ' + verlust.name + '.' + warum);
    }
    if (gewinn && gewinn.d < -15) saetze.push('<b>Biggest gain:</b> ' + (-gewinn.d / 1000).toFixed(2) + ' s in ' + gewinn.name + '.');
    if (!saetze.length) saetze.push('The two laps are within two hundredths of each other everywhere.');
    return saetze;
  }

  // ---- DATA SELECTION --------------------------------------------------------------------------
  function hd4AnDaten() {
    let d = {};
    try { d = teleLesen(); } catch (e) { d = {}; }
    const strecken = Object.keys(d).filter((k) => d[k] && d[k].fahrer && Object.keys(d[k].fahrer).length).sort((x, y) => (d[y].datum || 0) - (d[x].datum || 0));
    return { d, strecken };
  }
  function hd4AnRunden(e) {
    // every lap we can show: the last stint's laps, plus best and last of every driver
    const liste = [];
    Object.keys(e.fahrer).forEach((w) => {
      const f = e.fahrer[w];
      const fremd = w.indexOf('fremd:') === 0;
      const runden = !fremd && f.fahrt && f.fahrt.runden ? f.fahrt.runden : [];
      runden.forEach((sp, j) => liste.push({ id: w + '|r' + j, sp, name: 'Lap ' + (sp.runde || j + 1) + (f.beste && sp.ms === f.beste.ms && sp.datum === f.beste.datum ? ' · best' : ''), stint: true, w }));
      if (f.beste) liste.push({ id: w + '|beste', sp: f.beste, name: (fremd ? (f.beste.auto || 'Online') + ' · ' : '') + 'Best lap (all sessions)', w });
      if (f.letzte && !runden.length) liste.push({ id: w + '|letzte', sp: f.letzte, name: 'Last lap', w });
    });
    return liste;
  }

  // ---- SECTOR CONSISTENCY MATRIX ----------------------------------------------------------------
  function hd4AnMatrix(runden, geo, N) {
    const sekt = hd4AnSektoren(geo, N);
    const zeilen = runden.slice(-20).map((r) => {
      const zeit = (k) => (k >= geo.n ? r.sp.ms : r.teile[k]);
      const s = []; for (let i = 0; i < N; i++) s.push(zeit(sekt[i + 1]) - zeit(sekt[i]));
      return { name: r.name, ms: r.sp.ms, s };
    });
    const st = [];
    for (let i = 0; i < N; i++) {
      const w = zeilen.map((z) => z.s[i]);
      const mittel = w.reduce((a, b) => a + b, 0) / w.length;
      const sd = Math.sqrt(w.reduce((a, b) => a + (b - mittel) * (b - mittel), 0) / w.length);
      st.push({ best: Math.min(...w), mittel, sd, cv: mittel > 0 ? sd / mittel : 0 });
    }
    return { sekt, zeilen, st };
  }
  function hd4AnMatrixHtml(mx, N) {
    if (mx.zeilen.length < 2) return '<p class="hd4-leer">The matrix needs at least two recorded laps from one stint on this track.</p>';
    const schlecht = mx.st.reduce((bi, x, i) => (x.cv > mx.st[bi].cv ? i : bi), 0);
    const farbe = (ms, i) => {
      const u = hd4Klemme((ms - mx.st[i].best) / Math.max(40, mx.st[i].best * 0.08), 0, 1);
      return 'background:rgba(' + Math.round(61 + 194 * u) + ',' + Math.round(220 - 128 * u) + ',' + Math.round(132 - 40 * u) + ',' + (0.16 + 0.3 * u).toFixed(2) + ')';
    };
    const rundenSd = Math.sqrt(mx.zeilen.reduce((a, z) => a + Math.pow(z.ms - mx.zeilen.reduce((x, y) => x + y.ms, 0) / mx.zeilen.length, 2), 0) / mx.zeilen.length);
    let h = '<div class="hd4-tabelle-rahmen"><table class="hd4-matrix"><thead><tr><th>Lap</th>';
    for (let i = 0; i < N; i++) h += '<th' + (i === schlecht ? ' class="hd4-mx-schlecht"' : '') + '>Sector ' + (i + 1) + '</th>';
    h += '<th>Lap time</th></tr></thead><tbody>';
    mx.zeilen.forEach((z) => {
      h += '<tr><th>' + hd4Esc(z.name) + '</th>' + z.s.map((ms, i) => '<td style="' + farbe(ms, i) + '"' + (ms === mx.st[i].best ? ' class="hd4-mx-best"' : '') + '>' + (ms / 1000).toFixed(2) + '</td>').join('') + '<td>' + hd4Zeit(z.ms) + '</td></tr>';
    });
    const zeile = (name, fn, klasse) => '<tr class="' + (klasse || '') + '"><th>' + name + '</th>' + mx.st.map((x, i) => '<td' + (i === schlecht && klasse === 'hd4-mx-sd' ? ' class="hd4-mx-schlecht"' : '') + '>' + fn(x) + '</td>').join('');
    h += '</tbody><tfoot>' + zeile('Best', (x) => (x.best / 1000).toFixed(2)) + '<td>' + hd4Zeit(mx.st.reduce((a, x) => a + x.best, 0)) + ' <small>ideal</small></td></tr>'
      + zeile('Average', (x) => (x.mittel / 1000).toFixed(2)) + '<td>' + hd4Zeit(mx.zeilen.reduce((a, z) => a + z.ms, 0) / mx.zeilen.length) + '</td></tr>'
      + zeile('Std deviation', (x) => '±' + (x.sd / 1000).toFixed(3) + ' s <small>' + (x.cv * 100).toFixed(1) + '%</small>', 'hd4-mx-sd') + '<td>±' + (rundenSd / 1000).toFixed(3) + ' s</td></tr></tfoot></table></div>';
    h += '<p class="hd4-befund"><b>Sector ' + (schlecht + 1) + ' has the highest variance</b> (±' + (mx.st[schlecht].sd / 1000).toFixed(3) + ' s, ' + (mx.st[schlecht].cv * 100).toFixed(1) + '% of the sector time) – that is where consistency is breaking down. '
      + 'Ideal lap from best sectors: ' + hd4Zeit(mx.st.reduce((a, x) => a + x.best, 0)) + '.</p>';
    return h;
  }

  // ---- INCIDENT HEATMAP -------------------------------------------------------------------------
  function hd4AnKarte(tiles, liste) {
    const geo = hd4AnGeo(tiles), pts = geo.pts;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const pad = TRACK_HALF_W * 3;
    const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    const w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
    const sw = TRACK_HALF_W * 2;
    let s = '<svg class="hd4-karte-svg" viewBox="' + [x0, y0, w, h].map((v) => v.toFixed(1)).join(' ') + '" role="img" aria-label="Track map with incident markers">'
      + '<path d="M ' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L ') + ' Z" class="hd4-karte-bahn" stroke-width="' + sw.toFixed(1) + '"/>'
      + '<path d="M ' + pts.map((p) => p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' L ') + ' Z" class="hd4-karte-linie" stroke-width="' + (sw * 0.06).toFixed(1) + '"/>';
    const proTeil = new Array(geo.n).fill(0);
    liste.forEach((v, idx) => {
      const k = ((Math.floor(v.o) % geo.n) + geo.n) % geo.n, fr = v.o - Math.floor(v.o);
      proTeil[k]++;
      const i = Math.min(pts.length - 1, geo.tab.start[k] + Math.floor(fr * (geo.tab.zahl[k] || 1)));
      const p = pts[i], q = pts[Math.min(pts.length - 1, i + 1)] || p, r0 = pts[Math.max(0, i - 1)] || p;
      let nx = -(q.y - r0.y), ny = q.x - r0.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      // jitter across the track width (deterministic), so markers at one place do not hide each other
      const quer = (hd4Zufall01(String(v.t) + idx, 'q') - 0.5) * sw * 1.5;
      const art = HD4_VORFALL_ART[v.a] || HD4_VORFALL_ART.off;
      s += '<circle cx="' + (p.x + nx * quer).toFixed(1) + '" cy="' + (p.y + ny * quer).toFixed(1) + '" r="' + (sw * 0.2).toFixed(1) + '" fill="' + art.farbe + '" class="hd4-karte-punkt"><title>' + art.name + ' · piece ' + (k + 1) + '</title></circle>';
    });
    // piece numbers at corners, start/finish marker
    const p0 = pts[0];
    s += '<circle cx="' + p0.x.toFixed(1) + '" cy="' + p0.y.toFixed(1) + '" r="' + (sw * 0.28).toFixed(1) + '" class="hd4-karte-start"/>';
    let nr = 0;
    for (let k = 0; k < geo.n; k++) {
      if (!geo.kurve[k] || (k > 0 && geo.kurve[k - 1])) continue;
      nr++;
      const p = pts[Math.min(pts.length - 1, geo.tab.start[k] + Math.floor((geo.tab.zahl[k] || 1) / 2))];
      s += '<text x="' + p.x.toFixed(1) + '" y="' + (p.y - sw * 0.9).toFixed(1) + '" text-anchor="middle" font-size="' + (sw * 0.6).toFixed(1) + '" class="hd4-karte-text">T' + nr + '</text>';
    }
    return { svg: s + '</svg>', proTeil, geo };
  }
  function hd4AnKarteBefund(proTeil, geo, liste) {
    if (liste.length < 3) return '';
    let best = 0; proTeil.forEach((x, k) => { if (x > proTeil[best]) best = k; });
    if (proTeil[best] < 3 || proTeil[best] / liste.length < 0.2) return '<p class="hd4-befund">Incidents are spread around the lap – no single corner stands out.</p>';
    // name the place: which corner run does this piece belong to, or which one follows?
    let nr = 0, name = '';
    for (let k = 0; k < geo.n; k++) {
      if (geo.kurve[k] && !(k > 0 && geo.kurve[k - 1])) nr++;
      if (k === best) { name = geo.kurve[k] ? 'in T' + nr : 'on the entry to T' + (nr + 1); break; }
    }
    const hier = liste.filter((v) => ((Math.floor(v.o) % geo.n) + geo.n) % geo.n === best);
    const z = {}; hier.forEach((v) => { z[v.a] = (z[v.a] || 0) + 1; });
    const teile = Object.keys(z).map((a) => z[a] + ' ' + (HD4_VORFALL_ART[a] || HD4_VORFALL_ART.off).name.toLowerCase()).join(', ');
    const rat = z.lost >= Math.max(z.off || 0, z.crash || 0) ? 'Check the track surface and the printed code there, and the lighting on that piece.'
      : z.lock ? 'Brake earlier and build the pressure up, or move the brake balance rearwards in the garage.'
      : 'That points to the corner entry: brake a little earlier, or move the brake balance rearwards in the garage; if the cars leave the track there even at low speed, check how the pieces are joined.';
    return '<p class="hd4-befund"><b>' + proTeil[best] + ' of ' + liste.length + ' incidents cluster ' + name + '</b> (piece ' + (best + 1) + ': ' + teile + '). ' + rat + '</p>';
  }

  // ---- THE PAGE ----------------------------------------------------------------------------------
  hd4Schirm({
    id: 'analyse', titel: 'Analysis', kurz: 'Analysis', icon: HD4_ICON.analyse,
    zeichnen(host) {
      const { d, strecken } = hd4AnDaten();
      const vKeys = Object.keys(hd4An.vorfaelle).filter((k) => hd4An.vorfaelle[k].liste.length);
      const alle = strecken.concat(vKeys.filter((k) => strecken.indexOf(k) < 0));
      const jetzt = hd4StreckeKey();
      if (!hd4An.wahl.strecke || alle.indexOf(hd4An.wahl.strecke) < 0) hd4An.wahl.strecke = jetzt && alle.indexOf(jetzt) >= 0 ? jetzt : alle[0] || null;
      const sk = hd4An.wahl.strecke;
      const reiter = [['spuren', 'Trace graphs'], ['sektoren', 'Sector consistency'], ['karte', 'Incident heatmap']];
      let h = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Analysis</h2><p>Compare laps by distance, find where the time goes, see where consistency breaks down and where incidents cluster.</p></div>'
        + '<div class="hd4-leiste"><span class="hd4-segment" role="tablist">' + reiter.map(([id, name]) => '<button type="button" role="tab" data-hd4-an="' + id + '"' + (hd4An.reiter === id ? ' class="an" aria-selected="true"' : ' aria-selected="false"') + '>' + name + '</button>').join('') + '</span>'
        + (alle.length ? '<label class="hd4-feld">Track <select id="hd4-an-strecke">' + alle.map((k) => '<option value="' + hd4Esc(k) + '"' + (k === sk ? ' selected' : '') + '>' + hd4Esc(k) + (k === jetzt ? ' (current)' : '') + '</option>').join('') + '</select></label>' : '') + '</div>';
      const e = sk ? d[sk] : null;
      const runden = e ? hd4AnRunden(e) : [];
      if (hd4An.reiter === 'karte') {
        const v = sk ? hd4An.vorfaelle[sk] : null;
        if (!v || !v.liste.length) h += '<p class="hd4-leer">No incidents recorded on this track yet. Barrier contacts, off-track excursions, tracking losses and lock-ups are recorded during every race on a scanned track.</p>';
        else {
          let tiles = null;
          try { tiles = codeToTrack(v.code).tiles; } catch (e2) { tiles = null; }
          const liste = v.liste.filter((x) => hd4An.wahl.wer === 'alle' || (hd4An.wahl.wer === 'ich' ? x.w === 'p1' : hd4An.wahl.wer === 'npc' ? x.w === 'npc' : x.w !== 'npc'));
          if (!tiles) h += '<p class="hd4-leer">The layout of this track is no longer readable.</p>';
          else {
            const k = hd4AnKarte(tiles, liste);
            const zahl = {}; liste.forEach((x) => { zahl[x.a] = (zahl[x.a] || 0) + 1; });
            h += '<div class="hd4-leiste"><span class="hd4-segment">' + [['alle', 'Everyone'], ['ich', 'Player 1'], ['spieler', 'All players'], ['npc', 'NPCs']].map(([id, name]) => '<button type="button" data-hd4-wer="' + id + '"' + (hd4An.wahl.wer === id ? ' class="an"' : '') + '>' + name + '</button>').join('') + '</span>'
              + '<span class="hd4-legende">' + Object.keys(HD4_VORFALL_ART).map((a) => '<span><i style="background:' + HD4_VORFALL_ART[a].farbe + '"></i>' + HD4_VORFALL_ART[a].name + ' <b>' + (zahl[a] || 0) + '</b></span>').join('') + '</span>'
              + '<button type="button" class="hd4-knopf" id="hd4-an-leeren">Clear this track</button></div>'
              + hd4Karte('', k.svg + hd4AnKarteBefund(k.proTeil, k.geo, liste), 'hd4-breit');
          }
        }
      } else if (!e || !runden.length) {
        h += '<p class="hd4-leer">No recorded lap on this track yet. Drive a race or a time attack on a scanned track: every valid lap is recorded with speed, throttle and brake.</p>';
      } else {
        let tiles = null, geo = null;
        const erste = runden[0].sp;
        try { tiles = codeToTrack(erste.code).tiles; geo = hd4AnGeo(tiles); } catch (e2) { tiles = null; }
        if (!tiles || !geo) h += '<p class="hd4-leer">The layout of this track is no longer readable.</p>';
        else {
          runden.forEach((r) => { try { r.teile = teleAusrichten(r.sp, tiles); } catch (e2) { r.teile = null; } });
          const gut = runden.filter((r) => r.teile && r.sp.code === erste.code);
          if (hd4An.reiter === 'sektoren') {
            const N = hd4.cfg.analyse.sektoren === 4 ? 4 : 3;
            const stint = gut.filter((r) => r.stint);
            h += '<div class="hd4-leiste">' + hd4Wahl('analyse.sektoren', 'Sectors', [[3, '3'], [4, '4']]) + '<span class="hd4-klein">' + stint.length + ' laps recorded in the last stint (the newest 20 are shown).</span></div>'
              + hd4Karte('', hd4AnMatrixHtml(hd4AnMatrix(stint, geo, N), N), 'hd4-breit');
          } else {
            const gibt = (id) => gut.some((r) => r.id === id);
            const stint = gut.filter((r) => r.stint);
            if (!gibt(hd4An.wahl.a)) hd4An.wahl.a = (stint.length ? stint[stint.length - 1] : gut[0]).id;
            if (!gibt(hd4An.wahl.b)) { const beste = gut.slice().sort((x, y) => x.sp.ms - y.sp.ms)[0]; hd4An.wahl.b = (beste.id === hd4An.wahl.a && gut.length > 1 ? gut.find((r) => r.id !== hd4An.wahl.a) : beste).id; }
            const A = gut.find((r) => r.id === hd4An.wahl.a), B = gut.find((r) => r.id === hd4An.wahl.b);
            const opt = (wert) => gut.map((r) => '<option value="' + hd4Esc(r.id) + '"' + (r.id === wert ? ' selected' : '') + '>' + hd4Esc(r.name) + ' (' + hd4Zeit(r.sp.ms) + ')</option>').join('');
            const N = 320;
            const rA = hd4AnRaster(hd4AnRunde(A.sp, A.teile, geo), geo.gesamt, N), rB = hd4AnRaster(hd4AnRunde(B.sp, B.teile, geo), geo.gesamt, N);
            const sekt = hd4AnSektoren(geo, hd4.cfg.analyse.sektoren === 4 ? 4 : 3);
            const diff = A.sp.ms - B.sp.ms;
            hd4An.raster = { rA, rB, geo };
            h += '<div class="hd4-leiste"><label class="hd4-feld"><span class="hd4-ch-key-a"></span>Lap A <select id="hd4-an-a">' + opt(A.id) + '</select></label>'
              + '<label class="hd4-feld"><span class="hd4-ch-key-b"></span>Reference B <select id="hd4-an-b">' + opt(B.id) + '</select></label>'
              + '<span class="hd4-kennzahl"><small>A − B</small><b class="' + (diff <= 0 ? 'hd4-gut' : 'hd4-schlecht') + '">' + (diff > 0 ? '+' : diff < 0 ? '−' : '±') + Math.abs(diff / 1000).toFixed(2) + ' s</b></span>'
              + '<span class="hd4-kennzahl"><small>Lap length</small><b>' + (geo.gesamt / 100).toFixed(2) + ' m</b></span></div>'
              + '<div class="hd4-charts" id="hd4-charts"><div class="hd4-ablese" id="hd4-ablese">Move over the graphs to read the values at one place on the track.</div>'
              + hd4Karte('Speed trace', hd4AnTempoChart(geo, rA, rB, sekt) + '<p class="hd4-klein">Shaded = corners. Dots mark the minimum speed of lap A in each corner.</p>', 'hd4-breit')
              + hd4Karte('Time delta (A against B)', hd4AnDeltaChart(geo, rA, rB, sekt) + hd4AnBefund(geo, rA, rB).map((x) => '<p class="hd4-befund">' + x + '</p>').join(''), 'hd4-breit')
              + hd4Karte('Throttle and brake', hd4AnPedalChart(geo, rA, rB, sekt) + '<p class="hd4-klein">Solid = lap A, dashed = reference B. A brake trace that jumps to the top is abrupt braking; a dip in the throttle trace on exit is a lift.</p>', 'hd4-breit')
              + '</div>';
          }
        }
      }
      host.innerHTML = h + '</div>';
      hd4SchalterVerdrahten(host);
      host.querySelectorAll('[data-hd4-an]').forEach((b) => b.addEventListener('click', () => { hd4An.reiter = b.dataset.hd4An; hd4Neu(); }));
      host.querySelectorAll('[data-hd4-wer]').forEach((b) => b.addEventListener('click', () => { hd4An.wahl.wer = b.dataset.hd4Wer; hd4Neu(); }));
      [['hd4-an-strecke', 'strecke'], ['hd4-an-a', 'a'], ['hd4-an-b', 'b']].forEach(([id, feld]) => {
        const el = host.querySelector('#' + id);
        if (el) el.addEventListener('change', () => { hd4An.wahl[feld] = el.value; if (feld === 'strecke') { hd4An.wahl.a = null; hd4An.wahl.b = null; } hd4Neu(); });
      });
      const leeren = host.querySelector('#hd4-an-leeren');
      if (leeren) leeren.addEventListener('click', () => { delete hd4An.vorfaelle[sk]; hd4Schreiben(HD4_VORFALL_STORE, hd4An.vorfaelle); hd4Neu(); });
      hd4AnAbleseVerdrahten(host);
    },
  });
  // One crosshair through all three graphs, and the values of both laps at that place.
  function hd4AnAbleseVerdrahten(host) {
    const box = host.querySelector('#hd4-charts'), text = host.querySelector('#hd4-ablese');
    if (!box || !text || !hd4An.raster) return;
    const svgs = Array.from(box.querySelectorAll('svg.hd4-chart'));
    const linien = svgs.map((svg) => {
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('class', 'hd4-ch-faden'); l.setAttribute('y1', '0'); l.setAttribute('y2', svg.viewBox.baseVal.height); l.setAttribute('visibility', 'hidden');
      svg.appendChild(l);
      return l;
    });
    const zeigen = (ev) => {
      const svg = ev.target.closest('svg.hd4-chart');
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width * HD4_AN_W;
      const { rA, rB, geo } = hd4An.raster;
      const s = hd4Klemme((x - HD4_AN_L) / (HD4_AN_W - HD4_AN_L - HD4_AN_R), 0, 1) * geo.gesamt;
      const i = Math.round(s / geo.gesamt * (rA.length - 1));
      const a = rA[i], b = rB[i];
      linien.forEach((l) => { l.setAttribute('x1', hd4AnX(s, geo.gesamt)); l.setAttribute('x2', hd4AnX(s, geo.gesamt)); l.setAttribute('visibility', 'visible'); });
      const dd = (a.t - b.t) / 1000;
      text.innerHTML = '<b>' + (s / 100).toFixed(2) + ' m</b><span>Speed A <b>' + Math.round(hd4AnKmh(a.v)) + '</b> · B <b>' + Math.round(hd4AnKmh(b.v)) + '</b> km/h</span>'
        + '<span>Delta <b class="' + (dd <= 0 ? 'hd4-gut' : 'hd4-schlecht') + '">' + (dd > 0 ? '+' : dd < 0 ? '−' : '±') + Math.abs(dd).toFixed(2) + ' s</b></span>'
        + '<span>Throttle A <b>' + Math.round(a.gas) + '%</b> · B <b>' + Math.round(b.gas) + '%</b></span><span>Brake A <b>' + Math.round(a.br) + '%</b> · B <b>' + Math.round(b.br) + '%</b></span>';
    };
    box.addEventListener('pointermove', zeigen);
    box.addEventListener('pointerdown', zeigen);
  }
