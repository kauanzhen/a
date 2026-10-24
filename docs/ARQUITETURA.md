# Arquitetura e decisões técnicas

## Componentes e responsabilidades

- **Core** — regra de negócio pura (sem Windows): modelos, SQLite, motor de
  contagem, hash de senha, integridade. Fica isolado para ser testável e para
  separar "regra" de "sistema operacional".
- **Nucleo** — processo principal. Hospeda, em um só executável:
  - o **worker** que chama `MotorTempo.Tique()` 1×/segundo (único ponto que
    consome tempo);
  - o **Kestrel** com o painel web (porta 8443) e a API local do overlay;
  - a vigilância recíproca do watchdog e o backup diário.
  Roda como **Serviço do Windows** (conta SYSTEM, início no boot).
- **Watchdog** — serviço separado que reinicia o Núcleo se ele cair; o Núcleo o
  reinicia de volta (heartbeat em `watchdog.alive`).
- **Overlay** — WPF na sessão do usuário: timer topmost, telas de login/bloqueio,
  reporta inatividade e executa logoff/suspender/desligar quando mandado.
  Conversa com o Núcleo por **HTTP em loopback** (127.0.0.1).
- **Recovery** — console de emergência protegido por senha; opera direto no
  banco e nos serviços, mesmo offline.

## Decisões de projeto

- **Contagem no serviço, não no overlay.** Garante que fechar/ocultar o overlay
  não pare o relógio. O overlay é só vitrine + obediência.
- **Relógio monotônico (`RelogioConfiavel`).** O tempo avança por
  `Stopwatch.GetTimestamp()` (não pela hora de parede). Mudar a data/hora do
  Windows não concede nem rouba tempo; saltos são detectados e registrados.
- **Virada de dia pelo relógio confiável.** O reset do limite diário usa o
  "agora confiável", então adiantar o relógio não gera um "novo dia".
- **Persistência a cada ~10s + no esgotamento.** Sobrevive a desligamento na
  força; ao religar, o estado volta do banco e exige reautenticação.
- **Senhas com PBKDF2‑SHA256** (210k iterações, sal por senha), comparação em
  tempo constante. Fácil trocar por Argon2 mantendo a interface `HashSenha`.
- **HTTPS local autoassinado** gerado na primeira execução (SAN para localhost e
  o IP da LAN), para a senha do admin não trafegar em texto puro.
- **Integridade do banco (HMAC).** Ao parar, o serviço assina o arquivo; ao
  iniciar, compara — detecta edição externa feita com o serviço fora do ar.

## Como endurecer ainda mais (opcional)

Estas medidas são do **sistema operacional**, fora do app, e aumentam a
resistência a um usuário muito determinado:

- **BitLocker** no disco e/ou **EFS** na pasta de dados → cifragem em repouso
  real (complementa a integridade por HMAC). Para cifrar o *arquivo* SQLite, dá
  para trocar o pacote por **SQLCipher** e informar `Password=` na string de
  conexão em `BancoDados.ConnectionString`.
- Contas das crianças como **usuário padrão** (sem admin); senha no BIOS/UEFI e
  **ordem de boot travada** para evitar boot por pendrive.
- Políticas de grupo para **bloquear criação de contas** e o acesso ao
  Agendador de Tarefas por usuários comuns.
- Assinar os executáveis e manter os binários em `Program Files` (protegido).

## Fluxo de um esgotamento

1. Worker chama `Tique()`; `RestanteSegundos` chega a 0.
2. O motor dispara **uma vez** `EsgotarInterno`, registra `LimiteAtingido`,
   fecha a sessão e define o estado conforme a ação do usuário.
3. O worker traduz a ação em **comando** para o overlay (bloquear/logoff/…).
4. O overlay aplica: mostra a tela de bloqueio (reautenticação) ou executa
   logoff/suspender/desligar.
5. A criança reautentica (se houver saldo) ou pede mais tempo ao admin.
