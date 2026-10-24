using System.Globalization;
using System.Net;
using System.Text;
using ControleTempo.Core.Contratos;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Seguranca;
using ControleTempo.Core.Servicos;

namespace ControleTempo.Nucleo;

/// <summary>
/// Define todos os endpoints HTTP: configuração inicial, autenticação do admin,
/// gestão de usuários, ações em tempo real, pedidos de tempo, relatórios e a API
/// local consumida pelo overlay. O painel (wwwroot) consome esta API.
/// </summary>
public static class Endpoints
{
    private const string CookieToken = "ct_token";

    public static void MapearApi(WebApplication app)
    {
        // ---------- Configuração inicial / autenticação ----------

        app.MapGet("/api/status-inicial", (ContextoControle ctx) =>
        {
            var cfg = ctx.Repo.ObterConfig();
            bool configurado = cfg is not null && !string.IsNullOrEmpty(cfg.SenhaAdminHash);
            return Results.Ok(new
            {
                configurado,
                ip = RedeLocal.IpPreferido(),
                porta = cfg?.PortaWeb ?? 8443,
                https = cfg?.UsarHttps ?? true
            });
        });

        // Define a senha do admin no primeiro acesso (não há senha padrão).
        app.MapPost("/api/definir-admin", (ContextoControle ctx, DefinirAdminDto dto) =>
        {
            var cfg = ctx.Repo.ObterConfig() ?? new ConfiguracaoGlobal();
            if (!string.IsNullOrEmpty(cfg.SenhaAdminHash))
                return Results.BadRequest(new { erro = "Administrador já configurado." });
            if (string.IsNullOrWhiteSpace(dto.Senha) || dto.Senha.Length < 6)
                return Results.BadRequest(new { erro = "A senha deve ter ao menos 6 caracteres." });
            if (dto.Senha != dto.Confirmacao)
                return Results.BadRequest(new { erro = "As senhas não conferem." });

            cfg.SenhaAdminHash = HashSenha.Gerar(dto.Senha);
            ctx.Repo.SalvarConfig(cfg);
            ctx.Repo.Registrar(TipoEvento.LoginAdmin, 0, "Senha de administrador definida.", "web");
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/login", (ContextoControle ctx, HttpContext http, LoginDto dto) =>
        {
            if (!ctx.ValidarSenhaAdmin(dto.Senha))
            {
                ctx.Repo.Registrar(TipoEvento.FalhaLogin, 0, "Falha de login do admin.", "web");
                return Results.Unauthorized();
            }
            string token = ctx.CriarTokenAdmin();
            var cfg = ctx.Repo.ObterConfig();
            http.Response.Cookies.Append(CookieToken, token, new CookieOptions
            {
                HttpOnly = true,
                Secure = cfg?.UsarHttps ?? false,
                SameSite = SameSiteMode.Lax,
                MaxAge = TimeSpan.FromHours(8)
            });
            ctx.Repo.Registrar(TipoEvento.LoginAdmin, 0, "Admin autenticado.", "web");
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/logout", (ContextoControle ctx, HttpContext http) =>
        {
            ctx.RevogarToken(http.Request.Cookies[CookieToken]);
            http.Response.Cookies.Delete(CookieToken);
            return Results.Ok(new { ok = true });
        });

        // ---------- Estado ao vivo ----------

        app.MapGet("/api/estado", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var e = ctx.Motor.EstadoAtual();
            int pendentes = ctx.Repo.ListarPedidos(SituacaoPedido.Pendente).Count;
            return Results.Ok(new EstadoVivoDto(
                (int)e.Estado, e.UsuarioId, e.NomeUsuario, (int)e.Modo,
                e.RestanteSegundos, e.RestanteFormatado, (int)e.Cor, e.ContagemPausada,
                ctx.SegundosInativoReportado, pendentes));
        });

        // ---------- Usuários ----------

        app.MapGet("/api/usuarios", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var lista = ctx.Repo.ListarUsuarios(somenteCriancas: true)
                .Select(UsuarioDto.De).ToList();
            return Results.Ok(lista);
        });

        app.MapPost("/api/usuarios", (ContextoControle ctx, HttpContext http, SalvarUsuarioDto dto) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            if (string.IsNullOrWhiteSpace(dto.Nome))
                return Results.BadRequest(new { erro = "Nome obrigatório." });

            Usuario u = dto.Id > 0 ? ctx.Repo.ObterUsuario(dto.Id) ?? new Usuario() : new Usuario();
            bool novo = u.Id == 0;

            if (novo && string.IsNullOrWhiteSpace(dto.Senha))
                return Results.BadRequest(new { erro = "Senha obrigatória para novo usuário." });

            u.Nome = dto.Nome.Trim();
            u.Papel = Papel.Crianca;
            if (!string.IsNullOrWhiteSpace(dto.Senha)) u.SenhaHash = HashSenha.Gerar(dto.Senha);
            u.Modo = (ModoControle)dto.Modo;
            u.LimiteDiarioSegundos = Math.Max(0, dto.LimiteDiarioSegundos);
            u.SaldoCreditosSegundos = Math.Max(0, dto.SaldoCreditosSegundos);
            u.AcaoAoEsgotar = (AcaoAoEsgotar)dto.AcaoAoEsgotar;
            u.InatividadePausaSegundos = Math.Max(0, dto.InatividadePausaSegundos);
            u.PodePedirTempo = dto.PodePedirTempo;
            u.HorariosPermitidos = dto.HorariosPermitidos ?? string.Empty;
            u.Ativo = dto.Ativo;
            if (novo && string.IsNullOrEmpty(u.DataConsumo))
                u.DataConsumo = ctx.Relogio.AgoraLocal.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

            if (novo) { u.Id = ctx.Repo.InserirUsuario(u); }
            else ctx.Repo.AtualizarUsuario(u);

            return Results.Ok(UsuarioDto.De(u));
        });

