// Testes de integração: temporada completa com os dados reais de /src/data.

import { describe, expect, it } from 'vitest';
import { CALENDARIO } from '../../data/calendario';
import { EQUIPES_INICIAIS } from '../../data/equipes';
import { MOTORES_POR_ID } from '../../data/motores';
import { PILOTOS_POR_ID } from '../../data/pilotos';
import { criarRng } from '../rng';
import { simularTemporada } from '../temporada';

const catalogo = { motores: MOTORES_POR_ID, pilotos: PILOTOS_POR_ID };

describe('simularTemporada (dados reais)', () => {
  it('roda os 12 GPs e produz campeonatos coerentes', () => {
    const r = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(123));

    expect(r.resultados).toHaveLength(12);
    // 20 pilotos e 10 equipes presentes nos campeonatos
    expect(Object.keys(r.campeonatoPilotos)).toHaveLength(20);
    expect(Object.keys(r.campeonatoConstrutores)).toHaveLength(10);
    // Soma dos pontos dos pilotos == soma dos construtores
    const somaPilotos = Object.values(r.campeonatoPilotos).reduce((a, b) => a + b, 0);
    const somaConstrutores = Object.values(r.campeonatoConstrutores).reduce((a, b) => a + b, 0);
    expect(somaPilotos).toBe(somaConstrutores);
    // Cada GP distribui no máximo 101 pontos (25+18+...+1) e no mínimo > 0
    expect(somaPilotos).toBeLessThanOrEqual(12 * 101);
    expect(somaPilotos).toBeGreaterThan(0);
  });

  it('é determinística para a mesma seed', () => {
    const r1 = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(9));
    const r2 = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(9));
    expect(r1).toEqual(r2);
  });

  it('balanceamento: equipes grandes terminam à frente das pequenas na média', () => {
    // Média de pontos por tier ao longo de várias temporadas com seeds diferentes
    const pontosPorTier = { grande: 0, media: 0, pequena: 0 };
    const temporadas = 10;

    for (let seed = 0; seed < temporadas; seed++) {
      const r = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(seed));
      for (const equipe of EQUIPES_INICIAIS) {
        pontosPorTier[equipe.tier] += r.campeonatoConstrutores[equipe.id] ?? 0;
      }
    }

    // Normaliza pela quantidade de equipes por tier (3 grandes, 3 médias, 4 pequenas)
    const mediaGrande = pontosPorTier.grande / 3;
    const mediaMedia = pontosPorTier.media / 3;
    const mediaPequena = pontosPorTier.pequena / 4;

    expect(mediaGrande).toBeGreaterThan(mediaMedia);
    expect(mediaMedia).toBeGreaterThan(mediaPequena);
  });

  it('equipes pequenas ainda pontuam de vez em quando (não é procissão)', () => {
    let pontosPequenas = 0;
    for (let seed = 100; seed < 110; seed++) {
      const r = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(seed));
      for (const equipe of EQUIPES_INICIAIS.filter((e) => e.tier === 'pequena')) {
        pontosPequenas += r.campeonatoConstrutores[equipe.id] ?? 0;
      }
    }
    expect(pontosPequenas).toBeGreaterThan(0);
  });
});
