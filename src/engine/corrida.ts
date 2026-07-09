// ============================================================================
// Simulação de corrida: stints, pneus, degradação, pit stops e DNFs.
// Função pura: recebe grid + táticas + catálogos + RNG, devolve o resultado.
//
// ATENÇÃO (Fase 3): simularCorridaDetalhada expõe os tempos volta a volta
// para a transmissão ao vivo. simularCorrida é um wrapper dela — é o MESMO
// caminho de código, com a mesma ordem de consumo do RNG e a mesma ordem
// de soma em ponto flutuante. O resultado é bit-idêntico ao da Fase 2.
// ============================================================================

import {
  BONUS_POSICAO_GRID,
  CHANCE_SAFETY_CAR,
  CHANCE_SEGUNDO_SAFETY_CAR,
  CUSTO_PIT_STOP,
  DEGRADACAO_MAXIMA_POR_VOLTA,
  DEGRADACAO_POR_VOLTA,
  FATOR_ERRO_PILOTO,
  FATOR_QUEBRA_MOTOR,
  FATOR_RITMO_TEMPO,
  MARGEM_FINAL_SC,
  MODIFICADOR_PNEU,
  MULT_DEGRADACAO_CHUVA,
  MULT_ERRO_CHUVA,
  MULT_MODIFICADOR_PNEU_CHUVA,
  MULT_SAFETY_CAR_CHUVA,
  MULT_VARIACAO_VOLTA_CHUVA,
  PESO_CARRO_CORRIDA,
  PESO_CARRO_CORRIDA_CHUVA,
  PESO_PILOTO_CORRIDA,
  PESO_PILOTO_CORRIDA_CHUVA,
  RETENCAO_GAP_SC,
  TEMPO_BASE_VOLTA,
  VARIACAO_FORMA,
  VARIACAO_VOLTA,
  VOLTA_MINIMA_SC,
} from './constantes';
import type { EventosCorrida } from './eventos';
import type { CatalogoSimulacao } from './classificacao';
import { desempenhoCarro } from './desempenho';
import type { RNG } from './rng';
import type {
  Circuito,
  Equipe,
  Pneu,
  ResultadoClassificacao,
  ResultadoCorridaPiloto,
  TaticaCorrida,
} from './tipos';

/**
 * Divide as voltas da corrida em stints de tamanho o mais igual possível.
 * Ex.: 50 voltas em 3 stints → [17, 17, 16].
 */
export function dividirVoltasEmStints(voltas: number, numStints: number): number[] {
  const base = Math.floor(voltas / numStints);
  const sobra = voltas % numStints;
  return Array.from({ length: numStints }, (_, i) => base + (i < sobra ? 1 : 0));
}

/**
 * Tempos (em segundos) de cada volta de um stint.
 * O ritmo efetivo cai a cada volta pela degradação do pneu, e cada volta
 * tem um pequeno ruído aleatório.
 */
export function temposDasVoltasDoStint(
  ritmoBase: number,
  pneu: Pneu,
  voltasDoStint: number,
  desgasteCircuito: number,
  rng: RNG,
  chuva = false
): number[] {
  // Chuva (Fase 5): compostos importam menos, pneu degrada menos, cada
  // volta é mais imprevisível. Com chuva=false o cálculo é o original.
  const modificadorPneu = chuva
    ? MODIFICADOR_PNEU[pneu] * MULT_MODIFICADOR_PNEU_CHUVA
    : MODIFICADOR_PNEU[pneu];
  const taxaDegradacao = chuva
    ? DEGRADACAO_POR_VOLTA[pneu] * MULT_DEGRADACAO_CHUVA
    : DEGRADACAO_POR_VOLTA[pneu];
  const variacao = chuva ? VARIACAO_VOLTA * MULT_VARIACAO_VOLTA_CHUVA : VARIACAO_VOLTA;

  const tempos: number[] = [];
  for (let volta = 1; volta <= voltasDoStint; volta++) {
    // A degradação cresce linear com a volta do stint, mas tem um teto —
    // um stint longo demais fica lento, não absurdamente negativo.
    const degradacao = Math.min(
      DEGRADACAO_MAXIMA_POR_VOLTA,
      taxaDegradacao * desgasteCircuito * volta
    );
    const ritmoVolta =
      ritmoBase +
      modificadorPneu -
      degradacao +
      rng.entre(-variacao, variacao);
    tempos.push(TEMPO_BASE_VOLTA - FATOR_RITMO_TEMPO * ritmoVolta);
  }
  return tempos;
}

/** Tempo total de um stint (soma das voltas, na mesma ordem de sempre). */
export function tempoDoStint(
  ritmoBase: number,
  pneu: Pneu,
  voltasDoStint: number,
  desgasteCircuito: number,
  rng: RNG
): number {
  return temposDasVoltasDoStint(ritmoBase, pneu, voltasDoStint, desgasteCircuito, rng)
    .reduce((total, tempo) => total + tempo, 0);
}