        app.MapDelete("/api/usuarios/{id:int}", (ContextoControle ctx, HttpContext http, int id) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Repo.RemoverUsuario(id);
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/usuarios/{id:int}/adicionar", (ContextoControle ctx, HttpContext http, int id, AjusteTempoDto dto) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.AdicionarTempo(id, dto.Minutos * 60);
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/usuarios/{id:int}/remover", (ContextoControle ctx, HttpContext http, int id, AjusteTempoDto dto) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.RemoverTempo(id, dto.Minutos * 60);
            return Results.Ok(new { ok = true });
        });

        // ---------- Ações de controle em tempo real ----------

        app.MapPost("/api/controle/bloquear", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.BloquearAgora("painel");
            ctx.DefinirComando(ComandoOverlay.MostrarBloqueio);
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/controle/liberar", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.LiberarAgora();
            ctx.DefinirComando(ComandoOverlay.LiberarTela);
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/controle/pausar", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.Pausar();
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/controle/retomar", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.Retomar();
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/controle/encerrar", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            ctx.Motor.EncerrarSessao(porEsgotamento: false);
            ctx.DefinirComando(ComandoOverlay.Logoff);
            return Results.Ok(new { ok = true });
        });

        // ---------- Pedidos de mais tempo ----------

        app.MapGet("/api/pedidos", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var pend = ctx.Repo.ListarPedidos(SituacaoPedido.Pendente);
            var resp = pend.Select(p =>
            {
                var u = ctx.Repo.ObterUsuario(p.UsuarioId);
                return new { p.Id, p.UsuarioId, nome = u?.Nome ?? "?", p.MinutosSolicitados, p.Mensagem, p.QuandoUtc };
            });
            return Results.Ok(resp);
        });

        app.MapPost("/api/pedidos/{id:int}/responder", (ContextoControle ctx, HttpContext http, int id, ResponderPedidoDto dto) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var pedido = ctx.Repo.ListarPedidos().FirstOrDefault(p => p.Id == id);
            if (pedido is null) return Results.NotFound();
            if (dto.Aprovar)
            {
                int minutos = dto.Minutos > 0 ? dto.Minutos : pedido.MinutosSolicitados;
                ctx.Repo.ResponderPedido(id, SituacaoPedido.Aprovado, minutos);
                ctx.Motor.AdicionarTempo(pedido.UsuarioId, minutos * 60);
                ctx.Repo.Registrar(TipoEvento.PedidoAprovado, pedido.UsuarioId, $"Pedido aprovado: +{minutos} min.", "web");
            }
            else
            {
                ctx.Repo.ResponderPedido(id, SituacaoPedido.Negado, 0);
                ctx.Repo.Registrar(TipoEvento.PedidoNegado, pedido.UsuarioId, "Pedido negado.", "web");
            }
            return Results.Ok(new { ok = true });
        });

        // ---------- Relatórios / eventos / exportação ----------

        app.MapGet("/api/relatorios", (ContextoControle ctx, HttpContext http, int dias) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            return Results.Ok(Relatorios.Gerar(ctx, dias <= 0 ? 30 : dias));
        });

        app.MapGet("/api/eventos", (ContextoControle ctx, HttpContext http, int dias) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var desde = ctx.Relogio.AgoraUtc.AddDays(-(dias <= 0 ? 7 : dias));
            var evs = ctx.Repo.ListarEventos(desde).Select(e => new
            {
                e.QuandoUtc, tipo = e.Tipo.ToString(), e.UsuarioId, e.Detalhe, e.Origem
            });
            return Results.Ok(evs);
        });

        app.MapGet("/api/exportar/csv", (ContextoControle ctx, HttpContext http, int dias) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var desde = ctx.Relogio.AgoraUtc.AddDays(-(dias <= 0 ? 30 : dias));
            var sb = new StringBuilder();
            sb.AppendLine("Usuario;Inicio;Fim;DuracaoSegundos;ConsumidoSegundos;PorEsgotamento");
            foreach (var s in ctx.Repo.ListarSessoes(null, desde))
            {
                var u = ctx.Repo.ObterUsuario(s.UsuarioId);
                sb.AppendLine($"{u?.Nome};{s.InicioUtc:o};{s.FimUtc:o};{s.DuracaoSegundos};{s.ConsumidoSegundos};{s.EncerradaPorEsgotamento}");
            }
            return Results.File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", "relatorio-uso.csv");
        });

        // ---------- Configuração ----------

        app.MapGet("/api/config", (ContextoControle ctx, HttpContext http) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var c = ctx.Repo.ObterConfig()!;
            return Results.Ok(new ConfigDto(c.PortaWeb, c.UsarHttps, c.AvisosMinutos, c.AvisoSonoro,
                c.NotificacoesPush, c.BackupAutomatico, c.AtalhoEmergencia));
        });

        app.MapPut("/api/config", (ContextoControle ctx, HttpContext http, ConfigDto dto) =>
        {
            if (!Autenticado(ctx, http)) return Results.Unauthorized();
            var c = ctx.Repo.ObterConfig()!;
            c.PortaWeb = dto.PortaWeb;
            c.UsarHttps = dto.UsarHttps;
            c.AvisosMinutos = dto.AvisosMinutos;
            c.AvisoSonoro = dto.AvisoSonoro;
            c.NotificacoesPush = dto.NotificacoesPush;
            c.BackupAutomatico = dto.BackupAutomatico;
            c.AtalhoEmergencia = dto.AtalhoEmergencia;
            ctx.Repo.SalvarConfig(c);
            return Results.Ok(new { ok = true, aviso = "Porta/HTTPS só mudam após reiniciar o serviço." });
        });

        MapearOverlay(app);
    }

    // ============================================================
    //  API LOCAL DO OVERLAY (somente loopback)
    // ============================================================

    private static void MapearOverlay(WebApplication app)
    {
        app.MapGet("/api/overlay/pacote", (ContextoControle ctx, HttpContext http) =>
            !EhLoopback(http) ? Results.StatusCode(403) : Results.Ok(ctx.MontarPacote()));

        app.MapPost("/api/overlay/batimento", (ContextoControle ctx, HttpContext http, BatimentoOverlay b) =>
        {
            if (!EhLoopback(http)) return Results.StatusCode(403);
            ctx.RegistrarBatimento(b.SegundosInativo);
            // Reautenticação pela tela de bloqueio.
            if (!string.IsNullOrEmpty(b.SenhaReautenticacao))
            {
                var (ok, msg) = ctx.Motor.Reautenticar(b.SenhaReautenticacao!);
                if (ok) ctx.DefinirComando(ComandoOverlay.LiberarTela);
                return Results.Ok(new { ok, msg });
            }
            return Results.Ok(new { ok = true });
        });

        app.MapPost("/api/overlay/login", (ContextoControle ctx, HttpContext http, LoginCriancaDto dto) =>
        {
            if (!EhLoopback(http)) return Results.StatusCode(403);
            var (ok, msg) = ctx.Motor.IniciarSessao(dto.Nome, dto.Senha);
            if (ok) ctx.DefinirComando(ComandoOverlay.LiberarTela);
            return Results.Ok(new { ok, msg });
        });

        app.MapPost("/api/overlay/pedir-tempo", (ContextoControle ctx, HttpContext http, PedirTempoDto dto) =>
        {
            if (!EhLoopback(http)) return Results.StatusCode(403);
            int? uid = ctx.Motor.UsuarioLogadoId;
            if (uid is null) return Results.BadRequest(new { erro = "Ninguém logado." });
            var u = ctx.Repo.ObterUsuario(uid.Value);
            if (u is null || !u.PodePedirTempo)
                return Results.BadRequest(new { erro = "Pedido de tempo não permitido para este usuário." });
            ctx.Repo.CriarPedido(new PedidoTempo
            {
                UsuarioId = uid.Value,
                MinutosSolicitados = Math.Clamp(dto.Minutos, 1, 240),
                Mensagem = dto.Mensagem ?? string.Empty,
                QuandoUtc = ctx.Relogio.AgoraUtc
            });
            ctx.Repo.Registrar(TipoEvento.PedidoTempo, uid.Value, $"Pediu +{dto.Minutos} min.", "overlay");
            return Results.Ok(new { ok = true });
        });

        // Lista de nomes para a tela de login do overlay (sem expor senhas).
        app.MapGet("/api/overlay/usuarios", (ContextoControle ctx, HttpContext http) =>
        {
            if (!EhLoopback(http)) return Results.StatusCode(403);
            var nomes = ctx.Repo.ListarUsuarios(somenteCriancas: true)
                .Where(u => u.Ativo).Select(u => u.Nome);
            return Results.Ok(nomes);
        });
    }

    // ============================================================
    //  AUXILIARES
    // ============================================================

    private static bool Autenticado(ContextoControle ctx, HttpContext http) =>
        ctx.TokenValido(http.Request.Cookies[CookieToken]);

    private static bool EhLoopback(HttpContext http)
    {
        var ip = http.Connection.RemoteIpAddress;
        return ip is not null && (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.IPv6Loopback));
    }
}
