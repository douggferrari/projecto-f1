import { describe, expect, it } from 'vitest';
import {
  aplicarDesenvolvimento,
  desempenhoCarro,
  ganhoChassiAnual,
} from '../desempenho';
import { GANHO_MAXIMO_ANUAL, NIVEL_POS_REGULAMENTO_BASE } from '../constantes';
import type { Motor } from '../tipos';

const motorTeste: Motor = {
  id: 'm1', nome: 'Teste', tier: 'grande',
  potencia: 90, confiabilidade: 85, custoAnualBase: 1,
};

describe('desempenhoCarro', () => {
  it('aplica a fórmula 0.45*potencia + 0.55*chassi', () => {
    expect(desempenhoCarro(motorTeste, 80)).toBeCloseTo(0.45 * 90 + 0.55 * 80);
  });

  it('motor melhor gera desempenho maior com o mesmo chassi', () => {
    const motorFraco = { ...motorTeste, potencia: 60 };
    expect(desempenhoCarro(motorTeste, 70)).toBeGreaterThan(
      desempenhoCarro(motorFraco, 70)
    );
  });
});

describe('ganhoChassiAnual (retornos decrescentes)', () => {
  it('investimento zero não gera ganho', () => {
    expect(ganhoChassiAnual(0)).toBe(0);
  });

  it('nunca ultrapassa o ganho máximo anual', () => {
    expect(ganhoChassiAnual(1_000_000_000)).toBeLessThanOrEqual(GANHO_MAXIMO_ANUAL);
  });

  it('dobrar o investimento rende menos que o dobro do ganho', () => {
    const ganho1 = ganhoChassiAnual(20_000_000);
    const ganho2 = ganhoChassiAnual(40_000_000);
    expect(ganho2).toBeGreaterThan(ganho1);
    expect(ganho2).toBeLessThan(2 * ganho1);
  });
});

describe('aplicarDesenvolvimento (ciclo de 5 anos)', () => {
  it('durante o ciclo, avança o ano e acumula investimento', () => {
    const r = aplicarDesenvolvimento(50, { anoDoCiclo: 2, investimentoAcumulado: 10 }, 5);
    expect(r.houveSaltoRegulamento).toBe(false);
    expect(r.novoCiclo.anoDoCiclo).toBe(3);
    expect(r.novoCiclo.investimentoAcumulado).toBe(15);
    expect(r.novoNivelChassi).toBeGreaterThan(50);
  });

  it('no ano 5 ocorre o salto de regulamento e o ciclo reinicia', () => {
    const r = aplicarDesenvolvimento(90, { anoDoCiclo: 5, investimentoAcumulado: 0 }, 0);
    expect(r.houveSaltoRegulamento).toBe(true);
    expect(r.novoCiclo).toEqual({ anoDoCiclo: 1, investimentoAcumulado: 0 });
    // O salto normaliza: nível cai em direção ao piso do novo regulamento
    expect(r.novoNivelChassi).toBeLessThan(90);
    expect(r.novoNivelChassi).toBeGreaterThanOrEqual(NIVEL_POS_REGULAMENTO_BASE);
  });

  it('quem investiu consistente no ciclo sai do salto melhor que quem não investiu', () => {
    const investiu = aplicarDesenvolvimento(
      70, { anoDoCiclo: 5, investimentoAcumulado: 64_000_000 }, 16_000_000
    );
    const naoInvestiu = aplicarDesenvolvimento(
      70, { anoDoCiclo: 5, investimentoAcumulado: 0 }, 0
    );
    expect(investiu.novoNivelChassi).toBeGreaterThan(naoInvestiu.novoNivelChassi);
  });
});
