$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$serverPath = Join-Path $projectRoot 'server.py'
$venvPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
$dataRoot = if ($env:RESUME_LAYOUT_DATA_DIR) { $env:RESUME_LAYOUT_DATA_DIR } else { Join-Path $projectRoot 'data' }
$pidPath = Join-Path $dataRoot 'server.pid'
$logDir = Join-Path $projectRoot 'logs'
$port = if ($env:RESUME_LAYOUT_PORT) { [int]$env:RESUME_LAYOUT_PORT } else { 4180 }
if ($port -lt 1024 -or $port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
$appUrl = "http://127.0.0.1:$port/"
$healthUrl = "${appUrl}api/health"

function Get-ResumeHealth {
    try {
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
        if ($response.ok -and $response.app -eq 'resume-layout-studio' -and $response.instance -eq $projectRoot) {
            return $response
        }
    } catch {}
    return $null
}

function Test-PythonVersion([string]$executable) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { return $false }
    try {
        & $executable -c 'import sys; sys.exit(0 if (3, 10) <= sys.version_info[:2] < (3, 15) else 1)' 2>$null
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

function Invoke-Python([string]$executable, [string[]]$arguments) {
    & $executable @arguments
    if ($LASTEXITCODE -ne 0) { throw "Python command failed (exit code $LASTEXITCODE)." }
}
