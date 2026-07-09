// ============================================================================
// Fim de temporada — funções puras (reescrito na Fase 4).
// Ordem de aplicação (aplicarViradaDeAno):
//   1. premiação por posição no construtores (+ meta de patrocínio do jogador)
//   2. desenvolvimento do carro (ciclo de 5 anos)
//   3. balanço financeiro do jogador (incidentes/rescisão) → aviso/vermelho/demissão
//   4. reputação do chefe e PRESTÍGIO de todas as equipes
//   5. pilotos: reputação por resultados, envelhecimento, aposentadorias, novatos
//   6. convites (ou ofertas de emprego, se demitido) e troca de equipe
//   7. expiração de contratos → pool; virada do ano
// ============================================================================

import {
  EXPECTATIVA_POR_TIER,
  FATOR_REPUTACAO_CONVITE,
  FOLGA_EXPECTATIVA_POSICAO_ANTERIOR,
  LIMIAR_DEFICIT_GRAVE,
  LIMIAR_DEFICIT_LEVE,
  PREMIACAO_CONSTRUTORES,
  PRESTIGIO_DELTA_MAXIMO,
  PRESTIGIO_MAXIMO,
  PRESTIGIO_MINIMO,
  PRESTIGIO_POR_POSICAO,
  QUEDA_REPUTACAO_DEFICIT_LEVE,
  QUEDA_REPUTACAO_DEFICIT_VERMELHO,
  REPUTACAO_DELTA_MAXIMO,
  REPUTACAO_MINIMA_EMPREGO,
  REPUTACAO_POR_POSICAO,
} from './constantes';
import { contratoVigente, pilotosLivres } from './contratos';
import { aplicarDesenvolvimento, limitar0a100 } from './desempenho';
import type { CatalogoJogo } from './gestaoIA';
import { gastosFixos, receitaTemporada } from './orcamento';
import {
  envelhecerPiloto,
  gerarNovatos,
  reputacaoDaTemporada,
  sorteiaAposentadoria,
} from './pilotoCarreira';
import { classificarCampeonato } from './pontuacao';
import { criarRng, derivarSeed } from './rng';
import type { EstadoJogo, Equipe } from './tipos';

export type SituacaoFinanceira = 'ok' | 'aviso' | 'vermelho';

export interface FinanceiroFimTemporada {
  receita: number;
  gastosFixos: number;
  investimento: number;
  incidentes: number;
  rescisao: number;
  saldo: number;
  situacao: SituacaoFinanceira;
  demitido: boolean;
  carreiraEncerrada: boolean; // demitido e sem nenhuma oferta de emprego
}

export interface RelatorioFimTemporada {
  classificacao: { equipeId: string; pontos: number; posicao: number }[];
  premiacoes: Record<string, number>;
  jogador: {
    posicao: number;
    expectativa: number;
    reputacaoAntes: number;
    reputacaoDepois: number;
    metaPatrocinio?: { patrocinadorId: string; cumprida: boolean; bonus: number };
  };
  financeiro: FinanceiroFimTemporada;
  /** Prestígio de cada equipe: antes → depois. */
  prestigio: Record<string, { antes: number; depois: number }>;
  /** Convites de equipes de prestígio igual/maior (se NÃO demitido). */
  convites: string[];
  /** Ofertas de emprego de prestígio igual/menor (se demitido). */
  ofertasEmprego: string[];
  saltoRegulamento: boolean;
}

function equipeJogador(estado: EstadoJogo): Equipe {
  return estado.equipes.find((e) => e.id === estado.equipeJogadorId)!;
}

/** Posições finais do construtores (equipes sem ponto entram no fim). */
export function classificacaoConstrutores(
  estado: EstadoJogo
): { equipeId: string; pontos: number; posicao: number }[] {
  const pontuadas = classificarCampeonato(estado.campeonatoConstrutores);
  const idsPontuados = new Set(pontuadas.map((p) => p.id));
  const semPonto = estado.equipes.filter((e) => !idsPontuados.has(e.id));
  return [
    ...pontuadas.map((p) => ({ equipeId: p.id, pontos: p.pontos })),
    ...semPonto.map((e) => ({ equipeId: e.id, pontos: 0 })),
  ].map((x, i) => ({ ...x, posicao: i + 1 }));
}

