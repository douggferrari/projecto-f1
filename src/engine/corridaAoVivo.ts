// ============================================================================
// Transmissão ao vivo da corrida — Fase 3.
// Gera, ANTES da corrida ser commitada, a timeline volta a volta que a UI
// reproduz em ~2 minutos. Duas garantias:
//   1. `resultado` é calculado pelo MESMO caminho de código e mesma seed de
//      rodarCorrida() — o que o jogador assiste é o que será commitado.
//   2. Tudo que é só apresentação (volta do DNF, ritmo fictício de quem
//      quebrou) usa um RNG SEPARADO, derivado com outra etapa da seed —
//      zero interferência no resultado oficial.
// ============================================================================

import {
  BONUS_POSICAO_GRID,
  CUSTO_PIT_STOP,
  EVENTOS_ATIVADOS,
  PESO_CARRO_CORRIDA,
  PESO_PILOTO_CORRIDA,
} from './constantes';
import { eventosDoGP } from './eventos';
import { desempenhoCarro } from './desempenho';
import {
  simularCorridaDetalhada,
  temposDasVoltasDoStint,
  type DetalheCarroCorrida,
} from './corrida';
import type { CatalogoJogo } from './gestaoIA';
import { atribuirPontos } from './pontuacao';
import { criarRng, derivarSeed } from './rng';
import { escolherTaticasIA } from './taticas';
import type {
  Circuito,
  Clima,
  EstadoJogo,
  Pneu,
  ResultadoCorridaPiloto,
  TaticaCorrida,
} from './tipos';

export interface CatalogoTransmissao extends CatalogoJogo {
  circuitos: Record<string, Circuito>;
}

export interface CarroNoQuadro {
  pilotoId: string;
  equipeId: string;
  posicao: number;
  /** Gap para o líder em segundos (0 para o líder; Infinity se fora). */
  gapLider: number;
  /** Composto em uso nesta volta (null se fora da corrida). */
  pneu: Pneu | null;
  pitNestaVolta: boolean;
  foraDaCorrida: boolean;
  motivoDnf?: 'quebra' | 'erro';
}

export interface QuadroVolta {
  volta: number; // 1..voltasTotais
  carros: CarroNoQuadro[]; // ordenado por posição
}

export interface EventoCorrida {
  volta: number;
  tipo: 'pit' | 'dnf' | 'safety-car';
  pilotoId?: string; // ausente em eventos de pista (safety car)
}

export interface TransmissaoCorrida {
  voltasTotais: number;
  quadros: QuadroVolta[]; // quadros[v-1] = estado após a volta v
  eventos: EventoCorrida[];
  /** Resultado oficial — idêntico ao que rodarCorrida() vai commitar. */
  resultado: ResultadoCorridaPiloto[];
  taticas: Record<string, TaticaCorrida>;
  // --- Fase 5 ---
  clima: Clima;
  safetyCars: number[];
  voltaMaisRapida?: { pilotoId: string; tempo: number };
}

// Estado interno de um carro durante a montagem da timeline
interface CarroTimeline {
  detalhe: DetalheCarroCorrida;
  acumulado: number[];   // tempo acumulado ao fim de cada volta corrida
  voltasPit: Set<number>; // voltas (1-based) em que o carro para no fim
  voltaDnf?: number;      // volta em que abandona (apresentação)
  pneuPorVolta: Pneu[];
}

/**
 * Gera a transmissão completa da corrida do GP atual.
 * Requer fase 'gp-corrida' (grid definido e táticas do jogador escolhidas).
 */
