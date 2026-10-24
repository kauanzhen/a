using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Nucleo;

/// <summary>
/// Gera e reutiliza um certificado HTTPS autoassinado para o painel local, de
/// modo que a senha do admin não trafegue em texto puro na rede Wi-Fi. O
/// certificado é criado uma vez e guardado (.pfx) na pasta de dados protegida.
///
/// Observação: por ser autoassinado, o Firefox mostrará um aviso de "conexão não
/// segura" na primeira vez — basta aceitar a exceção (é a sua própria rede/PC).
/// Instruções no README.
/// </summary>
public static class CertificadoLocal
{
    public static X509Certificate2 GerarOuCarregar()
    {
        string caminhoPfx = Path.Combine(Caminhos.PastaDados, "painel.pfx");
        const string senhaPfx = "controle-tempo-local"; // protege apenas o arquivo local

        if (File.Exists(caminhoPfx))
        {
            try { return new X509Certificate2(caminhoPfx, senhaPfx, X509KeyStorageFlags.Exportable); }
            catch { /* recria se corrompido */ }
        }

        using var rsa = RSA.Create(2048);
        var pedido = new CertificateRequest(
            "CN=ControleTempo Painel Local", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        // Marca como certificado de servidor TLS.
        pedido.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, false));
        pedido.CertificateExtensions.Add(new X509KeyUsageExtension(
            X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, false));
        pedido.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(
            new OidCollection { new Oid("1.3.6.1.5.5.7.3.1") }, false)); // Server Authentication

        // Nomes alternativos: localhost e o IP da máquina na rede local.
        var san = new SubjectAlternativeNameBuilder();
        san.AddDnsName("localhost");
        san.AddDnsName(Environment.MachineName);
        foreach (var ip in RedeLocal.ObterIpsLocais())
            san.AddIpAddress(ip);
        pedido.CertificateExtensions.Add(san.Build());

        var cert = pedido.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddYears(5));

        byte[] pfx = cert.Export(X509ContentType.Pfx, senhaPfx);
        File.WriteAllBytes(caminhoPfx, pfx);
        return new X509Certificate2(pfx, senhaPfx, X509KeyStorageFlags.Exportable);
    }
}
