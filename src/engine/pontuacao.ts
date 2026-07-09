// ============================================================================
// Pontuação e campeonatos.
// ============================================================================

import {
  PONTOS_POR_POSICAO,
  PONTOS_VOLTA_MAIS_RAPIDA,
  POSICAO_MAXIMA_PONTO_VMR,
} from './constantes';
import type { ResultadoCorridaPiloto } from './tipos';

/** Pontos pela posição final (1º = 25 ... 10º = 1; resto = 0). DNF nunca pontua. */
export function pontosPorPosicao(posicao: number, dnf: boolean): number {
  if (dnf) return 0;
  return PONTOS_POR_POSICAO[posicao - 1] ?? 0;
}

/**
 * Preenche o campo `pontos` de cada resultado da corrida.
 * `voltaMaisRapidaPilotoId` (Fase 5): +1 ponto se o dono da volta mais
 * rápida terminou dentro do top 10.
 */
export function atribuirPontos(
  resultado: ResultadoCorridaPiloto[],
  voltaMaisRapidaPilotoId?: string
): ResultadoCorridaPiloto[] {
  return resultado.map((r) => {
    let pontos = pontosPorPosicao(r.posicao, r.dnf);
    if (
      voltaMaisRapidaPilotoId === r.pilotoId &&
      !r.dnf &&
      r.posicao <= POSICAO_MAXIMA_PONTO_VMR
    ) {
      pontos += PONTOS_VOLTA_MAIS_RAPIDA;
    }
    return { ...r, pontos };
  });
}

/**
 * Atualiza os campeonatos (imutável: devolve novos objetos).
 * - Pilotos: pontos por pilotoId.
 * - Construtores: soma dos pontos dos dois carros da equipe.
 */
export function atualizarCampeonatos(
  campeonatoPilotos: Record<string, number>,
  campeonatoConstrutores: Record<string, number>,
  resultadoCorrida: ResultadoCorridaPiloto[]
): {
  campeonatoPilotos: Record<string, number>;
  campeonatoConstrutores: Record<string, number>;
} {
  const pilotos = { ...campeonatoPilotos };
  const construtores = { ...campeonatoConstrutores };

  for (const r of resultadoCorrida) {
    pilotos[r.pilotoId] = (pilotos[r.pilotoId] ?? 0) + r.pontos;
    construtores[r.equipeId] = (construtores[r.equipeId] ?? 0) + r.pontos;
  }

  return { campeonatoPilotos: pilotos, campeonatoConstrutores: construtores };
}

/** Ordena um campeonato (Record id → pontos) em lista decrescente. */
export function classificarCampeonato(
  campeonato: Record<string, number>
): { id: string; pontos: number }[] {
  return Object.entries(campeonato)
    .map(([id, pontos]) => ({ id, pontos }))
    .sort((a, b) => b.pontos - a.pontos);
}
