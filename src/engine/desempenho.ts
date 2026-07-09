// ============================================================================
// Desempenho do carro e desenvolvimento do chassi.
// ============================================================================

import {
  ANOS_POR_CICLO,
  BONUS_INVESTIMENTO_CICLO,
  ESCALA_INVESTIMENTO,
  GANHO_MAXIMO_ANUAL,
  INVESTIMENTO_CICLO_REFERENCIA,
  NIVEL_POS_REGULAMENTO_BASE,
  PESO_CHASSI,
  PESO_MOTOR,
  RETENCAO_REGULAMENTO,
} from './constantes';
import type { CicloDesenvolvimento, Motor } from './tipos';

/** Limita um valor ao intervalo [0, 100]. */
export function limitar0a100(valor: number): number {
  return Math.max(0, Math.min(100, valor));
}

/**
 * Desempenho combinado do carro (0-100):
 * mistura potência do motor com nível do chassi.
 */
export function desempenhoCarro(motor: Motor, nivelChassi: number): number {
  return PESO_MOTOR * motor.potencia + PESO_CHASSI * nivelChassi;
}

/**
 * Ganho de nível de chassi de UMA temporada, dado o investimento do ano.
 * Retornos decrescentes: investir tudo num ano só rende menos que
 * investir de forma consistente ao longo do ciclo.
 */
export function ganhoChassiAnual(investimento: number): number {
  return GANHO_MAXIMO_ANUAL * (1 - Math.exp(-investimento / ESCALA_INVESTIMENTO));
}

export interface ResultadoDesenvolvimento {
  novoNivelChassi: number;
  novoCiclo: CicloDesenvolvimento;
  houveSaltoRegulamento: boolean;
}

/**
 * Aplica o desenvolvimento de fim de temporada:
 * - soma o ganho anual (retornos decrescentes) ao chassi;
 * - se o ciclo de 5 anos terminou, aplica o "salto de regulamento":
 *   o nível é parcialmente normalizado e quem investiu bem no ciclo
 *   inteiro carrega um bônus para o novo regulamento.
 */
export function aplicarDesenvolvimento(
  nivelChassi: number,
  ciclo: CicloDesenvolvimento,
  investimentoDoAno: number
): ResultadoDesenvolvimento {
  const nivelAposGanho = limitar0a100(nivelChassi + ganhoChassiAnual(investimentoDoAno));
  const investimentoAcumulado = ciclo.investimentoAcumulado + investimentoDoAno;

  // Ciclo ainda em andamento: só avança o ano
  if (ciclo.anoDoCiclo < ANOS_POR_CICLO) {
    return {
      novoNivelChassi: nivelAposGanho,
      novoCiclo: { anoDoCiclo: ciclo.anoDoCiclo + 1, investimentoAcumulado },
      houveSaltoRegulamento: false,
    };
  }

  // Fim do ciclo: salto de regulamento
  const excedente = Math.max(0, nivelAposGanho - NIVEL_POS_REGULAMENTO_BASE);
  const bonusCiclo =
    BONUS_INVESTIMENTO_CICLO *
    Math.min(1, investimentoAcumulado / INVESTIMENTO_CICLO_REFERENCIA);

  return {
    novoNivelChassi: limitar0a100(
      NIVEL_POS_REGULAMENTO_BASE + RETENCAO_REGULAMENTO * excedente + bonusCiclo
    ),
    novoCiclo: { anoDoCiclo: 1, investimentoAcumulado: 0 },
    houveSaltoRegulamento: true,
  };
}
