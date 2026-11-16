/*
 * Beispieldaten für das Verkäufer-Cockpit.
 *
 * Diese Datei ist die einzige Datenquelle der Oberfläche. Für echte Daten
 * (eBay-API oder CSV-Import aus dem Seller Hub) muss nur ein Objekt mit
 * derselben Struktur wie window.COCKPIT_DATA geliefert werden:
 *   angebote[], bestellungen[], nachrichten[], preisvorschlaege[],
 *   bewertungen[], verkaeuferstatus{}
 */
(function () {
  "use strict";

  // Fester Startwert: die Beispieldaten sehen bei jedem Laden gleich aus.
  function zufall(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const r = zufall(20261116);
  const heute = new Date(); heute.setHours(0, 0, 0, 0);
  const TAG = 86400000;
  const vorTagen = (n) => new Date(heute.getTime() - n * TAG);

  // Annahmen für die Gewinnrechnung (in den Einstellungen später anpassbar).
  const GEBUEHR_PROZENT = 0.11;   // Verkaufsprovision
  const GEBUEHR_FIX = 0.35;       // je Bestellung

  // titel, OE-Nummer, Fahrzeug, Kategorie, Zustand, Preis, Einkauf, Bestand,
  // Lagerplatz, Versandkosten, Nachfrage (0 = verkauft sich nicht), Tage online, Anzeigenrate
  const KATALOG = [
    ["Bremsscheiben Satz vorne 312 mm belüftet", "1K0 615 301 AA", "VW Golf V/VI, Audi A3 8P", "Bremsen", "Neu", 74.9, 41.2, 14, "R1-A3", 6.99, 9, 412, 0.03],
    ["Bremsbeläge Vorderachse mit Verschleißanzeige", "3C0 698 151 C", "VW Passat 3C, Tiguan 5N", "Bremsen", "Neu", 39.9, 19.8, 22, "R1-A4", 4.99, 10, 388, 0.03],
    ["Bremssattel hinten links mit Halter", "1K0 615 423 J", "VW Golf V/VI, Touran 1T", "Bremsen", "Gebraucht", 59.0, 18.0, 2, "R1-B1", 6.99, 5, 201, 0],
    ["ABS Hydraulikblock mit Steuergerät", "1K0 614 517 AE", "VW Golf V, Skoda Octavia 1Z", "Bremsen", "Gebraucht", 189.0, 70.0, 1, "R1-B4", 6.99, 3, 156, 0],
    ["Lichtmaschine 140 A Generator", "06F 903 023 F", "VW/Audi/Seat/Skoda 2.0 TDI", "Elektrik", "Gebraucht", 119.0, 45.0, 3, "R2-A1", 8.49, 6, 264, 0.02],
    ["Anlasser Starter 12 V 2,0 kW", "02Z 911 023 H", "VW Golf VI, Audi A3 8P 2.0 TDI", "Elektrik", "Gebraucht", 89.0, 30.0, 4, "R2-A2", 6.99, 5, 233, 0],
    ["Zündspule Stabzündspule", "06E 905 115 E", "Audi A4 B8, A5, A6 4F 3.2 FSI", "Elektrik", "Neu", 24.9, 9.4, 31, "R2-C2", 2.99, 8, 517, 0.04],
    ["Fensterheber Motor vorne rechts", "8K0 959 802 B", "Audi A4 B8, A5 8T, Q5 8R", "Elektrik", "Gebraucht", 49.0, 14.0, 2, "R2-B3", 4.99, 4, 178, 0],
    ["Steuergerät Komfortsystem BCM", "3C0 937 049 AJ", "VW Passat 3C, Passat CC", "Elektrik", "Gebraucht", 79.0, 25.0, 0, "R2-B5", 4.99, 3, 301, 0],
    ["Xenon Scheinwerfer links komplett", "8K0 941 029 AK", "Audi A4 B8 Limousine/Avant", "Beleuchtung", "Gebraucht", 329.0, 140.0, 1, "R3-A1", 12.9, 3, 142, 0.02],
    ["Rückleuchte rechts außen LED", "5K0 945 096 G", "VW Golf VI Limousine", "Beleuchtung", "Gebraucht", 64.9, 22.0, 3, "R3-A3", 5.99, 5, 255, 0],
    ["Nebelscheinwerfer links mit Abbiegelicht", "1T0 941 699 H", "VW Touran 1T, Caddy 2K", "Beleuchtung", "Neu", 34.9, 15.6, 9, "R3-B2", 4.99, 4, 190, 0],
    ["Blinker Außenspiegel links LED", "5K0 949 101", "VW Golf VI, Touran 1T3", "Beleuchtung", "Neu", 14.9, 4.8, 40, "R3-C1", 1.99, 7, 604, 0],
    ["Turbolader Abgasturbolader 2.0 TDI", "03L 253 016 T", "VW Golf VI, Audi A3, Seat Leon", "Motor & Antrieb", "Gebraucht", 449.0, 210.0, 2, "R4-A1", 12.9, 2, 131, 0.03],
    ["AGR Ventil mit Kühler", "03L 131 512 CF", "VW/Audi/Skoda 2.0 TDI CR", "Motor & Antrieb", "Gebraucht", 139.0, 48.0, 3, "R4-A2", 6.99, 5, 276, 0.02],
    ["Luftmassenmesser LMM", "03L 906 461 A", "VW/Audi/Seat/Skoda 1.6/2.0 TDI", "Motor & Antrieb", "Neu", 54.9, 26.3, 12, "R4-B1", 3.99, 7, 344, 0.03],
    ["Ölwanne Stahlblech mit Sensorbohrung", "038 103 603 AG", "VW/Audi 1.9/2.0 TDI", "Motor & Antrieb", "Neu", 46.5, 21.0, 7, "R4-B3", 6.99, 4, 229, 0],
    ["Zweimassenschwungrad ZMS", "03G 105 266 BL", "VW Golf V/VI, Passat 3C 2.0 TDI", "Motor & Antrieb", "Neu", 279.0, 232.0, 4, "R4-C1", 14.9, 3, 167, 0.05],
    ["Einspritzdüse Injektor Piezo", "03L 130 277 B", "VW/Audi/Seat/Skoda 2.0 TDI CR", "Motor & Antrieb", "Gebraucht", 129.0, 55.0, 6, "R4-C3", 4.99, 5, 298, 0.02],
    ["Querlenker vorne unten links", "1K0 407 151 AC", "VW Golf V/VI, Audi A3, Octavia", "Fahrwerk", "Neu", 42.9, 20.5, 16, "R5-A2", 6.99, 6, 371, 0.02],
    ["Stoßdämpfer Hinterachse Gasdruck", "1K0 513 029 HS", "VW Golf V/VI, Seat Leon 1P", "Fahrwerk", "Neu", 36.9, 27.9, 10, "R5-A4", 6.99, 5, 322, 0.05],
    ["Radlager Satz vorne mit Radnabe", "1T0 498 621", "VW Golf V/VI, Passat, Touran", "Fahrwerk", "Neu", 44.9, 19.9, 2, "R5-B1", 5.99, 8, 455, 0.02],
    ["Koppelstange Stabilisator vorne", "1K0 411 315 R", "VW Golf V/VI, Audi A3 8P", "Fahrwerk", "Neu", 12.9, 4.1, 48, "R5-C2", 2.99, 6, 580, 0],
    ["Außenspiegel rechts elektrisch anklappbar", "8K1 857 410 AB", "Audi A4 B8 Facelift", "Karosserie", "Gebraucht", 149.0, 60.0, 1, "R6-A1", 8.49, 3, 119, 0],
    ["Motorhaube Stahl, Farbe LY9B", "8K0 823 029 C", "Audi A4 B8", "Karosserie", "Gebraucht", 219.0, 80.0, 1, "H2-01", 69.0, 1, 203, 0],
    ["Kotflügel vorne links, grundiert", "5K0 821 105 B", "VW Golf VI", "Karosserie", "Neu", 69.9, 38.0, 5, "H2-04", 24.9, 2, 148, 0],
    ["Heckklappe mit Scheibe, Farbe LC9X", "1K6 827 025 Q", "VW Golf V Limousine", "Karosserie", "Gebraucht", 179.0, 60.0, 1, "H2-07", 69.0, 0, 287, 0],
    ["Tür hinten rechts, Farbe LB7Z", "3C9 833 056 N", "VW Passat 3C Variant", "Karosserie", "Gebraucht", 159.0, 55.0, 1, "H2-09", 69.0, 0, 334, 0],
    ["Kombiinstrument Tacho MFA+", "1K0 920 874 B", "VW Golf V, Jetta 1K 1.9 TDI", "Innenraum", "Gebraucht", 99.0, 30.0, 2, "R7-A2", 5.99, 3, 212, 0],
    ["Lenkrad Leder Multifunktion 3-Speichen", "5K0 419 091 H", "VW Golf VI, Scirocco 13", "Innenraum", "Gebraucht", 129.0, 50.0, 1, "R7-B1", 6.99, 2, 96, 0],
    ["Klimabedienteil Climatronic", "3C8 907 336 AJ", "VW Passat 3C, Golf VI, Tiguan", "Innenraum", "Gebraucht", 69.0, 20.0, 4, "R7-B4", 4.99, 4, 187, 0],
    ["Sitzheizungsmatte Fahrersitz Lehne", "8K0 963 557 C", "Audi A4 B8, A5 8T", "Innenraum", "Neu", 54.0, 31.0, 6, "R7-C3", 4.99, 0, 261, 0],
  ];

  const angebote = KATALOG.map((k, i) => ({
    id: "A" + (1001 + i),
    titel: k[0], oe: k[1], fahrzeug: k[2], kategorie: k[3], zustand: k[4],
    preis: k[5], einkauf: k[6], bestand: k[7], lagerplatz: k[8],
    versandkosten: k[9], nachfrage: k[10], tageOnline: k[11], anzeigenrate: k[12],
    aufrufe30: Math.round((k[10] + 1) * (38 + r() * 60)),
    beobachter: Math.round((k[10] + 0.6) * (1 + r() * 4)),
    versandart: k[9] > 30 ? "Spedition" : "Paket",
  }));
  // Zwei Ladenhüter, die viel beobachtet, aber nicht gekauft werden.
  angebote[26].beobachter = 17; angebote[26].aufrufe30 = 214;
  angebote[27].beobachter = 9; angebote[27].aufrufe30 = 131;

  const KAEUFER = ["golf_fan_82", "tdi-schrauber", "a4avant_marco", "werkstatt_huber", "kfz-teile-nord", "passat_peter", "schraubertom", "autohaus_lenz", "oldie_garage", "julia_b_1990", "meister_k", "tuning_ole", "b8_driver", "caddy_micha", "fuhrpark_weber", "karosserie_yilmaz", "the_real_stefan", "ersatzteil_ella", "diesel_dirk", "leon_cupra_ks"];
  const ORTE = ["Hamburg", "Dortmund", "Leipzig", "Nürnberg", "Bremen", "Kassel", "Rostock", "Augsburg", "Münster", "Erfurt", "Freiburg", "Kiel", "Chemnitz", "Koblenz", "Regensburg", "Wien", "Linz"];
  const DIENSTE = ["DHL", "Hermes", "GLS"];
  const waehle = (liste) => liste[Math.floor(r() * liste.length)];

  const gewichtSumme = angebote.reduce((s, a) => s + a.nachfrage, 0);
  function waehleAngebot() {
    let x = r() * gewichtSumme;
    for (const a of angebote) { x -= a.nachfrage; if (x <= 0) return a; }
    return angebote[0];
  }
  function versandfrist(bezahlt) {
    const f = new Date(bezahlt.getTime() + TAG);
    if (f.getDay() === 0) f.setTime(f.getTime() + TAG); // sonntags kein Versand
    return f;
  }

  const wochentag = [0.95, 1.25, 1.1, 1.0, 1.0, 0.9, 0.8]; // So … Sa
  const bestellungen = [];
  let lfd = 48210;
  for (let d = 179; d >= 0; d--) {
    const datum = vorTagen(d);
    const trend = 0.8 + 0.4 * (1 - d / 179);
    let anzahl = Math.round(5.2 * wochentag[datum.getDay()] * trend * (0.65 + r() * 0.7));
    if (d === 0) anzahl = Math.max(3, Math.round(anzahl * 0.6)); // der Tag läuft noch
    for (let n = 0; n < anzahl; n++) {
      const a = waehleAngebot();
      const menge = a.preis < 45 && r() < 0.18 ? 2 : 1;
      const umsatz = +(a.preis * menge).toFixed(2);
      const gebuehr = +(umsatz * GEBUEHR_PROZENT + GEBUEHR_FIX).toFixed(2);
      const werbung = +(umsatz * a.anzeigenrate).toFixed(2);
      const ware = +(a.einkauf * menge).toFixed(2);
      const versand = a.versandkosten;
      let status = "zugestellt";
      if (d === 0) status = "bezahlt";
      else if (d === 1) status = r() < 0.6 ? "bezahlt" : "versendet";
      else if (d === 2) status = n === 0 ? "bezahlt" : "versendet";
      else if (d === 3) status = n < 2 ? "bezahlt" : "versendet";
      else if (d <= 5) status = "versendet";
      else if (d <= 20 && r() < 0.035) status = "rueckgabe";
      lfd += 1 + Math.floor(r() * 9);
      bestellungen.push({
        nr: "17-" + String(lfd).padStart(5, "0") + "-" + String(10000 + Math.floor(r() * 89999)),
        datum, angebotId: a.id, menge, kaeufer: waehle(KAEUFER), ort: waehle(ORTE),
        umsatz, gebuehr, werbung, ware, versand,
        gewinn: +(umsatz - gebuehr - werbung - ware - versand).toFixed(2),
        status,
        frist: versandfrist(datum),
        versanddienst: a.versandart === "Spedition" ? "Spedition" : waehle(DIENSTE),
        rueckgabegrund: status === "rueckgabe" ? waehle(["Passt nicht zum Fahrzeug", "Falsch bestellt", "Artikel weicht von Beschreibung ab"]) : null,
      });
    }
  }

  const stunden = (h) => new Date(Date.now() - h * 3600000);
  const nachrichten = [
    { id: "N1", von: "tdi-schrauber", angebotId: "A1014", betreff: "Passt der Turbo beim Motorkennbuchstaben CBAB?", text: "Hallo, ich fahre einen Golf VI 2.0 TDI, Baujahr 2010, MKB CBAB. Passt der Turbolader ohne Umbau? Danke vorab.", zeit: stunden(3), beantwortet: false },
    { id: "N2", von: "werkstatt_huber", angebotId: "A1010", betreff: "Scheinwerfer mit Kurvenlicht?", text: "Guten Tag, ist der Xenon-Scheinwerfer mit oder ohne Kurvenlicht (AFS)? Bitte um Foto vom Typenschild.", zeit: stunden(7), beantwortet: false },
    { id: "N3", von: "julia_b_1990", angebotId: "A1022", betreff: "Wann wird versendet?", text: "Ich habe gestern bezahlt. Kommt das Radlager noch diese Woche an? Das Auto steht in der Werkstatt.", zeit: stunden(19), beantwortet: false },
    { id: "N4", von: "karosserie_yilmaz", angebotId: "A1025", betreff: "Abholung der Motorhaube möglich?", text: "Können wir die Haube am Samstag selbst abholen und uns die Spedition sparen?", zeit: stunden(26), beantwortet: false },
    { id: "N5", von: "fuhrpark_weber", angebotId: "A1002", betreff: "Rechnung mit ausgewiesener MwSt.", text: "Wir benötigen für 6 Sätze Bremsbeläge eine Rechnung auf die Firma. Ist das möglich?", zeit: stunden(31), beantwortet: false },
    { id: "N6", von: "passat_peter", angebotId: "A1009", betreff: "Wann wieder lieferbar?", text: "Das Komfortsteuergerät ist ausverkauft. Bekommen Sie noch eins rein?", zeit: stunden(52), beantwortet: true },
    { id: "N7", von: "b8_driver", angebotId: "A1008", betreff: "Fensterheber angekommen", text: "Teil ist da und funktioniert, vielen Dank für den schnellen Versand.", zeit: stunden(70), beantwortet: true },
    { id: "N8", von: "caddy_micha", angebotId: "A1012", betreff: "Leuchtmittel dabei?", text: "Ist beim Nebelscheinwerfer die Lampe schon eingesetzt?", zeit: stunden(96), beantwortet: true },
  ];

  const preisvorschlaege = [
    { id: "P1", von: "a4avant_marco", angebotId: "A1010", gebot: 280.0, zeit: stunden(5), laeuftAbStunden: 43 },
    { id: "P2", von: "oldie_garage", angebotId: "A1027", gebot: 120.0, zeit: stunden(11), laeuftAbStunden: 37 },
    { id: "P3", von: "tuning_ole", angebotId: "A1030", gebot: 85.0, zeit: stunden(22), laeuftAbStunden: 26 },
    { id: "P4", von: "diesel_dirk", angebotId: "A1018", gebot: 255.0, zeit: stunden(29), laeuftAbStunden: 19 },
  ];

  const bewertungen = [
    { von: "b8_driver", art: "positiv", text: "Top Teil, wie beschrieben. Passt am A4 B8 einwandfrei.", angebotId: "A1008", zeit: stunden(20) },
    { von: "golf_fan_82", art: "positiv", text: "Schneller Versand, sehr gut verpackt. Gerne wieder.", angebotId: "A1001", zeit: stunden(41) },
    { von: "meister_k", art: "positiv", text: "OE-Nummer stimmt, Einbau ohne Probleme.", angebotId: "A1016", zeit: stunden(66) },
    { von: "schraubertom", art: "neutral", text: "Teil in Ordnung, Lieferung hat 5 Tage gedauert.", angebotId: "A1020", zeit: stunden(90) },
    { von: "autohaus_lenz", art: "positiv", text: "Alles bestens, Rechnung lag bei.", angebotId: "A1005", zeit: stunden(118) },
    { von: "leon_cupra_ks", art: "negativ", text: "Stoßdämpfer kam mit beschädigtem Karton an, Kolbenstange verkratzt.", angebotId: "A1021", zeit: stunden(150) },
    { von: "ersatzteil_ella", art: "positiv", text: "Guter Kontakt, Frage zur Passgenauigkeit sofort beantwortet.", angebotId: "A1015", zeit: stunden(190) },
    { von: "the_real_stefan", art: "positiv", text: "Preis-Leistung super.", angebotId: "A1023", zeit: stunden(230) },
  ];

  window.COCKPIT_DATA = {
    istDemo: true,
    stand: new Date(),
    annahmen: { gebuehrProzent: GEBUEHR_PROZENT, gebuehrFix: GEBUEHR_FIX },
    angebote, bestellungen, nachrichten, preisvorschlaege, bewertungen,
    verkaeuferstatus: {
      stufe: "Überdurchschnittlich",
      bewertungen12M: { positiv: 1184, neutral: 9, negativ: 4 },
      verspaeteterVersand: 0.018, grenzeVerspaetet: 0.05,
      maengelquote: 0.004, grenzeMaengel: 0.02,
      ungeloesteFaelle: 0,
    },
  };
})();
