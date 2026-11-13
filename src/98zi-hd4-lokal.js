  // =========================================================================
  // Hybrid Dash 4.0: LOCAL MULTIPLAYER (one laptop, one car per controller)
  // =========================================================================
  //
  // Hybrid Dash 3.0 stopped at three players. 4.0 has eight player slots (49-spieler.js); every
  // slot has its own car, physics, tank, tyres, damage, pit stop and engine sound - the same
  // code the second and third player always ran through.
  //
  // THE LOBBY: press a button on a controller to join. The controller is pinned to the next free
  // player slot and gets the next free car; both can be changed by hand. Pinning matters with
  // many pads: the browser's own order changes when a Bluetooth pad sleeps and wakes, and
  // without a pin a player would suddenly be steering someone else's car.
  //
  // HOW MANY CONTROLLERS: as many as the laptop's Bluetooth radio holds next to the cars. The
  // cars are Bluetooth devices too (about 7-9 per adapter), so a field of four cars and four
  // pads is realistic on one adapter; USB controllers or a second Bluetooth dongle lift that.

  var HD4_LOKAL_STORE = 'lokal.v1';
  var hd4Lok = { fest: hd4Lesen(HD4_LOKAL_STORE, {}), beitreten: false, gedrueckt: {}, zeichnenAt: 0 };
  function hd4PadKennung(pad) { return pad ? String(pad.id).slice(0, 80) : ''; }
  // Hook from padsFuerSpieler(): { nr: pad | null } for every pinned player slot.
  function hd4PadFest(sortiert) {
    if (!hd4 || !hd4Lok) return null;
    const out = {}, vergeben = new Set();
    Object.keys(hd4Lok.fest).forEach((nr) => {
      const f = hd4Lok.fest[nr];
      if (!f) return;
      // the same slot index and the same device first, otherwise the same kind of device
      let pad = sortiert.find((p) => !vergeben.has(p) && p.index === f.index && hd4PadKennung(p) === f.id);
      if (!pad) pad = sortiert.find((p) => !vergeben.has(p) && hd4PadKennung(p) === f.id);
      if (pad) vergeben.add(pad);
      out[nr] = pad || null;
    });
    return out;
  }
  function hd4LokSpeichern() { hd4Schreiben(HD4_LOKAL_STORE, hd4Lok.fest); }
  function hd4LokPads() { try { return padsSortiert(); } catch (e) { return []; } }
  function hd4LokAutos() { try { return garage.filter((c) => c.device && c.role !== 'safetycar' && c.role !== 'reinig'); } catch (e) { return []; } }
  function hd4LokRolle(nr) { return nr === 1 ? 'player' : 'player' + nr; }
  function hd4LokAutoVon(nr) { return hd4LokAutos().find((c) => c.role === hd4LokRolle(nr)) || null; }
  function hd4LokModusAn() {
    try {
      const cb = $('opt-zwei-an');
      if (cb && !cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (!zweiSpieler) zweiSpielerSetzen(true);
    } catch (e) { /* loading */ }
  }
  function hd4LokAutoSetzen(nr, id) {
    const car = hd4LokAutos().find((c) => hd4AutoId(c) === id);
    const alt = hd4LokAutoVon(nr);
    try {
      if (alt && alt !== car) setCarRole(alt, 'ghost');
      if (car) { if (nr > 1) hd4LokModusAn(); setCarRole(car, hd4LokRolle(nr)); }
    } catch (e) { hd4Toast('Could not assign the car'); }
  }
  // A controller joins: pin it to the next free player slot, give that slot the next free car.
  function hd4LokBeitritt(pad) {
    const fest = hd4Lok.fest;
    if (Object.keys(fest).some((nr) => fest[nr] && fest[nr].index === pad.index && fest[nr].id === hd4PadKennung(pad))) return false;
    let nr = 0;
    for (let i = 1; i <= SPIELER_MAX; i++) { if (!fest[i]) { nr = i; break; } }
    if (!nr) { hd4Toast('All ' + SPIELER_MAX + ' player slots are taken'); return false; }
    fest[nr] = { index: pad.index, id: hd4PadKennung(pad) };
    hd4LokSpeichern();
    if (!hd4LokAutoVon(nr)) {
      const frei = hd4LokAutos().find((c) => c.role === 'ghost' || c.role === 'none' || !c.role);
      if (frei) hd4LokAutoSetzen(nr, hd4AutoId(frei));
    }
    if (nr > 1) hd4LokModusAn();
    try { if (pad.vibrationActuator) pad.vibrationActuator.playEffect('dual-rumble', { duration: 180, strongMagnitude: 0.6, weakMagnitude: 0.6 }); } catch (e) { /* no rumble */ }
    hd4Toast('Player ' + nr + ' joined');
    return true;
  }
  hd4Takt((dt, jetzt) => {
    if (!hd4Sichtbar('lokal')) { hd4Lok.beitreten = false; return; }
    const pads = hd4LokPads();
    let neu = false;
    pads.forEach((pad) => {
      const an = Array.from(pad.buttons || []).some((b) => b && b.pressed);
      const key = pad.index + '|' + hd4PadKennung(pad);
      if (an && !hd4Lok.gedrueckt[key] && hd4Lok.beitreten && !hd4RennenLaeuft()) neu = hd4LokBeitritt(pad) || neu;
      if (an !== !!hd4Lok.gedrueckt[key]) { hd4Lok.gedrueckt[key] = an; neu = true; }
    });
    // the list of controllers changes without an event: redraw once a second
    if (neu || jetzt - hd4Lok.zeichnenAt > 1000) {
      const aktiv = document.activeElement;
      if (!(aktiv && /^(SELECT|INPUT|TEXTAREA)$/.test(aktiv.tagName))) { hd4Lok.zeichnenAt = jetzt; hd4Neu(); }
    }
  });

  hd4Schirm({
    id: 'lokal', titel: 'Local multiplayer', kurz: 'Multiplayer', icon: HD4_ICON.lokal,
    zeichnen(host) {
      const pads = hd4LokPads(), autos = hd4LokAutos();
      let fuer = {};
      try { fuer = padsFuerSpieler(); } catch (e) { fuer = {}; }
      let an = false;
      try { an = !!zweiSpieler; } catch (e) { an = false; }
      const padName = (p) => (p ? String(p.id).replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 34) || 'Controller' : '');
      let zeilen = '';
      for (let nr = 1; nr <= SPIELER_MAX; nr++) {
        const car = hd4LokAutoVon(nr), f = hd4Lok.fest[nr];
        const pad = nr === 1 && !an ? fuer.p1 : fuer['p' + nr];
        const gedrueckt = pad && hd4Lok.gedrueckt[pad.index + '|' + hd4PadKennung(pad)];
        let farbe = '#2ee06a';
        try { farbe = SPIELER_FARBE[nr] || farbe; } catch (e) { /* default */ }
        if (nr > 3 && !car && !f && nr > Math.max(3, pads.length, autos.length)) continue;
        zeilen += '<li class="hd4-slot' + (car ? ' belegt' : '') + (gedrueckt ? ' drueckt' : '') + '" style="--c:' + farbe + '"><span class="hd4-slot-nr">P' + nr + '</span>'
          + '<label class="hd4-feld">Car <select data-hd4-slot-auto="' + nr + '"><option value="">— none —</option>'
          + autos.map((c) => '<option value="' + hd4Esc(hd4AutoId(c)) + '"' + (c === car ? ' selected' : '') + '>' + hd4Esc(hd4AutoName(c)) + (c.role && c.role !== 'ghost' && c.role !== 'none' && c !== car ? ' (P' + (c.role === 'player' ? 1 : c.role.replace('player', '')) + ')' : '') + '</option>').join('') + '</select></label>'
          + '<label class="hd4-feld">Controller <select data-hd4-slot-pad="' + nr + '"><option value="">Automatic</option>'
          + pads.map((p) => '<option value="' + p.index + '"' + (f && f.index === p.index && f.id === hd4PadKennung(p) ? ' selected' : '') + '>' + (p.index + 1) + ' · ' + hd4Esc(padName(p)) + '</option>').join('')
          + (f && !pads.some((p) => f.index === p.index && f.id === hd4PadKennung(p)) ? '<option value="x" selected>Pinned controller is off</option>' : '') + '</select></label>'
          + '<span class="hd4-slot-status">' + (car ? (pad ? (gedrueckt ? 'Input!' : 'Ready · ' + hd4Esc(padName(pad))) : 'No controller') : pad && an ? 'No car' : '') + '</span></li>';
      }
      host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><p>Race from one laptop: every controller drives its own car, up to ' + SPIELER_MAX + ' players. Each player has their own fuel, tyres, damage, pit stop and engine map (L3).</p></div>'
        + '<div class="hd4-raster2">' + hd4Karte('Players', '<div class="hd4-knopfreihe"><button type="button" class="hd4-knopf hd4-haupt' + (hd4Lok.beitreten ? ' hd4-aktiv' : '') + '" id="hd4-lok-join">' + (hd4Lok.beitreten ? 'Press a button on each controller… (click to stop)' : 'Join: press a button on each controller') + '</button>'
          + '<button type="button" class="hd4-knopf" id="hd4-lok-frei">Unpin all controllers</button></div>'
          + '<ul class="hd4-slots">' + zeilen + '</ul>'
          + (autos.length ? '' : '<p class="hd4-hinweis">No cars connected. Connect the cars in the garage first.</p>')
          + '<p class="hd4-klein">Multiplayer mode is ' + (an ? '<b class="hd4-gut">on</b>' : 'off – it switches on when a second player gets a car') + '. Cars without a player stay NPCs.</p>', 'hd4-breit')
        + hd4Karte('Controllers found', pads.length ? '<ul class="hd4-padliste">' + pads.map((p) => { const nr = Object.keys(fuer).find((k) => fuer[k] === p);
            return '<li class="' + (hd4Lok.gedrueckt[p.index + '|' + hd4PadKennung(p)] ? 'drueckt' : '') + '"><b>' + (p.index + 1) + '</b><span>' + hd4Esc(padName(p)) + '</span><small>' + (nr && (an || nr === 'p1') ? 'Player ' + nr.slice(1) : 'free') + (p.mapping === 'standard' ? '' : ' · non-standard layout') + '</small></li>'; }).join('') + '</ul>'
          : '<p class="hd4-leer">No controller detected. Pair it with the laptop (Bluetooth or USB) and press any button – browsers only show a controller after its first input.</p>')
        + hd4Karte('How many fit?', '<ul class="hd4-liste"><li>The limit is the laptop’s Bluetooth radio, which also holds the cars (about 7–9 devices per adapter).</li><li>Four cars and four Bluetooth controllers on one adapter is a realistic field. USB controllers do not count against it.</li><li>For more: a second Bluetooth dongle for the controllers, or the two-laptop mode for the cars.</li><li>A pinned controller keeps its player even if the browser re-orders the pads; if it switches off, that car stops rather than follow another pad.</li></ul>')
        + '</div></div>';
      host.querySelector('#hd4-lok-join').addEventListener('click', () => { hd4Lok.beitreten = !hd4Lok.beitreten; hd4Neu(); });
      host.querySelector('#hd4-lok-frei').addEventListener('click', () => { hd4Lok.fest = {}; hd4LokSpeichern(); hd4Neu(); });
      host.querySelectorAll('[data-hd4-slot-auto]').forEach((el) => el.addEventListener('change', () => { hd4LokAutoSetzen(Number(el.dataset.hd4SlotAuto), el.value); el.blur(); hd4Neu(); }));
      host.querySelectorAll('[data-hd4-slot-pad]').forEach((el) => el.addEventListener('change', () => {
        const nr = Number(el.dataset.hd4SlotPad);
        if (el.value === '') delete hd4Lok.fest[nr];
        else if (el.value !== 'x') {
          const p = pads.find((x) => String(x.index) === el.value);
          if (p) {
            Object.keys(hd4Lok.fest).forEach((k) => { const f = hd4Lok.fest[k]; if (f && f.index === p.index && f.id === hd4PadKennung(p)) delete hd4Lok.fest[k]; });
            hd4Lok.fest[nr] = { index: p.index, id: hd4PadKennung(p) };
          }
        }
        hd4LokSpeichern(); el.blur(); hd4Neu();
      }));
    },
  });
