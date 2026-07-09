// ============================================================================
// Arco de carreira do piloto — Fase 4.
// A qualidade ATUAL (classificacao/corrida/confiabilidade) é derivada do
// potencial × curva de idade: sobe até ~27, platô até ~32, declina depois
// (a volta rápida decai antes da malandragem de corrida; a confiabilidade
// melhora com a experiência). A reputação persiste com a idade e puxa o
// salário exigido — nome grande custa caro mesmo em queda.
// ============================================================================

import {
  CHANCE_APOSENTADORIA_POR_ANO,
  CHANCE_NOVATO_CRAQUE,
  CHANCE_SEGUNDO_NOVATO,
  DECLINIO_ANUAL_CORRIDA,
  DECLINIO_ANUAL_QUALI,
  DECLINIO_TARDIO_CORRIDA,
  DECLINIO_TARDIO_QUALI,
  EXPERIENCIA_CONF_MAXIMA,
  EXPERIENCIA_CONF_POR_ANO,
  IDADE_APOSENTADORIA_BASE,
  IDADE_DECLINIO_TARDIO,
  IDADE_ESTREIA,
  IDADE_PICO_FIM,
  IDADE_PICO_INICIO,
  MULT_IDADE_INICIAL,
  MULT_IDADE_MINIMO,
  NOVATOS_POR_ANO_MINIMO,
  POTENCIAL_CRAQUE_MAXIMO,
  POTENCIAL_CRAQUE_MINIMO,
  POTENCIAL_NOVATO_MAXIMO,
  POTENCIAL_NOVATO_MINIMO,
  REPUTACAO_PILOTO_PODIO,
  REPUTACAO_PILOTO_TITULO,
  REPUTACAO_PILOTO_VITORIA,
  SALARIO_MERCADO_BASE,
  SALARIO_MERCADO_EXPOENTE,
  SALARIO_MINIMO,
  SALARIO_PESO_QUALIDADE,
  SALARIO_PESO_REPUTACAO,
} from './constantes';
import { limitar0a100 } from './desempenho';
import type { RNG } from './rng';
import type { FaseCarreiraPiloto, Piloto } from './tipos';

// ---------------------------------------------------------------------------
// Curva de idade
// ---------------------------------------------------------------------------

/** Multiplicador da curva de idade para um tipo de ritmo. */
export function multiplicadorIdade(idade: number, tipo: 'classificacao' | 'corrida'): number {
  if (idade <= IDADE_PICO_INICIO) {
    // Subida linear: MULT_IDADE_INICIAL aos 18 → 1.0 no início do pico
    const progresso = Math.max(0, (idade - IDADE_ESTREIA) / (IDADE_PICO_INICIO - IDADE_ESTREIA));
    return MULT_IDADE_INICIAL + (1 - MULT_IDADE_INICIAL) * Math.min(1, progresso);
  }
  if (idade <= IDADE_PICO_FIM) return 1;

  // Declínio: normal até IDADE_DECLINIO_TARDIO, acelerado depois
  const anosTardios = Math.max(0, idade - IDADE_DECLINIO_TARDIO);
  const anosNormais = idade - IDADE_PICO_FIM - anosTardios;
  const taxaNormal = tipo === 'classificacao' ? DECLINIO_ANUAL_QUALI : DECLINIO_ANUAL_CORRIDA;
  const taxaTardia = tipo === 'classificacao' ? DECLINIO_TARDIO_QUALI : DECLINIO_TARDIO_CORRIDA;
  return Math.max(MULT_IDADE_MINIMO, 1 - taxaNormal * anosNormais - taxaTardia * anosTardios);
}