interface CarroNaCorrida {
  pilotoId: string;
  equipeId: string;
  posicaoGrid: number;
  tempoTotal: number;
  dnf: boolean;
  motivoDnf?: 'quebra' | 'erro';
}

/** Detalhe volta a volta de um carro — usado pela transmissão ao vivo. */
export interface DetalheCarroCorrida {
  pilotoId: string;
  equipeId: string;
  posicaoGrid: number;
  dnf: boolean;
  motivoDnf?: 'quebra' | 'erro';
  tatica: TaticaCorrida;
  /** Tempo de cada volta (sem pit e sem bônus de grid). Vazio se DNF. */
  temposVoltas: number[];
  /** Nº de voltas de cada stint (na ordem da tática). */
  voltasPorStint: number[];
}

export interface CorridaDetalhada {
  resultado: ResultadoCorridaPiloto[];
  detalhes: Record<string, DetalheCarroCorrida>; // pilotoId → detalhe
  /** Voltas em que o safety car entrou (Fase 5; vazio sem eventos). */
  safetyCars: number[];
  /** Volta mais rápida entre quem completou (excluindo voltas de SC). */
  voltaMaisRapida?: { pilotoId: string; tempo: number };
}

/**
 * Simula a corrida completa expondo os tempos volta a volta.
 * - `taticas`: mapa pilotoId → tática. Pilotos sem tática recebem o default
 *   (2 paradas, medium/medium/soft) — a IA define as suas em taticas.ts.
 * - DNFs são sorteados por corrida (quebra de motor e erro de piloto).
 */
