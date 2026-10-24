namespace ControleTempo.Core.Modelos;

/// <summary>
/// Perfil do sistema: uma criança (com tempo/crédito controlado) ou o administrador.
/// Observação de projeto: os perfis são do PROGRAMA, não vinculados às contas do
/// Windows. Assim o controle vale independentemente de qual conta do Windows está
/// aberta, e criar uma conta nova no Windows não escapa do sistema.
/// </summary>
public class Usuario
{
    public int Id { get; set; }

    /// <summary>Nome exibido (ex.: "Pedro"). Usado no login e no overlay.</summary>
    public string Nome { get; set; } = string.Empty;

    public Papel Papel { get; set; } = Papel.Crianca;

    // --- Credenciais (nunca em texto puro) ---
    /// <summary>Hash PBKDF2 da senha, em formato "iteracoes.salt.hash" (Base64).</summary>
    public string SenhaHash { get; set; } = string.Empty;

    // --- Configuração individual de controle ---
    public ModoControle Modo { get; set; } = ModoControle.TempoLimite;

    /// <summary>
    /// No modo TempoLimite: teto diário em segundos (ex.: 7200 = 2h/dia).
    /// No modo Creditos: ignorado (o teto é o próprio saldo).
    /// </summary>
    public int LimiteDiarioSegundos { get; set; } = 7200;

    /// <summary>
    /// No modo Creditos: saldo atual em segundos. O admin recarrega.
    /// No modo TempoLimite: ignorado.
    /// </summary>
    public int SaldoCreditosSegundos { get; set; } = 0;

    /// <summary>
    /// No modo TempoLimite: segundos já consumidos no dia corrente (<see cref="DataConsumo"/>).
    /// Zera na virada do dia.
    /// </summary>
    public int ConsumidoHojeSegundos { get; set; } = 0;

    /// <summary>Dia (yyyy-MM-dd) a que se refere <see cref="ConsumidoHojeSegundos"/>.</summary>
    public string DataConsumo { get; set; } = string.Empty;

    public AcaoAoEsgotar AcaoAoEsgotar { get; set; } = AcaoAoEsgotar.BloquearTela;

    /// <summary>Pausar a contagem após este tempo de inatividade (0 = não pausar).</summary>
    public int InatividadePausaSegundos { get; set; } = 120;

    /// <summary>Permite à criança pedir mais tempo ao admin.</summary>
    public bool PodePedirTempo { get; set; } = true;

    /// <summary>Janelas de horário permitido no formato "HH:mm-HH:mm;HH:mm-HH:mm". Vazio = sempre.</summary>
    public string HorariosPermitidos { get; set; } = string.Empty;

    public bool Ativo { get; set; } = true;

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Segundos restantes AGORA, conforme o modo. Propriedade calculada, não persistida.
    /// </summary>
    public int RestanteSegundos => Modo == ModoControle.Creditos
        ? Math.Max(0, SaldoCreditosSegundos)
        : Math.Max(0, LimiteDiarioSegundos - ConsumidoHojeSegundos);
}
