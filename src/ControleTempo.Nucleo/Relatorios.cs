using ControleTempo.Core.Modelos;

namespace ControleTempo.Nucleo;

/// <summary>
/// Monta os dados de relatório/estatística consumidos pela aba de relatórios do
/// painel (gráficos de barras/linhas e comparativos). Os cálculos partem das
/// sessões registradas.
/// </summary>
public static class Relatorios
{
    public static object Gerar(ContextoControle ctx, int dias)
    {
        var agora = ctx.Relogio.AgoraUtc;
        var desde = agora.AddDays(-dias);
        var sessoes = ctx.Repo.ListarSessoes(null, desde);
        var usuarios = ctx.Repo.ListarUsuarios(somenteCriancas: true);

        DateTime inicioHoje = ctx.Relogio.AgoraLocal.Date.ToUniversalTime();
        DateTime inicioSemana = agora.AddDays(-7);
        DateTime inicioMes = agora.AddDays(-30);

        var porUsuario = usuarios.Select(u =>
        {
            var suas = sessoes.Where(s => s.UsuarioId == u.Id).ToList();
            return new
            {
                u.Id,
                u.Nome,
                segHoje = suas.Where(s => s.InicioUtc >= inicioHoje).Sum(s => s.ConsumidoSegundos),
                segSemana = suas.Where(s => s.InicioUtc >= inicioSemana).Sum(s => s.ConsumidoSegundos),
                segMes = suas.Where(s => s.InicioUtc >= inicioMes).Sum(s => s.ConsumidoSegundos),
                totalSessoes = suas.Count,
                restante = u.RestanteSegundos
            };
        }).ToList();

        // Série diária (últimos N dias) para o gráfico de linha, agregada por dia local.
        var porDia = new List<object>();
        for (int i = dias - 1; i >= 0; i--)
        {
            var dia = ctx.Relogio.AgoraLocal.Date.AddDays(-i);
            var ini = dia.ToUniversalTime();
            var fim = dia.AddDays(1).ToUniversalTime();
            int seg = sessoes.Where(s => s.InicioUtc >= ini && s.InicioUtc < fim).Sum(s => s.ConsumidoSegundos);
            porDia.Add(new { dia = dia.ToString("dd/MM"), minutos = seg / 60 });
        }

        // Horários mais usados (distribuição por hora do dia).
        var porHora = new int[24];
        foreach (var s in sessoes)
            porHora[s.InicioUtc.ToLocalTime().Hour] += s.ConsumidoSegundos / 60;

        return new
        {
            dias,
            porUsuario,
            porDia,
            porHora = porHora.Select((m, h) => new { hora = $"{h:D2}h", minutos = m }),
            totalHistorico = sessoes.Count,
            sessoesRecentes = sessoes.Take(50).Select(s => new
            {
                nome = usuarios.FirstOrDefault(u => u.Id == s.UsuarioId)?.Nome ?? "?",
                s.InicioUtc, s.FimUtc, s.DuracaoSegundos, s.ConsumidoSegundos, s.EncerradaPorEsgotamento
            })
        };
    }
}
