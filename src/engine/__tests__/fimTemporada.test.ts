import { describe, expect, it } from 'vitest';
import {
  EXPECTATIVA_POR_TIER,
  LIMIAR_DEFICIT_GRAVE,
  LIMIAR_DEFICIT_LEVE,
  PREMIACAO_CONSTRUTORES,
  REPUTACAO_DELTA_MAXIMO,
} from '../constantes';
import {
  classificacaoConstrutores,
  expectativaJogador,
  gerarRelatorioFimTemporada,
  aplicarViradaDeAno,
} from '../fimTemporada';
import type { CatalogoJogo } from '../gestaoIA';
import type { EstadoJogo } from '../tipos';
import { equipeTeste, motorTeste, pilotoTeste } from './fixtures';

// Cenário sintético: 3 equipes (grande frustrada, média, pequena do jogador)
function estadoSintetico(pontos: Record<string, number>, reputacao = 50): EstadoJogo {
  const grande = { ...equipeTeste('eq-g', 'm1', ['g1', 'g2'], 85), tier: 'grande' as const, prestigio: 85 };
  const media = { ...equipeTeste('eq-m', 'm1', ['m1p', 'm2p'], 65), tier: 'media' as const, prestigio: 60 };
  const pequena = {
    ...equipeTeste('eq-p', 'm1', ['p1p', 'p2p'], 45),
    tier: 'pequena' as const,
    prestigio: 40,
    ehJogador: true,
    reputacao,
  };
  return {
    ano: 2026,
    seed: 1,
    equipeJogadorId: 'eq-p',
    fase: 'fim-temporada',
    gpAtual: 12,
    equipes: [grande, media, pequena],
    calendario: [],
    campeonatoPilotos: {},
    campeonatoConstrutores: pontos,
    historico: [],
    pilotos: Object.fromEntries(
      ['g1', 'g2', 'm1p', 'm2p', 'p1p', 'p2p'].map((id) => [id, pilotoTeste({ id })])
    ),
    motores: {},
    chefes: {},
    premiacaoAnterior: {},
    investimentosAno: {},
    pilotosLivres: [],
    patrocinadoresBloqueados: [],
    custosIncidentesAno: 0,
    custoRescisaoAno: 0,
    anosNoVermelhoSeguidos: 0,
    poachesPendentes: [],
  };
}

const catalogo: CatalogoJogo = {
  motores: { m1: motorTeste() },
  pilotos: Object.fromEntries(
    ['g1', 'g2', 'm1p', 'm2p', 'p1p', 'p2p'].map((id) => [id, pilotoTeste({ id })])
  ),
  patrocinadores: {
    'pat-x': { id: 'pat-x', nome: 'Pat X', aporte: 10_000_000, prestigioMinimo: 0, prestigio: 40 },
    'pat-meta': {
      id: 'pat-meta', nome: 'Pat Meta', aporte: 20_000_000, prestigioMinimo: 0, prestigio: 40,
      meta: { posicaoConstrutoresMax: 2, bonus: 5_000_000 },
    },
  },
};

describe('classificacaoConstrutores', () => {
  it('ordena por pontos e coloca equipes sem ponto no fim', () => {
    const estado = estadoSintetico({ 'eq-m': 30, 'eq-g': 80 });
    expect(classificacaoConstrutores(estado).map((c) => c.equipeId)).toEqual([
      'eq-g', 'eq-m', 'eq-p',
    ]);
  });
});

describe('expectativa e reputação do chefe', () => {
  it('a expectativa vem do tier e endurece com a posição anterior (com folga)', () => {
    const estado = estadoSintetico({});
    expect(expectativaJogador(estado)).toBe(EXPECTATIVA_POR_TIER.pequena);
    estado.posicaoAnteriorJogador = 2;
    expect(expectativaJogador(estado)).toBe(4); // anterior + folga de 2
  });

  it('superar a expectativa sobe a reputação (com teto de variação)', () => {
    const estado = estadoSintetico({ 'eq-p': 100, 'eq-g': 50, 'eq-m': 30 });
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.jogador.posicao).toBe(1);
    expect(r.jogador.reputacaoDepois - r.jogador.reputacaoAntes).toBe(REPUTACAO_DELTA_MAXIMO);
  });

  it('ficar abaixo da expectativa derruba a reputação', () => {
    // Numa equipe grande (expectativa 2), terminar em 3º é fracasso
    const estado = estadoSintetico({ 'eq-g': 80, 'eq-m': 30 });
    const jogador = estado.equipes.find((e) => e.ehJogador)!;
    jogador.tier = 'grande';
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.jogador.posicao).toBe(3);
    expect(r.jogador.reputacaoDepois).toBeLessThan(r.jogador.reputacaoAntes);
  });
});

describe('prestígio das equipes', () => {
  it('a expectativa é o ranking de prestígio: superar sobe, decepcionar desce', () => {
    // Pequena (rank 3 de prestígio) vence; grande (rank 1) termina em 3º
    const estado = estadoSintetico({ 'eq-p': 100, 'eq-m': 50, 'eq-g': 10 });
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.prestigio['eq-p'].depois).toBeGreaterThan(r.prestigio['eq-p'].antes);
    expect(r.prestigio['eq-g'].depois).toBeLessThan(r.prestigio['eq-g'].antes);
    expect(r.prestigio['eq-m'].depois).toBe(r.prestigio['eq-m'].antes); // rank 2, terminou 2º
  });
});

