using ControleTempo.Core.Servicos;

namespace ControleTempo.Core.Contratos;

/// <summary>
/// Comando que o serviço pede ao overlay (que roda na sessão interativa do
/// usuário) para executar. O serviço vive na sessão 0 e não desenha UI nem faz
/// logoff do usuário diretamente; por isso delega ao overlay, que está na sessão
/// do usuário. A contagem e a decisão continuam no núcleo (serviço) — o overlay
/// só obedece.
/// </summary>
public enum ComandoOverlay
{
    Nenhum = 0,
    MostrarBloqueio = 1, // desenhar tela de bloqueio que exige senha
    Logoff = 2,
    Suspender = 3,
    Desligar = 4,
    LiberarTela = 5      // remover a tela de bloqueio
}

/// <summary>
/// Pacote que o overlay busca do serviço (localhost) a cada segundo: o que
/// exibir e o que fazer. Não contém segredos (senha mestra, atalho).
/// </summary>
public sealed record PacoteOverlay
{
    public EstadoSessao Estado { get; init; } = new();
    public ComandoOverlay Comando { get; init; } = ComandoOverlay.Nenhum;

    /// <summary>Aviso textual recém-disparado para exibir (ex.: "Faltam 5 minutos").</summary>
    public string Aviso { get; init; } = string.Empty;

    /// <summary>Tocar som junto com o aviso.</summary>
    public bool AvisoSonoro { get; init; }

    /// <summary>Sistema desativado em modo de emergência: o PC fica liberado.</summary>
    public bool SistemaDesativado { get; init; }
}

/// <summary>Batimento que o overlay envia ao serviço, reportando atividade do usuário.</summary>
public sealed record BatimentoOverlay
{
    /// <summary>Segundos desde a última entrada de mouse/teclado na sessão do usuário.</summary>
    public int SegundosInativo { get; init; }

    /// <summary>Senha digitada na tela de bloqueio para reautenticar (ou vazio).</summary>
    public string? SenhaReautenticacao { get; init; }
}
