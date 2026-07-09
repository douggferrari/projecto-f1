// ============================================================================
// HARNESS DE CARREIRA — npm run carreira [nSeeds] [nTemporadas]
// Fase 4: além da progressão (bom × mau gestor), valida:
//   1. RISCO DE ORÇAMENTO: perfis prudente / agressivo / conservador —
//      taxa de demissão + posição média. Agora dá para falhar.
//   2. MERCADO: gate de prestígio (jovem Elite recusa equipe pequena) e
//      efeito Alonso (veterano aceita descer; jovem de mesmo overall não).
//   3. PIPELINE: jovens evoluem, veteranos declinam, aposentam, novatos
//      surgem — o grid nunca esvazia.
// ============================================================================

import { CALENDARIO, CIRCUITOS_POR_ID } from '../src/data/calendario';
import { CHEFES_INICIAIS } from '../src/data/chefes';
import { ANO_INICIAL, EQUIPES_INICIAIS } from '../src/data/equipes';
import { MOTORES_POR_ID } from '../src/data/motores';
import { PATROCINADORES, PATROCINADORES_POR_ID } from '../src/data/patrocinadores';
import { PILOTOS_POR_ID } from '../src/data/pilotos';
import {
  confirmarPreTemporada,
  criarCarreira,
  definirTaticasJogador,
  iniciarPreTemporada,
  rodarClassificacao,
  rodarCorrida,
  type CatalogoCompleto,
  type DecisoesPreTemporada,
} from '../src/engine/carreira';
import { rankingChefes, statusChefe } from '../src/engine/chefes';
import { contratoVigente } from '../src/engine/contratos';
import { gerarRelatorioFimTemporada, aplicarViradaDeAno } from '../src/engine/fimTemporada';
import { tendenciaMotor } from '../src/engine/motorCarreira';
import { estimativaIncidentes } from '../src/engine/incidentes';
import { interessePiloto } from '../src/engine/mercado';
import { gastosFixos, receitaTemporada, formatarDinheiro } from '../src/engine/orcamento';
import { overallAtual, potencialOverall, qualidadeAtual, salarioExigido } from '../src/engine/pilotoCarreira';
import type { EstadoJogo, Equipe, Piloto, TaticaCorrida } from '../src/engine/tipos';
import { pilotoTeste } from '../src/engine/__tests__/fixtures';

const N_SEEDS = Number(process.argv[2] ?? 20);
const N_TEMPORADAS = Number(process.argv[3] ?? 12);
const EQUIPE_INICIAL = 'eq-guarani';

const catalogo: CatalogoCompleto = {
  motores: MOTORES_POR_ID,
  pilotos: PILOTOS_POR_ID,
  patrocinadores: PATROCINADORES_POR_ID,
  circuitos: CIRCUITOS_POR_ID,
};
const calendarioIds = CALENDARIO.map((c) => c.id);
const pct = (x: number, total: number) => ((100 * x) / total).toFixed(0) + '%';

// ---------------------------------------------------------------------------
// Política de contratos compartilhada (estilo "bom gestor" das fases 2-3)
// ---------------------------------------------------------------------------

function jogadorDe(estado: EstadoJogo): Equipe {
  return estado.equipes.find((e) => e.ehJogador)!;
}

function melhorPatrocinador(estado: EstadoJogo): string {
  const prestigio = jogadorDe(estado).prestigio;
  return PATROCINADORES.filter(
    (p) => p.prestigioMinimo <= prestigio && !estado.patrocinadoresBloqueados.includes(p.id)
  ).sort((a, b) => b.aporte - a.aporte)[0].id;
}

function assentosVagos(estado: EstadoJogo): (0 | 1)[] {
  const jogador = jogadorDe(estado);
  return ([0, 1] as const).filter((slot) => !contratoVigente(jogador.pilotos[slot], estado.ano));
}

