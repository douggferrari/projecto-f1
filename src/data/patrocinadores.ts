// ============================================================================
// Patrocinadores (nomes fictícios). Três eixos independentes:
//   aporte          — quanto paga por ano
//   prestigioMinimo — que equipe aceita estampar (gate)
//   prestigio       — o peso da MARCA: ajuda a atrair pilotos (Fase 6)
// O trade-off é real: a Meridiem (grife de herança) paga pouco e abre portas
// no mercado; a Krakatoa (dinheiro novo) paga muito e não impressiona ninguém.
// ============================================================================

import type { Patrocinador } from '../engine/tipos';

export const PATROCINADORES: Patrocinador[] = [
  { id: 'pat-orbita', nome: 'Órbita Telecom', aporte: 30_000_000, prestigioMinimo: 76, prestigio: 80, meta: { posicaoConstrutoresMax: 4, bonus: 10_000_000 } },
  { id: 'pat-helios', nome: 'Hélios Energia', aporte: 26_000_000, prestigioMinimo: 66, prestigio: 68, meta: { posicaoConstrutoresMax: 5, bonus: 8_000_000 } },
  // Dinheiro novo: paga como gente grande, prestígio de marca baixo
  { id: 'pat-krakatoa', nome: 'Krakatoa Energy', aporte: 24_000_000, prestigioMinimo: 42, prestigio: 22 },
  { id: 'pat-nimbus', nome: 'Nimbus Airlines', aporte: 22_000_000, prestigioMinimo: 56, prestigio: 60, meta: { posicaoConstrutoresMax: 6, bonus: 6_000_000 } },
  { id: 'pat-vertice', nome: 'Vértice Bank', aporte: 18_000_000, prestigioMinimo: 48, prestigio: 55 },
  { id: 'pat-quanta', nome: 'Quanta Software', aporte: 15_000_000, prestigioMinimo: 40, prestigio: 45 },
  // Grife de herança: aporte modesto, prestígio de marca altíssimo
  { id: 'pat-meridiem', nome: 'Meridiem Relojoaria', aporte: 13_000_000, prestigioMinimo: 40, prestigio: 94 },
  { id: 'pat-andino', nome: 'Café Andino', aporte: 12_000_000, prestigioMinimo: 30, prestigio: 48 },
  { id: 'pat-farol', nome: 'Farol Seguros', aporte: 9_000_000, prestigioMinimo: 0, prestigio: 30 },
  { id: 'pat-tupi', nome: 'Tupi Bebidas', aporte: 7_000_000, prestigioMinimo: 0, prestigio: 35 },
];

export const PATROCINADORES_POR_ID: Record<string, Patrocinador> = Object.fromEntries(
  PATROCINADORES.map((p) => [p.id, p])
);
