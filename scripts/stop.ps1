. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $health = Get-ResumeHealth
    $serverPid = if ($health) { [int]$health.pid } elseif (Test-Path -LiteralPath $pidPath) { [int](Get-Content -LiteralPath $pidPath -Raw).Trim() } else { 0 }
    if (-not $serverPid) { Write-Host 'Not running.' -ForegroundColor Yellow; exit 0 }
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $serverPid"
    if ($process) {
        if (-not ([string]$process.CommandLine).ToLowerInvariant().Contains($serverPath.ToLowerInvariant())) {
            throw 'The process does not belong to this project. Nothing was stopped.'
        }
        Stop-Process -Id $serverPid -Force
    }
    if (Test-Path -LiteralPath $pidPath) { Remove-Item -LiteralPath $pidPath -Force }
    Write-Host 'Stopped. Resume data is preserved.' -ForegroundColor Green
    exit 0
} catch { Write-Host "Stop failed: $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
