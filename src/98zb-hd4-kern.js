  // =========================================================================
  // Hybrid Dash 4.0: CORE (settings, storage, the hub screen, shared helpers)
  // =========================================================================
  //
  // Everything Hybrid Dash 4.0 adds lives in the 98zb..98zj files:
  //   98zb-hd4-kern.js      this file: settings, storage, hub overlay, helpers
  //   98zc-hd4-sim.js       race strategy: engine maps, fuel burn, tyre cliff, flat spots,
  //                         track evolution, light rain, mechanical failures, pit rules
  //   98zd-hd4-ki.js        the NPC "driver brain": learns the track and its rivals
  //   98ze-hd4-analyse.js   distance-based traces, sector consistency, incident heatmap
  //   98zf-hd4-ingenieur.js the virtual race engineer / spotter
  //   98zg-hd4-karriere.js  career mode in the GT World Challenge format
  //   98zh-hd4-showroom.js  the digital showroom (holographic collector cards)
  //   98zi-hd4-lokal.js     local multiplayer: one car per controller
  //   98zj-hd4-ui.js        branding, the modern theme, menu entries, self-test
  //
  // The older files only carry small hooks (`if (typeof hd4... === 'function')`). Hooks can be
  // called while the app is still loading, before these files ran - so module state is declared
  // with `var` (no temporal dead zone) and every hook starts with a "ready?" check.

  var HD4_VERSION = '4.0';
  var HD4_STORE = 'hybriddash4.cfg.v1';
  var HD4_VORGABE = {
    sim: {
      motorModi: true,        // engine maps Rich / Standard / Lean
      gasVerbrauch: true,     // wide-open throttle burns over-proportionally
      reifenKlippe: true,     // grip falls off a cliff past a compound's window
      bremsplatten: true,     // lock-ups flat-spot the tyres
      boxLimit: true,         // speeding at pit entry is a time penalty
      boxStrafeS: 5,
      boxFolge: true,         // the crew works one job after the other (full service 7-8 s)
      evolution: 'gummi',     // aus | gummi | niesel | dynamisch
      defekte: false,         // hardcore: mechanical failures
    },
    ingenieur: { an: true, abstand: true, reifen: true, sprit: true, box: true, wetter: true, jedeRunde: 2 },
    ki: { an: true, lernen: true, rivalen: true, menschlich: true },
    analyse: { sektoren: 3 },
    ui: { modern: true, hud: true },
  };
  function hd4Tief(ziel, quelle) {
    Object.keys(quelle || {}).forEach((k) => {
      const v = quelle[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && ziel[k] && typeof ziel[k] === 'object') hd4Tief(ziel[k], v);
      else if (k in ziel && typeof v === typeof ziel[k]) ziel[k] = v;
    });
    return ziel;
  }
  var hd4 = { cfg: JSON.parse(JSON.stringify(HD4_VORGABE)), schirme: [], offen: null, takte: [] };
  try { hd4Tief(hd4.cfg, JSON.parse(localStorage.getItem(HD4_STORE) || '{}')); } catch (e) { /* defaults */ }
  function hd4Bereit() { return !!hd4; }
  function hd4Speichern() { try { localStorage.setItem(HD4_STORE, JSON.stringify(hd4.cfg)); } catch (e) { /* private */ } }

  // ---- storage for the bigger data sets (career, AI memory, incidents, car stats) ----------
  function hd4Lesen(key, vorgabe) {
    try { const v = JSON.parse(localStorage.getItem('hybriddash4.' + key) || 'null'); return v === null || v === undefined ? vorgabe : v; }
    catch (e) { return vorgabe; }
  }
  function hd4Schreiben(key, wert) {
    try { localStorage.setItem('hybriddash4.' + key, JSON.stringify(wert)); return true; } catch (e) { return false; }
  }

  // ---- small helpers -------------------------------------------------------------------------
  function hd4Esc(x) {
    return String(x === undefined || x === null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function hd4Klemme(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function hd4Zeit(ms) {
    if (!(ms >= 0) || !Number.isFinite(ms)) return '–';
    const s = ms / 1000;
    return s >= 60 ? Math.floor(s / 60) + ':' + (s % 60).toFixed(2).padStart(5, '0') : s.toFixed(2);
  }
  function hd4Hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Deterministic 0..1 from a string and a salt: a driver keeps his personality between races.
  function hd4Zufall01(s, salz) { return (hd4Hash(String(s) + '|' + salz) % 100000) / 100000; }
  function hd4RennenLaeuft() {
    if (hd4Sim && hd4Sim.testPause) return false;      // the app's own self-test is running
    try { return raceState === 'racing' || raceState === 'finishing'; } catch (e) { return false; }
  }
  function hd4StreckeKey() {
    try { return currentTrackTiles && currentTrackTiles.length >= 3 ? bestzeitSchluessel(currentTrackTiles) : null; } catch (e) { return null; }
  }
  function hd4AutoId(car) { return car && car.device ? String(car.device.id) : null; }
  function hd4AutoName(car) { try { return garageLabel(car); } catch (e) { return 'Car'; } }
  function hd4Toast(text) { try { showHudToast(text); } catch (e) { /* not ready */ } }
  // The player slots that are driving right now: [{ nr, car, motor, z }], player 1 first.
  function hd4Spieler() {
    const out = [];
    try {
      out.push({ nr: 1, car: playerCar, motor: physEngine, z: null });
      zusatzAktiv().forEach((z) => out.push({ nr: z.nr, car: z.car, motor: z.motor, z }));
    } catch (e) { /* loading */ }
    return out;
  }

  // ---- one shared 100 ms clock for all 4.0 modules -----------------------------------------
  // One timer instead of one per module; a module that throws must not stop the others.
  function hd4Takt(fn) { hd4.takte.push(fn); }
  var hd4TaktZuletzt = 0;
  setInterval(() => {
    const jetzt = Date.now();
    const dt = hd4TaktZuletzt ? Math.min(0.5, (jetzt - hd4TaktZuletzt) / 1000) : 0.1;
    hd4TaktZuletzt = jetzt;
    for (const fn of hd4.takte) { try { fn(dt, jetzt); } catch (e) { if (!hd4.taktFehler) { hd4.taktFehler = true; try { console.error('Hybrid Dash 4.0 tick', e); } catch (e2) { /* none */ } } } }
  }, 100);

  // ---- THE PAGES: every 4.0 page is drawn into a place of the app's own menus -------------------
  //   karriere    Race Control -> Career card           (tab hd4-karriere)
  //   showroom    Garage -> Showroom                    (tab hd4-showroom)
  //   lokal       Multiplayer tab, "Local players"      (inside tab hdmp)
  //   analyse / strategie / ingenieur / ki              Options tiles (subpages opt-hd4-...)
  // hd4Schirm({ id, titel, zeichnen(host), aufraeumen() }) registers a page; its host element is
  // #hd4-seite-<id> in 00-index.head.html. A page is drawn when its host becomes visible.
  var HD4_ORT = {
    karriere: { tab: 'hd4-karriere' }, showroom: { tab: 'hd4-showroom' }, lokal: { tab: 'hdmp' },
    analyse: { tab: 'options', sub: 'opt-hd4-analyse' }, strategie: { tab: 'options', sub: 'opt-hd4-strategie' },
    ingenieur: { tab: 'options', sub: 'opt-hd4-ingenieur' }, ki: { tab: 'options', sub: 'opt-hd4-ki' },
  };
  function hd4Schirm(def) { hd4.schirme.push(def); }
  function hd4Host(id) { return document.getElementById('hd4-seite-' + id); }
  function hd4Sichtbar(id) { const h = hd4Host(id); return !!(h && h.offsetParent !== null); }
  function hd4Zeichnen(def) {
    const host = hd4Host(def.id);
    if (!host) return;
    const oben = window.scrollY;
    try { def.zeichnen(host); }
    catch (e) { host.innerHTML = '<p class="hd4-leer">This page could not be drawn: ' + hd4Esc(e && e.message) + '</p>'; try { console.error(e); } catch (e2) { /* none */ } }
    if (Math.abs(window.scrollY - oben) > 2) window.scrollTo(0, oben);
  }
  // Go to a page: the tab it lives in, and its Options subpage if it has one.
  function hd4Oeffnen(id) {
    const ort = HD4_ORT[id], def = hd4.schirme.find((s) => s.id === id);
    if (!ort || !def) return;
    try {
      if (typeof raceGridOffen === 'function' && raceGridOffen() && typeof raceGridAbbrechen === 'function') raceGridAbbrechen();
      showTab(ort.tab);
      if (ort.sub) showSubpage(ort.sub);
    } catch (e) { /* loading */ }
    hd4Zeichnen(def);
    window.scrollTo(0, 0);
  }
  // Re-draw every page that is on screen right now.
  function hd4Neu() { hd4.schirme.forEach((def) => { if (hd4Sichtbar(def.id)) hd4Zeichnen(def); }); }
  // There is no overlay any more: these two stay for the callers that asked "is the hub open?".
  function hd4Schliessen() { return false; }
  function hd4HubOffen() { return false; }
  // Draw a page the moment its host comes into view (tab or subpage opened by any way in).
  var hd4WarSichtbar = {};
  hd4Takt(() => {
    hd4.schirme.forEach((def) => {
      const an = hd4Sichtbar(def.id);
      if (an && !hd4WarSichtbar[def.id]) hd4Zeichnen(def);
      if (!an && hd4WarSichtbar[def.id] && def.aufraeumen) { try { def.aufraeumen(); } catch (e) { /* page */ } }
      hd4WarSichtbar[def.id] = an;
    });
  });

  // ---- building blocks for the pages -----------------------------------------------------------
  function hd4Karte(titel, inhalt, klasse) {
    return '<section class="hd4-karte ' + (klasse || '') + '">' + (titel ? '<h3>' + hd4Esc(titel) + '</h3>' : '') + inhalt + '</section>';
  }
  // A switch bound to a path in hd4.cfg ("sim.defekte"); wired by hd4SchalterVerdrahten().
  function hd4Schalter(pfad, titel, text) {
    const [a, b] = pfad.split('.');
    const an = !!hd4.cfg[a][b];
    return '<label class="hd4-schalter"><input type="checkbox" data-hd4-cfg="' + pfad + '"' + (an ? ' checked' : '') + '><span class="hd4-schieber" aria-hidden="true"></span>'
      + '<span class="hd4-schalter-text"><b>' + hd4Esc(titel) + '</b>' + (text ? '<small>' + hd4Esc(text) + '</small>' : '') + '</span></label>';
  }
  function hd4Wahl(pfad, titel, optionen, text) {
    const [a, b] = pfad.split('.');
    const wert = String(hd4.cfg[a][b]);
    return '<div class="hd4-wahl"><span class="hd4-schalter-text"><b>' + hd4Esc(titel) + '</b>' + (text ? '<small>' + hd4Esc(text) + '</small>' : '') + '</span>'
      + '<span class="hd4-segment" role="group" aria-label="' + hd4Esc(titel) + '">' + optionen.map(([v, name]) => '<button type="button" data-hd4-cfg="' + pfad + '" data-wert="' + hd4Esc(v) + '"'
        + (String(v) === wert ? ' class="an" aria-pressed="true"' : ' aria-pressed="false"') + '>' + hd4Esc(name) + '</button>').join('') + '</span></div>';
  }
  function hd4SchalterVerdrahten(host, danach) {
    host.querySelectorAll('input[data-hd4-cfg]').forEach((el) => el.addEventListener('change', () => {
      const [a, b] = el.dataset.hd4Cfg.split('.');
      hd4.cfg[a][b] = el.checked; hd4Speichern();
      if (danach) danach(el.dataset.hd4Cfg);
    }));
    host.querySelectorAll('button[data-hd4-cfg]').forEach((el) => el.addEventListener('click', () => {
      const [a, b] = el.dataset.hd4Cfg.split('.');
      const alt = hd4.cfg[a][b];
      hd4.cfg[a][b] = typeof alt === 'number' ? Number(el.dataset.wert) : el.dataset.wert;
      hd4Speichern();
      if (danach) danach(el.dataset.hd4Cfg);
      hd4Neu();
    }));
  }
  var HD4_ICON = {
    karriere: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Zm-3 1h3v3a3 3 0 0 1-3-3Zm13 0h3a3 3 0 0 1-3 3V5ZM10 14h4v3h3v3H7v-3h3v-3Z" fill="currentColor"/></svg>',
    showroom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm14 4 2 .5v12a2 2 0 0 1-2 2H9v-1h8a2 2 0 0 0 2-2V7ZM6 13h8l-2.5-3.5-2 2.5-1.2-1.4L6 13Z" fill="currentColor"/></svg>',
    strategie: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7V3Zm1 0v8h8a8 8 0 0 0-8-8Zm-2 6.3-4 6.7h8l-4-6.7Z" fill="currentColor"/></svg>',
    analyse: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 20V4h2v14h16v2H3Zm4-4 4-6 3 3 5-8 1.7 1-6.3 10.2-3.1-3.1L8.7 17 7 16Z" fill="currentColor"/></svg>',
    ingenieur: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v5a3 3 0 0 0 3 3h1v-7H6v-1a6 6 0 0 1 12 0v1h-2v7h1.2a4 4 0 0 1-3.2 1.6V22a6 6 0 0 0 6-6v-5a8 8 0 0 0-8-8Z" fill="currentColor"/></svg>',
    lokal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10a5 5 0 0 1 5 5v2.5a3.5 3.5 0 0 1-6.4 2l-.9-1.5H9.3l-.9 1.5A3.5 3.5 0 0 1 2 14.500V12a5 5 0 0 1 5-5Zm0 3v1.500H5.500v2H7V15h2v-1.500h1.500v-2H9V10H7Zm8.500.500a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400Zm2.500 2a1.200 1.200 0 1 0 0 2.400 1.200 1.200 0 0 0 0-2.400Z" fill="currentColor"/></svg>',
    ki: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v2h2a2 2 0 0 1 2 2v2h2v6h-2v2a2 2 0 0 1-2 2h-2v2H9v-2H7a2 2 0 0 1-2-2v-2H3V9h2V7a2 2 0 0 1 2-2h2V3Zm0 6v6h6V9H9Z" fill="currentColor"/></svg>',
  };

  window.HYBRIDDASH4 = { version: HD4_VERSION, oeffnen: (id) => hd4Oeffnen(id), cfg: () => hd4.cfg };
