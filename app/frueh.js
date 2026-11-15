/* Mirella – läuft als Erstes, noch vor dem Zeichnen: Am Computer gleich die Programm-Ansicht vorbereiten,
   damit beim Start nicht kurz die iPhone-Ansicht erscheint. desktop.js setzt „dtready“, sobald das Programm steht. */
(function () {
  try {
    const nat = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    if (nat || !window.matchMedia || !window.matchMedia("(min-width: 1100px) and (pointer: fine)").matches) return;
    const r = document.documentElement; r.classList.add("dt", "dtboot");
    // Sicherheitsnetz: Kommt das Programm nicht hoch, zeigt Mirella nach 10 Sekunden die normale Ansicht
    setTimeout(() => { if (r.classList.contains("dtboot") && !r.classList.contains("dtready")) r.classList.remove("dt", "dtboot"); }, 10000);
  } catch (_) { }
})();
