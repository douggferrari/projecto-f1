// ============================================================================
// Calendário MVP — 12 circuitos fictícios.
// `desgastePneu` muda a estratégia ótima de corrida em cada pista.
// ============================================================================

import type { Circuito } from '../engine/tipos';

export const CALENDARIO: Circuito[] = [
  { id: 'cir-lagoa-azul', nome: 'GP de Lagoa Azul', voltas: 52, desgastePneu: 1.0, chanceChuva: 0.2 },
  { id: 'cir-monte-alto', nome: 'GP de Monte Alto', voltas: 44, desgastePneu: 1.3, chanceChuva: 0.1 },
  { id: 'cir-porto-real', nome: 'GP de Porto Real', voltas: 58, desgastePneu: 0.8, chanceChuva: 0.15 },
  { id: 'cir-vale-verde', nome: 'GP do Vale Verde', voltas: 50, desgastePneu: 1.0, chanceChuva: 0.25 },
  { id: 'cir-deserto-rubro', nome: 'GP do Deserto Rubro', voltas: 46, desgastePneu: 1.4, chanceChuva: 0.03 },
  { id: 'cir-costa-dourada', nome: 'GP da Costa Dourada', voltas: 60, desgastePneu: 0.7, chanceChuva: 0.12 },
  { id: 'cir-serra-nevoa', nome: 'GP da Serra da Névoa', voltas: 48, desgastePneu: 1.1, chanceChuva: 0.38 },
  { id: 'cir-planalto', nome: 'GP do Planalto', voltas: 54, desgastePneu: 0.9, chanceChuva: 0.18 },
  { id: 'cir-baia-norte', nome: 'GP da Baía Norte', voltas: 50, desgastePneu: 1.2, chanceChuva: 0.28 },
  { id: 'cir-ilha-grande', nome: 'GP da Ilha Grande', voltas: 56, desgastePneu: 0.85, chanceChuva: 0.22 },
  { id: 'cir-campos-sul', nome: 'GP dos Campos do Sul', voltas: 47, desgastePneu: 1.15, chanceChuva: 0.15 },
  { id: 'cir-cidade-luz', nome: 'GP da Cidade da Luz', voltas: 62, desgastePneu: 0.75, chanceChuva: 0.08 },
];

export const CIRCUITOS_POR_ID: Record<string, Circuito> = Object.fromEntries(
  CALENDARIO.map((c) => [c.id, c])
);
