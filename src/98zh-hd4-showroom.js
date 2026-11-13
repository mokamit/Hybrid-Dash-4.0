  // =========================================================================
  // Hybrid Dash 4.0: THE DIGITAL SHOWROOM
  // =========================================================================
  //
  // Every car the app knows - connected now, or remembered from earlier (name, number, colour,
  // make, photo) - as a collector card with a holographic finish. The card tilts with the
  // pointer, the foil and the glare follow it, and a click turns it over to the car's record.
  //
  // THE FINISH IS EARNED. A car's record (races, wins, podiums, laps, best lap) is written after
  // every finished race, and the record decides the card's grade:
  //   Stock -> Club Racer -> Podium Finisher -> Legend
  // so the collection shows at a glance which cars have a history.

  var HD4_STAT_STORE = 'autos.v1';
  var hd4Stat = hd4Lesen(HD4_STAT_STORE, {});
  var hd4Show = { sort: 'grad' };
  var HD4_GRADE = [
    { id: 'stock', name: 'Stock', ab: 0, farbe: '#aeb7c6' },
    { id: 'club', name: 'Club Racer', ab: 6, farbe: '#4db8ff' },
    { id: 'podium', name: 'Podium Finisher', ab: 20, farbe: '#b08cff' },
    { id: 'legende', name: 'Legend', ab: 50, farbe: '#f5c542' },
  ];
  function hd4StatPunkte(s) { return s ? s.siege * 5 + s.podien * 2 + s.rennen + Math.floor(s.runden / 25) + (s.poles || 0) * 2 : 0; }
  function hd4Grad(s) {
    const p = hd4StatPunkte(s);
    let g = HD4_GRADE[0];
    HD4_GRADE.forEach((x) => { if (p >= x.ab) g = x; });
    const i = HD4_GRADE.indexOf(g), naechster = HD4_GRADE[i + 1] || null;
    return { g, p, naechster, anteil: naechster ? (p - g.ab) / (naechster.ab - g.ab) : 1 };
  }
  // Called after every finished session with the classified field (98zg-hd4-karriere.js).
  function hd4StatErfassen(feld, modus) {
    const quali = modus === 'qualifying';
    const rennen = modus === 'laps' || modus === 'endurance' || modus === 'knockout';
    const gewertet = feld.filter((x) => x.laps > 0 && !x.raus);
    let strecke = '';
    try { strecke = hd4StreckeKey() || ''; } catch (e) { strecke = ''; }
    gewertet.forEach((x, i) => {
      if (!x.id || x.id === 'spieler') return;
      const s = hd4Stat[x.id] || (hd4Stat[x.id] = { name: x.name, rennen: 0, siege: 0, podien: 0, runden: 0, poles: 0, beste: null, besteStrecke: '', zuletzt: 0 });
      s.name = x.name; s.zuletzt = Date.now();
      s.runden += x.laps;
      if (Number.isFinite(x.beste) && (!s.beste || x.beste < s.beste)) { s.beste = Math.round(x.beste); s.besteStrecke = strecke; }
      if (quali && i === 0 && gewertet.length > 1) s.poles = (s.poles || 0) + 1;
      if (rennen && gewertet.length > 1) { s.rennen++; if (i === 0) s.siege++; if (i < 3) s.podien++; }
    });
    hd4Schreiben(HD4_STAT_STORE, hd4Stat);
  }
  // Every car we can show: connected ones first (live data), then remembered profiles, then
  // cars that only have a record.
  function hd4ShowAutos() {
    const out = [], gesehen = new Set();
    const foto = (id) => { try { return localStorage.getItem(AUTO_FOTO + id) || ''; } catch (e) { return ''; } };
    try {
      garage.forEach((c) => {
        if (!c.device) return;
        const id = String(c.device.id);
        gesehen.add(id);
        out.push({ id, name: garageLabel(c), nummer: c.nummer || 0, farbe: carColor(c).hex, modell: carModellWert(c.modellId), modellName: carModellWert(c.modellId) ? carModellName(c.modellId) : '', foto: foto(id), verbunden: true, rolle: c.role });
      });
    } catch (e) { /* no garage */ }
    let store = {};
    try { store = carStore(); } catch (e) { store = {}; }
    Object.keys(store).forEach((id) => {
      if (gesehen.has(id)) return;
      gesehen.add(id);
      const e = store[id];
      let hex = '#8a93a6';
      try { const c = CAR_COLORS.find((x) => x.id === e.color); if (c) hex = c.hex; } catch (e2) { /* default */ }
      let modellName = '';
      try { modellName = carModellWert(e.modellId) ? carModellName(e.modellId) : ''; } catch (e2) { modellName = ''; }
      out.push({ id, name: e.alias || (e.nummer ? 'Car ' + e.nummer : e.name || 'Car'), nummer: e.nummer || 0, farbe: hex, modell: e.modellId || '', modellName, foto: foto(id), verbunden: false });
    });
    Object.keys(hd4Stat).forEach((id) => {
      if (gesehen.has(id)) return;
      out.push({ id, name: hd4Stat[id].name || 'Car', nummer: 0, farbe: '#8a93a6', modell: '', modellName: '', foto: foto(id), verbunden: false });
    });
    out.forEach((a) => { a.stat = hd4Stat[a.id] || null; a.grad = hd4Grad(a.stat); });
    return out;
  }
  // ---- THE CAR'S IMAGE -----------------------------------------------------------------------
  // In this order (img/showroom/README.md): the car's own photo from the Garage; an image of exactly
  // this model and colour; ONE neutral render of the model (white paint, transparent background)
  // tinted to the car's colour; a photo of the real car the model stands for; a drawn placeholder. Which files exist is only known by trying:
  // every card carries its list of candidates, and a failed load moves on to the next one.
  var HD4_SHOW_PFAD = 'img/showroom/';
  var hd4ShowFehlt = {};                       // candidates that failed in this session: not tried again
  // Authors and licences of the bundled photos (img/showroom/quellen.json), shown on the card.
  var hd4ShowQuellen = null;
  try {
    fetch(HD4_SHOW_PFAD + 'quellen.json').then((r) => (r.ok ? r.json() : null)).then((d) => { hd4ShowQuellen = d; if (d && hd4Sichtbar('showroom')) hd4Neu(); }).catch(() => { /* offline or file:// - cards without the caption */ });
  } catch (e) { /* no fetch */ }
  function hd4ShowFarbId(a) {
    try { const c = CAR_COLORS.find((x) => String(x.hex).toLowerCase() === String(a.farbe).toLowerCase()); return c ? c.id : ''; } catch (e) { return ''; }
  }
  function hd4ShowKandidaten(a) {
    const l = [];
    if (a.foto) l.push({ url: a.foto, art: 'foto' });
    const modell = a.modell || 'standard', farbe = hd4ShowFarbId(a);
    if (farbe && farbe !== 'keine' && farbe !== 'mehrfarbig') ['webp', 'png', 'jpg'].forEach((e) => l.push({ url: HD4_SHOW_PFAD + modell + '-' + farbe + '.' + e, art: 'exakt' }));
    l.push({ url: HD4_SHOW_PFAD + modell + '.png', art: 'tint' });
    // a photo of the real car this model stands for (its own livery - not tinted)
    l.push({ url: HD4_SHOW_PFAD + modell + '.jpg', art: 'modell' });
    if (modell !== 'standard') { l.push({ url: HD4_SHOW_PFAD + 'standard.png', art: 'tint' }); l.push({ url: HD4_SHOW_PFAD + 'standard.jpg', art: 'modell' }); }
    return l.filter((k) => !hd4ShowFehlt[k.url]);
  }
  function hd4ShowPlatzhalter(a) {
    return '<svg viewBox="0 0 300 170" aria-hidden="true" class="hd4-auto-svg"><defs><linearGradient id="hd4g' + hd4Hash(a.id) + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + hd4Esc(a.farbe) + '"/><stop offset="1" stop-color="#0b0d12"/></linearGradient></defs>'
      + '<rect width="300" height="170" fill="#0b0d12"/><path d="M0 128h300v42H0z" fill="#141821"/><path d="M0 128h300" stroke="#2a3140" stroke-width="2"/>'
      + '<path d="M28 118c2-14 14-22 34-25l40-5c14-16 34-26 62-26h34c24 0 44 9 58 26l18 4c10 2 16 9 16 20v8H28v-2Z" fill="url(#hd4g' + hd4Hash(a.id) + ')" stroke="' + hd4Esc(a.farbe) + '" stroke-width="2"/>'
      + '<path d="M112 86c10-11 26-18 50-18h30c18 0 32 6 43 18Z" fill="#0b0d12" opacity=".75"/><path d="M178 68v18" stroke="' + hd4Esc(a.farbe) + '" stroke-width="2"/>'
      + '<circle cx="86" cy="126" r="19" fill="#07090d" stroke="#3a4253" stroke-width="4"/><circle cx="86" cy="126" r="7" fill="#3a4253"/><circle cx="226" cy="126" r="19" fill="#07090d" stroke="#3a4253" stroke-width="4"/><circle cx="226" cy="126" r="7" fill="#3a4253"/>'
      + '<path d="M262 92l24-8v12Z" fill="' + hd4Esc(a.farbe) + '"/></svg>';
  }
  function hd4ShowBild(a) {
    return '<div class="hd4-sk-foto" data-hd4-bild="' + hd4Esc(a.id) + '">' + hd4ShowPlatzhalter(a) + '</div>';
  }
  // Try the candidates of one card, first that loads wins.
  function hd4ShowLaden(el, a) {
    const liste = hd4ShowKandidaten(a);
    const weiter = (i) => {
      if (i >= liste.length || !el.isConnected) return;
      const k = liste[i], img = new Image();
      img.onload = () => {
        if (!el.isConnected) return;
        el.innerHTML = '';
        img.alt = ''; img.className = 'hd4-sk-img';
        el.appendChild(img);
        el.classList.add('hd4-sk-echt', 'hd4-sk-' + k.art);
        if (k.art === 'modell' && hd4ShowQuellen) {
          const q = hd4ShowQuellen[(k.url.split('/').pop() || '').replace(/\.jpg$/, '')];
          if (q) {
            const c = document.createElement('span');
            c.className = 'hd4-sk-quelle';
            c.textContent = 'Photo: ' + q.von + ' · ' + q.lizenz;
            c.title = q.titel + ' — Wikimedia Commons';
            el.appendChild(c);
          }
        }
        if (k.art === 'tint') {
          // the paint: the car's colour, cut to the car's shape, multiplied over the white render
          const lack = document.createElement('span');
          lack.className = 'hd4-sk-lack';
          lack.style.background = a.farbe;
          lack.style.webkitMaskImage = 'url("' + k.url + '")'; lack.style.maskImage = 'url("' + k.url + '")';
          el.appendChild(lack);
        }
      };
      img.onerror = () => { if (k.art !== 'foto') hd4ShowFehlt[k.url] = true; weiter(i + 1); };
      img.decoding = 'async';
      img.src = k.url;
    };
    weiter(0);
  }
  function hd4ShowKarte(a) {
    const s = a.stat || { rennen: 0, siege: 0, podien: 0, runden: 0, poles: 0, beste: null };
    const g = a.grad;
    return '<div class="hd4-sammelkarte hd4-grad-' + g.g.id + '" style="--c:' + hd4Esc(a.farbe) + ';--g:' + g.g.farbe + '" data-hd4-karte="' + hd4Esc(a.id) + '" role="button" tabindex="0" aria-label="' + hd4Esc(a.name) + ', ' + g.g.name + '. Press to turn the card.">'
      + '<div class="hd4-sk-innen">'
      + '<div class="hd4-sk-seite hd4-sk-vorn"><div class="hd4-sk-kopf"><span class="hd4-sk-nr">' + (a.nummer ? '#' + a.nummer : '—') + '</span><span class="hd4-sk-grad">' + g.g.name + '</span></div>'
      + '<div class="hd4-sk-bild">' + hd4ShowBild(a) + '</div>'
      + '<div class="hd4-sk-fuss"><b>' + hd4Esc(a.name) + '</b><small>' + hd4Esc(a.modellName || 'Carrera Hybrid') + (a.verbunden ? ' · <i class="hd4-live">connected</i>' : '') + '</small>'
      + '<div class="hd4-sk-zahlen"><span><b>' + s.siege + '</b>wins</span><span><b>' + s.podien + '</b>podiums</span><span><b>' + s.rennen + '</b>races</span></div></div>'
      + '<div class="hd4-holo" aria-hidden="true"></div><div class="hd4-glanz" aria-hidden="true"></div></div>'
      + '<div class="hd4-sk-seite hd4-sk-hinten"><div class="hd4-sk-kopf"><span class="hd4-sk-nr">' + (a.nummer ? '#' + a.nummer : '—') + '</span><span class="hd4-sk-grad">Record</span></div>'
      + '<dl><dt>Races</dt><dd>' + s.rennen + '</dd><dt>Wins</dt><dd>' + s.siege + '</dd><dt>Podiums</dt><dd>' + s.podien + '</dd><dt>Poles</dt><dd>' + (s.poles || 0) + '</dd><dt>Laps</dt><dd>' + s.runden + '</dd><dt>Best lap</dt><dd>' + (s.beste ? hd4Zeit(s.beste) : '–') + '</dd></dl>'
      + '<div class="hd4-fortschritt"><span>' + (g.naechster ? g.p + ' / ' + g.naechster.ab + ' to ' + g.naechster.name : 'Top grade') + '</span><span class="hd4-balken"><span style="width:' + Math.round(g.anteil * 100) + '%;background:' + (g.naechster ? g.naechster.farbe : g.g.farbe) + '"></span></span></div>'
      + '<small class="hd4-sk-id">' + hd4Esc(a.name) + '</small></div>'
      + '</div></div>';
  }
  hd4Schirm({
    id: 'showroom', titel: 'Showroom', kurz: 'Showroom', icon: HD4_ICON.showroom,
    zeichnen(host) {
      const autos = hd4ShowAutos();
      const sortiert = autos.slice().sort((a, b) => hd4Show.sort === 'name' ? a.name.localeCompare(b.name)
        : hd4Show.sort === 'siege' ? ((b.stat ? b.stat.siege : 0) - (a.stat ? a.stat.siege : 0)) || (b.grad.p - a.grad.p)
        : (b.grad.p - a.grad.p) || (b.verbunden - a.verbunden) || a.name.localeCompare(b.name));
      const zahl = {}; autos.forEach((a) => { zahl[a.grad.g.id] = (zahl[a.grad.g.id] || 0) + 1; });
      host.innerHTML = '<div class="hd4-seite"><div class="hd4-seitenkopf"><h2>Showroom</h2><p>Your collection. Move over a card to catch the light, click to turn it over. Wins, podiums and laps raise a car’s grade.</p></div>'
        + '<div class="hd4-leiste"><span class="hd4-segment">' + [['grad', 'By grade'], ['siege', 'By wins'], ['name', 'By name']].map(([id, name]) => '<button type="button" data-hd4-sort="' + id + '"' + (hd4Show.sort === id ? ' class="an"' : '') + '>' + name + '</button>').join('') + '</span>'
        + '<span class="hd4-legende">' + HD4_GRADE.map((g) => '<span><i style="background:' + g.farbe + '"></i>' + g.name + ' <b>' + (zahl[g.id] || 0) + '</b></span>').join('') + '</span></div>'
        + (autos.length ? '<div class="hd4-sammlung">' + sortiert.map(hd4ShowKarte).join('') + '</div>'
          : '<p class="hd4-leer">No cars yet. Connect a car in the garage – it joins the collection, and its record starts with its first race.</p>')
        + '</div>';
      host.querySelectorAll('[data-hd4-sort]').forEach((b) => b.addEventListener('click', () => { hd4Show.sort = b.dataset.hd4Sort; hd4Neu(); }));
      host.querySelectorAll('[data-hd4-bild]').forEach((el) => { const a = autos.find((x) => x.id === el.dataset.hd4Bild); if (a) hd4ShowLaden(el, a); });
      host.querySelectorAll('.hd4-sammelkarte').forEach((k) => {
        const bewegen = (e) => {
          const r = k.getBoundingClientRect();
          const x = hd4Klemme((e.clientX - r.left) / r.width, 0, 1), y = hd4Klemme((e.clientY - r.top) / r.height, 0, 1);
          k.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); k.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          k.style.setProperty('--rx', ((0.5 - y) * 16).toFixed(2) + 'deg'); k.style.setProperty('--ry', ((x - 0.5) * 20).toFixed(2) + 'deg');
          k.style.setProperty('--hx', (x * 100).toFixed(1) + '%');
          k.classList.add('hd4-sk-aktiv');
        };
        k.addEventListener('pointermove', bewegen);
        k.addEventListener('pointerleave', () => { k.classList.remove('hd4-sk-aktiv'); k.style.setProperty('--rx', '0deg'); k.style.setProperty('--ry', '0deg'); });
        const drehen = () => k.classList.toggle('hd4-sk-gedreht');
        k.addEventListener('click', drehen);
        k.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drehen(); } });
      });
    },
  });
