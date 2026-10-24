namespace ControleTempo.Core.Servicos;

/// <summary>
/// Caminhos e constantes padrão do sistema. Os dados ficam em %ProgramData%
/// (fora do perfil do usuário comum), de modo que uma criança sem direitos de
/// administrador não consiga apagar ou editar o banco e os arquivos de config.
/// A permissão NTFS dessa pasta deve ser restringida na instalação (ver README).
/// </summary>
public static class Caminhos
{
    public const string NomePasta = "ControleTempo";

    /// <summary>%ProgramData%\ControleTempo (ou equivalente fora do Windows, para testes).</summary>
    public static string PastaDados
    {
        get
        {
            string baseDir = Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData);
            if (string.IsNullOrEmpty(baseDir))
                baseDir = Path.Combine(Path.GetTempPath(), "ControleTempoDev");
            return Path.Combine(baseDir, NomePasta);
        }
    }

    public static string ArquivoBanco => Path.Combine(PastaDados, "dados.db");
    public static string PastaBackup => Path.Combine(PastaDados, "backups");
    public static string PastaLogs => Path.Combine(PastaDados, "logs");

    /// <summary>Nome do named pipe de IPC entre serviço e overlay/recovery.</summary>
    public const string PipeIpc = "ControleTempo.Ipc";

    public static void GarantirPastas()
    {
        Directory.CreateDirectory(PastaDados);
        Directory.CreateDirectory(PastaBackup);
        Directory.CreateDirectory(PastaLogs);
    }
}
