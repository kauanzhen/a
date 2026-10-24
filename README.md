# Controle de Tempo — Software de Controle de Uso do Computador

Sistema doméstico, estilo lan house, para **limitar e gerenciar o tempo de uso
de um PC com Windows 11** por crianças, com administração remota pelo celular.
Desenvolvido em **.NET 8 / C#**, conforme a especificação do projeto.

> Objetivo: controlar o tempo por **créditos** ou **tempo limite**, mostrar o
> tempo restante na tela de forma clara e permitir que o responsável administre
> tudo pelo navegador do celular, na mesma rede Wi‑Fi. Tudo funciona **offline**
> (sem internet) e **nunca deixa o PC inutilizável** — há sempre uma saída de
> emergência local com a senha mestra.

---

## Visão geral da arquitetura

Tudo roda no próprio PC host. São processos separados com papéis claros:

| Projeto | Papel | Onde roda |
|---|---|---|
| **ControleTempo.Core** | Regras de negócio: modelos, banco SQLite, **motor de contagem** (relógio monotônico), hash de senha, integridade | biblioteca |
| **ControleTempo.Nucleo** | **Serviço do Windows** + servidor web **Kestrel** embarcado (painel admin + API do overlay) + worker que conta o tempo | sessão 0 (SYSTEM) |
| **ControleTempo.Watchdog** | **Serviço** que vigia o Núcleo e o reinicia se cair (e é vigiado por ele) | sessão 0 (SYSTEM) |
| **ControleTempo.Overlay** | **WPF**: timer sempre-no-topo, telas de login/bloqueio, executa logoff/desligar | sessão do usuário |
| **ControleTempo.Recovery** | **Saída de emergência** local protegida por senha (offline) | console (admin) |

```
                 ┌─────────────────────────── PC HOST (Windows 11) ───────────────────────────┐
                 │                                                                             │
   Celular       │   ┌───────────────┐        ┌──────────────────────┐      ┌──────────────┐  │
  (Firefox) ─────┼──▶│  Painel Web    │◀──────▶│  Núcleo (Serviço)    │◀────▶│   SQLite     │  │
   Wi-Fi         │   │  (Kestrel)     │        │  • motor de contagem │      │  (dados.db)  │  │
                 │   └───────────────┘        │  • regras por usuário│      └──────────────┘  │
                 │                             │  • API local overlay │                        │
                 │   ┌───────────────┐  HTTP   └──────────┬───────────┘      ┌──────────────┐  │
                 │   │  Overlay (WPF) │◀─ loopback ────────┘   vigia ◀──────▶│  Watchdog    │  │
                 │   │  timer+bloqueio│                                       │  (Serviço)   │  │
                 │   └───────────────┘                                       └──────────────┘  │
                 └─────────────────────────────────────────────────────────────────────────────┘
```

**Por que o motor fica no serviço, e não no overlay?** Porque a contagem precisa
continuar mesmo que a criança feche/oculte o overlay ou desligue a internet.
O overlay só **exibe** e **obedece**; quem conta e decide é o serviço.

---

## Principais recursos (mapa da especificação)

- **Perfis individuais** por criança + um administrador. Senhas com **PBKDF2** (hash forte, com sal). Os perfis são do programa, **não vinculados às contas do Windows**.
- **Dois modos por usuário**: *tempo limite* (teto diário) ou *créditos* (saldo recarregável). Configuração independente por usuário.
- **Reautenticação** ao esgotar: a sessão bloqueia e só retoma com a senha e saldo disponível — uma criança não gasta o tempo da outra.
- **Overlay do timer** sempre-no-topo, sem botão de fechar, com **código de cores** (verde → amarelo → laranja → vermelho piscando) e **avisos** (10/5/1 min, visual e sonoro).
- **Painel web responsivo** (PT‑BR) para o celular: status ao vivo, bloquear/liberar, pausar/retomar, +/− tempo, criar/editar usuários, aprovar pedidos. HTTPS local autoassinado.
- **Relatórios**: uso por dia/semana/mês, histórico de sessões, horários mais usados, comparativo entre usuários, auditoria — com gráficos e **exportação CSV**.
- **Saída de emergência e modo offline (anti‑brick)**: tudo local; ferramenta de recuperação protegida por senha; desinstalação protegida; o PC nunca fica inutilizável.
- **Resistência a burlas** (ver tabela abaixo).
- **Ideias extras**: tempo bônus, janelas de horário permitido, pedido de mais tempo, pausa por inatividade, backup automático.