describe('convites', () => {
  it('equipe de prestígio maior, frustrada, convida quando a reputação alcança o limiar', () => {
    // Grande (prestígio 85, rank 1) termina em 3º = frustrada; jogador vence
    const estado = estadoSintetico({ 'eq-p': 100, 'eq-m': 50, 'eq-g': 10 }, 75);
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    // limiar = 0.9 × 85 = 76.5; reputação 75 + 12 = 87 ✓
    expect(r.convites).toContain('eq-g');
  });

  it('sem reputação suficiente não há convite', () => {
    const estado = estadoSintetico({ 'eq-p': 100, 'eq-m': 50, 'eq-g': 10 }, 30);
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.convites).toEqual([]);
  });
});

describe('meta de patrocínio', () => {
  it('meta cumprida soma o bônus à premiação do jogador', () => {
    const estado = estadoSintetico({ 'eq-p': 100, 'eq-g': 50, 'eq-m': 30 });
    estado.equipes.find((e) => e.ehJogador)!.patrocinadorId = 'pat-meta';
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.jogador.metaPatrocinio?.cumprida).toBe(true);
    expect(r.premiacoes['eq-p']).toBe(PREMIACAO_CONSTRUTORES[0] + 5_000_000);
  });

  it('meta falhada não dá bônus', () => {
    const estado = estadoSintetico({ 'eq-g': 80, 'eq-m': 30 }); // jogador P3
    estado.equipes.find((e) => e.ehJogador)!.patrocinadorId = 'pat-meta';
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.jogador.metaPatrocinio?.cumprida).toBe(false);
    expect(r.premiacoes['eq-p']).toBe(PREMIACAO_CONSTRUTORES[2]);
  });
});

describe('balanço financeiro e demissão (Bloco C)', () => {
  // Receita do jogador no cenário: base 50M + pat-x 10M = 60M; fixos 3M
  function comGastos(incidentes: number, investimento = 57_000_000): EstadoJogo {
    const estado = estadoSintetico({ 'eq-g': 80, 'eq-m': 30 });
    estado.investimentosAno['eq-p'] = investimento; // consome todo o resíduo
    estado.custosIncidentesAno = incidentes;
    return estado;
  }

  it('sem incidentes e dentro do orçamento: situação ok', () => {
    const r = gerarRelatorioFimTemporada(comGastos(0), catalogo);
    expect(r.financeiro.saldo).toBe(0);
    expect(r.financeiro.situacao).toBe('ok');
    expect(r.financeiro.demitido).toBe(false);
  });

  it('déficit leve: aviso + queda extra de reputação, sem demissão', () => {
    const r = gerarRelatorioFimTemporada(comGastos(LIMIAR_DEFICIT_LEVE - 1_000_000), catalogo);
    expect(r.financeiro.situacao).toBe('aviso');
    expect(r.financeiro.demitido).toBe(false);
    // P3 de expectativa 9 daria +12 de reputação; o aviso corta 6
    expect(r.jogador.reputacaoDepois - r.jogador.reputacaoAntes).toBe(REPUTACAO_DELTA_MAXIMO - 6);
  });

  it('déficit grave: demissão imediata, com ofertas de prestígio menor/igual', () => {
    const r = gerarRelatorioFimTemporada(comGastos(LIMIAR_DEFICIT_GRAVE + 5_000_000), catalogo);
    expect(r.financeiro.situacao).toBe('vermelho');
    expect(r.financeiro.demitido).toBe(true);
    // Jogador tem prestígio 40 — nenhuma das outras (85/60) é elegível...
    expect(r.ofertasEmprego).toEqual([]);
    expect(r.financeiro.carreiraEncerrada).toBe(true);
  });

  it('dois anos seguidos no vermelho: demitido', () => {
    const estado = comGastos(LIMIAR_DEFICIT_LEVE + 4_000_000); // vermelho, mas não grave
    expect(gerarRelatorioFimTemporada(estado, catalogo).financeiro.demitido).toBe(false);
    estado.anosNoVermelhoSeguidos = 1; // já vinha de um ano no vermelho
    expect(gerarRelatorioFimTemporada(estado, catalogo).financeiro.demitido).toBe(true);
  });

  it('a virada acumula anos no vermelho e zera quando o ano fecha no azul', () => {
    const noVermelho = aplicarViradaDeAno(comGastos(LIMIAR_DEFICIT_LEVE + 4_000_000), catalogo);
    expect(noVermelho.anosNoVermelhoSeguidos).toBe(1);
    const noAzul = aplicarViradaDeAno(comGastos(0), catalogo);
    expect(noAzul.anosNoVermelhoSeguidos).toBe(0);
  });

  it('demitido com oferta disponível troca de equipe em vez de encerrar', () => {
    const estado = comGastos(LIMIAR_DEFICIT_GRAVE + 5_000_000);
    // Deixa a média com prestígio menor que o jogador → vira oferta de emprego
    estado.equipes.find((e) => e.id === 'eq-m')!.prestigio = 30;
    const r = gerarRelatorioFimTemporada(estado, catalogo);
    expect(r.ofertasEmprego).toEqual(['eq-m']);
    const virado = aplicarViradaDeAno(estado, catalogo, 'eq-m');
    expect(virado.fase).toBe('pre-temporada');
    expect(virado.equipeJogadorId).toBe('eq-m');
  });

  it('demitido sem nenhuma oferta encerra a carreira', () => {
    const virado = aplicarViradaDeAno(comGastos(LIMIAR_DEFICIT_GRAVE + 5_000_000), catalogo);
    expect(virado.fase).toBe('fim-carreira');
  });
});
