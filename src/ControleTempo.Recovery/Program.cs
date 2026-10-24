using System.Runtime.Versioning;
using System.ServiceProcess;
using ControleTempo.Core.Dados;
using ControleTempo.Core.Modelos;
using ControleTempo.Core.Seguranca;
using ControleTempo.Core.Servicos;

// ============================================================================
//  ControleTempo.Recovery — saída de emergência local e recuperação.
//  Protegida pela senha mestra. Nunca deixa o PC inutilizável.
// ============================================================================

Console.Title = "Controle de Tempo — Recuperação";
Caminhos.GarantirPastas();

var banco = new BancoDados(Caminhos.ArquivoBanco);
banco.GarantirEsquema();
var repo = new Repositorio(banco);

Console.WriteLine("=== Controle de Tempo — Modo de Recuperação ===\n");

// --- Gate de senha ---
var cfg = repo.ObterConfig();
if (cfg is null || string.IsNullOrEmpty(cfg.SenhaAdminHash))
{
    Console.WriteLine("Sistema ainda não configurado (sem senha de admin). Nada a recuperar.");
    Encerrar();
    return;
}

if (!PedirSenha(cfg))
{
    Console.WriteLine("Senha incorreta. Encerrando.");
    repo.Registrar(TipoEvento.FalhaLogin, 0, "Falha de senha no modo de recuperação.", "recovery");
    Encerrar();
    return;
}

repo.Registrar(TipoEvento.SaidaEmergencia, 0, "Modo de recuperação aberto.", "recovery");

// --- Menu ---
bool sair = false;
while (!sair)
{
    Console.WriteLine("""

    Escolha uma opção:
      1) Liberar o PC AGORA (parar os serviços de controle)
      2) Reativar o controle (iniciar os serviços)
      3) Dar tempo/crédito a um usuário (direto no banco)
      4) Desativar o sistema temporariamente (não conta até reativar)
      5) Reativar o sistema (volta a contar)
      6) Restaurar um backup do banco
      7) Redefinir a senha do administrador
      0) Sair
    """);
    Console.Write("> ");
    switch (Console.ReadLine()?.Trim())
    {
        case "1": AlternarServicos(iniciar: false); break;
        case "2": AlternarServicos(iniciar: true); break;
        case "3": DarTempo(); break;
        case "4": DefinirDesativado(true); break;
        case "5": DefinirDesativado(false); break;
        case "6": RestaurarBackup(); break;
        case "7": RedefinirSenha(); break;
        case "0": sair = true; break;
        default: Console.WriteLine("Opção inválida."); break;
    }
}

Encerrar();


// ===================== Funções =====================

bool PedirSenha(ConfiguracaoGlobal c)
{
    for (int tentativa = 1; tentativa <= 3; tentativa++)
    {
        Console.Write("Senha de administrador: ");
        string senha = LerSenhaOculta();
        if (HashSenha.Verificar(senha, c.SenhaAdminHash)) return true;
        Console.WriteLine($"  Incorreta ({tentativa}/3).");
    }
    return false;
}

string LerSenhaOculta()
{
    var sb = new System.Text.StringBuilder();
    ConsoleKeyInfo k;
    while ((k = Console.ReadKey(intercept: true)).Key != ConsoleKey.Enter)
    {
        if (k.Key == ConsoleKey.Backspace) { if (sb.Length > 0) sb.Length--; }
        else if (!char.IsControl(k.KeyChar)) sb.Append(k.KeyChar);
    }
    Console.WriteLine();
    return sb.ToString();
}

void AlternarServicos(bool iniciar)
{
    if (!OperatingSystem.IsWindows()) { Console.WriteLine("(Só no Windows.)"); return; }
    AcaoServico("ControleTempoWatchdog", iniciar);
    AcaoServico("ControleTempo", iniciar);
    Console.WriteLine(iniciar ? "Serviços iniciados." : "Serviços parados — o PC está liberado.");
}

[SupportedOSPlatform("windows")]
void AcaoServico(string nome, bool iniciar)
{
    try
    {
        using var sc = new ServiceController(nome);
        sc.Refresh();
        if (iniciar && sc.Status == ServiceControllerStatus.Stopped)
            sc.Start();
        else if (!iniciar && sc.Status == ServiceControllerStatus.Running)
            sc.Stop();
    }
    catch (Exception ex) { Console.WriteLine($"  [{nome}] {ex.Message}"); }
}

