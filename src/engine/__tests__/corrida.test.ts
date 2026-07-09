import { describe, expect, it } from 'vitest';
import { simularClassificacao } from '../classificacao';
import { FATOR_QUEBRA_MOTOR } from '../constantes';
import { dividirVoltasEmStints, simularCorrida, tempoDoStint } from '../corrida';
import { criarRng, type RNG } from '../rng';
import type { TaticaCorrida } from '../tipos';
import { cenarioDuasEquipes, circuitoTeste, motorTeste } from './fixtures';

/** RNG "neutro": sem sorte (proximo() = 0.5 → entre() devolve o centro). */
function rngNeutro(): RNG {
  return {
    proximo: () => 0.5,
    entre: (min, max) => (min + max) / 2,
    chance: () => false,
    inteiroEntre: (min) => min,
  };
}

describe('dividirVoltasEmStints', () => {
  it('divide as voltas em partes quase iguais somando o total', () => {
    expect(dividirVoltasEmStints(50, 3)).toEqual([17, 17, 16]);
    expect(dividirVoltasEmStints(50, 2)).toEqual([25, 25]);
    expect(dividirVoltasEmStints(50, 1)).toEqual([50]);
  });
});

describe('tempoDoStint (modelo de pneus)', () => {
  it('num stint curto, soft é mais rápido que hard', () => {
    const soft = tempoDoStint(80, 'soft', 8, 1.0, rngNeutro());
    const hard = tempoDoStint(80, 'hard', 8, 1.0, rngNeutro());
    expect(soft).toBeLessThan(hard);
  });

  it('num stint muito longo, hard supera o soft (degradação)', () => {
    // Com as constantes default, o cruzamento acontece perto de 48 voltas
    const soft = tempoDoStint(80, 'soft', 60, 1.0, rngNeutro());
    const hard = tempoDoStint(80, 'hard', 60, 1.0, rngNeutro());
    expect(hard).toBeLessThan(soft);
  });

  it('circuito com mais desgaste torna o stint mais lento', () => {
    const normal = tempoDoStint(80, 'medium', 20, 1.0, rngNeutro());
    const desgastante = tempoDoStint(80, 'medium', 20, 1.5, rngNeutro());
    expect(desgastante).toBeGreaterThan(normal);
  });
});

describe('simularCorrida', () => {
  function correr(seed: number, taticas: Record<string, TaticaCorrida> = {}) {
    const { equipes, catalogo } = cenarioDuasEquipes();
    const rng = criarRng(seed);
    const grid = simularClassificacao(equipes, catalogo, rng);
    return simularCorrida(equipes, grid, taticas, circuitoTeste(), catalogo, rng);
  }

  it('classifica todos os carros com posições 1..N e tempos crescentes', () => {
    const resultado = correr(1);
    expect(resultado).toHaveLength(4);
    expect(resultado.map((r) => r.posicao)).toEqual([1, 2, 3, 4]);
    const naoDnf = resultado.filter((r) => !r.dnf);
    for (let i = 1; i < naoDnf.length; i++) {
      expect(naoDnf[i].tempoTotal).toBeGreaterThanOrEqual(naoDnf[i - 1].tempoTotal);
    }
  });

  it('carro muito superior vence na grande maioria das corridas', () => {
    let vitoriasEquipeForte = 0;
    for (let seed = 0; seed < 100; seed++) {
      if (correr(seed)[0].equipeId === 'eqA') vitoriasEquipeForte++;
    }
    expect(vitoriasEquipeForte).toBeGreaterThanOrEqual(95);
  });

  it('sem DNFs quando motores e pilotos têm confiabilidade 100', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(correr(seed).every((r) => !r.dnf)).toBe(true);
    }
  });

  it('motor pouco confiável gera DNFs por quebra na frequência esperada', () => {
    const { equipes, catalogo } = cenarioDuasEquipes();
    // Motor da equipe A passa a ter confiabilidade 0 → 40% de quebra por corrida
    catalogo.motores['mtr-forte'] = motorTeste({ id: 'mtr-forte', potencia: 95, confiabilidade: 0 });

    let quebras = 0;
    const corridas = 200;
    for (let seed = 0; seed < corridas; seed++) {
      const rng = criarRng(seed);
      const grid = simularClassificacao(equipes, catalogo, rng);
      const resultado = simularCorrida(equipes, grid, {}, circuitoTeste(), catalogo, rng);
      quebras += resultado.filter((r) => r.dnf && r.motivoDnf === 'quebra').length;
    }
    // 2 carros * 200 corridas * (100 * FATOR_QUEBRA_MOTOR) quebras esperadas,
    // com margem de ±30% para a variância binomial
    const esperado = 2 * corridas * (100 * FATOR_QUEBRA_MOTOR);
    expect(quebras).toBeGreaterThan(esperado * 0.7);
    expect(quebras).toBeLessThan(esperado * 1.3);
  });

  it('DNF termina atrás de todos que completaram', () => {
    const { equipes, catalogo } = cenarioDuasEquipes();
    catalogo.motores['mtr-forte'] = motorTeste({ id: 'mtr-forte', potencia: 95, confiabilidade: 0 });

    for (let seed = 0; seed < 50; seed++) {
      const rng = criarRng(seed);
      const grid = simularClassificacao(equipes, catalogo, rng);
      const resultado = simularCorrida(equipes, grid, {}, circuitoTeste(), catalogo, rng);
      const primeiraPosicaoDnf = resultado.find((r) => r.dnf)?.posicao;
      if (primeiraPosicaoDnf !== undefined) {
        for (const r of resultado.filter((x) => !x.dnf)) {
          expect(r.posicao).toBeLessThan(primeiraPosicaoDnf);
        }
      }
    }
  });

  it('respeita a tática do jogador (nº de paradas altera o tempo total)', () => {
    // Mesmo piloto com 1 parada vs 3 paradas de hard: menos paradas
    // em pneu duro deve ser mais rápido que parar 3 vezes no mesmo composto
    const umaParada = correr(5, {
      pA1: { pilotoId: 'pA1', paradas: 1, stints: ['hard', 'hard'] },
    });
    const tresParadas = correr(5, {
      pA1: { pilotoId: 'pA1', paradas: 3, stints: ['hard', 'hard', 'hard', 'hard'] },
    });
    const tempo1 = umaParada.find((r) => r.pilotoId === 'pA1')!.tempoTotal;
    const tempo3 = tresParadas.find((r) => r.pilotoId === 'pA1')!.tempoTotal;
    expect(tempo1).toBeLessThan(tempo3);
  });
});
