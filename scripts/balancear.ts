// ============================================================================
// HARNESS DE CALIBRAGEM — npm run balancear [N]
// Não é teste unitário: é a ferramenta para medir o balanceamento e iterar
// nas constantes de src/engine/constantes.ts.
//
// Mede três coisas:
//   1. Distribuição de resultados por tier ao longo de N temporadas.
//   2. Paisagem de estratégia: tempo de cada preset por tipo de circuito.
//   3. Sensibilidade de estratégia: em quantas seeds uma estratégia ótima
//      no carro mais lento inverte a posição contra um carro mais rápido
//      com estratégia ruim (mesma seed → mesmo ruído).
// ============================================================================

import { CALENDARIO } from '../src/data/calendario';
import { EQUIPES_INICIAIS } from '../src/data/equipes';
import { MOTORES_POR_ID } from '../src/data/motores';
import { PILOTOS_POR_ID } from '../src/data/pilotos';
import { simularClassificacao } from '../src/engine/classificacao';
import {
  CUSTO_PIT_STOP,
  FATOR_RITMO_TEMPO,
  PESO_CARRO_CORRIDA,
  PESO_PILOTO_CORRIDA,
} from '../src/engine/constantes';
import { dividirVoltasEmStints, simularCorrida, tempoDoStint } from '../src/engine/corrida';
import { desempenhoCarro } from '../src/engine/desempenho';
import { criarRng, type RNG } from '../src/engine/rng';
import { PRESETS_TATICA } from '../src/engine/taticas';
import { simularTemporada } from '../src/engine/temporada';
import type { Circuito, Tier, TaticaCorrida } from '../src/engine/tipos';

const N = Number(process.argv[2] ?? 200);
const catalogo = { motores: MOTORES_POR_ID, pilotos: PILOTOS_POR_ID };
const TIERS: Tier[] = ['grande', 'media', 'pequena'];

/** RNG sem sorte: entre() devolve o centro do intervalo, chance() nunca dispara. */
function rngNeutro(): RNG {
  return {
    proximo: () => 0.5,
    entre: (min, max) => (min + max) / 2,
    chance: () => false,
    inteiroEntre: (min) => min,
  };
}

const pct = (x: number, total: number) => ((100 * x) / total).toFixed(1).padStart(5) + '%';
const num = (x: number, casas = 1) => x.toFixed(casas);

// ============================================================================
// 1) DISTRIBUIÇÃO POR TIER (N temporadas completas, IA decide as táticas)
// ============================================================================
console.log(`\n=== HARNESS DE BALANCEAMENTO — ${N} temporadas ===`);

const equipesPorId = new Map(EQUIPES_INICIAIS.map((e) => [e.id, e]));
const porTier = Object.fromEntries(
  TIERS.map((t) => [t, { pontos: 0, vitorias: 0, podios: 0, temporadasComPonto: 0, equipes: 0 }])
) as Record<Tier, { pontos: number; vitorias: number; podios: number; temporadasComPonto: number; equipes: number }>;
for (const e of EQUIPES_INICIAIS) porTier[e.tier].equipes++;

let totalCorridas = 0;
for (let seed = 0; seed < N; seed++) {
  const r = simularTemporada(EQUIPES_INICIAIS, CALENDARIO, catalogo, criarRng(seed));
  totalCorridas += r.resultados.length;

  for (const gp of r.resultados) {
    for (const res of gp.corrida.slice(0, 3)) {
      const tier = equipesPorId.get(res.equipeId)!.tier;
      porTier[tier].podios++;
      if (res.posicao === 1) porTier[tier].vitorias++;
    }
  }
  for (const equipe of EQUIPES_INICIAIS) {
    const pts = r.campeonatoConstrutores[equipe.id] ?? 0;
    porTier[equipe.tier].pontos += pts;
    if (pts >= 1) porTier[equipe.tier].temporadasComPonto++;
  }
}

