$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$stagingRoot = Join-Path ([IO.Path]::GetTempPath()) ('resume-package-' + [guid]::NewGuid().ToString('N'))
try {
    $sourceRoot = Join-Path $stagingRoot 'resume-layout-studio'
    New-Item -ItemType Directory -Path $sourceRoot | Out-Null
    $names = @('app.js', 'styles.css', 'index.html', 'server.py', 'README.md', 'requirements.txt', 'requirements-dev.txt', '.gitignore', '.gitattributes', 'scripts', 'examples', 'tests', '.github')
    $files = @(Get-ChildItem -LiteralPath $projectRoot -File -Filter '*.cmd') + @($names | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
    foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination $sourceRoot -Recurse }
    Get-ChildItem -LiteralPath $sourceRoot -Recurse -Directory -Filter '__pycache__' | ForEach-Object {
        if (-not $_.FullName.StartsWith($stagingRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected package path.' }
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
    $dist = Join-Path $projectRoot 'dist'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $archive = Join-Path $dist 'resume-layout-studio-v1.0.0.zip'
    Compress-Archive -LiteralPath $sourceRoot -DestinationPath $archive -Force
    Write-Host "Package ready: $archive" -ForegroundColor Green
} finally {
    $resolvedStaging = [IO.Path]::GetFullPath($stagingRoot)
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\resume-package-'
    if ($resolvedStaging.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedStaging)) {
        Remove-Item -LiteralPath $resolvedStaging -Recurse -Force
    }
}
