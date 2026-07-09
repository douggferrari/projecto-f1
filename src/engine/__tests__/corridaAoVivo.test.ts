// A garantia central da Fase 3: a transmissão ao vivo é playback fiel —
// o resultado que ela mostra é EXATAMENTE o que rodarCorrida() commita.

import { describe, expect, it } from 'vitest';
import { CALENDARIO, CIRCUITOS_POR_ID } from '../../data/calendario';
import { ANO_INICIAL, EQUIPES_INICIAIS } from '../../data/equipes';
import { MOTORES_POR_ID } from '../../data/motores';
import { PATROCINADORES_POR_ID } from '../../data/patrocinadores';
import { PILOTOS_POR_ID } from '../../data/pilotos';
import {
  confirmarPreTemporada,
  criarCarreira,
  definirTaticasJogador,
  preverClassificacao,
  rodarClassificacao,
  rodarCorrida,
  type CatalogoCompleto,
} from '../carreira';
import { preverCorridaAoVivo } from '../corridaAoVivo';
import type { EstadoJogo, TaticaCorrida } from '../tipos';

const catalogo: CatalogoCompleto = {
  motores: MOTORES_POR_ID,
  pilotos: PILOTOS_POR_ID,
  patrocinadores: PATROCINADORES_POR_ID,
  circuitos: CIRCUITOS_POR_ID,
};
const calendarioIds = CALENDARIO.map((c) => c.id);

/** Leva uma carreira nova até a fase gp-corrida do primeiro GP. */
function estadoProntoParaCorrida(seed: number): EstadoJogo {
  let estado = criarCarreira('eq-guarani', seed, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL);
  estado = confirmarPreTemporada(
    estado,
    { patrocinadorId: 'pat-tupi', investimento: 5_000_000 },
    catalogo
  ).estado;
  estado = rodarClassificacao(estado, catalogo);
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const taticas: [TaticaCorrida, TaticaCorrida] = [
    { pilotoId: jogador.pilotos[0].pilotoId, paradas: 2, stints: ['soft', 'medium', 'medium'] },
    { pilotoId: jogador.pilotos[1].pilotoId, paradas: 1, stints: ['medium', 'hard'] },
  ];
  return definirTaticasJogador(estado, taticas).estado;
}

describe('preverClassificacao', () => {
  it('devolve exatamente o grid que rodarClassificacao commita', () => {
    let estado = criarCarreira('eq-guarani', 11, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL);
    estado = confirmarPreTemporada(estado, { patrocinadorId: 'pat-tupi', investimento: 0 }, catalogo).estado;
    const previsto = preverClassificacao(estado, catalogo);
    const commitado = rodarClassificacao(estado, catalogo).gridAtual;
    expect(previsto).toEqual(commitado);
  });
});

describe('preverCorridaAoVivo — fidelidade do playback', () => {
  it('o resultado da transmissão é idêntico ao commitado por rodarCorrida (várias seeds)', () => {
    for (const seed of [1, 7, 42, 99, 12345]) {
      const estado = estadoProntoParaCorrida(seed);
      const transmissao = preverCorridaAoVivo(estado, catalogo);
      const commitado = rodarCorrida(estado, catalogo).historico.at(-1)!.corrida;
      expect(transmissao.resultado).toEqual(commitado);
    }
  });

  it('é determinística: duas chamadas produzem a mesma transmissão', () => {
    const estado = estadoProntoParaCorrida(3);
    expect(preverCorridaAoVivo(estado, catalogo)).toEqual(preverCorridaAoVivo(estado, catalogo));
  });
});

describe('preverCorridaAoVivo — estrutura da timeline', () => {
  const estado = estadoProntoParaCorrida(42);
  const transmissao = preverCorridaAoVivo(estado, catalogo);
  const circuito = CIRCUITOS_POR_ID[estado.calendario[estado.gpAtual]];

  it('tem um quadro por volta, cada um com os 20 carros em posições 1..20', () => {
    expect(transmissao.voltasTotais).toBe(circuito.voltas);
    expect(transmissao.quadros).toHaveLength(circuito.voltas);
    for (const quadro of transmissao.quadros) {
      expect(quadro.carros).toHaveLength(20);
      expect(quadro.carros.map((c) => c.posicao)).toEqual(
        Array.from({ length: 20 }, (_, i) => i + 1)
      );
    }
  });

  it('o último quadro segue a ordem oficial do resultado', () => {
    const ultimo = transmissao.quadros.at(-1)!;
    expect(ultimo.carros.map((c) => c.pilotoId)).toEqual(
      transmissao.resultado.map((r) => r.pilotoId)
    );
  });

  it('gaps do líder são crescentes entre os carros em pista', () => {
    for (const quadro of transmissao.quadros) {
      const emPista = quadro.carros.filter((c) => !c.foraDaCorrida);
      expect(emPista[0].gapLider).toBe(0);
      for (let i = 1; i < emPista.length; i++) {
        expect(emPista[i].gapLider).toBeGreaterThanOrEqual(emPista[i - 1].gapLider);
      }
    }
  });

  it('cada carro que completa faz o nº de pits da sua tática', () => {
    for (const r of transmissao.resultado.filter((x) => !x.dnf)) {
      const pits = transmissao.eventos.filter((e) => e.tipo === 'pit' && e.pilotoId === r.pilotoId);
      expect(pits).toHaveLength(transmissao.taticas[r.pilotoId].paradas);
    }
  });

  it('todo DNF do resultado tem evento de abandono e sai dos quadros seguintes', () => {
    for (const r of transmissao.resultado.filter((x) => x.dnf)) {
      const evento = transmissao.eventos.find((e) => e.tipo === 'dnf' && e.pilotoId === r.pilotoId);
      expect(evento).toBeDefined();
      expect(evento!.volta).toBeGreaterThanOrEqual(2);
      expect(evento!.volta).toBeLessThanOrEqual(circuito.voltas);
      // Depois do abandono, o carro aparece como fora da corrida
      for (const quadro of transmissao.quadros.slice(evento!.volta - 1)) {
        expect(quadro.carros.find((c) => c.pilotoId === r.pilotoId)!.foraDaCorrida).toBe(true);
      }
    }
  });

  it('a tática do jogador aparece nos compostos volta a volta', () => {
    const jogador = estado.equipes.find((e) => e.ehJogador)!;
    const piloto1 = jogador.pilotos[0].pilotoId; // soft/medium/medium
    const resultadoP1 = transmissao.resultado.find((r) => r.pilotoId === piloto1)!;
    if (!resultadoP1.dnf) {
      expect(transmissao.quadros[0].carros.find((c) => c.pilotoId === piloto1)!.pneu).toBe('soft');
      expect(transmissao.quadros.at(-1)!.carros.find((c) => c.pilotoId === piloto1)!.pneu).toBe('medium');
    }
  });
});