/** Contratos (motor/pilotos/patrocínio) do perfil; devolve os gastos fixos planejados. */
function decidirContratos(estado: EstadoJogo): { decisoes: DecisoesPreTemporada; fixos: number } {
  const jogador = jogadorDe(estado);
  const patrocinadorId = melhorPatrocinador(estado);
  const receita = receitaTemporada(
    { ...jogador, patrocinadorId },
    catalogo.patrocinadores,
    estado.premiacaoAnterior[jogador.id] ?? 0
  );
  const decisoes: DecisoesPreTemporada = { patrocinadorId, investimento: 0 };
  let fixos = gastosFixos(jogador);

  // Motor: quando expira, o mais potente que custe até 40% da receita
  if (!contratoVigente(jogador.contratoMotor, estado.ano)) {
    fixos -= jogador.contratoMotor.custoAnual;
    const opcoes = Object.values(catalogo.motores).sort((a, b) => b.potencia - a.potencia);
    const escolhido = opcoes.find((m) => m.custoAnualBase * 0.88 <= receita * 0.4) ?? opcoes.at(-1)!;
    decisoes.motor = { motorId: escolhido.id, duracaoAnos: 4 };
    fixos += Math.round(escolhido.custoAnualBase * 0.88);
  }

  // Pilotos: o melhor livre que custe até 15% da receita E ACEITE a equipe
  const nota = (p: Piloto) => 0.4 * p.classificacao + 0.5 * p.corrida + 0.1 * p.confiabilidade;
  const livres = estado.pilotosLivres
    .map((id) => estado.pilotos[id])
    .filter(Boolean)
    .sort((a, b) => nota(b) - nota(a));
  decisoes.pilotos = [];
  for (const slot of assentosVagos(estado)) {
    const aceita = (p: Piloto, salario: number) =>
      interessePiloto(p, jogador, { pilotoId: p.id, salarioAnual: salario, duracaoAnos: 3 }).aceita;
    const escolhido =
      livres.find((p) => p.salarioBase <= receita * 0.15 && aceita(p, p.salarioBase)) ??
      [...livres].sort((a, b) => a.salarioBase - b.salarioBase).find((p) => aceita(p, p.salarioBase));
    if (!escolhido) continue; // sem candidato — o motor acusa erro e a carreira falha alto
    decisoes.pilotos.push({ slot, pilotoId: escolhido.id, duracaoAnos: 3, salarioAnual: escolhido.salarioBase });
    livres.splice(livres.indexOf(escolhido), 1);
    fixos += escolhido.salarioBase;
  }
  return { decisoes, fixos };
}

// ---------------------------------------------------------------------------
// Perfis de ORÇAMENTO: quanto do resíduo vira reserva contra incidentes
// ---------------------------------------------------------------------------

type FatorReserva = number; // multiplicador da estimativa de incidentes
const PERFIS_ORCAMENTO: { nome: string; fatorReserva: FatorReserva }[] = [
  { nome: 'PRUDENTE (reserva a estimativa)', fatorReserva: 1 },
  { nome: 'AGRESSIVO (all-in, sem reserva)', fatorReserva: 0 },
  { nome: 'CONSERVADOR (reserva 2.5×)', fatorReserva: 2.5 },
];

function decidirPreTemporada(estado: EstadoJogo, fatorReserva: FatorReserva): DecisoesPreTemporada {
  const { decisoes, fixos } = decidirContratos(estado);
  const jogador = jogadorDe(estado);
  const receita = receitaTemporada(
    { ...jogador, patrocinadorId: decisoes.patrocinadorId },
    catalogo.patrocinadores,
    estado.premiacaoAnterior[jogador.id] ?? 0
  );
  const disponivel = Math.max(0, receita - fixos - estado.custoRescisaoAno);
  const reserva = Math.round(
    estimativaIncidentes(jogador, estado.pilotos, catalogo.motores, calendarioIds.length) * fatorReserva
  );
  decisoes.investimento = Math.max(0, disponivel - reserva);
  return decisoes;
}

