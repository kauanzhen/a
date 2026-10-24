"use strict";
/* ================================================================
   Painel de Controle de Tempo — lógica da interface (PT-BR).
   Conversa com a API do serviço local. Sem bibliotecas externas.
   ================================================================ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let usuarioEmUsoId = null;   // id do usuário logado no PC (para ajustar tempo)
let timerPolling = null;

// ---------- Helper de requisição ----------
async function api(url, metodo = "GET", corpo = null) {
  const opc = { method: metodo, headers: {}, credentials: "same-origin" };
  if (corpo !== null) { opc.headers["Content-Type"] = "application/json"; opc.body = JSON.stringify(corpo); }
  const r = await fetch(url, opc);
  if (r.status === 401) { mostrarLogin(); throw new Error("nao-autenticado"); }
  if (!r.ok) {
    let msg = "Erro na requisição.";
    try { const j = await r.json(); msg = j.erro || msg; } catch {}
    throw new Error(msg);
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : r.text();
}

function toast(texto) {
  const t = $("#aviso-topo");
  t.textContent = texto;
  t.classList.remove("oculto");
  clearTimeout(t._tempo);
  t._tempo = setTimeout(() => t.classList.add("oculto"), 2800);
}

function fmtMin(seg) {
  const m = Math.round(seg / 60);
  if (m < 60) return m + " min";
  return Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
}

// ================================================================
//  LOGIN / PRIMEIRO ACESSO
// ================================================================
async function iniciar() {
  try {
    const s = await api("/api/status-inicial");
    if (s.configurado) { $("#form-login").classList.remove("oculto"); }
    else { $("#form-admin").classList.remove("oculto"); }
  } catch { $("#form-login").classList.remove("oculto"); }
}

function mostrarLogin() {
  pararPolling();
  $("#app").classList.add("oculto");
  $("#tela-login").classList.remove("oculto");
  $("#form-login").classList.remove("oculto");
}

$("#form-admin").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#admin-erro").textContent = "";
  try {
    await api("/api/definir-admin", "POST", {
      senha: $("#admin-senha").value, confirmacao: $("#admin-confirma").value
    });
    toast("Senha definida! Faça login.");
    $("#form-admin").classList.add("oculto");
    $("#form-login").classList.remove("oculto");
  } catch (err) { $("#admin-erro").textContent = err.message; }
});

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-erro").textContent = "";
  try {
    await api("/api/login", "POST", { senha: $("#login-senha").value });
    entrarApp();
  } catch (err) {
    $("#login-erro").textContent = err.message === "nao-autenticado" ? "Senha incorreta." : err.message;
  }
});

$("#btn-sair").addEventListener("click", async () => {
  try { await api("/api/logout", "POST"); } catch {}
  mostrarLogin();
});

function entrarApp() {
  $("#tela-login").classList.add("oculto");
  $("#app").classList.remove("oculto");
  $("#login-senha").value = "";
  trocarAba("painel");
  carregarUsuarios();
  iniciarPolling();
}

// ================================================================
//  ABAS
// ================================================================
$$(".aba").forEach(b => b.addEventListener("click", () => trocarAba(b.dataset.aba)));

function trocarAba(nome) {
  $$(".aba").forEach(a => a.classList.toggle("ativa", a.dataset.aba === nome));
  $$(".pagina").forEach(p => p.classList.toggle("oculto", p.id !== nome));
  if (nome === "usuarios") carregarUsuarios();
  if (nome === "pedidos") carregarPedidos();
  if (nome === "relatorios") carregarRelatorios();
  if (nome === "config") carregarConfig();
}

// ================================================================
//  POLLING DO ESTADO AO VIVO
// ================================================================
function iniciarPolling() { pararPolling(); atualizarEstado(); timerPolling = setInterval(atualizarEstado, 2000); }
function pararPolling() { if (timerPolling) clearInterval(timerPolling); timerPolling = null; }

const ESTADOS = { 0: ["Ocioso", "ocioso"], 1: ["Em uso", "uso"], 2: ["Pausado", "pausado"], 3: ["Bloqueado", "bloqueado"] };
const CORES = { 0: "verde", 1: "amarelo", 2: "laranja", 3: "vermelho" };

async function atualizarEstado() {
  let e;
  try { e = await api("/api/estado"); } catch { return; }
  usuarioEmUsoId = e.usuarioId;

  const [rotulo, cls] = ESTADOS[e.estado] || ["—", "ocioso"];
  const pill = $("#status-estado");
  pill.textContent = e.pausada && e.estado === 2 ? "Pausado" : rotulo;
  pill.className = "pill " + cls;

  $("#status-usuario").textContent = e.usuarioId
    ? e.nomeUsuario : "Ninguém usando o computador";
  $("#status-tempo").textContent = e.usuarioId ? e.restanteFormatado : "--:--";
  $("#status-tempo").className = "timer-grande " + (e.usuarioId ? CORES[e.cor] : "");
  $("#status-modo").textContent = e.usuarioId
    ? (e.modo === 1 ? "Modo: créditos" : "Modo: tempo limite") +
      (e.segundosInativo > 2 ? ` · inativo há ${e.segundosInativo}s` : "")
    : "";
  $("#status-atualizado").textContent = new Date().toLocaleTimeString("pt-BR");
  $("#ajuste-aviso").textContent = e.usuarioId
    ? `Ajustando: ${e.nomeUsuario}` : "Ninguém em uso — os ajustes rápidos ficam indisponíveis.";

  // Badge de pedidos pendentes.
  const badge = $("#badge-pedidos");
  if (e.pedidosPendentes > 0) { badge.textContent = e.pedidosPendentes; badge.classList.remove("oculto"); }
  else badge.classList.add("oculto");
}

// ---------- Ações rápidas ----------
$$("[data-acao]").forEach(b => b.addEventListener("click", async () => {
  const mapa = { bloquear: "bloquear", liberar: "liberar", pausar: "pausar", retomar: "retomar", encerrar: "encerrar" };
  try { await api("/api/controle/" + mapa[b.dataset.acao], "POST"); toast("Comando enviado."); atualizarEstado(); }
  catch (e) { toast(e.message); }
}));

$$("[data-add]").forEach(b => b.addEventListener("click", async () => {
  if (!usuarioEmUsoId) { toast("Ninguém em uso."); return; }
  const min = parseInt(b.dataset.add, 10);
  const url = min >= 0 ? `/api/usuarios/${usuarioEmUsoId}/adicionar` : `/api/usuarios/${usuarioEmUsoId}/remover`;
  try { await api(url, "POST", { minutos: Math.abs(min) }); toast((min >= 0 ? "+" : "-") + Math.abs(min) + " min"); atualizarEstado(); }
  catch (e) { toast(e.message); }
}));

// ================================================================
//  USUÁRIOS
// ================================================================
const ACOES_TXT = { 0: "Bloquear tela", 1: "Logoff", 2: "Suspender", 3: "Desligar", 4: "Apenas avisar" };

async function carregarUsuarios() {
  let lista;
  try { lista = await api("/api/usuarios"); } catch { return; }
  const cont = $("#lista-usuarios");
  cont.innerHTML = "";
  if (!lista.length) { cont.innerHTML = '<p class="mini">Nenhum usuário. Crie o primeiro.</p>'; return; }
  for (const u of lista) {
    const div = document.createElement("div");
    div.className = "item";
    const modo = u.modo === 1 ? "Créditos" : "Tempo limite";
    div.innerHTML = `
      <div class="info">
        <b>${escapar(u.nome)} ${u.ativo ? "" : "⏸️"}</b>
        <span class="mini">${modo} · resta ${fmtMin(u.restanteSegundos)} · esgota: ${ACOES_TXT[u.acaoAoEsgotar]}</span>
      </div>
      <div class="acoes">
        <button class="btn chip" data-edit="${u.id}">Editar</button>
        <button class="btn chip perigo" data-del="${u.id}">Excluir</button>
      </div>`;
    cont.appendChild(div);
  }
  cont.querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => abrirModalUsuario(lista.find(x => x.id == b.dataset.edit))));
  cont.querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => excluirUsuario(b.dataset.del)));
}

function escapar(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

async function excluirUsuario(id) {
  if (!confirm("Excluir este usuário? O histórico de sessões é mantido.")) return;
  try { await api("/api/usuarios/" + id, "DELETE"); toast("Usuário excluído."); carregarUsuarios(); }
  catch (e) { toast(e.message); }
}

$("#btn-novo-usuario").addEventListener("click", () => abrirModalUsuario(null));
$("#btn-cancelar").addEventListener("click", () => $("#modal-usuario").classList.add("oculto"));
$("#u-modo").addEventListener("change", ajustarCamposModo);

function ajustarCamposModo() {
  const credito = $("#u-modo").value === "1";
  $("#campo-limite").classList.toggle("oculto", credito);
  $("#campo-saldo").classList.toggle("oculto", !credito);
}

function abrirModalUsuario(u) {
  $("#usuario-erro").textContent = "";
  $("#modal-titulo").textContent = u ? "Editar usuário" : "Novo usuário";
  $("#u-id").value = u ? u.id : "";
  $("#u-nome").value = u ? u.nome : "";
  $("#u-senha").value = "";
  $("#u-modo").value = u ? u.modo : 0;
  $("#u-limite").value = u ? Math.round(u.limiteDiarioSegundos / 60) : 120;
  $("#u-saldo").value = u ? Math.round(u.saldoCreditosSegundos / 60) : 0;
  $("#u-acao").value = u ? u.acaoAoEsgotar : 0;
  $("#u-inatividade").value = u ? u.inatividadePausaSegundos : 120;
  $("#u-horarios").value = u ? u.horariosPermitidos : "";
  $("#u-pedir").checked = u ? u.podePedirTempo : true;
  $("#u-ativo").checked = u ? u.ativo : true;
  ajustarCamposModo();
  $("#modal-usuario").classList.remove("oculto");
}

$("#form-usuario").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#usuario-erro").textContent = "";
  const dto = {
    id: parseInt($("#u-id").value || "0", 10),
    nome: $("#u-nome").value.trim(),
    senha: $("#u-senha").value || null,
    modo: parseInt($("#u-modo").value, 10),
    limiteDiarioSegundos: parseInt($("#u-limite").value || "0", 10) * 60,
    saldoCreditosSegundos: parseInt($("#u-saldo").value || "0", 10) * 60,
    acaoAoEsgotar: parseInt($("#u-acao").value, 10),
    inatividadePausaSegundos: parseInt($("#u-inatividade").value || "0", 10),
    podePedirTempo: $("#u-pedir").checked,
    horariosPermitidos: $("#u-horarios").value.trim(),
    ativo: $("#u-ativo").checked
  };
  try {
    await api("/api/usuarios", "POST", dto);
    $("#modal-usuario").classList.add("oculto");
    toast("Usuário salvo.");
    carregarUsuarios();
  } catch (err) { $("#usuario-erro").textContent = err.message; }
});

// ================================================================
//  PEDIDOS
// ================================================================
async function carregarPedidos() {
  let lista;
  try { lista = await api("/api/pedidos"); } catch { return; }
  const cont = $("#lista-pedidos");
  cont.innerHTML = "";
  $("#pedidos-vazio").classList.toggle("oculto", lista.length > 0);
  for (const p of lista) {
    const div = document.createElement("div");
    div.className = "item";
    const quando = new Date(p.quandoUtc).toLocaleString("pt-BR");
    div.innerHTML = `
      <div class="info">
        <b>${escapar(p.nome)} pediu +${p.minutosSolicitados} min</b>
        <span class="mini">${escapar(p.mensagem || "(sem mensagem)")} · ${quando}</span>
      </div>
      <div class="acoes">
        <button class="btn chip sucesso" data-aprovar="${p.id}" data-min="${p.minutosSolicitados}">Aprovar</button>
        <button class="btn chip perigo" data-negar="${p.id}">Negar</button>
      </div>`;
    cont.appendChild(div);
  }
  cont.querySelectorAll("[data-aprovar]").forEach(b => b.addEventListener("click", async () => {
    const min = prompt("Quantos minutos conceder?", b.dataset.min);
    if (min === null) return;
    await responderPedido(b.dataset.aprovar, true, parseInt(min, 10));
  }));
  cont.querySelectorAll("[data-negar]").forEach(b =>
    b.addEventListener("click", () => responderPedido(b.dataset.negar, false, 0)));
}

async function responderPedido(id, aprovar, minutos) {
  try {
    await api(`/api/pedidos/${id}/responder`, "POST", { aprovar, minutos });
    toast(aprovar ? "Pedido aprovado." : "Pedido negado.");
    carregarPedidos(); atualizarEstado();
  } catch (e) { toast(e.message); }
}

// ================================================================
//  RELATÓRIOS (gráficos em canvas, sem bibliotecas)
// ================================================================
$("#rel-dias").addEventListener("change", carregarRelatorios);
$("#btn-csv").addEventListener("click", (e) => { e.preventDefault(); baixarCsv(); });

async function carregarRelatorios() {
  const dias = parseInt($("#rel-dias").value, 10);
  let r;
  try { r = await api("/api/relatorios?dias=" + dias); } catch { return; }

  desenharBarras($("#grafico-dia"), r.porDia.map(d => d.dia), r.porDia.map(d => d.minutos), "#3b82f6");
  desenharBarras($("#grafico-usuarios"),
    r.porUsuario.map(u => u.nome), r.porUsuario.map(u => Math.round(u.segMes / 60)), "#22c55e");
  desenharBarras($("#grafico-horas"),
    r.porHora.map(h => h.hora), r.porHora.map(h => h.minutos), "#f59e0b");

  // Tabela de sessões recentes.
  const linhas = r.sessoesRecentes.map(s => `
    <tr>
      <td>${escapar(s.nome)}</td>
      <td>${new Date(s.inicioUtc).toLocaleString("pt-BR")}</td>
      <td>${s.fimUtc ? new Date(s.fimUtc).toLocaleTimeString("pt-BR") : "(aberta)"}</td>
      <td>${fmtMin(s.consumidoSegundos)}</td>
      <td>${s.encerradaPorEsgotamento ? "esgotou" : "—"}</td>
    </tr>`).join("");
  $("#tabela-sessoes").innerHTML = `
    <table><thead><tr><th>Usuário</th><th>Início</th><th>Fim</th><th>Usado</th><th>Obs.</th></tr></thead>
    <tbody>${linhas || '<tr><td colspan="5">Sem sessões no período.</td></tr>'}</tbody></table>`;
}

function baixarCsv() {
  const dias = parseInt($("#rel-dias").value, 10);
  window.open("/api/exportar/csv?dias=" + dias, "_blank");
}

// Desenha um gráfico de barras simples responsivo no canvas.
function desenharBarras(canvas, rotulos, valores, cor) {
  const ctx = canvas.getContext("2d");
  const larg = canvas.clientWidth || 320;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = larg * dpr; canvas.height = canvas.height; // mantém altura do HTML
  const h = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, larg, h);

  const max = Math.max(1, ...valores);
  const padInf = 22, padSup = 8, padLat = 6;
  const areaAlt = h - padInf - padSup;
  const n = valores.length || 1;
  const passo = (larg - padLat * 2) / n;
  const barraLarg = Math.max(2, passo * 0.6);

  ctx.font = "9px system-ui";
  ctx.textAlign = "center";
  for (let i = 0; i < valores.length; i++) {
    const v = valores[i];
    const altBarra = (v / max) * areaAlt;
    const x = padLat + i * passo + passo / 2;
    const y = padSup + areaAlt - altBarra;
    ctx.fillStyle = cor;
    ctx.fillRect(x - barraLarg / 2, y, barraLarg, altBarra);
    // Rótulo do eixo X (mostra 1 a cada k para não poluir).
    const k = Math.ceil(n / 12);
    if (i % k === 0) { ctx.fillStyle = "#94a3b8"; ctx.fillText(rotulos[i], x, h - 8); }
  }
  // Valor máximo no topo.
  ctx.fillStyle = "#64748b"; ctx.textAlign = "left";
  ctx.fillText("máx: " + max + " min", 4, 10);
}

// ================================================================
//  AJUSTES
// ================================================================
async function carregarConfig() {
  let c;
  try { c = await api("/api/config"); } catch { return; }
  $("#cfg-avisos").value = c.avisosMinutos;
  $("#cfg-som").checked = c.avisoSonoro;
  $("#cfg-push").checked = c.notificacoesPush;
  $("#cfg-backup").checked = c.backupAutomatico;
  $("#cfg-porta").value = c.portaWeb;
  $("#cfg-https").checked = c.usarHttps;
  $("#cfg-atalho").value = c.atalhoEmergencia;
}

$("#form-config").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dto = {
    portaWeb: parseInt($("#cfg-porta").value, 10),
    usarHttps: $("#cfg-https").checked,
    avisosMinutos: $("#cfg-avisos").value,
    avisoSonoro: $("#cfg-som").checked,
    notificacoesPush: $("#cfg-push").checked,
    backupAutomatico: $("#cfg-backup").checked,
    atalhoEmergencia: $("#cfg-atalho").value
  };
  try { const r = await api("/api/config", "PUT", dto); $("#config-aviso").textContent = r.aviso || "Salvo."; toast("Ajustes salvos."); }
  catch (err) { toast(err.message); }
});

// ---------- Início ----------
iniciar();
