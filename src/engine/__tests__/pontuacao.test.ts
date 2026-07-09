import { describe, expect, it } from 'vitest';
import {
  atribuirPontos,
  atualizarCampeonatos,
  classificarCampeonato,
  pontosPorPosicao,
} from '../pontuacao';
import type { ResultadoCorridaPiloto } from '../tipos';

function resultado(
  pilotoId: string, equipeId: string, posicao: number, dnf = false
): ResultadoCorridaPiloto {
  return { pilotoId, equipeId, posicao, pontos: 0, dnf, tempoTotal: dnf ? Infinity : 5000 + posicao };
}

describe('pontosPorPosicao', () => {
  it('segue a tabela padrão da F1', () => {
    expect(pontosPorPosicao(1, false)).toBe(25);
    expect(pontosPorPosicao(2, false)).toBe(18);
    expect(pontosPorPosicao(10, false)).toBe(1);
    expect(pontosPorPosicao(11, false)).toBe(0);
  });

  it('DNF não pontua, mesmo em posição pontuável', () => {
    expect(pontosPorPosicao(5, true)).toBe(0);
  });
});

describe('atribuirPontos + atualizarCampeonatos', () => {
  it('acumula pontos de pilotos e soma os dois carros no construtores', () => {
    const corrida = atribuirPontos([
      resultado('p1', 'eqA', 1),
      resultado('p2', 'eqB', 2),
      resultado('p3', 'eqA', 3),
      resultado('p4', 'eqB', 4, true), // DNF classificado em 4º: 0 pontos
    ]);

    const { campeonatoPilotos, campeonatoConstrutores } = atualizarCampeonatos(
      { p1: 10 }, { eqA: 10 }, corrida
    );

    expect(campeonatoPilotos).toEqual({ p1: 35, p2: 18, p3: 15, p4: 0 });
    expect(campeonatoConstrutores).toEqual({ eqA: 50, eqB: 18 });
  });

  it('não muta os objetos originais', () => {
    const pilotosAntes = { p1: 10 };
    atualizarCampeonatos(pilotosAntes, {}, atribuirPontos([resultado('p1', 'eqA', 1)]));
    expect(pilotosAntes).toEqual({ p1: 10 });
  });
});

describe('classificarCampeonato', () => {
  it('ordena por pontos decrescentes', () => {
    expect(classificarCampeonato({ a: 5, b: 30, c: 12 }).map((x) => x.id))
      .toEqual(['b', 'c', 'a']);
  });
});