export function preverCorridaAoVivo(
  estado: EstadoJogo,
  catalogoBase: CatalogoTransmissao
): TransmissaoCorrida {
  // Pilotos vivos: o estado é a fonte da verdade (Fase 4)
  const temPilotosVivos = estado.pilotos && Object.keys(estado.pilotos).length > 0;
  const catalogo = temPilotosVivos ? { ...catalogoBase, pilotos: estado.pilotos } : catalogoBase;
  const circuito = catalogo.circuitos[estado.calendario[estado.gpAtual]];
  const voltasTotais = circuito.voltas;

  // Eventos da Fase 5 (chuva/safety car) — desligáveis por EVENTOS_ATIVADOS
  const opcoesEventos = EVENTOS_ATIVADOS ? eventosDoGP(estado, circuito) : undefined;

  // --- Simulação oficial: mesma seed e mesmo caminho de rodarCorrida() ---
  const rng = criarRng(derivarSeed(estado.seed, estado.ano, estado.gpAtual, 1));
  const taticas = escolherTaticasIA(estado.equipes, circuito, rng);
  for (const tatica of estado.taticasJogador ?? []) taticas[tatica.pilotoId] = tatica;
  const { resultado, detalhes, safetyCars, voltaMaisRapida } = simularCorridaDetalhada(
    estado.equipes,
    estado.gridAtual!,
    taticas,
    circuito,
    catalogo,
    rng,
    opcoesEventos
  );

  // --- Camada de apresentação (RNG separado — não toca o resultado) ---
  const presRng = criarRng(derivarSeed(estado.seed, estado.ano, estado.gpAtual, 2));
  const numCarros = estado.gridAtual!.length;
  const carros = new Map<string, CarroTimeline>();

  for (const detalhe of Object.values(detalhes)) {
    const boundaries = acumular(detalhe.voltasPorStint); // fim de cada stint
    const voltasPit = new Set(boundaries.slice(0, -1));  // para em todas menos na última
    const pneuPorVolta = pneusPorVolta(detalhe.tatica.stints, detalhe.voltasPorStint);

    let temposVoltas = detalhe.temposVoltas;
    let voltaDnf: number | undefined;

    if (detalhe.dnf) {
      // Volta do abandono e ritmo exibido até lá: só apresentação.
      voltaDnf = presRng.inteiroEntre(2, Math.max(3, voltasTotais - 2));
      // Ritmo plausível sem o sorteio de forma (que o carro DNF nunca fez)
      const equipe = estado.equipes.find((e) => e.id === detalhe.equipeId)!;
      const motor = catalogo.motores[equipe.contratoMotor.motorId];
      const piloto = catalogo.pilotos[detalhe.pilotoId];
      const ritmoBase =
        PESO_CARRO_CORRIDA * desempenhoCarro(motor, equipe.nivelChassi) +
        PESO_PILOTO_CORRIDA * piloto.corrida;
      temposVoltas = detalhe.tatica.stints.flatMap((pneu, i) =>
        temposDasVoltasDoStint(
          ritmoBase, pneu, detalhe.voltasPorStint[i], circuito.desgastePneu, presRng,
          opcoesEventos?.clima === 'chuva'
        )
      );
    }

    // Acumulado exibido: bônus de largada na volta 1, pit no fim da volta
    const acumulado: number[] = [];
    let total = -BONUS_POSICAO_GRID * (numCarros - detalhe.posicaoGrid);
    temposVoltas.forEach((tempo, i) => {
      total += tempo;
      if (voltasPit.has(i + 1)) total += CUSTO_PIT_STOP;
      acumulado.push(total);
    });

    carros.set(detalhe.pilotoId, { detalhe, acumulado, voltasPit, voltaDnf, pneuPorVolta });
  }

  // --- Monta os quadros volta a volta ---
  const eventos: EventoCorrida[] = [];
  const quadros: QuadroVolta[] = [];

  for (let volta = 1; volta <= voltasTotais; volta++) {
    if (safetyCars.includes(volta)) eventos.push({ volta, tipo: 'safety-car' });
    const correndo: { carro: CarroTimeline; tempo: number }[] = [];
    const fora: CarroTimeline[] = [];

    for (const carro of carros.values()) {
      if (carro.voltaDnf !== undefined && volta >= carro.voltaDnf) {
        fora.push(carro);
        if (volta === carro.voltaDnf) {
          eventos.push({ volta, tipo: 'dnf', pilotoId: carro.detalhe.pilotoId });
        }
      } else {
        correndo.push({ carro, tempo: carro.acumulado[volta - 1] });
        if (carro.voltasPit.has(volta)) {
          eventos.push({ volta, tipo: 'pit', pilotoId: carro.detalhe.pilotoId });
        }
      }
    }

    correndo.sort((a, b) => a.tempo - b.tempo);
    // Abandonados: o mais recente aparece por último entre os fora
    fora.sort((a, b) => b.voltaDnf! - a.voltaDnf!);

    // No último quadro, força a ordem oficial do resultado (evita qualquer
    // divergência visual de arredondamento entre timeline e commit)
    let ordenados: CarroNoQuadro[];
    if (volta === voltasTotais) {
      ordenados = resultado.map((r) => {
        const carro = carros.get(r.pilotoId)!;
        const lider = carros.get(resultado[0].pilotoId)!;
        return montarLinha(carro, volta, r.dnf ? Infinity : carro.acumulado[volta - 1] - lider.acumulado[volta - 1], r.posicao, r.dnf);
      });
    } else {
      const tempoLider = correndo[0]?.tempo ?? 0;
      ordenados = [
        ...correndo.map(({ carro, tempo }, i) => montarLinha(carro, volta, tempo - tempoLider, i + 1, false)),
        ...fora.map((carro, i) => montarLinha(carro, volta, Infinity, correndo.length + i + 1, true)),
      ];
    }

    quadros.push({ volta, carros: ordenados });
  }

  return {
    voltasTotais,
    quadros,
    eventos,
    resultado: atribuirPontos(resultado, EVENTOS_ATIVADOS ? voltaMaisRapida?.pilotoId : undefined),
    taticas,
    clima: opcoesEventos?.clima ?? 'seco',
    safetyCars,
    voltaMaisRapida,
  };
}

function montarLinha(
  carro: CarroTimeline,
  volta: number,
  gapLider: number,
  posicao: number,
  fora: boolean
): CarroNoQuadro {
  return {
    pilotoId: carro.detalhe.pilotoId,
    equipeId: carro.detalhe.equipeId,
    posicao,
    gapLider: fora ? Infinity : Number(gapLider.toFixed(3)),
    pneu: fora ? null : carro.pneuPorVolta[volta - 1] ?? null,
    pitNestaVolta: !fora && carro.voltasPit.has(volta),
    foraDaCorrida: fora,
    motivoDnf: fora ? carro.detalhe.motivoDnf : undefined,
  };
}

/** [17, 17, 16] → [17, 34, 50] (volta em que cada stint termina). */
function acumular(voltasPorStint: number[]): number[] {
  const resultado: number[] = [];
  let soma = 0;
  for (const n of voltasPorStint) {
    soma += n;
    resultado.push(soma);
  }
  return resultado;
}

/** Expande a tática em "composto usado em cada volta". */
function pneusPorVolta(stints: Pneu[], voltasPorStint: number[]): Pneu[] {
  return stints.flatMap((pneu, i) => Array<Pneu>(voltasPorStint[i]).fill(pneu));
}
