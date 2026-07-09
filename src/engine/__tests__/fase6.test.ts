// ============================================================================
// Fase 6 — provas dos três blocos sistêmicos:
//  A) prestígio de patrocinador vira contratações SEM furar a regra dura;
//  B) motores evoluem com random walk determinístico e limitado;
//  C) chefes acumulam histórico/títulos e o Lendário dispara em 3.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { MOTORES } from '../../data/motores';
import {
  BONUS_MAX_PATROCINIO,
  MOTOR_CONF_MAXIMA,
  MOTOR_CONF_MINIMA,
  MOTOR_POTENCIA_MAXIMA,
  MOTOR_POTENCIA_MINIMA,
} from '../constantes';
import { atualizarChefes, statusChefe } from '../chefes';
import { deltaRankingMotor, evoluirMotores, tendenciaMotor } from '../motorCarreira';
import { interessePiloto, prestigioEfetivo } from '../mercado';
import { qualidadeAtual, salarioExigido } from '../pilotoCarreira';
import { criarRng } from '../rng';
import type { Chefe, Motor, Piloto } from '../tipos';
import { pilotoTeste } from './fixtures';

// ---------------------------------------------------------------------------
// Bloco A — prestígio do patrocinador como ímã de pilotos
// ---------------------------------------------------------------------------

function pilotoAlvo(): Piloto {
  // Jovem NÃO-elite em ascensão (potencial 80): ambicioso o bastante para a
  // equipe intermediária ficar fora do alcance sem uma marca forte
  const base = { idade: 24, potencialClassificacao: 80, potencialCorrida: 80, confiabilidadeBase: 75 };
  const p = pilotoTeste({ id: 'alvo', reputacao: 30, ...base, ...qualidadeAtual(base) });
  return { ...p, salarioBase: salarioExigido(p) };
}

const equipeIntermediaria = { prestigio: 52 };
const equipeAtualDele = { prestigio: 52 };
const grifeDeHeranca = { prestigio: 94 };  // Meridiem: paga pouco, vale muito
const dinheiroNovo = { prestigio: 22 };    // Krakatoa: paga muito, vale pouco

describe('Bloco A — patrocinador de prestígio vira a contratação', () => {
  const alvo = pilotoAlvo();
  const oferta = { pilotoId: alvo.id, salarioAnual: alvo.salarioBase, duracaoAnos: 2 };

  it('com o patrocinador de dinheiro novo (prestígio baixo), o piloto recusa', () => {
    const decisao = interessePiloto(alvo, equipeIntermediaria, oferta, equipeAtualDele, dinheiroNovo);
    expect(decisao.aceita).toBe(false);
  });

  it('com a grife de herança (prestígio alto, aporte menor), o MESMO piloto aceita', () => {
    const decisao = interessePiloto(alvo, equipeIntermediaria, oferta, equipeAtualDele, grifeDeHeranca);
    expect(decisao.aceita).toBe(true);
  });

  it('o bônus é limitado: nem a melhor marca passa de BONUS_MAX', () => {
    expect(prestigioEfetivo(52, { prestigio: 100 })).toBe(52 + BONUS_MAX_PATROCINIO);
  });

  it('REGRA DURA preservada: jovem elite recusa equipe 1-estrela mesmo com a melhor marca e salário 3×', () => {
    const base = { idade: 22, potencialClassificacao: 92, potencialCorrida: 92, confiabilidadeBase: 75 };
    const jovemElite = pilotoTeste({ id: 'elite', reputacao: 30, ...base, ...qualidadeAtual(base) });
    const decisao = interessePiloto(
      jovemElite,
      { prestigio: 35 },
      { pilotoId: 'elite', salarioAnual: salarioExigido(jovemElite) * 3, duracaoAnos: 3 },
      undefined,
      grifeDeHeranca
    );
    expect(decisao.aceita).toBe(false);
    expect(decisao.motivo).toContain('prestígio');
  });
});

// ---------------------------------------------------------------------------
// Bloco B — motores que evoluem
// ---------------------------------------------------------------------------

function motoresIniciais(): Record<string, Motor> {
  return Object.fromEntries(MOTORES.map((m) => [m.id, structuredClone(m)]));
}

function evoluirNAnos(anos: number, seed = 1): Record<string, Motor> {
  let motores = motoresIniciais();
  for (let ano = 2026; ano < 2026 + anos; ano++) {
    motores = evoluirMotores(motores, ano, criarRng(seed + ano));
  }
  return motores;
}

