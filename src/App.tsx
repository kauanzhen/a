import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { InicioPage } from './modules/inicio/InicioPage';
import { EmpresasPage } from './modules/empresa/EmpresasPage';
import { ExerciciosPage } from './modules/empresa/ExerciciosPage';
import { TabelasFiscaisPage } from './modules/tabelasFiscais/TabelasFiscaisPage';
import { PlanoContasPage } from './modules/planoContas/PlanoContasPage';
import { CentrosCustoPage } from './modules/centrosCusto/CentrosCustoPage';
import { HistoricosPage } from './modules/lancamentos/HistoricosPage';
import { LancamentosPage } from './modules/lancamentos/LancamentosPage';
import { EditorLancamentoPage } from './modules/lancamentos/EditorLancamentoPage';
import { ModelosPage } from './modules/lancamentos/ModelosPage';
import { ImportacaoPage } from './modules/importacao/ImportacaoPage';
import { AssistenteIAPage } from './modules/assistenteIA/AssistenteIAPage';
import { AuditoriaPage } from './modules/auditoria/AuditoriaPage';
import { ConfiguracoesPage } from './modules/configuracoes/ConfiguracoesPage';
import { AjudaPage } from './modules/configuracoes/AjudaPage';
import { useApp } from './hooks/app';

export function App() {
  const { pronto } = useApp();
  if (!pronto) return <div className="vazio">Abrindo o banco de dados local…</div>;
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<InicioPage />} />
        <Route path="/empresas" element={<EmpresasPage />} />
        <Route path="/exercicios" element={<ExerciciosPage />} />
        <Route path="/tabelas-fiscais" element={<TabelasFiscaisPage />} />
        <Route path="/plano-contas" element={<PlanoContasPage />} />
        <Route path="/centros-custo" element={<CentrosCustoPage />} />
        <Route path="/historicos" element={<HistoricosPage />} />
        <Route path="/lancamentos" element={<LancamentosPage />} />
        <Route path="/lancamentos/novo" element={<EditorLancamentoPage />} />
        <Route path="/lancamentos/:id" element={<EditorLancamentoPage />} />
        <Route path="/modelos" element={<ModelosPage />} />
        <Route path="/importacao" element={<ImportacaoPage />} />
        <Route path="/assistente" element={<AssistenteIAPage />} />
        <Route path="/auditoria" element={<AuditoriaPage />} />
        <Route path="/configuracoes" element={<ConfiguracoesPage />} />
        <Route path="/ajuda" element={<AjudaPage />} />
        <Route path="*" element={<div className="vazio">Página não encontrada.</div>} />
      </Routes>
    </Layout>
  );
}
