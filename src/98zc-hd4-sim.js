  // =========================================================================
  // Hybrid Dash 4.0: RACE STRATEGY SIMULATION
  // =========================================================================
  //
  // What was already there and stays the single source of truth (40-physics.js / 70-race.js):
  //   tank level, fuel weight (massFactor: a full tank accelerates AND brakes worse, so a car
  //   gets quicker as the stint goes on), tyre temperature and wear per wheel, three slick
  //   compounds plus rain, brake temperature and fade, the pit stop with its mini-game.
  //
  // What this file adds ON TOP, each a factor on a quantity that exists - never a second copy:
  //
  //   ENGINE MAPS      Rich / Standard / Lean per driver: power and fuel burn.
  //   THROTTLE BURN    consumption is over-proportional at wide-open throttle and grows while
  //                    the throttle stays pinned; disciplined part throttle saves fuel.
  //   TYRE CLIFF       past a compound's window grip no longer fades linearly, it drops.
  //   FLAT SPOTS       an unmanaged lock-up leaves a flat spot: vibration, grip that flutters
  //                    with the wheel rotation, faster front wear - until the tyres are changed.
  //   TRACK EVOLUTION  rubber builds up with every lap driven; light rain washes it away.
  //   FAILURES         optional hardcore mode: thermal throttling, brake fade warnings, damage
  //                    from impacts - cleared by a pit stop.
  //   PIT RULES        speeding at pit entry is a time penalty; the crew works in sequence
  //                    (fuel 3 s, tyres 4 s, full service with wing 7-8 s).
  //
  // Hooks in the older files: hd4Verbrauch / hd4Leistung (70-race.js fuel and derate),
  // hd4GripNach (mischungAnwenden), hd4SimEingabe (50-drive.js physicsStep),
  // hd4PitZustand / hd4PitBereit (pit lane), hd4Vorfall (registerCrash).

  var HD4_MODI = {
    rich: { name: 'Rich', kurz: 'RICH', leistung: 1.00, verbrauch: 1.32, hitze: 1.6, farbe: '#ff5a4d', text: 'Maximum power, high fuel burn' },
    std:  { name: 'Standard', kurz: 'STD', leistung: 0.965, verbrauch: 1.00, hitze: 1.0, farbe: '#f4f6fb', text: 'Balanced pace and fuel burn' },
    lean: { name: 'Lean', kurz: 'LEAN', leistung: 0.915, verbrauch: 0.72, hitze: 0.6, farbe: '#3ddc84', text: 'Reduced power to stretch a stint' },
  };
  var HD4_MODUS_FOLGE = ['std', 'rich', 'lean'];
  // Where each compound falls off (share of wear) and how hard.
  var HD4_KLIPPE = {
    weich:  { ab: 0.55, tief: 0.34 },
    mittel: { ab: 0.74, tief: 0.24 },
    hart:   { ab: 0.90, tief: 0.16 },
    regen:  { ab: 0.72, tief: 0.24 },
  };
  var HD4_DEFEKTE = {
    thermal: { name: 'Battery thermal throttling', kurz: 'THERMAL', leistung: 0.80, grip: 1, text: 'Power reduced until the pack cools down - lift, switch to Lean, or box.' },
    bremse:  { name: 'Brake fade', kurz: 'BRAKES', leistung: 1, grip: 0.97, text: 'Brakes are overheating: brake earlier and softer.' },
    fahrwerk: { name: 'Suspension damage', kurz: 'SUSP', leistung: 1, grip: 0.90, text: 'Bent suspension after the impact: box for repairs.' },
    antrieb: { name: 'Drivetrain damage', kurz: 'DRIVE', leistung: 0.86, grip: 1, text: 'Power loss after the impact: box for repairs.' },
  };

  var hd4Sim = {
    p: {},                 // per player: see hd4SimPlatz
    gummi: 0,              // rubber on the racing line, 0..1
    niesel: 0, nieselZiel: 0, nieselBis: 0,
    runden: 0,             // car-laps driven in this session (all cars)
    rundenGesehen: {},
    pit: null,             // player 1's running stop: { soll, fluegel }
    testPause: false,
  };
  function hd4SimPlatz(nr) {
    return hd4Sim.p[nr] || (hd4Sim.p[nr] = {
      modus: 'std', wot: 0, platt: 0, lock: 0, bremseVor: 0, bremseSeit: 0, phase: 0,
      hitze: 0, defekt: null, klippeGemeldet: false, plattGemeldet: false, wearVor: 0,
      aero: 0, aeroWunsch: 0, verbrauchSumme: 0, rundeFuel: null, proRunde: [], boxVor: 'aus',
      upgrades: null,
    });
  }
  function hd4SimAktiv() { return !!hd4 && !hd4Sim.testPause && hd4RennenLaeuft(); }
  function hd4SimReset() {
    Object.keys(hd4Sim.p).forEach((nr) => {
      const p = hd4Sim.p[nr];
      Object.assign(p, { wot: 0, platt: 0, lock: 0, hitze: 0, defekt: null, klippeGemeldet: false, plattGemeldet: false,
        verbrauchSumme: 0, rundeFuel: null, proRunde: [], aeroWunsch: p.aero });
    });
    hd4Sim.gummi = 0; hd4Sim.niesel = 0; hd4Sim.nieselZiel = 0; hd4Sim.nieselBis = 0; hd4Sim.runden = 0; hd4Sim.rundenGesehen = {};
    hd4Sim.pit = null;
  }

  // ---- ENGINE MAPS -----------------------------------------------------------------------
  function hd4Modus(nr) { return HD4_MODI[hd4SimPlatz(nr || 1).modus] || HD4_MODI.std; }
  function hd4ModusSetzen(nr, id, still) {
    if (!HD4_MODI[id]) return;
    const p = hd4SimPlatz(nr);
    if (p.modus === id) return;
    p.modus = id;
    if (!still) {
      hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + 'Engine map ' + HD4_MODI[id].name.toUpperCase());
      try { padRumble(0.12, 0.25, 90, 'meldung', nr); } catch (e) { /* no pad */ }
    }
    hd4HudMalen();
  }
  function hd4ModusWeiter(nr) {
    const p = hd4SimPlatz(nr);
    hd4ModusSetzen(nr, HD4_MODUS_FOLGE[(HD4_MODUS_FOLGE.indexOf(p.modus) + 1) % HD4_MODUS_FOLGE.length]);
  }
  // Called from fuelTankTick / tankTickVon: the factor on the fuel burnt this tick.
  function hd4Verbrauch(wer, throttle) {
    if (!hd4SimAktiv()) return 1;
    const nr = wer || 1, p = hd4SimPlatz(nr), c = hd4.cfg.sim;
    let f = 1;
    if (c.gasVerbrauch) {
      const g = Math.min(1, Math.abs(throttle || 0));
      // Part throttle is cheap, wide open is expensive: 0.80 at 30 %, 1.0 at 70 %, 1.22 flat out,
      // and up to another 10 % once the throttle has been pinned for more than two seconds.
      f *= 0.74 + 0.48 * g * g + 0.10 * hd4Klemme((p.wot - 2) / 4, 0, 1);
    }
    if (c.motorModi) f *= hd4Modus(nr).verbrauch;
    if (p.upgrades && p.upgrades.sprit) f *= 1 - 0.04 * p.upgrades.sprit;
    return f;
  }
  // Called from fuelDamageDerate: the factor on the throttle the physics sees.
  function hd4Leistung(wer) {
    if (!hd4SimAktiv()) return 1;
    const nr = wer || 1, p = hd4SimPlatz(nr), c = hd4.cfg.sim;
    let f = 1;
    let sprit = true;
    try { sprit = fuelSimOn(); } catch (e) { sprit = true; }
    if (c.motorModi && sprit) f *= hd4Modus(nr).leistung;
    if (p.defekt && HD4_DEFEKTE[p.defekt.art]) f *= HD4_DEFEKTE[p.defekt.art].leistung;
    f *= 1 - 0.012 * Math.max(0, p.aero);        // more wing, more drag
    return f;
  }

  // ---- GRIP: cliff, flat spot, track evolution, failures ----------------------------------
  function hd4MixVon(nr) {
    try { return nr >= 2 ? zusatzPlatz(nr).reifen : tyres; } catch (e) { return 'mittel'; }
  }
  function hd4Klippe(mix, wear) {
    const k = HD4_KLIPPE[mix] || HD4_KLIPPE.mittel;
    if (!(wear > k.ab)) return 1;
    const u = Math.min(1, (wear - k.ab) / Math.max(0.02, 1 - k.ab));
    return 1 - k.tief * u * u;                    // exponential-looking drop past the threshold
  }
  // Track state: rubber adds grip on slicks; light rain takes it and washes the rubber off.
  function hd4StreckeGrip(mix) {
    const g = 1 + 0.045 * hd4Sim.gummi - 0.02 * (1 - Math.min(1, hd4Sim.runden / 6)) * (hd4.cfg.sim.evolution === 'aus' ? 0 : 1);
    const nass = mix === 'regen' ? 0.03 : 0.15;   // rain tyres barely notice a drizzle
    return g * (1 - nass * hd4Sim.niesel);
  }
  function hd4GripFaktor(nr, motor) {
    if (!hd4SimAktiv() || !motor) return 1;
    const p = hd4SimPlatz(nr), c = hd4.cfg.sim, st = motor.state;
    let reifenAn = true;
    try { reifenAn = tyreSimOn(); } catch (e) { reifenAn = true; }
    let f = 1;
    const mix = hd4MixVon(nr);
    if (c.reifenKlippe && reifenAn) f *= hd4Klippe(mix, st.tyreWear || 0);
    if (c.bremsplatten && p.platt > 0) {
      // The flat spot comes round once per wheel revolution: grip flutters with speed.
      const flattern = 0.5 + 0.5 * Math.sin(p.phase);
      f *= 1 - p.platt * (0.05 + 0.07 * flattern);
    }
    if (c.evolution !== 'aus') f *= hd4StreckeGrip(mix);
    if (p.defekt && HD4_DEFEKTE[p.defekt.art]) f *= HD4_DEFEKTE[p.defekt.art].grip;
    f *= 1 + 0.015 * p.aero;                      // front wing: more bite
    return f;
  }
  // Layer the factor over whatever the app wrote as grip. `basis` follows every outside write.
  function hd4GripSetzen(nr, motor) {
    if (!motor || !motor.config) return;
    const c = motor.config;
    const h = motor.hd4g || (motor.hd4g = { basis: c.gripScale, gesetzt: null });
    if (h.gesetzt === null || Math.abs(c.gripScale - h.gesetzt) > 1e-9) h.basis = c.gripScale;
    const f = hd4GripFaktor(nr, motor);
    h.gesetzt = h.basis * f;
    c.gripScale = h.gesetzt;
  }
  // Hook: right after mischungAnwenden() wrote a fresh base grip.
  function hd4GripNach(motor) {
    if (!hd4 || !motor) return;
    if (motor.hd4g) { motor.hd4g.basis = motor.config.gripScale; motor.hd4g.gesetzt = null; }
    const nr = motor.spieler || 1;
    try { if (nr === 1 ? motor === physEngine : zusatzPlatz(nr) && zusatzPlatz(nr).motor === motor) hd4GripSetzen(nr, motor); } catch (e) { /* loading */ }
  }

  // ---- FLAT SPOTS ---------------------------------------------------------------------------
  // "Heavy, unmanaged lock-ups": the brake is stamped on (no build-up) at speed, or held at the
  // stop while steering hard. A managed stop - progressive, released into the corner - is free.
  function hd4SimEingabe(nr, gas, bremse, dt) {
    if (!hd4SimAktiv()) return;
    const p = hd4SimPlatz(nr);
    const sp = hd4Spieler().find((s) => s.nr === nr);
    if (!sp || !sp.motor) return;
    const st = sp.motor.state, cfg = sp.motor.config;
    const v = Math.min(1, Math.abs(st.speedKmh || 0) / Math.max(0.01, cfg.topSpeedKmh || 1));
    dt = hd4Klemme(dt || 0.045, 0, 0.25);
    gas = Math.max(0, gas || 0); bremse = Math.max(0, bremse || 0);
    // wide-open-throttle clock for the burn model
    p.wot = gas > 0.92 ? p.wot + dt : Math.max(0, p.wot - dt * 3);
    // wheel rotation phase for the flat-spot flutter (and its rumble)
    p.phase = (p.phase + dt * (6 + 60 * v)) % (Math.PI * 2);
    if (hd4.cfg.sim.bremsplatten) {
      const jetzt = Date.now();
      if (bremse > 0.15 && p.bremseVor <= 0.15) p.bremseSeit = jetzt;
      const abrupt = bremse > 0.9 && jetzt - p.bremseSeit < 140;         // stamped, not squeezed
      let lenk = 0;
      try { lenk = Math.abs(nr === 1 ? steerX : sp.z.steer) || 0; } catch (e) { lenk = 0; }
      const ueberlast = bremse > 0.9 && lenk > 0.45;                      // full brake while turning in
      let nass = 0;
      try { nass = wxRainLevel(); } catch (e) { nass = 0; }
      const gefahr = (abrupt || ueberlast || (p.lock > 0 && bremse > 0.9)) && v > 0.45;
      if (gefahr) p.lock += dt * (1 + nass + hd4Sim.niesel);
      else p.lock = Math.max(0, p.lock - dt * 2);
      if (p.lock > 0.42) {
        const neu = Math.min(1, p.platt + 0.22 + 0.25 * v);
        hd4Plattgebremst(nr, neu, sp);
        p.lock = 0;
      }
      p.bremseVor = bremse;
      if (p.platt > 0) {
        // accelerated local wear on the flat-spotted front axle
        let reifenAn = true;
        try { reifenAn = tyreSimOn(); } catch (e) { reifenAn = true; }
        if (reifenAn && st.tyreWear4) {
          const extra = 0.0016 * p.platt * v * dt * (cfg.tyreEffect || 1);
          st.tyreWear4[0] = Math.min(1, st.tyreWear4[0] + extra);
          st.tyreWear4[1] = Math.min(1, st.tyreWear4[1] + extra);
        }
        // vibration: one pulse per wheel revolution, stronger with the size of the flat spot
        if (v > 0.25 && Math.sin(p.phase) > 0.92 && jetzt - (p.rumpelAt || 0) > 90) {
          p.rumpelAt = jetzt;
          try { padRumble(0.10 + 0.25 * p.platt, 0.25 + 0.4 * p.platt, 45, 'reifen', nr); } catch (e) { /* no pad */ }
        }
      }
    }
    // thermal load for the failure model
    if (hd4.cfg.sim.defekte) {
      const last = gas * gas * (hd4.cfg.sim.motorModi ? hd4Modus(nr).hitze : 1);
      p.hitze = hd4Klemme(p.hitze + (last * 0.030 - 0.016 * (0.4 + v)) * dt, 0, 1.2);
    } else p.hitze = 0;
  }
  function hd4Plattgebremst(nr, wert, sp) {
    const p = hd4SimPlatz(nr);
    const erstes = p.platt <= 0;
    p.platt = wert;
    hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + (erstes ? 'LOCK-UP – FLAT SPOT' : 'FLAT SPOT WORSE'));
    try { padRumble(0.7, 0.5, 260, 'crash', nr); } catch (e) { /* no pad */ }
    try { log((nr > 1 ? 'P' + nr + ': ' : '') + 'Lock-up, flat spot ' + Math.round(wert * 100) + ' %.', 'warn'); } catch (e) { /* log */ }
    if (typeof hd4VorfallMerken === 'function') hd4VorfallMerken('lock', nr);
    if (typeof hd4Funk === 'function' && nr === 1) hd4Funk('platt', erstes ? 'You have flat-spotted the fronts. Expect vibration until we change tyres.' : 'That flat spot is getting worse. Box for fresh tyres when you can.', 30);
    hd4HudMalen();
  }

  // ---- FAILURES (hardcore) ---------------------------------------------------------------
  function hd4DefektSetzen(nr, art) {
    const p = hd4SimPlatz(nr);
    if (p.defekt && p.defekt.art === art) return;
    p.defekt = { art, seit: Date.now() };
    const d = HD4_DEFEKTE[art];
    hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + '⚠ ' + d.name.toUpperCase());
    try { padRumble(0.6, 0.6, 320, 'crash', nr); } catch (e) { /* no pad */ }
    try { log((nr > 1 ? 'P' + nr + ': ' : '') + d.name + ' – ' + d.text, 'err'); } catch (e) { /* log */ }
    if (typeof hd4Funk === 'function' && nr === 1) hd4Funk('defekt', d.name + '. ' + d.text, 40);
    hd4HudMalen();
  }
  function hd4DefektWeg(nr, warum) {
    const p = hd4SimPlatz(nr);
    if (!p.defekt) return;
    const d = HD4_DEFEKTE[p.defekt.art];
    p.defekt = null;
    if (warum) hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + d.kurz + ' ' + warum);
    hd4HudMalen();
  }
  function hd4DefektTakt(sp, dt) {
    const p = hd4SimPlatz(sp.nr), st = sp.motor.state;
    if (!hd4.cfg.sim.defekte) { if (p.defekt) hd4DefektWeg(sp.nr); return; }
    const zuverl = p.upgrades && p.upgrades.zuverlaessig ? 1 - 0.2 * p.upgrades.zuverlaessig : 1;
    // thermal: sustained flat-out running, worst in Rich
    if (!p.defekt && p.hitze > 0.92 / zuverl) hd4DefektSetzen(sp.nr, 'thermal');
    else if (p.defekt && p.defekt.art === 'thermal' && p.hitze < 0.55) hd4DefektWeg(sp.nr, 'cleared – temperatures are back down');
    // brake fade comes from the physics' own brake temperature model
    const fade = st.brakeFade || 0;
    if (!p.defekt && fade > 0.18) hd4DefektSetzen(sp.nr, 'bremse');
    else if (p.defekt && p.defekt.art === 'bremse' && fade < 0.06) hd4DefektWeg(sp.nr, 'cleared – brakes have cooled');
  }
  // Hook from registerCrash(wer, stoss) and the incident recorder.
  function hd4Vorfall(art, wer, stoss) {
    if (!hd4) return;
    const nr = wer || 1;
    if (typeof hd4VorfallMerken === 'function') hd4VorfallMerken(art, nr);
    if (!hd4SimAktiv() || !hd4.cfg.sim.defekte || art !== 'crash') return;
    const p = hd4SimPlatz(nr);
    if (p.defekt && (p.defekt.art === 'fahrwerk' || p.defekt.art === 'antrieb')) return;
    // `stoss` describes the hit (direction); a frontal hit at speed is the one that breaks things.
    const staerke = stoss && stoss.richtung === 'hinten' ? 0.4 : 0.8;
    const zuverl = p.upgrades && p.upgrades.zuverlaessig ? 1 - 0.2 * p.upgrades.zuverlaessig : 1;
    if (Math.random() < 0.16 * staerke * zuverl + 0.02) hd4DefektSetzen(nr, Math.random() < 0.6 ? 'fahrwerk' : 'antrieb');
  }

  // ---- PIT LANE ---------------------------------------------------------------------------
  // Hook from setPitState(next) (player 1). `vorher` is the state it leaves.
  function hd4PitZustand(vorher, next) {
    if (!hd4) return;
    const p = hd4SimPlatz(1);
    if (next === 'limited' && vorher === 'off') hd4PitEinfahrt(1, physEngine, playerCar);
    if (next === 'servicing' && vorher !== 'servicing') hd4PitStart();
    if (vorher === 'servicing' && next !== 'servicing') {
      let fertig = false, plan = null;
      try { fertig = !!pitReady; plan = pitPlan; } catch (e) { fertig = false; }
      if (fertig) hd4PitErledigt(1, plan && plan.tyres, plan && plan.repair, true);
      hd4Sim.pit = null;
    }
    void p;
  }
  function hd4PitEinfahrt(nr, motor, car) {
    if (!hd4SimAktiv() || !hd4.cfg.sim.boxLimit || !motor || raceState !== 'racing') return;
    const st = motor.state, top = Math.max(0.01, motor.config.topSpeedKmh || 1);
    let limit = 0.3;
    try { limit = (typeof pitTrigger !== 'undefined' && pitTrigger === 'double') ? PIT_DOUBLE_SPEED_FACTOR : PIT_SPEED_FACTOR; } catch (e) { limit = 0.3; }
    const v = Math.abs(st.speedKmh || 0) / top;
    // A margin: the limiter needs a moment to bite, and the entry point is a button press.
    if (v <= limit * 1.6 + 0.05) return;
    const s = Math.max(1, Math.round(hd4.cfg.sim.boxStrafeS));
    const id = hd4AutoId(car);
    hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + 'PIT LANE SPEEDING +' + s + ' s');
    try { if (id && typeof hdRlStrafe === 'function') hdRlStrafe(id, s); } catch (e) { /* race control not ready */ }
    hd4SimPlatz(nr).boxStrafe = (hd4SimPlatz(nr).boxStrafe || 0) + s;
    if (typeof hd4Funk === 'function' && nr === 1) hd4Funk('boxlimit', 'Too fast into the pit lane. That is a ' + s + ' second penalty.', 35);
  }
  // The crew works in sequence: every job adds its own time. The existing service runs its
  // jobs side by side; hd4PitBereit() holds the car until the summed time has passed.
  function hd4PitJobs(plan) {
    const p = hd4SimPlatz(1);
    const jobs = [];
    try {
      if (plan && plan.refuel) {
        const ziel = tankZielNorm(plan.refuel);
        const s = Math.max(0, ziel - fuel) / PIT_FUEL_PER_SEC;
        if (s > 0.2) jobs.push({ name: 'Fuel', s });
      }
      if (plan && plan.tyres) jobs.push({ name: 'Tyres', s: PIT_TYRE_CHANGE_S });
      if (plan && plan.repair && damage > 1) jobs.push({ name: 'Repair', s: Math.min(10, damage / 100 * pitFullRepairS) });
    } catch (e) { /* plan not readable: no sequencing */ }
    const fluegel = p.aeroWunsch !== p.aero;
    if (fluegel) jobs.push({ name: 'Front wing', s: 1.5 });
    if (p.defekt && (p.defekt.art === 'fahrwerk' || p.defekt.art === 'antrieb')) jobs.push({ name: 'Mechanical repair', s: 4 });
    const crew = p.upgrades && p.upgrades.crew ? 1 - 0.06 * p.upgrades.crew : 1;
    const soll = jobs.reduce((a, j) => a + j.s, 0) * crew;
    // Side by side (the old crew) the stop takes as long as its longest job.
    const parallel = jobs.reduce((a, j) => Math.max(a, j.s), 0) * crew;
    return { jobs, soll, parallel, fluegel };
  }
  function hd4PitStart() {
    hd4Sim.pit = null;
    if (!hd4SimAktiv()) return;
    let plan = null;
    try { plan = pitPlan || (typeof makePitPlan === 'function' ? makePitPlan() : null); } catch (e) { plan = null; }
    const j = hd4PitJobs(plan);
    hd4Sim.pit = { soll: hd4.cfg.sim.boxFolge ? j.soll : 0, jobs: j.jobs, fluegel: j.fluegel, start: Date.now() };
    if (j.jobs.length) hd4Toast('PIT: ' + j.jobs.map((x) => x.name).join(' + ') + ' · ' + (hd4.cfg.sim.boxFolge ? j.soll : j.parallel).toFixed(1) + ' s');
  }
  // Hook in pitSpielDauer(): the stationary time of the stop the mini-game runs against. null =
  // keep the app's own number. Clean mini-game inputs shave tenths off this time.
  function hd4PitDauer(plan) {
    if (!hd4 || !hd4SimAktiv()) return null;
    const j = hd4PitJobs(plan);
    if (!j.jobs.length) return null;
    if (hd4.cfg.sim.boxFolge) return Math.max(1.5, j.soll);
    // old side-by-side crew: only add what the old stop did not know (wing, mechanical repair)
    const extra = j.jobs.filter((x) => x.name === 'Front wing' || x.name === 'Mechanical repair').reduce((a, x) => a + x.s, 0);
    return extra > 0 ? Math.max(5, j.parallel) + extra : null;
  }
  // Hook in pitLaneTick() (service without the mini-game): may the stop finish?
  function hd4PitBereit(standS) {
    if (!hd4 || !hd4Sim.pit || !hd4Sim.pit.soll) return true;
    return standS >= hd4Sim.pit.soll;
  }
  function hd4PitErledigt(nr, reifenNeu, repariert, voll) {
    const p = hd4SimPlatz(nr);
    if (reifenNeu !== false) {
      if (p.platt > 0) hd4Toast((nr > 1 ? 'P' + nr + ': ' : '') + 'Flat spot gone – fresh tyres');
      p.platt = 0; p.lock = 0; p.klippeGemeldet = false; p.plattGemeldet = false;
    }
    if (p.aeroWunsch !== p.aero && voll) { p.aero = p.aeroWunsch; hd4Toast('Front wing ' + (p.aero > 0 ? '+' : '') + p.aero); }
    if (p.defekt && (p.defekt.art === 'fahrwerk' || p.defekt.art === 'antrieb')) hd4DefektWeg(nr, 'repaired');
    p.hitze = Math.min(p.hitze, 0.3);
    if (p.defekt && p.defekt.art === 'thermal') hd4DefektWeg(nr, 'cleared in the pits');
    p.rundeFuel = null;
    hd4HudMalen();
  }

  // ---- TRACK EVOLUTION AND LIGHT RAIN --------------------------------------------------------
  function hd4NieselSetzen(ziel, still) {
    ziel = hd4Klemme(ziel, 0, 1);
    if ((ziel > 0.05) !== (hd4Sim.nieselZiel > 0.05) && !still) {
      hd4Toast(ziel > 0.05 ? 'LIGHT RAIN – track is getting slippery' : 'Rain has stopped – track is drying');
      if (typeof hd4Funk === 'function') hd4Funk('wetter', ziel > 0.05 ? 'Light rain starting. Grip is going away, be careful on entry.' : 'The drizzle has passed. Track is coming back to you.', 25);
    }
    hd4Sim.nieselZiel = ziel;
  }
  function hd4EvolutionTakt(dt) {
    const modus = hd4.cfg.sim.evolution;
    // count car-laps: every completed lap of every racing car lays rubber
    try {
      raceAllCars().forEach((c) => {
        const n = (c.laps || []).length, key = c.id || 'spieler';
        const vor = hd4Sim.rundenGesehen[key] || 0;
        if (n > vor) { hd4Sim.runden += n - vor; hd4Sim.rundenGesehen[key] = n; }
      });
    } catch (e) { /* no field */ }
    let regen = 0;
    try { regen = wxRainLevel(); } catch (e) { regen = 0; }
    const nassJetzt = Math.max(regen, hd4Sim.niesel);
    if (modus === 'aus') { hd4Sim.gummi = 0; hd4Sim.niesel = 0; hd4Sim.nieselZiel = 0; return; }
    // Rubber: approaches a level set by the laps driven (about 40 car-laps for a fully rubbered
    // line); water washes it off within a minute.
    const zielGummi = nassJetzt > 0.25 ? 0 : Math.min(1, hd4Sim.runden / 40);
    hd4Sim.gummi += (zielGummi - hd4Sim.gummi) * Math.min(1, dt / (nassJetzt > 0.25 ? 45 : 20));
    // Light rain: forced in 'niesel', random spells in 'dynamisch'.
    if (modus === 'niesel') { if (hd4Sim.nieselZiel < 0.6) hd4NieselSetzen(0.7); }
    else if (modus === 'dynamisch') {
      const jetzt = Date.now();
      if (!hd4Sim.nieselBis) hd4Sim.nieselBis = jetzt + 60000 + Math.random() * 120000;
      if (jetzt > hd4Sim.nieselBis) {
        const an = hd4Sim.nieselZiel < 0.05 && Math.random() < 0.55;
        hd4NieselSetzen(an ? 0.4 + Math.random() * 0.6 : 0);
        hd4Sim.nieselBis = jetzt + (an ? 40000 + Math.random() * 70000 : 70000 + Math.random() * 150000);
      }
    } else if (hd4Sim.nieselZiel > 0) hd4NieselSetzen(0, true);
    hd4Sim.niesel += (hd4Sim.nieselZiel - hd4Sim.niesel) * Math.min(1, dt / 12);
    if (hd4Sim.niesel < 0.005 && hd4Sim.nieselZiel === 0) hd4Sim.niesel = 0;
  }
  function hd4StreckeText() {
    if (hd4.cfg.sim.evolution === 'aus') return 'Static';
    if (hd4Sim.niesel > 0.08) return 'Light rain ' + Math.round(hd4Sim.niesel * 100) + ' %';
    if (hd4Sim.gummi > 0.66) return 'Rubbered in';
    if (hd4Sim.gummi > 0.25) return 'Rubbering in';
    return 'Green track';
  }

  // ---- STINT NUMBERS: fuel per lap, laps left, tyre life ---------------------------------
  function hd4TankVon(nr) { try { return nr >= 2 ? zusatzPlatz(nr).tank.stand : fuel; } catch (e) { return 100; } }
  function hd4RundenVon(sp) {
    try {
      if (sp.nr === 1) return raceLapTimes.length;
      return sp.car && sp.car.race && sp.car.race.laps ? sp.car.race.laps.length : 0;
    } catch (e) { return 0; }
  }
  function hd4StintTakt(sp) {
    const p = hd4SimPlatz(sp.nr);
    const runden = hd4RundenVon(sp), tank = hd4TankVon(sp.nr);
    if (!p.rundeFuel || runden < p.rundeFuel.runde || tank > p.rundeFuel.tank + 0.5) { p.rundeFuel = { runde: runden, tank }; return; }
    if (runden > p.rundeFuel.runde) {
      const je = (p.rundeFuel.tank - tank) / (runden - p.rundeFuel.runde);
      if (je > 0.05) { p.proRunde.push(je); if (p.proRunde.length > 5) p.proRunde.shift(); }
      p.rundeFuel = { runde: runden, tank };
    }
  }
  function hd4SpritProRunde(nr) {
    const l = hd4SimPlatz(nr).proRunde;
    return l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
  }
  function hd4RundenImTank(nr) {
    const je = hd4SpritProRunde(nr);
    return je ? hd4TankVon(nr) / je : null;
  }
  // Tyre life left before the cliff, 0..1 (1 = new).
  function hd4ReifenLeben(nr, motor) {
    const k = HD4_KLIPPE[hd4MixVon(nr)] || HD4_KLIPPE.mittel;
    return hd4Klemme(1 - (motor.state.tyreWear || 0) / k.ab, 0, 1);
  }

  // ---- THE 100 ms TICK ------------------------------------------------------------------------
  var hd4SimWarRennen = false;
  hd4Takt((dt) => {
    const laeuft = hd4RennenLaeuft();
    if (laeuft && !hd4SimWarRennen) hd4SimReset();
    hd4SimWarRennen = laeuft;
    const spieler = hd4Spieler();
    if (laeuft && !hd4Sim.testPause) {
      let pause = false;
      try { pause = rennPauseAktiv(); } catch (e) { pause = false; }
      if (!pause) hd4EvolutionTakt(dt);
      spieler.forEach((sp) => {
        if (!sp.motor) return;
        const p = hd4SimPlatz(sp.nr);
        // extra players have no physics hook of their own: read their inputs here
        if (sp.nr >= 2 && sp.z && !pause) {
          hd4SimEingabe(sp.nr, Math.max(0, sp.z.throttle || 0), Math.max(sp.z.outBrake || 0, -(sp.z.throttle || 0)), dt);
          const lage = sp.z.box.lage;
          if (lage !== 'aus' && p.boxVor === 'aus') hd4PitEinfahrt(sp.nr, sp.motor, sp.car);
          if (sp.z.box.fertig && !p.boxFertigVor) hd4PitErledigt(sp.nr, true, true, true);
          p.boxVor = lage; p.boxFertigVor = !!sp.z.box.fertig;
        }
        // new tyres fitted some other way (weather swap, reset): the flat spot leaves with them
        const wear = sp.motor.state.tyreWear || 0;
        if (wear < 0.01 && p.wearVor > 0.05 && p.platt > 0) hd4PitErledigt(sp.nr, true, false, false);
        p.wearVor = wear;
        if (!pause) { hd4DefektTakt(sp, dt); hd4StintTakt(sp); }
        // career upgrade "tyre programme": a share of the wear of this tick is handed back
        const w4 = sp.motor.state.tyreWear4;
        if (w4) {
          const lv = p.upgrades && p.upgrades.reifen ? p.upgrades.reifen : 0;
          if (!p.w4) p.w4 = [w4[0], w4[1], w4[2], w4[3]];
          for (let i = 0; i < 4; i++) {
            const zu = w4[i] - p.w4[i];
            if (lv && zu > 0 && zu < 0.05) w4[i] -= zu * 0.05 * lv;
            p.w4[i] = w4[i];
          }
        }
        // the cliff, called once
        const k = HD4_KLIPPE[hd4MixVon(sp.nr)] || HD4_KLIPPE.mittel;
        if (hd4.cfg.sim.reifenKlippe && wear > k.ab && !p.klippeGemeldet) {
          p.klippeGemeldet = true;
          hd4Toast((sp.nr > 1 ? 'P' + sp.nr + ': ' : '') + 'TYRES OVER THE CLIFF');
        }
        hd4GripSetzen(sp.nr, sp.motor);
      });
    } else {
      // outside a race every layer is neutral: hand the grip back exactly as it was written
      spieler.forEach((sp) => { if (sp.motor && sp.motor.hd4g && sp.motor.hd4g.gesetzt !== null) hd4GripSetzen(sp.nr, sp.motor); });
    }
    hd4HudMalen();
  });

  // ---- THE STRATEGY STRIP (cockpit HUD) ------------------------------------------------------
  function hd4HudEl() {
    let el = document.getElementById('hd4-hud');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'hd4-hud'; el.hidden = true; el.setAttribute('data-i18n-skip', '');
    el.innerHTML = '<div class="hd4-hud-zeilen" id="hd4-hud-zeilen"></div><div class="hd4-hud-strecke" id="hd4-hud-strecke"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-hd4-modus]');
      if (b) { hd4ModusWeiter(Number(b.dataset.hd4Modus)); return; }
      const a = e.target.closest('[data-hd4-aero]');
      if (a) { const p = hd4SimPlatz(1); p.aeroWunsch = p.aeroWunsch >= 2 ? -2 : p.aeroWunsch + 1; hd4HudMalen(true); }
    });
    return el;
  }
  var hd4HudZuletzt = 0, hd4HudText = '';
  function hd4HudMalen(sofort) {
    if (!hd4) return;
    const jetzt = Date.now();
    if (!sofort && jetzt - hd4HudZuletzt < 240) return;
    hd4HudZuletzt = jetzt;
    const el = hd4HudEl();
    let imCockpit = false;
    try { const tr = document.getElementById('tab-race'); imCockpit = !!(tr && tr.classList.contains('active')); } catch (e) { imCockpit = false; }
    const zeigen = hd4.cfg.ui.hud && imCockpit && hd4RennenLaeuft() && !hd4HubOffen();
    if (el.hidden === zeigen) el.hidden = !zeigen;
    if (!zeigen) return;
    const zeilen = hd4Spieler().filter((sp) => sp.motor && (sp.nr === 1 || sp.car)).map((sp) => {
      const p = hd4SimPlatz(sp.nr), m = hd4Modus(sp.nr);
      const tank = hd4TankVon(sp.nr), imTank = hd4RundenImTank(sp.nr);
      const leben = hd4ReifenLeben(sp.nr, sp.motor);
      const mix = hd4MixVon(sp.nr);
      let farbe = '#f7d117';
      try { farbe = mischungFarbe(mix); } catch (e) { /* default */ }
      const masse = Math.round(((sp.motor.state.massFactor || 1) - 1) * 100);
      const teile = [];
      teile.push('<button type="button" class="hd4-chip hd4-chip-modus" data-hd4-modus="' + sp.nr + '" style="--c:' + m.farbe + '" title="Engine map – click, key E, or L3 on the controller">' + m.kurz + '</button>');
      teile.push('<span class="hd4-chip" title="Fuel in the tank, laps left at the current burn, fuel weight"><i>FUEL</i><b>' + Math.round(tank) + '%</b>'
        + (imTank ? '<small>' + imTank.toFixed(1) + ' laps</small>' : '') + (masse > 0 ? '<small>+' + masse + '% mass</small>' : '') + '</span>');
      teile.push('<span class="hd4-chip' + (leben <= 0 ? ' hd4-rot' : leben < 0.25 ? ' hd4-gelb' : '') + '" title="Tyre life left before the cliff"><i style="color:' + farbe + '">TYRE</i>'
        + '<span class="hd4-balken"><span style="width:' + Math.round(leben * 100) + '%;background:' + (leben <= 0 ? '#ff5c5c' : leben < 0.25 ? '#ffb02e' : '#3ddc84') + '"></span></span>'
        + '<b>' + (leben <= 0 ? 'CLIFF' : Math.round(leben * 100) + '%') + '</b></span>');
      if (p.platt > 0) teile.push('<span class="hd4-chip hd4-rot" title="Flat spot: vibration and less grip until the tyres are changed">FLAT SPOT ' + Math.round(p.platt * 100) + '%</span>');
      if (p.defekt) teile.push('<span class="hd4-chip hd4-rot hd4-blink" title="' + hd4Esc(HD4_DEFEKTE[p.defekt.art].text) + '">⚠ ' + HD4_DEFEKTE[p.defekt.art].kurz + '</span>');
      else if (hd4.cfg.sim.defekte && p.hitze > 0.7) teile.push('<span class="hd4-chip hd4-gelb" title="Thermal load">TEMP ' + Math.round(p.hitze * 100) + '%</span>');
      if (sp.nr === 1) teile.push('<button type="button" class="hd4-chip" data-hd4-aero="1" title="Front wing for the next pit stop (+1.5 s): more wing = more grip, more drag"><i>WING</i><b>'
        + (p.aero > 0 ? '+' : '') + p.aero + (p.aeroWunsch !== p.aero ? ' → ' + (p.aeroWunsch > 0 ? '+' : '') + p.aeroWunsch : '') + '</b></button>');
      let pf = '#2ee06a';
      try { pf = SPIELER_FARBE[sp.nr] || pf; } catch (e) { /* default */ }
      return '<div class="hd4-hud-zeile"><span class="hd4-hud-p" style="--c:' + pf + '">P' + sp.nr + '</span>' + teile.join('') + '</div>';
    });
    const html = zeilen.join('');
    const strecke = '<i>TRACK</i> ' + hd4Esc(hd4StreckeText()) + (hd4.cfg.sim.evolution !== 'aus' ? ' · grip ' + (hd4StreckeGrip('mittel') >= 1 ? '+' : '') + ((hd4StreckeGrip('mittel') - 1) * 100).toFixed(1) + '%' : '')
      + (typeof hd4KarriereHud === 'function' ? hd4KarriereHud() : '');
    if (html + strecke !== hd4HudText) {
      hd4HudText = html + strecke;
      el.querySelector('#hd4-hud-zeilen').innerHTML = html;
      el.querySelector('#hd4-hud-strecke').innerHTML = strecke;
    }
  }

  // ---- INPUT: keyboard E, controller L3 (per player pad) -----------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if ((e.key === 'e' || e.key === 'E') && hd4RennenLaeuft() && hd4.cfg.sim.motorModi && !hd4HubOffen()) hd4ModusWeiter(1);
  });
  var hd4PadL3 = {};
  hd4Takt(() => {
    if (!hd4RennenLaeuft() || !hd4.cfg.sim.motorModi) return;
    let pads = null;
    try { pads = padsFuerSpieler(); } catch (e) { pads = null; }
    if (!pads) return;
    hd4Spieler().forEach((sp) => {
      const pad = pads['p' + sp.nr];
      // L3 is "fullscreen" in the menus; in a race it is the engine-map switch.
      const an = !!(pad && pad.buttons && pad.buttons[10] && pad.buttons[10].pressed);
      if (an && !hd4PadL3[sp.nr]) hd4ModusWeiter(sp.nr);
      hd4PadL3[sp.nr] = an;
    });
  });

  // ---- THE STRATEGY PAGE IN THE HUB ------------------------------------------------------------
  hd4Schirm({
    id: 'strategie', titel: 'Race strategy', kurz: 'Strategy', icon: HD4_ICON.strategie,
    zeichnen(host) {
      const c = hd4.cfg.sim;
      let sprit = true, reifen = true;
      try { sprit = fuelSimOn(); reifen = tyreSimOn(); } catch (e) { /* loading */ }
      const modi = Object.keys(HD4_MODI).map((id) => { const m = HD4_MODI[id]; return '<div class="hd4-modus-karte" style="--c:' + m.farbe + '"><b>' + m.name + '</b><span>' + m.text + '</span>'
        + '<dl><dt>Power</dt><dd>' + Math.round(m.leistung * 100) + '%</dd><dt>Fuel burn</dt><dd>' + Math.round(m.verbrauch * 100) + '%</dd></dl></div>'; }).join('');
      const mixe = [['weich', 'Soft', 'Fastest, but falls off a cliff after a short window'], ['mittel', 'Medium', 'The versatile workhorse for balanced stints'], ['hart', 'Hard', 'Slower at first, durable enough to double-stint']]
        .map(([id, name, text]) => { let f = '#fff', g = 1, v = 1; try { f = mischungFarbe(id); g = mischungWert(id, 'griff'); v = mischungWert(id, 'verschleiss'); } catch (e) { /* loading */ }
          const k = HD4_KLIPPE[id];
          return '<div class="hd4-modus-karte" style="--c:' + f + '"><b>' + name + '</b><span>' + text + '</span><dl><dt>Grip</dt><dd>' + Math.round(g * 100) + '%</dd><dt>Wear rate</dt><dd>' + Math.round(v * 100) + '%</dd>'
            + '<dt>Cliff at</dt><dd>' + Math.round(k.ab * 100) + '% wear</dd><dt>Past the cliff</dt><dd>−' + Math.round(k.tief * 100) + '% grip</dd></dl></div>'; }).join('');
      host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Race strategy</h2><p>Fuel, tyres, pit stops, track and reliability. These layers sit on top of the driving physics and only act during a race.</p></div>'
        + ((!sprit || !reifen) ? '<p class="hd4-hinweis">' + (!sprit ? 'Fuel simulation is switched off in the race settings – engine maps and fuel burn have no effect until it is on. ' : '')
          + (!reifen ? 'Tyre simulation is switched off – tyre cliff and wear have no effect until it is on.' : '') + '</p>' : '')
        + '<div class="hd4-raster2">'
        + hd4Karte('Fuel and engine maps', hd4Schalter('sim.motorModi', 'Engine maps', 'Rich / Standard / Lean per driver. Switch with E, L3 on the controller, or the chip in the cockpit.')
          + hd4Schalter('sim.gasVerbrauch', 'Throttle-based fuel burn', 'Wide-open throttle on the straights drains the tank faster than disciplined part throttle.')
          + '<div class="hd4-modus-reihe">' + modi + '</div>'
          + '<p class="hd4-klein">Fuel weight is always simulated: a full tank makes the car up to ' + Math.round((physEngine.config.fuelWeightEffect || 0) * (physEngine.config.fuelMassSpan || 0) * 100) + '% heavier. As it burns off, braking and lap times improve towards the end of a stint.</p>')
        + hd4Karte('Tyres', hd4Schalter('sim.reifenKlippe', 'Tyre cliff', 'Grip fades linearly with wear, then drops sharply past each compound\'s window.')
          + hd4Schalter('sim.bremsplatten', 'Flat spots', 'A heavy, unmanaged lock-up flat-spots the fronts: vibration, less precision and faster wear until serviced.')
          + '<div class="hd4-modus-reihe">' + mixe + '</div>')
        + hd4Karte('Pit stop', hd4Schalter('sim.boxLimit', 'Pit entry speed limit', 'Entering the pit lane well above the limit is a time penalty.')
          + hd4Wahl('sim.boxStrafeS', 'Speeding penalty', [[3, '3 s'], [5, '5 s'], [10, '10 s']])
          + hd4Schalter('sim.boxFolge', 'Crew works in sequence', 'Fuel only ≈ 3 s, tyres only ≈ 4 s, full service with front wing ≈ 7–8 s. Clean mini-game inputs shave tenths off.')
          + '<p class="hd4-klein">Front wing: set it with the WING chip in the cockpit; the change is made at the next stop (+1.5 s).</p>')
        + hd4Karte('Track and weather', hd4Wahl('sim.evolution', 'Track evolution', [['aus', 'Off'], ['gummi', 'Rubbered-in'], ['niesel', 'Light rain'], ['dynamisch', 'Dynamic']],
            'Rubbered-in: a green track gains grip with every lap driven. Light rain: reduced traction from the start. Dynamic: rubber builds up and drizzle comes and goes.')
          + '<p class="hd4-klein">Now: <b>' + hd4Esc(hd4StreckeText()) + '</b> · ' + hd4Sim.runden + ' car-laps this session.</p>')
        + hd4Karte('Reliability', hd4Schalter('sim.defekte', 'Mechanical failures (hardcore)', 'Sustained flat-out running, overheated brakes and wall impacts can trigger thermal throttling, brake fade or damage that needs a pit stop.'))
        + hd4Karte('Interface', hd4Schalter('ui.hud', 'Strategy strip in the cockpit', 'Engine map, fuel laps, tyre life, flat spot, failures and track state for every local player.'))
        + '</div></div>';
      hd4SchalterVerdrahten(host, () => { hd4HudMalen(true); });
    },
  });
