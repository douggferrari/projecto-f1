// ============================================================================
// Pool inicial de pilotos (nomes fictícios) — 24 pilotos.
// classificacao/corrida/confiabilidade são a qualidade ATUAL de 2026 (o
// balanceamento validado das fases 1-3). Na criação da carreira, o
// POTENCIAL é derivado de atual ÷ curva da idade — jovens têm teto alto,
// veteranos estão além do pico. `reputacao` é o "tamanho do nome".
// ============================================================================

import { prepararPilotoInicial } from '../engine/pilotoCarreira';
import type { Piloto } from '../engine/tipos';

// Tipo dos dados crus (sem os campos derivados abaixo)
export type PilotoBase = Omit<Piloto, 'potencialClassificacao' | 'potencialCorrida' | 'confiabilidadeBase'>;

export const PILOTOS: PilotoBase[] = [
  // --- Elite ---
  { id: 'pil-vantorre', nacionalidade: 'BEL', nome: 'Lucas Vantorre', idade: 29, reputacao: 92, classificacao: 95, corrida: 94, confiabilidade: 92, salarioBase: 24_000_000 },
  { id: 'pil-okada', nacionalidade: 'JPN', nome: 'Kenji Okada', idade: 31, reputacao: 88, classificacao: 93, corrida: 95, confiabilidade: 90, salarioBase: 22_000_000 },
  { id: 'pil-moreau', nacionalidade: 'FRA', nome: 'Théo Moreau', idade: 27, reputacao: 75, classificacao: 92, corrida: 90, confiabilidade: 88, salarioBase: 19_000_000 },
  { id: 'pil-castellani', nacionalidade: 'ITA', nome: 'Bruno Castellani', idade: 33, reputacao: 85, classificacao: 90, corrida: 91, confiabilidade: 85, salarioBase: 17_000_000 },
  // --- Muito bons ---
  { id: 'pil-silveira', nacionalidade: 'BRA', nome: 'Rafael Silveira', idade: 30, reputacao: 62, classificacao: 88, corrida: 87, confiabilidade: 86, salarioBase: 13_000_000 },
  { id: 'pil-nystrom', nacionalidade: 'SWE', nome: 'Erik Nyström', idade: 25, reputacao: 55, classificacao: 87, corrida: 88, confiabilidade: 90, salarioBase: 12_500_000 },
  { id: 'pil-duarte', nacionalidade: 'POR', nome: 'Gonçalo Duarte', idade: 34, reputacao: 58, classificacao: 86, corrida: 85, confiabilidade: 82, salarioBase: 11_000_000 },
  { id: 'pil-kowalski', nacionalidade: 'POL', nome: 'Adam Kowalski', idade: 28, reputacao: 50, classificacao: 85, corrida: 86, confiabilidade: 87, salarioBase: 10_500_000 },
  // --- Sólidos de meio de grid ---
  { id: 'pil-herrera', nacionalidade: 'ARG', nome: 'Diego Herrera', idade: 32, reputacao: 45, classificacao: 83, corrida: 82, confiabilidade: 84, salarioBase: 8_000_000 },
  { id: 'pil-vandenberg', nacionalidade: 'NED', nome: 'Max van den Berg', idade: 26, reputacao: 38, classificacao: 82, corrida: 83, confiabilidade: 80, salarioBase: 7_500_000 },
  { id: 'pil-rocha', nacionalidade: 'BRA', nome: 'Thiago Rocha', idade: 29, reputacao: 40, classificacao: 81, corrida: 80, confiabilidade: 85, salarioBase: 6_500_000 },
  { id: 'pil-leclerq', nacionalidade: 'FRA', nome: 'Julien Leclerq', idade: 35, reputacao: 48, classificacao: 80, corrida: 81, confiabilidade: 78, salarioBase: 6_000_000 },
  // Veterano de nome grande em declínio — o "caso Alonso" do grid
  { id: 'pil-ferran', nacionalidade: 'ESP', nome: 'Marc Ferran', idade: 37, reputacao: 72, classificacao: 79, corrida: 79, confiabilidade: 83, salarioBase: 5_500_000 },
  { id: 'pil-yamada', nacionalidade: 'JPN', nome: 'Sora Yamada', idade: 24, reputacao: 30, classificacao: 78, corrida: 80, confiabilidade: 81, salarioBase: 5_000_000 },
  // --- Fundo de grid ---
  { id: 'pil-obrien', nacionalidade: 'IRL', nome: 'Liam O’Brien', idade: 27, reputacao: 25, classificacao: 76, corrida: 75, confiabilidade: 79, salarioBase: 3_800_000 },
  { id: 'pil-santoro', nacionalidade: 'ITA', nome: 'Enzo Santoro', idade: 22, reputacao: 20, classificacao: 75, corrida: 77, confiabilidade: 74, salarioBase: 3_500_000 },
  { id: 'pil-almeida', nacionalidade: 'BRA', nome: 'Vitor Almeida', idade: 30, reputacao: 22, classificacao: 74, corrida: 73, confiabilidade: 80, salarioBase: 3_000_000 },
  { id: 'pil-petrov', nacionalidade: 'BUL', nome: 'Nikolai Petrov', idade: 36, reputacao: 35, classificacao: 73, corrida: 74, confiabilidade: 72, salarioBase: 2_800_000 },
  { id: 'pil-mbeki', nacionalidade: 'RSA', nome: 'Sipho Mbeki', idade: 26, reputacao: 18, classificacao: 72, corrida: 73, confiabilidade: 77, salarioBase: 2_500_000 },
  { id: 'pil-lindqvist', nacionalidade: 'SWE', nome: 'Oskar Lindqvist', idade: 38, reputacao: 30, classificacao: 71, corrida: 70, confiabilidade: 75, salarioBase: 2_200_000 },
  // --- Reservas / jovens (potencial alto escondido na idade) ---
  { id: 'pil-carvalho', nacionalidade: 'BRA', nome: 'Pedro Carvalho', idade: 20, reputacao: 12, classificacao: 69, corrida: 71, confiabilidade: 73, salarioBase: 1_500_000 },
  { id: 'pil-nakamura', nacionalidade: 'JPN', nome: 'Rin Nakamura', idade: 19, reputacao: 10, classificacao: 68, corrida: 69, confiabilidade: 76, salarioBase: 1_300_000 },
  { id: 'pil-weiss', nacionalidade: 'GER', nome: 'Jonas Weiss', idade: 23, reputacao: 8, classificacao: 67, corrida: 68, confiabilidade: 70, salarioBase: 1_100_000 },
  { id: 'pil-fontana', nacionalidade: 'ITA', nome: 'Aldo Fontana', idade: 35, reputacao: 15, classificacao: 66, corrida: 67, confiabilidade: 74, salarioBase: 1_000_000 },
];

// Versão preparada: potencial derivado de atual ÷ curva da idade —
// é ela que alimenta o estado do jogo e os harnesses.
export const PILOTOS_INICIAIS: Piloto[] = PILOTOS.map(prepararPilotoInicial);

export const PILOTOS_POR_ID: Record<string, Piloto> = Object.fromEntries(
  PILOTOS_INICIAIS.map((p) => [p.id, p])
);
