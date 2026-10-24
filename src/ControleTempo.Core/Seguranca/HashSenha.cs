using System.Security.Cryptography;

namespace ControleTempo.Core.Seguranca;

/// <summary>
/// Hash de senhas com PBKDF2 (SHA-256) e sal aleatório por senha.
///
/// Nota de projeto: o artefato sugere bcrypt/Argon2. PBKDF2 está embutido no .NET
/// (sem dependência nativa), o que simplifica o build e a manutenção, e com um
/// número alto de iterações oferece proteção adequada para uso doméstico. Se
/// preferir Argon2, basta trocar esta classe por uma que use o pacote
/// "Konscious.Security.Cryptography.Argon2" mantendo a mesma interface pública.
///
/// Formato armazenado: "iteracoes.salBase64.hashBase64".
/// </summary>
public static class HashSenha
{
    private const int Iteracoes = 210_000; // recomendação OWASP para PBKDF2-SHA256
    private const int TamanhoSal = 16;      // 128 bits
    private const int TamanhoHash = 32;     // 256 bits

    /// <summary>Gera o hash de uma senha em texto puro.</summary>
    public static string Gerar(string senha)
    {
        if (string.IsNullOrEmpty(senha))
            throw new ArgumentException("Senha vazia não é permitida.", nameof(senha));

        byte[] sal = RandomNumberGenerator.GetBytes(TamanhoSal);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            senha, sal, Iteracoes, HashAlgorithmName.SHA256, TamanhoHash);

        return $"{Iteracoes}.{Convert.ToBase64String(sal)}.{Convert.ToBase64String(hash)}";
    }

    /// <summary>
    /// Verifica uma senha contra o hash armazenado, com comparação em tempo
    /// constante para não vazar informação por tempo de resposta.
    /// </summary>
    public static bool Verificar(string senha, string hashArmazenado)
    {
        if (string.IsNullOrEmpty(senha) || string.IsNullOrEmpty(hashArmazenado))
            return false;

        string[] partes = hashArmazenado.Split('.', 3);
        if (partes.Length != 3) return false;

        if (!int.TryParse(partes[0], out int iteracoes)) return false;
        byte[] sal, esperado;
        try
        {
            sal = Convert.FromBase64String(partes[1]);
            esperado = Convert.FromBase64String(partes[2]);
        }
        catch (FormatException)
        {
            return false;
        }

        byte[] calculado = Rfc2898DeriveBytes.Pbkdf2(
            senha, sal, iteracoes, HashAlgorithmName.SHA256, esperado.Length);

        return CryptographicOperations.FixedTimeEquals(calculado, esperado);
    }
}
