# Phasenklar

**[Web-App direkt öffnen](https://stream-schlaf-0x-cell.github.io/phasenklar/)**

Phasenklar ist eine kleine, projektionsfreundliche Web-App für klar angekündigte Arbeitsphasen im Unterricht. Sie zeigt fünf Erwartungen auf einen Blick:

1. Sozialform
2. Lautstärke
3. Zeit
4. Ergebnis
5. Danach

Die Anzeige lässt sich stufenweise aufbauen. Bei Gruppenarbeit kann eine Gruppengröße von 3 bis maximal 6 gewählt werden. Ein Timer, ein Vollbildmodus, eine anklickbare Lautstärkeübersicht und ein eindeutiges Stoppsignal sind integriert.

Die letzten fünf verwendeten Phasen und der aktuelle Timerstand werden ausschließlich lokal im Browser gespeichert. Nach einem versehentlichen Neuladen läuft ein gestarteter Timer korrekt weiter; das Stoppsignal pausiert ihn bewusst. Als installierbare Web-App funktioniert Phasenklar nach dem ersten vollständigen Aufruf auch ohne Internet. Die App benötigt kein Konto, verarbeitet keine Schülerdaten und verwendet kein Tracking.

## Bedienung

- **Bearbeiten:** Arbeitsphase einstellen und Einführungsstufe wählen
- **Lautstärkekarte:** Übersicht der Lautstärken 0 bis 3 öffnen
- **Leertaste:** Timer starten oder pausieren
- **S:** Stoppsignal ein- oder ausblenden; beim Öffnen pausiert der Timer
- **Vollbild:** Anzeige für den Beamer maximieren

## Lokale Entwicklung

```bash
npm install
npm run dev
```

## Prüfung

```bash
npm test
```
