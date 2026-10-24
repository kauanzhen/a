import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CabecalhoPagina } from '../../components/ui';

const ATALHOS: [string, string][] = [
  ['Alt+L', 'Novo lançamento (de qualquer tela)'],
  ['Alt+I', 'Abrir o Assistente IA'],
  ['Alt+N', 'Lista de lançamentos: novo lançamento · Editor: nova partida'],
  ['Ctrl+Enter', 'Editor: salvar'],
  ['Ctrl+S', 'Editor: salvar e começar outro lançamento'],
  ['Alt+B', 'Editor: balancear a partida atual com a diferença'],
  ['Alt+D / Alt+C', 'Editor: partida atual a débito / a crédito'],
  ['Alt+X', 'Editor: remover a partida atual'],
  ['Esc', 'Fechar janela / voltar'],
  ['+ / - / H', 'Campo de data: próximo dia / dia anterior / hoje'],
  ['↑ ↓ Enter', 'Seletor de conta: navegar e escolher (aceita código reduzido)'],
];

export function AjudaPage() {
  const local = useLocation();
  useEffect(() => {
    if (local.hash) document.getElementById(local.hash.slice(1))?.scrollIntoView();
  }, [local.hash]);
  return (
    <>
      <CabecalhoPagina titulo="Ajuda e atalhos" descricao="Contábil Escola — Fase 1 (estrutura, empresa, plano de contas, lançamentos, importação Excel e assistente IA)." />
      <div className="cartao">
        <h2>Atalhos de teclado</h2>
        <div className="tabela-container">
          <table>
            <tbody>
              {ATALHOS.map(([k, d]) => (
                <tr key={k}>
                  <td style={{ width: 160 }}>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="cartao" id="ia">
        <h2>Assistente IA: suas mensagens e e-mails viram lançamentos</h2>
        <p>
          O Claude lê o texto que você fornecer (mensagens, e-mails, extratos, documentos), identifica os fatos contábeis e devolve um <strong>lote de
          lançamentos sugeridos</strong> em JSON. O sistema valida cada sugestão com as mesmas regras da importação Excel (contas analíticas, D = C, período
          aberto, centro de custo) e você aprova uma a uma.
        </p>
        <h3>Três jeitos de usar</h3>
        <ol style={{ paddingLeft: 18 }}>
          <li>
            <strong>Copiar e colar</strong> (qualquer Claude): cole as mensagens, clique em “Copiar prompt”, cole no Claude e traga a resposta de volta.
          </li>
          <li>
            <strong>API direta</strong>: configure sua chave em “Configurar API” e clique em “Analisar com o Claude”.
          </li>
          <li>
            <strong>Claude Cowork</strong> (lê seus e-mails e arquivos): escolha uma pasta de integração; o Cowork, com a skill{' '}
            <code>lancamentos-contabeis</code>, lê o contexto da pasta, gera o lote em <code>entrada/</code> e você revisa aqui.
          </li>
        </ol>
        <p>
          O passo a passo completo — instalação da skill no Cowork, prompts de exemplo e o formato do lote — está em <code>docs/MANUAL-IA.md</code>. A skill
          (o “manual” que o próprio Claude segue) fica em <code>.claude/skills/lancamentos-contabeis/</code>.
        </p>
        <Link className="botao primario" to="/assistente">
          Abrir o Assistente IA
        </Link>
      </div>
      <div className="cartao">
        <h2>Fases do projeto</h2>
        <ol style={{ paddingLeft: 18, margin: 0 }}>
          <li>Estrutura, empresa, plano de contas, lançamentos, importação Excel e assistente IA — <strong>esta versão</strong>.</li>
          <li>Relatórios e demonstrações (Diário, Razão, Balancete, BP, DRE, DMPL, DFC) + fechamento.</li>
          <li>Folha de pagamento + simulação da funcionária fictícia.</li>
          <li>Estoque + NF fictícias.</li>
          <li>Funções adicionais, dashboard e dados de demonstração completos.</li>
        </ol>
      </div>
    </>
  );
}
