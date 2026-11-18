@echo off
rem Launches Ridgeline Rush full-screen in its own app window (Microsoft Edge).
set "HERE=%~dp0"
set "URL=file:///%HERE:\=/%www/index.html"
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --start-fullscreen --ignore-gpu-blocklist --user-data-dir="%LOCALAPPDATA%\RidgelineRush\profile"
) else (
  start "" "%HERE%www\index.html"
)
