@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $script=Join-Path ([IO.Path]::GetTempPath()) ('resume-layout-'+[guid]::NewGuid().ToString('N')+'.ps1'); try { Invoke-WebRequest 'https://raw.githubusercontent.com/ljm434782/resume-layout-studio/main/scripts/bootstrap.ps1' -OutFile $script -UseBasicParsing; & $script; exit $LASTEXITCODE } catch { Write-Host $_.Exception.Message; exit 1 } finally { if (Test-Path -LiteralPath $script) { Remove-Item -LiteralPath $script -Force } }"
echo.
pause
