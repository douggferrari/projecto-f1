// ============================================================================
// Táticas de corrida da IA (e presets oferecidos ao jogador).
// Heurística simples: circuitos que desgastam mais o pneu pedem mais paradas
// e compostos mais duros; circuitos leves permitem agressividade.
// ============================================================================

import type { RNG } from './rng';
import type { Circuito, Equipe, TaticaCorrida } from './tipos';

/** Presets de tática válidos (stints.length === paradas + 1). */
export const PRESETS_TATICA: Omit<TaticaCorrida, 'pilotoId'>[] = [
  { paradas: 1, stints: ['medium', 'hard'] },
  { paradas: 1, stints: ['soft', 'hard'] },
  { paradas: 2, stints: ['soft', 'medium', 'medium'] },
  { paradas: 2, stints: ['medium', 'medium', 'soft'] },
  { paradas: 2, stints: ['soft', 'soft', 'medium'] },
  { paradas: 3, stints: ['soft', 'soft', 'soft', 'medium'] },
];

/** Valida uma tática montada pelo jogador. */
export function taticaValida(tatica: TaticaCorrida): boolean {
  return (
    tatica.paradas >= 1 &&
    tatica.paradas <= 3 &&
    tatica.stints.length === tatica.paradas + 1
  );
}

/**
 * Escolhe as táticas da IA para todos os pilotos das equipes dadas.
 * Circuito com desgaste alto → tende a mais paradas / pneus duros.
 * Um pouco de aleatoriedade para variar as estratégias entre carros.
 */
export function escolherTaticasIA(
  equipes: Equipe[],
  circuito: Circuito,
  rng: RNG
): Record<string, TaticaCorrida> {
  // Índices dos presets preferidos conforme o desgaste do circuito
  // (calibrados com a paisagem de estratégia do harness — npm run balancear:
  // a IA escolhe entre opções razoáveis, com alguma variedade entre carros)
  const preferidos =
    circuito.desgastePneu >= 1.2
      ? [0, 2, 3] // desgaste alto: compostos duros, 1-2 paradas
      : circuito.desgastePneu <= 0.85
        ? [1, 4, 3] // desgaste baixo: soft rende mais
        : [1, 0, 2]; // desgaste normal: equilibrado

  const taticas: Record<string, TaticaCorrida> = {};
  for (const equipe of equipes) {
    for (const contrato of equipe.pilotos) {
      const preset = PRESETS_TATICA[preferidos[rng.inteiroEntre(0, preferidos.length - 1)]];
      taticas[contrato.pilotoId] = { pilotoId: contrato.pilotoId, ...preset };
    }
  }
  return taticas;
}