function taticasPadrao(estado: EstadoJogo): [TaticaCorrida, TaticaCorrida] {
  const circuito = catalogo.circuitos[estado.calendario[estado.gpAtual]];
  const stints: TaticaCorrida['stints'] =
    circuito.desgastePneu >= 1.2 ? ['medium', 'hard'] : ['soft', 'hard'];
  const jogador = jogadorDe(estado);
  return [
    { pilotoId: jogador.pilotos[0].pilotoId, paradas: 1, stints },
    { pilotoId: jogador.pilotos[1].pilotoId, paradas: 1, stints },
  ];
}

interface ResumoCarreira {
  posicoes: number[];          // posição por temporada (na equipe da vez)
  demissoes: number;
  encerrada: boolean;
  prestigioFinal: number;
}

function simularCarreira(fatorReserva: FatorReserva, seed: number): ResumoCarreira {
  let estado = criarCarreira(EQUIPE_INICIAL, seed, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL, CHEFES_INICIAIS);
  const resumo: ResumoCarreira = { posicoes: [], demissoes: 0, encerrada: false, prestigioFinal: 0 };

  for (let temporada = 0; temporada < N_TEMPORADAS; temporada++) {
    const r = confirmarPreTemporada(estado, decidirPreTemporada(estado, fatorReserva), catalogo);
    if (r.erros.length > 0) throw new Error(`Pré-temporada inválida (seed ${seed}): ${r.erros.join(' | ')}`);
    estado = r.estado;

    for (let gp = 0; gp < calendarioIds.length; gp++) {
      estado = rodarClassificacao(estado, catalogo);
      estado = rodarCorrida(definirTaticasJogador(estado, taticasPadrao(estado)).estado, catalogo);
    }

    const relatorio = gerarRelatorioFimTemporada(estado, catalogo);
    resumo.posicoes.push(relatorio.jogador.posicao);
    if (relatorio.financeiro.demitido) resumo.demissoes++;

    estado = aplicarViradaDeAno(estado, catalogo); // demitido → melhor oferta; convites → recusa
    if (estado.fase === 'fim-carreira') {
      resumo.encerrada = true;
      break;
    }
    estado = iniciarPreTemporada(estado, catalogo);
  }
  resumo.prestigioFinal = jogadorDe(estado).prestigio;
  return resumo;
}

// ---------------------------------------------------------------------------
// 1) Tabela dos perfis de orçamento
// ---------------------------------------------------------------------------

console.log(`HARNESS DE CARREIRA — Fase 4 (${N_SEEDS} seeds × ${N_TEMPORADAS} temporadas, início: Guarani GP)`);
console.log('\n=== 1. RISCO DE ORÇAMENTO — três perfis ===');
console.log('Perfil                            | pos T1-3 | pos T6-8 | pos T10-12 | ≥1 demissão | carreira encerrada | prestígio final');
console.log('----------------------------------|----------|----------|------------|-------------|--------------------|---------------');

for (const perfil of PERFIS_ORCAMENTO) {
  const carreiras = Array.from({ length: N_SEEDS }, (_, seed) => simularCarreira(perfil.fatorReserva, seed));
  const mediaFaixa = (de: number, ate: number) => {
    const valores = carreiras.flatMap((c) => c.posicoes.slice(de, ate));
    return valores.length ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1) : '—';
  };
  const comDemissao = carreiras.filter((c) => c.demissoes > 0).length;
  const encerradas = carreiras.filter((c) => c.encerrada).length;
  const prestigioMedio =
    carreiras.reduce((a, c) => a + c.prestigioFinal, 0) / carreiras.length;
  console.log(
    `${perfil.nome.padEnd(33)} | ${mediaFaixa(0, 3).padStart(8)} | ${mediaFaixa(5, 8).padStart(8)} | ${mediaFaixa(9, 12).padStart(10)} | ${pct(comDemissao, N_SEEDS).padStart(11)} | ${pct(encerradas, N_SEEDS).padStart(18)} | ${prestigioMedio.toFixed(0).padStart(14)}`
  );
}

