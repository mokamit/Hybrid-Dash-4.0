# Hybrid-Dash 4.0

Hybrid-Dash 4.0 is Hybrid-Dash 3.0 with everything it had, plus the systems below. They sit inside the
3.0 menus - there is no separate hub:

- **Race Control**: a **Career** card next to Championship; **Analysis** button on the Track card.
- **Garage**: **Showroom** in the action bar.
- **Multiplayer**: the Wi-Fi mode (host / join) and, below it, **Local players** (controllers on this laptop).
- **Options**: tiles for **Analysis**, **Race strategy**, **Race engineer** and **AI drivers**.

## New in 4.0

| Feature | Where | What it does |
|---|---|---|
| **Career mode** | Race Control -> *Career* card | A season in the GT World Challenge format on your own tracks: Sprint Cup rounds (Qualifying 1, Race 1, Qualifying 2, Race 2, one mandatory stop inside the pit window) and Endurance Cup rounds (3 Hours, 6 Hours, 24 Hours, 65-minute maximum stint). Rolling starts, a point for pole, three titles. Pick a saved track for every round or design one. Progression: XP and driver level, prize money for team upgrades, licence points (Bronze to Pro, the AI field gets faster), sponsor objectives, trophies. |
| **Showroom** | Garage -> *Showroom* | Every car as a collector card with a holographic finish that follows the pointer; click to turn it over. A car's record (races, wins, podiums, laps, best lap) raises its grade. The picture is the car's own photo from the Garage, or an image from `img/showroom/` (see the README there): one per model and colour, or one neutral render per model that is tinted to the car's colour. |
| **Engine maps** | Cockpit strip, key **E**, **L3** | Rich / Standard / Lean per driver: power against fuel burn. |
| **Fuel burn** | Options -> *Race strategy* | Wide-open throttle burns over-proportionally; fuel weight makes the car quicker as the stint goes on. |
| **Tyre cliff and flat spots** | Options -> *Race strategy* | Grip drops sharply past each compound's window; a heavy lock-up flat-spots the fronts (vibration, fluttering grip, faster wear) until the tyres are changed. |
| **Pit rules** | Options -> *Race strategy* | Speeding at pit entry is a time penalty; the crew works in sequence (fuel about 3 s, tyres 4 s, full service with front wing 7-8 s); the mini-game still shaves tenths. |
| **Track evolution and light rain** | Options -> *Race strategy* | Rubber builds up with every lap, drizzle takes grip away and washes it off. |
| **Mechanical failures** | Options -> *Race strategy* (off by default) | Thermal throttling, brake fade and impact damage that need a pit stop. |
| **Analysis** | Options -> *Analysis* (or the Track card) | Distance-based speed trace with minimum corner speeds, time-delta graph, throttle and brake traces, sector consistency matrix (standard deviation per sector), incident heatmap. |
| **Race engineer** | Options -> *Race engineer* | Radio callouts for gaps, tyre life, fuel laps, the pit window with a compound call and traffic on exit, weather and failures. |
| **AI drivers** | Options -> *AI drivers* | NPCs with lasting personalities that learn each track piece by piece and remember where passes work against each rival. |
| **Eight players** | Multiplayer -> *Local players* | Up to 8 player slots (was 3): one car per controller on this laptop with a press-to-join lobby and pinned controllers, and remote players from the Multiplayer tab can take any of the slots. |

The 4.0 code lives in `src/98zb-hd4-kern.js` to `src/98zj-hd4-ui.js`; the older files only carry
small hooks. `HYBRIDDASH4.selbsttest()` in the browser console runs the 4.0 self-test.

---

# Hybrid-Dash 3.0 (everything below is still in 4.0)

