using System.Diagnostics;

namespace ControleTempo.Core.Servicos;

/// <summary>
/// Relógio resistente à adulteração da hora do sistema.
///
/// A ideia central (defesa contra "mudar o relógio para ganhar tempo"): o tempo
/// é medido por um cronômetro MONOTÔNICO (Stopwatch), que avança sempre e não é
/// afetado quando a criança muda a data/hora do Windows. Mantemos um "agora
/// confiável" que só anda para frente, na mesma cadência do tempo real
/// decorrido. A hora de parede do sistema é usada apenas como referência inicial
/// e para DETECTAR saltos — nunca para conceder ou devolver tempo.
/// </summary>
public sealed class RelogioConfiavel
{
    private readonly object _trava = new();
    private long _ultimoTimestamp;      // ticks do Stopwatch na última amostragem
    private DateTime _agoraConfiavelUtc; // "agora" que só avança por tempo real

    /// <summary>Tolerância antes de considerar um salto de relógio (segundos).</summary>
    public double ToleranciaSaltoSegundos { get; init; } = 5.0;

    public RelogioConfiavel(DateTime? inicialUtc = null)
    {
        _ultimoTimestamp = Stopwatch.GetTimestamp();
        _agoraConfiavelUtc = (inicialUtc ?? DateTime.UtcNow).ToUniversalTime();
    }

    /// <summary>"Agora" confiável, em UTC (só avança por tempo real decorrido).</summary>
    public DateTime AgoraUtc { get { lock (_trava) return _agoraConfiavelUtc; } }

    /// <summary>"Agora" confiável, no horário local (para virada de dia e janelas de horário).</summary>
    public DateTime AgoraLocal => AgoraUtc.ToLocalTime();

    /// <summary>
    /// Avança o relógio confiável pelo tempo real decorrido desde a última chamada
    /// e informa se houve salto na hora de parede do sistema.
    /// </summary>
    /// <param name="segundosReais">Segundos reais decorridos (monotônicos).</param>
    /// <param name="saltoDetectado">true se a hora de parede divergiu demais.</param>
    /// <param name="segundosSalto">Magnitude do salto (positivo = adiantou, negativo = atrasou).</param>
    public void Avancar(out double segundosReais, out bool saltoDetectado, out double segundosSalto)
    {
        lock (_trava)
        {
            long agora = Stopwatch.GetTimestamp();
            segundosReais = (agora - _ultimoTimestamp) / (double)Stopwatch.Frequency;
            if (segundosReais < 0) segundosReais = 0; // proteção contra timestamp improvável
            _ultimoTimestamp = agora;

            // Avança o "agora confiável" apenas pelo tempo real.
            _agoraConfiavelUtc = _agoraConfiavelUtc.AddSeconds(segundosReais);

            // Compara com a hora de parede do sistema para detectar adulteração.
            DateTime parede = DateTime.UtcNow;
            segundosSalto = (parede - _agoraConfiavelUtc).TotalSeconds;
            saltoDetectado = Math.Abs(segundosSalto) > ToleranciaSaltoSegundos;

            // Importante: NÃO sincronizamos o relógio confiável com a parede quando há
            // salto. Assim, mexer no relógio não concede nem rouba tempo. Apenas
            // quando a divergência é pequena (desvio natural), acompanhamos de leve.
            if (!saltoDetectado)
                _agoraConfiavelUtc = parede;
        }
    }
}
