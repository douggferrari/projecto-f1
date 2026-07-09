// ============================================================================
// Orquestração da carreira — o loop jogável por cima do motor de simulação.
// Todas as funções são puras (estado entra, estado novo sai); a camada de
// UI/store só chama estas funções e persiste o resultado.
//
// Fluxo: criarCarreira → [pre-temporada: gestão IA + decisões do jogador]
//   → por GP: rodarClassificacao → definirTaticasJogador → rodarCorrida
//   → fim-temporada: gerarRelatorioFimTemporada → aplicarViradaDeAno → volta
// ============================================================================

import { simularClassificacao } from './classificacao';
import { preverCorridaAoVivo } from './corridaAoVivo';
import { contratoVigente, criarContratoMotor, pilotosLivres } from './contratos';
import { aplicarGestaoIA, preencherAssentoGarantido, type CatalogoJogo } from './gestaoIA';
import { custosIncidentesDoGP } from './incidentes';
import { interessePiloto, validarPoach, type DecisaoPiloto, type Oferta } from './mercado';
import { validarOrcamento, formatarDinheiro } from './orcamento';
import { salarioAnualPiloto } from './contratos';
import { atualizarCampeonatos } from './pontuacao';
import { criarRng, derivarSeed } from './rng';
import { CHEFE_JOGADOR_ID } from './chefes';
import { taticaValida } from './taticas';
import type { Chefe, Circuito, EstadoJogo, Equipe, ResultadoClassificacao, TaticaCorrida } from './tipos';

/** Catálogo completo que o loop precisa (montado na camada de dados/state). */
export interface CatalogoCompleto extends CatalogoJogo {
  circuitos: Record<string, Circuito>;
}

/**
 * Catálogo "vivo": pilotos E motores vêm do ESTADO (pilotos envelhecem,
 * motores evoluem por temporada — Fase 6); o resto é estático.
 * Todo caminho de simulação passa por aqui.
 */
export function catalogoVivo<T extends CatalogoJogo>(estado: EstadoJogo, catalogo: T): T {
  const temPilotosVivos = estado.pilotos && Object.keys(estado.pilotos).length > 0;
  const temMotoresVivos = estado.motores && Object.keys(estado.motores).length > 0;
  if (!temPilotosVivos && !temMotoresVivos) return catalogo;
  return {
    ...catalogo,
    pilotos: temPilotosVivos ? estado.pilotos : catalogo.pilotos,
    motores: temMotoresVivos ? estado.motores : catalogo.motores,
  };
}

// ---------------------------------------------------------------------------
// Criação de carreira
// ---------------------------------------------------------------------------

