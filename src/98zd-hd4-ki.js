  // =========================================================================
  // Hybrid Dash 4.0: THE DRIVER BRAIN (human-like NPC opponents)
  // =========================================================================
  //
  // What the NPCs already had (90-ghosts.js) and keep: the racing line (outside - apex - outside
  // over whole corner sequences), braking profiles, slipstream, attack and defend, a per-race
  // character, and a lap-by-lap search for pace.
  //
  // What was missing for them to feel like drivers:
  //
  //   1. THEY DID NOT KNOW THE TRACK. Every NPC was as fast in lap 1 as in lap 20, and a corner
  //      it flew off in was taken the same way next lap. Now each driver keeps a pace factor PER
  //      TRACK PIECE: he starts a new circuit on a sighting pace, gains confidence on every clean
  //      pass, and backs off - on that piece and the one before it - where he went off. The
  //      memory is stored per circuit and driver, so next race night he still knows the place.
  //
  //   2. THEY DID NOT KNOW EACH OTHER. Now a driver remembers, per rival, where a pass worked and
  //      how often he lost out. Behind a known rival he commits where it worked before and stays
  //      patient elsewhere; against someone who keeps beating him he stops throwing it in.
  //
  //   3. THEY WERE MACHINES. Now each driver has a lasting personality (from his name, not
  //      re-rolled): courage, consistency, nerves, how fast he learns, how he looks after his
  //      tyres. Form drifts over a stint, pressure from behind causes hesitations in nervous
  //      drivers, and a driver alone on track settles into a rhythm instead of qualifying laps.
  //
  // One hook each: hd4KiTempo() multiplies the NPC's target pace (before flags, corner and
  // traffic rules - so yellow flags, pit limiter and hairpin limits still have the last word),
  // hd4KiKachel() is called at every piece change.

  var HD4_KI_STORE = 'ki.v1';
  var hd4Ki = { mem: hd4Lesen(HD4_KI_STORE, {}), schmutzig: false, klasse: 1 };
  var HD4_KI_TYPEN = [
    { id: 'aggressor', name: 'Aggressor', text: 'Late on the brakes, first to attack.' },
    { id: 'metronom', name: 'Metronome', text: 'Lap after lap within a tenth.' },
    { id: 'stratege', name: 'Strategist', text: 'Saves the tyres, strikes late in the stint.' },
    { id: 'rookie', name: 'Rookie', text: 'Quick, but cracks under pressure.' },
    { id: 'veteran', name: 'Veteran', text: 'Learns a track in three laps and rarely errs.' },
  ];
  function hd4KiPerson(car) {
    const name = hd4AutoName(car) + '|' + (hd4AutoId(car) || '');
    const z = (salz) => hd4Zufall01(name, salz);
    const P = { mut: z('mut'), konstanz: z('konstanz'), nerven: z('nerven'), lernrate: 0.6 + 0.8 * z('lern'), pflege: z('pflege') };
    // The type is the label for the strongest trait - it describes the numbers, it does not set them.
    let typ = 'metronom';
    if (P.mut > 0.66 && P.mut >= P.konstanz) typ = 'aggressor';
    else if (P.nerven < 0.3) typ = 'rookie';
    else if (P.lernrate > 1.15 && P.nerven > 0.6) typ = 'veteran';
    else if (P.pflege > 0.65) typ = 'stratege';
    P.typ = HD4_KI_TYPEN.find((x) => x.id === typ);
    return P;
  }
  function hd4KiSpeicher(car, anlegen) {
    const sk = hd4StreckeKey(), id = hd4AutoId(car);
    if (!sk || !id) return null;
    let n = 0;
    try { n = currentTrackTiles.length; } catch (e) { n = 0; }
    let s = hd4Ki.mem[sk];
    if (!s) { if (!anlegen) return null; s = hd4Ki.mem[sk] = { datum: Date.now(), fahrer: {} }; }
    let m = s.fahrer[id];
    if (!m || !Array.isArray(m.f) || m.f.length !== n) {
      if (!anlegen) return null;
      // A new circuit: sighting pace everywhere. Experience on other circuits shortens it a little.
      m = s.fahrer[id] = { name: hd4AutoName(car), f: new Array(n).fill(0.93), ab: new Array(n).fill(0), runden: 0, rivalen: {} };
    }
    s.datum = Date.now();
    return m;
  }
  function hd4KiZustand(car) {
    if (!car.hd4ki || car.hd4ki.id !== hd4AutoId(car)) {
      car.hd4ki = { id: hd4AutoId(car), P: hd4KiPerson(car), offsVor: null, vorsichtBis: 0, zoegernBis: 0, druckSeit: 0,
                    vorn: null, vornGap: null, nahAt: 0, nah: null, phase: hd4Zufall01(hd4AutoId(car) || 'x', 'phase') * 6.28, faktor: 1 };
    }
    return car.hd4ki;
  }
  // The nearest cars ahead and behind, in track pieces. Cached: asked every 45 ms, changes slowly.
  function hd4KiNah(car, st, now) {
    if (st.nah && now - st.nahAt < 220) return st.nah;
    let vorn = null, hinten = null;
    try { vorn = ghostAhead(car); } catch (e) { vorn = null; }
    try { hinten = ghostHinterMir(car); } catch (e) { hinten = null; }
    st.nah = { vorn, hinten }; st.nahAt = now;
    return st.nah;
  }

  // ---- hook: every piece change of an NPC ---------------------------------------------------
  function hd4KiKachel(car, now) {
    if (!hd4 || !hd4.cfg.ki.an || !car || !car.ghost) return;
    if (car.role !== 'ghost' || !hd4RennenLaeuft()) return;
    const g = car.ghost;
    let n = 0;
    try { n = currentTrackTiles.length; } catch (e) { n = 0; }
    if (!n || g.tileIndex === null || g.tileIndex === undefined) return;
    const st = hd4KiZustand(car);
    const k = ((g.tileIndex - 1) % n + n) % n;          // the piece just driven
    const m = hd4KiSpeicher(car, true);
    if (!m) return;
    let gelb = false;
    try { gelb = flagState !== 'green' || !!raceFormationLap; } catch (e) { gelb = false; }
    const offs = (car.race && car.race.offLap) || 0;
    if (st.offsVor === null) st.offsVor = offs;
    if (hd4.cfg.ki.lernen && !gelb && !g.pit) {
      if (offs > st.offsVor) {
        // Went off: he remembers the piece and the approach to it, and drives the next seconds shaken.
        m.ab[k] = Math.min(9, (m.ab[k] || 0) + 1);
        m.f[k] = Math.max(0.80, m.f[k] * 0.93);
        const vor = (k - 1 + n) % n;
        m.f[vor] = Math.max(0.82, m.f[vor] * 0.96);
        st.vorsichtBis = now + 3500 + 3000 * (1 - st.P.nerven);
      } else {
        // Clean: a little more confidence, quickly at first, then tenths. The ceiling is lower
        // where he has been off before - once bitten.
        const decke = 1.02 + 0.07 * st.P.mut - 0.03 * Math.min(3, m.ab[k] || 0) / 3;
        const schritt = (m.f[k] < 0.98 ? 0.014 : 0.004) * st.P.lernrate;
        m.f[k] = Math.min(decke, m.f[k] + schritt);
      }
      hd4Ki.schmutzig = true;
    }
    st.offsVor = offs;
    if (g.tileIndex === 0) m.runden = (m.runden || 0) + 1;

    // ---- rivals: who was just ahead and is now behind? ----
    if (hd4.cfg.ki.rivalen && !gelb) {
      st.nah = null;                                    // fresh, not the cached pair
      const nah = hd4KiNah(car, st, now);
      const vornId = nah.vorn && nah.vorn.gap < 2.2 ? hd4AutoId(nah.vorn.car) : null;
      const hintenId = nah.hinten && nah.hinten.gap < 2.2 ? hd4AutoId(nah.hinten.car) : null;
      if (st.vorn && hintenId === st.vorn && vornId !== st.vorn) {
        // passed him on this piece
        const r = m.rivalen[st.vorn] || (m.rivalen[st.vorn] = { vorbei: 0, verloren: 0, zone: {} });
        r.vorbei++; r.zone[k] = (r.zone[k] || 0) + 1;
        const anderer = garage.find((c) => hd4AutoId(c) === st.vorn);
        if (anderer && anderer.role === 'ghost') {
          const m2 = hd4KiSpeicher(anderer, true);
          if (m2) { const r2 = m2.rivalen[st.id] || (m2.rivalen[st.id] = { vorbei: 0, verloren: 0, zone: {} }); r2.verloren++; }
        }
        hd4Ki.schmutzig = true;
      }
      st.vorn = vornId;
    }
  }

  // ---- hook: the factor on an NPC's target pace, every control tick ----------------------------
  function hd4KiTempo(car, now, dt) {
    if (!hd4 || !hd4.cfg.ki.an || !car || !car.ghost || car.role !== 'ghost') return 1;
    if (!hd4RennenLaeuft()) return 1;
    const g = car.ghost;
    let n = 0;
    try { n = currentTrackTiles.length; } catch (e) { n = 0; }
    const st = hd4KiZustand(car);
    let f = hd4Ki.klasse;
    const k = n && g.tileIndex !== null && g.tileIndex !== undefined ? ((g.tileIndex % n) + n) % n : -1;
    const m = k >= 0 ? hd4KiSpeicher(car, true) : null;
    // 1. what he knows about this piece (and already about the next one)
    if (hd4.cfg.ki.lernen && m) f *= 0.6 * m.f[k] + 0.4 * m.f[(k + 1) % n];
    // 2. the human part
    if (hd4.cfg.ki.menschlich) {
      const P = st.P;
      // form: a slow wave of up to +-2 % for the least consistent driver
      st.phase += (dt || 0.045) * (0.05 + 0.04 * P.mut);
      f *= 1 + 0.02 * (1 - P.konstanz) * Math.sin(st.phase);
      const nah = hd4KiNah(car, st, now);
      const hintenNah = nah.hinten && nah.hinten.gap < 0.7;
      const vornNah = nah.vorn && nah.vorn.gap < 2.5;
      // pressure from behind
      if (hintenNah) {
        if (!st.druckSeit) st.druckSeit = now;
        if (now - st.druckSeit > 5000) {
          if (now > st.zoegernBis && Math.random() < (dt || 0.045) * 0.05 * (1 - P.nerven)) st.zoegernBis = now + 450;   // a hesitation
          else if (P.nerven > 0.6) f *= 1.008;                         // digs in
        }
      } else st.druckSeit = 0;
      if (now < st.zoegernBis) f *= 0.90;
      if (now < st.vorsichtBis) f *= 0.96;                             // shaken after an off
      // alone on track: a rhythm he can hold, not qualifying laps
      const allein = (!nah.vorn || nah.vorn.gap > 4) && (!nah.hinten || nah.hinten.gap > 4);
      if (allein && (g.laps || 0) >= 2) f *= 1 - 0.014 * P.pflege;
      // 3. rivals: commit where it worked before, patience where it never does
      if (hd4.cfg.ki.rivalen && vornNah && m) {
        const r = m.rivalen[hd4AutoId(nah.vorn.car)];
        if (r) {
          const hier = (r.zone[k] || 0) + (r.zone[(k + 1) % n] || 0);
          if (hier > 0) f *= 1.02 + 0.012 * Math.min(3, hier) * (0.5 + 0.5 * P.mut);
          else if (r.verloren > r.vorbei + 2) f *= 0.992;
        } else if (nah.vorn.gap < 1.2) f *= 1 + 0.01 * P.mut;         // unknown rival: probing
      }
    }
    // 4. the track itself: rubber helps, drizzle hurts (the players feel it through grip)
    if (hd4.cfg.sim.evolution !== 'aus') f *= (1 + 0.02 * hd4Sim.gummi) * (1 - 0.08 * hd4Sim.niesel);
    f = hd4Klemme(f, 0.78, 1.14);
    st.faktor = f;
    return f;
  }

  // save every 20 s while racing, and once more when the race is over
  var hd4KiWarRennen = false, hd4KiGespeichert = 0;
  function hd4KiSichern() {
    if (!hd4Ki.schmutzig) return;
    // keep the 12 most recent circuits
    const keys = Object.keys(hd4Ki.mem).sort((a, b) => (hd4Ki.mem[b].datum || 0) - (hd4Ki.mem[a].datum || 0));
    keys.slice(12).forEach((k) => delete hd4Ki.mem[k]);
    Object.keys(hd4Ki.mem).forEach((k) => Object.values(hd4Ki.mem[k].fahrer).forEach((m) => { m.f = m.f.map((x) => Math.round(x * 1000) / 1000); }));
    hd4Schreiben(HD4_KI_STORE, hd4Ki.mem);
    hd4Ki.schmutzig = false;
  }
  hd4Takt((dt, jetzt) => {
    const laeuft = hd4RennenLaeuft();
    if ((laeuft && jetzt - hd4KiGespeichert > 20000) || (!laeuft && hd4KiWarRennen)) { hd4KiGespeichert = jetzt; hd4KiSichern(); }
    hd4KiWarRennen = laeuft;
  });

  function hd4KiWissen(m) {
    if (!m || !m.f.length) return 0;
    const mittel = m.f.reduce((a, b) => a + b, 0) / m.f.length;
    return hd4Klemme((mittel - 0.93) / 0.09, 0, 1);
  }

  hd4Schirm({
    id: 'ki', titel: 'AI drivers', kurz: 'AI drivers', icon: HD4_ICON.ki,
    zeichnen(host) {
      let npcs = [];
      try { npcs = garage.filter((c) => c.device && c.role === 'ghost'); } catch (e) { npcs = [] }
      const sk = hd4StreckeKey();
      const balken = (v, farbe) => '<span class="hd4-balken"><span style="width:' + Math.round(hd4Klemme(v, 0, 1) * 100) + '%;background:' + (farbe || 'var(--hd4-akzent)') + '"></span></span>';
      const nameVon = (id) => { const c = garage.find((x) => hd4AutoId(x) === id); return c ? hd4AutoName(c) : 'a rival'; };
      const karten = npcs.map((car) => {
        const P = hd4KiPerson(car), m = hd4KiSpeicher(car, false);
        const wissen = hd4KiWissen(m);
        let rivalen = '';
        if (m) {
          rivalen = Object.keys(m.rivalen).map((id) => { const r = m.rivalen[id]; const zonen = Object.keys(r.zone).length;
            return '<li><b>' + hd4Esc(nameVon(id)) + '</b> passed ' + r.vorbei + '×, lost out ' + r.verloren + '×' + (zonen ? ' · knows ' + zonen + ' passing place' + (zonen > 1 ? 's' : '') : '') + '</li>'; }).join('');
        }
        let farbe = '#888';
        try { farbe = carColor(car).hex; } catch (e) { /* default */ }
        const gefahr = m ? m.ab.map((x, i) => (x > 0 ? 'T' + (i + 1) : null)).filter(Boolean) : [];
        return '<article class="hd4-fahrer"><div class="hd4-fahrer-kopf"><span class="hd4-punkt" style="background:' + farbe + '"></span><div><b>' + hd4Esc(hd4AutoName(car)) + '</b><small>' + P.typ.name + ' · ' + P.typ.text + '</small></div></div>'
          + '<dl class="hd4-werte"><dt>Courage</dt><dd>' + balken(P.mut) + '</dd><dt>Consistency</dt><dd>' + balken(P.konstanz) + '</dd><dt>Nerves</dt><dd>' + balken(P.nerven) + '</dd>'
          + '<dt>Learning</dt><dd>' + balken((P.lernrate - 0.6) / 0.8) + '</dd><dt>Tyre care</dt><dd>' + balken(P.pflege) + '</dd></dl>'
          + '<div class="hd4-wissen"><span>Knows this track</span>' + balken(wissen, '#3ddc84') + '<b>' + Math.round(wissen * 100) + '%</b></div>'
          + '<p class="hd4-klein">' + (m ? m.runden + ' laps here' + (gefahr.length ? ' · careful at ' + gefahr.slice(0, 6).join(', ') : ' · no offs yet') : 'Has not driven this track yet – starts on a sighting pace.') + '</p>'
          + (rivalen ? '<ul class="hd4-rivalen">' + rivalen + '</ul>' : '') + '</article>';
      }).join('');
      host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>AI drivers</h2><p>Every NPC is a driver with a lasting personality. They learn each track piece by piece, remember where they went off, and learn where passes work against each rival – including you.</p></div>'
        + '<div class="hd4-raster2">' + hd4Karte('Driver brain', hd4Schalter('ki.an', 'Human-like AI', 'Master switch. Off = the NPCs drive exactly as in Hybrid Dash 3.0.')
          + hd4Schalter('ki.lernen', 'Learn the track', 'Sighting pace on a new circuit, more confidence with every clean pass, caution where they went off. Remembered per circuit.')
          + hd4Schalter('ki.rivalen', 'Learn the rivals', 'Commit where a pass worked before, stay patient elsewhere, respect drivers who keep beating them.')
          + hd4Schalter('ki.menschlich', 'Human traits', 'Form that drifts over a stint, hesitations under pressure, a rhythm when alone on track.')
          + '<div class="hd4-knopfreihe"><button type="button" class="hd4-knopf" id="hd4-ki-vergessen"' + (sk && hd4Ki.mem[sk] ? '' : ' disabled') + '>Forget this track</button>'
          + '<button type="button" class="hd4-knopf" id="hd4-ki-alles">Forget everything</button></div>')
        + hd4Karte('On this track', npcs.length ? '<div class="hd4-fahrer-liste">' + karten + '</div>'
          : '<p class="hd4-leer">No NPCs connected. Give a car the role “NPC” in the garage – its driver profile appears here.</p>', 'hd4-breit')
        + '</div></div>';
      hd4SchalterVerdrahten(host);
      const v = host.querySelector('#hd4-ki-vergessen');
      if (v) v.addEventListener('click', () => { if (sk) { delete hd4Ki.mem[sk]; hd4Schreiben(HD4_KI_STORE, hd4Ki.mem); hd4Toast('AI: track forgotten'); hd4Neu(); } });
      const a = host.querySelector('#hd4-ki-alles');
      if (a) a.addEventListener('click', () => { hd4Ki.mem = {}; hd4Schreiben(HD4_KI_STORE, hd4Ki.mem); hd4Toast('AI: memory cleared'); hd4Neu(); });
    },
  });
