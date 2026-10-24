using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace ControleTempo.Nucleo;

/// <summary>
/// Descoberta do IP da máquina na rede local, para montar a URL que o admin usa
/// no celular (ex.: https://192.168.0.10:8443) e para o certificado HTTPS.
/// </summary>
public static class RedeLocal
{
    /// <summary>Lista os endereços IPv4 ativos e não-loopback da máquina.</summary>
    public static List<IPAddress> ObterIpsLocais()
    {
        var lista = new List<IPAddress>();
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                foreach (var ua in ni.GetIPProperties().UnicastAddresses)
                {
                    if (ua.Address.AddressFamily == AddressFamily.InterNetwork &&
                        !IPAddress.IsLoopback(ua.Address))
                        lista.Add(ua.Address);
                }
            }
        }
        catch { /* ambiente sem rede: ignora */ }
        return lista;
    }

    /// <summary>IP "preferido" para exibir ao admin (o primeiro privado encontrado).</summary>
    public static string IpPreferido()
    {
        var ips = ObterIpsLocais();
        var privado = ips.FirstOrDefault(ip =>
        {
            var b = ip.GetAddressBytes();
            return b[0] == 192 && b[1] == 168 || b[0] == 10 || (b[0] == 172 && b[1] >= 16 && b[1] <= 31);
        });
        return (privado ?? ips.FirstOrDefault())?.ToString() ?? "127.0.0.1";
    }
}
