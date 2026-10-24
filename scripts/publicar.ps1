<#
    publicar.ps1
    Publica os quatro executáveis do Controle de Tempo em .\publish\<Projeto>.
    Uso:  ./scripts/publicar.ps1
#>
param(
    [string]$Config = "Release",
    [string]$Runtime = "win-x64",
    [string]$Saida = "publish"
)

$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot

$projetos = @(
    @{ Nome = "Nucleo";   Proj = "src/ControleTempo.Nucleo/ControleTempo.Nucleo.csproj" },
    @{ Nome = "Watchdog"; Proj = "src/ControleTempo.Watchdog/ControleTempo.Watchdog.csproj" },
    @{ Nome = "Overlay";  Proj = "src/ControleTempo.Overlay/ControleTempo.Overlay.csproj" },
    @{ Nome = "Recovery"; Proj = "src/ControleTempo.Recovery/ControleTempo.Recovery.csproj" }
)

foreach ($p in $projetos) {
    $destino = Join-Path $raiz "$Saida\$($p.Nome)"
    Write-Host "Publicando $($p.Nome)..." -ForegroundColor Cyan
    dotnet publish (Join-Path $raiz $p.Proj) -c $Config -r $Runtime --self-contained false -o $destino
}

Write-Host "`nPublicado em $(Join-Path $raiz $Saida)" -ForegroundColor Green
Write-Host "Agora rode (como admin):  ./scripts/instalar.ps1 -Raiz (Resolve-Path .\$Saida)"
