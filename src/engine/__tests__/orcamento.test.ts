import { describe, expect, it } from 'vitest';
import {
  formatarDinheiro,
  gastosFixos,
  orcamentoDisponivelParaDesenvolvimento,
  receitaTemporada,
  validarOrcamento,
} from '../orcamento';
import { equipeTeste } from './fixtures';
import type { Patrocinador } from '../tipos';

const patrocinadores: Record<string, Patrocinador> = {
  'pat-x': { id: 'pat-x', nome: 'Pat X', aporte: 10_000_000, prestigioMinimo: 0 },
};

// equipeTeste: orcamentoBase 50M, motor 1M/ano, 2 pilotos de 1M/ano
function equipe() {
  return equipeTeste('eqA', 'm1', ['p1', 'p2'], 50);
}

describe('receita, gastos e resíduo', () => {
  it('receita = base + patrocínio + premiação anterior', () => {
    expect(receitaTemporada(equipe(), patrocinadores, 20_000_000)).toBe(80_000_000);
  });

  it('patrocinador desconhecido não soma aporte', () => {
    const e = { ...equipe(), patrocinadorId: 'pat-inexistente' };
    expect(receitaTemporada(e, patrocinadores, 0)).toBe(50_000_000);
  });

  it('gastos fixos = motor + salários dos 2 pilotos', () => {
    expect(gastosFixos(equipe())).toBe(3_000_000);
  });

  it('resíduo para desenvolvimento = receita - gastos fixos', () => {
    expect(orcamentoDisponivelParaDesenvolvimento(equipe(), patrocinadores, 0)).toBe(57_000_000);
  });
});

describe('validarOrcamento (regra dura)', () => {
  it('aceita investimento até o teto disponível', () => {
    const v = validarOrcamento(equipe(), patrocinadores, 0, 57_000_000);
    expect(v.valido).toBe(true);
    expect(v.saldo).toBe(0);
    expect(v.estouro).toBe(0);
  });

  it('bloqueia investimento acima do disponível e diz quanto cortar', () => {
    const v = validarOrcamento(equipe(), patrocinadores, 0, 60_000_000);
    expect(v.valido).toBe(false);
    expect(v.estouro).toBe(3_000_000);
    expect(v.mensagem).toContain('$3,0 mi');
  });

  it('bloqueia quando os próprios contratos já estouram a receita', () => {
    const cara = equipe();
    cara.pilotos[0].salarioAnual = 60_000_000; // salário impagável
    const v = validarOrcamento(cara, patrocinadores, 0, 0);
    expect(v.valido).toBe(false);
    expect(v.mensagem).toContain('Corte');
  });

  it('rejeita investimento negativo', () => {
    expect(validarOrcamento(equipe(), patrocinadores, 0, -1).valido).toBe(false);
  });
});

describe('formatarDinheiro', () => {
  it('formata em milhões com vírgula', () => {
    expect(formatarDinheiro(32_500_000)).toBe('$32,5 mi');
    expect(formatarDinheiro(7_000_000)).toBe('$7,0 mi');
  });
});
