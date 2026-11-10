@echo off
rem Mirella: Sicherung sofort einmal laufen lassen
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\Mirella\Mirella-Sicherung.ps1"
if errorlevel 1 (echo. & echo Das hat nicht geklappt, Details im Protokoll: %LOCALAPPDATA%\Mirella\protokoll.txt) else (echo. & echo Fertig.)
pause
