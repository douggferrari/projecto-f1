import { describe, expect, it } from 'vitest';
import { criarRng } from '../rng';
import {
  categoriaPiloto,
  envelhecerPiloto,
  faseCarreira,
  gerarNovatos,
  multiplicadorIdade,
  prepararPilotoInicial,
  qualidadeAtual,
  salarioExigido,
  sorteiaAposentadoria,
} from '../pilotoCarreira';
import { pilotoTeste } from './fixtures';

describe('curva de idade', () => {
  it('sobe até o pico, platô, e declina depois', () => {
    expect(multiplicadorIdade(20, 'corrida')).toBeLessThan(multiplicadorIdade(25, 'corrida'));
    expect(multiplicadorIdade(28, 'corrida')).toBe(1);
    expect(multiplicadorIdade(32, 'corrida')).toBe(1);
    expect(multiplicadorIdade(35, 'corrida')).toBeLessThan(1);
    expect(multiplicadorIdade(39, 'corrida')).toBeLessThan(multiplicadorIdade(35, 'corrida'));
  });

  it('a volta rápida decai mais cedo/rápido que o ritmo de corrida', () => {
    expect(multiplicadorIdade(35, 'classificacao')).toBeLessThan(multiplicadorIdade(35, 'corrida'));
    expect(multiplicadorIdade(39, 'classificacao')).toBeLessThan(multiplicadorIdade(39, 'corrida'));
  });

  it('a confiabilidade melhora com a experiência', () => {
    const jovem = qualidadeAtual({ idade: 20, potencialClassificacao: 80, potencialCorrida: 80, confiabilidadeBase: 70 });
    const experiente = qualidadeAtual({ idade: 34, potencialClassificacao: 80, potencialCorrida: 80, confiabilidadeBase: 70 });
    expect(experiente.confiabilidade).toBeGreaterThan(jovem.confiabilidade);
  });
});

describe('prepararPilotoInicial (compatibilidade com o balanceamento)', () => {
  it('a qualidade atual derivada bate exatamente com os ratings dos dados', () => {
    for (const idade of [19, 24, 28, 33, 37]) {
      const bruto = pilotoTeste({ idade, classificacao: 82, corrida: 84, confiabilidade: 80 });
      const preparado = prepararPilotoInicial(bruto);
      const q = qualidadeAtual(preparado);
      expect(q.classificacao).toBeCloseTo(82, 6);
      expect(q.corrida).toBeCloseTo(84, 6);
      expect(q.confiabilidade).toBeCloseTo(80, 6);
    }
  });

  it('um jovem com rating atual modesto carrega potencial alto', () => {
    const jovem = prepararPilotoInicial(pilotoTeste({ idade: 20, classificacao: 69, corrida: 71 }));
    expect(jovem.potencialCorrida).toBeGreaterThan(83);
  });
});

describe('envelhecimento e fases', () => {
  it('fases de carreira pela idade', () => {
    expect(faseCarreira(22)).toBe('subindo');
    expect(faseCarreira(29)).toBe('auge');
    expect(faseCarreira(34)).toBe('declinio');
    expect(faseCarreira(38)).toBe('veterano');
  });

  it('jovem melhora ao envelhecer; veterano piora', () => {
    const jovem = prepararPilotoInicial(pilotoTeste({ idade: 21, classificacao: 70, corrida: 72 }));
    const jovemDepois = envelhecerPiloto(jovem);
    expect(jovemDepois.corrida).toBeGreaterThan(jovem.corrida);

    const veterano = prepararPilotoInicial(pilotoTeste({ idade: 36, classificacao: 84, corrida: 86 }));
    const veteranoDepois = envelhecerPiloto(veterano);
    expect(veteranoDepois.classificacao).toBeLessThan(veterano.classificacao);
  });

  it('a reputação alta mantém o salário alto mesmo com a qualidade caindo', () => {
    const campeaoEmQueda = pilotoTeste({ classificacao: 78, corrida: 80, reputacao: 95 });
    const jovemMelhor = pilotoTeste({ classificacao: 84, corrida: 85, reputacao: 20 });
    expect(salarioExigido(campeaoEmQueda)).toBeGreaterThan(salarioExigido(jovemMelhor));
  });
});

describe('categorias', () => {
  it('classifica pelo overall atual em 5 classes', () => {
    expect(categoriaPiloto({ classificacao: 93, corrida: 94 }).categoria).toBe('Elite');
    expect(categoriaPiloto({ classificacao: 82, corrida: 83 }).categoria).toBe('Forte');
    expect(categoriaPiloto({ classificacao: 74, corrida: 75 }).categoria).toBe('Regular');
    expect(categoriaPiloto({ classificacao: 65, corrida: 66 }).categoria).toBe('Promessa');
    expect(categoriaPiloto({ classificacao: 55, corrida: 56 }).estrelas).toBe(1);
  });
});

describe('aposentadoria e novatos', () => {
  it('ninguém se aposenta antes da idade-base; aos 41+ é certo', () => {
    const rng = criarRng(1);
    expect(sorteiaAposentadoria(35, rng)).toBe(false);
    expect(sorteiaAposentadoria(42, rng)).toBe(true);
  });

  it('gera 1-2 novatos jovens por ano, com potencial na faixa', () => {
    for (let seed = 0; seed < 30; seed++) {
      const novatos = gerarNovatos(2030, criarRng(seed));
      expect(novatos.length).toBeGreaterThanOrEqual(1);
      expect(novatos.length).toBeLessThanOrEqual(2);
      for (const novato of novatos) {
        expect(novato.idade).toBeGreaterThanOrEqual(18);
        expect(novato.idade).toBeLessThanOrEqual(21);
        expect(novato.potencialCorrida).toBeGreaterThanOrEqual(POTENCIAL_MINIMO_ESPERADO);
        expect(novato.salarioBase).toBeGreaterThan(0);
      }
    }
  });

  it('a cauda rara de craques existe (algum novato elite em muitas seeds)', () => {
    let craques = 0;
    for (let seed = 0; seed < 200; seed++) {
      for (const novato of gerarNovatos(2030, criarRng(seed))) {
        if (novato.potencialCorrida >= 85) craques++;
      }
    }
    expect(craques).toBeGreaterThan(0);
    expect(craques).toBeLessThan(60); // raro, não comum
  });
});

const POTENCIAL_MINIMO_ESPERADO = 55; // 62 de potencial − variação de ±3 com folga
