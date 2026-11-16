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
    ["uebersicht", "Übersicht"], ["teile", "Teile erfassen"], ["finanzen", "Umsatz & Gewinn"], ["bestellungen", "Bestellungen & Versand"],
    ["angebote", "Angebote & Lager"], ["nachrichten", "Nachrichten & Bewertungen"],
  ];
  const Z = {
    bereich: "uebersicht", zeitraum: 30,
    bFilter: "offen", bSuche: "",
    aFilter: "alle", aSuche: "", aSort: "verkauft30", aAb: true,
    nFilter: "offen",
    teile: [], teileBereit: false, teileOrt: "", loeschId: null, bearbeiteId: null,
    neueFotos: [], fotoWeg: [], liest: false, leseHinweis: "", speichert: false,
    entwurf: { titel: "", oe: "", fahrzeug: "", km: "", gruppe: "Motor & Antrieb", stufe: "gut", maengel: "", geprueft: false, lagerplatz: "", neupreis: "", preis: "", versand: "6,99", kosten: "0", fotos: [] },
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
      teile: (() => { const n = zaehle(Z.teile, (t) => t.status !== "eingestellt"); return n ? `<span class="zaehler">${n}</span>` : ""; })(),
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

  // ---------- Teile erfassen ----------
  const STUFEN = { sehrgut: ["Sehr gut, kaum Gebrauchsspuren", 0.6], gut: ["Gut, leichte optische Mängel", 0.5], maengel: ["Deutliche optische Mängel", 0.35] };
  const GRUPPEN = ["Motor & Antrieb", "Elektrik", "Bremsen", "Beleuchtung", "Fahrwerk", "Karosserie", "Innenraum", "Sonstiges"];
  const dez = (s) => { const x = parseFloat(String(s).replace(/\./g, "").replace(",", ".")); return isFinite(x) ? x : 0; };
  function rechne(e) {
    const neupreis = dez(e.neupreis), vorschlag = neupreis ? Math.round(neupreis * STUFEN[e.stufe][1]) : 0;
    const preis = dez(e.preis) || vorschlag;
    const gebuehr = preis ? preis * D.annahmen.gebuehrProzent + D.annahmen.gebuehrFix : 0;
    const rest = preis - gebuehr - dez(e.versand) - dez(e.kosten);
    return { neupreis, vorschlag, preis, gebuehr, rest };
  }
  function angebotsTitel(e) {
    // eBay erlaubt 80 Zeichen: Bausteine nach Wichtigkeit aufnehmen, nie mitten im Wort kürzen.
    const teile = [e.titel.trim().slice(0, 80)];
    for (const x of [e.oe, "Original", e.fahrzeug, "gebraucht"]) { const t = x.trim(); if (t && (teile.join(" ") + " " + t).length <= 80) teile.push(t); }
    return teile.join(" ");
  }
  function angebotsText(e) {
    const z = [e.titel.trim() + (e.fahrzeug.trim() ? " für " + e.fahrzeug.trim() : ""), ""];
    if (e.oe.trim()) z.push("OE-Nummer: " + e.oe.trim());
    if (e.fahrzeug.trim()) z.push("Ausgebaut aus: " + e.fahrzeug.trim() + (e.km.trim() ? ", Laufleistung " + e.km.trim() + " km" : ""));
    z.push("Zustand: gebrauchtes Originalteil" + (e.geprueft ? ", Funktion in unserer Werkstatt geprüft" : "") + ".");
    z.push("Optische Mängel: " + (e.maengel.trim() || "keine besonderen, übliche Gebrauchsspuren") + " Siehe Fotos.");
    z.push("", "Bitte vergleichen Sie vor dem Kauf die OE-Nummer mit der Nummer auf Ihrem Altteil.");
    return z.join("\n");
  }
  function vorschauHtml(e) {
    const r = rechne(e), titel = angebotsTitel(e);
    return `
      <div class="rechnung">
        <div><span>Neupreis Original</span><span>${r.neupreis ? eur.format(r.neupreis) : "–"}</span></div>
        <div><span>Preisvorschlag (${pct(STUFEN[e.stufe][1], 0)} vom Neupreis)</span><span>${r.vorschlag ? eur.format(r.vorschlag) : "–"}</span></div>
        <div class="stark"><span>Ihr Verkaufspreis</span><span>${r.preis ? eur.format(r.preis) : "–"}</span></div>
        <div><span>eBay-Gebühr</span><span>${r.preis ? "− " + eur.format(r.gebuehr) : "–"}</span></div>
        <div><span>Versand</span><span>− ${eur.format(dez(e.versand))}</span></div>
        <div><span>Eigene Kosten</span><span>− ${eur.format(dez(e.kosten))}</span></div>
        <div class="stark"><span>Bleibt übrig</span><span>${r.preis ? eur.format(r.rest) + " " + margePille(r.rest / r.preis) : "–"}</span></div>
      </div>
      <p class="hinweis">Der Vorschlag ist eine Faustregel. Prüfen Sie bei eBay unter „Verkaufte Artikel“, was das Teil tatsächlich bringt.</p>
      <label class="feldname" for="aus-titel">Angebotstitel <span class="hinweis">${titel.length} von 80 Zeichen</span></label>
      <div class="kopier"><input id="aus-titel" readonly value="${esc(titel)}"><button type="button" class="knopf leise" data-kopiere="aus-titel">Kopieren</button></div>
      <label class="feldname" for="aus-text">Beschreibung</label>
      <div class="kopier"><textarea id="aus-text" readonly rows="8">${esc(angebotsText(e))}</textarea><button type="button" class="knopf leise" data-kopiere="aus-text">Kopieren</button></div>`;
  }
  function ansichtTeile() {
    const e = Z.entwurf;
    const ein = (id, name, attr = "") => `<div><label class="feldname" for="t-${id}">${name}</label><input id="t-${id}" data-feld="${id}" value="${esc(e[id])}" ${attr}></div>`;
    const offen = Z.teile.filter((t) => t.status !== "eingestellt"), fertig = Z.teile.filter((t) => t.status === "eingestellt");
    const zeile = (t) => { const r = rechne(t); return `<tr>
        <td><div class="mit-bild">${(t.fotos || []).length ? `<img class="mini" src="/_blob/${esc(t.fotos[0])}" alt="" loading="lazy">` : ""}<div><div class="art-titel">${esc(t.titel)}</div><div class="art-sub">${esc(t.fahrzeug)}${t.maengel ? " · " + esc(t.maengel) : ""}${(t.fotos || []).length ? " · " + t.fotos.length + (t.fotos.length === 1 ? " Foto" : " Fotos") : ""}</div></div></div></td>
        <td><span class="oe">${esc(t.oe)}</span></td><td>${t.lagerplatz ? `<span class="platz">${esc(t.lagerplatz)}</span>` : ""}</td>
        <td class="z">${r.neupreis ? eur.format(r.neupreis) : "–"}</td><td class="z">${r.preis ? eur.format(r.preis) : "–"}</td><td class="z">${r.preis ? eur.format(r.rest) : "–"}</td>
        <td>${t.status === "eingestellt" ? `<span class="pille gut">Eingestellt</span>` : `<span class="pille">Erfasst</span>`}</td>
        <td><div class="aktionen">${t.status === "eingestellt" ? "" : `<button class="knopf" data-aktion="t-eingestellt" data-id="${t.id}">Als eingestellt markieren</button>`}<button class="knopf leise" data-aktion="t-laden" data-id="${t.id}">Bearbeiten</button><button class="knopf leise" data-aktion="t-loeschen" data-id="${t.id}">${Z.loeschId === t.id ? "Wirklich löschen?" : "Löschen"}</button></div></td></tr>`; };
    return `
      <div class="kopf"><div><h1>Teile erfassen</h1><p>Ausgebautes Teil aufnehmen, Preis aus dem Neupreis ableiten, Angebotstext kopieren.</p></div></div>
      <div class="raster gleich">
        <form class="feld" id="teil-form" autocomplete="off">
          <div class="feld-kopf"><h2>${Z.bearbeiteId ? "Teil bearbeiten" : "Neues Teil"}</h2>${Z.bearbeiteId ? `<span class="pille warn">Sie ändern ein erfasstes Teil</span>` : ""}</div>
          <div class="feld-inhalt formular">
            <div class="breit">${ein("titel", "Bezeichnung", 'required placeholder="z. B. Lichtmaschine 140 A"')}</div>
            ${ein("oe", "OE-Nummer", 'required placeholder="z. B. 06F 903 023 F" class="mono-ein"')}
            ${ein("fahrzeug", "Ausgebaut aus", 'placeholder="z. B. VW Golf VI 2.0 TDI, Bj. 2010"')}
            ${ein("km", "Laufleistung (km)", 'inputmode="numeric" placeholder="z. B. 148.000"')}
            <div><label class="feldname" for="t-gruppe">Teilegruppe</label><select id="t-gruppe" data-feld="gruppe">${GRUPPEN.map((g) => `<option${g === e.gruppe ? " selected" : ""}>${g}</option>`).join("")}</select></div>
            <div class="breit"><label class="feldname" for="t-stufe">Zustand</label><select id="t-stufe" data-feld="stufe">${Object.entries(STUFEN).map(([k, v]) => `<option value="${k}"${k === e.stufe ? " selected" : ""}>${v[0]}</option>`).join("")}</select></div>
            <div class="breit"><label class="feldname" for="t-maengel">Optische Mängel</label><textarea id="t-maengel" data-feld="maengel" rows="2" placeholder="z. B. Kratzer am Gehäuse, Halter leicht korrodiert.">${esc(e.maengel)}</textarea></div>
            <label class="haken breit"><input type="checkbox" id="t-geprueft" data-feld="geprueft"${e.geprueft ? " checked" : ""}> Funktion in der Werkstatt geprüft</label>
            <div class="breit"><span class="feldname">Fotos</span><div id="fotos">${fotosHtml()}</div></div>
            ${ein("neupreis", "Neupreis Original laut PartsLink24 (€)", 'inputmode="decimal" placeholder="z. B. 389,00"')}
            ${ein("preis", "Eigener Verkaufspreis (€, optional)", 'inputmode="decimal" placeholder="leer = Vorschlag"')}
            ${ein("versand", "Versandkosten (€)", 'inputmode="decimal"')}
            ${ein("kosten", "Eigene Kosten (€)", 'inputmode="decimal"')}
            ${ein("lagerplatz", "Lagerplatz", 'placeholder="z. B. R2-A1" class="mono-ein"')}
            <div class="breit aktionen"><button class="knopf" type="submit"${Z.teileBereit && !Z.speichert ? "" : " disabled"}>${Z.bearbeiteId ? "Änderungen speichern" : "Teil speichern"}</button>${Z.bearbeiteId ? `<button class="knopf leise" type="button" data-aktion="t-abbrechen">Abbrechen</button>` : ""}<span class="hinweis">${esc(Z.teileOrt)}</span></div>
          </div>
        </form>
        <section class="feld">
          <div class="feld-kopf"><h2>Preis und Angebotstext</h2></div>
          <div class="feld-inhalt" id="vorschau">${vorschauHtml(e)}</div>
        </section>
      </div>
      <section class="feld">
        <div class="feld-kopf"><h2>Erfasste Teile</h2><span class="hinweis">${offen.length} noch nicht eingestellt · ${fertig.length} eingestellt</span></div>
        ${!Z.teileBereit ? `<div class="leer">Erfasste Teile werden geladen …</div>` : Z.teile.length ? `<div class="tab-rahmen" style="margin-top:6px"><table><thead><tr><th>Teil</th><th>OE-Nummer</th><th>Lagerplatz</th><th class="z">Neupreis</th><th class="z">Verkaufspreis</th><th class="z">Bleibt übrig</th><th>Status</th><th></th></tr></thead><tbody>${offen.concat(fertig).map(zeile).join("")}</tbody></table></div>` : `<div class="leer">Noch kein Teil erfasst. Füllen Sie oben Bezeichnung und OE-Nummer aus und speichern Sie – das Teil erscheint dann hier.</div>`}
      </section>`;
  }

  function leereEntwurf() {
    Z.neueFotos.forEach((f) => URL.revokeObjectURL(f.url)); Z.neueFotos = []; Z.fotoWeg = []; Z.leseHinweis = "";
    Object.assign(Z.entwurf, { fotos: [], titel: "", oe: "", fahrzeug: "", km: "", maengel: "", geprueft: false, lagerplatz: "", neupreis: "", preis: "" });
  }

  // ---------- Fotos ----------
  const kann = { assets: null, sample: null, bilder: null, downloads: null };
  const MAX_FOTOS = 8;
  const behalteneFotos = () => Z.entwurf.fotos.filter((id) => !Z.fotoWeg.includes(id));
  function fotosHtml() {
    const alt = behalteneFotos(), anzahl = alt.length + Z.neueFotos.length;
    const bild = (src, knoepfe) => `<figure><img src="${src}" alt="Foto des Teils"><figcaption>${knoepfe}</figcaption></figure>`;
    return `
      ${anzahl ? `<div class="fotos">${alt.map((id) => bild("/_blob/" + esc(id), `${kann.downloads ? `<button type="button" class="link" data-foto="laden" data-id="${esc(id)}">Herunterladen</button>` : ""}<button type="button" class="link" data-foto="weg" data-id="${esc(id)}">Entfernen</button>`)).join("")}${Z.neueFotos.map((f, i) => bild(f.url, `<button type="button" class="link" data-foto="neu-weg" data-id="${i}">Entfernen</button>`)).join("")}</div>` : ""}
      <div class="aktionen">
        <button type="button" class="knopf leise" data-foto="waehlen"${anzahl >= MAX_FOTOS ? " disabled" : ""}>Fotos hinzufügen</button>
        <input type="file" id="t-foto" accept="image/*" multiple class="unsichtbar" tabindex="-1" aria-hidden="true">
        ${kann.bilder && anzahl ? `<button type="button" class="knopf leise" data-foto="lesen"${Z.liest ? " disabled" : ""}>${Z.liest ? "Fotos werden gelesen …" : "Felder aus Fotos ausfüllen"}</button>` : ""}
        <span class="hinweis">${anzahl} von ${MAX_FOTOS}${Z.teileBereit && !kann.assets ? " · Fotos werden in dieser Ansicht nicht gespeichert." : ""}</span>
      </div>
      ${Z.leseHinweis ? `<p class="lese-hinweis">${esc(Z.leseHinweis)}</p>` : ""}`;
  }
  function zeichneFotos() { const el = document.getElementById("fotos"); if (el) el.innerHTML = fotosHtml(); }
  // Handyfotos sind mehrere MB groß: vor dem Speichern auf 1600 px Kantenlänge verkleinern.
  async function verkleinere(datei) {
    try {
      const bmp = await createImageBitmap(datei), f = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * f); c.height = Math.round(bmp.height * f);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
      return blob || datei;
    } catch (e) { return datei; }
  }
  async function fotosDazu(dateien) {
    const frei = MAX_FOTOS - behalteneFotos().length - Z.neueFotos.length;
    const bilder = [...dateien].filter((d) => d.type.startsWith("image/"));
    if (bilder.length > frei) toast("Höchstens " + MAX_FOTOS + " Fotos je Teil");
    for (const d of bilder.slice(0, Math.max(0, frei))) { const blob = await verkleinere(d); Z.neueFotos.push({ blob, url: URL.createObjectURL(blob) }); }
    zeichneFotos();
  }
  const holeFoto = (id) => fetch("/_blob/" + id).then((r) => { if (!r.ok) throw new Error("fehlt"); return r.blob(); });
  async function leseFotos() {
    if (!kann.sample || !kann.bilder || Z.liest) return;
    Z.liest = true; Z.leseHinweis = ""; zeichneFotos();
    try {
      const blobs = Z.neueFotos.map((f) => f.blob);
      for (const id of behalteneFotos()) { try { blobs.push(await holeFoto(id)); } catch (e) { /* Foto überspringen */ } }
      const r = await kann.sample.json(
        "Die Fotos zeigen ein gebrauchtes, ausgebautes Kfz-Teil aus einer Werkstatt. Lies ab, was auf Typenschild, Aufkleber oder Prägung steht, und beschreibe die sichtbaren optischen Mängel. " +
        "Rate nichts: Was nicht eindeutig lesbar ist, bleibt ein leerer Text. Die OE-Nummer ist die Teilenummer des Fahrzeugherstellers, nicht die eines Zulieferers. " +
        'Antworte nur mit einem JSON-Objekt in dieser Form: {"bezeichnung": "Lichtmaschine 140 A", "oe_nummer": "06F 903 023 F", "weitere_nummern": ["0 124 525 091"], "maengel": "Ein kurzer Satz zu Kratzern, Korrosion, Brüchen.", "unsicher": "Was schlecht lesbar war, sonst leer."}',
        { images: blobs.slice(0, kann.bilder.maxCount || 4) });
      const txt = (x) => (typeof x === "string" ? x.trim() : "");
      const e = Z.entwurf, gefuellt = [];
      if (txt(r && r.bezeichnung) && !e.titel.trim()) { e.titel = txt(r.bezeichnung); gefuellt.push("Bezeichnung"); }
      if (txt(r && r.oe_nummer) && !e.oe.trim()) { e.oe = txt(r.oe_nummer); gefuellt.push("OE-Nummer"); }
      if (txt(r && r.maengel) && !e.maengel.trim()) { e.maengel = txt(r.maengel); gefuellt.push("Mängel"); }
      const weitere = Array.isArray(r && r.weitere_nummern) ? r.weitere_nummern.map(txt).filter(Boolean).slice(0, 6) : [];
      Z.leseHinweis = (gefuellt.length ? "Aus den Fotos ausgefüllt: " + gefuellt.join(", ") + "." : "Nichts ausgefüllt – entweder war nichts eindeutig lesbar, oder die Felder waren schon belegt.") +
        (txt(r && r.oe_nummer) && !gefuellt.includes("OE-Nummer") ? " Gelesene OE-Nummer: " + txt(r.oe_nummer) + "." : "") +
        (weitere.length ? " Weitere Nummern auf dem Teil: " + weitere.join(", ") + "." : "") +
        (txt(r && r.unsicher) ? " Unsicher: " + txt(r.unsicher) : "") + " Bitte Nummern am Teil gegenprüfen.";
    } catch (err) {
      const code = err && err.code;
      if (code === "not_granted" || code === "images_unavailable") { kann.bilder = null; toast("Auslesen ist in dieser Ansicht nicht verfügbar"); }
      else if (code === "rate_limited") toast("Zu viele Anfragen. Bitte kurz warten.");
      else toast("Auslesen fehlgeschlagen. Bitte von Hand ausfüllen.");
    }
    Z.liest = false;
    if (Z.bereich === "teile") zeichne();
  }
  async function fotoLaden(id) {
    try {
      const nr = (Z.entwurf.oe.trim() || "teil").replace(/[^A-Za-z0-9]+/g, "-");
      await kann.downloads.save({ filename: nr + "-foto-" + (Z.entwurf.fotos.indexOf(id) + 1) + ".jpg", data: await holeFoto(id) });
    } catch (e) { if (!e || e.code !== "declined") toast("Foto konnte nicht gespeichert werden"); }
  }
  async function starteFotos() {
    const use = window.claude && window.claude.use ? (n) => window.claude.use(n).catch(() => null) : () => Promise.resolve(null);
    [kann.assets, kann.sample, kann.downloads] = await Promise.all([use("assets"), use("sample"), use("downloads")]);
    if (kann.sample) { const g = await kann.sample.limits().catch(() => null); kann.bilder = (g && g.images) || null; }
    zeichneFotos();
  }

  // Ablage der erfassten Teile: Artifact-Datenbank, sonst der Speicher dieses Browsers.
  const ablage = { db: null };
  const sortiere = () => Z.teile.sort((a, b) => (b.angelegt || 0) - (a.angelegt || 0));
  function lokalSichern() { try { localStorage.setItem("cockpit.teile", JSON.stringify(Z.teile)); } catch (e) { toast("Speichern im Browser nicht möglich"); } }
  function starteLokal() {
    try { Z.teile = JSON.parse(localStorage.getItem("cockpit.teile") || "[]"); } catch (e) { Z.teile = []; }
    sortiere(); Z.teileBereit = true; Z.teileOrt = "Wird nur in diesem Browser gespeichert."; if (Z.bereich === "teile") zeichne(); else zeichneNav();
  }
  async function starteAblage() {
    const db = window.claude && window.claude.use ? await window.claude.use("db").catch(() => null) : null;
    if (!db) return starteLokal();
    ablage.db = db;
    const notfall = setTimeout(() => { if (!Z.teileBereit) { ablage.db = null; starteLokal(); } }, 10000);
    db.collection("teile").onSnapshot((snap) => {
      clearTimeout(notfall);
      Z.teile = snap.docs.map((d) => ({ ...d.data(), id: d.id })); sortiere();
      Z.teileBereit = true; Z.teileOrt = "";
      if (Z.bereich === "teile") { const f = document.activeElement && document.activeElement.id; zeichne(f && f.startsWith("t-") ? f : null); } else zeichneNav();
    }, () => { clearTimeout(notfall); if (!Z.teileBereit) { ablage.db = null; starteLokal(); } });
  }
  function loescheFotos(ids) { if (kann.assets) ids.forEach((id) => kann.assets.delete(id).catch(() => {})); }
  async function teilSchreiben(id, daten, loeschen) {
    try {
      if (ablage.db) {
        const ref = ablage.db.collection("teile").doc(id);
        if (loeschen) await ref.delete(); else await ref.set(daten);
      } else {
        Z.teile = Z.teile.filter((t) => t.id !== id); if (!loeschen) Z.teile.push({ ...daten, id }); sortiere(); lokalSichern(); zeichne();
      }
      return true;
    } catch (e) { toast("Speichern fehlgeschlagen. Bitte erneut versuchen."); return false; }
  }

  // ---------- Zeichnen & Ereignisse ----------
  const ANSICHTEN = { uebersicht: ansichtUebersicht, teile: ansichtTeile, finanzen: ansichtFinanzen, bestellungen: ansichtBestellungen, angebote: ansichtAngebote, nachrichten: ansichtNachrichten };
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
    const el = ev.target.closest("[data-chip],[data-sort],[data-aktion],[data-setze],[data-kopiere],[data-foto]");
    if (!el) return;
    if (el.dataset.foto) {
      const f = el.dataset.foto, id = el.dataset.id;
      if (f === "waehlen") return document.getElementById("t-foto").click();
      if (f === "lesen") return void leseFotos();
      if (f === "laden") return void fotoLaden(id);
      if (f === "weg") Z.fotoWeg.push(id);
      if (f === "neu-weg") { const [raus] = Z.neueFotos.splice(+id, 1); if (raus) URL.revokeObjectURL(raus.url); }
      return zeichneFotos();
    }
    if (el.dataset.kopiere) {
      const feld = document.getElementById(el.dataset.kopiere);
      const markiere = () => { feld.focus(); feld.select(); toast("Text markiert – mit Strg+C kopieren"); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(feld.value).then(() => toast("Kopiert"), markiere); else markiere();
      return;
    }
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
    if (akt === "t-abbrechen") { Z.bearbeiteId = null; leereEntwurf(); return zeichne(); }
    if (akt.startsWith("t-")) {
      const t = Z.teile.find((x) => x.id === el.dataset.id); if (!t) return;
      const { id, ...daten } = t;
      if (akt === "t-laden") { leereEntwurf(); Object.keys(Z.entwurf).forEach((k) => { if (k in t) Z.entwurf[k] = Array.isArray(t[k]) ? t[k].slice() : t[k]; }); Z.bearbeiteId = id; zeichne(); window.scrollTo(0, 0); return; }
      if (akt === "t-eingestellt") return void teilSchreiben(id, { ...daten, status: "eingestellt" }).then((ok) => ok && toast("Als eingestellt markiert"));
      if (Z.loeschId !== id) { Z.loeschId = id; return zeichne(); }
      Z.loeschId = null; if (Z.bearbeiteId === id) { Z.bearbeiteId = null; leereEntwurf(); }
      return void teilSchreiben(id, null, true).then((ok) => { if (!ok) return; loescheFotos(t.fotos || []); toast("Teil gelöscht"); });
    }
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
    const feld = ev.target.dataset.feld;
    if (feld) {
      Z.entwurf[feld] = ev.target.type === "checkbox" ? ev.target.checked : ev.target.value;
      const v = document.getElementById("vorschau"); if (v) v.innerHTML = vorschauHtml(Z.entwurf);
    }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "t-foto") { const d = [...ev.target.files]; ev.target.value = ""; fotosDazu(d); }
  });
  document.addEventListener("submit", (ev) => {
    if (ev.target.id !== "teil-form") return;
    ev.preventDefault();
    const e = Z.entwurf;
    if (!e.titel.trim() || !e.oe.trim()) return toast("Bitte Bezeichnung und OE-Nummer ausfüllen");
    if (Z.speichert) return;
    const alt = Z.bearbeiteId && Z.teile.find((t) => t.id === Z.bearbeiteId);
    const id = alt ? alt.id : "t" + Date.now();
    Z.speichert = true; zeichne();
    (async () => {
      const fotos = behalteneFotos(), weg = Z.fotoWeg.slice();
      if (kann.assets) {
        try { for (const f of Z.neueFotos) fotos.push((await kann.assets.upload(f.blob, { type: "image/jpeg" })).id); }
        catch (err) { toast("Fotos konnten nicht gespeichert werden. Bitte erneut versuchen."); return false; }
      }
      const ok = await teilSchreiben(id, { ...e, fotos, status: alt ? alt.status : "erfasst", angelegt: alt ? alt.angelegt : Date.now() });
      if (!ok) return false;
      const ohneFotos = Z.neueFotos.length && !kann.assets;
      loescheFotos(weg); Z.bearbeiteId = null; leereEntwurf();
      toast(ohneFotos ? "Teil gespeichert, Fotos nicht" : alt ? "Änderungen gespeichert" : "Teil gespeichert");
      return true;
    })().then(() => { Z.speichert = false; zeichne(); });
  });
  window.addEventListener("hashchange", route);

  document.getElementById("demo-hinweis").hidden = !D.istDemo;
  route();
  starteAblage();
  starteFotos();
})();
