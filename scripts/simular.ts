// ============================================================================
// Roda uma temporada completa no console: npm run simular [seed]
// Útil para validar o motor e o balanceamento sem UI (Fase 1).
// ============================================================================

import { CALENDARIO, CIRCUITOS_POR_ID } from '../src/data/calendario';
import { EQUIPES_INICIAIS } from '../src/data/equipes';
import { MOTORES_POR_ID } from '../src/data/motores';
import { PILOTOS_POR_ID } from '../src/data/pilotos';
import { criarRng } from '../src/engine/rng';
import { classificarCampeonato } from '../src/engine/pontuacao';
import { simularTemporada } from '../src/engine/temporada';

const seed = Number(process.argv[2] ?? Date.now());
const catalogo = { motores: MOTORES_POR_ID, pilotos: PILOTOS_POR_ID };
const equipesPorId = new Map(EQUIPES_INICIAIS.map((e) => [e.id, e]));

console.log(`\n=== PROJECTO F1 — Temporada 2026 (seed ${seed}) ===\n`);

const temporada = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(seed));

// --- Resultado GP a GP (pódio) ---
for (const gp of temporada.resultados) {
  const circuito = CIRCUITOS_POR_ID[gp.circuitoId];
  const podio = gp.corrida
    .slice(0, 3)
    .map((r, i) => `${i + 1}º ${PILOTOS_POR_ID[r.pilotoId].nome} (${equipesPorId.get(r.equipeId)!.nome})`)
    .join('  |  ');
  const dnfs = gp.corrida.filter((r) => r.dnf).length;
  console.log(`${circuito.nome.padEnd(26)} ${podio}${dnfs ? `  [${dnfs} DNF]` : ''}`);
}

// --- Campeonato de Pilotos ---
console.log('\n--- Campeonato de Pilotos ---');
for (const [i, { id, pontos }] of classificarCampeonato(temporada.campeonatoPilotos).entries()) {
  console.log(`${String(i + 1).padStart(2)}. ${PILOTOS_POR_ID[id].nome.padEnd(22)} ${pontos} pts`);
}

// --- Campeonato de Construtores ---
console.log('\n--- Campeonato de Construtores ---');
for (const [i, { id, pontos }] of classificarCampeonato(temporada.campeonatoConstrutores).entries()) {
  const equipe = equipesPorId.get(id)!;
  console.log(`${String(i + 1).padStart(2)}. ${equipe.nome.padEnd(24)} (${equipe.tier.padEnd(7)}) ${pontos} pts`);
}
console.log();
