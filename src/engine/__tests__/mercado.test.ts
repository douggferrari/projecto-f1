// As duas provas centrais do mercado (Fase 4):
//  1. GATE DE PRESTÍGIO: equipe pequena não contrata jovem Elite por dinheiro nenhum.
//  2. EFEITO ALONSO: veterano realizado aceita descer por salário; um jovem
//     de MESMO overall atual recusa a mesma oferta.

import { describe, expect, it } from 'vitest';
import { custoRescisao, interessePiloto } from '../mercado';
import { overallAtual, qualidadeAtual, salarioExigido } from '../pilotoCarreira';
import type { Piloto } from '../tipos';
import { pilotoTeste } from './fixtures';

/** Piloto com qualidade atual derivada da idade/potencial (consistente). */
function piloto(idade: number, potencial: number, reputacao: number): Piloto {
  const base = {
    idade,
    potencialClassificacao: potencial,
    potencialCorrida: potencial,
    confiabilidadeBase: 75,
  };
  const q = qualidadeAtual(base);
  const p = pilotoTeste({ id: `p-${idade}-${potencial}`, reputacao, ...base, ...q });
  return { ...p, salarioBase: salarioExigido(p) };
}

const equipePequena = { prestigio: 35 };
const equipeMedia = { prestigio: 60 };
const equipeGrande = { prestigio: 88 };

describe('gate de prestígio: jovem Elite não desce por dinheiro', () => {
  const jovemElite = piloto(22, 92, 30); // potencial de campeão, subindo

  it('recusa equipe pequena mesmo com salário 3× o exigido', () => {
    const decisao = interessePiloto(jovemElite, equipePequena, {
      pilotoId: jovemElite.id,
      salarioAnual: jovemElite.salarioBase * 3,
      duracaoAnos: 3,
    });
    expect(decisao.aceita).toBe(false);
    expect(decisao.motivo).toContain('prestígio');
  });

  it('aceita equipe grande pagando o salário de mercado', () => {
    const decisao = interessePiloto(jovemElite, equipeGrande, {
      pilotoId: jovemElite.id,
      salarioAnual: jovemElite.salarioBase,
      duracaoAnos: 3,
    });
    expect(decisao.aceita).toBe(true);
  });
});

describe('efeito Alonso: idade e fase mudam a decisão, não só o overall', () => {
  // Veterano campeão em declínio vs jovem em ascensão — MESMO overall atual
  const veterano = piloto(38, 92, 95);
  const jovem = piloto(24, 88, 30);

  it('cenário válido: os dois têm overall atual parecido', () => {
    expect(Math.abs(overallAtual(veterano) - overallAtual(jovem))).toBeLessThan(4);
  });

  it('o veterano aceita descer para a equipe pequena por um salário atrativo', () => {
    const decisao = interessePiloto(
      veterano,
      equipePequena,
      { pilotoId: veterano.id, salarioAnual: Math.round(veterano.salarioBase * 1.4), duracaoAnos: 2 },
      equipeMedia // está empregado numa equipe de prestígio maior
    );
    expect(decisao.aceita).toBe(true);
  });

  it('o jovem de mesmo overall recusa a MESMA oferta (proporcional)', () => {
    const decisao = interessePiloto(
      jovem,
      equipePequena,
      { pilotoId: jovem.id, salarioAnual: Math.round(jovem.salarioBase * 1.4), duracaoAnos: 2 },
      equipeMedia
    );
    expect(decisao.aceita).toBe(false);
  });

  it('o nome grande custa caro: salário exigido do veterano >> do jovem de mesmo overall', () => {
    expect(veterano.salarioBase).toBeGreaterThan(jovem.salarioBase * 1.5);
  });
});

describe('piloto no auge raramente desce de prestígio', () => {
  const noAuge = piloto(29, 90, 70);

  it('recusa descer de uma grande para uma média mesmo com 1.5× de salário', () => {
    const decisao = interessePiloto(
      noAuge,
      equipeMedia,
      { pilotoId: noAuge.id, salarioAnual: Math.round(noAuge.salarioBase * 1.5), duracaoAnos: 2 },
      equipeGrande
    );
    expect(decisao.aceita).toBe(false);
  });
});

describe('piloto sem volante aceita com mais facilidade', () => {
  const jornaleiro = piloto(30, 74, 20);

  it('livre, aceita a equipe pequena pelo salário de mercado', () => {
    const decisao = interessePiloto(jornaleiro, equipePequena, {
      pilotoId: jornaleiro.id,
      salarioAnual: jornaleiro.salarioBase,
      duracaoAnos: 2,
    });
    expect(decisao.aceita).toBe(true);
  });
});

describe('custoRescisao', () => {
  it('é proporcional aos anos restantes e ao salário', () => {
    expect(custoRescisao(10_000_000, 2)).toBe(10_000_000); // 2 anos × 10M × 0.5
    expect(custoRescisao(10_000_000, 1)).toBe(5_000_000);
  });
});