void DarTempo()
{
    var criancas = repo.ListarUsuarios(somenteCriancas: true);
    if (criancas.Count == 0) { Console.WriteLine("Nenhum usuário."); return; }
    for (int i = 0; i < criancas.Count; i++)
        Console.WriteLine($"  {i + 1}) {criancas[i].Nome} (resta {criancas[i].RestanteSegundos / 60} min)");
    Console.Write("Número do usuário: ");
    if (!int.TryParse(Console.ReadLine(), out int idx) || idx < 1 || idx > criancas.Count) { Console.WriteLine("Inválido."); return; }
    Console.Write("Minutos a adicionar: ");
    if (!int.TryParse(Console.ReadLine(), out int min) || min <= 0) { Console.WriteLine("Inválido."); return; }

    var u = criancas[idx - 1];
    if (u.Modo == ModoControle.Creditos) u.SaldoCreditosSegundos += min * 60;
    else u.ConsumidoHojeSegundos = Math.Max(0, u.ConsumidoHojeSegundos - min * 60);
    repo.AtualizarUsuario(u);
    repo.Registrar(TipoEvento.TempoAdicionado, u.Id, $"+{min} min via recuperação.", "recovery");
    Console.WriteLine($"OK. Reinicie o serviço (opção 2) para aplicar se ele estiver rodando.");
}

void DefinirDesativado(bool desativar)
{
    string flag = Path.Combine(Caminhos.PastaDados, "desativado.flag");
    if (desativar) { File.WriteAllText(flag, DateTime.UtcNow.ToString("o")); Console.WriteLine("Sistema DESATIVADO: não conta nem bloqueia até reativar."); }
    else { if (File.Exists(flag)) File.Delete(flag); Console.WriteLine("Sistema REATIVADO: volta a contar normalmente."); }
    repo.Registrar(TipoEvento.SaidaEmergencia, 0, desativar ? "Sistema desativado (recuperação)." : "Sistema reativado (recuperação).", "recovery");
}

void RestaurarBackup()
{
    var dir = new DirectoryInfo(Caminhos.PastaBackup);
    var backups = dir.Exists ? dir.GetFiles("dados-*.db").OrderByDescending(f => f.Name).ToList() : new();
    if (backups.Count == 0) { Console.WriteLine("Nenhum backup encontrado."); return; }
    for (int i = 0; i < Math.Min(backups.Count, 15); i++)
        Console.WriteLine($"  {i + 1}) {backups[i].Name}");
    Console.Write("Número do backup a restaurar: ");
    if (!int.TryParse(Console.ReadLine(), out int idx) || idx < 1 || idx > backups.Count) { Console.WriteLine("Inválido."); return; }
    Console.Write("Confirma? Isso substitui o banco atual (s/N): ");
    if (!string.Equals(Console.ReadLine()?.Trim(), "s", StringComparison.OrdinalIgnoreCase)) { Console.WriteLine("Cancelado."); return; }

    AlternarServicos(iniciar: false); // precisa estar parado para substituir o arquivo
    try
    {
        File.Copy(backups[idx - 1].FullName, Caminhos.ArquivoBanco, overwrite: true);
        Console.WriteLine("Backup restaurado. Use a opção 2 para reativar o controle.");
    }
    catch (Exception ex) { Console.WriteLine($"Falha: {ex.Message}"); }
}

void RedefinirSenha()
{
    Console.Write("Nova senha do admin (mín. 6): ");
    string s1 = LerSenhaOculta();
    if (s1.Length < 6) { Console.WriteLine("Muito curta."); return; }
    Console.Write("Confirme: ");
    string s2 = LerSenhaOculta();
    if (s1 != s2) { Console.WriteLine("Não conferem."); return; }

    var c = repo.ObterConfig()!;
    c.SenhaAdminHash = HashSenha.Gerar(s1);
    repo.SalvarConfig(c);
    repo.Registrar(TipoEvento.SaidaEmergencia, 0, "Senha de admin redefinida via recuperação.", "recovery");
    Console.WriteLine("Senha redefinida.");
}

void Encerrar()
{
    Console.WriteLine("\nPressione qualquer tecla para fechar...");
    try { Console.ReadKey(); } catch { }
}
