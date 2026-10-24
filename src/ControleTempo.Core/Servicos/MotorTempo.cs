using System.Globalization;
using ControleTempo.Core.Dados;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Seguranca;

namespace ControleTempo.Core.Servicos;

/// <summary>
/// Resultado de um "tique" do motor: o estado atual mais eventuais ações que o
/// serviço precisa executar no sistema operacional (bloquear, logoff, etc.).
/// </summary>
public sealed record ResultadoTick
{
    public EstadoSessao Estado { get; init; } = new();

    /// <summary>Se preenchido, o serviço deve aplicar esta ação (limite atingido).</summary>
    public AcaoAoEsgotar? AcaoAplicar { get; init; }

    /// <summary>Aviso recém-disparado para mostrar no overlay/painel (ex.: "5 minutos").</summary>
    public string? AvisoNovo { get; init; }

    public bool SaltoRelogioDetectado { get; init; }
}

/// <summary>
/// Núcleo funcional do controle de tempo e créditos. É agnóstico ao sistema
/// operacional: apenas contabiliza o tempo (com relógio confiável), aplica as
/// regras por usuário e DECIDE o que fazer; quem executa logoff/bloqueio/etc. é
/// o serviço do Windows. Toda a contagem roda aqui (no núcleo), nunca no overlay
/// — assim, ocultar ou fechar o overlay não pausa nem zera o relógio.
///
/// Thread-safe: o serviço chama <see cref="Tique"/> periodicamente e o painel web
/// chama os comandos administrativos de outra thread.
/// </summary>
public sealed class MotorTempo
{
    private readonly Repositorio _repo;
    private readonly RelogioConfiavel _relogio;
    private readonly object _trava = new();

    private Usuario? _usuario;
    private int _sessaoId;
    private EstadoMaquina _estado = EstadoMaquina.Ocioso;
    private bool _pausado;
    private bool _pausadoPorInatividade;

    private double _acumuladorConsumo;   // segundos fracionários ainda não debitados
    private double _idleSegundos;        // tempo sem atividade acumulado
    private int _consumidoSessao;        // segundos consumidos na sessão corrente
    private double _desdeUltimaGravacao;  // controla a persistência periódica
    private bool _esgotado;               // evita redisparar a ação ao esgotar
    private readonly HashSet<int> _avisosDisparados = new();

    public MotorTempo(Repositorio repo, RelogioConfiavel relogio)
    {
        _repo = repo;
        _relogio = relogio;
    }

    public EstadoMaquina Estado { get { lock (_trava) return _estado; } }
    public int? UsuarioLogadoId { get { lock (_trava) return _usuario?.Id; } }

    /// <summary>
    /// Snapshot SOMENTE-LEITURA do estado, sem avançar o relógio nem consumir
    /// tempo. É o que o overlay e o painel usam para exibir. A contagem ocorre
    /// apenas em <see cref="Tique"/>, chamado pelo worker do serviço.
    /// </summary>
    public EstadoSessao EstadoAtual()
    {
        lock (_trava) return Snapshot();
    }

    // ============================================================
    //  LOGIN / REAUTENTICAÇÃO
    // ============================================================

    /// <summary>
    /// Inicia a sessão de uma criança após validar senha, horário permitido e saldo.
    /// </summary>
    public (bool ok, string mensagem) IniciarSessao(string nome, string senha)
    {
        lock (_trava)
        {
            var u = _repo.ObterUsuarioPorNome(nome);
            if (u is null || !u.Ativo)
                return (false, "Usuário não encontrado.");
            if (u.Papel != Papel.Crianca)
                return (false, "Este perfil não inicia sessão de uso.");
            if (!HashSenha.Verificar(senha, u.SenhaHash))
            {
                _repo.Registrar(TipoEvento.FalhaLogin, u.Id, $"Senha incorreta para {u.Nome}.");
                return (false, "Senha incorreta.");
            }

            VirarDiaSeNecessario(u);

            if (!DentroDoHorario(u))
                return (false, "Fora do horário permitido de uso.");
            if (u.RestanteSegundos <= 0)
                return (false, "Sem tempo/crédito disponível. Peça mais ao responsável.");

            _usuario = u;
            _sessaoId = _repo.AbrirSessao(u.Id);
            _estado = EstadoMaquina.EmUso;
            _pausado = false;
            _pausadoPorInatividade = false;
            _acumuladorConsumo = 0;
            _idleSegundos = 0;
            _consumidoSessao = 0;
            _esgotado = false;
            _avisosDisparados.Clear();

            _repo.Registrar(TipoEvento.InicioSessao, u.Id, $"{u.Nome} iniciou sessão.");
            return (true, "Sessão iniciada.");
        }
    }

