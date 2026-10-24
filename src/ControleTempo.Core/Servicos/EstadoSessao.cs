using ControleTempo.Core.Modelos;

namespace ControleTempo.Core.Servicos;

/// <summary>
/// Fotografia (snapshot) do estado atual do controle. É o que o overlay do timer
/// e o painel web consomem para exibir "quem está logado, quanto falta, em uso
/// ou bloqueado". Imutável e seguro para serializar como JSON.
/// </summary>
public sealed record EstadoSessao
{
    public EstadoMaquina Estado { get; init; } = EstadoMaquina.Ocioso;

    public int? UsuarioId { get; init; }
    public string NomeUsuario { get; init; } = string.Empty;
    public ModoControle Modo { get; init; }

    /// <summary>Segundos restantes agora.</summary>
    public int RestanteSegundos { get; init; }

    /// <summary>Faixa de cor sugerida para o overlay, derivada do tempo restante.</summary>
    public FaixaCor Cor { get; init; } = FaixaCor.Verde;

    /// <summary>Mensagem curta de aviso (ex.: "5 minutos restantes") ou vazio.</summary>
    public string Aviso { get; init; } = string.Empty;

    public bool ContagemPausada { get; init; }

    /// <summary>Carimbo do snapshot (relógio confiável).</summary>
    public DateTime AtualizadoUtc { get; init; } = DateTime.UtcNow;

    public string RestanteFormatado
    {
        get
        {
            var t = TimeSpan.FromSeconds(Math.Max(0, RestanteSegundos));
            return t.Hours > 0
                ? $"{t.Hours}:{t.Minutes:D2}:{t.Seconds:D2}"
                : $"{t.Minutes:D2}:{t.Seconds:D2}";
        }
    }
}

/// <summary>Código de cores do overlay conforme o tempo restante.</summary>
public enum FaixaCor
{
    Verde = 0,   // bastante tempo
    Amarelo = 1, // reta final
    Laranja = 2, // pouco tempo
    Vermelho = 3 // quase acabando (piscar)
}
