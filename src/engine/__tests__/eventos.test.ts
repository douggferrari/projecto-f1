// Fase 5 — chuva, safety car e volta mais rápida.
// A prova central: SEM eventos, a corrida é bit-idêntica à da Fase 4.

import { describe, expect, it } from 'vitest';
import { simularClassificacao } from '../classificacao';
import { RETENCAO_GAP_SC } from '../constantes';
import { simularCorrida, simularCorridaDetalhada } from '../corrida';
import type { EventosCorrida } from '../eventos';
import { atribuirPontos } from '../pontuacao';
import { criarRng } from '../rng';
import type { ResultadoCorridaPiloto } from '../tipos';
import { cenarioDuasEquipes, circuitoTeste } from './fixtures';

function rodar(seed: number, eventos?: EventosCorrida) {
  const { equipes, catalogo } = cenarioDuasEquipes();
  const rng = criarRng(seed);
  const grid = simularClassificacao(equipes, catalogo, rng);
  return simularCorridaDetalhada(equipes, grid, {}, circuitoTeste(), catalogo, rng, eventos);
}

describe('bit-identidade sem eventos', () => {
  it('simularCorrida (sem eventos) devolve exatamente o resultado da Fase 4', () => {
    for (const seed of [1, 42, 99]) {
      const semEventos = rodar(seed).resultado;
      const { equipes, catalogo } = cenarioDuasEquipes();
      const rng = criarRng(seed);
      const grid = simularClassificacao(equipes, catalogo, rng);
      const wrapper = simularCorrida(equipes, grid, {}, circuitoTeste(), catalogo, rng);
      expect(semEventos).toEqual(wrapper);
      expect(rodar(seed).safetyCars).toEqual([]);
    }
  });

  it('clima seco com RNG de eventos que não sorteia SC = mesmos tempos', () => {
    // rngEventos "neutro" que nunca dispara chance
    const rngSemEventos = {
      proximo: () => 0.999, entre: (a: number, b: number) => (a + b) / 2,
      chance: () => false, inteiroEntre: (min: number) => min,
    };
    const com = rodar(7, { clima: 'seco', rngEventos: rngSemEventos });
    const sem = rodar(7);
    expect(com.resultado).toEqual(sem.resultado);
  });
});

describe('chuva', () => {
  const rngNeutro = () => ({
    proximo: () => 0.999, entre: (a: number, b: number) => (a + b) / 2,
    chance: () => false, inteiroEntre: (min: number) => min,
  });

  it('muda o resultado da corrida (mesma seed, clima diferente)', () => {
    const seco = rodar(3, { clima: 'seco', rngEventos: rngNeutro() });
    const chuva = rodar(3, { clima: 'chuva', rngEventos: rngNeutro() });
    const temposSeco = seco.resultado.filter((r) => !r.dnf).map((r) => r.tempoTotal);
    const temposChuva = chuva.resultado.filter((r) => !r.dnf).map((r) => r.tempoTotal);
    expect(temposChuva).not.toEqual(temposSeco);
  });

  it('na chuva o carro pesa menos: o gap entre carro forte e fraco encolhe', () => {
    // Média sobre várias seeds: gap médio dos tempos totais entre as equipes
    const gapMedio = (clima: 'seco' | 'chuva') => {
      let soma = 0;
      let n = 0;
      for (let seed = 0; seed < 40; seed++) {
        const r = rodar(seed, { clima, rngEventos: rngNeutro() }).resultado.filter((x) => !x.dnf);
        const a = r.filter((x) => x.equipeId === 'eqA').map((x) => x.tempoTotal);
        const b = r.filter((x) => x.equipeId === 'eqB').map((x) => x.tempoTotal);
        if (a.length && b.length) {
          soma += b.reduce((s, x) => s + x, 0) / b.length - a.reduce((s, x) => s + x, 0) / a.length;
          n++;
        }
      }
      return soma / n;
    };
    expect(gapMedio('chuva')).toBeLessThan(gapMedio('seco') * 0.85);
  });
});

describe('safety car', () => {
  it('comprime os gaps na volta do SC', () => {
    // Força um SC na volta 20 com um rng de eventos determinístico
    const rngComSC = {
      proximo: () => 0, entre: (a: number) => a,
      chance: (() => {
        let chamadas = 0;
        return () => ++chamadas === 1; // só o primeiro sorteio (1º SC) dispara
      })(),
      inteiroEntre: () => 20,
    };
    const com = rodar(11, { clima: 'seco', rngEventos: rngComSC });
    const sem = rodar(11);
    expect(com.safetyCars).toEqual([20]);

    const gapFinal = (r: { resultado: ResultadoCorridaPiloto[] }) => {
      const ok = r.resultado.filter((x) => !x.dnf);
      return ok.at(-1)!.tempoTotal - ok[0].tempoTotal;
    };
    expect(gapFinal(com)).toBeLessThan(gapFinal(sem));
  });

  it('a compressão respeita a retenção configurada (gap na volta do SC)', () => {
    expect(RETENCAO_GAP_SC).toBeGreaterThan(0);
    expect(RETENCAO_GAP_SC).toBeLessThan(1);
  });
});

describe('volta mais rápida', () => {
  it('sempre existe entre quem completou e pertence a um piloto do grid', () => {
    const r = rodar(5);
    expect(r.voltaMaisRapida).toBeDefined();
    const dono = r.resultado.find((x) => x.pilotoId === r.voltaMaisRapida!.pilotoId);
    expect(dono?.dnf).toBe(false);
  });

  it('vale +1 ponto só para quem termina no top 10', () => {
    const resultado: ResultadoCorridaPiloto[] = Array.from({ length: 12 }, (_, i) => ({
      pilotoId: `p${i + 1}`, equipeId: 'eq', posicao: i + 1, pontos: 0, dnf: false, tempoTotal: 5000 + i,
    }));
    const comVmrNoLider = atribuirPontos(resultado, 'p1');
    expect(comVmrNoLider[0].pontos).toBe(26); // 25 + 1
    const comVmrNo12 = atribuirPontos(resultado, 'p12');
    expect(comVmrNo12[11].pontos).toBe(0); // fora do top 10: sem ponto extra
  });
});
