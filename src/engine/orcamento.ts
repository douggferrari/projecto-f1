// ============================================================================
// Sistema de orçamento — funções puras.
// receita = orçamento-base + aporte do patrocinador + premiação do ano anterior
// gastos fixos = motor + salários dos 2 pilotos
// desenvolvimento = resíduo flexível escolhido pelo jogador (até o teto)
// Regra dura: gastos fixos + desenvolvimento NUNCA excedem a receita.
// ============================================================================

import type { Equipe, Patrocinador } from './tipos';

/** Receita total da equipe para a temporada. */
export function receitaTemporada(
  equipe: Equipe,
  patrocinadores: Record<string, Patrocinador>,
  premiacaoAnoAnterior: number
): number {
  const aporte = patrocinadores[equipe.patrocinadorId]?.aporte ?? 0;
  return equipe.orcamentoBase + aporte + premiacaoAnoAnterior;
}

/** Gastos fixos anuais: contrato de motor + salários dos dois pilotos. */
export function gastosFixos(equipe: Equipe): number {
  return (
    equipe.contratoMotor.custoAnual +
    equipe.pilotos[0].salarioAnual +
    equipe.pilotos[1].salarioAnual
  );
}

/** Quanto sobra da receita para investir em desenvolvimento (piso 0 não é aplicado — negativo indica estouro). */
export function orcamentoDisponivelParaDesenvolvimento(
  equipe: Equipe,
  patrocinadores: Record<string, Patrocinador>,
  premiacaoAnoAnterior: number
): number {
  return receitaTemporada(equipe, patrocinadores, premiacaoAnoAnterior) - gastosFixos(equipe);
}

export interface ValidacaoOrcamento {
  valido: boolean;
  receita: number;
  gastosFixos: number;
  investimento: number;
  saldo: number;   // receita - gastos - investimento
  estouro: number; // quanto precisa cortar (0 se válido)
  mensagem?: string;
}

/**
 * Valida o orçamento da pré-temporada. Se os gastos fixos + investimento
 * excedem a receita, devolve `valido: false` com o valor exato do corte
 * necessário e uma mensagem clara.
 */
export function validarOrcamento(
  equipe: Equipe,
  patrocinadores: Record<string, Patrocinador>,
  premiacaoAnoAnterior: number,
  investimento: number
): ValidacaoOrcamento {
  const receita = receitaTemporada(equipe, patrocinadores, premiacaoAnoAnterior);
  const fixos = gastosFixos(equipe);
  const saldo = receita - fixos - investimento;
  const estouro = Math.max(0, -saldo);

  let mensagem: string | undefined;
  if (investimento < 0) {
    mensagem = 'O investimento em desenvolvimento não pode ser negativo.';
  } else if (fixos > receita) {
    mensagem = `Os contratos (motor + pilotos) custam ${formatarDinheiro(fixos)} e a receita é ${formatarDinheiro(receita)}. Corte ${formatarDinheiro(fixos - receita)} em contratos.`;
  } else if (estouro > 0) {
    mensagem = `Orçamento estourado em ${formatarDinheiro(estouro)}. Reduza o investimento em desenvolvimento para no máximo ${formatarDinheiro(receita - fixos)}.`;
  }

  return {
    valido: investimento >= 0 && estouro === 0,
    receita,
    gastosFixos: fixos,
    investimento,
    saldo,
    estouro,
    mensagem,
  };
}

/** Formata dinheiro do jogo: 32_500_000 → "$32,5 mi". */
export function formatarDinheiro(valor: number): string {
  const milhoes = valor / 1_000_000;
  const texto = (Math.round(milhoes * 10) / 10).toFixed(1).replace('.', ',');
  return `$${texto} mi`;
}
