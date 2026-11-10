@echo off
rem Mirella: automatische PC-Sicherung einrichten (einmal doppelklicken)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Mirella-Sicherung.ps1" -Einrichten