export function criarCarreira(
  equipeJogadorId: string,
  seed: number,
  equipesIniciais: Equipe[],
  calendario: string[],
  catalogo: CatalogoCompleto,
  anoInicial: number,
  // Fase 6 (opcionais para compatibilidade): chefes da IA por equipeId e
  // o nome do chefe do jogador
  chefesIniciais?: Record<string, Omit<Chefe, 'historico'>>,
  nomeChefeJogador = 'Você'
): EstadoJogo {
  const equipes = structuredClone(equipesIniciais);
  for (const e of equipes) e.ehJogador = e.id === equipeJogadorId;

  // Pilotos "vivos": cópia do catálogo para dentro do estado — a partir
  // daqui eles envelhecem, evoluem, aposentam e novatos são adicionados.
  const pilotos = structuredClone(catalogo.pilotos);
  // Motores "vivos" (Fase 6): os ratings passam a evoluir por temporada
  const motores = structuredClone(catalogo.motores);

  // Chefes: um por equipe da IA + o do jogador (que assume a equipe escolhida)
  const chefes: Record<string, Chefe> = {};
  for (const equipe of equipes) {
    if (equipe.id === equipeJogadorId) {
      equipe.chefeId = CHEFE_JOGADOR_ID;
      continue;
    }
    const semente = chefesIniciais?.[equipe.id];
    const chefe: Chefe = semente
      ? { ...semente, historico: [] }
      : { id: equipe.chefeId, nome: `Chefe da ${equipe.nome}`, reputacao: 50, campeonatosVencidos: 0, historico: [] };
    equipe.chefeId = chefe.id;
    chefes[chefe.id] = chefe;
  }
  chefes[CHEFE_JOGADOR_ID] = {
    id: CHEFE_JOGADOR_ID,
    nome: nomeChefeJogador,
    reputacao: 50,
    campeonatosVencidos: 0,
    historico: [],
  };

  const estado: EstadoJogo = {
    ano: anoInicial,
    seed,
    equipeJogadorId,
    fase: 'pre-temporada',
    gpAtual: 0,
    equipes,
    calendario,
    campeonatoPilotos: {},
    campeonatoConstrutores: {},
    historico: [],
    pilotos,
    motores,
    chefes,
    premiacaoAnterior: {}, // ano 1: sem premiação — todo mundo parte da receita-base
    investimentosAno: {},
    pilotosLivres: pilotosLivres(Object.values(pilotos), equipes, anoInicial),
    patrocinadoresBloqueados: [],
    custosIncidentesAno: 0,
    custoRescisaoAno: 0,
    anosNoVermelhoSeguidos: 0,
    poachesPendentes: [],
  };

  // A IA dos rivais já resolve a pré-temporada dela (contratos + investimento)
  return aplicarGestaoIA(estado, catalogo);
}

// ---------------------------------------------------------------------------
// Pré-temporada do jogador
// ---------------------------------------------------------------------------

export interface DecisoesPreTemporada {
  /** Novo contrato de motor — obrigatório apenas se o atual expirou. */
  motor?: { motorId: string; duracaoAnos: number };
  /**
   * Ofertas para assentos vagos (slot 0/1). `salarioAnual` é a oferta do
   * jogador (default: o salário exigido com desconto de duração) — o piloto
   * decide pelo interesse (prestígio da equipe × ambição × salário).
   */
  pilotos?: { slot: 0 | 1; pilotoId: string; duracaoAnos: number; salarioAnual?: number }[];
  /** Patrocinador da temporada (sempre escolhido/renovado anualmente). */
  patrocinadorId: string;
  /** Investimento em desenvolvimento (o resíduo flexível). */
  investimento: number;
}

export interface ResultadoConfirmacao {
  estado: EstadoJogo;
  erros: string[];
}

/**
 * Valida e aplica as decisões de pré-temporada do jogador.
 * Se houver erros, o estado devolvido é o original (nada é aplicado)
 * e `erros` explica o que falta cortar/preencher.
 */
