// ============================================================================
// Fornecedores de motor (nomes fictícios).
// Melhor motor = mais caro. Confiabilidade nem sempre acompanha a potência.
// ============================================================================

import type { Motor } from '../engine/tipos';

export const MOTORES: Motor[] = [
  // --- Tier grande ---
  { id: 'mtr-titanus', nome: 'Titanus Power', tier: 'grande', potencia: 94, confiabilidade: 90, custoAnualBase: 32_000_000 },
  { id: 'mtr-vulcano', nome: 'Vulcano Engineering', tier: 'grande', potencia: 91, confiabilidade: 84, custoAnualBase: 28_000_000 },
  // --- Tier média ---
  { id: 'mtr-aquila', nome: 'Aquila Motori', tier: 'media', potencia: 84, confiabilidade: 82, custoAnualBase: 21_000_000 },
  { id: 'mtr-boreal', nome: 'Boreal Dynamics', tier: 'media', potencia: 80, confiabilidade: 88, custoAnualBase: 18_000_000 },
  // --- Tier pequena ---
  { id: 'mtr-condor', nome: 'Condor Técnica', tier: 'pequena', potencia: 73, confiabilidade: 78, custoAnualBase: 12_000_000 },
  { id: 'mtr-pampa', nome: 'Pampa Motorsport', tier: 'pequena', potencia: 68, confiabilidade: 72, custoAnualBase: 9_000_000 },
];

export const MOTORES_POR_ID: Record<string, Motor> = Object.fromEntries(
  MOTORES.map((m) => [m.id, m])
);
