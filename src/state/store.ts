// ============================================================================
// Store global (Zustand) — camada fina por cima do motor de carreira.
// Toda a lógica de jogo vive em /src/engine; aqui só orquestração de
// estado, navegação entre telas e persistência.
// ============================================================================

import { create } from 'zustand';
import { ANO_INICIAL, EQUIPES_INICIAIS } from '../data/equipes';
import {
  confirmarPreTemporada,
  criarCarreira,
  definirTaticasJogador,
  fazerOfertaPoach,
  iniciarPreTemporada,
  rodarClassificacao,
  rodarCorrida,
  simularRestoDaTemporada,
  type DecisoesPreTemporada,
} from '../engine/carreira';
import { aplicarViradaDeAno } from '../engine/fimTemporada';
import type { DecisaoPiloto, Oferta } from '../engine/mercado';
import type { EstadoJogo, TaticaCorrida } from '../engine/tipos';
import { CALENDARIO_IDS, CATALOGO } from './catalogo';
import { apagarSave, carregarJogo, salvarJogo } from './persistencia';

export type Tela = 'sede' | 'escritorio' | 'mercado' | 'calendario' | 'campeonatos' | 'gp';

interface JogoStore {
  estado: EstadoJogo | null;
  tela: Tela;
  erros: string[];
  avisoSave: string | null;
  /** Resultado da última oferta de mercado (feedback na tela de mercado). */
  ultimaDecisaoMercado: { pilotoId: string; decisao?: DecisaoPiloto; erro?: string } | null;

  novaCarreira: (equipeId: string) => void;
  confirmarPreTemporada: (decisoes: DecisoesPreTemporada) => void;
  rodarClassificacao: () => void;
  definirTaticas: (taticas: [TaticaCorrida, TaticaCorrida]) => void;
  rodarCorrida: () => void;
  concluirTemporada: (escolhaEquipe?: string) => void;
  simularTemporadaInteira: () => void;
  fazerPoach: (oferta: Oferta & { slot: 0 | 1 }) => void;
  irPara: (tela: Tela) => void;
  limparErros: () => void;
  salvar: () => void;
  carregar: () => void;
  abandonarCarreira: () => void;
}

export const useJogo = create<JogoStore>((set, get) => ({
  estado: null,
  tela: 'sede',
  erros: [],
  avisoSave: null,
  ultimaDecisaoMercado: null,

  novaCarreira: (equipeId) => {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const estado = criarCarreira(equipeId, seed, EQUIPES_INICIAIS, CALENDARIO_IDS, CATALOGO, ANO_INICIAL);
    set({ estado, tela: 'sede', erros: [] });
  },

  confirmarPreTemporada: (decisoes) => {
    const { estado } = get();
    if (!estado) return;
    const r = confirmarPreTemporada(estado, decisoes, CATALOGO);
    set({ estado: r.estado, erros: r.erros });
    if (r.erros.length === 0) {
      salvarJogo(r.estado);
      set({ tela: 'gp' });
    }
  },

  rodarClassificacao: () => {
    const { estado } = get();
    if (!estado || estado.fase !== 'gp-classificacao') return;
    set({ estado: rodarClassificacao(estado, CATALOGO), erros: [] });
  },

  definirTaticas: (taticas) => {
    const { estado } = get();
    if (!estado || estado.fase !== 'gp-estrategia') return;
    const r = definirTaticasJogador(estado, taticas);
    set({ estado: r.estado, erros: r.erros });
  },

  rodarCorrida: () => {
    const { estado } = get();
    if (!estado || estado.fase !== 'gp-corrida') return;
    const novo = rodarCorrida(estado, CATALOGO);
    set({ estado: novo, erros: [] });
    salvarJogo(novo);
  },

  concluirTemporada: (escolhaEquipe) => {
    const { estado } = get();
    if (!estado || estado.fase !== 'fim-temporada') return;
    const virado = aplicarViradaDeAno(estado, CATALOGO, escolhaEquipe);
    // Carreira encerrada: não há pré-temporada para iniciar
    const pronto = virado.fase === 'fim-carreira' ? virado : iniciarPreTemporada(virado, CATALOGO);
    set({ estado: pronto, erros: [], tela: 'sede' });
    salvarJogo(pronto);
  },

  simularTemporadaInteira: () => {
    const { estado } = get();
    const emCorrida =
      estado &&
      (estado.fase === 'gp-classificacao' ||
        estado.fase === 'gp-estrategia' ||
        estado.fase === 'gp-corrida');
    if (!emCorrida) return;
    const final = simularRestoDaTemporada(estado, CATALOGO);
    set({ estado: final, erros: [], tela: 'sede' });
    salvarJogo(final);
  },

  fazerPoach: (oferta) => {
    const { estado } = get();
    if (!estado) return;
    const r = fazerOfertaPoach(estado, oferta, CATALOGO);
    set({
      estado: r.estado,
      ultimaDecisaoMercado: { pilotoId: oferta.pilotoId, decisao: r.decisao, erro: r.erro },
    });
    if (r.estado !== estado) salvarJogo(r.estado);
  },

  irPara: (tela) => set({ tela }),
  limparErros: () => set({ erros: [] }),

  salvar: () => {
    const { estado } = get();
    if (!estado) return;
    const ok = salvarJogo(estado);
    set({ avisoSave: ok ? 'Jogo salvo.' : 'Não foi possível salvar.' });
    setTimeout(() => set({ avisoSave: null }), 2500);
  },

  carregar: () => {
    const estado = carregarJogo();
    set(
      estado
        ? { estado, tela: 'sede', erros: [], avisoSave: 'Jogo carregado.' }
        : { avisoSave: 'Nenhum save encontrado (saves de versões antigas não são compatíveis).' }
    );
    setTimeout(() => set({ avisoSave: null }), 2500);
  },

  abandonarCarreira: () => {
    apagarSave();
    set({ estado: null, tela: 'sede', erros: [] });
  },
}));
