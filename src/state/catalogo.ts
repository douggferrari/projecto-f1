// ============================================================================
// Catálogo completo do jogo — junta os dados-base num objeto que o motor
// de carreira consome. Única ponte entre /src/data e /src/engine.
// ============================================================================

import { CIRCUITOS_POR_ID, CALENDARIO } from '../data/calendario';
import { MOTORES_POR_ID } from '../data/motores';
import { PATROCINADORES_POR_ID } from '../data/patrocinadores';
import { PILOTOS_POR_ID } from '../data/pilotos';
import type { CatalogoCompleto } from '../engine/carreira';

export const CATALOGO: CatalogoCompleto = {
  motores: MOTORES_POR_ID,
  pilotos: PILOTOS_POR_ID,
  patrocinadores: PATROCINADORES_POR_ID,
  circuitos: CIRCUITOS_POR_ID,
};

export const CALENDARIO_IDS = CALENDARIO.map((c) => c.id);
