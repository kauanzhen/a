using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace ControleTempo.Overlay;

/// <summary>
/// Tela cheia que cobre o desktop para (1) a criança iniciar a sessão (login) ou
/// (2) reautenticar quando o tempo esgota/o admin bloqueia. É topmost e sem
/// borda. Observação honesta: um aplicativo em modo usuário não consegue impedir
/// 100% dos atalhos do Windows (ex.: Ctrl+Alt+Del); a aplicação efetiva da regra
/// é do serviço (que continua contando e pode fazer logoff). Esta tela é a
/// barreira visual e o ponto de reautenticação.
/// </summary>
internal sealed class JanelaBloqueio : Window
{
    private readonly ClienteServico _cliente;
    private readonly TextBlock _titulo;
    private readonly ComboBox _nomes;
    private readonly PasswordBox _senha;
    private readonly TextBlock _mensagem;
    private readonly Button _entrar;
    private readonly Button _pedir;

    public bool ModoLogin { get; private set; }
    private bool _permitirFechar;

    public JanelaBloqueio(ClienteServico cliente)
    {
        _cliente = cliente;
        WindowStyle = WindowStyle.None;
        WindowState = WindowState.Maximized;
        ResizeMode = ResizeMode.NoResize;
        Topmost = true;
        ShowInTaskbar = false;
        Background = new SolidColorBrush(Color.FromRgb(15, 23, 42));

        _titulo = new TextBlock
        {
            Foreground = Brushes.White, FontSize = 30, FontWeight = FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 0, 0, 24),
            TextAlignment = TextAlignment.Center
        };

        _nomes = new ComboBox { Width = 320, FontSize = 18, Margin = new Thickness(0, 6, 0, 6), Height = 40 };
        _senha = new PasswordBox { Width = 320, FontSize = 18, Margin = new Thickness(0, 6, 0, 6), Height = 40, Padding = new Thickness(6) };
        _senha.KeyDown += (_, e) => { if (e.Key == Key.Enter) Confirmar(); };

        _entrar = Botao("Entrar", Color.FromRgb(59, 130, 246));
        _entrar.Click += (_, _) => Confirmar();

        _pedir = Botao("Pedir mais tempo", Color.FromRgb(51, 65, 85));
        _pedir.Click += (_, _) => PedirTempo();

        _mensagem = new TextBlock
        {
            Foreground = new SolidColorBrush(Color.FromRgb(248, 113, 113)), FontSize = 15,
            HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 14, 0, 0),
            TextAlignment = TextAlignment.Center, MinHeight = 22
        };

        var pilha = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center };
        pilha.Children.Add(_titulo);
        pilha.Children.Add(_nomes);
        pilha.Children.Add(_senha);
        pilha.Children.Add(_entrar);
        pilha.Children.Add(_pedir);
        pilha.Children.Add(_mensagem);
        Content = pilha;

        // Bloqueia Alt+F4 (dentro do possível) enquanto esta tela está ativa.
        Closing += (_, e) => { if (!_permitirFechar) e.Cancel = true; };
    }

    private static Button Botao(string texto, Color cor) => new()
    {
        Content = texto, Width = 320, Height = 44, Margin = new Thickness(0, 6, 0, 0),
        FontSize = 16, FontWeight = FontWeights.SemiBold, Foreground = Brushes.White,
        Background = new SolidColorBrush(cor), BorderThickness = new Thickness(0), Cursor = Cursors.Hand
    };

    /// <summary>Configura a tela como login (iniciar sessão).</summary>
    public async void ConfigurarLogin()
    {
        ModoLogin = true;
        _titulo.Text = "⏱️ Controle de Tempo\nEscolha seu perfil para começar";
        _nomes.Visibility = Visibility.Visible;
        _pedir.Visibility = Visibility.Collapsed;
        _mensagem.Text = "";
        _senha.Clear();

        var nomes = await _cliente.ListarNomesAsync();
        _nomes.ItemsSource = nomes;
        if (nomes.Count > 0) _nomes.SelectedIndex = 0;
    }

    /// <summary>Configura a tela como bloqueio/reautenticação.</summary>
    public void ConfigurarBloqueio(string titulo)
    {
        ModoLogin = false;
        _titulo.Text = titulo;
        _nomes.Visibility = Visibility.Collapsed;
        _pedir.Visibility = Visibility.Visible;
        _mensagem.Text = "";
        _senha.Clear();
    }

    private async void Confirmar()
    {
        string senha = _senha.Password;
        if (string.IsNullOrEmpty(senha)) { _mensagem.Text = "Digite a senha."; return; }
        _entrar.IsEnabled = false;

        (bool ok, string msg) r;
        if (ModoLogin)
        {
            string nome = _nomes.SelectedItem as string ?? "";
            if (string.IsNullOrEmpty(nome)) { _mensagem.Text = "Selecione um perfil."; _entrar.IsEnabled = true; return; }
            r = await _cliente.LoginAsync(nome, senha);
        }
        else
        {
            r = await _cliente.ReautenticarAsync(senha);
        }

        _entrar.IsEnabled = true;
        if (r.ok) { _senha.Clear(); /* o próprio pacote mandará LiberarTela */ }
        else _mensagem.Text = r.msg;
    }

    private async void PedirTempo()
    {
        // Diálogo simples de minutos (InputBox em WPF é feito via janela própria).
        var minutos = DialogoMinutos.Pedir();
        if (minutos <= 0) return;
        await _cliente.PedirTempoAsync(minutos, "Pedido pela tela de bloqueio.");
        _mensagem.Foreground = new SolidColorBrush(Color.FromRgb(134, 239, 172));
        _mensagem.Text = $"Pedido de +{minutos} min enviado ao responsável.";
    }

    /// <summary>Fecha de verdade (usado só no encerramento do app).</summary>
    public void FecharDeVerdade()
    {
        _permitirFechar = true;
        base.Close();
    }
}