    /// <summary>
    /// Reautentica quando a sessão está bloqueada por esgotamento: só retoma se
    /// ainda houver saldo (ou se o admin liberou mais tempo).
    /// </summary>
    public (bool ok, string mensagem) Reautenticar(string senha)
    {
        lock (_trava)
        {
            if (_usuario is null) return (false, "Nenhuma sessão para retomar.");
            if (!HashSenha.Verificar(senha, _usuario.SenhaHash))
            {
                _repo.Registrar(TipoEvento.FalhaLogin, _usuario.Id, "Falha ao reautenticar.");
                return (false, "Senha incorreta.");
            }
            VirarDiaSeNecessario(_usuario);
            if (_usuario.RestanteSegundos <= 0)
                return (false, "Ainda sem tempo/crédito. Peça mais ao responsável.");

            _estado = EstadoMaquina.EmUso;
            _pausado = false;
            _esgotado = false;
            // A sessão anterior foi fechada no bloqueio; abre uma nova para o histórico.
            _sessaoId = _repo.AbrirSessao(_usuario.Id);
            _consumidoSessao = 0;
            _acumuladorConsumo = 0;
            _avisosDisparados.Clear();
            _repo.Registrar(TipoEvento.Desbloqueio, _usuario.Id, $"{_usuario.Nome} reautenticou.");
            return (true, "Sessão retomada.");
        }
    }

    // ============================================================
    //  TIQUE PERIÓDICO (chamado pelo serviço, ~1x/segundo)
    // ============================================================

    /// <param name="houveAtividade">Houve entrada do usuário (mouse/teclado) desde o último tique?</param>
    public ResultadoTick Tique(bool houveAtividade)
    {
        lock (_trava)
        {
            _relogio.Avancar(out double reais, out bool salto, out double segSalto);

            if (salto && _usuario is not null)
            {
                _repo.Registrar(TipoEvento.SaltoDeRelogio, _usuario.Id,
                    $"Salto de relógio de {segSalto:0}s ignorado (possível tentativa de burla).");
            }

            string? avisoNovo = null;
            AcaoAoEsgotar? acao = null;

            // Processa enquanto EmUso ou enquanto pausado AUTOMATICAMENTE por
            // inatividade (para poder retomar quando a atividade voltar). A pausa
            // MANUAL do admin não entra aqui e só sai com "Retomar".
            if (_usuario is not null &&
                (_estado == EstadoMaquina.EmUso ||
                 (_estado == EstadoMaquina.Pausado && _pausadoPorInatividade)))
            {
                VirarDiaSeNecessario(_usuario);

                // Fora do horário permitido => trata como esgotamento imediato (uma vez).
                if (!DentroDoHorario(_usuario))
                {
                    if (!_esgotado) { _esgotado = true; acao = EsgotarInterno("Fora do horário permitido."); }
                }
                else
                {
                    // Controle de inatividade: pausa automática se configurado.
                    if (houveAtividade) _idleSegundos = 0;
                    else _idleSegundos += reais;

                    bool deveInativar = _usuario.InatividadePausaSegundos > 0
                        && _idleSegundos >= _usuario.InatividadePausaSegundos;

                    if (deveInativar)
                    {
                        if (!_pausado) PausarInterno(porInatividade: true);
                    }
                    else
                    {
                        if (_pausado && _pausadoPorInatividade) RetomarInterno();

                        if (!_pausado)
                        {
                            // Debita o tempo efetivamente usado (inteiros de segundo).
                            _acumuladorConsumo += reais;
                            int debitar = (int)_acumuladorConsumo;
                            if (debitar > 0)
                            {
                                _acumuladorConsumo -= debitar;
                                Debitar(_usuario, debitar);
                                _consumidoSessao += debitar;
                            }

                            avisoNovo = VerificarAvisos(_usuario);

                            // Dispara a ação de esgotamento uma única vez (importante
                            // sobretudo no modo "apenas avisar", que mantém EmUso).
                            if (_usuario.RestanteSegundos <= 0 && !_esgotado)
                            {
                                _esgotado = true;
                                acao = EsgotarInterno("Tempo/crédito esgotado.");
                            }
                        }
                    }
                }

                // Persistência periódica (a cada ~10s) para sobreviver a desligamento na força.
                _desdeUltimaGravacao += reais;
                if (_desdeUltimaGravacao >= 10)
                {
                    _desdeUltimaGravacao = 0;
                    _repo.AtualizarUsuario(_usuario);
                }
            }

            return new ResultadoTick
            {
                Estado = Snapshot(),
                AcaoAplicar = acao,
                AvisoNovo = avisoNovo,
                SaltoRelogioDetectado = salto
            };
        }
    }

