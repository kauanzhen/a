using System.Security.Cryptography;
using ControleTempo.Core.Dados;
using ControleTempo.Core.Modelos;

namespace ControleTempo.Core.Servicos;

/// <summary>
/// Detecta adulteração externa do banco de dados (ex.: a criança abre o arquivo
/// SQLite e edita o próprio saldo). A ideia: ao PARAR, o serviço assina o estado
/// do arquivo com HMAC-SHA256 (chave protegida pela máquina) e guarda a
/// assinatura; ao INICIAR, recalcula e compara. Se o arquivo foi alterado com o
/// serviço parado, a assinatura não bate e registramos IntegridadeViolada e
/// alertamos no painel.
///
/// Observação: isto complementa — não substitui — a proteção de permissões NTFS
/// da pasta e a cifragem em repouso (SQLCipher/EFS). É mais uma camada.
/// </summary>
public sealed class VerificadorIntegridade
{
    private readonly Repositorio _repo;
    private readonly string _caminhoBanco;
    private readonly byte[] _chave;

    public VerificadorIntegridade(Repositorio repo, string caminhoBanco, string chaveSegreda)
    {
        _repo = repo;
        _caminhoBanco = caminhoBanco;
        // Deriva uma chave estável de 256 bits a partir do segredo da máquina.
        _chave = SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(chaveSegreda));
    }

    private string CalcularAssinatura()
    {
        if (!File.Exists(_caminhoBanco)) return string.Empty;
        using var hmac = new HMACSHA256(_chave);
        using var fs = File.OpenRead(_caminhoBanco);
        return Convert.ToBase64String(hmac.ComputeHash(fs));
    }

    /// <summary>Grava a assinatura do estado atual (chamar ao parar o serviço).</summary>
    public void Assinar()
    {
        var cfg = _repo.ObterConfig();
        if (cfg is null) return;
        cfg.HashIntegridade = CalcularAssinatura();
        _repo.SalvarConfig(cfg);
    }

    /// <summary>
    /// Verifica a assinatura (chamar ao iniciar o serviço). Retorna true se íntegro
    /// ou se ainda não havia assinatura (primeira execução). Em caso de violação,
    /// registra o evento.
    /// </summary>
    public bool Verificar()
    {
        var cfg = _repo.ObterConfig();
        if (cfg is null || string.IsNullOrEmpty(cfg.HashIntegridade))
            return true; // primeira execução: nada a comparar

        // A assinatura é gravada DENTRO do próprio banco, então ao recalcular o
        // arquivo muda. Por isso comparamos a assinatura de forma tolerante:
        // reconstituímos o estado "sem o campo de hash" não é trivial em arquivo
        // binário; aqui usamos a estratégia de guardar a assinatura em arquivo
        // separado para uma checagem exata.
        string arquivoAssinatura = _caminhoBanco + ".sig";
        if (!File.Exists(arquivoAssinatura)) return true;

        string esperada = File.ReadAllText(arquivoAssinatura).Trim();
        string atual = CalcularAssinatura();
        bool ok = CryptographicOperations.FixedTimeEquals(
            System.Text.Encoding.UTF8.GetBytes(esperada),
            System.Text.Encoding.UTF8.GetBytes(atual));

        if (!ok)
            _repo.Registrar(TipoEvento.IntegridadeViolada, 0,
                "Assinatura do banco não confere: possível edição externa do arquivo.");
        return ok;
    }

    /// <summary>Grava a assinatura em arquivo .sig separado (checagem exata).</summary>
    public void AssinarArquivoSeparado()
    {
        string arquivoAssinatura = _caminhoBanco + ".sig";
        File.WriteAllText(arquivoAssinatura, CalcularAssinatura());
    }
}
