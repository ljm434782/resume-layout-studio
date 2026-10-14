param([switch]$NoBrowser)
. (Join-Path $PSScriptRoot 'common.ps1')
try {
    $health = Get-ResumeHealth
    if ($health) {
        Write-Host "Already running: $appUrl" -ForegroundColor Green
        if (-not $NoBrowser) { Start-Process $appUrl }
        exit 0
    }
    if (-not (Test-Path -LiteralPath $venvPython)) {
        & (Join-Path $PSScriptRoot 'install.ps1') -NoStart
        if ($LASTEXITCODE -ne 0) { throw 'Installation failed.' }
    }
    $client = New-Object Net.Sockets.TcpClient
    try {
        $client.Connect('127.0.0.1', $port)
        throw "Port $port is occupied by another application. Set RESUME_LAYOUT_PORT to an unused port."
    } catch [Net.Sockets.SocketException] {} finally { $client.Dispose() }
    New-Item -ItemType Directory -Force -Path $logDir, $dataRoot | Out-Null
    $process = Start-Process -FilePath $venvPython -ArgumentList @('-u', "`"$serverPath`"") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server.err.log') -PassThru
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        $health = Get-ResumeHealth
        if ($health) {
            Write-Host "Started: $appUrl" -ForegroundColor Green
            if (-not $health.pdf.available) { Write-Host 'PDF export needs Microsoft Edge or Google Chrome.' -ForegroundColor Yellow }
            if (-not $NoBrowser) { Start-Process $appUrl }
            exit 0
        }
        if ($process.HasExited) { break }
        Start-Sleep -Milliseconds 500
    }
    throw "Server did not start. Check $logDir\server.err.log"
} catch {
    Write-Host "Start failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
