// ============================================================================
// IA de gestão das equipes rivais — pré-temporada.
// Não precisa ser esperta; precisa manter a grade viva e competitiva:
//   1. renova o motor expirado (mesmo fornecedor);
//   2. re-assina pilotos expirados se couber, senão contrata o melhor livre
//      QUE ACEITE a equipe (interesse por prestígio/salário — Fase 4);
//   3. investe o resíduo em desenvolvimento (com a eficiência da IA).
// Funções puras: recebem estado + catálogo e devolvem um estado novo.
// ============================================================================

import { EFICIENCIA_INVESTIMENTO_IA, RESERVA_DESENVOLVIMENTO_IA } from './constantes';
import { contratoVigente, criarContratoMotor, criarContratoPiloto } from './contratos';
import { interessePiloto } from './mercado';
import { criarPilotoReserva, potencialOverall } from './pilotoCarreira';
import { gastosFixos, receitaTemporada } from './orcamento';
import type { EstadoJogo, Equipe, Motor, Patrocinador, Piloto } from './tipos';

export interface CatalogoJogo {
  motores: Record<string, Motor>;
  pilotos: Record<string, Piloto>;
  patrocinadores: Record<string, Patrocinador>;
}

/** Nota simples de qualidade de piloto para a IA ranquear contratações. */
function notaPiloto(p: Piloto): number {
  return 0.4 * p.classificacao + 0.5 * p.corrida + 0.1 * p.confiabilidade;
}

/**
 * Aplica a pré-temporada de TODAS as equipes da IA (a do jogador fica
 * intocada — as decisões dela vêm de confirmarPreTemporada).
 * As equipes escolhem na ordem do array (grandes primeiro — prioridade
 * realista na disputa por pilotos livres).
 */
export function aplicarGestaoIA(estado: EstadoJogo, catalogoBase: CatalogoJogo): EstadoJogo {
  const novo: EstadoJogo = structuredClone(estado);
  // Pilotos e motores vivos do estado (Fases 4/6); catálogo como fallback
  const temPilotosVivos = novo.pilotos && Object.keys(novo.pilotos).length > 0;
  const temMotoresVivos = novo.motores && Object.keys(novo.motores).length > 0;
  const catalogo = {
    ...catalogoBase,
    pilotos: temPilotosVivos ? novo.pilotos : catalogoBase.pilotos,
    motores: temMotoresVivos ? novo.motores : catalogoBase.motores,
  };
  const livres = new Set(novo.pilotosLivres);

  // Pilotos com contrato vigente em QUALQUER equipe (não re-assinar quem saiu)
  const contratados = new Set(
    novo.equipes.flatMap((e) =>
      e.pilotos.filter((c) => contratoVigente(c, novo.ano)).map((c) => c.pilotoId)
    )
  );

  for (const equipe of novo.equipes) {
    if (equipe.ehJogador) continue;

    const receita = receitaTemporada(
      equipe,
      catalogo.patrocinadores,
      novo.premiacaoAnterior[equipe.id] ?? 0
    );
    // 1. Motor: renova o mesmo fornecedor por 2 anos se expirou
    if (!contratoVigente(equipe.contratoMotor, novo.ano)) {
      const motor = catalogo.motores[equipe.contratoMotor.motorId];
      equipe.contratoMotor = criarContratoMotor(motor, 2, novo.ano);
    }

    // 2. Pilotos: para cada assento vago, contrata do pool o melhor que
    // cabe no teto E aceita a equipe (prestígio/salário)
    for (let slot = 0; slot < 2; slot++) {
      const contrato = equipe.pilotos[slot];
      if (contratoVigente(contrato, novo.ano)) continue;

      preencherAssentoGarantido({
        equipe,
        slot,
        ano: novo.ano,
        livres,
        contratados,
        pilotosVivos: catalogo.pilotos,
        catalogo,
        premiacaoAnterior: novo.premiacaoAnterior[equipe.id] ?? 0,
      });
    }

    // 3. Investimento: o resíduo vai para desenvolvimento com a eficiência
    // da IA (o desperdício é a brecha que um bom gestor humano explora)
    novo.investimentosAno[equipe.id] = Math.max(
      0,
      Math.round((receita - gastosFixos(equipe)) * EFICIENCIA_INVESTIMENTO_IA)
    );
  }

  novo.pilotosLivres = [...livres];
  return novo;
}

/**
 * A política de contratação da IA para UM assento vago, isolada para
 * reutilização (recomposição de equipe que perdeu piloto num poach):
 * o melhor livre que cabe no teto E aceita a equipe; senão o mais barato
 * que aceite; em último caso, o de menor ambição (ninguém fica sem carro).
 * Determinística — sem RNG.
 */