export function confirmarPreTemporada(
  estado: EstadoJogo,
  decisoes: DecisoesPreTemporada,
  catalogoBase: CatalogoCompleto
): ResultadoConfirmacao {
  // Contratos, patrocínio e investimento só podem mudar na pré-temporada —
  // depois da primeira classificação, tudo fica travado até o ano seguinte.
  if (estado.fase !== 'pre-temporada') {
    return {
      estado,
      erros: ['A temporada já começou — contratos, patrocínio e investimento só mudam na próxima pré-temporada.'],
    };
  }
  const catalogo = catalogoVivo(estado, catalogoBase);
  const novo: EstadoJogo = structuredClone(estado);
  const jogador = novo.equipes.find((e) => e.ehJogador)!;
  const erros: string[] = [];
  const livres = new Set(novo.pilotosLivres);

  // --- Motor ---
  if (decisoes.motor) {
    if (contratoVigente(jogador.contratoMotor, novo.ano)) {
      erros.push('O contrato de motor atual ainda está vigente — não é possível trocar.');
    } else {
      const motor = catalogo.motores[decisoes.motor.motorId];
      if (!motor) erros.push('Fornecedor de motor inválido.');
      else jogador.contratoMotor = criarContratoMotor(motor, decisoes.motor.duracaoAnos, novo.ano);
    }
  }
  if (!contratoVigente(jogador.contratoMotor, novo.ano)) {
    erros.push('A equipe está sem contrato de motor para a temporada.');
  }

  // --- Patrocínio ANTES dos pilotos: a marca que a equipe estampa entra
  // no interesse deles (prestígio efetivo — Fase 6) ---
  const patrocinador = catalogo.patrocinadores[decisoes.patrocinadorId];
  if (!patrocinador) {
    erros.push('Escolha um patrocinador para a temporada.');
  } else if (novo.patrocinadoresBloqueados.includes(patrocinador.id)) {
    erros.push(`${patrocinador.nome} não renovou: a meta do ano passado não foi cumprida.`);
  } else if (jogador.prestigio < patrocinador.prestigioMinimo) {
    erros.push(
      `${patrocinador.nome} exige uma equipe de prestígio ${patrocinador.prestigioMinimo} (a sua tem ${Math.round(jogador.prestigio)}).`
    );
  } else {
    jogador.patrocinadorId = patrocinador.id;
  }
  const patrocinadorEfetivo = catalogo.patrocinadores[jogador.patrocinadorId];

  // --- Poaches da janela: efeito IMEDIATO na temporada que vai começar ---
  // Aplicados antes da validação de assentos: um poach pendente preenche o
  // assento; se o assento estava ocupado, o piloto atual é liberado.
  // (A recomposição das equipes de origem acontece DEPOIS das contratações
  // do jogador — no confirm dele, ele tem prioridade no pool de livres.)
  const origensARecompor: { origem: Equipe; slotOrigem: number; salarioVago: number }[] = [];
  for (const poach of novo.poachesPendentes) {
    const origem = novo.equipes.find((e) => e.id === poach.equipeOrigemId);
    const slotOrigem = origem?.pilotos.findIndex(
      (c) => c.pilotoId === poach.pilotoId && contratoVigente(c, novo.ano)
    );
    if (!origem || slotOrigem === undefined || slotOrigem < 0) {
      erros.push(
        `${catalogo.pilotos[poach.pilotoId]?.nome ?? poach.pilotoId} não está mais disponível na equipe de origem — cancele a pendência.`
      );
      continue;
    }

    // Assento ocupado do jogador → o atual é liberado (vira piloto livre)
    const ocupante = jogador.pilotos[poach.slot];
    if (contratoVigente(ocupante, novo.ano)) {
      livres.add(ocupante.pilotoId);
    }

    // Sai da origem e assina com o jogador NESTA temporada
    origensARecompor.push({ origem, slotOrigem, salarioVago: origem.pilotos[slotOrigem].salarioAnual });
    origem.pilotos[slotOrigem] = { ...origem.pilotos[slotOrigem], duracaoAnos: 0 };
    jogador.pilotos[poach.slot] = {
      pilotoId: poach.pilotoId,
      duracaoAnos: poach.duracaoAnos,
      salarioAnual: poach.salarioAnual,
      anoInicio: novo.ano,
    };
    livres.delete(poach.pilotoId);
  }

  // --- Pilotos: oferta + decisão de interesse do piloto ---
  for (const contratacao of decisoes.pilotos ?? []) {
    const atual = jogador.pilotos[contratacao.slot];
    if (contratoVigente(atual, novo.ano)) {
      erros.push(`O assento ${contratacao.slot + 1} ainda tem contrato vigente.`);
      continue;
    }
    if (!livres.has(contratacao.pilotoId)) {
      erros.push('Piloto indisponível: já está sob contrato de outra equipe.');
      continue;
    }
    const piloto = catalogo.pilotos[contratacao.pilotoId];
    const salarioAnual =
      contratacao.salarioAnual ?? salarioAnualPiloto(piloto, contratacao.duracaoAnos);
    const decisao = interessePiloto(
      piloto,
      jogador,
      { pilotoId: piloto.id, salarioAnual, duracaoAnos: contratacao.duracaoAnos },
      undefined,
      patrocinadorEfetivo
    );
    if (!decisao.aceita) {
      erros.push(`${piloto.nome} recusou a oferta: ${decisao.motivo}`);
      continue;
    }
    jogador.pilotos[contratacao.slot] = {
      pilotoId: piloto.id,
      duracaoAnos: contratacao.duracaoAnos,
      salarioAnual,
      anoInicio: novo.ano,
    };
    livres.delete(contratacao.pilotoId);
  }
  for (let slot = 0; slot < 2; slot++) {
    if (!contratoVigente(jogador.pilotos[slot], novo.ano)) {
      erros.push(`O assento ${slot + 1} está sem piloto contratado.`);
    }
  }

  // --- Recomposição determinística das origens dos poaches: ninguém entra
  // na temporada com assento vazio (mesma política da IA de gestão) ---
  if (origensARecompor.length > 0) {
    const contratados = new Set(
      novo.equipes.flatMap((e) =>
        e.pilotos.filter((c) => contratoVigente(c, novo.ano)).map((c) => c.pilotoId)
      )
    );
    for (const { origem, slotOrigem } of origensARecompor) {
      preencherAssentoGarantido({
        equipe: origem,
        slot: slotOrigem,
        ano: novo.ano,
        livres,
        contratados,
        pilotosVivos: novo.pilotos,
        catalogo,
        premiacaoAnterior: novo.premiacaoAnterior[origem.id] ?? 0,
      });
    }
  }

  // --- Orçamento (regra dura; a rescisão de poach conta como gasto) ---
  const validacao = validarOrcamento(
    jogador,
    catalogo.patrocinadores,
    novo.premiacaoAnterior[jogador.id] ?? 0,
    decisoes.investimento + novo.custoRescisaoAno
  );
  if (!validacao.valido) {
    erros.push(validacao.mensagem ?? `Orçamento estourado em ${formatarDinheiro(validacao.estouro)}.`);
  }

  if (erros.length > 0) return { estado, erros };

  novo.investimentosAno[jogador.id] = decisoes.investimento;
  novo.pilotosLivres = [...livres];
  novo.poachesPendentes = []; // aplicados — viraram contratos de verdade
  novo.fase = 'gp-classificacao';
  return { estado: novo, erros: [] };
}

