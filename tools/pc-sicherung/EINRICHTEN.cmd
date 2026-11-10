@echo off
title Mirella-Sicherung einrichten
echo Mirella-Sicherung wird eingerichtet ...
echo Gleich fragt dieses Fenster nach deiner Mirella-E-Mail und deinem Passwort.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Mirella-Sicherung.ps1" -Einrichten
echo.
echo Fertig oder Fehler: bitte ein Foto von diesem Fenster an Mirella schicken, falls etwas nicht geklappt hat.
pause
