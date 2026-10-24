using ControleTempo.Core.Modelos;
using ControleTempo.Nucleo;

// ============================================================================
//  ControleTempo.Nucleo — ponto de entrada
//  Sobe o serviço (worker de contagem) + o servidor web (painel + API overlay).
//  Projetado para rodar como Serviço do Windows, iniciando no boot.
// ============================================================================

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    // Fundamental ao rodar como Serviço do Windows: o diretório atual é system32,
    // então fixamos o content root no diretório do executável (acha o wwwroot).
    ContentRootPath = AppContext.BaseDirectory
});

// Faz o host se comportar como Serviço do Windows (ignorado em outras plataformas).
builder.Host.UseWindowsService(o => o.ServiceName = "ControleTempo");

// Instância única e compartilhada de todo o estado (motor, banco, relógio).
var ctx = new ContextoControle();

// Garante que exista uma linha de configuração (sem senha de admin no 1º acesso).
if (!ctx.Repo.PossuiConfig())
    ctx.Repo.SalvarConfig(new ConfiguracaoGlobal());

var cfg = ctx.Repo.ObterConfig()!;

// Publica o endereço local (loopback) para o overlay/recovery descobrirem a
// porta/esquema sem precisar abrir o banco. Fica na pasta de dados protegida.
string esquemaLocal = cfg.UsarHttps && OperatingSystem.IsWindows() ? "https" : "http";
try
{
    File.WriteAllText(
        Path.Combine(ControleTempo.Core.Servicos.Caminhos.PastaDados, "endpoint.txt"),
        $"{esquemaLocal}://127.0.0.1:{cfg.PortaWeb}");
}
catch { /* ignora falha de escrita do arquivo de descoberta */ }

// Configura o Kestrel para ouvir em todas as interfaces da rede local, de modo
// que o celular do admin alcance o painel pelo IP da máquina.
builder.WebHost.ConfigureKestrel(opcoes =>
{
    if (cfg.UsarHttps && OperatingSystem.IsWindows())
    {
        var cert = CertificadoLocal.GerarOuCarregar();
        opcoes.ListenAnyIP(cfg.PortaWeb, l => l.UseHttps(cert));
    }
    else
    {
        // Fallback HTTP (ex.: em testes fora do Windows ou se HTTPS desabilitado).
        opcoes.ListenAnyIP(cfg.PortaWeb);
    }
});

builder.Services.AddSingleton(ctx);
builder.Services.AddHostedService<MotorWorker>();

var app = builder.Build();

// Painel estático (wwwroot) + API.
app.UseDefaultFiles();
app.UseStaticFiles();
Endpoints.MapearApi(app);

// Mostra no log a URL de acesso do painel (útil na primeira configuração).
string esquema = cfg.UsarHttps && OperatingSystem.IsWindows() ? "https" : "http";
app.Logger.LogInformation("Painel disponível em {u}:{p} (acesse pelo celular na mesma rede)",
    $"{esquema}://{RedeLocal.IpPreferido()}", cfg.PortaWeb);

app.Run();
