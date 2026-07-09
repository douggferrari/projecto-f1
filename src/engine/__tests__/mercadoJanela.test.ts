// ============================================================================
// Redesign do mercado — janela de pré-temporada + poach de efeito imediato.
// Provas exigidas:
//  1. poach preenche assento VAGO para a temporada que vai começar;
//  2. poach em assento OCUPADO libera o atual e a origem recompõe (2 pilotos);
//  3. ofertas bloqueadas fora da pré-temporada (navegar continua livre);
//  4. cancelamento estorna a rescisão EXATAMENTE;
//  5. teto de poaches por janela respeitado; atomicidade do confirmar.
// ============================================================================

import { describe, expect, it } from 'vitest';
import { CALENDARIO, CIRCUITOS_POR_ID } from '../../data/calendario';
import { ANO_INICIAL, EQUIPES_INICIAIS } from '../../data/equipes';
import { MOTORES_POR_ID } from '../../data/motores';
import { PATROCINADORES_POR_ID } from '../../data/patrocinadores';
import { PILOTOS_POR_ID } from '../../data/pilotos';
import {
  cancelarContratacaoPendente,
  confirmarPreTemporada,
  criarCarreira,
  fazerOfertaPoach,
  simularRestoDaTemporada,
  type CatalogoCompleto,
} from '../carreira';
import { contratoVigente } from '../contratos';
import { aplicarViradaDeAno } from '../fimTemporada';
import { iniciarPreTemporada } from '../carreira';
import { interessePiloto, validarPoach } from '../mercado';
import { salarioExigido } from '../pilotoCarreira';
import type { EstadoJogo } from '../tipos';

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

/** Uma temporada inteira simulada + virada → pré-temporada do ano 2
 * (os contratos de 1 ano do jogador expiram → assentos vagos). */
function preTemporadaAno2(seed = 42): EstadoJogo {
  let estado = novaCarreira(seed);
  estado = confirmarPreTemporada(
    estado,
    { patrocinadorId: 'pat-tupi', investimento: 5_000_000 },
    catalogo
  ).estado;
  estado = simularRestoDaTemporada(estado, catalogo);
  estado = aplicarViradaDeAno(estado, catalogo);
  return iniciarPreTemporada(estado, catalogo);
}

/** Faz um poach que o alvo aceita — o aceitante MAIS BARATO (cabe no ano 1). */
function poachAceito(estado: EstadoJogo, slot: 0 | 1): { estado: EstadoJogo; pilotoId: string; rescisao: number } {
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const candidatos = estado.equipes
    .filter((e) => !e.ehJogador)
    .flatMap((equipe) =>
      equipe.pilotos
        .filter((c) => contratoVigente(c, estado.ano))
        .map((c) => ({ equipe, piloto: estado.pilotos[c.pilotoId] }))
    )
    .sort((a, b) => salarioExigido(a.piloto) - salarioExigido(b.piloto));

  for (const { equipe, piloto } of candidatos) {
    const salarioAnual = Math.round(salarioExigido(piloto) * 1.6);
    const oferta = { pilotoId: piloto.id, salarioAnual, duracaoAnos: 2 };
    const decide = interessePiloto(
      piloto, jogador, oferta, equipe, catalogo.patrocinadores[jogador.patrocinadorId]
    );
    if (!decide.aceita) continue;
    const r = fazerOfertaPoach(estado, { ...oferta, slot }, catalogo);
    expect(r.decisao?.aceita).toBe(true);
    return { estado: r.estado, pilotoId: piloto.id, rescisao: r.custoRescisao! };
  }
  throw new Error('nenhum alvo de poach aceitou no cenário de teste');
}

/** Preenche os assentos vagos restantes com livres que aceitem. */
function decisoesComLivres(estado: EstadoJogo): Parameters<typeof confirmarPreTemporada>[1] {
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const pilotos: { slot: 0 | 1; pilotoId: string; duracaoAnos: number; salarioAnual: number }[] = [];
  const usados = new Set<string>();
  for (const slot of [0, 1] as const) {
    const ocupadoPorPoach = estado.poachesPendentes.some((p) => p.slot === slot);
    if (ocupadoPorPoach || contratoVigente(jogador.pilotos[slot], estado.ano)) continue;
    const livre = estado.pilotosLivres
      .map((id) => estado.pilotos[id])
      .find((p) => {
        if (usados.has(p.id)) return false;
        const salarioAnual = Math.round(salarioExigido(p) * 1.3);
        return interessePiloto(
          p, jogador,
          { pilotoId: p.id, salarioAnual, duracaoAnos: 2 },
          undefined,
          catalogo.patrocinadores[jogador.patrocinadorId]
        ).aceita;
      })!;
    usados.add(livre.id);
    pilotos.push({ slot, pilotoId: livre.id, duracaoAnos: 2, salarioAnual: Math.round(salarioExigido(livre) * 1.3) });
  }
  return { patrocinadorId: 'pat-tupi', investimento: 0, pilotos };
}

