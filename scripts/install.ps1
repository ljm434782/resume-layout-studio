param([switch]$NoStart, [switch]$NoShortcut, [switch]$ForceRuntime)
. (Join-Path $PSScriptRoot 'common.ps1')
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'

try {
    Write-Host 'Installing Resume Layout Studio...' -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path $logDir, $dataRoot | Out-Null
    $runtimeRoot = Join-Path $projectRoot '.runtime'
    $runtimePython = Join-Path $runtimeRoot 'python\python.exe'

    if (-not (Test-PythonVersion $venvPython)) {
        $python = $null
        if (Test-PythonVersion $runtimePython) { $python = $runtimePython }
        if (-not $python -and -not $ForceRuntime) {
            foreach ($commandName in @('python.exe', 'python3.exe')) {
                $command = Get-Command $commandName -ErrorAction SilentlyContinue
                if ($command -and (Test-PythonVersion $command.Source)) { $python = $command.Source; break }
            }
            if (-not $python -and (Get-Command py.exe -ErrorAction SilentlyContinue)) {
                foreach ($version in @('-3.13', '-3.12', '-3.11', '-3.10', '-3.14')) {
                    $candidate = & py.exe $version -c 'import sys; print(sys.executable)' 2>$null
                    if ($LASTEXITCODE -eq 0 -and (Test-PythonVersion ([string]$candidate))) { $python = [string]$candidate; break }
                }
            }
        }
        if (-not $python) {
            if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows 10/11 64-bit is required.' }
            New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
            $installer = Join-Path $runtimeRoot 'python-3.13.16-amd64.exe'
            Write-Host 'Downloading Python from python.org (no administrator access required)...'
            Invoke-WebRequest -Uri 'https://www.python.org/ftp/python/3.13.16/python-3.13.16-amd64.exe' -OutFile $installer -UseBasicParsing
            $signature = Get-AuthenticodeSignature -LiteralPath $installer
            if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Python Software Foundation') {
                throw 'The Python installer signature could not be verified.'
            }
            $target = Join-Path $runtimeRoot 'python'
            $arguments = "/quiet InstallAllUsers=0 TargetDir=`"$target`" Include_pip=1 Include_test=0 Include_launcher=0 AssociateFiles=0 PrependPath=0 Shortcuts=0"
            $process = Start-Process -FilePath $installer -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
            if ($process.ExitCode -notin @(0, 3010) -or -not (Test-PythonVersion $runtimePython)) {
                throw "Python installation failed (exit code $($process.ExitCode))."
            }
            $python = $runtimePython
        }
        $venvPath = Join-Path $projectRoot '.venv'
        if (Test-Path -LiteralPath $venvPath) {
            $resolvedVenv = [IO.Path]::GetFullPath($venvPath)
            if ($resolvedVenv -ne ([IO.Path]::GetFullPath((Join-Path $projectRoot '.venv')))) { throw 'Unexpected virtual environment path.' }
            Move-Item -LiteralPath $resolvedVenv -Destination "$resolvedVenv.backup.$(Get-Date -Format yyyyMMddHHmmss)"
        }
        Invoke-Python $python @('-m', 'venv', $venvPath)
    }

    $requirements = Join-Path $projectRoot 'requirements.txt'
    $requirementsHash = (Get-FileHash -LiteralPath $requirements -Algorithm SHA256).Hash
    $marker = Join-Path $projectRoot '.venv\requirements.sha256'
    $installedHash = if (Test-Path -LiteralPath $marker) { (Get-Content -LiteralPath $marker -Raw).Trim() } else { '' }
    $dependenciesReady = $false
    try {
        & $venvPython -c 'import fastapi, uvicorn, multipart, docx, pypdf, websocket' 2>$null
        $dependenciesReady = $LASTEXITCODE -eq 0
    } catch {}
    if ($installedHash -ne $requirementsHash -or -not $dependenciesReady) {
        Write-Host 'Installing dependencies from PyPI...'
        Invoke-Python $venvPython @('-m', 'pip', '--isolated', '--disable-pip-version-check', 'install', '--index-url', 'https://pypi.org/simple', '--timeout', '30', '--retries', '2', '-r', $requirements)
        Invoke-Python $venvPython @('-c', 'import fastapi, uvicorn, multipart, docx, pypdf, websocket')
        Set-Content -LiteralPath $marker -Value $requirementsHash -Encoding ASCII
    } else { Write-Host 'Dependencies are already installed.' }

    if (-not $NoShortcut) {
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Resume Layout Studio.lnk'))
        $shortcut.TargetPath = Join-Path $projectRoot ([string][char]0x5f00 + [char]0x59cb + '.cmd')
        $shortcut.WorkingDirectory = $projectRoot
        $shortcut.Save()
    }
    Write-Host 'Installation complete. Your resume data stays on this computer.' -ForegroundColor Green
    if (-not $NoStart) { & (Join-Path $PSScriptRoot 'start.ps1'); if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
    exit 0
} catch {
    Write-Host "Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host 'Check your network connection and run the installer again.'
    exit 1
}
