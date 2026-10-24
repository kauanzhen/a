using System.Globalization;
using Microsoft.Data.Sqlite;
using ControleTempo.Core.Modelos;

namespace ControleTempo.Core.Dados;

/// <summary>
/// Acesso a dados (CRUD) sobre o SQLite. Todas as datas são gravadas em UTC no
/// formato ISO 8601 ("o") para ordenação e portabilidade.
/// </summary>
public sealed class Repositorio
{
    private readonly BancoDados _bd;

    public Repositorio(BancoDados bd) => _bd = bd;

    private static string Iso(DateTime dt) => dt.ToUniversalTime().ToString("o", CultureInfo.InvariantCulture);
    private static DateTime Dt(string s) => DateTime.Parse(s, CultureInfo.InvariantCulture, DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal);
    private static DateTime? DtN(object? o) => o is null or DBNull ? null : Dt((string)o);

    // ======================= USUÁRIOS =======================

    public Usuario? ObterUsuario(int id)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT * FROM Usuarios WHERE Id=$id";
        cmd.Parameters.AddWithValue("$id", id);
        using var r = cmd.ExecuteReader();
        return r.Read() ? LerUsuario(r) : null;
    }

    public Usuario? ObterUsuarioPorNome(string nome)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT * FROM Usuarios WHERE Nome=$n COLLATE NOCASE";
        cmd.Parameters.AddWithValue("$n", nome);
        using var r = cmd.ExecuteReader();
        return r.Read() ? LerUsuario(r) : null;
    }

    public List<Usuario> ListarUsuarios(bool somenteCriancas = false)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = somenteCriancas
            ? "SELECT * FROM Usuarios WHERE Papel=0 ORDER BY Nome"
            : "SELECT * FROM Usuarios ORDER BY Papel DESC, Nome";
        using var r = cmd.ExecuteReader();
        var lista = new List<Usuario>();
        while (r.Read()) lista.Add(LerUsuario(r));
        return lista;
    }

    public int InserirUsuario(Usuario u)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO Usuarios
(Nome,Papel,SenhaHash,Modo,LimiteDiarioSegundos,SaldoCreditosSegundos,ConsumidoHojeSegundos,
 DataConsumo,AcaoAoEsgotar,InatividadePausaSegundos,PodePedirTempo,HorariosPermitidos,Ativo,CriadoEm)