describe('1. poach preenche assento VAGO nesta temporada (bug original)', () => {
  it('confirma a pré-temporada sem travar e o piloto corre pelo jogador no ano corrente', () => {
    let estado = preTemporadaAno2();
    const { estado: comPoach, pilotoId } = poachAceito(estado, 0);
    const r = confirmarPreTemporada(comPoach, decisoesComLivres(comPoach), catalogo);
    expect(r.erros).toEqual([]);

    const jogador = r.estado.equipes.find((e) => e.ehJogador)!;
    expect(jogador.pilotos[0].pilotoId).toBe(pilotoId);
    expect(jogador.pilotos[0].anoInicio).toBe(r.estado.ano); // NESTA temporada
    expect(contratoVigente(jogador.pilotos[0], r.estado.ano)).toBe(true);
    expect(r.estado.poachesPendentes).toEqual([]);
  });
});

describe('2. substituição de assento ocupado + recomposição da origem', () => {
  it('libera o titular atual e a equipe de origem segue com 2 pilotos vigentes', () => {
    const estado = novaCarreira(); // ano 1: os dois assentos ocupados
    const jogador = estado.equipes.find((e) => e.ehJogador)!;
    const titularAntigo = jogador.pilotos[0].pilotoId;

    const { estado: comPoach, pilotoId } = poachAceito(estado, 0);
    const origemId = comPoach.poachesPendentes[0].equipeOrigemId;

    const r = confirmarPreTemporada(
      comPoach,
      { patrocinadorId: 'pat-tupi', investimento: 0 },
      catalogo
    );
    expect(r.erros).toEqual([]);

    const jogadorDepois = r.estado.equipes.find((e) => e.ehJogador)!;
    expect(jogadorDepois.pilotos[0].pilotoId).toBe(pilotoId);
    // O titular substituído foi LIBERADO: saiu da equipe do jogador e está
    // livre — ou já foi fisgado por outra equipe na recomposição (o ciclo
    // completo do mercado funcionando)
    expect(jogadorDepois.pilotos.some((c) => c.pilotoId === titularAntigo)).toBe(false);
    const recontratadoPor = r.estado.equipes.find(
      (e) => !e.ehJogador && e.pilotos.some((c) => c.pilotoId === titularAntigo && contratoVigente(c, r.estado.ano))
    );
    expect(r.estado.pilotosLivres.includes(titularAntigo) || Boolean(recontratadoPor)).toBe(true);
    // A origem recompôs: 2 pilotos com contrato vigente, e o poacheado saiu
    const origem = r.estado.equipes.find((e) => e.id === origemId)!;
    const vigentes = origem.pilotos.filter((c) => contratoVigente(c, r.estado.ano));
    expect(vigentes).toHaveLength(2);
    expect(vigentes.some((c) => c.pilotoId === pilotoId)).toBe(false);
    // Ninguém no grid entra na temporada com assento vazio
    for (const equipe of r.estado.equipes) {
      expect(equipe.pilotos.filter((c) => contratoVigente(c, r.estado.ano))).toHaveLength(2);
    }
  });
});

describe('3. janela: ofertas bloqueadas fora da pré-temporada', () => {
  it('poach durante a temporada é rejeitado com aviso de mercado fechado', () => {
    let estado = novaCarreira();
    estado = confirmarPreTemporada(
      estado, { patrocinadorId: 'pat-tupi', investimento: 0 }, catalogo
    ).estado;
    expect(estado.fase).toBe('gp-classificacao');

    const alvo = estado.equipes.find((e) => !e.ehJogador)!.pilotos[0].pilotoId;
    expect(validarPoach(estado, alvo, 0).erro).toContain('Mercado fechado');
    const r = fazerOfertaPoach(
      estado,
      { pilotoId: alvo, salarioAnual: 99_000_000, duracaoAnos: 2, slot: 0 },
      catalogo
    );
    expect(r.erro).toContain('Mercado fechado');
    expect(r.estado).toBe(estado); // nada mudou
  });
});

describe('4. cancelamento estorna a rescisão exatamente', () => {
  it('o saldo volta ao valor anterior e a pendência some', () => {
    const estado = novaCarreira();
    const antes = estado.custoRescisaoAno;
    const { estado: comPoach, pilotoId, rescisao } = poachAceito(estado, 1);
    expect(comPoach.custoRescisaoAno).toBe(antes + rescisao);

    const cancelado = cancelarContratacaoPendente(comPoach, pilotoId);
    expect(cancelado.custoRescisaoAno).toBe(antes);
    expect(cancelado.poachesPendentes).toEqual([]);
  });
});

describe('5. teto por janela e atomicidade', () => {
  it('o segundo poach na mesma janela é bloqueado pelo teto', () => {
    const { estado: comPoach } = poachAceito(novaCarreira(), 0);
    const outroAlvo = comPoach.equipes
      .find((e) => !e.ehJogador && !e.pilotos.some((c) => c.pilotoId === comPoach.poachesPendentes[0].pilotoId))!
      .pilotos[0].pilotoId;
    expect(validarPoach(comPoach, outroAlvo, 1).erro).toContain('Limite');
  });

  it('confirmar com erro não aplica NADA (pendência e origem intactas)', () => {
    const { estado: comPoach } = poachAceito(novaCarreira(), 0);
    const r = confirmarPreTemporada(
      comPoach,
      { patrocinadorId: 'pat-tupi', investimento: 999_000_000 }, // estoura
      catalogo
    );
    expect(r.erros.length).toBeGreaterThan(0);
    expect(r.estado).toBe(comPoach); // estado original — atômico
    expect(r.estado.poachesPendentes).toHaveLength(1);
  });
});
