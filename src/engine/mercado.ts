// ============================================================================
// Mercado de pilotos — Fase 4.
// O jogador pode ofertar a QUALQUER piloto (livre ou contratado). O piloto
// decide por interesse determinístico: prestígio da equipe vs. ambição
// efetiva (que decai com a idade) + salário (que pesa mais com a idade).
//
// É daqui que sai o "efeito Alonso": um veterano realizado aceita descer
// para uma equipe menor por salário; um jovem de elite recusa a mesma
// oferta por dinheiro nenhum — quer brigar por título num time grande.
// ============================================================================

import {
  BONUS_SEM_VOLANTE,
  FATOR_AMBICAO_POR_FASE,
  FATOR_RESCISAO,
  FOLGA_AMBICAO,
  LIMIAR_ACEITE_DESCER_NO_AUGE,
  LIMIAR_ACEITE_EMPREGADO,
  LIMIAR_ACEITE_LIVRE,
  PESO_SALARIO_POR_FASE,
  POTENCIAL_ELITE,
  PRESTIGIO_MINIMO_JOVEM_ELITE,
  TETO_SCORE_SALARIO,
} from './constantes';
import { contratoVigente } from './contratos';
import { faseCarreira, potencialOverall, salarioExigido } from './pilotoCarreira';
import type { Equipe, EstadoJogo, Piloto } from './tipos';

export interface Oferta {
  pilotoId: string;
  salarioAnual: number;
  duracaoAnos: number;
}

export interface DecisaoPiloto {
  aceita: boolean;
  /** Explicação exibida na UI ("quer brigar por títulos", "veio pelo salário"...). */
  motivo: string;
  score: number;
}

/** Equipe atual de um piloto (undefined se livre). */
export function equipeDoPiloto(estado: EstadoJogo, pilotoId: string): Equipe | undefined {
  return estado.equipes.find((e) =>
    e.pilotos.some((c) => c.pilotoId === pilotoId && contratoVigente(c, estado.ano))
  );
}

/** Custo de rescisão para tirar um piloto contratado: anos restantes × salário × fator. */
export function custoRescisao(salarioAnual: number, anosRestantes: number): number {
  return Math.round(salarioAnual * anosRestantes * FATOR_RESCISAO);
}

/**
 * Decisão do piloto sobre uma oferta — determinística (testável e justa).
 *
 * score = pesoPrestigio × (prestígio da equipe − (ambição efetiva − folga)) / 25
 *       + pesoSalario × min(teto, salárioOferta/salárioExigido − 1)
 *
 * A fase de carreira desloca os pesos: jovens pesam prestígio, veteranos
 * pesam salário. Regras duras por cima do score:
 *  - jovem de potencial elite NUNCA assina com equipe de prestígio baixo;
 *  - piloto no auge exige score alto para DESCER de prestígio;
 *  - piloto sem volante aceita com muito mais facilidade.
 */
export function interessePiloto(
  piloto: Piloto,
  equipeOfertante: Pick<Equipe, 'prestigio'>,
  oferta: Oferta,
  equipeAtual?: Pick<Equipe, 'prestigio'>
): DecisaoPiloto {
  const fase = faseCarreira(piloto.idade);
  const potencial = potencialOverall(piloto);

  // Regra dura: jovem de elite não desce para projeto pequeno por dinheiro
  if (
    fase === 'subindo' &&
    potencial >= POTENCIAL_ELITE &&
    equipeOfertante.prestigio < PRESTIGIO_MINIMO_JOVEM_ELITE
  ) {
    return {
      aceita: false,
      motivo: 'Quer brigar por títulos num projeto grande — prestígio da equipe é insuficiente, por salário nenhum.',
      score: -Infinity,
    };
  }

  const pesoSalario = PESO_SALARIO_POR_FASE[fase];
  const pesoPrestigio = 1 - pesoSalario;
  const ambicaoEfetiva = potencial * FATOR_AMBICAO_POR_FASE[fase];

  const scorePrestigio = (equipeOfertante.prestigio - (ambicaoEfetiva - FOLGA_AMBICAO)) / 25;
  const razaoSalario = oferta.salarioAnual / salarioExigido(piloto) - 1;
  const scoreSalario = Math.min(TETO_SCORE_SALARIO, razaoSalario);

  let score = pesoPrestigio * scorePrestigio + pesoSalario * scoreSalario;
  const empregado = equipeAtual !== undefined;
  if (!empregado) score += BONUS_SEM_VOLANTE;

  // Piloto no auge raramente aceita DESCER de prestígio
  const descendo = empregado && equipeOfertante.prestigio < equipeAtual.prestigio - 3;
  const limiar = !empregado
    ? LIMIAR_ACEITE_LIVRE
    : fase === 'auge' && descendo
      ? LIMIAR_ACEITE_DESCER_NO_AUGE
      : LIMIAR_ACEITE_EMPREGADO;

  const aceita = score >= limiar;
  return { aceita, motivo: montarMotivo(aceita, fase, scorePrestigio, scoreSalario, descendo, empregado), score };
}

function montarMotivo(
  aceita: boolean,
  fase: string,
  scorePrestigio: number,
  scoreSalario: number,
  descendo: boolean,
  empregado: boolean
): string {
  if (aceita) {
    if (descendo && scoreSalario > 0.1) return 'Aceitou descer de projeto pelo salário e pelo protagonismo.';
    if (scorePrestigio > 0.3) return 'Vê a equipe como um passo à frente na carreira.';
    if (!empregado) return 'Sem volante, aceitou a proposta.';
    return 'Proposta considerada justa.';
  }
  if (fase === 'auge' && descendo) return 'No auge, não pretende descer de prestígio.';
  if (scorePrestigio < -0.3) return 'Acha o projeto pequeno demais para a ambição dele.';
  if (scoreSalario < 0) return 'Salário abaixo do que exige no mercado.';
  return 'Prefere manter a situação atual.';
}

/**
 * Valida uma oferta do jogador a um piloto CONTRATADO de outra equipe
 * (poaching). Regras:
 *  - exige um assento do jogador que vague no fim do ano (contrato a 1 ano);
 *  - custo de rescisão proporcional aos anos restantes do contrato alvo;
 *  - o piloto chega na temporada seguinte (OfertaPendente);
 *  - no máximo 1 poach por temporada.
 */
export function validarPoach(
  estado: EstadoJogo,
  pilotoId: string,
  slot: 0 | 1
): { valido: boolean; erro?: string; custoRescisao?: number } {
  if (estado.ofertaPendente) {
    return { valido: false, erro: 'Você já tem uma contratação pendente para o ano que vem.' };
  }
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const contratoSlot = jogador.pilotos[slot];
  const anosRestantesSlot = contratoSlot.anoInicio + contratoSlot.duracaoAnos - estado.ano;
  if (anosRestantesSlot > 1) {
    return { valido: false, erro: 'Esse assento ainda tem contrato para o ano que vem — não haverá vaga.' };
  }
  const equipeAlvo = equipeDoPiloto(estado, pilotoId);
  if (!equipeAlvo) {
    return { valido: false, erro: 'Piloto não está sob contrato — contrate direto pelo assento vago.' };
  }
  if (equipeAlvo.ehJogador) {
    return { valido: false, erro: 'O piloto já é da sua equipe.' };
  }
  const contratoAlvo = equipeAlvo.pilotos.find((c) => c.pilotoId === pilotoId)!;
  const anosRestantes = contratoAlvo.anoInicio + contratoAlvo.duracaoAnos - estado.ano;
  return { valido: true, custoRescisao: custoRescisao(contratoAlvo.salarioAnual, anosRestantes) };
}
