import { useState } from 'react';
import { CabecalhoPagina, Campo } from '../../components/ui';
import { apagarTudo, gerarBackup, restaurarBackup, validarBackup } from '../../db/backup';
import { useAcao, useApp, type Tema } from '../../hooks/app';
import { hojeISO } from '../../lib/date';
import { baixarArquivo } from '../assistenteIA/pastaIntegracao';

export function ConfiguracoesPage() {
  const { usuario, definirUsuario, tema, definirTema, modoDidatico, definirModoDidatico, confirmar, avisar } = useApp();
  const acao = useAcao();
  const [nome, setNome] = useState(usuario);

  async function backup() {
    const b = await gerarBackup();
    const total = Object.values(b.tabelas).reduce((s, t) => s + t.length, 0);
    baixarArquivo(`backup-contabil-escola-${hojeISO()}.json`, JSON.stringify(b, null, 1));
    avisar(`Backup gerado com ${total} registro(s).`, 'sucesso');
  }

  async function restaurar(f: File) {
    let obj: unknown;
    try {
      obj = JSON.parse(await f.text());
    } catch {
      avisar('O arquivo não é um JSON válido.', 'erro');
      return;
    }
    const erros = validarBackup(obj);
    if (erros.length) {
      avisar(erros.join('\n'), 'erro');
      return;
    }
    const ok = await confirmar({
      titulo: 'Restaurar backup',
      mensagem: (
        <p>
          Todos os dados atuais deste navegador serão <strong>substituídos</strong> pelos do arquivo <strong>{f.name}</strong>. Continuar?
        </p>
      ),
      textoConfirmar: 'Restaurar',
      perigo: true,
    });
    if (ok && (await acao(async () => (await restaurarBackup(obj), true), 'Backup restaurado.'))) {
      setTimeout(() => window.location.reload(), 600);
    }
  }

  return (
    <>
      <CabecalhoPagina titulo="Configurações e backup" />
      <div className="grade">
        <div className="cartao">
          <h2>Preferências</h2>
          <div className="form-grade">
            <Campo rotulo="Seu nome (aparece na trilha de auditoria)" className="col-12">
              <div className="acoes" style={{ flexWrap: 'nowrap' }}>
                <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ flex: 1 }} />
                <button onClick={() => (definirUsuario(nome), avisar('Nome salvo.', 'sucesso'))}>Salvar</button>
              </div>
            </Campo>
            <Campo rotulo="Tema" className="col-6">
              <select value={tema} onChange={(e) => definirTema(e.target.value as Tema)}>
                <option value="sistema">Igual ao sistema</option>
                <option value="claro">Claro</option>
                <option value="escuro">Escuro</option>
              </select>
            </Campo>
            <div className="col-6" style={{ alignSelf: 'end' }}>
              <label className="check">
                <input type="checkbox" checked={modoDidatico} onChange={(e) => definirModoDidatico(e.target.checked)} />
                Modo didático (explica o efeito de cada lançamento)
              </label>
            </div>
          </div>
        </div>
        <div className="cartao">
          <h2>Backup e restauração</h2>
          <p>
            Os dados ficam só neste navegador (IndexedDB). Faça backups com frequência: limpar os dados do navegador apaga tudo. A chave de API e a pasta de
            integração não vão para o backup.
          </p>
          <div className="acoes">
            <button className="primario" onClick={backup}>
              Baixar backup completo (JSON)
            </button>
            <label className="botao">
              Restaurar backup…
              <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && restaurar(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="cartao">
          <h2>Zona de perigo</h2>
          <p>Apaga todas as empresas e dados deste navegador.</p>
          <button
            className="perigo"
            onClick={async () => {
              const ok = await confirmar({ titulo: 'Apagar tudo', mensagem: 'Apagar TODOS os dados deste navegador? Faça um backup antes.', perigo: true, textoConfirmar: 'Apagar tudo' });
              if (ok && (await acao(async () => (await apagarTudo(), true)))) window.location.reload();
            }}
          >
            Apagar todos os dados
          </button>
        </div>
      </div>
    </>
  );
}
