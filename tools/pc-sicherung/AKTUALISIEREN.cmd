@echo off
rem Mirella: neue Version des Sicherungs-Programms uebernehmen. Passwort und Zielordner bleiben, nichts muss neu eingegeben werden.
if not exist "%LOCALAPPDATA%\Mirella\Mirella-Sicherung.ps1" (echo Das Programm ist noch nicht eingerichtet. Bitte zuerst EINRICHTEN.cmd doppelklicken. & pause & exit /b 1)
copy /Y "%~dp0Mirella-Sicherung.ps1" "%LOCALAPPDATA%\Mirella\Mirella-Sicherung.ps1" >nul
if errorlevel 1 (echo. & echo Das hat nicht geklappt.) else (echo. & echo Fertig. Ab der naechsten Sicherung ist die neue Version dabei.)
pause