    // ============================================================
    //  COMANDOS ADMINISTRATIVOS (chamados pelo painel web)
    // ============================================================

    public void Pausar()
    {
        lock (_trava) { if (_estado == EstadoMaquina.EmUso) PausarInterno(false); }
    }

    public void Retomar()
    {
        lock (_trava) { if (_pausado) RetomarInterno(); }
    }

    public void BloquearAgora(string motivo)
    {
        lock (_trava)
        {
            if (_usuario is null) return;
            _repo.AtualizarUsuario(_usuario);
            _estado = EstadoMaquina.Bloqueado;
            _repo.Registrar(TipoEvento.Bloqueio, _usuario.Id, $"Bloqueio manual: {motivo}");
        }
    }

    public void LiberarAgora()
    {
        lock (_trava)
        {
            if (_usuario is null) return;
            if (_usuario.RestanteSegundos <= 0) return; // só libera se houver saldo
            _estado = EstadoMaquina.EmUso;
            _pausado = false;
            _esgotado = false;
            _avisosDisparados.Clear();
            _repo.Registrar(TipoEvento.Desbloqueio, _usuario.Id, "Liberação manual pelo admin.");
        }
    }

    /// <summary>Encerra a sessão corrente (logoff/fim de uso).</summary>
    public void EncerrarSessao(bool porEsgotamento)
    {
        lock (_trava)
        {
            if (_usuario is null) return;
            _repo.AtualizarUsuario(_usuario);
            if (_sessaoId > 0) _repo.FecharSessao(_sessaoId, _consumidoSessao, porEsgotamento);
            _repo.Registrar(TipoEvento.FimSessao, _usuario.Id,
                $"Sessão encerrada ({_consumidoSessao}s usados).");
            _usuario = null;
            _sessaoId = 0;
            _estado = EstadoMaquina.Ocioso;
            _pausado = false;
        }
    }

    /// <summary>Admin adiciona tempo/crédito (em segundos) ao usuário informado.</summary>
    public void AdicionarTempo(int usuarioId, int segundos, string origem = "web")
    {
        lock (_trava)
        {
            var u = (_usuario?.Id == usuarioId) ? _usuario : _repo.ObterUsuario(usuarioId);
            if (u is null || segundos <= 0) return;
            if (u.Modo == ModoControle.Creditos) u.SaldoCreditosSegundos += segundos;
            else u.ConsumidoHojeSegundos = Math.Max(0, u.ConsumidoHojeSegundos - segundos);
            _repo.AtualizarUsuario(u);
            // Se é o usuário em uso e voltou a ter saldo, rearmar avisos/esgotamento.
            if (_usuario?.Id == u.Id && u.RestanteSegundos > 0)
            {
                _esgotado = false;
                _avisosDisparados.Clear();
            }
            _repo.Registrar(u.Modo == ModoControle.Creditos ? TipoEvento.CreditoRecarregado : TipoEvento.TempoAdicionado,
                u.Id, $"+{segundos}s adicionados.", origem);
        }
    }

    /// <summary>Admin remove tempo/crédito (em segundos).</summary>
    public void RemoverTempo(int usuarioId, int segundos, string origem = "web")
    {
        lock (_trava)
        {
            var u = (_usuario?.Id == usuarioId) ? _usuario : _repo.ObterUsuario(usuarioId);
            if (u is null || segundos <= 0) return;
            if (u.Modo == ModoControle.Creditos) u.SaldoCreditosSegundos = Math.Max(0, u.SaldoCreditosSegundos - segundos);
            else u.ConsumidoHojeSegundos = Math.Min(u.LimiteDiarioSegundos, u.ConsumidoHojeSegundos + segundos);
            _repo.AtualizarUsuario(u);
            _repo.Registrar(TipoEvento.TempoRemovido, u.Id, $"-{segundos}s removidos.", origem);
        }
    }

    // ============================================================
    //  AUXILIARES INTERNOS (já dentro do lock)
    // ============================================================

