import { describe, expect, it } from 'vitest';
import {
  anosRestantes,
  contratoVigente,
  criarContratoMotor,
  criarContratoPiloto,
  custoAnualMotor,
  fatorDesconto,
  pilotosLivres,
  salarioAnualPiloto,
} from '../contratos';
import { DESCONTO_MAXIMO_CONTRATO } from '../constantes';
import { equipeTeste, motorTeste, pilotoTeste } from './fixtures';

describe('desconto por duração de contrato', () => {
  it('contrato de 1 ano não tem desconto', () => {
    expect(fatorDesconto(1)).toBe(1);
    expect(custoAnualMotor(motorTeste({ custoAnualBase: 10_000_000 }), 1)).toBe(10_000_000);
  });

  it('cada ano extra desconta 4%', () => {
    expect(custoAnualMotor(motorTeste({ custoAnualBase: 10_000_000 }), 3)).toBe(9_200_000);
    expect(salarioAnualPiloto(pilotoTeste({ salarioBase: 5_000_000 }), 2)).toBe(4_800_000);
  });

  it('o desconto tem teto (contrato de 5 anos não fura o piso)', () => {
    expect(fatorDesconto(5)).toBe(1 - DESCONTO_MAXIMO_CONTRATO);
  });
});

describe('vigência de contratos', () => {
  it('conta os anos restantes a partir do ano de início', () => {
    const contrato = { anoInicio: 2026, duracaoAnos: 2 };
    expect(anosRestantes(contrato, 2026)).toBe(2);
    expect(anosRestantes(contrato, 2027)).toBe(1);
    expect(anosRestantes(contrato, 2028)).toBe(0);
    expect(contratoVigente(contrato, 2027)).toBe(true);
    expect(contratoVigente(contrato, 2028)).toBe(false);
  });
});

describe('pilotosLivres', () => {
  it('exclui pilotos com contrato vigente e libera os expirados', () => {
    const pilotos = ['p1', 'p2', 'p3', 'p4'].map((id) => pilotoTeste({ id }));
    // p1/p2 contratados até 2027 (inclusive); p3/p4 sem contrato
    const equipe = equipeTeste('eqA', 'm1', ['p1', 'p2'], 50); // duracao 2, inicio 2026

    expect(pilotosLivres(pilotos, [equipe], 2026)).toEqual(['p3', 'p4']);
    expect(pilotosLivres(pilotos, [equipe], 2028)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });
});

describe('criação de contratos', () => {
  it('registra ano de início, duração e valor com desconto', () => {
    const motor = motorTeste({ custoAnualBase: 20_000_000 });
    const contrato = criarContratoMotor(motor, 4, 2027);
    expect(contrato).toEqual({ motorId: 'm1', duracaoAnos: 4, custoAnual: 17_600_000, anoInicio: 2027 });

    const piloto = pilotoTeste({ salarioBase: 8_000_000 });
    expect(criarContratoPiloto(piloto, 1, 2027).salarioAnual).toBe(8_000_000);
  });
});
