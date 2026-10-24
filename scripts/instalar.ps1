<#
    instalar.ps1  —  EXECUTAR COMO ADMINISTRADOR
    Instala o Controle de Tempo: copia binários, cria os serviços (com
    recuperação automática), protege a pasta de dados, agenda o overlay no logon
    e abre a porta no firewall.

    Uso:  ./scripts/instalar.ps1 -Raiz (Resolve-Path .\publish)
    Onde -Raiz é a pasta que contém as subpastas Nucleo, Watchdog, Overlay e Recovery.
#>
param(
    [Parameter(Mandatory = $true)] [string]$Raiz,
    [int]$Porta = 8443
)

$ErrorActionPreference = "Stop"

# --- Verifica elevação ---
$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw "Rode este script COMO ADMINISTRADOR." }

$destino = "$env:ProgramFiles\ControleTempo"
$dados   = "$env:ProgramData\ControleTempo"

Write-Host "1/6  Copiando binários para $destino ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $destino | Out-Null
foreach ($sub in "Nucleo", "Watchdog", "Overlay", "Recovery") {
    Copy-Item -Recurse -Force (Join-Path $Raiz $sub\*) (Join-Path $destino $sub)
}

$exeNucleo   = Join-Path $destino "Nucleo\ControleTempo.Nucleo.exe"
$exeWatchdog = Join-Path $destino "Watchdog\ControleTempo.Watchdog.exe"
$exeOverlay  = Join-Path $destino "Overlay\ControleTempo.Overlay.exe"

Write-Host "2/6  Criando a pasta de dados e protegendo (NTFS) ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $dados | Out-Null
# Só SYSTEM e Administradores podem modificar; usuários comuns apenas leem
# (o overlay precisa ler endpoint.txt). Assim as crianças não editam o banco.
icacls $dados /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administradores:(OI)(CI)F" "Administrators:(OI)(CI)F" "Usuários:(OI)(CI)R" "Users:(OI)(CI)R" 2>$null | Out-Null

Write-Host "3/6  Criando os serviços ..." -ForegroundColor Cyan
# sc.exe (NÃO 'sc', que é alias de Set-Content no PowerShell)
& sc.exe create ControleTempo         binPath= "`"$exeNucleo`""   start= auto DisplayName= "Controle de Tempo" | Out-Null
& sc.exe create ControleTempoWatchdog binPath= "`"$exeWatchdog`"" start= auto DisplayName= "Controle de Tempo (Watchdog)" | Out-Null
& sc.exe description ControleTempo "Controla o tempo de uso do computador por usuário." | Out-Null
& sc.exe description ControleTempoWatchdog "Vigia e reinicia o serviço de controle de tempo." | Out-Null

# Recuperação automática: reinicia o serviço se ele for encerrado.
& sc.exe failure ControleTempo         reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null
& sc.exe failure ControleTempoWatchdog reset= 86400 actions= restart/5000/restart/5000/restart/5000 | Out-Null

Write-Host "4/6  Agendando o overlay no logon ..." -ForegroundColor Cyan
# Inicia o overlay na sessão de qualquer usuário que logar (token do usuário).
& schtasks /Create /TN "ControleTempoOverlay" /TR "`"$exeOverlay`"" /SC ONLOGON /RL LIMITED /F | Out-Null

Write-Host "5/6  Abrindo a porta $Porta no firewall (rede privada) ..." -ForegroundColor Cyan
& netsh advfirewall firewall delete rule name="ControleTempo" 2>$null | Out-Null
& netsh advfirewall firewall add rule name="ControleTempo" dir=in action=allow protocol=TCP localport=$Porta profile=private | Out-Null

Write-Host "6/6  Iniciando os serviços ..." -ForegroundColor Cyan
& sc.exe start ControleTempo | Out-Null
& sc.exe start ControleTempoWatchdog | Out-Null

# Descobre um IP local para exibir a URL de acesso.
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
       Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } |
       Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = "IP-DO-PC" }

Write-Host "`n✅ Instalado!" -ForegroundColor Green
Write-Host "   No celular (mesma rede Wi-Fi), abra:  https://$ip`:$Porta" -ForegroundColor Green
Write-Host "   No primeiro acesso, defina a senha do administrador."
Write-Host "   (O overlay inicia no próximo logon; para testar agora: `"$exeOverlay`")"
