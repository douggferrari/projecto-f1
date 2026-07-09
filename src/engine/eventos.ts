// ============================================================================
// Eventos de corrida — Fase 5 (chuva e safety car).
// O clima e o sorteio de eventos vêm de um RNG DERIVADO da seed do GP
// (etapa 6): com EVENTOS_ATIVADOS = false nada disso é consultado e a
// corrida é bit-idêntica à da Fase 4.
// ============================================================================

import { CHANCE_CHUVA_PADRAO } from './constantes';
import { criarRng, derivarSeed, type RNG } from './rng';
import type { Circuito, Clima, EstadoJogo } from './tipos';

/** Opções de eventos passadas à simulação da corrida. */
export interface EventosCorrida {
  clima: Clima;
  /** RNG exclusivo dos eventos (safety car) — separado do RNG da corrida. */
  rngEventos: RNG;
}

/** Etapa da seed reservada aos eventos do GP. */
const ETAPA_EVENTOS = 6;

/**
 * Clima do GP atual — determinístico (mesma carreira → mesmo clima) e
 * conhecido desde o início do fim de semana (é a "previsão do tempo").
 */
export function climaDoGP(estado: EstadoJogo, circuito: Circuito): Clima {
  const rng = criarRng(derivarSeed(estado.seed, estado.ano, estado.gpAtual, ETAPA_EVENTOS));
  return rng.chance(circuito.chanceChuva ?? CHANCE_CHUVA_PADRAO) ? 'chuva' : 'seco';
}

/**
 * Monta as opções de eventos do GP atual. O RNG devolvido já consumiu o
 * sorteio do clima — o safety car usa a continuação do mesmo fluxo.
 */
export function eventosDoGP(estado: EstadoJogo, circuito: Circuito): EventosCorrida {
  const rngEventos = criarRng(derivarSeed(estado.seed, estado.ano, estado.gpAtual, ETAPA_EVENTOS));
  const clima: Clima = rngEventos.chance(circuito.chanceChuva ?? CHANCE_CHUVA_PADRAO)
    ? 'chuva'
    : 'seco';
  return { clima, rngEventos };
}
