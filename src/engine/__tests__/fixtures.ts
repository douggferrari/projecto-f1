// Fábricas de objetos de teste — montam equipes/catálogos mínimos.

import type { CatalogoSimulacao } from '../classificacao';
import type { Circuito, Equipe, Motor, Piloto } from '../tipos';

export function motorTeste(sobrescrever: Partial<Motor> = {}): Motor {
  return {
    id: 'm1', nome: 'Motor Teste', tier: 'media',
    potencia: 80, confiabilidade: 100, custoAnualBase: 1_000_000,
    ...sobrescrever,
  };
}

export function pilotoTeste(sobrescrever: Partial<Piloto> = {}): Piloto {
  return {
    id: 'p1', nome: 'Piloto Teste',
    classificacao: 80, corrida: 80, confiabilidade: 100, salarioBase: 1_000_000,
    // Arco de carreira (Fase 4): no auge, qualidade = potencial
    idade: 28, reputacao: 50,
    potencialClassificacao: 80, potencialCorrida: 80, confiabilidadeBase: 96.4,
    ...sobrescrever,
  };
}

export function circuitoTeste(sobrescrever: Partial<Circuito> = {}): Circuito {
  return { id: 'c1', nome: 'Circuito Teste', voltas: 50, desgastePneu: 1.0, ...sobrescrever };
}

/**
 * Monta uma equipe de 2 pilotos ligada a um motor do catálogo.
 */
export function equipeTeste(
  id: string,
  motorId: string,
  pilotoIds: [string, string],
  nivelChassi: number
): Equipe {
  return {
    id, nome: `Equipe ${id}`, tier: 'media', ehJogador: false,
    orcamentoBase: 50_000_000, reputacao: 50, prestigio: 60,
    chefeId: `chefe-${id}`,
    corPrimaria: '#888888', corSecundaria: '#cccccc', nivelChassi,
    cicloDesenvolvimento: { anoDoCiclo: 1, investimentoAcumulado: 0 },
    contratoMotor: { motorId, duracaoAnos: 2, custoAnual: 1_000_000, anoInicio: 2026 },
    pilotos: [
      { pilotoId: pilotoIds[0], duracaoAnos: 2, salarioAnual: 1_000_000, anoInicio: 2026 },
      { pilotoId: pilotoIds[1], duracaoAnos: 2, salarioAnual: 1_000_000, anoInicio: 2026 },
    ],
    patrocinadorId: 'pat-x',
  };
}

/**
 * Cenário padrão: 2 equipes (A forte, B fraca), 4 pilotos idênticos,
 * motores 100% confiáveis — sem DNF, sem diferença de piloto.
 */
export function cenarioDuasEquipes(): { equipes: Equipe[]; catalogo: CatalogoSimulacao } {
  const motores = {
    'mtr-forte': motorTeste({ id: 'mtr-forte', potencia: 95 }),
    'mtr-fraco': motorTeste({ id: 'mtr-fraco', potencia: 65 }),
  };
  const pilotos = Object.fromEntries(
    ['pA1', 'pA2', 'pB1', 'pB2'].map((id) => [id, pilotoTeste({ id, nome: `Piloto ${id}` })])
  );
  return {
    equipes: [
      equipeTeste('eqA', 'mtr-forte', ['pA1', 'pA2'], 90),
      equipeTeste('eqB', 'mtr-fraco', ['pB1', 'pB2'], 50),
    ],
    catalogo: { motores, pilotos },
  };
}