// ---------------------------------------------------------------------------
// Fim de semana de GP
// ---------------------------------------------------------------------------

function circuitoAtual(estado: EstadoJogo, catalogo: CatalogoCompleto): Circuito {
  return catalogo.circuitos[estado.calendario[estado.gpAtual]];
}

/**
 * Calcula o grid da classificação do GP atual SEM commitar — a UI usa
 * para animar a sessão; rodarClassificacao() usa o mesmo caminho.
 */
export function preverClassificacao(
  estado: EstadoJogo,
  catalogo: CatalogoCompleto
): ResultadoClassificacao[] {
  const rng = criarRng(derivarSeed(estado.seed, estado.ano, estado.gpAtual, 0));
  return simularClassificacao(estado.equipes, catalogoVivo(estado, catalogo), rng);
}

/** Roda a classificação do GP atual → grid definido, fase de estratégia. */
export function rodarClassificacao(estado: EstadoJogo, catalogo: CatalogoCompleto): EstadoJogo {
  const novo: EstadoJogo = structuredClone(estado);
  novo.gridAtual = preverClassificacao(novo, catalogo);
  novo.fase = 'gp-estrategia';
  return novo;
}

/** Registra as táticas dos 2 pilotos do jogador → pronto para a corrida. */
export function definirTaticasJogador(
  estado: EstadoJogo,
  taticas: [TaticaCorrida, TaticaCorrida]
): ResultadoConfirmacao {
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const idsJogador = new Set(jogador.pilotos.map((c) => c.pilotoId));
  const erros: string[] = [];

  for (const tatica of taticas) {
    if (!idsJogador.has(tatica.pilotoId)) erros.push('Tática para piloto que não é da sua equipe.');
    else if (!taticaValida(tatica)) {
      erros.push(`Tática inválida: ${tatica.paradas} parada(s) exige ${tatica.paradas + 1} stints.`);
    }
  }
  if (erros.length > 0) return { estado, erros };

  const novo: EstadoJogo = structuredClone(estado);
  novo.taticasJogador = taticas;
  novo.fase = 'gp-corrida';
  return { estado: novo, erros: [] };
}

