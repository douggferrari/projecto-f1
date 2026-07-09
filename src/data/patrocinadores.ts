// ============================================================================
// Patrocinadores (nomes fictícios). Aportes maiores exigem reputação do
// chefe e trazem metas: cumprir dá bônus; falhar bloqueia a renovação.
// Um patrocinador pode apoiar mais de uma equipe.
// ============================================================================

import type { Patrocinador } from '../engine/tipos';

export const PATROCINADORES: Patrocinador[] = [
  { id: 'pat-orbita', nome: 'Órbita Telecom', aporte: 30_000_000, prestigioMinimo: 76, meta: { posicaoConstrutoresMax: 4, bonus: 10_000_000 } },
  { id: 'pat-helios', nome: 'Hélios Energia', aporte: 26_000_000, prestigioMinimo: 66, meta: { posicaoConstrutoresMax: 5, bonus: 8_000_000 } },
  { id: 'pat-nimbus', nome: 'Nimbus Airlines', aporte: 22_000_000, prestigioMinimo: 56, meta: { posicaoConstrutoresMax: 6, bonus: 6_000_000 } },
  { id: 'pat-vertice', nome: 'Vértice Bank', aporte: 18_000_000, prestigioMinimo: 48 },
  { id: 'pat-quanta', nome: 'Quanta Software', aporte: 15_000_000, prestigioMinimo: 40 },
  { id: 'pat-andino', nome: 'Café Andino', aporte: 12_000_000, prestigioMinimo: 30 },
  { id: 'pat-farol', nome: 'Farol Seguros', aporte: 9_000_000, prestigioMinimo: 0 },
  { id: 'pat-tupi', nome: 'Tupi Bebidas', aporte: 7_000_000, prestigioMinimo: 0 },
];

export const PATROCINADORES_POR_ID: Record<string, Patrocinador> = Object.fromEntries(
  PATROCINADORES.map((p) => [p.id, p])
);