export function simularCorridaDetalhada(
  equipes: Equipe[],
  grid: ResultadoClassificacao[],
  taticas: Record<string, TaticaCorrida>,
  circuito: Circuito,
  catalogo: CatalogoSimulacao,
  rng: RNG,
  eventos?: EventosCorrida
): CorridaDetalhada {
  const equipesPorId = new Map(equipes.map((e) => [e.id, e]));
  const numCarros = grid.length;
  const detalhes: Record<string, DetalheCarroCorrida> = {};
  // Chuva (Fase 5): sem `eventos`, o caminho é bit-idêntico ao da Fase 4
  const chuva = eventos?.clima === 'chuva';

  const carros: CarroNaCorrida[] = grid.map((posicaoGrid) => {
    const equipe = equipesPorId.get(posicaoGrid.equipeId)!;
    const motor = catalogo.motores[equipe.contratoMotor.motorId];
    const piloto = catalogo.pilotos[posicaoGrid.pilotoId];
    const tatica = taticas[piloto.id] ?? taticaDefault(piloto.id);

    // --- Sorteio de DNF (uma vez por corrida, por carro) ---
    // Na chuva, erros de pilotagem ficam muito mais prováveis
    const chanceQuebra = (100 - motor.confiabilidade) * FATOR_QUEBRA_MOTOR;
    const chanceErro =
      (100 - piloto.confiabilidade) * FATOR_ERRO_PILOTO * (chuva ? MULT_ERRO_CHUVA : 1);
    const registrarDnf = (motivoDnf: 'quebra' | 'erro'): CarroNaCorrida => {
      detalhes[piloto.id] = {
        pilotoId: piloto.id, equipeId: equipe.id, posicaoGrid: posicaoGrid.posicao,
        dnf: true, motivoDnf, tatica, temposVoltas: [],
        voltasPorStint: dividirVoltasEmStints(circuito.voltas, tatica.stints.length),
      };
      return { pilotoId: piloto.id, equipeId: equipe.id, posicaoGrid: posicaoGrid.posicao, tempoTotal: Infinity, dnf: true, motivoDnf };
    };
    if (rng.chance(chanceQuebra)) return registrarDnf('quebra');
    if (rng.chance(chanceErro)) return registrarDnf('erro');

    // --- Tempo de corrida: soma dos stints + pit stops ---
    // Forma do fim de semana: um sorteio por carro que desloca a corrida
    // inteira (dia bom/dia ruim) — ver comentário em constantes.ts.
    // Na chuva, o CARRO pesa menos e o PILOTO pesa mais — o equalizador.
    const forma = rng.entre(-VARIACAO_FORMA, VARIACAO_FORMA);
    const pesoCarro = chuva ? PESO_CARRO_CORRIDA_CHUVA : PESO_CARRO_CORRIDA;
    const pesoPiloto = chuva ? PESO_PILOTO_CORRIDA_CHUVA : PESO_PILOTO_CORRIDA;
    const ritmoBase =
      pesoCarro * desempenhoCarro(motor, equipe.nivelChassi) +
      pesoPiloto * piloto.corrida +
      forma;

    const voltasPorStint = dividirVoltasEmStints(circuito.voltas, tatica.stints.length);
    // Mesma ordem de RNG e de soma da versão original: stint a stint,
    // volta a volta, subtotal do stint somado ao acumulado.
    const temposPorStint = tatica.stints.map((pneu, i) =>
      temposDasVoltasDoStint(ritmoBase, pneu, voltasPorStint[i], circuito.desgastePneu, rng, chuva)
    );
    let tempoTotal = temposPorStint.reduce(
      (soma, tempos) => soma + tempos.reduce((total, tempo) => total + tempo, 0),
      0
    );
    tempoTotal += tatica.paradas * CUSTO_PIT_STOP;

    // Bônus de largada: quem larga na frente corre em pista limpa
    tempoTotal -= BONUS_POSICAO_GRID * (numCarros - posicaoGrid.posicao);

    detalhes[piloto.id] = {
      pilotoId: piloto.id, equipeId: equipe.id, posicaoGrid: posicaoGrid.posicao,
      dnf: false, tatica, temposVoltas: temposPorStint.flat(), voltasPorStint,
    };
    return { pilotoId: piloto.id, equipeId: equipe.id, posicaoGrid: posicaoGrid.posicao, tempoTotal, dnf: false };
  });

  // --- Safety car (Fase 5): comprime o pelotão na volta sorteada ---
  // O sorteio usa o RNG DE EVENTOS (separado) — sem eventos, nada roda.
  const safetyCars: number[] = [];
  if (eventos && circuito.voltas > VOLTA_MINIMA_SC + MARGEM_FINAL_SC) {
    const multSC = chuva ? MULT_SAFETY_CAR_CHUVA : 1;
    const sorteiaVolta = () =>
      eventos.rngEventos.inteiroEntre(VOLTA_MINIMA_SC, circuito.voltas - MARGEM_FINAL_SC);
    if (eventos.rngEventos.chance(Math.min(1, CHANCE_SAFETY_CAR * multSC))) {
      safetyCars.push(sorteiaVolta());
    }
    if (eventos.rngEventos.chance(Math.min(1, CHANCE_SEGUNDO_SAFETY_CAR * multSC))) {
      const volta = sorteiaVolta();
      if (!safetyCars.includes(volta)) safetyCars.push(volta);
    }
    safetyCars.sort((a, b) => a - b);

    for (const voltaSC of safetyCars) {
      // Gap de cada carro em pista para o líder é reduzido a RETENCAO_GAP_SC
      const emPista = carros.filter((c) => !c.dnf);
      const acumulados = emPista.map((c) => ({
        carro: c,
        acumulado: detalhes[c.pilotoId].temposVoltas
          .slice(0, voltaSC)
          .reduce((soma, t) => soma + t, 0),
      }));
      const lider = Math.min(...acumulados.map((x) => x.acumulado));
      for (const { carro, acumulado } of acumulados) {
        const reducao = (acumulado - lider) * (1 - RETENCAO_GAP_SC);
        if (reducao <= 0) continue;
        detalhes[carro.pilotoId].temposVoltas[voltaSC - 1] -= reducao;
        carro.tempoTotal -= reducao;
      }
    }
  }

  // --- Volta mais rápida (excluindo voltas comprimidas por SC) ---
  let voltaMaisRapida: CorridaDetalhada['voltaMaisRapida'];
  for (const carro of carros) {
    if (carro.dnf) continue;
    const tempos = detalhes[carro.pilotoId].temposVoltas;
    for (let i = 0; i < tempos.length; i++) {
      if (safetyCars.includes(i + 1)) continue;
      if (!voltaMaisRapida || tempos[i] < voltaMaisRapida.tempo) {
        voltaMaisRapida = { pilotoId: carro.pilotoId, tempo: tempos[i] };
      }
    }
  }

  // Ordena: quem completou por tempo; DNFs no fim (mantendo ordem de grid)
  const ordenados = [...carros].sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
    if (a.dnf && b.dnf) return a.posicaoGrid - b.posicaoGrid;
    return a.tempoTotal - b.tempoTotal;
  });

  const resultado = ordenados.map((carro, indice) => ({
    pilotoId: carro.pilotoId,
    equipeId: carro.equipeId,
    posicao: indice + 1,
    pontos: 0, // preenchido em pontuacao.ts
    dnf: carro.dnf,
    motivoDnf: carro.motivoDnf,
    tempoTotal: carro.dnf ? Infinity : Number(carro.tempoTotal.toFixed(3)),
  }));

  return { resultado, detalhes, safetyCars, voltaMaisRapida };
}

/** Simula a corrida completa (wrapper da versão detalhada). */
export function simularCorrida(
  equipes: Equipe[],
  grid: ResultadoClassificacao[],
  taticas: Record<string, TaticaCorrida>,
  circuito: Circuito,
  catalogo: CatalogoSimulacao,
  rng: RNG
): ResultadoCorridaPiloto[] {
  return simularCorridaDetalhada(equipes, grid, taticas, circuito, catalogo, rng).resultado;
}

/** Tática padrão: 2 paradas, medium/medium/soft. */
export function taticaDefault(pilotoId: string): TaticaCorrida {
  return { pilotoId, paradas: 2, stints: ['medium', 'medium', 'soft'] };
}