console.log('\nTier      | pts médios/equipe/temp | % vitórias | % pódios | % temporadas c/ ≥1 ponto');
console.log('----------|------------------------|------------|----------|-------------------------');
for (const tier of TIERS) {
  const t = porTier[tier];
  console.log(
    `${tier.padEnd(9)} | ${num(t.pontos / (t.equipes * N)).padStart(22)} | ${pct(t.vitorias, totalCorridas).padStart(10)} | ${pct(t.podios, 3 * totalCorridas).padStart(8)} | ${pct(t.temporadasComPonto, t.equipes * N).padStart(24)}`
  );
}
// Contagens absolutas — eventos raros somem no arredondamento dos %
console.log(
  `\nEm ${totalCorridas} corridas: vitórias media=${porTier.media.vitorias} pequena=${porTier.pequena.vitorias} | pódios media=${porTier.media.podios} pequena=${porTier.pequena.podios}`
);

// ============================================================================
// 2) PAISAGEM DE ESTRATÉGIA (carro de referência, sem ruído)
// ============================================================================
console.log('\n=== Paisagem de estratégia (tempo relativo por preset, sem ruído) ===');

/** Tempo total de corrida de um preset para um carro de referência, sem ruído. */
function tempoDoPreset(
  preset: Omit<TaticaCorrida, 'pilotoId'>,
  circuito: Circuito,
  ritmoBase: number
): number {
  const voltas = dividirVoltasEmStints(circuito.voltas, preset.stints.length);
  const stints = preset.stints.reduce(
    (soma, pneu, i) => soma + tempoDoStint(ritmoBase, pneu, voltas[i], circuito.desgastePneu, rngNeutro()),
    0
  );
  return stints + preset.paradas * CUSTO_PIT_STOP;
}

const nomePreset = (p: Omit<TaticaCorrida, 'pilotoId'>) => `${p.paradas}p ${p.stints.join('/')}`;
const circuitosRef = [
  CALENDARIO.find((c) => c.id === 'cir-costa-dourada')!, // desgaste baixo (0.7)
  CALENDARIO.find((c) => c.id === 'cir-lagoa-azul')!,    // desgaste normal (1.0)
  CALENDARIO.find((c) => c.id === 'cir-deserto-rubro')!, // desgaste alto (1.4)
];

const RITMO_REF = 75; // nível de ritmo não muda o ranking dos presets (efeito aditivo)
console.log(`\n${'preset'.padEnd(24)}${circuitosRef.map((c) => `desg ${c.desgastePneu} (${c.voltas}v)`.padStart(18)).join('')}`);
const temposPorCircuito: number[][] = circuitosRef.map(() => []);
for (const preset of PRESETS_TATICA) {
  const tempos = circuitosRef.map((c, i) => {
    const t = tempoDoPreset(preset, c, RITMO_REF);
    temposPorCircuito[i].push(t);
    return t;
  });
  console.log(`${nomePreset(preset).padEnd(24)}${tempos.map((t) => num(t).padStart(18)).join('')}`);
}
for (const [i, c] of circuitosRef.entries()) {
  const min = Math.min(...temposPorCircuito[i]);
  const max = Math.max(...temposPorCircuito[i]);
  console.log(`desg ${c.desgastePneu}: melhor→pior preset = ${num(max - min)}s`);
}

// Gap de ritmo puro entre melhor e pior carro do grid (por corrida de 50 voltas)
const ritmosCarros = EQUIPES_INICIAIS.flatMap((e) =>
  e.pilotos.map((c) => {
    const motor = catalogo.motores[e.contratoMotor.motorId];
    const piloto = catalogo.pilotos[c.pilotoId];
    return {
      pilotoId: piloto.id,
      equipeId: e.id,
      nome: piloto.nome,
      ritmo: PESO_CARRO_CORRIDA * desempenhoCarro(motor, e.nivelChassi) + PESO_PILOTO_CORRIDA * piloto.corrida,
    };
  })
).sort((a, b) => b.ritmo - a.ritmo);
const gapExtremos = (ritmosCarros[0].ritmo - ritmosCarros.at(-1)!.ritmo) * FATOR_RITMO_TEMPO * 50;
console.log(`\nGap de ritmo melhor→pior carro: ${num(gapExtremos)}s por corrida de 50 voltas`);

