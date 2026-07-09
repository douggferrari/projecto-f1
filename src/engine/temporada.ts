// ============================================================================
// Orquestração de um GP e de uma temporada inteira.
// ============================================================================

import { simularClassificacao, type CatalogoSimulacao } from './classificacao';
import { simularCorrida } from './corrida';
import { atribuirPontos, atualizarCampeonatos } from './pontuacao';
import { escolherTaticasIA } from './taticas';
import type { RNG } from './rng';
import type { Circuito, Equipe, ResultadoGP, TaticaCorrida } from './tipos';

/**
 * Simula um GP completo (classificação + corrida).
 * `taticasJogador` sobrescreve as táticas da IA para os pilotos informados
 * (na Fase 1, sem UI, pode ser vazio — a IA decide por todos).
 */
export function simularGP(
  equipes: Equipe[],
  circuito: Circuito,
  catalogo: CatalogoSimulacao,
  rng: RNG,
  taticasJogador: Record<string, TaticaCorrida> = {}
): ResultadoGP {
  const grid = simularClassificacao(equipes, catalogo, rng);
  const taticas = { ...escolherTaticasIA(equipes, circuito, rng), ...taticasJogador };
  const corrida = atribuirPontos(
    simularCorrida(equipes, grid, taticas, circuito, catalogo, rng)
  );
  return { circuitoId: circuito.id, grid, corrida };
}

export interface ResultadoTemporada {
  resultados: ResultadoGP[];
  campeonatoPilotos: Record<string, number>;
  campeonatoConstrutores: Record<string, number>;
}

/**
 * Simula uma temporada inteira, GP a GP, acumulando os campeonatos.
 * Função pura: mesmo estado + mesma seed → mesmo resultado.
 */
export function simularTemporada(
  equipes: Equipe[],
  calendario: Circuito[],
  catalogo: CatalogoSimulacao,
  rng: RNG,
  taticasJogadorPorGP: Record<string, TaticaCorrida>[] = []
): ResultadoTemporada {
  let campeonatoPilotos: Record<string, number> = {};
  let campeonatoConstrutores: Record<string, number> = {};
  const resultados: ResultadoGP[] = [];

  calendario.forEach((circuito, indiceGP) => {
    const resultado = simularGP(
      equipes,
      circuito,
      catalogo,
      rng,
      taticasJogadorPorGP[indiceGP] ?? {}
    );
    resultados.push(resultado);

    const atualizado = atualizarCampeonatos(
      campeonatoPilotos,
      campeonatoConstrutores,
      resultado.corrida
    );
    campeonatoPilotos = atualizado.campeonatoPilotos;
    campeonatoConstrutores = atualizado.campeonatoConstrutores;
  });

  return { resultados, campeonatoPilotos, campeonatoConstrutores };
}
