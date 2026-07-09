// ============================================================================
// Invariante do grid: nenhum piloto corre por duas equipes, nenhuma equipe
// entra na temporada com assento sem contrato vigente, e o pool de livres
// nunca contém um piloto contratado. (Regressão do bug de duplicação.)
// ============================================================================

import { describe, expect, it } from 'vitest';
import { CALENDARIO, CIRCUITOS_POR_ID } from '../../data/calendario';
import { ANO_INICIAL, EQUIPES_INICIAIS } from '../../data/equipes';
import { MOTORES_POR_ID } from '../../data/motores';
import { PATROCINADORES_POR_ID } from '../../data/patrocinadores';
import { PILOTOS_POR_ID } from '../../data/pilotos';
import {
  confirmarPreTemporada,
  criarCarreira,
  iniciarPreTemporada,
  preverClassificacao,
  simularRestoDaTemporada,
  type CatalogoCompleto,
} from '../carreira';
import { contratoVigente } from '../contratos';
import { aplicarViradaDeAno } from '../fimTemporada';
import { interessePiloto } from '../mercado';
import { salarioExigido } from '../pilotoCarreira';
import type { EstadoJogo } from '../tipos';

/** Decisões do jogador: renova motor expirado e preenche assentos vagos. */
function decisoesJogador(estado: EstadoJogo): Parameters<typeof confirmarPreTemporada>[1] {
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const motor = contratoVigente(jogador.contratoMotor, estado.ano)
    ? undefined
    : { motorId: jogador.contratoMotor.motorId, duracaoAnos: 2 };
  const pilotos: { slot: 0 | 1; pilotoId: string; duracaoAnos: number; salarioAnual: number }[] = [];
  const usados = new Set<string>();
  for (const slot of [0, 1] as const) {
    if (contratoVigente(jogador.pilotos[slot], estado.ano)) continue;
    const livre = estado.pilotosLivres
      .map((id) => estado.pilotos[id])
      .filter((p) => p && !usados.has(p.id))
      .find((p) =>
        interessePiloto(
          p, jogador,
          { pilotoId: p.id, salarioAnual: Math.round(salarioExigido(p) * 1.3), duracaoAnos: 2 },
          undefined,
          catalogo.patrocinadores[jogador.patrocinadorId]
        ).aceita
      );
    if (livre) {
      usados.add(livre.id);
      pilotos.push({
        slot, pilotoId: livre.id, duracaoAnos: 2,
        salarioAnual: Math.round(salarioExigido(livre) * 1.3),
      });
    }
  }
  return { patrocinadorId: 'pat-tupi', investimento: 0, pilotos, motor };
}

const catalogo: CatalogoCompleto = {
  motores: MOTORES_POR_ID,
  pilotos: PILOTOS_POR_ID,
  patrocinadores: PATROCINADORES_POR_ID,
  circuitos: CIRCUITOS_POR_ID,
};
const calendarioIds = CALENDARIO.map((c) => c.id);

function verificarInvariantes(estado: EstadoJogo, contexto: string): void {
  // 1. Toda equipe com 2 contratos vigentes
  for (const equipe of estado.equipes) {
    const vigentes = equipe.pilotos.filter((c) => contratoVigente(c, estado.ano));
    expect(vigentes, `${contexto}: ${equipe.nome} sem 2 contratos vigentes`).toHaveLength(2);
  }
  // 2. Nenhum piloto contratado por duas equipes
  const escalados = estado.equipes.flatMap((e) => e.pilotos.map((c) => c.pilotoId));
  expect(new Set(escalados).size, `${contexto}: piloto escalado em duas equipes`).toBe(escalados.length);
  // 3. O grid da classificação tem 20 pilotos ÚNICOS
  const grid = preverClassificacao(estado, catalogo);
  const ids = grid.map((g) => g.pilotoId);
  expect(new Set(ids).size, `${contexto}: piloto duplicado no grid`).toBe(20);
  // 4. Pool de livres não contém contratados nem aposentados
  const contratados = new Set(
    estado.equipes.flatMap((e) =>
      e.pilotos.filter((c) => contratoVigente(c, estado.ano)).map((c) => c.pilotoId)
    )
  );
  for (const id of estado.pilotosLivres) {
    expect(contratados.has(id), `${contexto}: livre ${id} está contratado`).toBe(false);
    expect(estado.pilotos[id]?.aposentado ?? false, `${contexto}: livre ${id} aposentado`).toBe(false);
  }
}

describe('integridade do grid ao longo de carreiras longas', () => {
  it('8 temporadas × 4 seeds: nunca há piloto duplicado nem assento sem contrato', () => {
    for (const seed of [3, 11, 42, 77]) {
      let estado = criarCarreira('eq-guarani', seed, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL);
      for (let temporada = 0; temporada < 8; temporada++) {
        const r = confirmarPreTemporada(estado, decisoesJogador(estado), catalogo);
        // Se a pré-temporada travou (assento do jogador sem piloto etc.),
        // o invariante já foi violado — falha explícita
        expect(r.erros, `seed ${seed} T${temporada + 1}: ${r.erros.join(' | ')}`).toEqual([]);
        estado = r.estado;

        verificarInvariantes(estado, `seed ${seed}, temporada ${temporada + 1}`);

        estado = simularRestoDaTemporada(estado, catalogo);
        estado = aplicarViradaDeAno(estado, catalogo);
        if (estado.fase === 'fim-carreira') break;
        estado = iniciarPreTemporada(estado, catalogo);
      }
    }
  }, 60_000);
});
