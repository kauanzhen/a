using System.Runtime.Versioning;
using System.ServiceProcess;
using ControleTempo.Core.Servicos;

// ============================================================================
//  ControleTempo.Watchdog — vigia o serviço principal e o reinicia se cair.
// ============================================================================

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddWindowsService(o => o.ServiceName = "ControleTempoWatchdog");
builder.Services.AddHostedService<VigiaWorker>();
builder.Build().Run();

/// <summary>Verifica o serviço principal periodicamente e publica o próprio heartbeat.</summary>
internal sealed class VigiaWorker : BackgroundService
{
    private const string ServicoPrincipal = "ControleTempo";
    private readonly ILogger<VigiaWorker> _log;

    public VigiaWorker(ILogger<VigiaWorker> log)
    {
        _log = log;
        Caminhos.GarantirPastas();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                PublicarHeartbeat();
                if (OperatingSystem.IsWindows())
                    GarantirPrincipalRodando();
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Falha no ciclo do watchdog.");
            }

            try { await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private static void PublicarHeartbeat()
    {
        File.WriteAllText(Path.Combine(Caminhos.PastaDados, "watchdog.alive"),
            DateTime.UtcNow.ToString("o"));
    }

    [SupportedOSPlatform("windows")]
    private void GarantirPrincipalRodando()
    {
        try
        {
            using var sc = new ServiceController(ServicoPrincipal);
            sc.Refresh();
            if (sc.Status is ServiceControllerStatus.Stopped or ServiceControllerStatus.StopPending)
            {
                _log.LogWarning("Serviço principal parado — reiniciando.");
                if (sc.Status == ServiceControllerStatus.Stopped)
                {
                    sc.Start();
                    sc.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(20));
                }
            }
        }
        catch (InvalidOperationException)
        {
            // Serviço ainda não instalado: ignora silenciosamente.
        }
    }
}