/** Qualidade atual derivada do potencial + idade. */
export function qualidadeAtual(piloto: Pick<Piloto, 'idade' | 'potencialClassificacao' | 'potencialCorrida' | 'confiabilidadeBase'>): {
  classificacao: number;
  corrida: number;
  confiabilidade: number;
} {
  const experiencia = Math.min(
    EXPERIENCIA_CONF_MAXIMA,
    Math.max(0, (piloto.idade - 22) * EXPERIENCIA_CONF_POR_ANO)
  );
  return {
    classificacao: limitar0a100(piloto.potencialClassificacao * multiplicadorIdade(piloto.idade, 'classificacao')),
    corrida: limitar0a100(piloto.potencialCorrida * multiplicadorIdade(piloto.idade, 'corrida')),
    confiabilidade: limitar0a100(piloto.confiabilidadeBase + experiencia),
  };
}

export function faseCarreira(idade: number): FaseCarreiraPiloto {
  if (idade < IDADE_PICO_INICIO) return 'subindo';
  if (idade <= IDADE_PICO_FIM) return 'auge';
  if (idade <= IDADE_DECLINIO_TARDIO) return 'declinio';
  return 'veterano';
}

// ---------------------------------------------------------------------------
// Overall, categoria e salário
// ---------------------------------------------------------------------------

/** Overall atual (mistura quali/corrida — corrida pesa mais no dia a dia). */
export function overallAtual(piloto: Pick<Piloto, 'classificacao' | 'corrida'>): number {
  return 0.45 * piloto.classificacao + 0.55 * piloto.corrida;
}

export function potencialOverall(piloto: Pick<Piloto, 'potencialClassificacao' | 'potencialCorrida'>): number {
  return 0.45 * piloto.potencialClassificacao + 0.55 * piloto.potencialCorrida;
}

export type CategoriaPiloto = 'Elite' | 'Forte' | 'Regular' | 'Promessa' | 'Iniciante';

/** Categoria pela qualidade ATUAL (5 classes, exibidas com estrelas). */
export function categoriaPiloto(piloto: Pick<Piloto, 'classificacao' | 'corrida'>): {
  categoria: CategoriaPiloto;
  estrelas: number;
} {
  const overall = overallAtual(piloto);
  if (overall >= 88) return { categoria: 'Elite', estrelas: 5 };
  if (overall >= 80) return { categoria: 'Forte', estrelas: 4 };
  if (overall >= 71) return { categoria: 'Regular', estrelas: 3 };
  if (overall >= 62) return { categoria: 'Promessa', estrelas: 2 };
  return { categoria: 'Iniciante', estrelas: 1 };
}

/**
 * Salário anual exigido no mercado: qualidade atual + reputação.
 * A reputação faz o veterano campeão continuar caro mesmo em declínio.
 */
export function salarioExigido(piloto: Pick<Piloto, 'classificacao' | 'corrida' | 'reputacao'>): number {
  const score =
    SALARIO_PESO_QUALIDADE * overallAtual(piloto) + SALARIO_PESO_REPUTACAO * piloto.reputacao;
  const salario = SALARIO_MERCADO_BASE * Math.exp(SALARIO_MERCADO_EXPOENTE * score);
  return Math.max(SALARIO_MINIMO, Math.round(salario / 100_000) * 100_000);
}

// ---------------------------------------------------------------------------
// Virada de ano: envelhecer, reputação, aposentadoria, novatos
// ---------------------------------------------------------------------------

/** Envelhece 1 ano e recalcula qualidade e salário exigido (imutável). */
export function envelhecerPiloto(piloto: Piloto): Piloto {
  const idade = piloto.idade + 1;
  const qualidade = qualidadeAtual({ ...piloto, idade });
  const novo: Piloto = { ...piloto, idade, ...qualidade };
  return { ...novo, salarioBase: salarioExigido(novo) };
}

/** Reputação ganha na temporada: vitórias, pódios e título. */
export function reputacaoDaTemporada(
  vitorias: number,
  podios: number,
  campeao: boolean
): number {
  return (
    vitorias * REPUTACAO_PILOTO_VITORIA +
    podios * REPUTACAO_PILOTO_PODIO +
    (campeao ? REPUTACAO_PILOTO_TITULO : 0)
  );
}

