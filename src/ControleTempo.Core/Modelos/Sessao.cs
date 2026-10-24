namespace ControleTempo.Core.Modelos;

/// <summary>
/// Registro de uma sessão de uso (do login até o bloqueio/logoff).
/// Base dos relatórios e do histórico.
/// </summary>
public class Sessao
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }

    public DateTime InicioUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Nulo enquanto a sessão está aberta.</summary>
    public DateTime? FimUtc { get; set; }

    /// <summary>
    /// Segundos efetivamente consumidos na sessão (tempo ativo, medido por relógio
    /// monotônico — não é só InicioUtc menos FimUtc, pois pausas não contam).
    /// </summary>
    public int ConsumidoSegundos { get; set; }

    public bool EncerradaPorEsgotamento { get; set; }

    public int DuracaoSegundos =>
        (int)((FimUtc ?? DateTime.UtcNow) - InicioUtc).TotalSeconds;
}
