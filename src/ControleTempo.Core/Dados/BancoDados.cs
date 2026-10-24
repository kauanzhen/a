using Microsoft.Data.Sqlite;

namespace ControleTempo.Core.Dados;

/// <summary>
/// Abre a conexão com o SQLite e garante o esquema. O arquivo do banco fica em
/// uma pasta protegida (ex.: %ProgramData%\ControleTempo\dados.db), de modo que
/// um usuário comum não consiga apagá-lo ou editá-lo.
///
/// Sobre criptografia do arquivo: o Microsoft.Data.Sqlite "puro" não cifra o
/// arquivo em disco. Para cifragem em repouso há duas opções documentadas no
/// README: (1) usar SQLCipher (trocar o pacote e informar "Password=" na string
/// de conexão) ou (2) proteger a pasta com EFS/BitLocker. Independentemente
/// disso, aplicamos verificação de integridade (hash) sobre o estado para
/// detectar adulteração externa — ver VerificadorIntegridade.
/// </summary>
public sealed class BancoDados
{
    private readonly string _caminho;

    public BancoDados(string caminhoArquivo)
    {
        _caminho = caminhoArquivo;
        var dir = Path.GetDirectoryName(_caminho);
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
    }

    public string Caminho => _caminho;

    /// <summary>String de conexão. Para SQLCipher, acrescente ";Password=..." aqui.</summary>
    public string ConnectionString => new SqliteConnectionStringBuilder
    {
        DataSource = _caminho,
        Mode = SqliteOpenMode.ReadWriteCreate,
        Cache = SqliteCacheMode.Shared
    }.ToString();

    public SqliteConnection Abrir()
    {
        var con = new SqliteConnection(ConnectionString);
        con.Open();
        using (var pragma = con.CreateCommand())
        {
            // WAL melhora leituras concorrentes (serviço grava, web lê).
            pragma.CommandText = "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;";
            pragma.ExecuteNonQuery();
        }
        return con;
    }

    /// <summary>Cria as tabelas se ainda não existirem.</summary>
    public void GarantirEsquema()
    {
        using var con = Abrir();
        using var cmd = con.CreateCommand();
        cmd.CommandText = @"
CREATE TABLE IF NOT EXISTS Usuarios (
    Id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    Nome                    TEXT NOT NULL UNIQUE,
    Papel                   INTEGER NOT NULL,
    SenhaHash               TEXT NOT NULL,
    Modo                    INTEGER NOT NULL,
    LimiteDiarioSegundos    INTEGER NOT NULL,
    SaldoCreditosSegundos   INTEGER NOT NULL,
    ConsumidoHojeSegundos   INTEGER NOT NULL,
    DataConsumo             TEXT NOT NULL,
    AcaoAoEsgotar           INTEGER NOT NULL,
    InatividadePausaSegundos INTEGER NOT NULL,
    PodePedirTempo          INTEGER NOT NULL,
    HorariosPermitidos      TEXT NOT NULL,
    Ativo                   INTEGER NOT NULL,
    CriadoEm                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Sessoes (
    Id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    UsuarioId               INTEGER NOT NULL,
    InicioUtc               TEXT NOT NULL,
    FimUtc                  TEXT NULL,
    ConsumidoSegundos       INTEGER NOT NULL,
    EncerradaPorEsgotamento INTEGER NOT NULL,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);

CREATE TABLE IF NOT EXISTS Eventos (
    Id          INTEGER PRIMARY KEY AUTOINCREMENT,
    QuandoUtc   TEXT NOT NULL,
    Tipo        INTEGER NOT NULL,
    UsuarioId   INTEGER NOT NULL,
    Detalhe     TEXT NOT NULL,
    Origem      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS Pedidos (
    Id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    UsuarioId           INTEGER NOT NULL,
    QuandoUtc           TEXT NOT NULL,
    MinutosSolicitados  INTEGER NOT NULL,
    Mensagem            TEXT NOT NULL,
    Situacao            INTEGER NOT NULL,
    MinutosConcedidos   INTEGER NOT NULL,
    RespondidoUtc       TEXT NULL,
    FOREIGN KEY (UsuarioId) REFERENCES Usuarios(Id)
);

CREATE TABLE IF NOT EXISTS Configuracao (
    Id              INTEGER PRIMARY KEY,
    SenhaAdminHash  TEXT NOT NULL,
    PortaWeb        INTEGER NOT NULL,
    UsarHttps       INTEGER NOT NULL,
    AtalhoEmergencia TEXT NOT NULL,
    AvisosMinutos   TEXT NOT NULL,
    AvisoSonoro     INTEGER NOT NULL,
    NotificacoesPush INTEGER NOT NULL,
    BackupAutomatico INTEGER NOT NULL,
    HashIntegridade TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_sessoes_usuario ON Sessoes(UsuarioId, InicioUtc);
CREATE INDEX IF NOT EXISTS ix_eventos_quando ON Eventos(QuandoUtc);
CREATE INDEX IF NOT EXISTS ix_pedidos_situacao ON Pedidos(Situacao);
";
        cmd.ExecuteNonQuery();
    }
}
