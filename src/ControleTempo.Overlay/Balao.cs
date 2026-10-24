using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;

namespace ControleTempo.Overlay;

/// <summary>Balão de aviso temporário no canto da tela (ex.: "Faltam 5 minutos").</summary>
internal static class Balao
{
    private static Window? _atual;

    public static void Mostrar(string texto)
    {
        _atual?.Close();

        var janela = new Window
        {
            WindowStyle = WindowStyle.None, AllowsTransparency = true, Background = Brushes.Transparent,
            Topmost = true, ShowInTaskbar = false, ShowActivated = false,
            SizeToContent = SizeToContent.WidthAndHeight, ResizeMode = ResizeMode.NoResize
        };

        var borda = new Border
        {
            CornerRadius = new CornerRadius(10),
            Background = new SolidColorBrush(Color.FromArgb(240, 245, 158, 11)),
            Padding = new Thickness(16, 10, 16, 10),
            Child = new TextBlock { Text = texto, Foreground = Brushes.Black, FontSize = 15, FontWeight = FontWeights.SemiBold }
        };
        janela.Content = borda;

        janela.Loaded += (_, _) =>
        {
            var area = SystemParameters.WorkArea;
            janela.Left = area.Right - janela.ActualWidth - 16;
            janela.Top = area.Top + 90;
        };
        janela.Show();
        _atual = janela;

        var fechar = new DispatcherTimer { Interval = TimeSpan.FromSeconds(5) };
        fechar.Tick += (_, _) => { fechar.Stop(); janela.Close(); if (_atual == janela) _atual = null; };
        fechar.Start();
    }
}
