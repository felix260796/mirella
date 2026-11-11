@echo off
rem Mirella: naechtliche Sicherung ausschalten
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Mirella-Sicherung.ps1" -Entfernen