// ---------------------------------------------------------------------------
// 2) Provas do mercado: gate de prestígio + efeito Alonso
// ---------------------------------------------------------------------------

console.log('\n=== 2. MERCADO — gate de prestígio e efeito Alonso ===');

function pilotoSintetico(idade: number, potencial: number, reputacao: number): Piloto {
  const base = { idade, potencialClassificacao: potencial, potencialCorrida: potencial, confiabilidadeBase: 75 };
  const q = qualidadeAtual(base);
  const p = pilotoTeste({ id: `sint-${idade}-${potencial}`, reputacao, ...base, ...q });
  return { ...p, salarioBase: salarioExigido(p) };
}

const jovemElite = pilotoSintetico(22, 92, 30);
const veterano = pilotoSintetico(38, 92, 95);
const jovemMesmoOverall = pilotoSintetico(24, 88, 30);

console.log(`Jovem Elite (22 anos, potencial 92) × equipe prestígio 35, salário 3×: ` +
  (interessePiloto(jovemElite, { prestigio: 35 }, { pilotoId: jovemElite.id, salarioAnual: jovemElite.salarioBase * 3, duracaoAnos: 3 }).aceita ? 'ACEITA (!!)' : 'RECUSA ✓'));
for (const prestigio of [45, 55, 65, 75, 88]) {
  const aceita = interessePiloto(jovemElite, { prestigio }, { pilotoId: jovemElite.id, salarioAnual: jovemElite.salarioBase, duracaoAnos: 3 }).aceita;
  console.log(`  ... equipe prestígio ${prestigio}, salário de mercado: ${aceita ? 'ACEITA' : 'recusa'}`);
}

const overallVet = overallAtual(veterano).toFixed(1);
const overallJov = overallAtual(jovemMesmoOverall).toFixed(1);
const ofertaVet = { pilotoId: veterano.id, salarioAnual: Math.round(veterano.salarioBase * 1.4), duracaoAnos: 2 };
const ofertaJov = { pilotoId: jovemMesmoOverall.id, salarioAnual: Math.round(jovemMesmoOverall.salarioBase * 1.4), duracaoAnos: 2 };
console.log(`\nEfeito Alonso (equipe ofertante: prestígio 35; ambos empregados em equipe prestígio 60; salário 1.4×):`);
console.log(`  Veterano 38 anos, reputação 95, overall atual ${overallVet} (exige ${formatarDinheiro(veterano.salarioBase)}): ` +
  (interessePiloto(veterano, { prestigio: 35 }, ofertaVet, { prestigio: 60 }).aceita ? 'ACEITA ✓' : 'recusa (!!)'));
console.log(`  Jovem 24 anos, reputação 30, overall atual ${overallJov} (exige ${formatarDinheiro(jovemMesmoOverall.salarioBase)}): ` +
  (interessePiloto(jovemMesmoOverall, { prestigio: 35 }, ofertaJov, { prestigio: 60 }).aceita ? 'ACEITA (!!)' : 'RECUSA ✓'));

// ---------------------------------------------------------------------------
// 3) Pipeline: arco de carreira numa carreira de 12 temporadas
// ---------------------------------------------------------------------------

