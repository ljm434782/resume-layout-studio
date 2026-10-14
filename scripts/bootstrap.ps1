param(
    [string]$InstallDirectory = (Join-Path $env:LOCALAPPDATA 'ResumeLayoutStudio'),
    [string]$ArchiveUrl = 'https://github.com/ljm434782/resume-layout-studio/archive/refs/heads/main.zip',
    [switch]$NoStart,
    [switch]$NoShortcut,
    [switch]$ForceRuntime
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('resume-layout-' + [guid]::NewGuid().ToString('N'))
try {
    Write-Host 'Downloading Resume Layout Studio from GitHub...' -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $stagingRoot | Out-Null
    $archive = Join-Path $stagingRoot 'source.zip'
    Invoke-WebRequest -Uri $ArchiveUrl -OutFile $archive -UseBasicParsing
    $expanded = Join-Path $stagingRoot 'source'
    Expand-Archive -LiteralPath $archive -DestinationPath $expanded
    $roots = @(Get-ChildItem -LiteralPath $expanded -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'server.py') })
    if ($roots.Count -ne 1) { throw 'Downloaded archive does not contain the expected project.' }
    $sourceRoot = $roots[0].FullName
    $targetRoot = [IO.Path]::GetFullPath($InstallDirectory).TrimEnd('\')
    if ($targetRoot -eq [IO.Path]::GetPathRoot($targetRoot).TrimEnd('\')) { throw 'Install into a project folder, not a drive root.' }
    New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null
    foreach ($file in (Get-ChildItem -LiteralPath $sourceRoot -Recurse -File)) {
        $relative = $file.FullName.Substring($sourceRoot.Length + 1)
        if ($relative -match '^(data|logs|\.venv|\.runtime|\.git)(\\|/)' -or $relative -match '^\.env') { continue }
        $target = [IO.Path]::GetFullPath((Join-Path $targetRoot $relative))
        if (-not $target.StartsWith($targetRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected path in downloaded archive.' }
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }
    Write-Host "Installed files: $targetRoot"
    & (Join-Path $targetRoot 'scripts\install.ps1') -NoStart:$NoStart -NoShortcut:$NoShortcut -ForceRuntime:$ForceRuntime
    exit $LASTEXITCODE
} catch {
    Write-Host "Download or installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Try again, or download the repository ZIP and run the included installer.'
    exit 1
} finally {
    $resolvedStaging = [IO.Path]::GetFullPath($stagingRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\resume-layout-'
    if ($resolvedStaging.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
