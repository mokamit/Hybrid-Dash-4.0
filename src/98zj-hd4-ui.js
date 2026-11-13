  // =========================================================================
  // Hybrid-Dash 4.0: UI (styles for the 4.0 pages, menu entries, self-test)
  // =========================================================================
  // The 4.0 pages live inside the app's own menus (see HD4_ORT in 98zb-hd4-kern.js); there is no
  // separate hub. hd4HubKnopf() is still called by the top-bar renderer and adds nothing.
  function hd4HubKnopf() { /* no hub button: Career has its card, the rest sits in Garage, Multiplayer and Options */ }

  (function hd4Stil() {
    const s = document.createElement('style');
    s.id = 'hd4-stil';
    s.textContent = `
:root{--hd4-akzent:#e10600;--hd4-flaeche:#12151c;--hd4-rand:#262b36;--hd4-text:#f4f6fb;--hd4-leise:#a9b2c4}
#hd4-hud[hidden],#hd4-funk[hidden]{display:none}
.hd4-seite{max-width:1180px;margin:0 auto;color:var(--hd4-text);font-size:15px;line-height:1.5}.hd4-karte-seite{max-width:1240px}.hd4-seitenkopf h2{margin:0 0 4px;font-size:28px;font-style:italic;font-weight:900;text-transform:uppercase;text-wrap:balance}.hd4-seitenkopf p{margin:0 0 18px;color:var(--hd4-leise);max-width:70ch}
.hd4-raster2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.hd4-karte{background:var(--hd4-flaeche);border:1px solid var(--hd4-rand);border-radius:4px;padding:16px;min-width:0;border-top:2px solid #3a3f4a}
.hd4-karte h3{margin:0 0 12px;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:var(--hd4-leise)}
.hd4-breit{grid-column:1/-1}
.hd4-knopf{padding:8px 14px;border-radius:2px;text-transform:uppercase;font-style:italic;letter-spacing:.03em;border:1px solid var(--hd4-rand);background:#1a1f29;color:var(--hd4-text);font:inherit;font-weight:600;cursor:pointer}
.hd4-knopf:hover{border-color:#4a5262}.hd4-knopf:disabled{opacity:.4;cursor:default}.hd4-knopf:focus-visible{outline:2px solid #00d6ff;outline-offset:2px}
.hd4-haupt,.hd4-aktiv{background:var(--hd4-akzent);border-color:var(--hd4-akzent);color:#fff}.hd4-gefahr{color:#ff8a8a;border-color:#5a2a2a}
.hd4-knopfreihe{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.hd4-schalter,.hd4-wahl{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid #1c212b}.hd4-wahl{justify-content:space-between;flex-wrap:wrap}
.hd4-schalter input{position:absolute;opacity:0}.hd4-schieber{flex:none;width:40px;height:22px;border-radius:11px;background:#2a303c;position:relative;transition:background .15s}
.hd4-schieber::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}
.hd4-schalter input:checked+.hd4-schieber{background:var(--hd4-akzent)}.hd4-schalter input:checked+.hd4-schieber::after{transform:translateX(18px)}
.hd4-schalter input:focus-visible+.hd4-schieber{outline:2px solid #00d6ff;outline-offset:2px}
.hd4-schalter-text b{display:block}.hd4-schalter-text small,.hd4-klein{color:var(--hd4-leise);font-size:13px}
.hd4-segment{display:inline-flex;border:1px solid var(--hd4-rand);border-radius:10px;overflow:hidden;flex-wrap:wrap}
.hd4-segment button{padding:6px 12px;background:none;border:0;color:var(--hd4-leise);font:inherit;font-weight:600;cursor:pointer}.hd4-segment button.an{background:#2a303c;color:#fff}
.hd4-leiste{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
.hd4-feld{display:inline-flex;align-items:center;gap:8px;color:var(--hd4-leise);font-size:13px}.hd4-feld select,.hd4-feld input,.hd4-ort-feld,.hd4-kalender select{background:#0b0d12;color:var(--hd4-text);border:1px solid var(--hd4-rand);border-radius:8px;padding:6px 8px;font:inherit;max-width:100%}
.hd4-feld-gross{display:flex;flex-direction:column;align-items:stretch;margin-bottom:8px}
.hd4-leer,.hd4-hinweis{color:var(--hd4-leise);padding:10px 0}.hd4-hinweis{color:#ffcf7a}
.hd4-gut{color:#3ddc84}.hd4-schlecht{color:#ff6b6b}.hd4-jubel{color:#f5c542;font-weight:700}
.hd4-balken{display:inline-block;flex:1;min-width:60px;height:7px;border-radius:4px;background:#232935;overflow:hidden;vertical-align:middle}.hd4-balken>span{display:block;height:100%;background:var(--hd4-akzent)}
.hd4-punkt{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px}
.hd4-liste{margin:0;padding-left:18px;color:var(--hd4-leise)}.hd4-liste li{margin:6px 0}.hd4-liste b{color:var(--hd4-text)}
.hd4-modus-reihe{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}
.hd4-modus-karte{border:1px solid var(--hd4-rand);border-top:3px solid var(--c);border-radius:10px;padding:10px;font-size:13px}.hd4-modus-karte span{display:block;color:var(--hd4-leise);margin:2px 0 6px}
.hd4-modus-karte dl,.hd4-werte,.hd4-sk-hinten dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;align-items:center}.hd4-modus-karte dd,.hd4-sk-hinten dd{margin:0;text-align:right;font-variant-numeric:tabular-nums}.hd4-werte dd{margin:0}
.hd4-fahrer-liste{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}.hd4-fahrer{border:1px solid var(--hd4-rand);border-radius:12px;padding:12px}.hd4-fahrer-kopf{display:flex;align-items:center;margin-bottom:8px}.hd4-fahrer small{display:block;color:var(--hd4-leise)}
.hd4-wissen,.hd4-fortschritt{display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;color:var(--hd4-leise)}.hd4-rivalen{margin:6px 0 0;padding-left:16px;font-size:13px;color:var(--hd4-leise)}
.hd4-tab,.hd4-matrix{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:14px}.hd4-tab td,.hd4-tab th,.hd4-matrix td,.hd4-matrix th{padding:6px 8px;border-bottom:1px solid #1c212b;text-align:left}
.hd4-matrix td{text-align:right}.hd4-mx-best{font-weight:800}.hd4-mx-schlecht{color:#ffb02e}.hd4-tabelle-rahmen{overflow-x:auto}.hd4-ich{color:#ffd400;font-weight:700}
.hd4-befund{margin:10px 0 0;padding:10px 12px;border-left:3px solid var(--hd4-akzent);background:#0e1218;border-radius:0 8px 8px 0}
.hd4-chart{width:100%;height:auto;display:block}.hd4-ch-kurve{fill:#fff;opacity:.045}.hd4-ch-gitter{stroke:#232935;stroke-width:1}.hd4-ch-sektor{stroke:#5b6475;stroke-dasharray:4 4}
.hd4-ch-klein{fill:#8f99ad;font-size:11px}.hd4-ch-a{fill:none;stroke:#4db8ff;stroke-width:2}.hd4-ch-b{fill:none;stroke:#8f99ad;stroke-width:1.5;stroke-dasharray:6 4}
.hd4-ch-gas{fill:none;stroke:#3ddc84;stroke-width:2}.hd4-ch-br{fill:none;stroke:#ff5c5c;stroke-width:2}.hd4-ch-delta{fill:none;stroke:#fff;stroke-width:2}.hd4-ch-verlust{fill:#ff5c5c;opacity:.18}.hd4-ch-gewinn{fill:#3ddc84;opacity:.18}
.hd4-ch-min{fill:#f5c542}.hd4-ch-minlabel{fill:#f5c542;font-size:10px}.hd4-ch-faden{stroke:#fff;stroke-width:1;opacity:.6}
.hd4-ablese{position:sticky;top:-22px;z-index:2;display:flex;gap:16px;flex-wrap:wrap;padding:8px 12px;margin-bottom:10px;background:#0b0d12;border:1px solid var(--hd4-rand);border-radius:10px;font-size:13px;color:var(--hd4-leise)}.hd4-ablese b{color:#fff}
.hd4-charts{display:grid;gap:14px}.hd4-kennzahl small{display:block;color:var(--hd4-leise);font-size:11px}
.hd4-legende{display:inline-flex;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--hd4-leise)}.hd4-legende i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px}
.hd4-karte-svg{width:100%;max-height:60vh}.hd4-karte-bahn{fill:none;stroke:#232935;stroke-linejoin:round}.hd4-karte-linie{fill:none;stroke:#3a4253}.hd4-karte-punkt{opacity:.85;stroke:#07090d;stroke-width:1}.hd4-karte-start{fill:#fff}.hd4-karte-text{fill:#8f99ad}
.hd4-funklog{list-style:none;margin:0;padding:0;max-height:50vh;overflow:auto}.hd4-funklog li{display:flex;gap:10px;padding:6px 0;border-bottom:1px solid #1c212b}.hd4-funklog time{color:var(--hd4-leise);font-variant-numeric:tabular-nums}
.hd4-profil{border-top:3px solid var(--c)}.hd4-profil-kopf{display:flex;gap:12px;align-items:center}.hd4-profil-kopf small{display:block;color:var(--hd4-leise)}.hd4-lizenz{padding:4px 10px;border-radius:8px;background:var(--c);color:#0b0d12;font-weight:800;font-size:12px}
.hd4-kennzahlen,.hd4-beute{display:flex;gap:22px;margin:12px 0;flex-wrap:wrap}.hd4-kennzahlen small,.hd4-beute small{display:block;color:var(--hd4-leise);font-size:11px;text-transform:uppercase}.hd4-kennzahlen b,.hd4-beute b{font-size:22px}
.hd4-ort{font-size:22px;font-weight:700;margin:0 0 8px}.hd4-sessions,.hd4-kalender,.hd4-ziele,.hd4-upgrades,.hd4-trophaeen,.hd4-slots,.hd4-padliste{list-style:none;margin:0 0 10px;padding:0}
.hd4-sessions{display:flex;gap:6px;flex-wrap:wrap}.hd4-sessions li{padding:6px 10px;border:1px solid var(--hd4-rand);border-radius:8px;font-size:13px}.hd4-sessions small{display:block;color:var(--hd4-leise)}.hd4-sessions .jetzt{border-color:var(--hd4-akzent);background:rgba(225,6,0,.15)}.hd4-sessions .fertig{opacity:.55}
.hd4-kalender li,.hd4-upgrades li,.hd4-slots li,.hd4-padliste li{display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #1c212b;flex-wrap:wrap}.hd4-kalender .fertig{opacity:.55}.hd4-kalender .jetzt .hd4-rnr{color:#ffd400}
.hd4-rtyp{font-size:11px;font-weight:800;padding:2px 7px;border-radius:6px;background:#2a303c}.hd4-rtyp.hd4-sprint{background:#4db8ff;color:#06121c}.hd4-rtyp.hd4-endurance{background:#f5c542;color:#1c1503}
.hd4-ort-feld{flex:1;min-width:120px}.hd4-mini{background:none;border:1px solid var(--hd4-rand);color:var(--hd4-leise);border-radius:6px;cursor:pointer}
.hd4-ziele li{padding:5px 0}.hd4-ziele .fertig{color:#3ddc84}.hd4-upgrades li{justify-content:space-between}.hd4-upgrades small{display:block;color:var(--hd4-leise)}
.hd4-stufen i{display:inline-block;width:18px;height:5px;border-radius:3px;background:#2a303c;margin:4px 3px 0 0}.hd4-stufen i.an{background:var(--hd4-akzent)}.hd4-titel{color:#f5c542}
.hd4-bericht-raster{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px}
.hd4-slot{border-left:3px solid var(--c);padding-left:10px!important}.hd4-slot-nr{font-weight:800;color:var(--c);width:28px}.hd4-slot.drueckt,.hd4-padliste .drueckt{background:#16241b}.hd4-slot-status{color:var(--hd4-leise);font-size:13px}
.hd4-sammlung{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:22px;perspective:1200px}
.hd4-sammelkarte{aspect-ratio:5/7;cursor:pointer;perspective:1000px;--rx:0deg;--ry:0deg;--mx:50%;--my:50%}
.hd4-sk-innen{position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .45s;transform:rotateX(var(--rx)) rotateY(var(--ry))}
.hd4-sk-aktiv .hd4-sk-innen{transition:transform .06s}.hd4-sk-gedreht .hd4-sk-innen{transform:rotateY(180deg)}
.hd4-sk-seite{position:absolute;inset:0;backface-visibility:hidden;border-radius:3px;overflow:hidden;border:1px solid rgba(255,255,255,.16);border-top:3px solid var(--g);background:linear-gradient(160deg,#171b24,#0b0d12);display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,.5)}
.hd4-sk-hinten{transform:rotateY(180deg);padding:0 14px 14px}.hd4-sk-hinten dl{margin:14px 0}.hd4-sk-id{color:var(--hd4-leise)}
.hd4-sk-kopf{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;font-weight:900;font-style:italic;font-size:20px}.hd4-sk-hinten .hd4-sk-kopf{padding:10px 0}.hd4-sk-grad{color:var(--g);font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.hd4-sk-bild{flex:1;min-height:0;margin:0;overflow:hidden;background:#0b0d12}.hd4-sk-bild img,.hd4-sk-bild svg{width:100%;height:100%;object-fit:cover;display:block}.hd4-sk-foto{position:relative;width:100%;height:100%;background:radial-gradient(ellipse at 50% 78%,#2a2f3a 0%,#0b0d12 62%)}.hd4-sk-tint .hd4-sk-img,.hd4-sk-exakt .hd4-sk-img{object-fit:contain}.hd4-sk-quelle{position:absolute;left:0;right:0;bottom:0;padding:2px 6px;font-size:9.5px;line-height:1.3;color:rgba(255,255,255,.82);background:rgba(0,0,0,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.hd4-sk-lack{position:absolute;inset:0;mix-blend-mode:multiply;-webkit-mask-size:contain;mask-size:contain;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;pointer-events:none}
.hd4-sk-fuss{padding:10px 12px;background:rgba(28,24,28,.92)}.hd4-sk-fuss>b{font-size:19px;font-style:italic;text-transform:uppercase;letter-spacing:.02em}.hd4-sk-fuss{border-left:5px solid var(--c)}.hd4-sk-fuss small{display:block;color:var(--hd4-leise)}.hd4-live{color:#3ddc84;font-style:normal}
.hd4-sk-zahlen{display:flex;gap:12px;margin-top:6px;font-size:11px;color:var(--hd4-leise)}.hd4-sk-zahlen b{display:block;font-size:17px;color:#fff}
.hd4-holo,.hd4-glanz{position:absolute;inset:0;pointer-events:none;border-radius:2px;opacity:0;transition:opacity .25s}
.hd4-holo{background:repeating-linear-gradient(115deg,#ff2e63 0%,#ffd23f 12%,#3ddc84 24%,#4db8ff 36%,#b08cff 48%,#ff2e63 60%);background-size:300% 300%;background-position:var(--mx) var(--my);mix-blend-mode:color-dodge}
.hd4-glanz{background:radial-gradient(circle at var(--mx) var(--my),rgba(255,255,255,.55),transparent 45%);mix-blend-mode:overlay}
.hd4-sk-aktiv .hd4-holo{opacity:.28}.hd4-grad-club.hd4-sk-aktiv .hd4-holo{opacity:.4}.hd4-grad-podium.hd4-sk-aktiv .hd4-holo{opacity:.55}.hd4-grad-legende .hd4-holo{opacity:.3}.hd4-grad-legende.hd4-sk-aktiv .hd4-holo{opacity:.7}.hd4-sk-aktiv .hd4-glanz{opacity:.8}
#hd4-hud{position:fixed;left:8px;top:100px;z-index:800;font:12px/1.3 system-ui,sans-serif;color:#fff;pointer-events:auto;max-width:calc(100vw - 16px)}
.hd4-hud-zeile{display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-bottom:4px}.hd4-hud-p{font-weight:800;color:var(--c);width:22px}
.hd4-chip{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:8px;background:rgba(11,13,18,.86);border:1px solid #2a303c;color:#fff;font:inherit}.hd4-chip i{font-style:normal;color:#8f99ad;font-size:10px}.hd4-chip small{color:#8f99ad}
button.hd4-chip{cursor:pointer}.hd4-chip-modus{border-color:var(--c);color:var(--c);font-weight:800}.hd4-chip .hd4-balken{width:46px;flex:none}
.hd4-rot{border-color:#ff5c5c;color:#ff8a8a}.hd4-gelb{border-color:#ffb02e;color:#ffcf7a}.hd4-hud-strecke{margin-top:4px;padding:3px 8px;border-radius:8px;background:rgba(11,13,18,.86);display:inline-block}.hd4-hud-strecke i{font-style:normal;color:#8f99ad;font-size:10px}.hd4-fenster-offen{color:#3ddc84}
#hd4-funk{position:fixed;left:50%;top:64px;transform:translateX(-50%);z-index:810;display:flex;gap:8px;align-items:center;max-width:min(680px,92vw);padding:8px 14px;border-radius:12px;background:rgba(11,13,18,.92);border:1px solid var(--hd4-akzent);color:#fff;font:14px/1.35 system-ui,sans-serif}
#hd4-funk svg{width:18px;height:18px;flex:none;color:#ffd400}
@media (prefers-reduced-motion:reduce){.hd4-sk-innen,.hd4-schieber,.hd4-schieber::after{transition:none}}
@media (prefers-reduced-motion:no-preference){.hd4-blink{animation:hd4blink 1s steps(2) infinite}}@keyframes hd4blink{50%{opacity:.45}}
`;
    document.head.appendChild(s);
  })();

  // ---- SELF-TEST: HYBRIDDASH4.selbsttest() in the browser console -------------------------------
  // Pure checks of the 4.0 rules. A race is faked by setting raceState for the duration of the
  // test and restoring it afterwards; nothing is written to storage.
  function hd4Selbsttest() {
    const r = [];
    const ok = (name, bed, info) => r.push({ name, ok: !!bed, info: info === undefined ? '' : String(info) });
    const stateVor = raceState, cfgVor = JSON.stringify(hd4.cfg), simVor = { gummi: hd4Sim.gummi, niesel: hd4Sim.niesel, runden: hd4Sim.runden };
    const pVor = Object.assign({}, hd4SimPlatz(1));
    try {
      hd4Tief(hd4.cfg, JSON.parse(JSON.stringify(HD4_VORGABE)));
      // outside a race every layer is neutral
      raceState = 'idle';
      ok('idle: fuel factor 1', hd4Verbrauch(1, 1) === 1);
      ok('idle: power factor 1', hd4Leistung(1) === 1);
      ok('idle: grip factor 1', hd4GripFaktor(1, physEngine) === 1);
      raceState = 'racing';
      const p = hd4SimPlatz(1);
      Object.assign(p, { modus: 'std', wot: 0, platt: 0, defekt: null, aero: 0, upgrades: null });
      hd4Sim.gummi = 0; hd4Sim.niesel = 0; hd4Sim.runden = 40;
      // fuel: wide open burns more than part throttle, per unit of throttle
      const voll = hd4Verbrauch(1, 1), halb = hd4Verbrauch(1, 0.5);
      ok('WOT burns over-proportionally', voll > 1.15 && halb < 0.9, voll.toFixed(2) + ' / ' + halb.toFixed(2));
      p.wot = 6; ok('pinned throttle burns more still', hd4Verbrauch(1, 1) > voll); p.wot = 0;
      p.modus = 'rich'; const rich = hd4Verbrauch(1, 1), richP = hd4Leistung(1);
      p.modus = 'lean'; const lean = hd4Verbrauch(1, 1), leanP = hd4Leistung(1);
      p.modus = 'std'; const stdP = hd4Leistung(1);
      ok('Rich burns more than Lean', rich > voll && lean < voll, rich.toFixed(2) + ' > ' + voll.toFixed(2) + ' > ' + lean.toFixed(2));
      ok('Rich > Standard > Lean power', richP > stdP && stdP > leanP && richP <= 1, [richP, stdP, leanP].join(' / '));
      // tyre cliff
      ok('no cliff before the window ends', hd4Klippe('weich', 0.5) === 1 && hd4Klippe('hart', 0.85) === 1);
      ok('soft cliff comes first and is deepest', hd4Klippe('weich', 0.8) < hd4Klippe('mittel', 0.8) && hd4Klippe('mittel', 0.8) < hd4Klippe('hart', 0.8) + 1e-9,
        [hd4Klippe('weich', 0.8), hd4Klippe('mittel', 0.8), hd4Klippe('hart', 0.8)].map((x) => x.toFixed(3)).join(' / '));
      ok('cliff is progressive', (1 - hd4Klippe('weich', 1)) > 2.5 * (1 - hd4Klippe('weich', 0.75)));
      // flat spot and track state reduce / add grip
      const g0 = hd4GripFaktor(1, physEngine);
      p.platt = 0.6; const g1 = hd4GripFaktor(1, physEngine); p.platt = 0;
      ok('flat spot costs grip', g1 < g0, g0.toFixed(3) + ' -> ' + g1.toFixed(3));
      hd4Sim.gummi = 1; const g2 = hd4GripFaktor(1, physEngine);
      hd4Sim.niesel = 1; const g3 = hd4GripFaktor(1, physEngine); hd4Sim.niesel = 0; hd4Sim.gummi = 0;
      ok('rubber adds grip, drizzle takes more away', g2 > g0 && g3 < g0, [g0, g2, g3].map((x) => x.toFixed(3)).join(' / '));
      // the grip layer restores the base exactly
      const basis = physEngine.config.gripScale;
      p.platt = 0.8; hd4GripSetzen(1, physEngine); const mit = physEngine.config.gripScale;
      p.platt = 0; raceState = 'idle'; hd4GripSetzen(1, physEngine);
      ok('grip layer is reversible', mit < basis && Math.abs(physEngine.config.gripScale - basis) < 1e-12, basis + ' -> ' + mit.toFixed(4) + ' -> ' + physEngine.config.gripScale);
      raceState = 'racing';
      // failures
      p.defekt = { art: 'thermal', seit: 0 }; ok('thermal throttling cuts power', hd4Leistung(1) < stdP); p.defekt = null;
      // pit: sequential crew
      hd4.cfg.sim.boxFolge = true;
      ok('engineer numbers', hd4SagSek(0.5) === 'half a second' && hd4SagSek(1.42) === '1 point 4');
      // career points and calendar
      ok('sprint points 16.5 for a win', HD4_PUNKTE.sprint[0] === 16.5 && HD4_PUNKTE.endurance[0] === 25 && HD4_PUNKTE.endurance6[0] === 33);
      const k = hd4KNeu('Test', 'voll', 6, 0, 1);
      ok('full season: 5 sprint + 5 endurance', k.kalender.filter((x) => x.typ === 'sprint').length === 5 && k.kalender.length === 10);
      ok('sprint round: Q1 R1 Q2 R2', k.kalender[1].sessions.map((s) => s.art).join() === 'quali,rennen,quali,rennen');
      ok('3 h endurance: two mandatory stops', hd4KStopps(k.kalender[0]) === 2 && hd4KStopps(k.kalender[1]) === 1);
      ok('driver level curve', hd4KLevel(0) === 1 && hd4KLevel(150) === 2 && hd4KLevel(600) === 3);
      // showroom grades
      ok('card grades', hd4Grad(null).g.id === 'stock' && hd4Grad({ siege: 10, podien: 0, rennen: 0, runden: 0 }).g.id === 'legende');
      // analysis geometry on a known track
      const tr = codeToTrack('SG4R4G4');
      const geo = hd4AnGeo(tr.tiles);
      ok('track distance grows monotonically', geo.S.every((x, i) => i === 0 || x > geo.S[i - 1]) && geo.gesamt > 100, (geo.gesamt / 100).toFixed(2) + ' m');
      const sek = hd4AnSektoren(geo, 3);
      ok('three sectors', sek.length === 4 && sek[0] === 0 && sek[3] === geo.n && sek[1] < sek[2]);
      const n = geo.n, teile = []; for (let i = 0; i < n; i++) teile.push(i * 500);
      const sp = { ms: n * 500, proben: [] }; for (let t = 0; t < n * 500; t += 100) sp.proben.push([t, 50 + 30 * Math.sin(t / 700), 80, 0, 3, 0]);
      const lap = hd4AnRunde(sp, teile, geo);
      ok('lap points sorted by distance', lap.every((x, i) => i === 0 || x.s >= lap[i - 1].s - 1e-6) && Math.abs(lap[lap.length - 1].s - geo.gesamt) < 1e-6);
      const ra = hd4AnRaster(lap, geo.gesamt, 100);
      ok('time at the end of the lap', Math.abs(ra[100].t - sp.ms) < 1 && ra[0].t === 0);
      // AI personality is stable
      const car = { device: { id: 'test-ki' }, alias: 'Mara Kovac' };
      ok('AI personality is deterministic', JSON.stringify(hd4KiPerson(car)) === JSON.stringify(hd4KiPerson(car)));
      // players
      ok('eight player slots', SPIELER_MAX === 8 && !!zusatzPlatz(8) && zusatzPlatzVonRolle('player8') === zusatzPlatz(8));
    } catch (e) { ok('self-test ran through', false, e && e.message); }
    finally {
      raceState = stateVor;
      hd4.cfg = JSON.parse(cfgVor);
      Object.assign(hd4Sim, simVor); Object.assign(hd4SimPlatz(1), pVor);
      try { hd4GripSetzen(1, physEngine); } catch (e) { /* loading */ }
    }
    const fehler = r.filter((x) => !x.ok);
    return { ok: fehler.length === 0, bestanden: r.length - fehler.length, gesamt: r.length, fehler, alle: r };
  }
  window.HYBRIDDASH4.selbsttest = hd4Selbsttest;

  // ---- MAIN MENU: the Career card (static markup) shows where the career stands; two small ------
  // ANALYSIS button on the Track card, in the cards' own style. (The Showroom is in the Garage's action bar:
  // a fourth button on the Cars & Drivers card would change the D-pad's way from that card down to Championship.)
  function hd4MenueKnopf(text, ziel, titel) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'k-knopf hd4-menue-knopf'; b.setAttribute('data-i18n-skip', ''); b.dataset.hd4Auf = ziel;
    b.textContent = text; if (titel) b.title = titel;
    b.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); hd4Oeffnen(ziel); });
    return b;
  }
  function hd4MenueEintraege() {
    try {
      const strecke = $('fa-strecke'), sr = strecke ? strecke.querySelector('.k-knopfreihe') : null;
      if (sr && !sr.querySelector('.hd4-menue-knopf')) {
        const nach = sr.querySelector('#fa-hd-tele') || sr.querySelector('#fa-raum');
        const b = hd4MenueKnopf('Analysis', 'analyse', 'Trace graphs, sector consistency, incident heatmap');
        if (nach && nach.nextSibling) sr.insertBefore(b, nach.nextSibling); else sr.appendChild(b);
      }
    } catch (e) { /* the menu stays as it was */ }
  }
  hd4MenueEintraege();
  hd4Takt(() => {
    // the 3.0 menu rebuilds its cards (language change, connect): put the entries back if they went
    if (!document.querySelector('.hd4-menue-knopf')) hd4MenueEintraege();
    const el = document.getElementById('fa-hd4-karriere-text');
    if (!el) return;
    const d = hd4K && hd4K.d, n = d ? hd4KNaechste() : null;
    const txt = !d ? 'Start a career' : n ? 'Round ' + (d.idx + 1) + '/' + d.kalender.length + ' · ' + n.session.name : 'Season ' + d.saison + ' complete';
    if (el.textContent !== txt) el.textContent = txt;
  });
  // Enter on the focused Career card (the click comes from 51-konsole.js)
  (function hd4KarteTaste() {
    const k = document.getElementById('fa-hd4-karriere');
    if (k) k.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === k) { e.preventDefault(); hd4Oeffnen('karriere'); } });
  })();