/** Sorteia a aposentadoria: chance cresce a cada ano a partir da base. */
export function sorteiaAposentadoria(idade: number, rng: RNG): boolean {
  if (idade < IDADE_APOSENTADORIA_BASE) return false;
  const chance = (idade - IDADE_APOSENTADORIA_BASE + 1) * CHANCE_APOSENTADORIA_POR_ANO;
  return rng.chance(Math.min(1, chance));
}

// Nomes fictícios para o pipeline de novatos
const NOMES = [
  'Caio', 'Mateo', 'Yuki', 'Léon', 'Tomás', 'Nikita', 'Jasper', 'Rafinha', 'Emil', 'Duda',
  'Álvaro', 'Kimi', 'Otto', 'Bruno', 'Sacha', 'Teo', 'Iuri', 'Marco', 'Felix', 'Dario',
];
const SOBRENOMES = [
  'Ferraz', 'Kobayashi', 'Silva', 'Marchetti', 'Novak', 'Duval', 'Ekström', 'Paiva', 'Romano', 'Vidal',
  'Costa', 'Meyer', 'Sato', 'Oliveira', 'Kranz', 'Baptista', 'Moretti', 'Lindgren', 'Serrano', 'Faria',
];

/** Gera os novatos da temporada (1-2, com cauda rara de "próximo craque"). */
export function gerarNovatos(ano: number, rng: RNG): Piloto[] {
  const quantidade = NOVATOS_POR_ANO_MINIMO + (rng.chance(CHANCE_SEGUNDO_NOVATO) ? 1 : 0);
  return Array.from({ length: quantidade }, (_, i) => {
    const craque = rng.chance(CHANCE_NOVATO_CRAQUE);
    const potencial = craque
      ? rng.entre(POTENCIAL_CRAQUE_MINIMO, POTENCIAL_CRAQUE_MAXIMO)
      : rng.entre(POTENCIAL_NOVATO_MINIMO, POTENCIAL_NOVATO_MAXIMO);
    const base: Omit<Piloto, 'classificacao' | 'corrida' | 'confiabilidade' | 'salarioBase'> = {
      id: `pil-nov-${ano}-${i + 1}`,
      nome: `${NOMES[rng.inteiroEntre(0, NOMES.length - 1)]} ${SOBRENOMES[rng.inteiroEntre(0, SOBRENOMES.length - 1)]}`,
      idade: rng.inteiroEntre(18, 21),
      potencialClassificacao: limitar0a100(potencial + rng.entre(-3, 3)),
      potencialCorrida: limitar0a100(potencial + rng.entre(-3, 3)),
      confiabilidadeBase: rng.inteiroEntre(64, 80),
      reputacao: rng.inteiroEntre(5, 15),
    };
    const qualidade = qualidadeAtual(base);
    const piloto: Piloto = { ...base, ...qualidade, salarioBase: 0 };
    return { ...piloto, salarioBase: salarioExigido(piloto) };
  });
}

/**
 * Prepara um piloto dos dados-base: deriva o POTENCIAL a partir da
 * qualidade atual ÷ curva da idade — assim o grid do ano 1 fica idêntico
 * ao balanceado nas fases anteriores, e a deriva começa dali.
 */
export function prepararPilotoInicial(
  piloto: Omit<Piloto, 'potencialClassificacao' | 'potencialCorrida' | 'confiabilidadeBase'>
): Piloto {
  const experiencia = Math.min(
    EXPERIENCIA_CONF_MAXIMA,
    Math.max(0, (piloto.idade - 22) * EXPERIENCIA_CONF_POR_ANO)
  );
  return {
    ...piloto,
    potencialClassificacao: piloto.classificacao / multiplicadorIdade(piloto.idade, 'classificacao'),
    potencialCorrida: piloto.corrida / multiplicadorIdade(piloto.idade, 'corrida'),
    confiabilidadeBase: piloto.confiabilidade - experiencia,
  };
}