/** Expectativa do chefe: a do tier, endurecida pela posição anterior com folga. */
export function expectativaJogador(estado: EstadoJogo): number {
  const base = EXPECTATIVA_POR_TIER[equipeJogador(estado).tier];
  return estado.posicaoAnteriorJogador !== undefined
    ? Math.min(base, estado.posicaoAnteriorJogador + FOLGA_EXPECTATIVA_POSICAO_ANTERIOR)
    : base;
}

/** Expectativa de cada equipe = posição dela no ranking de prestígio do grid. */
export function expectativaPorPrestigio(equipes: Equipe[]): Record<string, number> {
  const ordenadas = [...equipes].sort((a, b) => b.prestigio - a.prestigio);
  return Object.fromEntries(ordenadas.map((e, i) => [e.id, i + 1]));
}

/**
 * Gera o relatório do fim de temporada (leitura pura — nada é aplicado).
 * A UI mostra este relatório; aplicarViradaDeAno() efetiva tudo.
 */
export function gerarRelatorioFimTemporada(
  estado: EstadoJogo,
  catalogo: CatalogoJogo
): RelatorioFimTemporada {
  const classificacao = classificacaoConstrutores(estado);
  const jogador = equipeJogador(estado);
  const posicaoJogador = classificacao.find((c) => c.equipeId === jogador.id)!.posicao;

  // 1. Premiações
  const premiacoes: Record<string, number> = {};
  for (const { equipeId, posicao } of classificacao) {
    premiacoes[equipeId] = PREMIACAO_CONSTRUTORES[posicao - 1] ?? PREMIACAO_CONSTRUTORES.at(-1)!;
  }

  // Meta de patrocínio (só do jogador)
  const patrocinador = catalogo.patrocinadores[jogador.patrocinadorId];
  let metaPatrocinio: RelatorioFimTemporada['jogador']['metaPatrocinio'];
  if (patrocinador?.meta) {
    const cumprida = posicaoJogador <= patrocinador.meta.posicaoConstrutoresMax;
    metaPatrocinio = {
      patrocinadorId: patrocinador.id,
      cumprida,
      bonus: cumprida ? patrocinador.meta.bonus : 0,
    };
    if (cumprida) premiacoes[jogador.id] += patrocinador.meta.bonus;
  }

  // 3. Balanço financeiro do jogador
  const receita = receitaTemporada(jogador, catalogo.patrocinadores, estado.premiacaoAnterior[jogador.id] ?? 0);
  const fixos = gastosFixos(jogador);
  const investimento = estado.investimentosAno[jogador.id] ?? 0;
  const incidentes = estado.custosIncidentesAno;
  const rescisao = estado.custoRescisaoAno;
  const saldo = receita - fixos - investimento - incidentes - rescisao;
  const deficit = Math.max(0, -saldo);
  const situacao: SituacaoFinanceira =
    deficit === 0 ? 'ok' : deficit <= LIMIAR_DEFICIT_LEVE ? 'aviso' : 'vermelho';
  const demitido =
    deficit > LIMIAR_DEFICIT_GRAVE ||
    (situacao === 'vermelho' && estado.anosNoVermelhoSeguidos >= 1);

  // 4. Reputação do chefe: expectativa esportiva + punição financeira
  const expectativa = expectativaJogador(estado);
  const deltaEsportivo = Math.max(
    -REPUTACAO_DELTA_MAXIMO,
    Math.min(REPUTACAO_DELTA_MAXIMO, (expectativa - posicaoJogador) * REPUTACAO_POR_POSICAO)
  );
  const quedaFinanceira =
    situacao === 'aviso' ? QUEDA_REPUTACAO_DEFICIT_LEVE
    : situacao === 'vermelho' ? QUEDA_REPUTACAO_DEFICIT_VERMELHO
    : 0;
  const reputacaoDepois = limitar0a100(jogador.reputacao + deltaEsportivo - quedaFinanceira);

  // Prestígio: expectativa = ranking de prestígio do grid
  const expectativas = expectativaPorPrestigio(estado.equipes);
  const prestigio: Record<string, { antes: number; depois: number }> = {};
  for (const equipe of estado.equipes) {
    const posicao = classificacao.find((c) => c.equipeId === equipe.id)!.posicao;
    const delta = Math.max(
      -PRESTIGIO_DELTA_MAXIMO,
      Math.min(PRESTIGIO_DELTA_MAXIMO, (expectativas[equipe.id] - posicao) * PRESTIGIO_POR_POSICAO)
    );
    prestigio[equipe.id] = {
      antes: equipe.prestigio,
      depois: Math.max(PRESTIGIO_MINIMO, Math.min(PRESTIGIO_MAXIMO, equipe.prestigio + delta)),
    };
  }

  // 6. Convites (não demitido) ou ofertas de emprego (demitido)
  const convites = demitido
    ? []
    : estado.equipes
        .filter((e) => {
          if (e.id === jogador.id || e.prestigio < jogador.prestigio) return false;
          if (reputacaoDepois < FATOR_REPUTACAO_CONVITE * e.prestigio) return false;
          const posicao = classificacao.find((c) => c.equipeId === e.id)!.posicao;
          return posicao > expectativas[e.id]; // frustrada com a própria temporada
        })
        .map((e) => e.id);

  const ofertasEmprego =
    demitido && reputacaoDepois >= REPUTACAO_MINIMA_EMPREGO
      ? estado.equipes
          .filter((e) => e.id !== jogador.id && e.prestigio <= jogador.prestigio)
          .sort((a, b) => b.prestigio - a.prestigio)
          .map((e) => e.id)
      : [];

  return {
    classificacao,
    premiacoes,
    jogador: {
      posicao: posicaoJogador,
      expectativa,
      reputacaoAntes: jogador.reputacao,
      reputacaoDepois,
      metaPatrocinio,
    },
    financeiro: {
      receita, gastosFixos: fixos, investimento, incidentes, rescisao, saldo,
      situacao, demitido,
      carreiraEncerrada: demitido && ofertasEmprego.length === 0,
    },
    prestigio,
    convites,
    ofertasEmprego,
    saltoRegulamento: jogador.cicloDesenvolvimento.anoDoCiclo >= 5,
  };
}

