// ============================================================================
// Evolução dos fornecedores de motor — Fase 6.
// Cada fornecedor carrega uma TENDÊNCIA oculta (drift anual) que persiste e
// muda devagar: random walk com reversão à média, limitado e determinístico
// (seed da carreira) — um motor top pode declinar ao longo de um contrato
// longo, e um intermediário em ascensão pode virar pechincha.
// ============================================================================

import {
  LIMIAR_TENDENCIA_VISIVEL,
  MOTOR_CENTRO_CONFIABILIDADE,
  MOTOR_CENTRO_POTENCIA,
  MOTOR_CONF_MAXIMA,
  MOTOR_CONF_MINIMA,
  MOTOR_PERSISTENCIA_TENDENCIA,
  MOTOR_POTENCIA_MAXIMA,
  MOTOR_POTENCIA_MINIMA,
  MOTOR_REVERSAO_MEDIA,
  MOTOR_RUIDO_TENDENCIA,
  MOTOR_TENDENCIA_MAX,
} from './constantes';
import type { RNG } from './rng';
import type { Motor } from './tipos';

function clamp(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

/**
 * Evolui TODOS os motores em uma virada de ano (imutável).
 * A ordem de iteração é fixa (ids ordenados) para o consumo de RNG ser
 * determinístico independente da ordem de inserção no Record.
 */
export function evoluirMotores(
  motores: Record<string, Motor>,
  ano: number,
  rng: RNG
): Record<string, Motor> {
  const novos: Record<string, Motor> = {};
  for (const id of Object.keys(motores).sort()) {
    const motor = motores[id];

    // A trajetória oculta: persiste entre anos e muda devagar
    const tendencia = clamp(
      (motor.tendencia ?? 0) * MOTOR_PERSISTENCIA_TENDENCIA +
        rng.entre(-MOTOR_RUIDO_TENDENCIA, MOTOR_RUIDO_TENDENCIA),
      -MOTOR_TENDENCIA_MAX,
      MOTOR_TENDENCIA_MAX
    );

    const potencia = clamp(
      motor.potencia + tendencia + MOTOR_REVERSAO_MEDIA * (MOTOR_CENTRO_POTENCIA - motor.potencia),
      MOTOR_POTENCIA_MINIMA,
      MOTOR_POTENCIA_MAXIMA
    );
    // A confiabilidade anda meio passo atrás da potência (empurrar o motor
    // costuma custar confiabilidade) + ruído próprio
    const confiabilidade = clamp(
      motor.confiabilidade +
        rng.entre(-1.2, 1.2) -
        tendencia * 0.25 +
        MOTOR_REVERSAO_MEDIA * (MOTOR_CENTRO_CONFIABILIDADE - motor.confiabilidade),
      MOTOR_CONF_MINIMA,
      MOTOR_CONF_MAXIMA
    );

    novos[id] = {
      ...motor,
      potencia: Number(potencia.toFixed(1)),
      confiabilidade: Number(confiabilidade.toFixed(1)),
      tendencia,
      historicoRatings: [
        ...(motor.historicoRatings ?? []),
        { ano, potencia: motor.potencia, confiabilidade: motor.confiabilidade },
      ],
    };
  }
  return novos;
}

export type TendenciaMotor = 'subindo' | 'estavel' | 'caindo';

/**
 * Dica de tendência exibida na UI (▲/▬/▼): variação da potência nos últimos
 * ~2 anos registrados. O futuro exato permanece incerto — isto é retrovisor.
 */
export function tendenciaMotor(motor: Motor): TendenciaMotor {
  const historico = motor.historicoRatings ?? [];
  if (historico.length === 0) return 'estavel';
  const referencia = historico.at(-2) ?? historico.at(-1)!;
  const variacao = motor.potencia - referencia.potencia;
  if (variacao >= LIMIAR_TENDENCIA_VISIVEL) return 'subindo';
  if (variacao <= -LIMIAR_TENDENCIA_VISIVEL) return 'caindo';
  return 'estavel';
}

/** Ranking de fornecedores por potência num dado conjunto de ratings. */
export function rankingMotores(motores: Record<string, Motor>): string[] {
  return Object.values(motores)
    .sort((a, b) => b.potencia - a.potencia)
    .map((m) => m.id);
}

/**
 * Delta de posições no ranking vs. o ano anterior (positivo = subiu).
 * Devolve null se ainda não há histórico para comparar.
 */
export function deltaRankingMotor(
  motores: Record<string, Motor>,
  motorId: string
): number | null {
  const algumHistorico = Object.values(motores).some(
    (m) => (m.historicoRatings?.length ?? 0) > 0
  );
  if (!algumHistorico) return null;

  const atual = rankingMotores(motores).indexOf(motorId);
  const anterior = Object.values(motores)
    .map((m) => ({ id: m.id, potencia: m.historicoRatings?.at(-1)?.potencia ?? m.potencia }))
    .sort((a, b) => b.potencia - a.potencia)
    .findIndex((m) => m.id === motorId);
  return anterior - atual;
}
