// ============================================================================
// Custos de incidente — Bloco C da Fase 4.
// Cada DNF do JOGADOR gera custo de reparo: quebra mecânica custa menos,
// batida do piloto custa mais, e cada incidente sorteia um multiplicador
// de severidade. O sorteio usa um RNG DERIVADO (etapa 4 da seed do GP) —
// a simulação da corrida não é tocada.
// ============================================================================

import {
  CHANCE_CHUVA_PADRAO,
  CHANCE_PERDA_TOTAL,
  CUSTO_PERDA_TOTAL,
  CUSTO_REPARO_ERRO,
  CUSTO_REPARO_QUEBRA,
  EVENTOS_ATIVADOS,
  FATOR_ERRO_PILOTO,
  FATOR_QUEBRA_MOTOR,
  MARGEM_ESTIMATIVA_RESERVA,
  MULT_ERRO_CHUVA,
  MULTIPLICADOR_DANO_MAXIMO,
  MULTIPLICADOR_DANO_MINIMO,
} from './constantes';
import type { RNG } from './rng';
import type { Equipe, Motor, Piloto, ResultadoCorridaPiloto } from './tipos';

/** Custo dos incidentes do jogador num GP (0 se os dois carros completaram). */
export function custosIncidentesDoGP(
  equipeJogadorId: string,
  resultadoCorrida: ResultadoCorridaPiloto[],
  rng: RNG
): number {
  let total = 0;
  for (const r of resultadoCorrida) {
    if (r.equipeId !== equipeJogadorId || !r.dnf) continue;
    // Batida do piloto pode virar perda total do carro — o ano catastrófico
    if (r.motivoDnf === 'erro' && rng.chance(CHANCE_PERDA_TOTAL)) {
      total += Math.round((CUSTO_PERDA_TOTAL * rng.entre(0.9, 1.3)) / 100_000) * 100_000;
      continue;
    }
    const base = r.motivoDnf === 'erro' ? CUSTO_REPARO_ERRO : CUSTO_REPARO_QUEBRA;
    const severidade = rng.entre(MULTIPLICADOR_DANO_MINIMO, MULTIPLICADOR_DANO_MAXIMO);
    total += Math.round((base * severidade) / 100_000) * 100_000;
  }
  return total;
}

/**
 * Estimativa de reserva mostrada na pré-temporada: custo médio esperado
 * de incidentes na temporada × margem de segurança. Reservar isso deixa o
 * orçamento confortável na maioria dos anos — mas não em todos.
 */
export function estimativaIncidentes(
  equipe: Equipe,
  pilotos: Record<string, Piloto>,
  motores: Record<string, Motor>,
  corridas: number
): number {
  const motor = motores[equipe.contratoMotor.motorId];
  const multiplicadorMedio = (MULTIPLICADOR_DANO_MINIMO + MULTIPLICADOR_DANO_MAXIMO) / 2;
  // Com eventos ligados, parte das corridas é de chuva — erros ficam mais
  // prováveis e a reserva sugerida precisa saber disso.
  const fatorChuva = EVENTOS_ATIVADOS ? 1 + CHANCE_CHUVA_PADRAO * (MULT_ERRO_CHUVA - 1) : 1;
  let esperado = 0;
  for (const contrato of equipe.pilotos) {
    const piloto = pilotos[contrato.pilotoId];
    if (!piloto) continue;
    const chanceQuebra = (100 - motor.confiabilidade) * FATOR_QUEBRA_MOTOR;
    const chanceErro = (100 - piloto.confiabilidade) * FATOR_ERRO_PILOTO * fatorChuva;
    const custoErroMedio =
      (1 - CHANCE_PERDA_TOTAL) * CUSTO_REPARO_ERRO * multiplicadorMedio +
      CHANCE_PERDA_TOTAL * CUSTO_PERDA_TOTAL * 1.1;
    esperado +=
      corridas *
      (chanceQuebra * CUSTO_REPARO_QUEBRA * multiplicadorMedio + chanceErro * custoErroMedio);
  }
  return Math.round((esperado * MARGEM_ESTIMATIVA_RESERVA) / 100_000) * 100_000;
}
