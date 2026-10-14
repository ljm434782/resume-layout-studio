. (Join-Path $PSScriptRoot 'common.ps1')
$health = Get-ResumeHealth
if ($health) {
    Write-Host 'Status: running' -ForegroundColor Green
    Write-Host "URL: $appUrl"
    Write-Host "Version: $($health.version)"
    Write-Host "PID: $($health.pid)"
    $pdfStatus = if ($health.pdf.available) { 'available' } else { 'install Edge or Chrome' }
    Write-Host "PDF: $pdfStatus"
    exit 0
}
Write-Host 'Status: not running' -ForegroundColor Yellow
exit 1
