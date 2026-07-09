// Testes de integração do loop de carreira usando os dados reais.

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
  rodarClassificacao,
  rodarCorrida,
  simularRestoDaTemporada,
  type CatalogoCompleto,
} from '../carreira';
import { aplicarViradaDeAno, gerarRelatorioFimTemporada } from '../fimTemporada';
import type { EstadoJogo, TaticaCorrida } from '../tipos';

const catalogo: CatalogoCompleto = {
  motores: MOTORES_POR_ID,
  pilotos: PILOTOS_POR_ID,
  patrocinadores: PATROCINADORES_POR_ID,
  circuitos: CIRCUITOS_POR_ID,
};
const calendarioIds = CALENDARIO.map((c) => c.id);

function novaCarreira(seed = 42): EstadoJogo {
  return criarCarreira('eq-guarani', seed, EQUIPES_INICIAIS, calendarioIds, catalogo, ANO_INICIAL);
}

/** Pré-temporada mínima válida do jogador (mantém contratos, patrocínio barato). */
function preTemporadaValida(estado: EstadoJogo): EstadoJogo {
  const r = confirmarPreTemporada(
    estado,
    { patrocinadorId: 'pat-tupi', investimento: 5_000_000 },
    catalogo
  );
  expect(r.erros).toEqual([]);
  return r.estado;
}

function taticasDoJogador(estado: EstadoJogo): [TaticaCorrida, TaticaCorrida] {
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  return [
    { pilotoId: jogador.pilotos[0].pilotoId, paradas: 1, stints: ['medium', 'hard'] },
    { pilotoId: jogador.pilotos[1].pilotoId, paradas: 2, stints: ['soft', 'medium', 'medium'] },
  ];
}

function jogarGP(estado: EstadoJogo): EstadoJogo {
  const comGrid = rodarClassificacao(estado, catalogo);
  expect(comGrid.fase).toBe('gp-estrategia');
  const comTaticas = definirTaticasJogador(comGrid, taticasDoJogador(comGrid));
  expect(comTaticas.erros).toEqual([]);
  return rodarCorrida(comTaticas.estado, catalogo);
}

describe('criarCarreira', () => {
  it('marca a equipe do jogador e começa na pré-temporada', () => {
    const estado = novaCarreira();
    expect(estado.fase).toBe('pre-temporada');
    expect(estado.equipes.filter((e) => e.ehJogador).map((e) => e.id)).toEqual(['eq-guarani']);
  });

  it('a IA dos rivais já define os investimentos do ano', () => {
    const estado = novaCarreira();
    const rivais = estado.equipes.filter((e) => !e.ehJogador);
    for (const rival of rivais) {
      expect(estado.investimentosAno[rival.id]).toBeGreaterThan(0);
    }
    expect(estado.investimentosAno['eq-guarani']).toBeUndefined();
  });
});

describe('confirmarPreTemporada', () => {
  it('bloqueia patrocinador acima do prestígio da equipe', () => {
    const r = confirmarPreTemporada(
      novaCarreira(),
      { patrocinadorId: 'pat-orbita', investimento: 0 }, // exige prestígio 76
      catalogo
    );
    expect(r.erros.some((e) => e.includes('prestígio'))).toBe(true);
  });

  it('bloqueia investimento que estoura a receita e nada é aplicado', () => {
    const estado = novaCarreira();
    const r = confirmarPreTemporada(
      estado,
      { patrocinadorId: 'pat-tupi', investimento: 999_000_000 },
      catalogo
    );
    expect(r.erros.length).toBeGreaterThan(0);
    expect(r.estado).toBe(estado); // estado original intocado
  });

  it('aceita decisões válidas e avança para o primeiro GP', () => {
    const estado = preTemporadaValida(novaCarreira());
    expect(estado.fase).toBe('gp-classificacao');
    expect(estado.investimentosAno['eq-guarani']).toBe(5_000_000);
  });

  it('com a temporada em andamento, bloqueia mudar patrocínio/investimento', () => {
    const emTemporada = preTemporadaValida(novaCarreira());
    const r = confirmarPreTemporada(
      emTemporada,
      { patrocinadorId: 'pat-farol', investimento: 20_000_000 },
      catalogo
    );
    expect(r.erros.some((e) => e.includes('temporada já começou'))).toBe(true);
    expect(r.estado).toBe(emTemporada); // nada aplicado
  });
});