VALUES ($nome,$papel,$hash,$modo,$lim,$saldo,$cons,$data,$acao,$inat,$pede,$hor,$ativo,$criado);
SELECT last_insert_rowid();";
        PreencherParametrosUsuario(cmd, u);
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public void AtualizarUsuario(Usuario u)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE Usuarios SET
Nome=$nome,Papel=$papel,SenhaHash=$hash,Modo=$modo,LimiteDiarioSegundos=$lim,
SaldoCreditosSegundos=$saldo,ConsumidoHojeSegundos=$cons,DataConsumo=$data,
AcaoAoEsgotar=$acao,InatividadePausaSegundos=$inat,PodePedirTempo=$pede,
HorariosPermitidos=$hor,Ativo=$ativo WHERE Id=$id";
        PreencherParametrosUsuario(cmd, u);
        cmd.Parameters.AddWithValue("$id", u.Id);
        cmd.ExecuteNonQuery();
    }

    public void RemoverUsuario(int id)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "DELETE FROM Usuarios WHERE Id=$id AND Papel=0";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }

    private static void PreencherParametrosUsuario(SqliteCommand cmd, Usuario u)
    {
        cmd.Parameters.AddWithValue("$nome", u.Nome);
        cmd.Parameters.AddWithValue("$papel", (int)u.Papel);
        cmd.Parameters.AddWithValue("$hash", u.SenhaHash);
        cmd.Parameters.AddWithValue("$modo", (int)u.Modo);
        cmd.Parameters.AddWithValue("$lim", u.LimiteDiarioSegundos);
        cmd.Parameters.AddWithValue("$saldo", u.SaldoCreditosSegundos);
        cmd.Parameters.AddWithValue("$cons", u.ConsumidoHojeSegundos);
        cmd.Parameters.AddWithValue("$data", u.DataConsumo);
        cmd.Parameters.AddWithValue("$acao", (int)u.AcaoAoEsgotar);
        cmd.Parameters.AddWithValue("$inat", u.InatividadePausaSegundos);
        cmd.Parameters.AddWithValue("$pede", u.PodePedirTempo ? 1 : 0);
        cmd.Parameters.AddWithValue("$hor", u.HorariosPermitidos);
        cmd.Parameters.AddWithValue("$ativo", u.Ativo ? 1 : 0);
        cmd.Parameters.AddWithValue("$criado", Iso(u.CriadoEm));
    }

    private static Usuario LerUsuario(SqliteDataReader r) => new()
    {
        Id = r.GetInt32(r.GetOrdinal("Id")),
        Nome = r.GetString(r.GetOrdinal("Nome")),
        Papel = (Papel)r.GetInt32(r.GetOrdinal("Papel")),
        SenhaHash = r.GetString(r.GetOrdinal("SenhaHash")),
        Modo = (ModoControle)r.GetInt32(r.GetOrdinal("Modo")),
        LimiteDiarioSegundos = r.GetInt32(r.GetOrdinal("LimiteDiarioSegundos")),
        SaldoCreditosSegundos = r.GetInt32(r.GetOrdinal("SaldoCreditosSegundos")),
        ConsumidoHojeSegundos = r.GetInt32(r.GetOrdinal("ConsumidoHojeSegundos")),
        DataConsumo = r.GetString(r.GetOrdinal("DataConsumo")),
        AcaoAoEsgotar = (AcaoAoEsgotar)r.GetInt32(r.GetOrdinal("AcaoAoEsgotar")),
        InatividadePausaSegundos = r.GetInt32(r.GetOrdinal("InatividadePausaSegundos")),
        PodePedirTempo = r.GetInt32(r.GetOrdinal("PodePedirTempo")) == 1,
        HorariosPermitidos = r.GetString(r.GetOrdinal("HorariosPermitidos")),
        Ativo = r.GetInt32(r.GetOrdinal("Ativo")) == 1,
        CriadoEm = Dt(r.GetString(r.GetOrdinal("CriadoEm")))
    };

    // ======================= SESSÕES =======================

    public int AbrirSessao(int usuarioId)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO Sessoes (UsuarioId,InicioUtc,ConsumidoSegundos,EncerradaPorEsgotamento)
