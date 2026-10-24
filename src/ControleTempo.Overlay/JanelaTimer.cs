using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Overlay;

/// <summary>
/// Janelinha sempre-no-topo que mostra o tempo restante e o nome do usuário.
/// Sem borda, sem botão de fechar, fora da barra de tarefas. Reafirma o "topmost"
/// periodicamente para voltar à frente caso algo a cubra.
/// </summary>
internal sealed class JanelaTimer : Window
{
    private readonly TextBlock _nome;
    private readonly TextBlock _tempo;
    private readonly Border _cartao;

    public JanelaTimer()
    {
        // Características de overlay: sem borda, topo, sem taskbar, não ativável.
        WindowStyle = WindowStyle.None;
        AllowsTransparency = true;
        Background = Brushes.Transparent;
        Topmost = true;
        ShowInTaskbar = false;
        ResizeMode = ResizeMode.NoResize;
        SizeToContent = SizeToContent.WidthAndHeight;
        ShowActivated = false;

        _nome = new TextBlock
        {
            Foreground = Brushes.White, FontSize = 13, FontWeight = FontWeights.SemiBold,
            HorizontalAlignment = HorizontalAlignment.Center
        };
        _tempo = new TextBlock
        {
            Foreground = Brushes.White, FontSize = 30, FontWeight = FontWeights.Bold,
            HorizontalAlignment = HorizontalAlignment.Center
        };

        var pilha = new StackPanel { Margin = new Thickness(14, 8, 14, 8) };
        pilha.Children.Add(_nome);
        pilha.Children.Add(_tempo);

        _cartao = new Border
        {
            CornerRadius = new CornerRadius(12),
            Background = new SolidColorBrush(Color.FromArgb(230, 34, 197, 94)),
            Child = pilha
        };
        Content = _cartao;

        // Posiciona no canto superior direito ao carregar.
        Loaded += (_, _) =>
        {
            var area = SystemParameters.WorkArea;
            Left = area.Right - ActualWidth - 16;
            Top = area.Top + 16;
        };
    }

    /// <summary>Atualiza o texto e a cor conforme o estado.</summary>
    public void Atualizar(string nome, string tempo, FaixaCor cor, bool pausado)
    {
        _nome.Text = pausado ? $"{nome} (pausado)" : nome;
        _tempo.Text = tempo;
        Color c = cor switch
        {
            FaixaCor.Verde => Color.FromRgb(34, 197, 94),
            FaixaCor.Amarelo => Color.FromRgb(234, 179, 8),
            FaixaCor.Laranja => Color.FromRgb(249, 115, 22),
            _ => Color.FromRgb(239, 68, 68)
        };
        _cartao.Background = new SolidColorBrush(Color.FromArgb(235, c.R, c.G, c.B));
    }

    /// <summary>Reafirma que a janela está no topo (chamado a cada tique).</summary>
    public void Reafirmar()
    {
        if (!Topmost) Topmost = true;
        Topmost = false; Topmost = true; // "cutuca" o z-order
    }
}
