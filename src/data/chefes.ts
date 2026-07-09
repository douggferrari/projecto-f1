// ============================================================================
// Chefes de equipe iniciais (Fase 6) — um por equipe, nomes fictícios.
// Reputação semeada pelo porte da equipe; alguns já carregam títulos
// (a Escuderia Real vive de glórias recentes; o resto corre atrás).
// O chefe do JOGADOR é criado à parte na criação da carreira.
// ============================================================================

import type { Chefe } from '../engine/tipos';

export { CHEFE_JOGADOR_ID } from '../engine/chefes';

// equipeId → chefe inicial da IA
export const CHEFES_INICIAIS: Record<string, Omit<Chefe, 'historico'>> = {
  'eq-real': { id: 'chefe-real', nome: 'Massimo Ferrante', reputacao: 82, campeonatosVencidos: 2 },
  'eq-falcao': { id: 'chefe-falcao', nome: 'Heinrich Baum', reputacao: 76, campeonatosVencidos: 1 },
  'eq-imperio': { id: 'chefe-imperio', nome: 'Vivian Ashcroft', reputacao: 72, campeonatosVencidos: 0 },
  'eq-atlantica': { id: 'chefe-atlantica', nome: 'João Meireles', reputacao: 60, campeonatosVencidos: 0 },
  'eq-meridional': { id: 'chefe-meridional', nome: 'Ricardo Salazar', reputacao: 56, campeonatosVencidos: 0 },
  'eq-aurora': { id: 'chefe-aurora', nome: 'Elena Corsini', reputacao: 54, campeonatosVencidos: 0 },
  'eq-pioneira': { id: 'chefe-pioneira', nome: 'Frank Whitmore', reputacao: 46, campeonatosVencidos: 0 },
  'eq-cometa': { id: 'chefe-cometa', nome: 'Beatriz Fontoura', reputacao: 42, campeonatosVencidos: 0 },
  'eq-estrela': { id: 'chefe-estrela', nome: 'Anders Dahl', reputacao: 40, campeonatosVencidos: 0 },
  'eq-guarani': { id: 'chefe-guarani', nome: 'Milton Barros', reputacao: 38, campeonatosVencidos: 0 },
};