console.log('\n=== 3. PIPELINE — grid vivo ao longo de 12 temporadas (seed 0, perfil prudente) ===');
{
  let estado = criarCarreira(EQUIPE_INICIAL, 0, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL, CHEFES_INICIAIS);
  console.log('Ano  | ativos | aposentados | novatos no pool | promessas (pot ≥ 82, <25 anos) | idade média');
  for (let temporada = 0; temporada < N_TEMPORADAS; temporada++) {
    const r = confirmarPreTemporada(estado, decidirPreTemporada(estado, 1), catalogo);
    estado = r.estado;
    for (let gp = 0; gp < calendarioIds.length; gp++) {
      estado = rodarClassificacao(estado, catalogo);
      estado = rodarCorrida(definirTaticasJogador(estado, taticasPadrao(estado)).estado, catalogo);
    }
    const ativos = Object.values(estado.pilotos).filter((p) => !p.aposentado);
    const aposentados = Object.values(estado.pilotos).filter((p) => p.aposentado).length;
    const novatos = ativos.filter((p) => p.id.startsWith('pil-nov')).length;
    const promessas = ativos.filter((p) => p.idade < 25 && potencialOverall(p) >= 82).length;
    const idadeMedia = ativos.reduce((a, p) => a + p.idade, 0) / ativos.length;
    console.log(
      `${estado.ano} | ${String(ativos.length).padStart(6)} | ${String(aposentados).padStart(11)} | ${String(novatos).padStart(15)} | ${String(promessas).padStart(30)} | ${idadeMedia.toFixed(1).padStart(11)}`
    );
    estado = aplicarViradaDeAno(estado, catalogo);
    if (estado.fase === 'fim-carreira') break;
    estado = iniciarPreTemporada(estado, catalogo);
  }

  // -------------------------------------------------------------------------
  // 4) Fase 6 — motores que evoluem (na MESMA carreira de 12 temporadas)
  // -------------------------------------------------------------------------
  console.log('\n=== 4. MOTORES — evolução em 12 temporadas (seed 0) ===');
  console.log('Fornecedor            | pot 2026 → hoje | Δ     | conf 2026 → hoje | tendência');
  for (const id of Object.keys(estado.motores).sort()) {
    const motor = estado.motores[id];
    const inicial = catalogo.motores[id];
    const delta = motor.potencia - inicial.potencia;
    const seta = { subindo: '▲', estavel: '▬', caindo: '▼' }[tendenciaMotor(motor)];
    console.log(
      `${motor.nome.padEnd(21)} | ${String(inicial.potencia).padStart(8)} → ${String(motor.potencia).padStart(4)} | ${(delta >= 0 ? '+' : '') + delta.toFixed(1).padStart(4)} | ${String(inicial.confiabilidade).padStart(9)} → ${String(motor.confiabilidade).padStart(4)} | ${seta}`
    );
  }

  // -------------------------------------------------------------------------
  // 5) Fase 6 — ranking de chefes após 12 temporadas
  // -------------------------------------------------------------------------
  console.log('\n=== 5. CHEFES — ranking de reputação após 12 temporadas (seed 0) ===');
  for (const chefe of rankingChefes(estado.chefes).slice(0, 10)) {
    const equipe = estado.equipes.find((e) => e.chefeId === chefe.id);
    const ultima = chefe.historico.at(-1);
    console.log(
      `${chefe.nome.padEnd(20)} rep ${String(Math.round(chefe.reputacao)).padStart(3)} | ${String(chefe.campeonatosVencidos)} título(s) → ${statusChefe(chefe.campeonatosVencidos, chefe.historico.length).padEnd(12)} | ${equipe?.nome ?? '—'}${ultima ? ` | último ano: P${ultima.posicaoConstrutores}` : ''}`
    );
  }

  // Amostra de histórico de um piloto de ponta
  const comTitulos = Object.values(estado.pilotos)
    .filter((p) => (p.historico?.length ?? 0) > 0)
    .sort((a, b) => (b.titulosCarreira ?? 0) - (a.titulosCarreira ?? 0))[0];
  if (comTitulos) {
    console.log(`\nHistórico de ${comTitulos.nome} (${comTitulos.titulosCarreira ?? 0} título(s), ${comTitulos.vitoriasCarreira ?? 0} vitórias):`);
    for (const t of (comTitulos.historico ?? []).slice(-6)) {
      console.log(`  ${t.ano}: P${t.posicaoCampeonato}${t.campeao ? ' 🏆' : ''} (${t.equipeId})`);
    }
  }
}
console.log();
