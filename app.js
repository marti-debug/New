/* Verkäufer-Cockpit – Oberfläche. Liest ausschließlich window.COCKPIT_DATA (siehe data.js). */
(function () {
  "use strict";
  const D = window.COCKPIT_DATA;
  const TAG = 86400000;
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const angebotNach = new Map(D.angebote.map((a) => [a.id, a]));

  // ---------- Hilfen ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const zahl = new Intl.NumberFormat("de-DE");
  const pct = (x, st = 1) => new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: st, maximumFractionDigits: st }).format(x);
  const datKurz = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit" });
  const datTag = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit" });
  const tageSeit = (d) => Math.round((heute - new Date(d).setHours(0, 0, 0, 0)) / TAG);
  function vorZeit(d) {
    const h = Math.round((Date.now() - d.getTime()) / 3600000);
    if (h < 1) return "gerade eben";
    if (h < 24) return "vor " + h + " Std.";
    const t = Math.round(h / 24);
    return "vor " + t + (t === 1 ? " Tag" : " Tagen");
  }
  function toast(text) {
    const t = document.getElementById("toast");
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  // ---------- Zustand ----------
  const BEREICHE = [
    ["uebersicht", "Übersicht"], ["finanzen", "Umsatz & Gewinn"], ["bestellungen", "Bestellungen & Versand"],
    ["angebote", "Angebote & Lager"], ["nachrichten", "Nachrichten & Bewertungen"],
  ];
  const Z = {
    bereich: "uebersicht", zeitraum: 30,
    bFilter: "offen", bSuche: "",
    aFilter: "alle", aSuche: "", aSort: "verkauft30", aAb: true,
    nFilter: "offen",
  };
  try { const z = +localStorage.getItem("cockpit.zeitraum"); if ([7, 30, 90].includes(z)) Z.zeitraum = z; } catch (e) { /* ohne Speicher weiter */ }

  // ---------- Auswertungen ----------
  const imFenster = (b, von, bis) => { const t = tageSeit(b.datum); return t >= von && t < bis; };
  function summe(von, bis) {
    const s = { umsatz: 0, gewinn: 0, gebuehr: 0, werbung: 0, ware: 0, versand: 0, anzahl: 0 };
    for (const b of D.bestellungen) if (imFenster(b, von, bis)) {
      s.umsatz += b.umsatz; s.gewinn += b.gewinn; s.gebuehr += b.gebuehr; s.werbung += b.werbung;
      s.ware += b.ware; s.versand += b.versand; s.anzahl++;
    }
    return s;
  }
  function tagesreihe(tage) {
    const reihe = [];
    for (let t = tage - 1; t >= 0; t--) reihe.push({ d: new Date(heute.getTime() - t * TAG), umsatz: 0, gewinn: 0 });
    for (const b of D.bestellungen) {
      const t = tageSeit(b.datum);
      if (t < tage) { const z = reihe[tage - 1 - t]; z.umsatz += b.umsatz; z.gewinn += b.gewinn; }
    }
    return reihe;
  }
  function jeAngebot(tage) {
    const m = new Map();
    for (const b of D.bestellungen) if (tageSeit(b.datum) < tage) {
      const e = m.get(b.angebotId) || { stueck: 0, umsatz: 0, gewinn: 0 };
      e.stueck += b.menge; e.umsatz += b.umsatz; e.gewinn += b.gewinn; m.set(b.angebotId, e);
    }
    return m;
  }
  const verk30 = jeAngebot(30), verk90 = jeAngebot(90);
  D.angebote.forEach((a) => {
    a.verkauft30 = (verk30.get(a.id) || {}).stueck || 0;
    a.verkauft90 = (verk90.get(a.id) || {}).stueck || 0;
    const kosten = a.preis * D.annahmen.gebuehrProzent + D.annahmen.gebuehrFix + a.preis * a.anzeigenrate + a.einkauf + a.versandkosten;
    a.marge = (a.preis - kosten) / a.preis;
    a.reichweite = a.verkauft30 > 0 ? Math.floor(a.bestand / (a.verkauft30 / 30)) : null; // Tage bis leer
  });

  const fristStand = (b) => Math.round((new Date(b.frist).setHours(0, 0, 0, 0) - heute) / TAG); // <0 überfällig
  const bGruppen = {
    offen: (b) => b.status === "bezahlt",
    ueberfaellig: (b) => b.status === "bezahlt" && fristStand(b) < 0,
    heute: (b) => b.status === "bezahlt" && fristStand(b) === 0,
    unterwegs: (b) => b.status === "versendet",
    rueckgabe: (b) => b.status === "rueckgabe",
    alle: (b) => tageSeit(b.datum) < 30,
  };
  const aGruppen = {
    alle: () => true,
    knapp: (a) => a.bestand > 0 && a.reichweite !== null && a.reichweite <= 14,
    leer: (a) => a.bestand === 0,
    laden: (a) => a.verkauft90 === 0 && a.tageOnline > 60,
    marge: (a) => a.marge < 0.1,
  };
  const zaehle = (liste, f) => liste.filter(f).length;
  const offeneNachrichten = () => zaehle(D.nachrichten, (n) => !n.beantwortet);
  const offeneVorschlaege = () => zaehle(D.preisvorschlaege, (p) => !p.entschieden);

  // ---------- Navigation ----------
  function zeichneNav() {
    const offen = zaehle(D.bestellungen, bGruppen.offen), ueber = zaehle(D.bestellungen, bGruppen.ueberfaellig);
    const marken = {
      bestellungen: offen ? `<span class="zaehler${ueber ? " dringend" : ""}">${offen}</span>` : "",
      angebote: (() => { const n = zaehle(D.angebote, aGruppen.knapp) + zaehle(D.angebote, aGruppen.leer); return n ? `<span class="zaehler">${n}</span>` : ""; })(),
      nachrichten: (() => { const n = offeneNachrichten() + offeneVorschlaege(); return n ? `<span class="zaehler">${n}</span>` : ""; })(),
    };
    document.getElementById("nav").innerHTML = BEREICHE.map(([id, name]) =>
      `<a href="#${id}"${Z.bereich === id ? ' aria-current="page"' : ""}><span>${name}</span>${marken[id] || ""}</a>`).join("");
    document.getElementById("seite-fuss").textContent = "Stand: " + new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(D.stand);
  }

  // ---------- Bausteine ----------
  function delta(jetzt, vorher, text) {
    if (!vorher) return "";
    const x = (jetzt - vorher) / Math.abs(vorher), auf = x >= 0;
    return `<span class="delta ${auf ? "auf" : "ab"}">${auf ? "▲" : "▼"} ${pct(Math.abs(x))}</span> ${text}`;
  }
  const kz = (titel, wert, sub) => `<div class="kz"><div class="kz-titel">${titel}</div><div class="kz-wert">${wert}</div><div class="kz-sub">${sub || "&nbsp;"}</div></div>`;
  const chip = (gruppe, id, name, n, aktiv) =>
    `<button class="chip" data-chip="${gruppe}" data-wert="${id}" aria-pressed="${aktiv === id}">${name}${n === undefined ? "" : `<span class="n">${n}</span>`}</button>`;
  function artikelZelle(a) {
    return `<div class="art-titel">${esc(a.titel)}</div><div class="art-sub">${esc(a.fahrzeug)} · ${a.zustand}</div>`;
  }
  function margePille(m) {
    const k = m < 0.1 ? "krit" : m < 0.2 ? "warn" : "gut";
    return `<span class="pille ${k}">${pct(m)}</span>`;
  }

  // ---------- Liniendiagramm Umsatz/Gewinn ----------
  function schoeneSkala(max) {
    const roh = max / 4, pot = Math.pow(10, Math.floor(Math.log10(roh))), n = roh / pot;
    const schritt = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
    const ticks = []; for (let v = 0; v < max + schritt * 0.999; v += schritt) ticks.push(v);
    return ticks;
  }
  function linienDiagramm(host, reihe) {
    const B = Math.max(300, host.clientWidth), H = 250, r = { o: 12, r: 62, u: 26, l: 46 };
    const max = Math.max(...reihe.map((z) => z.umsatz), 1);
    const ticks = schoeneSkala(max), oben = ticks[ticks.length - 1];
    const x = (i) => r.l + (B - r.l - r.r) * (reihe.length === 1 ? 0.5 : i / (reihe.length - 1));
    const y = (v) => r.o + (H - r.o - r.u) * (1 - Math.max(0, v) / oben);
    const pfad = (k) => reihe.map((z, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(z[k]).toFixed(1)).join("");
    const letzte = reihe[reihe.length - 1];
    let yU = y(letzte.umsatz), yG = y(letzte.gewinn);
    if (Math.abs(yU - yG) < 14) { const mitte = (yU + yG) / 2; yU = mitte - 7; yG = mitte + 7; }
    const jede = Math.ceil(reihe.length / Math.max(2, Math.floor((B - r.l - r.r) / 70)));
    let s = `<svg viewBox="0 0 ${B} ${H}" width="${B}" height="${H}" role="img" aria-label="Umsatz und Gewinn je Tag">`;
    for (const t of ticks) s += `<line x1="${r.l}" x2="${B - r.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"${t ? ' stroke-dasharray="2 4"' : ""}/><text x="${r.l - 8}" y="${y(t) + 4}" text-anchor="end">${zahl.format(t)} €</text>`;
    reihe.forEach((z, i) => { if ((reihe.length - 1 - i) % jede === 0) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${datKurz.format(z.d)}</text>`; });
    s += `<path d="${pfad("umsatz")}L${x(reihe.length - 1)} ${y(0)}L${x(0)} ${y(0)}Z" fill="var(--s1)" opacity=".1"/>`;
    s += `<path d="${pfad("umsatz")}" fill="none" stroke="var(--s1)" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<path d="${pfad("gewinn")}" fill="none" stroke="var(--s2)" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<circle cx="${x(reihe.length - 1)}" cy="${y(letzte.umsatz)}" r="4" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"/><circle cx="${x(reihe.length - 1)}" cy="${y(letzte.gewinn)}" r="4" fill="var(--s2)" stroke="var(--surface)" stroke-width="2"/>`;
    s += `<text class="reihe" x="${B - r.r + 10}" y="${yU + 4}">Umsatz</text><text class="reihe" x="${B - r.r + 10}" y="${yG + 4}">Gewinn</text>`;
    s += `<g class="zeiger" visibility="hidden"><line y1="${r.o}" y2="${H - r.u}" stroke="var(--text-3)" stroke-width="1"/><circle r="4.5" fill="var(--s1)" stroke="var(--surface)" stroke-width="2"/><circle r="4.5" fill="var(--s2)" stroke="var(--surface)" stroke-width="2"/></g>`;
    s += `<rect x="${r.l}" y="${r.o}" width="${B - r.l - r.r}" height="${H - r.o - r.u}" fill="transparent"/></svg><div class="tipp" hidden></div>`;
    host.innerHTML = s;
    const svg = host.querySelector("svg"), zeiger = svg.querySelector(".zeiger"), tipp = host.querySelector(".tipp");
    const [linie, pU, pG] = zeiger.children;
    function zeige(ev) {
      const box = svg.getBoundingClientRect(), px = (ev.clientX - box.left) * (B / box.width);
      const i = Math.max(0, Math.min(reihe.length - 1, Math.round((px - r.l) / (B - r.l - r.r) * (reihe.length - 1))));
      const z = reihe[i], cx = x(i);
      linie.setAttribute("x1", cx); linie.setAttribute("x2", cx);
      pU.setAttribute("cx", cx); pU.setAttribute("cy", y(z.umsatz)); pG.setAttribute("cx", cx); pG.setAttribute("cy", y(z.gewinn));
      zeiger.setAttribute("visibility", "visible");
      tipp.innerHTML = `<b>${datTag.format(z.d)}</b><div><span><i class="punkt" style="background:var(--s1)"></i>Umsatz</span><span>${eur.format(z.umsatz)}</span></div><div><span><i class="punkt" style="background:var(--s2)"></i>Gewinn</span><span>${eur.format(z.gewinn)}</span></div>`;
      tipp.hidden = false;
      const links = cx * (box.width / B);
      tipp.style.top = "8px";
      tipp.style.left = (links > box.width / 2 ? links - tipp.offsetWidth - 12 : links + 12) + "px";
    }
    svg.addEventListener("pointermove", zeige); svg.addEventListener("pointerdown", zeige);
    svg.addEventListener("pointerleave", () => { zeiger.setAttribute("visibility", "hidden"); tipp.hidden = true; });
  }
  let beobachter = null;
  function haengeDiagramm(tage) {
    const host = document.getElementById("verlauf"); if (!host) return;
    const reihe = tagesreihe(tage);
    let breite = 0;
    const neu = () => { if (host.clientWidth !== breite) { breite = host.clientWidth; linienDiagramm(host, reihe); } };
    neu();
    if (beobachter) beobachter.disconnect();
    if (window.ResizeObserver) { beobachter = new ResizeObserver(neu); beobachter.observe(host); }
  }
  const legende = `<div class="legende"><span><i style="background:var(--s1)"></i>Umsatz</span><span><i style="background:var(--s2)"></i>Gewinn</span></div>`;

  // ---------- Übersicht ----------
  function ansichtUebersicht() {
    const j = summe(0, 30), v = summe(30, 60), st = D.verkaeuferstatus;
    const offen = zaehle(D.bestellungen, bGruppen.offen), ueber = zaehle(D.bestellungen, bGruppen.ueberfaellig), heuteF = zaehle(D.bestellungen, bGruppen.heute);
    const rueck = zaehle(D.bestellungen, bGruppen.rueckgabe), knapp = zaehle(D.angebote, aGruppen.knapp), leer = zaehle(D.angebote, aGruppen.leer);
    const nOffen = offeneNachrichten(), pOffen = offeneVorschlaege();
    const aufg = [
      [ueber, "krit", "Versand überfällig", "Versandfrist abgelaufen – sofort verschicken", "bestellungen", "bFilter", "ueberfaellig"],
      [heuteF, "warn", "Heute versenden", "Versandfrist endet heute", "bestellungen", "bFilter", "heute"],
      [nOffen, "warn", "Unbeantwortete Käuferfragen", "Meist Fragen zur Passgenauigkeit", "nachrichten", "nFilter", "offen"],
      [pOffen, "warn", "Offene Preisvorschläge", "Laufen nach 48 Stunden ab", "nachrichten", "nFilter", "offen"],
      [rueck, "warn", "Offene Rückgaben", "Rücksendung prüfen und erstatten", "bestellungen", "bFilter", "rueckgabe"],
      [knapp + leer, "warn", "Bestand knapp oder leer", `${leer} ausverkauft, ${knapp} reichen keine 14 Tage`, "angebote", "aFilter", leer && !knapp ? "leer" : "knapp"],
    ];
    const g = st.bewertungen12M, anteilPos = g.positiv / (g.positiv + g.negativ);
    return `
      <div class="kopf"><div><h1>Übersicht</h1><p>${new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p></div></div>
      <div class="kennzahlen">
        ${kz("Umsatz 30 Tage", eur0.format(j.umsatz), delta(j.umsatz, v.umsatz, "zum Vorzeitraum"))}
        ${kz("Gewinn 30 Tage", eur0.format(j.gewinn), delta(j.gewinn, v.gewinn, "zum Vorzeitraum"))}
        ${kz("Marge", pct(j.gewinn / j.umsatz), "Vorzeitraum " + pct(v.gewinn / v.umsatz))}
        ${kz("Zu versenden", offen, ueber ? `<span class="delta ab">${ueber} überfällig</span>` : "alle in der Frist")}
      </div>
      <div class="raster">
        <section class="feld">
          <div class="feld-kopf"><h2>Heute zu erledigen</h2></div>
          <ul class="aufgaben" style="margin-top:8px">${aufg.map(([n, art, titel, sub, ziel, schl, wert]) =>
            `<li class="${n ? art : "null"}"><a href="#${ziel}" data-setze="${schl}" data-wert="${wert}"><span class="aufg-zahl">${n}</span><span class="aufg-text"><b>${titel}</b><span>${n ? sub : "Nichts offen"}</span></span><span class="aufg-pfeil" aria-hidden="true">→</span></a></li>`).join("")}
          </ul>
        </section>
        <section class="feld">
          <div class="feld-kopf"><h2>Verkäuferstatus</h2><span class="pille gut">${esc(st.stufe)}</span></div>
          <div class="feld-inhalt messwerte">
            ${mess("Positive Bewertungen (12 Monate)", pct(anteilPos), anteilPos, `${zahl.format(g.positiv)} positiv · ${g.neutral} neutral · ${g.negativ} negativ`)}
            ${mess("Verspäteter Versand", pct(st.verspaeteterVersand), st.verspaeteterVersand / st.grenzeVerspaetet, "Grenze " + pct(st.grenzeVerspaetet, 0))}
            ${mess("Mängelquote", pct(st.maengelquote), st.maengelquote / st.grenzeMaengel, "Grenze " + pct(st.grenzeMaengel, 0))}
            <div class="mess-zeile"><span>Fälle ohne Lösung durch Verkäufer</span><span>${st.ungeloesteFaelle}</span></div>
          </div>
        </section>
      </div>
      <section class="feld">
        <div class="feld-kopf"><h2>Umsatz und Gewinn, letzte 30 Tage</h2>${legende}</div>
        <div class="feld-inhalt"><div class="diagramm" id="verlauf"></div></div>
      </section>`;
  }
  function mess(titel, wert, anteil, fuss) {
    return `<div><div class="mess-zeile"><span>${titel}</span><span>${wert}</span></div><div class="mess-spur"><i style="width:${Math.min(100, anteil * 100).toFixed(1)}%"></i></div><div class="mess-fuss">${fuss}</div></div>`;
  }

  // ---------- Umsatz & Gewinn ----------
  function ansichtFinanzen() {
    const T = Z.zeitraum, j = summe(0, T), v = summe(T, 2 * T);
    const posten = [["Wareneinsatz", j.ware], ["eBay-Gebühren", j.gebuehr], ["Versandkosten", j.versand], ["Anzeigen", j.werbung], ["Gewinn", j.gewinn]];
    const kat = new Map();
    for (const b of D.bestellungen) if (tageSeit(b.datum) < T) { const k = angebotNach.get(b.angebotId).kategorie; kat.set(k, (kat.get(k) || 0) + b.umsatz); }
    const kats = [...kat].sort((a, b) => b[1] - a[1]), katMax = kats.length ? kats[0][1] : 1;
    const art = [...jeAngebot(T)].map(([id, e]) => ({ a: angebotNach.get(id), ...e })).sort((a, b) => b.gewinn - a.gewinn);
    const reihe = tagesreihe(T);
    return `
      <div class="kopf"><div><h1>Umsatz &amp; Gewinn</h1><p>Was nach Wareneinsatz, Gebühren, Versand und Anzeigen übrig bleibt.</p></div>
        <div class="chips" role="group" aria-label="Zeitraum">${[7, 30, 90].map((t) => `<button class="chip" data-chip="zeitraum" data-wert="${t}" aria-pressed="${T === t}">${t} Tage</button>`).join("")}</div></div>
      <div class="kennzahlen">
        ${kz("Umsatz", eur0.format(j.umsatz), delta(j.umsatz, v.umsatz, "zum Vorzeitraum"))}
        ${kz("Gewinn", eur0.format(j.gewinn), delta(j.gewinn, v.gewinn, "zum Vorzeitraum"))}
        ${kz("Marge", pct(j.gewinn / j.umsatz), "Vorzeitraum " + pct(v.gewinn / v.umsatz))}
        ${kz("Bestellungen", zahl.format(j.anzahl), "Ø " + eur.format(j.umsatz / Math.max(1, j.anzahl)) + " je Bestellung")}
      </div>
      <section class="feld">
        <div class="feld-kopf"><h2>Verlauf je Tag</h2>${legende}</div>
        <div class="feld-inhalt"><div class="diagramm" id="verlauf"></div>
          <details class="tabelle"><summary>Als Tabelle anzeigen</summary><div class="tab-rahmen"><table><thead><tr><th>Tag</th><th class="z">Umsatz</th><th class="z">Gewinn</th></tr></thead><tbody>
          ${reihe.slice().reverse().map((z) => `<tr><td>${datTag.format(z.d)}</td><td class="z">${eur.format(z.umsatz)}</td><td class="z">${eur.format(z.gewinn)}</td></tr>`).join("")}</tbody></table></div></details>
        </div>
      </section>
      <div class="raster gleich">
        <section class="feld">
          <div class="feld-kopf"><h2>Wohin der Umsatz geht</h2></div>
          <div class="feld-inhalt"><div class="balken">${posten.map(([name, w]) =>
            `<span>${name}</span><span class="spur" title="${name}: ${eur.format(w)}"><span class="fuell${name === "Gewinn" ? " gewinn" : ""}" style="display:block;width:${(Math.max(0, w) / j.umsatz * 100 / Math.max(...posten.map((p) => p[1] / j.umsatz))).toFixed(1)}%"></span></span><span class="wert">${eur0.format(w)}<small>${pct(w / j.umsatz)}</small></span>`).join("")}</div>
          <p class="hinweis" style="margin:12px 0 0">Gebühren gerechnet mit ${pct(D.annahmen.gebuehrProzent, 0)} Provision plus ${eur.format(D.annahmen.gebuehrFix)} je Bestellung. Umsatzsteuer ist nicht berücksichtigt.</p></div>
        </section>
        <section class="feld">
          <div class="feld-kopf"><h2>Umsatz nach Teilegruppe</h2></div>
          <div class="feld-inhalt"><div class="balken">${kats.map(([name, w]) =>
            `<span>${esc(name)}</span><span class="spur" title="${esc(name)}: ${eur.format(w)}"><span class="fuell" style="display:block;width:${(w / katMax * 100).toFixed(1)}%"></span></span><span class="wert">${eur0.format(w)}<small>${pct(w / j.umsatz, 0)}</small></span>`).join("")}</div></div>
        </section>
      </div>
      <section class="feld">
        <div class="feld-kopf"><h2>Artikel nach Gewinn</h2><span class="hinweis">${art.length} verkaufte Artikel in ${T} Tagen</span></div>
        <div class="tab-rahmen" style="margin-top:6px"><table><thead><tr><th>Artikel</th><th>OE-Nummer</th><th class="z">Stück</th><th class="z">Umsatz</th><th class="z">Gewinn</th><th class="z">Marge</th></tr></thead><tbody>
        ${art.map((e) => `<tr><td>${artikelZelle(e.a)}</td><td><span class="oe">${esc(e.a.oe)}</span></td><td class="z">${e.stueck}</td><td class="z">${eur.format(e.umsatz)}</td><td class="z">${eur.format(e.gewinn)}</td><td class="z">${margePille(e.gewinn / e.umsatz)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>`;
  }

  // ---------- Bestellungen & Versand ----------
  function bStatus(b) {
    if (b.status === "bezahlt") {
      const f = fristStand(b);
      if (f < 0) return `<span class="pille krit">Überfällig seit ${-f} ${f === -1 ? "Tag" : "Tagen"}</span>`;
      if (f === 0) return `<span class="pille warn">Heute versenden</span>`;
      return `<span class="pille">Versand bis ${datTag.format(b.frist)}</span>`;
    }
    if (b.status === "versendet") return `<span class="pille">Unterwegs</span>`;
    if (b.status === "rueckgabe") return `<span class="pille warn">Rückgabe offen</span>`;
    return `<span class="pille gut">Zugestellt</span>`;
  }
  function ansichtBestellungen() {
    const q = Z.bSuche.trim().toLowerCase();
    const liste = D.bestellungen.filter(bGruppen[Z.bFilter]).filter((b) => {
      if (!q) return true;
      const a = angebotNach.get(b.angebotId);
      return (b.nr + " " + b.kaeufer + " " + a.titel + " " + a.oe + " " + a.oe.replace(/\s/g, "")).toLowerCase().includes(q);
    }).sort((x, y) => (x.status === "bezahlt" && y.status === "bezahlt" ? x.frist - y.frist : y.datum - x.datum)).slice(0, 80);
    const c = (id, name) => chip("bFilter", id, name, zaehle(D.bestellungen, bGruppen[id]), Z.bFilter);
    return `
      <div class="kopf"><div><h1>Bestellungen &amp; Versand</h1><p>Offene Sendungen nach Versandfrist, dringendste zuerst.</p></div></div>
      <div class="leiste">
        <div class="chips" role="group" aria-label="Filter">${c("offen", "Zu versenden")}${c("ueberfaellig", "Überfällig")}${c("heute", "Heute fällig")}${c("unterwegs", "Unterwegs")}${c("rueckgabe", "Rückgaben")}${c("alle", "Alle (30 Tage)")}</div>
        <input class="suche" id="b-suche" type="search" placeholder="Bestellnr., Käufer, OE-Nummer" value="${esc(Z.bSuche)}" aria-label="Bestellungen durchsuchen">
      </div>
      <section class="feld"><div class="tab-rahmen"><table><thead><tr><th>Bestellung</th><th>Artikel</th><th>Lagerplatz</th><th>Käufer</th><th class="z">Betrag</th><th>Status</th><th></th></tr></thead><tbody>
      ${liste.map((b) => { const a = angebotNach.get(b.angebotId); return `<tr>
        <td><span class="mono">${b.nr}</span><div class="art-sub">${datTag.format(b.datum)}</div></td>
        <td>${b.menge > 1 ? b.menge + " × " : ""}<span style="font-weight:500">${esc(a.titel)}</span><div class="art-sub"><span class="oe">${esc(a.oe)}</span></div></td>
        <td><span class="platz">${a.lagerplatz}</span></td>
        <td>${esc(b.kaeufer)}<div class="art-sub">${esc(b.ort)} · ${b.versanddienst}</div></td>
        <td class="z">${eur.format(b.umsatz)}</td>
        <td>${bStatus(b)}${b.rueckgabegrund ? `<div class="art-sub">${esc(b.rueckgabegrund)}</div>` : ""}</td>
        <td>${b.status === "bezahlt" ? `<button class="knopf" data-aktion="versendet" data-nr="${b.nr}">Als versendet markieren</button>` : b.status === "rueckgabe" ? `<button class="knopf leise" data-aktion="erstattet" data-nr="${b.nr}">Erstattet</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>${liste.length ? "" : `<div class="leer">Keine Bestellungen in dieser Auswahl.</div>`}</section>`;
  }

  // ---------- Angebote & Lager ----------
  function bestandZelle(a) {
    if (a.bestand === 0) return `<span class="pille krit">Ausverkauft</span>`;
    if (aGruppen.knapp(a)) return `${a.bestand} <span class="pille warn">reicht ${a.reichweite} Tage</span>`;
    return String(a.bestand);
  }
  function ansichtAngebote() {
    const q = Z.aSuche.trim().toLowerCase(), k = Z.aSort, richt = Z.aAb ? -1 : 1;
    const liste = D.angebote.filter(aGruppen[Z.aFilter]).filter((a) => !q || (a.titel + " " + a.oe + " " + a.oe.replace(/\s/g, "") + " " + a.fahrzeug + " " + a.lagerplatz).toLowerCase().includes(q))
      .sort((x, y) => (typeof x[k] === "string" ? x[k].localeCompare(y[k], "de") : x[k] - y[k]) * richt);
    const c = (id, name) => chip("aFilter", id, name, zaehle(D.angebote, aGruppen[id]), Z.aFilter);
    const th = (id, name, z) => `<th${z ? ' class="z"' : ""} aria-sort="${k === id ? (Z.aAb ? "descending" : "ascending") : "none"}"><button data-sort="${id}">${name}${k === id ? (Z.aAb ? " ↓" : " ↑") : ""}</button></th>`;
    const lagerwert = D.angebote.reduce((s, a) => s + a.einkauf * a.bestand, 0);
    const gebunden = D.angebote.filter(aGruppen.laden).reduce((s, a) => s + a.einkauf * a.bestand, 0);
    return `
      <div class="kopf"><div><h1>Angebote &amp; Lager</h1><p>${D.angebote.length} aktive Angebote · Lagerwert ${eur0.format(lagerwert)} zum Einkaufspreis, davon ${eur0.format(gebunden)} in Ladenhütern.</p></div></div>
      <div class="leiste">
        <div class="chips" role="group" aria-label="Filter">${c("alle", "Alle")}${c("knapp", "Bestand knapp")}${c("leer", "Ausverkauft")}${c("laden", "Ladenhüter")}${c("marge", "Marge unter 10 %")}</div>
        <input class="suche" id="a-suche" type="search" placeholder="Titel, OE-Nummer, Fahrzeug, Lagerplatz" value="${esc(Z.aSuche)}" aria-label="Angebote durchsuchen">
      </div>
      <section class="feld"><div class="tab-rahmen"><table><thead><tr>${th("titel", "Artikel")}${th("oe", "OE-Nummer")}${th("lagerplatz", "Lagerplatz")}${th("preis", "Preis", 1)}${th("marge", "Marge", 1)}${th("bestand", "Bestand", 1)}${th("verkauft30", "Verkauft 30 T", 1)}${th("aufrufe30", "Aufrufe 30 T", 1)}${th("beobachter", "Beobachter", 1)}${th("tageOnline", "Tage online", 1)}</tr></thead><tbody>
      ${liste.map((a) => `<tr><td>${artikelZelle(a)}</td><td><span class="oe">${esc(a.oe)}</span></td><td><span class="platz">${a.lagerplatz}</span></td>
        <td class="z">${eur.format(a.preis)}</td><td class="z">${margePille(a.marge)}</td><td class="z">${bestandZelle(a)}</td>
        <td class="z">${a.verkauft30}${aGruppen.laden(a) ? `<div class="art-sub">90 Tage ohne Verkauf</div>` : ""}</td><td class="z">${zahl.format(a.aufrufe30)}</td><td class="z">${a.beobachter}</td><td class="z">${a.tageOnline}</td></tr>`).join("")}
      </tbody></table></div>${liste.length ? "" : `<div class="leer">Keine Angebote in dieser Auswahl.</div>`}</section>`;
  }

  // ---------- Nachrichten & Bewertungen ----------
  function ansichtNachrichten() {
    const nur = Z.nFilter === "offen";
    const nachr = D.nachrichten.filter((n) => !nur || !n.beantwortet);
    const vors = D.preisvorschlaege.filter((p) => !nur || !p.entschieden);
    const g = D.verkaeuferstatus.bewertungen12M;
    const artPille = { positiv: `<span class="pille gut">Positiv</span>`, neutral: `<span class="pille">Neutral</span>`, negativ: `<span class="pille krit">Negativ</span>` };
    return `
      <div class="kopf"><div><h1>Nachrichten &amp; Bewertungen</h1><p>Käuferfragen, Preisvorschläge und das letzte Feedback.</p></div>
        <div class="chips" role="group" aria-label="Filter">${chip("nFilter", "offen", "Nur offene", undefined, Z.nFilter)}${chip("nFilter", "alle", "Alle", undefined, Z.nFilter)}</div></div>
      <div class="raster">
        <section class="feld">
          <div class="feld-kopf"><h2>Käuferfragen</h2><span class="hinweis">${offeneNachrichten()} unbeantwortet</span></div>
          ${nachr.length ? `<ul class="liste" style="margin-top:6px">${nachr.map((n) => { const a = angebotNach.get(n.angebotId); const alt = !n.beantwortet && Date.now() - n.zeit > 24 * 3600000; return `<li>
            <div class="oben"><span class="betreff">${esc(n.betreff)}</span><span class="meta">${esc(n.von)} · ${vorZeit(n.zeit)}</span></div>
            <p>${esc(n.text)}</p>
            <div class="meta">${esc(a.titel)} · <span class="oe">${esc(a.oe)}</span></div>
            <div class="aktionen">${n.beantwortet ? `<span class="pille gut">Beantwortet</span>` : `${alt ? `<span class="pille krit">Wartet über 24 Std.</span>` : `<span class="pille warn">Offen</span>`}<button class="knopf leise" data-aktion="beantwortet" data-id="${n.id}">Als beantwortet markieren</button>`}</div></li>`; }).join("")}</ul>` : `<div class="leer">Alle Fragen sind beantwortet.</div>`}
        </section>
        <div style="display:grid;gap:16px;min-width:0">
          <section class="feld">
            <div class="feld-kopf"><h2>Preisvorschläge</h2><span class="hinweis">${offeneVorschlaege()} offen</span></div>
            ${vors.length ? `<ul class="liste" style="margin-top:6px">${vors.map((p) => { const a = angebotNach.get(p.angebotId);
              const kosten = p.gebot * D.annahmen.gebuehrProzent + D.annahmen.gebuehrFix + p.gebot * a.anzeigenrate + a.einkauf + a.versandkosten, m = (p.gebot - kosten) / p.gebot;
              return `<li><div class="oben"><span class="betreff">${esc(a.titel)}</span><span class="meta">${esc(p.von)} · ${vorZeit(p.zeit)}</span></div>
              <div class="gebot"><span>Gebot <b>${eur.format(p.gebot)}</b></span><span>Ihr Preis ${eur.format(a.preis)}</span><span>Nachlass ${pct(1 - p.gebot / a.preis, 0)}</span></div>
              <div class="aktionen"><span class="meta">Marge beim Gebot</span>${margePille(m)}<span class="meta">Gewinn ${eur.format(p.gebot - kosten)}</span></div>
              <div class="aktionen">${p.entschieden ? `<span class="pille ${p.entschieden === "angenommen" ? "gut" : ""}">${p.entschieden === "angenommen" ? "Angenommen" : "Abgelehnt"}</span>` : `<button class="knopf" data-aktion="annehmen" data-id="${p.id}">Annehmen</button><button class="knopf leise" data-aktion="ablehnen" data-id="${p.id}">Ablehnen</button><span class="meta">läuft in ${p.laeuftAbStunden} Std. ab</span>`}</div></li>`; }).join("")}</ul>` : `<div class="leer">Keine offenen Preisvorschläge.</div>`}
          </section>
          <section class="feld">
            <div class="feld-kopf"><h2>Letzte Bewertungen</h2><span class="hinweis">12 Monate: ${zahl.format(g.positiv)} positiv · ${g.neutral} neutral · ${g.negativ} negativ</span></div>
            <ul class="liste" style="margin-top:6px">${D.bewertungen.map((b) => `<li><div class="oben"><span>${artPille[b.art]}</span><span class="meta">${esc(b.von)} · ${vorZeit(b.zeit)}</span></div><p>${esc(b.text)}</p><div class="meta">${esc(angebotNach.get(b.angebotId).titel)}</div></li>`).join("")}</ul>
          </section>
        </div>
      </div>`;
  }

  // ---------- Zeichnen & Ereignisse ----------
  const ANSICHTEN = { uebersicht: ansichtUebersicht, finanzen: ansichtFinanzen, bestellungen: ansichtBestellungen, angebote: ansichtAngebote, nachrichten: ansichtNachrichten };
  const ansicht = document.getElementById("ansicht");
  function zeichne(fokusId) {
    zeichneNav();
    ansicht.innerHTML = ANSICHTEN[Z.bereich]();
    if (Z.bereich === "uebersicht") haengeDiagramm(30);
    if (Z.bereich === "finanzen") haengeDiagramm(Z.zeitraum);
    if (fokusId) { const f = document.getElementById(fokusId); if (f) { f.focus(); const l = f.value.length; try { f.setSelectionRange(l, l); } catch (e) { /* egal */ } } }
  }
  function route() {
    const h = location.hash.slice(1);
    Z.bereich = ANSICHTEN[h] ? h : "uebersicht";
    zeichne(); window.scrollTo(0, 0);
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-chip],[data-sort],[data-aktion],[data-setze]");
    if (!el) return;
    if (el.dataset.setze) { Z[el.dataset.setze] = el.dataset.wert; return; } // Link wechselt danach den Bereich
    if (el.dataset.chip) {
      const w = el.dataset.wert;
      Z[el.dataset.chip] = el.dataset.chip === "zeitraum" ? +w : w;
      if (el.dataset.chip === "zeitraum") { try { localStorage.setItem("cockpit.zeitraum", w); } catch (e) { /* ohne Speicher weiter */ } }
      return zeichne();
    }
    if (el.dataset.sort) {
      if (Z.aSort === el.dataset.sort) Z.aAb = !Z.aAb; else { Z.aSort = el.dataset.sort; Z.aAb = typeof D.angebote[0][Z.aSort] !== "string"; }
      return zeichne();
    }
    const akt = el.dataset.aktion;
    if (akt === "versendet" || akt === "erstattet") {
      const b = D.bestellungen.find((x) => x.nr === el.dataset.nr);
      b.status = akt === "versendet" ? "versendet" : "zugestellt";
      toast(akt === "versendet" ? "Als versendet markiert" : "Rückgabe abgeschlossen");
    } else if (akt === "beantwortet") {
      D.nachrichten.find((n) => n.id === el.dataset.id).beantwortet = true; toast("Als beantwortet markiert");
    } else if (akt === "annehmen" || akt === "ablehnen") {
      D.preisvorschlaege.find((p) => p.id === el.dataset.id).entschieden = akt === "annehmen" ? "angenommen" : "abgelehnt";
      toast(akt === "annehmen" ? "Preisvorschlag angenommen" : "Preisvorschlag abgelehnt");
    }
    zeichne();
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "b-suche") { Z.bSuche = ev.target.value; zeichne("b-suche"); }
    if (ev.target.id === "a-suche") { Z.aSuche = ev.target.value; zeichne("a-suche"); }
  });
  window.addEventListener("hashchange", route);

  document.getElementById("demo-hinweis").hidden = !D.istDemo;
  route();
})();
