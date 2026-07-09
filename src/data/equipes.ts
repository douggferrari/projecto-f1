// ============================================================================
// Grade inicial — 10 equipes fictícias (3 grandes, 3 médias, 4 pequenas),
// já com contratos iniciais coerentes de motor, pilotos e patrocínio.
// `ehJogador` é definido na criação da carreira (Fase 2).
// ============================================================================

import type { ContratoMotor, ContratoPiloto, Equipe, Tier } from '../engine/tipos';
import { MOTORES_POR_ID } from './motores';
import { PILOTOS_POR_ID } from './pilotos';

export const ANO_INICIAL = 2026;

// Pequenos helpers para montar os contratos iniciais sem repetir valores
function motor(motorId: string, duracaoAnos: number): ContratoMotor {
  return { motorId, duracaoAnos, custoAnual: MOTORES_POR_ID[motorId].custoAnualBase, anoInicio: ANO_INICIAL };
}
function piloto(pilotoId: string, duracaoAnos: number): ContratoPiloto {
  return { pilotoId, duracaoAnos, salarioAnual: PILOTOS_POR_ID[pilotoId].salarioBase, anoInicio: ANO_INICIAL };
}
function equipe(
  id: string, nome: string, tier: Tier, orcamentoBase: number, nivelChassi: number,
  prestigio: number, cores: [string, string],
  contratoMotor: ContratoMotor, pilotos: [ContratoPiloto, ContratoPiloto], patrocinadorId: string
): Equipe {
  return {
    id, nome, tier, ehJogador: false, orcamentoBase,
    reputacao: 50, prestigio, corPrimaria: cores[0], corSecundaria: cores[1], nivelChassi,
    cicloDesenvolvimento: { anoDoCiclo: 1, investimentoAcumulado: 0 },
    contratoMotor, pilotos, patrocinadorId,
  };
}

export const EQUIPES_INICIAIS: Equipe[] = [
  // --- Topo do grid ---
  equipe('eq-real', 'Escuderia Real', 'grande', 110_000_000, 88, 90, ['#2563eb', '#fbbf24'],
    motor('mtr-titanus', 3), [piloto('pil-vantorre', 3), piloto('pil-nystrom', 2)], 'pat-orbita'),
  equipe('eq-falcao', 'Falcão GP', 'grande', 100_000_000, 84, 85, ['#dc2626', '#e5e7eb'],
    motor('mtr-vulcano', 2), [piloto('pil-okada', 2), piloto('pil-duarte', 2)], 'pat-helios'),
  equipe('eq-imperio', 'Império Racing', 'grande', 95_000_000, 81, 81, ['#7c3aed', '#f59e0b'],
    motor('mtr-titanus', 2), [piloto('pil-moreau', 2), piloto('pil-castellani', 3)], 'pat-nimbus'),
  // --- Meio ---
  equipe('eq-atlantica', 'Atlântica F1', 'media', 68_000_000, 70, 66, ['#0ea5e9', '#f8fafc'],
    motor('mtr-aquila', 2), [piloto('pil-silveira', 2), piloto('pil-kowalski', 1)], 'pat-vertice'),
  equipe('eq-meridional', 'Meridional Motorsport', 'media', 62_000_000, 66, 61, ['#f97316', '#1e3a8a'],
    motor('mtr-boreal', 3), [piloto('pil-herrera', 2), piloto('pil-rocha', 2)], 'pat-quanta'),
  equipe('eq-aurora', 'Aurora Corse', 'media', 58_000_000, 63, 57, ['#10b981', '#f472b6'],
    motor('mtr-aquila', 1), [piloto('pil-vandenberg', 1), piloto('pil-leclerq', 2)], 'pat-andino'),
  // --- Fundo de grid (opções de início de carreira) ---
  equipe('eq-pioneira', 'Pioneira Racing', 'pequena', 40_000_000, 55, 45, ['#eab308', '#111827'],
    motor('mtr-condor', 2), [piloto('pil-ferran', 1), piloto('pil-yamada', 2)], 'pat-farol'),
  equipe('eq-cometa', 'Cometa Sul', 'pequena', 36_000_000, 51, 41, ['#ec4899', '#38bdf8'],
    motor('mtr-pampa', 2), [piloto('pil-obrien', 1), piloto('pil-santoro', 1)], 'pat-tupi'),
  equipe('eq-estrela', 'Estrela do Norte', 'pequena', 34_000_000, 48, 38, ['#60a5fa', '#f8fafc'],
    motor('mtr-condor', 1), [piloto('pil-almeida', 2), piloto('pil-petrov', 1)], 'pat-farol'),
  equipe('eq-guarani', 'Guarani Grand Prix', 'pequena', 30_000_000, 45, 35, ['#22c55e', '#fde047'],
    motor('mtr-pampa', 3), [piloto('pil-mbeki', 1), piloto('pil-lindqvist', 1)], 'pat-tupi'),
];
