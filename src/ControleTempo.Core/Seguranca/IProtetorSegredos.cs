namespace ControleTempo.Core.Seguranca;

/// <summary>
/// Protege valores sensíveis em repouso (ex.: a chave de integridade do banco,
/// tokens de notificação). A implementação em produção usa a DPAPI do Windows
/// (vinculada à máquina), de modo que copiar os arquivos para outro PC não
/// revela os segredos. Mantida como interface para o Core continuar portável e
/// testável fora do Windows.
/// </summary>
public interface IProtetorSegredos
{
    /// <summary>Cifra um texto e devolve Base64.</summary>
    string Proteger(string textoPuro);

    /// <summary>Decifra um Base64 produzido por <see cref="Proteger"/>.</summary>
    string Desproteger(string protegidoBase64);
}

/// <summary>
/// Implementação de desenvolvimento/portável: NÃO cifra de verdade (apenas
/// transporta em Base64). Serve para testes fora do Windows. Em produção,
/// registre a implementação baseada em DPAPI (ProtetorDpapi no projeto Service).
/// </summary>
public sealed class ProtetorSemCifra : IProtetorSegredos
{
    public string Proteger(string textoPuro) =>
        Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(textoPuro ?? string.Empty));

    public string Desproteger(string protegidoBase64)
    {
        if (string.IsNullOrEmpty(protegidoBase64)) return string.Empty;
        try { return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(protegidoBase64)); }
        catch (FormatException) { return string.Empty; }
    }
}
