@echo off
title Mirella-Sicherung einrichten
echo Mirella-Sicherung wird eingerichtet ...
echo Gleich oeffnet sich ein kleines Fenster fuer E-Mail und Passwort, eventuell hinter diesem Fenster.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Mirella-Sicherung.ps1" -Einrichten
echo.
echo Fertig oder Fehler: bitte ein Foto von diesem Fenster an Mirella schicken, falls etwas nicht geklappt hat.
pause
