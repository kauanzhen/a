using System.IO;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using ControleTempo.Core.Contratos;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Overlay;

/// <summary>
/// Cliente HTTP que o overlay usa para falar com a API local do serviço
/// (loopback). Descobre o endereço lendo o arquivo endpoint.txt publicado pelo
/// serviço. Como o certificado HTTPS é autoassinado e o destino é 127.0.0.1,
/// aceitamos o certificado local explicitamente (apenas para loopback).
/// </summary>
internal sealed class ClienteServico
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions _json = new(JsonSerializerDefaults.Web);

    public string BaseUrl { get; private set; } = "http://127.0.0.1:8443";

    public ClienteServico()
    {
        LerEndpoint();
        var handler = new HttpClientHandler
        {
            // Confia apenas no certificado do próprio serviço em loopback.
            ServerCertificateCustomValidationCallback = (_, _, _, _) => true
        };
        _http = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(4), BaseAddress = new Uri(BaseUrl) };
    }

    private void LerEndpoint()
    {
        try
        {
            string arquivo = Path.Combine(Caminhos.PastaDados, "endpoint.txt");
            if (File.Exists(arquivo))
            {
                string conteudo = File.ReadAllText(arquivo).Trim();
                if (!string.IsNullOrWhiteSpace(conteudo)) BaseUrl = conteudo;
            }
        }
        catch { /* usa o padrão */ }
    }

    public async Task<PacoteOverlay?> ObterPacoteAsync()
    {
        try { return await _http.GetFromJsonAsync<PacoteOverlay>("/api/overlay/pacote", _json); }
        catch { return null; }
    }

    public async Task BatimentoAsync(int segundosInativo, string? senhaReauth = null)
    {
        try
        {
            await _http.PostAsJsonAsync("/api/overlay/batimento",
                new BatimentoOverlay { SegundosInativo = segundosInativo, SenhaReautenticacao = senhaReauth }, _json);
        }
        catch { /* serviço pode estar reiniciando; tenta de novo no próximo tique */ }
    }

    public async Task<(bool ok, string msg)> LoginAsync(string nome, string senha)
    {
        try
        {
            var r = await _http.PostAsJsonAsync("/api/overlay/login", new { nome, senha }, _json);
            var j = await r.Content.ReadFromJsonAsync<RespostaOk>(_json);
            return (j?.Ok ?? false, j?.Msg ?? "Falha.");
        }
        catch { return (false, "Serviço indisponível."); }
    }

    public async Task<(bool ok, string msg)> ReautenticarAsync(string senha)
    {
        try
        {
            var r = await _http.PostAsJsonAsync("/api/overlay/batimento",
                new BatimentoOverlay { SegundosInativo = 0, SenhaReautenticacao = senha }, _json);
            var j = await r.Content.ReadFromJsonAsync<RespostaOk>(_json);
            return (j?.Ok ?? false, j?.Msg ?? "Falha.");
        }
        catch { return (false, "Serviço indisponível."); }
    }

    public async Task PedirTempoAsync(int minutos, string mensagem)
    {
        try { await _http.PostAsJsonAsync("/api/overlay/pedir-tempo", new { minutos, mensagem }, _json); }
        catch { }
    }

    public async Task<List<string>> ListarNomesAsync()
    {
        try { return await _http.GetFromJsonAsync<List<string>>("/api/overlay/usuarios", _json) ?? new(); }
        catch { return new(); }
    }

    private sealed record RespostaOk(bool Ok, string? Msg);
}
