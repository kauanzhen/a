using ControleTempo.Core.Contratos;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Nucleo;

/// <summary>
/// Serviço em segundo plano que "bate o relógio" uma vez por segundo. É o único
/// ponto que avança a contagem (chamando <see cref="MotorTempo.Tique"/>). Também
/// traduz as decisões do motor em comandos para o overlay (bloquear, logoff,
/// desligar), dispara avisos e cuida do backup diário.
/// </summary>
public sealed class MotorWorker : BackgroundService
{
    private readonly ContextoControle _ctx;
    private readonly ILogger<MotorWorker> _log;
    private DateTime _ultimoBackup = DateTime.MinValue;

    public MotorWorker(ContextoControle ctx, ILogger<MotorWorker> log)
    {
        _ctx = ctx;
        _log = log;
    }

    public override Task StartAsync(CancellationToken cancellationToken)
    {
        // Verifica a integridade do banco antes de começar.
        bool integro = _ctx.Integridade.Verificar();
        if (!integro)
            _log.LogWarning("Integridade do banco não confere — possível adulteração externa.");
        _ctx.Repo.Registrar(TipoEvento.ServicoIniciado, 0,
            integro ? "Serviço iniciado." : "Serviço iniciado (ALERTA: integridade violada).");
        return base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                Passo();
                FazerBackupSeNecessario();
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Erro no passo do motor.");
            }

            try { await Task.Delay(1000, stoppingToken); }
            catch (TaskCanceledException) { break; }
        }
    }

    private void Passo()
    {
        bool ativo = _ctx.HouveAtividade();
        ResultadoTick res = _ctx.Motor.Tique(ativo);

        if (!string.IsNullOrEmpty(res.AvisoNovo))
            _ctx.DefinirAviso(res.AvisoNovo!);

        if (res.AcaoAplicar is { } acao)
            AplicarAcao(acao);
    }

    /// <summary>Traduz a ação de esgotamento em um comando para o overlay.</summary>
    private void AplicarAcao(AcaoAoEsgotar acao)
    {
        switch (acao)
        {
            case AcaoAoEsgotar.BloquearTela:
                _ctx.DefinirComando(ComandoOverlay.MostrarBloqueio);
                _ctx.DefinirAviso("Tempo esgotado. Digite a senha para continuar (se houver saldo).");
                break;
            case AcaoAoEsgotar.LogoffWindows:
                _ctx.DefinirComando(ComandoOverlay.Logoff);
                _ctx.Motor.EncerrarSessao(porEsgotamento: true);
                break;
            case AcaoAoEsgotar.Suspender:
                _ctx.DefinirComando(ComandoOverlay.Suspender);
                break;
            case AcaoAoEsgotar.Desligar:
                _ctx.DefinirComando(ComandoOverlay.Desligar);
                break;
            case AcaoAoEsgotar.ApenasAvisar:
                _ctx.DefinirAviso("Seu tempo acabou. Peça mais tempo ao responsável.");
                break;
        }
    }

    private void FazerBackupSeNecessario()
    {
        var cfg = _ctx.Repo.ObterConfig();
        if (cfg is null || !cfg.BackupAutomatico) return;
        if ((_ctx.Relogio.AgoraUtc - _ultimoBackup).TotalHours < 24) return;

        _ultimoBackup = _ctx.Relogio.AgoraUtc;
        try
        {
            string destino = Path.Combine(Caminhos.PastaBackup,
                $"dados-{_ctx.Relogio.AgoraLocal:yyyyMMdd-HHmmss}.db");
            File.Copy(Caminhos.ArquivoBanco, destino, overwrite: true);
            // Mantém apenas os 14 backups mais recentes.
            foreach (var antigo in new DirectoryInfo(Caminhos.PastaBackup)
                         .GetFiles("dados-*.db").OrderByDescending(f => f.Name).Skip(14))
                antigo.Delete();
            _log.LogInformation("Backup criado: {destino}", destino);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao criar backup.");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        // Ao parar, persiste e assina o estado para detectar edição externa enquanto
        // o serviço estiver fora do ar.
        try
        {
            _ctx.Integridade.AssinarArquivoSeparado();
            _ctx.Repo.Registrar(TipoEvento.ServicoParado, 0, "Serviço parado.");
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Falha ao assinar integridade no encerramento.");
        }
        await base.StopAsync(cancellationToken);
    }
}