/**
 * Roda a corrida do GP atual e atualiza campeonatos e calendário.
 * Usa o mesmo caminho da transmissão ao vivo (preverCorridaAoVivo) —
 * o que o jogador assistiu é exatamente o que é commitado.
 * Os custos de incidente do jogador usam um RNG derivado separado
 * (etapa 4) — a simulação da corrida não é afetada.
 */
export function rodarCorrida(estado: EstadoJogo, catalogo: CatalogoCompleto): EstadoJogo {
  const novo: EstadoJogo = structuredClone(estado);
  const circuito = circuitoAtual(novo, catalogo);
  const transmissao = preverCorridaAoVivo(novo, catalogo);
  const corrida = transmissao.resultado;

  const atualizado = atualizarCampeonatos(novo.campeonatoPilotos, novo.campeonatoConstrutores, corrida);
  novo.campeonatoPilotos = atualizado.campeonatoPilotos;
  novo.campeonatoConstrutores = atualizado.campeonatoConstrutores;
  novo.historico.push({
    circuitoId: circuito.id,
    grid: novo.gridAtual!,
    corrida,
    clima: transmissao.clima,
    safetyCars: transmissao.safetyCars,
    voltaMaisRapida: transmissao.voltaMaisRapida,
  });

  // Custos de reparo dos DNFs do jogador (Bloco C)
  const rngCustos = criarRng(derivarSeed(novo.seed, novo.ano, novo.gpAtual, 4));
  novo.custosIncidentesAno += custosIncidentesDoGP(novo.equipeJogadorId, corrida, rngCustos);

  novo.gridAtual = undefined;
  novo.taticasJogador = undefined;
  novo.gpAtual += 1;
  novo.fase = novo.gpAtual < novo.calendario.length ? 'gp-classificacao' : 'fim-temporada';
  return novo;
}

// ---------------------------------------------------------------------------
// Simulação do resto da temporada (botão "simular temporada")
// ---------------------------------------------------------------------------

/**
 * Tática padrão da equipe para o GP atual — a mesma heurística por
 * desgaste da pista usada quando o jogador não quer decidir à mão.
 */
export function taticasPadraoJogador(
  estado: EstadoJogo,
  catalogo: CatalogoCompleto
): [TaticaCorrida, TaticaCorrida] {
  const circuito = circuitoAtual(estado, catalogo);
  const stints: TaticaCorrida['stints'] =
    circuito.desgastePneu >= 1.2 ? ['medium', 'hard'] : ['soft', 'hard'];
  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  return [
    { pilotoId: jogador.pilotos[0].pilotoId, paradas: 1, stints: [...stints] },
    { pilotoId: jogador.pilotos[1].pilotoId, paradas: 1, stints: [...stints] },
  ];
}

/**
 * Simula todos os GPs restantes da temporada de uma vez (sem animação),
 * usando a tática padrão nos GPs em que o jogador ainda não decidiu.
 * Mesmas seeds → mesmos resultados que jogar GP a GP.
 * Só funciona com a temporada em andamento (a pré-temporada precisa estar
 * confirmada); ao final, o estado fica em 'fim-temporada'.
 */
