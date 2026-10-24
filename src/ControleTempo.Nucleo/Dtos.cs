using ControleTempo.Core.Modelos;

namespace ControleTempo.Nucleo;

// Objetos de transferência (DTOs) da API web. Mantidos simples para serializar
// como JSON e para a interface do painel consumir diretamente.

public record LoginDto(string Senha);
public record DefinirAdminDto(string Senha, string Confirmacao);

public record UsuarioDto(
    int Id,
    string Nome,
    int Modo,
    int LimiteDiarioSegundos,
    int SaldoCreditosSegundos,
    int RestanteSegundos,
    int AcaoAoEsgotar,
    int InatividadePausaSegundos,
    bool PodePedirTempo,
    string HorariosPermitidos,
    bool Ativo)
{
    public static UsuarioDto De(Usuario u) => new(
        u.Id, u.Nome, (int)u.Modo, u.LimiteDiarioSegundos, u.SaldoCreditosSegundos,
        u.RestanteSegundos, (int)u.AcaoAoEsgotar, u.InatividadePausaSegundos,
        u.PodePedirTempo, u.HorariosPermitidos, u.Ativo);
}

public record SalvarUsuarioDto(
    int Id,
    string Nome,
    string? Senha,              // só definida na criação ou ao trocar
    int Modo,
    int LimiteDiarioSegundos,
    int SaldoCreditosSegundos,
    int AcaoAoEsgotar,
    int InatividadePausaSegundos,
    bool PodePedirTempo,
    string HorariosPermitidos,
    bool Ativo);

public record AjusteTempoDto(int Minutos);
public record ResponderPedidoDto(bool Aprovar, int Minutos);

public record EstadoVivoDto(
    int Estado,
    int? UsuarioId,
    string NomeUsuario,
    int Modo,
    int RestanteSegundos,
    string RestanteFormatado,
    int Cor,
    bool Pausada,
    int SegundosInativo,
    int PedidosPendentes);

public record LoginCriancaDto(string Nome, string Senha);
public record PedirTempoDto(int Minutos, string Mensagem);
public record ConfigDto(
    int PortaWeb, bool UsarHttps, string AvisosMinutos, bool AvisoSonoro,
    bool NotificacoesPush, bool BackupAutomatico, string AtalhoEmergencia);