VALUES ($u,$i,0,0); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("$u", usuarioId);
        cmd.Parameters.AddWithValue("$i", Iso(DateTime.UtcNow));
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public void FecharSessao(int sessaoId, int consumidoSegundos, bool porEsgotamento)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE Sessoes SET FimUtc=$f, ConsumidoSegundos=$c, EncerradaPorEsgotamento=$e
WHERE Id=$id";
        cmd.Parameters.AddWithValue("$f", Iso(DateTime.UtcNow));
        cmd.Parameters.AddWithValue("$c", consumidoSegundos);
        cmd.Parameters.AddWithValue("$e", porEsgotamento ? 1 : 0);
        cmd.Parameters.AddWithValue("$id", sessaoId);
        cmd.ExecuteNonQuery();
    }

    public List<Sessao> ListarSessoes(int? usuarioId, DateTime desdeUtc)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = usuarioId.HasValue
            ? "SELECT * FROM Sessoes WHERE UsuarioId=$u AND InicioUtc>=$d ORDER BY InicioUtc DESC"
            : "SELECT * FROM Sessoes WHERE InicioUtc>=$d ORDER BY InicioUtc DESC";
        if (usuarioId.HasValue) cmd.Parameters.AddWithValue("$u", usuarioId.Value);
        cmd.Parameters.AddWithValue("$d", Iso(desdeUtc));
        using var r = cmd.ExecuteReader();
        var lista = new List<Sessao>();
        while (r.Read())
            lista.Add(new Sessao
            {
                Id = r.GetInt32(0),
                UsuarioId = r.GetInt32(1),
                InicioUtc = Dt(r.GetString(2)),
                FimUtc = DtN(r.IsDBNull(3) ? null : r.GetValue(3)),
                ConsumidoSegundos = r.GetInt32(4),
                EncerradaPorEsgotamento = r.GetInt32(5) == 1
            });
        return lista;
    }

    // ======================= EVENTOS / AUDITORIA =======================

    public void Registrar(TipoEvento tipo, int usuarioId, string detalhe, string origem = "service")
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO Eventos (QuandoUtc,Tipo,UsuarioId,Detalhe,Origem)
VALUES ($q,$t,$u,$d,$o)";
        cmd.Parameters.AddWithValue("$q", Iso(DateTime.UtcNow));
        cmd.Parameters.AddWithValue("$t", (int)tipo);
        cmd.Parameters.AddWithValue("$u", usuarioId);
        cmd.Parameters.AddWithValue("$d", detalhe);
        cmd.Parameters.AddWithValue("$o", origem);
        cmd.ExecuteNonQuery();
    }

    public List<EventoLog> ListarEventos(DateTime desdeUtc, int limite = 500)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT * FROM Eventos WHERE QuandoUtc>=$d ORDER BY QuandoUtc DESC LIMIT $l";
        cmd.Parameters.AddWithValue("$d", Iso(desdeUtc));
        cmd.Parameters.AddWithValue("$l", limite);
        using var r = cmd.ExecuteReader();
        var lista = new List<EventoLog>();
        while (r.Read())
            lista.Add(new EventoLog
            {
                Id = r.GetInt32(0),
                QuandoUtc = Dt(r.GetString(1)),
                Tipo = (TipoEvento)r.GetInt32(2),
                UsuarioId = r.GetInt32(3),
                Detalhe = r.GetString(4),
                Origem = r.GetString(5)
            });
        return lista;
    }

    // ======================= PEDIDOS DE TEMPO =======================

    public int CriarPedido(PedidoTempo p)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO Pedidos (UsuarioId,QuandoUtc,MinutosSolicitados,Mensagem,Situacao,MinutosConcedidos,RespondidoUtc)