export function simularRestoDaTemporada(
  estado: EstadoJogo,
  catalogo: CatalogoCompleto
): EstadoJogo {
  let atual = estado;
  while (
    atual.fase === 'gp-classificacao' ||
    atual.fase === 'gp-estrategia' ||
    atual.fase === 'gp-corrida'
  ) {
    if (atual.fase === 'gp-classificacao') {
      atual = rodarClassificacao(atual, catalogo);
    } else if (atual.fase === 'gp-estrategia') {
      atual = definirTaticasJogador(atual, taticasPadraoJogador(atual, catalogo)).estado;
    } else {
      atual = rodarCorrida(atual, catalogo);
    }
  }
  return atual;
}

// ---------------------------------------------------------------------------
// Mercado: oferta a piloto contratado de outra equipe (poaching)
// ---------------------------------------------------------------------------

export interface ResultadoOferta {
  estado: EstadoJogo;
  decisao?: DecisaoPiloto;
  erro?: string;
  custoRescisao?: number;
}

/**
 * Oferta do jogador a um piloto SOB CONTRATO de outra equipe — só na
 * JANELA de pré-temporada. Se o piloto aceitar, a contratação fica
 * PENDENTE (cancelável, com estorno) e é aplicada em confirmarPreTemporada:
 * o piloto entra no assento escolhido JÁ NESTA temporada. A rescisão é
 * cobrada no orçamento do ano na hora do aceite.
 */
export function fazerOfertaPoach(
  estado: EstadoJogo,
  oferta: Oferta & { slot: 0 | 1 },
  catalogoBase: CatalogoCompleto
): ResultadoOferta {
  const catalogo = catalogoVivo(estado, catalogoBase);
  const validacao = validarPoach(estado, oferta.pilotoId, oferta.slot);
  if (!validacao.valido) return { estado, erro: validacao.erro };

  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  const equipeAtual = estado.equipes.find((e) =>
    e.pilotos.some((c) => c.pilotoId === oferta.pilotoId && contratoVigente(c, estado.ano))
  )!;
  const piloto = catalogo.pilotos[oferta.pilotoId];
  const decisao = interessePiloto(
    piloto,
    jogador,
    oferta,
    equipeAtual,
    catalogo.patrocinadores[jogador.patrocinadorId] // a marca atual pesa na conversa
  );
  if (!decisao.aceita) return { estado, decisao };

  const novo: EstadoJogo = structuredClone(estado);
  novo.poachesPendentes.push({
    pilotoId: oferta.pilotoId,
    slot: oferta.slot,
    salarioAnual: oferta.salarioAnual,
    duracaoAnos: oferta.duracaoAnos,
    custoRescisao: validacao.custoRescisao!,
    equipeOrigemId: equipeAtual.id,
  });
  novo.custoRescisaoAno += validacao.custoRescisao!;
  return { estado: novo, decisao, custoRescisao: validacao.custoRescisao };
}

/**
 * Cancela uma contratação pendente da janela, ESTORNANDO a rescisão do
 * orçamento do ano. Só existe pendência na pré-temporada.
 */
export function cancelarContratacaoPendente(estado: EstadoJogo, pilotoId: string): EstadoJogo {
  const pendente = estado.poachesPendentes.find((p) => p.pilotoId === pilotoId);
  if (!pendente) return estado;
  const novo: EstadoJogo = structuredClone(estado);
  novo.poachesPendentes = novo.poachesPendentes.filter((p) => p.pilotoId !== pilotoId);
  novo.custoRescisaoAno -= pendente.custoRescisao;
  return novo;
}

// ---------------------------------------------------------------------------
// Nova pré-temporada (após a virada de ano)
// ---------------------------------------------------------------------------

/** Depois de aplicarViradaDeAno, roda a gestão da IA para o ano novo. */
export function iniciarPreTemporada(estado: EstadoJogo, catalogo: CatalogoCompleto): EstadoJogo {
  return aplicarGestaoIA(estado, catalogo);
}