describe('Bloco B — evolução dos motores', () => {
  it('é determinística: mesma seed → mesma trajetória', () => {
    expect(evoluirNAnos(12, 7)).toEqual(evoluirNAnos(12, 7));
  });

  it('em 12 temporadas alguns motores sobem e outros caem', () => {
    const depois = evoluirNAnos(12);
    const deltas = MOTORES.map((m) => depois[m.id].potencia - m.potencia);
    expect(deltas.some((d) => d > 2)).toBe(true);
    expect(deltas.some((d) => d < -2)).toBe(true);
  });

  it('os ratings ficam sempre dentro das faixas sãs', () => {
    for (const seed of [1, 5, 42]) {
      let motores = motoresIniciais();
      for (let ano = 2026; ano < 2046; ano++) {
        motores = evoluirMotores(motores, ano, criarRng(seed + ano));
        for (const m of Object.values(motores)) {
          expect(m.potencia).toBeGreaterThanOrEqual(MOTOR_POTENCIA_MINIMA);
          expect(m.potencia).toBeLessThanOrEqual(MOTOR_POTENCIA_MAXIMA);
          expect(m.confiabilidade).toBeGreaterThanOrEqual(MOTOR_CONF_MINIMA);
          expect(m.confiabilidade).toBeLessThanOrEqual(MOTOR_CONF_MAXIMA);
        }
      }
    }
  });

  it('acumula o histórico de ratings (um registro por temporada)', () => {
    const depois = evoluirNAnos(5);
    for (const m of Object.values(depois)) {
      expect(m.historicoRatings).toHaveLength(5);
    }
  });

  it('a dica de tendência reflete a variação recente', () => {
    const subindo: Motor = {
      ...MOTORES[0], potencia: 90,
      historicoRatings: [
        { ano: 2026, potencia: 85, confiabilidade: 80 },
        { ano: 2027, potencia: 87.5, confiabilidade: 80 },
      ],
    };
    expect(tendenciaMotor(subindo)).toBe('subindo');
    expect(tendenciaMotor({ ...subindo, potencia: 85.5 })).toBe('estavel');
    expect(tendenciaMotor({ ...subindo, potencia: 82 })).toBe('caindo');
  });

  it('deltaRankingMotor mede subida/queda de posições entre anos', () => {
    // Dois motores que trocam de posição entre o ano passado e o atual
    const motores: Record<string, Motor> = {
      a: { ...MOTORES[0], id: 'a', potencia: 85, historicoRatings: [{ ano: 2026, potencia: 90, confiabilidade: 80 }] },
      b: { ...MOTORES[1], id: 'b', potencia: 88, historicoRatings: [{ ano: 2026, potencia: 86, confiabilidade: 80 }] },
    };
    expect(deltaRankingMotor(motores, 'b')).toBe(1);  // subiu 1 posição
    expect(deltaRankingMotor(motores, 'a')).toBe(-1); // caiu 1 posição
  });
});

// ---------------------------------------------------------------------------
// Blocos C/D — chefes, títulos e status
// ---------------------------------------------------------------------------

describe('Bloco C — escada de status do chefe', () => {
  it('o Lendário dispara EXATAMENTE em 3 títulos', () => {
    expect(statusChefe(0)).toBe('Novato');
    expect(statusChefe(1)).toBe('Estabelecido');
    expect(statusChefe(2)).toBe('Consagrado');
    expect(statusChefe(3)).toBe('Lendário');
    expect(statusChefe(7)).toBe('Lendário');
  });
});

describe('Bloco C — atualização anual dos chefes', () => {
  function cenario() {
    const chefes: Record<string, Chefe> = {
      'chefe-a': { id: 'chefe-a', nome: 'A', reputacao: 70, campeonatosVencidos: 2, historico: [] },
      'chefe-b': { id: 'chefe-b', nome: 'B', reputacao: 50, campeonatosVencidos: 0, historico: [] },
    };
    const estado = {
      ano: 2030,
      equipes: [
        { id: 'eq-a', chefeId: 'chefe-a', ehJogador: false, prestigio: 80 },
        { id: 'eq-b', chefeId: 'chefe-b', ehJogador: false, prestigio: 50 },
      ],
      chefes,
    } as never;
    return { estado, chefes };
  }

  it('campeão ganha título e histórico; frustrado perde reputação', () => {
    const { estado, chefes } = cenario();
    // A equipe B (rank 2 de prestígio) vence; a A (rank 1) termina em 2º
    atualizarChefes(
      estado,
      [{ equipeId: 'eq-b', posicao: 1 }, { equipeId: 'eq-a', posicao: 2 }],
      { 'eq-a': 1, 'eq-b': 2 }
    );
    expect(chefes['chefe-b'].campeonatosVencidos).toBe(1);
    expect(chefes['chefe-b'].reputacao).toBeGreaterThan(50); // superou a expectativa
    expect(chefes['chefe-a'].reputacao).toBeLessThan(70);    // decepcionou
    expect(chefes['chefe-a'].historico).toEqual([
      { ano: 2030, equipeId: 'eq-a', posicaoConstrutores: 2, campeao: false },
    ]);
  });

  it('um terceiro título transforma o chefe em Lendário', () => {
    const { estado, chefes } = cenario();
    atualizarChefes(
      estado,
      [{ equipeId: 'eq-a', posicao: 1 }, { equipeId: 'eq-b', posicao: 2 }],
      { 'eq-a': 1, 'eq-b': 2 }
    );
    expect(chefes['chefe-a'].campeonatosVencidos).toBe(3);
    expect(statusChefe(chefes['chefe-a'].campeonatosVencidos)).toBe('Lendário');
  });
});