    private void Debitar(Usuario u, int segundos)
    {
        if (u.Modo == ModoControle.Creditos)
            u.SaldoCreditosSegundos = Math.Max(0, u.SaldoCreditosSegundos - segundos);
        else
            u.ConsumidoHojeSegundos = Math.Min(u.LimiteDiarioSegundos, u.ConsumidoHojeSegundos + segundos);
    }

    private AcaoAoEsgotar EsgotarInterno(string motivo)
    {
        _repo.AtualizarUsuario(_usuario!);
        _repo.Registrar(TipoEvento.LimiteAtingido, _usuario!.Id, motivo);
        var acao = _usuario.AcaoAoEsgotar;
        // "Apenas avisar" não bloqueia; as demais ações levam a sessão a bloqueada.
        _estado = acao == AcaoAoEsgotar.ApenasAvisar ? EstadoMaquina.EmUso : EstadoMaquina.Bloqueado;
        if (_estado == EstadoMaquina.Bloqueado && _sessaoId > 0)
            _repo.FecharSessao(_sessaoId, _consumidoSessao, porEsgotamento: true);
        return acao;
    }

    private void PausarInterno(bool porInatividade)
    {
        _pausado = true;
        _pausadoPorInatividade = porInatividade;
        _estado = EstadoMaquina.Pausado;
        _repo.Registrar(TipoEvento.Pausa, _usuario?.Id ?? 0,
            porInatividade ? "Pausa automática por inatividade." : "Pausa manual.");
    }

    private void RetomarInterno()
    {
        _pausado = false;
        _pausadoPorInatividade = false;
        _estado = EstadoMaquina.EmUso;
        _idleSegundos = 0;
        _repo.Registrar(TipoEvento.Retomada, _usuario?.Id ?? 0, "Contagem retomada.");
    }

    private void VirarDiaSeNecessario(Usuario u)
    {
        if (u.Modo != ModoControle.TempoLimite) return;
        string hoje = _relogio.AgoraLocal.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        if (u.DataConsumo != hoje)
        {
            u.ConsumidoHojeSegundos = 0;
            u.DataConsumo = hoje;
            _repo.AtualizarUsuario(u);
        }
    }

    /// <summary>Dispara o próximo aviso de "tempo acabando" ainda não mostrado.</summary>
    private string? VerificarAvisos(Usuario u)
    {
        var cfg = _repo.ObterConfig();
        if (cfg is null) return null;
        int restanteMin = u.RestanteSegundos / 60;
        foreach (var marco in cfg.AvisosMinutos.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            if (!int.TryParse(marco.Trim(), out int m)) continue;
            if (restanteMin < m || _avisosDisparados.Contains(m)) continue;
            // Só dispara quando cruza o marco (resta exatamente ou acabou de cruzar).
            if (restanteMin == m)
            {
                _avisosDisparados.Add(m);
                return $"Faltam {m} minuto(s).";
            }
        }
        return null;
    }

    private bool DentroDoHorario(Usuario u)
    {
        if (string.IsNullOrWhiteSpace(u.HorariosPermitidos)) return true;
        var agora = _relogio.AgoraLocal.TimeOfDay;
        foreach (var janela in u.HorariosPermitidos.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            var p = janela.Split('-');
            if (p.Length != 2) continue;
            if (TimeSpan.TryParse(p[0], out var ini) && TimeSpan.TryParse(p[1], out var fim))
            {
                if (fim > ini && agora >= ini && agora <= fim) return true;
                if (fim < ini && (agora >= ini || agora <= fim)) return true; // janela cruzando meia-noite
            }
        }
        return false;
    }

    private EstadoSessao Snapshot()
    {
        if (_usuario is null)
            return new EstadoSessao { Estado = _estado, AtualizadoUtc = _relogio.AgoraUtc };

        int restante = _usuario.RestanteSegundos;
        return new EstadoSessao
        {
            Estado = _estado,
            UsuarioId = _usuario.Id,
            NomeUsuario = _usuario.Nome,
            Modo = _usuario.Modo,
            RestanteSegundos = restante,
            Cor = CorPara(restante),
            ContagemPausada = _pausado,
            AtualizadoUtc = _relogio.AgoraUtc
        };
    }

    /// <summary>Mapeia o tempo restante para a faixa de cor do overlay.</summary>
    public static FaixaCor CorPara(int restanteSegundos)
    {
        int min = restanteSegundos / 60;
        if (min >= 15) return FaixaCor.Verde;
        if (min >= 5) return FaixaCor.Amarelo;
        if (min >= 1) return FaixaCor.Laranja;
        return FaixaCor.Vermelho;
    }
}