VALUES ($u,$q,$m,$msg,0,0,NULL); SELECT last_insert_rowid();";
        cmd.Parameters.AddWithValue("$u", p.UsuarioId);
        cmd.Parameters.AddWithValue("$q", Iso(p.QuandoUtc));
        cmd.Parameters.AddWithValue("$m", p.MinutosSolicitados);
        cmd.Parameters.AddWithValue("$msg", p.Mensagem);
        return Convert.ToInt32(cmd.ExecuteScalar());
    }

    public void ResponderPedido(int pedidoId, SituacaoPedido situacao, int minutosConcedidos)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"UPDATE Pedidos SET Situacao=$s, MinutosConcedidos=$m, RespondidoUtc=$r WHERE Id=$id";
        cmd.Parameters.AddWithValue("$s", (int)situacao);
        cmd.Parameters.AddWithValue("$m", minutosConcedidos);
        cmd.Parameters.AddWithValue("$r", Iso(DateTime.UtcNow));
        cmd.Parameters.AddWithValue("$id", pedidoId);
        cmd.ExecuteNonQuery();
    }

    public List<PedidoTempo> ListarPedidos(SituacaoPedido? filtro = null)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = filtro.HasValue
            ? "SELECT * FROM Pedidos WHERE Situacao=$s ORDER BY QuandoUtc DESC LIMIT 200"
            : "SELECT * FROM Pedidos ORDER BY QuandoUtc DESC LIMIT 200";
        if (filtro.HasValue) cmd.Parameters.AddWithValue("$s", (int)filtro.Value);
        using var r = cmd.ExecuteReader();
        var lista = new List<PedidoTempo>();
        while (r.Read())
            lista.Add(new PedidoTempo
            {
                Id = r.GetInt32(0),
                UsuarioId = r.GetInt32(1),
                QuandoUtc = Dt(r.GetString(2)),
                MinutosSolicitados = r.GetInt32(3),
                Mensagem = r.GetString(4),
                Situacao = (SituacaoPedido)r.GetInt32(5),
                MinutosConcedidos = r.GetInt32(6),
                RespondidoUtc = DtN(r.IsDBNull(7) ? null : r.GetValue(7))
            });
        return lista;
    }

    // ======================= CONFIGURAÇÃO =======================

    public ConfiguracaoGlobal? ObterConfig()
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT * FROM Configuracao WHERE Id=1";
        using var r = cmd.ExecuteReader();
        if (!r.Read()) return null;
        return new ConfiguracaoGlobal
        {
            Id = 1,
            SenhaAdminHash = r.GetString(r.GetOrdinal("SenhaAdminHash")),
            PortaWeb = r.GetInt32(r.GetOrdinal("PortaWeb")),
            UsarHttps = r.GetInt32(r.GetOrdinal("UsarHttps")) == 1,
            AtalhoEmergencia = r.GetString(r.GetOrdinal("AtalhoEmergencia")),
            AvisosMinutos = r.GetString(r.GetOrdinal("AvisosMinutos")),
            AvisoSonoro = r.GetInt32(r.GetOrdinal("AvisoSonoro")) == 1,
            NotificacoesPush = r.GetInt32(r.GetOrdinal("NotificacoesPush")) == 1,
            BackupAutomatico = r.GetInt32(r.GetOrdinal("BackupAutomatico")) == 1,
            HashIntegridade = r.GetString(r.GetOrdinal("HashIntegridade"))
        };
    }

    public void SalvarConfig(ConfiguracaoGlobal c)
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"INSERT INTO Configuracao
(Id,SenhaAdminHash,PortaWeb,UsarHttps,AtalhoEmergencia,AvisosMinutos,AvisoSonoro,NotificacoesPush,BackupAutomatico,HashIntegridade)
VALUES (1,$h,$p,$https,$atalho,$avisos,$som,$push,$backup,$hash)
ON CONFLICT(Id) DO UPDATE SET
SenhaAdminHash=$h,PortaWeb=$p,UsarHttps=$https,AtalhoEmergencia=$atalho,
AvisosMinutos=$avisos,AvisoSonoro=$som,NotificacoesPush=$push,BackupAutomatico=$backup,HashIntegridade=$hash";
        cmd.Parameters.AddWithValue("$h", c.SenhaAdminHash);
        cmd.Parameters.AddWithValue("$p", c.PortaWeb);
        cmd.Parameters.AddWithValue("$https", c.UsarHttps ? 1 : 0);
        cmd.Parameters.AddWithValue("$atalho", c.AtalhoEmergencia);
        cmd.Parameters.AddWithValue("$avisos", c.AvisosMinutos);
        cmd.Parameters.AddWithValue("$som", c.AvisoSonoro ? 1 : 0);
        cmd.Parameters.AddWithValue("$push", c.NotificacoesPush ? 1 : 0);
        cmd.Parameters.AddWithValue("$backup", c.BackupAutomatico ? 1 : 0);
        cmd.Parameters.AddWithValue("$hash", c.HashIntegridade);
        cmd.ExecuteNonQuery();
    }

    public bool PossuiConfig()
    {
        using var con = _bd.Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = "SELECT COUNT(*) FROM Configuracao WHERE Id=1";
        return Convert.ToInt32(cmd.ExecuteScalar()) > 0;
    }
}
