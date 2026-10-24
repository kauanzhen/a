<#
    desinstalar.ps1  —  EXECUTAR COMO ADMINISTRADOR
    Remove os serviços, a tarefa do overlay e a regra de firewall.
    Os dados em %ProgramData%\ControleTempo são PRESERVADOS (apague à mão se quiser).

    Uso:  ./scripts/desinstalar.ps1 [-RemoverBinarios] [-RemoverDados]
#>
param(
    [switch]$RemoverBinarios,
    [switch]$RemoverDados
)

$ErrorActionPreference = "SilentlyContinue"

$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Rode este script COMO ADMINISTRADOR." }

Write-Host "Parando e removendo serviços ..." -ForegroundColor Cyan
& sc.exe stop ControleTempoWatchdog | Out-Null
& sc.exe stop ControleTempo         | Out-Null
Start-Sleep -Seconds 2
& sc.exe delete ControleTempoWatchdog | Out-Null
& sc.exe delete ControleTempo         | Out-Null

Write-Host "Removendo a tarefa do overlay ..." -ForegroundColor Cyan
& schtasks /Delete /TN "ControleTempoOverlay" /F | Out-Null

Write-Host "Removendo a regra de firewall ..." -ForegroundColor Cyan
& netsh advfirewall firewall delete rule name="ControleTempo" | Out-Null

# Encerra o overlay que porventura esteja rodando.
Get-Process ControleTempo.Overlay -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if ($RemoverBinarios) {
    Write-Host "Removendo binários ..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "$env:ProgramFiles\ControleTempo" -ErrorAction SilentlyContinue
}

if ($RemoverDados) {
    Write-Host "Removendo dados ..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "$env:ProgramData\ControleTempo" -ErrorAction SilentlyContinue
}

Write-Host "`n✅ Desinstalado." -ForegroundColor Green
if (-not $RemoverDados) { Write-Host "   (Os dados foram preservados em %ProgramData%\ControleTempo.)" }
