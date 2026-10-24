namespace ControleTempo.Core.Modelos;

/// <summary>
/// Modo de contabilização configurado por usuário.
/// </summary>
public enum ModoControle
{
    /// <summary>Teto de uso por período (ex.: 2h por dia). O relógio corre enquanto usa.</summary>
    TempoLimite = 0,

    /// <summary>Saldo consumível recarregável pelo admin (ex.: minutos/fichas).</summary>
    Creditos = 1
}

/// <summary>
/// O que acontece quando o tempo/crédito do usuário se esgota.
/// Definido individualmente pelo admin.
/// </summary>
public enum AcaoAoEsgotar
{
    /// <summary>Cobre a tela com um overlay de bloqueio que exige senha.</summary>
    BloquearTela = 0,

    /// <summary>Faz logoff da conta do Windows em uso.</summary>
    LogoffWindows = 1,

    /// <summary>Suspende o computador.</summary>
    Suspender = 2,

    /// <summary>Desliga o computador.</summary>
    Desligar = 3,

    /// <summary>Apenas avisa e permite pedir mais tempo ao admin.</summary>
    ApenasAvisar = 4
}

/// <summary>
/// Papel do perfil no sistema.
/// </summary>
public enum Papel
{
    /// <summary>Criança: tem tempo/crédito e sessões controladas.</summary>
    Crianca = 0,

    /// <summary>Administrador: senha mestra, acesso total ao painel e à saída de emergência.</summary>
    Administrador = 1
}

/// <summary>
/// Estado corrente do computador do ponto de vista do controle.
/// </summary>
public enum EstadoMaquina
{
    /// <summary>Nenhum usuário com sessão ativa; tela de login/bloqueio geral.</summary>
    Ocioso = 0,

    /// <summary>Usuário logado e consumindo tempo/crédito.</summary>
    EmUso = 1,

    /// <summary>Contagem pausada (pelo admin ou por inatividade), sessão mantida.</summary>
    Pausado = 2,

    /// <summary>Bloqueado por esgotamento ou por ordem do admin; exige reautenticação.</summary>
    Bloqueado = 3
}

/// <summary>
/// Situação de um pedido de mais tempo feito pela criança.
/// </summary>
public enum SituacaoPedido
{
    Pendente = 0,
    Aprovado = 1,
    Negado = 2
}

/// <summary>
/// Tipos de evento registrados para auditoria e relatórios.
/// </summary>
public enum TipoEvento
{
    InicioSessao = 0,
    FimSessao = 1,
    Bloqueio = 2,
    Desbloqueio = 3,
    Pausa = 4,
    Retomada = 5,
    TempoAdicionado = 6,
    TempoRemovido = 7,
    CreditoRecarregado = 8,
    LimiteAtingido = 9,
    TentativaBurla = 10,
    SaltoDeRelogio = 11,
    LoginAdmin = 12,
    FalhaLogin = 13,
    PedidoTempo = 14,
    PedidoAprovado = 15,
    PedidoNegado = 16,
    ServicoIniciado = 17,
    ServicoParado = 18,
    WatchdogReiniciou = 19,
    SaidaEmergencia = 20,
    IntegridadeViolada = 21
}