describe('fim de semana de GP', () => {
  it('quali → estratégia → corrida atualiza campeonatos e avança o calendário', () => {
    let estado = preTemporadaValida(novaCarreira());
    estado = jogarGP(estado);

    expect(estado.gpAtual).toBe(1);
    expect(estado.fase).toBe('gp-classificacao');
    expect(estado.historico).toHaveLength(1);
    const somaPontos = Object.values(estado.campeonatoPilotos).reduce((a, b) => a + b, 0);
    expect(somaPontos).toBeGreaterThan(0);
  });

  it('rejeita tática inválida (stints ≠ paradas + 1)', () => {
    const comGrid = rodarClassificacao(preTemporadaValida(novaCarreira()), catalogo);
    const jogador = comGrid.equipes.find((e) => e.ehJogador)!;
    const r = definirTaticasJogador(comGrid, [
      { pilotoId: jogador.pilotos[0].pilotoId, paradas: 2, stints: ['soft', 'hard'] },
      { pilotoId: jogador.pilotos[1].pilotoId, paradas: 1, stints: ['medium', 'hard'] },
    ]);
    expect(r.erros.some((e) => e.includes('inválida'))).toBe(true);
  });

  it('a carreira é determinística para a mesma seed', () => {
    const jogar = () => {
      let estado = preTemporadaValida(novaCarreira(7));
      for (let gp = 0; gp < 3; gp++) estado = jogarGP(estado);
      return estado.campeonatoConstrutores;
    };
    expect(jogar()).toEqual(jogar());
  });
});

describe('simularRestoDaTemporada', () => {
  it('roda todos os GPs restantes e chega ao fim da temporada', () => {
    let estado = preTemporadaValida(novaCarreira(5));
    estado = jogarGP(estado); // um GP à mão...
    const final = simularRestoDaTemporada(estado, catalogo); // ...o resto simulado
    expect(final.fase).toBe('fim-temporada');
    expect(final.historico).toHaveLength(calendarioIds.length);
    expect(Object.keys(final.campeonatoConstrutores)).toHaveLength(10);
  });

  it('respeita as táticas já definidas do GP em andamento', () => {
    let estado = preTemporadaValida(novaCarreira(5));
    estado = rodarClassificacao(estado, catalogo);
    const taticas = taticasDoJogador(estado);
    estado = definirTaticasJogador(estado, taticas).estado; // fase gp-corrida
    const final = simularRestoDaTemporada(estado, catalogo);
    expect(final.fase).toBe('fim-temporada');
    expect(final.historico).toHaveLength(calendarioIds.length);
  });

  it('não faz nada fora da temporada (pré-temporada segue intacta)', () => {
    const estado = novaCarreira(5);
    expect(simularRestoDaTemporada(estado, catalogo)).toBe(estado);
  });
});

describe('temporada completa + fim de temporada', () => {
  function temporadaCompleta(seed = 42): EstadoJogo {
    let estado = preTemporadaValida(novaCarreira(seed));
    for (let gp = 0; gp < calendarioIds.length; gp++) estado = jogarGP(estado);
    return estado;
  }

  it('após o último GP entra em fim-temporada', () => {
    const estado = temporadaCompleta();
    expect(estado.fase).toBe('fim-temporada');
    expect(estado.historico).toHaveLength(12);
  });

  it('o relatório classifica as 10 equipes e premia todas', () => {
    const estado = temporadaCompleta();
    const relatorio = gerarRelatorioFimTemporada(estado, catalogo);
    expect(relatorio.classificacao).toHaveLength(10);
    expect(Object.keys(relatorio.premiacoes)).toHaveLength(10);
    // Premiação decrescente com a posição
    const [p1, p10] = [relatorio.classificacao[0], relatorio.classificacao[9]];
    expect(relatorio.premiacoes[p1.equipeId]).toBeGreaterThan(relatorio.premiacoes[p10.equipeId]);
  });

  it('a virada de ano aplica desenvolvimento, expira contratos e reinicia', () => {
    const estado = temporadaCompleta();
    const virado = aplicarViradaDeAno(estado, catalogo);

    expect(virado.ano).toBe(ANO_INICIAL + 1);
    expect(virado.fase).toBe('pre-temporada');
    expect(virado.gpAtual).toBe(0);
    expect(virado.historico).toEqual([]);
    expect(virado.campeonatoConstrutores).toEqual({});
    // Todas as equipes investiram algo → chassi não pode ter caído (sem salto no ano 1)
    for (const equipe of virado.equipes) {
      const antes = estado.equipes.find((e) => e.id === equipe.id)!;
      expect(equipe.nivelChassi).toBeGreaterThanOrEqual(antes.nivelChassi);
      expect(equipe.cicloDesenvolvimento.anoDoCiclo).toBe(2);
    }
    // Contratos de 1 ano expiraram → pilotos no pool
    expect(virado.pilotosLivres.length).toBeGreaterThan(0);
    // Premiação registrada para o ano seguinte
    expect(virado.premiacaoAnterior['eq-guarani']).toBeGreaterThan(0);
  });

  it('reputação sobe quando o jogador supera a expectativa do tier', () => {
    const estado = temporadaCompleta();
    const relatorio = gerarRelatorioFimTemporada(estado, catalogo);
    const { posicao, expectativa, reputacaoAntes, reputacaoDepois } = relatorio.jogador;
    if (posicao < expectativa) expect(reputacaoDepois).toBeGreaterThan(reputacaoAntes);
    if (posicao > expectativa) expect(reputacaoDepois).toBeLessThan(reputacaoAntes);
  });
});
