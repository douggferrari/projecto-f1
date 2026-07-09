// ============================================================================
// Simulação de classificação (qualifying).
// Função pura: recebe equipes + catálogos + RNG, devolve o grid ordenado.
// ============================================================================

import {
  FATOR_RITMO_TEMPO,
  PESO_CARRO_QUALI,
  PESO_PILOTO_QUALI,
  TEMPO_BASE_VOLTA,
  VARIACAO_QUALI,
} from './constantes';
import { desempenhoCarro } from './desempenho';
import type { RNG } from './rng';
import type { Equipe, Motor, Piloto, ResultadoClassificacao } from './tipos';

export interface CatalogoSimulacao {
  motores: Record<string, Motor>;
  pilotos: Record<string, Piloto>;
}

/**
 * Simula a classificação de um GP.
 * Cada carro recebe um ritmo de quali (carro + piloto + sorte) e o grid
 * é ordenado do maior para o menor ritmo. O tempo de volta exibido é
 * derivado do ritmo (só para apresentação — a ordem vem do ritmo).
 */
export function simularClassificacao(
  equipes: Equipe[],
  catalogo: CatalogoSimulacao,
  rng: RNG
): ResultadoClassificacao[] {
  const carros = equipes.flatMap((equipe) => {
    const motor = catalogo.motores[equipe.contratoMotor.motorId];
    const desempenho = desempenhoCarro(motor, equipe.nivelChassi);

    return equipe.pilotos.map((contrato) => {
      const piloto = catalogo.pilotos[contrato.pilotoId];
      const ritmoQuali =
        PESO_CARRO_QUALI * desempenho +
        PESO_PILOTO_QUALI * piloto.classificacao +
        rng.entre(-VARIACAO_QUALI, VARIACAO_QUALI);

      return {
        pilotoId: piloto.id,
        equipeId: equipe.id,
        ritmoQuali,
        tempoVolta: TEMPO_BASE_VOLTA - FATOR_RITMO_TEMPO * ritmoQuali,
      };
    });
  });

  return carros
    .sort((a, b) => b.ritmoQuali - a.ritmoQuali)
    .map((carro, indice) => ({
      pilotoId: carro.pilotoId,
      equipeId: carro.equipeId,
      posicao: indice + 1,
      tempoVolta: Number(carro.tempoVolta.toFixed(3)),
    }));
}