### Resistência a burlas — como cada tentativa é tratada

| Tentativa | Defesa implementada |
|---|---|
| Fechar pelo Gerenciador de Tarefas / matar processo | Núcleo e watchdog são **serviços** (SYSTEM) que se vigiam e reiniciam; recuperação automática do SCM |
| Mudar o relógio/data | **Relógio monotônico** (`RelogioConfiavel`): o tempo só avança pelo tempo real; saltos são detectados e **ignorados** e registrados |
| Desligar na força | Estado salvo no banco a cada ~10s; ao religar o controle sobe no boot e exige reautenticação |
| Editar o banco/config | Pasta em `%ProgramData%` protegida por NTFS; **verificação de integridade** (HMAC) detecta edição externa e alerta |
| Desinstalar | Protegida por senha mestra (scripts e recuperação exigem admin) |
| Tirar a internet | Controle 100% local; ficar offline **não libera** nada |
| Ocultar o overlay | Overlay reaparece (topmost); a contagem roda no núcleo, não no overlay — fechá‑lo não rende tempo |
| Criar conta nova no Windows | Perfis são do programa; o controle não depende da conta do Windows |

> **Nota honesta sobre limites:** nenhum software em modo usuário impede 100% dos
> atalhos do sistema (ex.: Ctrl+Alt+Del) ou um boot por mídia externa. A força do
> sistema está na combinação **serviço SYSTEM + watchdog + contagem local
> persistida + reautenticação**. Para endurecer ainda mais, veja
> [docs/ARQUITETURA.md](docs/ARQUITETURA.md) (BitLocker, políticas de conta,
> bloqueio de boot).

---

## Como compilar

Pré‑requisitos: **.NET 8 SDK** e Windows 11 (para os projetos WPF/Serviço).

```powershell
# Na raiz do repositório
dotnet restore ControleTempo.sln
dotnet build  ControleTempo.sln -c Release
```

Publicar os executáveis para instalação:

```powershell
dotnet publish src/ControleTempo.Nucleo   -c Release -r win-x64 --self-contained false -o publish/Nucleo
dotnet publish src/ControleTempo.Watchdog -c Release -r win-x64 --self-contained false -o publish/Watchdog
dotnet publish src/ControleTempo.Overlay  -c Release -r win-x64 --self-contained false -o publish/Overlay
dotnet publish src/ControleTempo.Recovery -c Release -r win-x64 --self-contained false -o publish/Recovery
```

> A biblioteca **Core** (lógica e motor) e o **painel web** não dependem do
> Windows e podem ser compilados/testados em qualquer plataforma.

## Como instalar e usar

Instalação, configuração como serviço, permissões, firewall e acesso pelo
celular estão em **[docs/INSTALACAO.md](docs/INSTALACAO.md)**. Em resumo:

1. Publique (acima) e rode `scripts/instalar.ps1` **como administrador**.
2. No celular (mesma rede), abra `https://IP-DO-PC:8443` no Firefox.
3. No **primeiro acesso**, defina a senha mestra do administrador.
4. Crie os usuários (um por criança), escolha modo/limite e salve.
5. A criança faz login no overlay do PC e o tempo começa a contar.

## Desenvolvimento em fases

Conforme sugerido na especificação, o código está organizado nessas fases:

- **Fase 1** — núcleo + banco + perfis/login + contagem + overlay (`Core`, `Nucleo`, `Overlay`).
- **Fase 2** — saída de emergência + anti‑tamper (`Recovery`, `Watchdog`, integridade, relógio monotônico).
- **Fase 3** — servidor web + painel admin + ações em tempo real (`Nucleo`/wwwroot).
- **Fase 4** — relatórios/estatísticas e ideias extras (`Relatorios`, pedidos, backup, horários).

## Estrutura de pastas

```
ControleTempo.sln
src/
  ControleTempo.Core/       # domínio, SQLite, motor, segurança
  ControleTempo.Nucleo/     # serviço + Kestrel + painel web (wwwroot) + API
  ControleTempo.Watchdog/   # serviço vigia
  ControleTempo.Overlay/    # WPF (timer + telas de bloqueio/login)
  ControleTempo.Recovery/   # recuperação/saída de emergência
docs/                       # arquitetura e instalação
scripts/                    # instalar/desinstalar (PowerShell)
```

Os dados ficam em `%ProgramData%\ControleTempo\` (banco, backups, logs, certificado).
