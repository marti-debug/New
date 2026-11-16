# Verkäufer-Cockpit für eBay (Kfz-Teile)

Ein Cockpit für den eBay-Verkauf von Kfz-Teilen. Läuft ohne Installation: `index.html` im Browser öffnen.

## Bereiche

- **Übersicht** – Kennzahlen, Aufgaben des Tages, Verkäuferstatus, Verlauf der letzten 30 Tage
- **Teile erfassen** – ausgebautes Teil aufnehmen, Preis aus dem Neupreis (PartsLink24) ableiten, Angebotstitel und Beschreibung kopieren
- **Umsatz & Gewinn** – Gewinn nach Wareneinsatz, Gebühren, Versand und Anzeigen; Auswertung je Artikel und Teilegruppe (7/30/90 Tage)
- **Bestellungen & Versand** – offene Sendungen nach Versandfrist, Rückgaben, Suche nach Bestellnummer, Käufer oder OE-Nummer
- **Angebote & Lager** – Bestand, Reichweite, Ladenhüter, Marge, Lagerplatz, Aufrufe und Beobachter
- **Nachrichten & Bewertungen** – Käuferfragen, Preisvorschläge mit Marge beim Gebot, letztes Feedback

## Stand

Das Cockpit zeigt **Beispieldaten** (`data.js`). Es ist noch nicht mit einem eBay-Konto verbunden;
Aktionen wie „Als versendet markieren“ wirken nur in der Ansicht und werden nicht an eBay übertragen.

Erfasste Teile sind echte Einträge: Als Artifact veröffentlicht liegen sie in dessen Datenbank (Sammlung `teile`),
beim lokalen Öffnen der Datei im Speicher des Browsers.

## Echte Daten anbinden

Die Oberfläche (`app.js`) liest nur `window.COCKPIT_DATA`. Für echte Daten muss eine Quelle dieselbe
Struktur liefern wie `data.js`: `angebote`, `bestellungen`, `nachrichten`, `preisvorschlaege`,
`bewertungen`, `verkaeuferstatus`. Möglich sind ein CSV-Import der Seller-Hub-Berichte oder die eBay-API.

Die Gebühren werden mit 11 % Provision plus 0,35 € je Bestellung angenommen (`annahmen` in `data.js`).
Umsatzsteuer ist nicht berücksichtigt.
