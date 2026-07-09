// ============================================================================
// Chefes de equipe — Fase 6.
// Todos os chefes (IA e jogador) evoluem reputação pelos resultados, acumulam
// histórico por temporada e sobem a escada de status por títulos de
// construtores — até "Lendário" com 3 ou mais campeonatos.
// ============================================================================

import {
  REPUTACAO_POR_POSICAO,
  REPUTACAO_DELTA_MAXIMO,
  STATUS_CHEFE,
} from './constantes';
import { limitar0a100 } from './desempenho';
import type { Chefe, EstadoJogo } from './tipos';

/** Id fixo do chefe controlado pelo jogador. */
export const CHEFE_JOGADOR_ID = 'chefe-jogador';

/** Status na escada de títulos (Novato → Estabelecido → Consagrado → Lendário). */
export function statusChefe(campeonatosVencidos: number): string {
  return STATUS_CHEFE.find((s) => campeonatosVencidos >= s.minimo)!.nome;
}

/**
 * Atualiza TODOS os chefes ao fim da temporada (mutação no clone da virada):
 * histórico, títulos e reputação da IA (expectativa = ranking de prestígio,
 * a mesma régua usada para o prestígio das equipes).
 *
 * O chefe do JOGADOR não tem a reputação recalculada aqui — ela vem do
 * relatório (inclui a punição financeira) e é espelhada pelo chamador.
 */
export function atualizarChefes(
  estado: EstadoJogo,
  classificacao: { equipeId: string; posicao: number }[],
  expectativas: Record<string, number>
): void {
  for (const equipe of estado.equipes) {
    const chefe = estado.chefes[equipe.chefeId];
    if (!chefe) continue;
    const posicao = classificacao.find((c) => c.equipeId === equipe.id)!.posicao;
    const campeao = posicao === 1;

    chefe.historico.push({ ano: estado.ano, equipeId: equipe.id, posicaoConstrutores: posicao, campeao });
    if (campeao) chefe.campeonatosVencidos += 1;

    if (!equipe.ehJogador) {
      const delta = Math.max(
        -REPUTACAO_DELTA_MAXIMO,
        Math.min(REPUTACAO_DELTA_MAXIMO, (expectativas[equipe.id] - posicao) * REPUTACAO_POR_POSICAO)
      );
      chefe.reputacao = limitar0a100(chefe.reputacao + delta);
    }
  }
}

/** Ranking de chefes por reputação (para a tela de rankings). */
export function rankingChefes(chefes: Record<string, Chefe>): Chefe[] {
  return Object.values(chefes).sort(
    (a, b) => b.reputacao - a.reputacao || b.campeonatosVencidos - a.campeonatosVencidos
  );
}
