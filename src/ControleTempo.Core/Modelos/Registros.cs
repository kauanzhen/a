namespace ControleTempo.Core.Modelos;

/// <summary>
/// Entrada do log de auditoria e de eventos relevantes (bloqueios, tentativas de
/// burla detectadas, ações do admin). Alimenta a aba de relatórios/auditoria.
/// </summary>
public class EventoLog
{
    public int Id { get; set; }
    public DateTime QuandoUtc { get; set; } = DateTime.UtcNow;
    public TipoEvento Tipo { get; set; }

    /// <summary>Usuário relacionado (0 = sistema/admin).</summary>
    public int UsuarioId { get; set; }

    /// <summary>Descrição legível em PT-BR.</summary>
    public string Detalhe { get; set; } = string.Empty;

    /// <summary>Origem: "service", "web", "overlay", "recovery".</summary>
    public string Origem { get; set; } = "service";
}

/// <summary>
/// Pedido de mais tempo feito por uma criança, aprovado ou negado pelo admin.
/// </summary>
public class PedidoTempo
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public DateTime QuandoUtc { get; set; } = DateTime.UtcNow;

    /// <summary>Quantos minutos a criança pediu.</summary>
    public int MinutosSolicitados { get; set; }

    /// <summary>Justificativa opcional digitada pela criança.</summary>
    public string Mensagem { get; set; } = string.Empty;

    public SituacaoPedido Situacao { get; set; } = SituacaoPedido.Pendente;

    /// <summary>Minutos efetivamente concedidos (pode diferir do pedido).</summary>
    public int MinutosConcedidos { get; set; }

    public DateTime? RespondidoUtc { get; set; }
}

/// <summary>
/// Configuração global do sistema (uma única linha). A senha do administrador fica
/// aqui como hash; o segredo do atalho de emergência também. Os valores sensíveis
/// podem ser adicionalmente protegidos em repouso (ver IProtetorSegredos).
/// </summary>
public class ConfiguracaoGlobal
{
    public int Id { get; set; } = 1;

    /// <summary>Hash PBKDF2 da senha mestra do administrador.</summary>
    public string SenhaAdminHash { get; set; } = string.Empty;

    /// <summary>Porta do servidor web do painel admin.</summary>
    public int PortaWeb { get; set; } = 8443;

    /// <summary>Usar HTTPS local (certificado autoassinado).</summary>
    public bool UsarHttps { get; set; } = true;

    /// <summary>Atalho secreto de emergência (ex.: "Ctrl+Alt+Shift+F12").</summary>
    public string AtalhoEmergencia { get; set; } = "Ctrl+Alt+Shift+F12";

    /// <summary>Marcos de aviso antes do fim, em minutos (ex.: "10,5,1").</summary>
    public string AvisosMinutos { get; set; } = "10,5,1";

    /// <summary>Emitir aviso sonoro junto com o visual.</summary>
    public bool AvisoSonoro { get; set; } = true;

    /// <summary>Habilitar notificações push para o celular do admin.</summary>
    public bool NotificacoesPush { get; set; } = false;

    /// <summary>Fazer backup automático do banco.</summary>
    public bool BackupAutomatico { get; set; } = true;

    /// <summary>Hash de integridade do último estado conhecido do banco (anti-adulteração).</summary>
    public string HashIntegridade { get; set; } = string.Empty;
}
