using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace ControleTempo.Overlay;

/// <summary>Pequeno diálogo modal para a criança digitar quantos minutos quer pedir.</summary>
internal static class DialogoMinutos
{
    public static int Pedir()
    {
        var janela = new Window
        {
            Title = "Pedir mais tempo",
            Width = 320, Height = 190, WindowStyle = WindowStyle.ToolWindow,
            WindowStartupLocation = WindowStartupLocation.CenterScreen,
            Topmost = true, ResizeMode = ResizeMode.NoResize,
            Background = new SolidColorBrush(Color.FromRgb(30, 41, 59))
        };

        var caixa = new TextBox { Text = "15", FontSize = 18, Margin = new Thickness(0, 8, 0, 8), Height = 36 };
        var ok = new Button { Content = "Enviar pedido", Height = 40, Foreground = Brushes.White, FontWeight = FontWeights.SemiBold, Background = new SolidColorBrush(Color.FromRgb(59, 130, 246)), BorderThickness = new Thickness(0) };

        int resultado = 0;
        ok.Click += (_, _) =>
        {
            if (int.TryParse(caixa.Text, out int m) && m > 0) resultado = Math.Min(m, 240);
            janela.Close();
        };

        var pilha = new StackPanel { Margin = new Thickness(16) };
        pilha.Children.Add(new TextBlock { Text = "Quantos minutos?", Foreground = Brushes.White, FontSize = 14 });
        pilha.Children.Add(caixa);
        pilha.Children.Add(ok);
        janela.Content = pilha;
        janela.ShowDialog();
        return resultado;
    }
}