export function escolherSubstitutoIA(
  equipe: Equipe,
  salarioDoAssentoVago: number,
  livresIds: string[],
  catalogo: CatalogoJogo,
  premiacaoAnterior: number
): Piloto | undefined {
  const receita = receitaTemporada(equipe, catalogo.patrocinadores, premiacaoAnterior);
  // A IA reserva uma fração da receita para desenvolvimento — não
  // compromete tudo em salários.
  const tetoGastosFixos = receita * (1 - RESERVA_DESENVOLVIMENTO_IA);
  const outrosGastos = gastosFixos(equipe) - salarioDoAssentoVago;
  const cabe = (salario: number) => outrosGastos + salario <= tetoGastosFixos;
  const aceita = (p: Piloto) =>
    interessePiloto(
      p,
      equipe,
      { pilotoId: p.id, salarioAnual: p.salarioBase, duracaoAnos: 2 },
      undefined,
      catalogo.patrocinadores[equipe.patrocinadorId] // Fase 6: a marca conta
    ).aceita;

  const candidatos = livresIds
    .map((id) => catalogo.pilotos[id])
    .filter((p) => p && !p.aposentado)
    .sort((a, b) => notaPiloto(b) - notaPiloto(a));

  return (
    candidatos.find((p) => cabe(p.salarioBase) && aceita(p)) ??
    // Ninguém "interessado" cabe: o mais barato que aceite
    [...candidatos].sort((a, b) => a.salarioBase - b.salarioBase).find((p) => aceita(p)) ??
    // Último recurso: o de menor ambição do pool assina mesmo assim
    // (piloto sem volante prefere correr a ficar de fora)
    [...candidatos].sort((a, b) => potencialOverall(a) - potencialOverall(b))[0]
  );
}

/**
 * Preenche UM assento GARANTINDO o invariante do grid: toda equipe entra
 * na temporada com contrato vigente e nenhum piloto corre por duas equipes.
 *
 * Correção do bug de duplicação: o piloto antigo só volta ao pool se NÃO
 * estiver contratado por outra equipe (o contrato dele aqui expirou, mas
 * ele pode já ter assinado com um rival nesta mesma pré-temporada).
 * E se o pool secar, um piloto reserva é criado — o assento nunca fica
 * com contrato vencido escalando um piloto que pertence a outra equipe.
 */
export function preencherAssentoGarantido(opts: {
  equipe: Equipe;
  slot: number;
  ano: number;
  livres: Set<string>;
  contratados: Set<string>;
  /** Registro VIVO de pilotos (estado) — o reserva de emergência entra aqui. */
  pilotosVivos: Record<string, Piloto>;
  catalogo: CatalogoJogo;
  premiacaoAnterior: number;
}): void {
  const { equipe, slot, ano, livres, contratados, pilotosVivos, catalogo, premiacaoAnterior } = opts;
  const contratoAntigo = equipe.pilotos[slot];
  const antigo = pilotosVivos[contratoAntigo.pilotoId];

  const escolhido =
    escolherSubstitutoIA(
      equipe,
      contratoAntigo.salarioAnual,
      [...livres].filter((id) => !contratados.has(id)),
      catalogo,
      premiacaoAnterior
    ) ??
    // Fallback 1: re-assina o antigo, se segue ativo e sem contrato em outra equipe
    (antigo && !antigo.aposentado && !contratados.has(antigo.id) ? antigo : undefined) ??
    // Fallback 2: qualquer piloto ativo sem contrato (mesmo fora do pool)
    Object.values(pilotosVivos)
      .filter((p) => !p.aposentado && !contratados.has(p.id))
      .sort((a, b) => a.salarioBase - b.salarioBase)[0];

  if (escolhido) {
    livres.delete(escolhido.id);
    contratados.add(escolhido.id);
    // O antigo volta ao pool SÓ se estiver de fato disponível
    if (
      escolhido.id !== contratoAntigo.pilotoId &&
      antigo && !antigo.aposentado && !contratados.has(antigo.id)
    ) {
      livres.add(antigo.id);
    }
    equipe.pilotos[slot] = criarContratoPiloto(escolhido, 2, ano);
    return;
  }

  // Emergência determinística (sem RNG): o grid nunca fica com buraco
  const reserva = criarPilotoReserva(equipe, ano, slot);
  pilotosVivos[reserva.id] = reserva;
  contratados.add(reserva.id);
  equipe.pilotos[slot] = criarContratoPiloto(reserva, 1, ano);
}
