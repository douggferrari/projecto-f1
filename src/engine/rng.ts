// ============================================================================
// Gerador de números pseudoaleatórios com seed (mulberry32).
// Todas as funções do motor recebem um RNG explícito — isso torna a
// simulação determinística nos testes e "aleatória de verdade" no jogo
// (basta usar uma seed derivada de Date.now() na camada de UI).
// ============================================================================

export interface RNG {
  /** Número em [0, 1), como Math.random() */
  proximo(): number;
  /** Número uniforme em [min, max) */
  entre(min: number, max: number): number;
  /** true com a probabilidade dada (0 a 1) */
  chance(probabilidade: number): boolean;
  /** Inteiro uniforme em [min, max] (inclusivo) */
  inteiroEntre(min: number, max: number): number;
}

/**
 * Deriva uma seed determinística a partir de várias partes (seed-base da
 * carreira, ano, índice do GP, etapa...). Mesmas partes → mesma seed, e
 * partes vizinhas geram seeds bem espalhadas (mistura estilo Wang hash).
 */
export function derivarSeed(...partes: number[]): number {
  let h = 0x9e3779b9;
  for (const parte of partes) {
    h ^= Math.imul(parte + 0x7f4a7c15, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

/** Cria um RNG determinístico a partir de uma seed inteira. */
export function criarRng(seed: number): RNG {
  let estado = seed >>> 0;

  const proximo = (): number => {
    // mulberry32 — rápido e com boa distribuição para jogos
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    proximo,
    entre: (min, max) => min + proximo() * (max - min),
    chance: (p) => proximo() < p,
    inteiroEntre: (min, max) => min + Math.floor(proximo() * (max - min + 1)),
  };
}