/** Vitórias e pódios de cada piloto na temporada (do histórico de GPs). */
function estatisticasPilotos(estado: EstadoJogo): Record<string, { vitorias: number; podios: number }> {
  const stats: Record<string, { vitorias: number; podios: number }> = {};
  for (const gp of estado.historico) {
    for (const r of gp.corrida.slice(0, 3)) {
      stats[r.pilotoId] ??= { vitorias: 0, podios: 0 };
      stats[r.pilotoId].podios++;
      if (r.posicao === 1) stats[r.pilotoId].vitorias++;
    }
  }
  return stats;
}

/**
 * Efetiva a virada de ano.
 * `escolhaEquipe`: convite aceito (não demitido) ou oferta de emprego aceita
 * (demitido). Demitido COM ofertas e sem escolha → aceita a de maior
 * prestígio (ninguém fica desempregado por esquecer de escolher).
 */
export function aplicarViradaDeAno(
  estado: EstadoJogo,
  catalogo: CatalogoJogo,
  escolhaEquipe?: string
): EstadoJogo {
  const relatorio = gerarRelatorioFimTemporada(estado, catalogo);
  const novo: EstadoJogo = structuredClone(estado);
  const novoAno = novo.ano + 1;

  // Carreira encerrada: demitido sem nenhuma oferta
  if (relatorio.financeiro.carreiraEncerrada) {
    novo.fase = 'fim-carreira';
    return novo;
  }

  // 1. Premiação vira receita do ano seguinte
  novo.premiacaoAnterior = relatorio.premiacoes;

  // 2. Desenvolvimento e ciclo de 5 anos
  for (const equipe of novo.equipes) {
    const resultado = aplicarDesenvolvimento(
      equipe.nivelChassi,
      equipe.cicloDesenvolvimento,
      novo.investimentosAno[equipe.id] ?? 0
    );
    equipe.nivelChassi = resultado.novoNivelChassi;
    equipe.cicloDesenvolvimento = resultado.novoCiclo;
  }

  // 3/4. Reputação do chefe e prestígio das equipes
  const jogador = novo.equipes.find((e) => e.id === novo.equipeJogadorId)!;
  jogador.reputacao = relatorio.jogador.reputacaoDepois;
  for (const equipe of novo.equipes) {
    equipe.prestigio = relatorio.prestigio[equipe.id].depois;
  }

  // Meta de patrocínio falhada → sem renovação com este patrocinador
  novo.patrocinadoresBloqueados =
    relatorio.jogador.metaPatrocinio && !relatorio.jogador.metaPatrocinio.cumprida
      ? [relatorio.jogador.metaPatrocinio.patrocinadorId]
      : [];

  // 5. Pilotos: reputação por resultados, envelhecimento, aposentadoria, novatos
  const stats = estatisticasPilotos(novo);
  const campeaoId = classificarCampeonato(novo.campeonatoPilotos)[0]?.id;
  const rngPilotos = criarRng(derivarSeed(novo.seed, novo.ano, 5));

  for (const piloto of Object.values(novo.pilotos)) {
    if (piloto.aposentado) continue;
    const s = stats[piloto.id];
    if (s) {
      piloto.reputacao = limitar0a100(
        piloto.reputacao + reputacaoDaTemporada(s.vitorias, s.podios, piloto.id === campeaoId)
      );
    }
    // Envelhece e recalcula qualidade/salário pela curva de carreira
    Object.assign(piloto, envelhecerPiloto(piloto));
    // Aposentadoria: sai do pool; contrato em vigor é encerrado
    if (sorteiaAposentadoria(piloto.idade, rngPilotos)) {
      piloto.aposentado = true;
      for (const equipe of novo.equipes) {
        for (let slot = 0; slot < 2; slot++) {
          if (equipe.pilotos[slot].pilotoId === piloto.id) {
            equipe.pilotos[slot] = { ...equipe.pilotos[slot], duracaoAnos: 0 }; // expira já
          }
        }
      }
    }
  }
  for (const novato of gerarNovatos(novoAno, rngPilotos)) {
    novo.pilotos[novato.id] = novato;
  }

  // Poach aceito: o piloto chega à equipe do jogador; a antiga perde o contrato
  if (novo.ofertaPendente) {
    const { pilotoId, slot, salarioAnual, duracaoAnos } = novo.ofertaPendente;
    const chegaAposentado = novo.pilotos[pilotoId]?.aposentado;
    if (!chegaAposentado) {
      for (const equipe of novo.equipes) {
        if (equipe.id === jogador.id) continue;
        for (let s = 0; s < 2; s++) {
          if (equipe.pilotos[s].pilotoId === pilotoId) {
            equipe.pilotos[s] = { ...equipe.pilotos[s], duracaoAnos: 0 }; // rescindido
          }
        }
      }
      jogador.pilotos[slot] = { pilotoId, duracaoAnos, salarioAnual, anoInicio: novoAno };
    }
    novo.ofertaPendente = undefined;
  }

  // 6. Troca de equipe: convite aceito ou emprego novo após demissão
  const opcoes = relatorio.financeiro.demitido ? relatorio.ofertasEmprego : relatorio.convites;
  const destinoId = relatorio.financeiro.demitido
    ? (escolhaEquipe && opcoes.includes(escolhaEquipe) ? escolhaEquipe : opcoes[0])
    : (escolhaEquipe && opcoes.includes(escolhaEquipe) ? escolhaEquipe : undefined);
  if (destinoId) {
    const destino = novo.equipes.find((e) => e.id === destinoId)!;
    destino.reputacao = jogador.reputacao; // a reputação é do chefe
    jogador.reputacao = 50;                // a equipe antiga recomeça neutra
    jogador.ehJogador = false;
    destino.ehJogador = true;
    novo.equipeJogadorId = destino.id;
    novo.patrocinadoresBloqueados = [];
    novo.ofertaPendente = undefined; // a contratação pendente era da equipe antiga
  }

  // 7. Contratos expirados → pool (aposentados nunca voltam ao pool)
  novo.pilotosLivres = pilotosLivres(
    Object.values(novo.pilotos).filter((p) => !p.aposentado),
    novo.equipes,
    novoAno
  );

  // Virada
  const trocouDeEquipe = destinoId !== undefined;
  novo.posicaoAnteriorJogador = trocouDeEquipe ? undefined : relatorio.jogador.posicao;
  novo.anosNoVermelhoSeguidos = trocouDeEquipe
    ? 0
    : relatorio.financeiro.situacao === 'vermelho'
      ? novo.anosNoVermelhoSeguidos + 1
      : 0;
  novo.custosIncidentesAno = 0;
  novo.custoRescisaoAno = 0;
  novo.ano = novoAno;
  novo.fase = 'pre-temporada';
  novo.gpAtual = 0;
  novo.campeonatoPilotos = {};
  novo.campeonatoConstrutores = {};
  novo.historico = [];
  novo.investimentosAno = {};
  novo.gridAtual = undefined;
  novo.taticasJogador = undefined;
  novo.convites = undefined;

  return novo;
}

// Reexporta para conveniência de quem consome o relatório
export { contratoVigente };
