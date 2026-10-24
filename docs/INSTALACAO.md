# Instalação e configuração (Windows 11)

Guia passo a passo para instalar o Controle de Tempo no PC host e administrá‑lo
pelo celular. Faça tudo **como administrador**.

## 1. Pré‑requisitos

- Windows 11 no PC host.
- **.NET 8 SDK** (para compilar) ou o **.NET 8 Desktop Runtime** (para rodar os
  binários publicados). Baixe em <https://dotnet.microsoft.com/download>.
- O celular do responsável na **mesma rede Wi‑Fi** do PC.

## 2. Publicar os binários

Na raiz do repositório, em um PowerShell:

```powershell
./scripts/publicar.ps1       # publica os 4 executáveis em .\publish
```

Ou manualmente, conforme o [README](../README.md#como-compilar).

## 3. Instalar (serviços + overlay + firewall + permissões)

```powershell
# PowerShell COMO ADMINISTRADOR, na raiz do repositório
./scripts/instalar.ps1 -Raiz (Resolve-Path .\publish)
```

O script faz:

1. Copia os binários para `C:\Program Files\ControleTempo\`.
2. Cria os serviços **ControleTempo** e **ControleTempoWatchdog** (início automático no boot) com **recuperação automática** (reiniciam sozinhos se forem encerrados).
3. Protege a pasta de dados `%ProgramData%\ControleTempo` com NTFS (usuários comuns não podem editar/apagar o banco).
4. Cria uma **tarefa agendada** que inicia o overlay no logon de qualquer usuário.
5. Abre a **porta 8443** no firewall para a rede local (privada).
6. Inicia os serviços.

## 4. Primeiro acesso (definir a senha mestra)

1. Descubra o IP do PC: o script imprime ao final, ou rode `ipconfig` e veja o
   IPv4 (ex.: `192.168.0.10`). O serviço também grava a URL no log.
2. No **Firefox do celular**, acesse: `https://192.168.0.10:8443`
3. Como o certificado é **autoassinado** (é o seu próprio PC), o Firefox mostra
   “Aviso: risco potencial de segurança”. Toque em **Avançado → Aceitar o risco
   e continuar**. É seguro — a conexão é local e cifrada.
4. Defina a **senha do administrador** (mínimo 6 caracteres). Não há senha
   padrão, por segurança.

## 5. Criar usuários (um por criança)

No painel → aba **Usuários → + Novo usuário**:

- **Nome** e **senha** da criança.
- **Modo**: *Tempo limite* (teto por dia) ou *Créditos* (saldo que você recarrega).
- **Limite/Saldo** em minutos.
- **Ao esgotar**: bloquear a tela, logoff, suspender, desligar ou apenas avisar.
- **Pausa por inatividade**, **horários permitidos** (ex.: `14:00-18:00;19:00-21:00`), **pode pedir mais tempo**.

## 6. Uso no dia a dia

- No PC, o **overlay** mostra o timer no canto e a **tela de login**. A criança
  escolhe o perfil, digita a senha e o tempo começa a contar.
- Quando o tempo acaba, a tela bloqueia (ou a ação escolhida ocorre). A criança
  pode **pedir mais tempo** — você recebe o pedido no painel (aba **Pedidos**).
- Pelo celular você vê o **status ao vivo** e pode bloquear/liberar, pausar,
  dar/remover tempo e aprovar pedidos a qualquer momento.

## 7. Saída de emergência / recuperação

Se algo der errado (serviço travado, esqueceu de liberar, etc.):

- Execute `ControleTempo.Recovery.exe` **como administrador** (ou use o atalho
  secreto configurado). Informe a **senha mestra** e escolha, por exemplo:
  - **Liberar o PC agora** (para os serviços);
  - **Dar tempo** a um usuário direto no banco;
  - **Desativar temporariamente** (o PC fica livre até você reativar);
  - **Restaurar um backup** do banco;
  - **Redefinir a senha** do administrador.

O PC **nunca** fica inutilizável: a recuperação funciona offline e sem reinstalar o Windows.

## 8. Desinstalar

```powershell
./scripts/desinstalar.ps1    # COMO ADMINISTRADOR
```

Remove os serviços, a tarefa do overlay e a regra de firewall. Os dados em
`%ProgramData%\ControleTempo` são **preservados** (apague à mão se quiser).

## Solução de problemas

- **Não acesso pelo celular:** confirme que estão na mesma rede; que a porta
  8443 está liberada no firewall; e tente `http`/`https` conforme o ajuste. Redes
  “públicas” do Windows bloqueiam; marque a rede como **privada**.
- **O overlay não aparece:** ele inicia no logon (tarefa agendada). Faça
  logoff/logon ou rode `ControleTempo.Overlay.exe` manualmente para testar.
- **Quero trocar a porta/HTTPS:** aba **Ajustes** do painel; reinicie o serviço
  `ControleTempo` para aplicar.