[⬇ Download the Android app (APK)](https://github.com/mokamit/Hybrid-Dash-4.0/releases/latest/download/HybridDash.apk) · Play in the browser: [mokamit.github.io/Hybrid-Dash-4.0](https://mokamit.github.io/Hybrid-Dash-4.0/)

An open source controller for Carrera Hybrid Bluetooth cars, with physics from scientific
formulae and engine sound from an enginesim implementation, plus a Race Director with flags and
stewards, NPCs, safety car, Pit Boxes, championships and multiplayer. The interface is in English by default; German and
Spanish are one tap away with the language button (top right).

Hybrid-Dash 3.0 is a standalone project built on **[OmegaSim](https://github.com/Luuke42/omegasim) by Luuke**
(MIT License), continuing from HybridDash 2.x. Everything OmegaSim does still works; Hybrid-Dash adds its own
features and its own look on top.

## The 3.0 look: Broadcast

Race-weekend TV graphics across the whole app:

- **Titillium Web** everywhere (bundled in `fonts/`, so it works offline and in the APK); heavy italic capitals for headlines, tabs and timing, plain upright text for everything else.
- **Asphalt and pit-lane greys** with **race red** as the accent and **flag yellow** for flags.
- **Slanted tab bars** with the active tab in white and a solid red rule underneath, in the menu and in the cockpit.
- **Each car's colour as a stripe** in the standings, positions in italics, timing in tabular figures.
- **Flag band** as a solid yellow TV bar with a cut corner.
- No separate title screen: the app opens on the main menu, with a **HYBRID-DASH 3.0** banner on top (Wiki, Tutorial, Controls, app install), a footer strip (version, credits, source) and a language button in the header.

## What Hybrid-Dash adds

Based on OmegaSim **1.3.92** (random events, track sectors, the ACC cockpit screens and everything
before). On top of that:

### Race control
| Feature | Where | What it does |
|---|---|---|
| **Race Director** | Cockpit → *Race Director* tab | Green, yellow, VSC, safety car, red flag, final lap and weather in one bar, with live standings and an incident log. Each driver has a **steward menu** (⚑): **+5 s / +10 s time penalty**, clear penalties, **black flag (DSQ)**, **DNF** and reinstate. Penalties count in standings and results; DNF and DSQ cars are stopped and sorted to the bottom. Confirmations use the app's own dialog, so the race keeps running while you decide. |
| **Safety car on demand** | Race Director → *SC* | Without a car in the Safety Car role, SC asks which car should drive it (spare cars first, then NPCs) or offers VSC instead. |
| **Automatic safety car** | Race settings | If a racing car is off the track or hasn't moved for 3 s (adjustable 1–10 s), the app asks: **Deploy** (A / Cross / Enter), **VSC** (X / Square / V) or **Ignore** (B / Circle / Esc). Can also deploy straight away without asking. Ignores the standing grid, cars in the pit and the safety car itself. Track mode only. |
| **Safety car queue** | – | Under yellow or the safety car, the field closes up to about 1–2 car lengths, keeps its gaps and never overtakes. |

### Pit Boxes
| Feature | Where | What it does |
|---|---|---|
| **Pit Boxes in the track editor** | Track editor → *Pit Boxes* | **Set automatically** for a number of cars (spread around the lap: straights at the right edge, curves at the outside edge, never on the starting grid), **set manually** (tap a piece: right → left → both sides → off; automatic ones can be edited), or **off**. Shown on the map as P1, P2, … and saved with the track. A straight holds up to 2 boxes (one per side), a standard curve 1 (outside). |
| **Pit Box per car** | Starting grid | Every car gets a Pit Box (grid order by default, changeable per car and remembered). The map shows each box in its car's colour. |
| **NPC pit stops** | – | Two pieces before its box an NPC switches on the pit limiter and flashing lights, parks at its edge (left boxes use the mirrored parking sequence), leaves straight away along the edge at the limiter, and rejoins the racing line once the track behind is clear. |
| **Automatic pit stop for your car** | Hold **LB / L1** (1 s to start, keep holding to the box) | Your car drives itself to its Pit Box at the pit limiter, parks, stays still for the normal pit service (fuel, tyres, mini-game), then pulls away along its edge at the limiter and hands back control. How long the limiter stays on afterwards is a setting (Race settings, default **2 s**). A short tap on LB / L1 still selects tyres. Keep holding until the car reaches its Pit Box: letting go on the way cancels the stop and the car returns to normal speed. If the box is just 1–2 pieces ahead (or the car passed it during the 1 s hold), it goes straight in – no extra lap. |
| **NPCs leave the track after the finish** | Race end | Each NPC crosses the line, drives on for 2 pieces, then turns to the outside of the track and speeds off it for 1.5 s and stops – instead of driving a lap back to the grid. |

### Cockpit and screens
| Feature | Where | What it does |
|---|---|---|
| **Cockpit tabs** | Cockpit | Three named tabs: **Dashboard** (sub menu **OmegaSim / Digital Dash**, remembers the last one), **Pit Wall** and **Race Director**, under a neon green line. |
| **Digital Dash** | Dashboard → *Digital Dash* | A tile dashboard that scales to any window, with pit stop, yellow flag, G-force, weather and lights. |
| **Starting grid** | Before every race | Smaller cards in two staggered columns (each car half a row behind the one before, on its side of the track), a Pit Box picker per car, and a **Race** panel: type, duration, weather, start, mandatory stops, cars, track, sectors, Pit Boxes, random events and automatic safety car. |
| **Main menu** | Race Control | **Car Summary** lists every car with its number badge; the value bars look and press like buttons; panels light up on hover. Mute button and the two-laptops button sit at the top right. |

### Cars and drivers
| Feature | Where | What it does |
|---|---|---|
| **Car numbers** | Garage → *Car number* | #1, #2, … instead of Greek letters, or your own number 1–99 (remembered per car, never twice in one field). |
| **Garage** | Garage | Action bar at the top: connect, **⟳ Reconnect previous cars** (one click for every car this browser has used before), start NPCs, disconnect all, cockpit, drive virtually. The selected car has a green outline, a car's own photo fills its card, and the right side is titled *Driver and Car Settings*. |
| **Random NPC driver names** | Garage / Race settings | A car without a name gets a unique random driver name the first time it becomes an NPC. 🎲 rolls a new one. |
| **Driver avatars** | Garage | A flat helmet-and-suit avatar for every driver, patterned from the car's make and colour. Tap it to restyle. |
| **Announcements** | Race settings | Connecting cars and new drivers, the standings, safety-car calls and steward decisions name the **car number, driver, colour and make/model** ("Car number 7 connected: Mo Kamit, the yellow BMW M4 GT3."). |

### Controllers and language
| Feature | Where | What it does |
|---|---|---|
| **PS / Xbox presets** | Options → Controller | Button names and pictures for PlayStation or Xbox pads. |
| **Mappable buttons** | Options → Controller | *Confirmation Button* (default A / Cross) and *Automatic pit stop* (default LB / L1, hold 1 s). |
| **English by default** | Language button (header) | The whole interface is translated, German and Spanish one tap away. |

### Two laptops
| Feature | Where | What it does |
|---|---|---|
| **Two-laptop mode** | **⇄** at the top right | Split the Bluetooth connections across two laptops for bigger fields (about 7–9 cars per laptop). Pair with a short code; both remember it and reconnect by themselves. See below. |

The HybridDash code lives in `src/98i-hybriddash.js` (safety car, names, avatars, voice),
`98j-hd-relay.js` and `98k-hd-pairing.js` (two laptops), `98l-hd-ui.js` (mute, pad presets),
`98m-hd-cockpit.js` (Digital Dash, cockpit tabs), `98n-hd-rennleitung.js` (Race Director) and
`98o-hd-boxen.js` (Pit Boxes, automatic pit stop). The original files only carry small hooks,
so OmegaSim updates can still be merged.

## Two-laptop mode (more cars)

1. Open HybridDash in Chrome or Edge on **both** laptops (same Wi-Fi). On the helper laptop open **`helper.html`** – a dedicated page that shows only the helper panel.
2. **Laptop A (host):** Garage → *Two laptops…* (or **⇄** at the top right) → *HOST* → *Create pairing code*. A short code like `K7Q-2XM` appears.
3. **Laptop B (helper):** type the code → *Pair*. Both show **LINKED**.
4. On laptop B press *Connect a car to this laptop* once per car. Each one appears in laptop A's Garage within a second.

Both laptops remember the pairing: after a reload, a dropped link or the next race night they find each other by themselves (on the helper, *Reconnect known cars* brings its cars back). *Unlink* stops that; *Forget pairing* clears the code. The short code needs internet only to introduce the laptops (an encrypted Supabase Realtime channel); the car data always goes laptop to laptop over your Wi-Fi. Without internet, use *Pair without internet* (copy two codes).

Connect the cars you want on laptop A as usual. Each laptop's Bluetooth adapter holds roughly
7–9 cars, so two laptops carry about twice that. Keep the helper tab open and in front during a race.
The link is LAN only: no server, nothing leaves your network.

## Building

```bash
python3 tools/build.py          # joins src/* into index.html (+ sw.js, app-update.json)
python3 -m http.server 8080     # then open http://localhost:8080 in Chrome/Edge
```

Web Bluetooth needs Chrome or Edge (desktop or Android) on `https://` or `localhost`.
In the browser console, `HYBRIDDASH.selbsttest()`, `HYBRIDDASH_RL.selbsttest()` (Race Director)
and `HYBRIDDASH_BOX.selbsttest()` (Pit Boxes, automatic pit stop) run the HybridDash self-tests;
the app's full self-test is in the developer tab.

### Point the app at your own repository

Update checks, APK links and the “Source on GitHub” link use a placeholder until you run:

```bash
python3 tools/hd_set_repo.py OWNER/REPO && python3 tools/build.py
```

### Android

The APK (Capacitor) lives in `android-app/`. Its application id is `com.hybriddash.app`, so it
installs next to OmegaSim rather than replacing it. Releases are cut by pushing a `v*` tag
(`.github/workflows/release.yml`).

### Windows

Double-click `Start HybridDash.bat` (local server + app window, nothing to install).

## License

MIT, see [LICENSE](LICENSE). Original work © 2026 Luuke (OmegaSim).
Modifications © 2026 Mo Kamit (HybridDash / Hybrid-Dash 3.0), released under the same MIT License.

Titillium Web font (in `fonts/`) © Accademia di Belle Arti di Urbino, SIL Open Font License 1.1 (see `fonts/OFL-Titillium-Web.txt`).
