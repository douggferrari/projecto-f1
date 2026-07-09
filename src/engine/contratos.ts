// ============================================================================
// Sistema de contratos — funções puras.
// Motor: fornecedores servem várias equipes ao mesmo tempo.
// Pilotos: só contratáveis se estiverem no pool de livres.
// Contrato mais longo = desconto no custo anual, mas trava a escolha.
// ============================================================================

import {
  DESCONTO_MAXIMO_CONTRATO,
  DESCONTO_POR_ANO_CONTRATO,
  DURACAO_MAXIMA_CONTRATO,
} from './constantes';
import type { ContratoMotor, ContratoPiloto, Equipe, Motor, Piloto } from './tipos';

/**
 * Desconto aplicado ao custo anual pela duração do contrato:
 * 1 ano = sem desconto; cada ano extra desconta DESCONTO_POR_ANO_CONTRATO,
 * até o teto DESCONTO_MAXIMO_CONTRATO.
 */
export function fatorDesconto(duracaoAnos: number): number {
  const desconto = Math.min(
    DESCONTO_MAXIMO_CONTRATO,
    DESCONTO_POR_ANO_CONTRATO * (duracaoAnos - 1)
  );
  return 1 - desconto;
}

/** Custo anual de um contrato de motor com a duração dada. */
export function custoAnualMotor(motor: Motor, duracaoAnos: number): number {
  return Math.round(motor.custoAnualBase * fatorDesconto(duracaoAnos));
}

/** Salário anual de um contrato de piloto com a duração dada. */
export function salarioAnualPiloto(piloto: Piloto, duracaoAnos: number): number {
  return Math.round(piloto.salarioBase * fatorDesconto(duracaoAnos));
}

export function duracaoValida(duracaoAnos: number): boolean {
  return Number.isInteger(duracaoAnos) && duracaoAnos >= 1 && duracaoAnos <= DURACAO_MAXIMA_CONTRATO;
}

export function criarContratoMotor(motor: Motor, duracaoAnos: number, anoInicio: number): ContratoMotor {
  return { motorId: motor.id, duracaoAnos, custoAnual: custoAnualMotor(motor, duracaoAnos), anoInicio };
}

export function criarContratoPiloto(piloto: Piloto, duracaoAnos: number, anoInicio: number): ContratoPiloto {
  return { pilotoId: piloto.id, duracaoAnos, salarioAnual: salarioAnualPiloto(piloto, duracaoAnos), anoInicio };
}

/** Anos que ainda faltam de um contrato no ano dado (0 = expirado). */
export function anosRestantes(
  contrato: { anoInicio: number; duracaoAnos: number },
  ano: number
): number {
  return Math.max(0, contrato.anoInicio + contrato.duracaoAnos - ano);
}

/** Um contrato vale para a temporada `ano` se ainda tem pelo menos 1 ano. */
export function contratoVigente(
  contrato: { anoInicio: number; duracaoAnos: number },
  ano: number
): boolean {
  return anosRestantes(contrato, ano) > 0;
}

/**
 * Pilotos livres: todos os do catálogo que não têm contrato vigente
 * com nenhuma equipe no ano dado.
 */
export function pilotosLivres(
  todosPilotos: Piloto[],
  equipes: Equipe[],
  ano: number
): string[] {
  const contratados = new Set(
    equipes.flatMap((e) =>
      e.pilotos.filter((c) => contratoVigente(c, ano)).map((c) => c.pilotoId)
    )
  );
  return todosPilotos.filter((p) => !contratados.has(p.id)).map((p) => p.id);
}
