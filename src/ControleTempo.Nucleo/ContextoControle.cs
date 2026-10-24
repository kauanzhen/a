using System.Collections.Concurrent;
using System.Security.Cryptography;
using ControleTempo.Core.Contratos;
using ControleTempo.Core.Dados;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Seguranca;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Nucleo;

/// <summary>
/// Estado compartilhado e vivo do processo: a única instância do motor, do
/// repositório e do relógio confiável, além da ponte entre o serviço e o overlay
/// (comando pendente, último batimento de atividade e aviso pendente). É
/// registrado como singleton e usado tanto pelo worker (que conta o tempo) quanto
/// pelos endpoints web.
/// </summary>
public sealed class ContextoControle
{
    private readonly object _trava = new();

    public BancoDados Banco { get; }
    public Repositorio Repo { get; }
    public RelogioConfiavel Relogio { get; }
    public MotorTempo Motor { get; }
    public VerificadorIntegridade Integridade { get; }

    // --- Ponte serviço <-> overlay ---
    private ComandoOverlay _comandoPendente = ComandoOverlay.Nenhum;
    private string _avisoPendente = string.Empty;
    private int _idleReportado;
    private DateTime _ultimoBatimentoUtc = DateTime.MinValue;

    // --- Sessões de admin autenticado (token -> expira em) ---
    private readonly ConcurrentDictionary<string, DateTime> _tokensAdmin = new();

    public ContextoControle()
    {
        Caminhos.GarantirPastas();
        Banco = new BancoDados(Caminhos.ArquivoBanco);
        Banco.GarantirEsquema();
        Repo = new Repositorio(Banco);
        Relogio = new RelogioConfiavel();
        Motor = new MotorTempo(Repo, Relogio);

        // A chave de integridade é derivada de um segredo da máquina. Em produção,
        // o ProtetorDpapi protege esse segredo; aqui usamos um valor por máquina.
        string segredoMaquina = Environment.MachineName + "|ControleTempo";
        Integridade = new VerificadorIntegridade(Repo, Caminhos.ArquivoBanco, segredoMaquina);
    }

    // ============================================================
    //  BATIMENTO / ATIVIDADE (reportado pelo overlay)
    // ============================================================

    public void RegistrarBatimento(int segundosInativo)
    {
        lock (_trava)
        {
            _idleReportado = Math.Max(0, segundosInativo);
            _ultimoBatimentoUtc = Relogio.AgoraUtc;
        }
    }

    /// <summary>
    /// Houve atividade do usuário desde o último tique? Se o overlay estiver mudo
    /// (morto/fechado) por mais de 8s, assumimos ATIVIDADE — assim fechar o overlay
    /// não pausa a contagem nem rende tempo de graça.
    /// </summary>
    public bool HouveAtividade()
    {
        lock (_trava)
        {
            bool batimentoRecente = (Relogio.AgoraUtc - _ultimoBatimentoUtc).TotalSeconds <= 8;
            if (!batimentoRecente) return true;
            return _idleReportado < 2;
        }
    }

    public int SegundosInativoReportado { get { lock (_trava) return _idleReportado; } }

    // ============================================================
    //  COMANDO PARA O OVERLAY
    // ============================================================

    public void DefinirComando(ComandoOverlay comando)
    {
        lock (_trava) _comandoPendente = comando;
    }

    public void DefinirAviso(string aviso)
    {
        lock (_trava) _avisoPendente = aviso ?? string.Empty;
    }

    /// <summary>Monta o pacote que o overlay busca (estado + comando + aviso).</summary>
    public PacoteOverlay MontarPacote()
    {
        lock (_trava)
        {
            var cfg = Repo.ObterConfig();
            // O aviso é entregue uma única vez.
            string aviso = _avisoPendente;
            _avisoPendente = string.Empty;

            // Deriva o comando a partir do estado quando o motor acabou de bloquear.
            var comando = _comandoPendente;
            return new PacoteOverlay
            {
                Estado = Motor.EstadoAtual(), // snapshot somente-leitura (não consome tempo)
                Comando = comando,
                Aviso = aviso,
                AvisoSonoro = cfg?.AvisoSonoro ?? true
            };
        }
    }

    public ComandoOverlay ConsumirComando()
    {
        lock (_trava)
        {
            var c = _comandoPendente;
            if (c == ComandoOverlay.Logoff || c == ComandoOverlay.Suspender || c == ComandoOverlay.Desligar)
                _comandoPendente = ComandoOverlay.Nenhum; // ações pontuais consomem
            return c;
        }
    }

    // ============================================================
    //  AUTENTICAÇÃO DO ADMIN
    // ============================================================

    public bool ValidarSenhaAdmin(string senha)
    {
        var cfg = Repo.ObterConfig();
        return cfg is not null && HashSenha.Verificar(senha, cfg.SenhaAdminHash);
    }

    public string CriarTokenAdmin()
    {
        string token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        _tokensAdmin[token] = DateTime.UtcNow.AddHours(8);
        return token;
    }

    public bool TokenValido(string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;
        if (_tokensAdmin.TryGetValue(token, out var exp))
        {
            if (exp > DateTime.UtcNow) return true;
            _tokensAdmin.TryRemove(token, out _);
        }
        return false;
    }

    public void RevogarToken(string? token)
    {
        if (!string.IsNullOrEmpty(token)) _tokensAdmin.TryRemove(token, out _);
    }
}