// ============================================================================
// 3) SENSIBILIDADE DE ESTRATÉGIA (2º vs 3º carro, circuito de desgaste alto)
// ============================================================================
const circuitoAlto = CALENDARIO.find((c) => c.id === 'cir-deserto-rubro')!;
const presetsOrdenados = [...PRESETS_TATICA].sort(
  (a, b) => tempoDoPreset(a, circuitoAlto, RITMO_REF) - tempoDoPreset(b, circuitoAlto, RITMO_REF)
);
const presetOtimo = presetsOrdenados[0];
const presetRuim = presetsOrdenados.at(-1)!;

const maisRapido = ritmosCarros[1]; // 2º melhor carro
const maisLento = ritmosCarros[2];  // 3º melhor carro
const gapPar = (maisRapido.ritmo - maisLento.ritmo) * FATOR_RITMO_TEMPO * circuitoAlto.voltas;

console.log(`\n=== Sensibilidade de estratégia — ${circuitoAlto.nome} ===`);
console.log(`Mais rápido: ${maisRapido.nome} | mais lento: ${maisLento.nome} (gap de ritmo puro: ${num(gapPar)}s)`);
console.log(`Estratégia ótima: ${nomePreset(presetOtimo)} | ruim: ${nomePreset(presetRuim)} (Δ ${num(tempoDoPreset(presetRuim, circuitoAlto, RITMO_REF) - tempoDoPreset(presetOtimo, circuitoAlto, RITMO_REF))}s)`);

function contarInversoes(presetDoMaisRapido: Omit<TaticaCorrida, 'pilotoId'>): { inversoes: number; validas: number } {
  let inversoes = 0;
  let validas = 0;
  for (let seed = 0; seed < N; seed++) {
    // Táticas fixas (sem RNG da IA) para o consumo de RNG ser idêntico
    // entre cenários: mesmo seed → mesmo ruído volta a volta.
    const taticas: Record<string, TaticaCorrida> = {};
    for (const carro of ritmosCarros) {
      taticas[carro.pilotoId] = { pilotoId: carro.pilotoId, ...presetOtimo };
    }
    taticas[maisRapido.pilotoId] = { pilotoId: maisRapido.pilotoId, ...presetDoMaisRapido };

    const rng = criarRng(1_000_000 + seed);
    const grid = simularClassificacao(EQUIPES_INICIAIS, catalogo, rng);
    const resultado = simularCorrida(EQUIPES_INICIAIS, grid, taticas, circuitoAlto, catalogo, rng);

    const resRapido = resultado.find((r) => r.pilotoId === maisRapido.pilotoId)!;
    const resLento = resultado.find((r) => r.pilotoId === maisLento.pilotoId)!;
    if (resRapido.dnf || resLento.dnf) continue; // isola o efeito da estratégia
    validas++;
    if (resLento.posicao < resRapido.posicao) inversoes++;
  }
  return { inversoes, validas };
}

const comEstrategia = contarInversoes(presetRuim);   // rápido com estratégia ruim
const soRitmo = contarInversoes(presetOtimo);        // ambos com a ótima (baseline)
console.log(`Inversões só por ritmo/ruído (ambos na ótima): ${pct(soRitmo.inversoes, soRitmo.validas)} (${soRitmo.inversoes}/${soRitmo.validas})`);
console.log(`Inversões com estratégia (rápido na ruim):     ${pct(comEstrategia.inversoes, comEstrategia.validas)} (${comEstrategia.inversoes}/${comEstrategia.validas})`);
console.log();
