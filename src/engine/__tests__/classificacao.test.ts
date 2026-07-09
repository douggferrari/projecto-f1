import { describe, expect, it } from 'vitest';
import { simularClassificacao } from '../classificacao';
import { criarRng } from '../rng';
import { cenarioDuasEquipes } from './fixtures';

describe('simularClassificacao', () => {
  it('devolve um grid com todos os carros, posições 1..N e tempos crescentes', () => {
    const { equipes, catalogo } = cenarioDuasEquipes();
    const grid = simularClassificacao(equipes, catalogo, criarRng(42));

    expect(grid).toHaveLength(4);
    expect(grid.map((g) => g.posicao)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].tempoVolta).toBeGreaterThanOrEqual(grid[i - 1].tempoVolta);
    }
  });

  it('é determinística para a mesma seed', () => {
    const { equipes, catalogo } = cenarioDuasEquipes();
    const grid1 = simularClassificacao(equipes, catalogo, criarRng(7));
    const grid2 = simularClassificacao(equipes, catalogo, criarRng(7));
    expect(grid1).toEqual(grid2);
  });

  it('carro muito superior larga na frente na grande maioria das vezes', () => {
    const { equipes, catalogo } = cenarioDuasEquipes();
    let polesDaEquipeForte = 0;
    for (let seed = 0; seed < 100; seed++) {
      const grid = simularClassificacao(equipes, catalogo, criarRng(seed));
      if (grid[0].equipeId === 'eqA') polesDaEquipeForte++;
    }
    // Diferença de carro é enorme (95/90 vs 65/50): a sorte (±3) não deve virar
    expect(polesDaEquipeForte).toBe(100);
  });
});
