using System.Media;
using System.Windows;
using System.Windows.Threading;
using ControleTempo.Core.Contratos;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Overlay;

/// <summary>
/// Ponto de entrada e orquestração do overlay. A cada segundo: mede a
/// inatividade, envia o batimento ao serviço, busca o pacote (estado + comando)
/// e atualiza as janelas (timer e bloqueio), executando logoff/suspender/
/// desligar quando ordenado.
/// </summary>
internal sealed class Programa : Application
{
    private readonly ClienteServico _cliente = new();
    private JanelaTimer _timer = null!;
    private JanelaBloqueio _bloqueio = null!;
    private DispatcherTimer _tique = null!;
    private EstadoMaquina _ultimoEstado = (EstadoMaquina)(-1);
    private bool _bloqueioVisivel;

    [STAThread]
    public static void Main()
    {
        var app = new Programa();
        app.Run();
    }

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        _timer = new JanelaTimer();
        _bloqueio = new JanelaBloqueio(_cliente);
        _timer.Show();

        _tique = new DispatcherTimer { Interval = TimeSpan.FromSeconds(1) };
        _tique.Tick += async (_, _) =>
        {
            try { await PassoAsync(); }
            catch { /* erro transitório (serviço reiniciando): tenta no próximo tique */ }
        };
        _tique.Start();
    }

    private async Task PassoAsync()
    {
        int inativo = Win32.SegundosInativo();
        await _cliente.BatimentoAsync(inativo);

        var pacote = await _cliente.ObterPacoteAsync();
        if (pacote is null) return; // serviço indisponível: mantém estado atual

        // Sistema desativado em emergência: esconde tudo, PC liberado.
        if (pacote.SistemaDesativado)
        {
            EsconderBloqueio();
            _ultimoEstado = (EstadoMaquina)(-1); // força reavaliação ao reativar
            _timer.Atualizar("Controle desativado", "livre", FaixaCor.Verde, false);
            _timer.Reafirmar();
            return;
        }

        AtualizarTimer(pacote);
        TratarEstadoEComando(pacote);
        MostrarAvisoSeHouver(pacote);

        _timer.Reafirmar();
    }

    private void AtualizarTimer(PacoteOverlay p)
    {
        var e = p.Estado;
        if (e.UsuarioId is null)
        {
            _timer.Atualizar("Aguardando login", "--:--", FaixaCor.Verde, false);
        }
        else
        {
            _timer.Atualizar(e.NomeUsuario, e.RestanteFormatado, e.Cor, e.ContagemPausada);
        }
    }

    private void TratarEstadoEComando(PacoteOverlay p)
    {
        // Comandos pontuais têm prioridade.
        switch (p.Comando)
        {
            case ComandoOverlay.Logoff: Win32.Logoff(); return;
            case ComandoOverlay.Desligar: Win32.Desligar(); return;
            case ComandoOverlay.Suspender: Win32.Suspender(); return;
            case ComandoOverlay.LiberarTela: EsconderBloqueio(); break;
            case ComandoOverlay.MostrarBloqueio: MostrarBloqueio("🔒 Bloqueado\nDigite a senha para continuar"); break;
        }

        // A tela de bloqueio/login também segue o ESTADO reportado.
        var estado = p.Estado.Estado;
        if (estado != _ultimoEstado)
        {
            _ultimoEstado = estado;
            switch (estado)
            {
                case EstadoMaquina.Ocioso:
                    MostrarLogin();
                    break;
                case EstadoMaquina.Bloqueado:
                    MostrarBloqueio("⏳ Tempo esgotado\nDigite a senha para continuar (se houver saldo)");
                    break;
                case EstadoMaquina.EmUso:
                case EstadoMaquina.Pausado:
                    EsconderBloqueio();
                    break;
            }
        }
    }

    private void MostrarLogin()
    {
        if (_bloqueioVisivel && _bloqueio.ModoLogin) return;
        _bloqueio.ConfigurarLogin();
        ExibirBloqueio();
    }

    private void MostrarBloqueio(string titulo)
    {
        if (_bloqueioVisivel && !_bloqueio.ModoLogin) return;
        _bloqueio.ConfigurarBloqueio(titulo);
        ExibirBloqueio();
    }

    private void ExibirBloqueio()
    {
        _bloqueio.Show();
        _bloqueio.Activate();
        _bloqueio.Topmost = true;
        _bloqueioVisivel = true;
    }

    private void EsconderBloqueio()
    {
        if (!_bloqueioVisivel) return;
        _bloqueio.Hide();
        _bloqueioVisivel = false;
    }

    private void MostrarAvisoSeHouver(PacoteOverlay p)
    {
        if (string.IsNullOrEmpty(p.Aviso)) return;
        if (p.AvisoSonoro) { try { SystemSounds.Exclamation.Play(); } catch { } }
        // Aviso curto no canto, reusando o título do timer via um balão simples.
        Balao.Mostrar(p.Aviso);
    }
}
