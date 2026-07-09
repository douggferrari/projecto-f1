// ============================================================================
// Fim de semana de GP: classificação ao vivo (~30s) → sala de estratégia →
// corrida ao vivo (~2min), com botões de acelerar/pular em ambas.
// ============================================================================

import { useState } from 'react';
import { EVENTOS_ATIVADOS } from '../../engine/constantes';
import { climaDoGP } from '../../engine/eventos';
import { PRESETS_TATICA } from '../../engine/taticas';
import type { Clima, Pneu, ResultadoGP, TaticaCorrida } from '../../engine/tipos';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarGap, formatarTempoCorrida, formatarTempoVolta } from '../formatar';
import { nomePiloto } from '../nomes';
import { Botao, Card, ListaErros, PneuChip } from '../componentes';
import { CorridaAoVivo } from './CorridaAoVivo';
import { QualiAoVivo } from './QualiAoVivo';

/** Badge de previsão do tempo do GP (Fase 5). */
export function ClimaBadge({ clima }: { clima: Clima }) {
  return clima === 'chuva' ? (
    <span className="rounded border border-sky-400/50 bg-sky-400/10 px-2 py-0.5 text-xs font-semibold text-sky-300">
      🌧 Chuva prevista
    </span>
  ) : (
    <span className="rounded border border-borda px-2 py-0.5 text-xs font-semibold text-mudo">
      ☀ Tempo seco
    </span>
  );
}

export function FimDeSemana() {
  const { estado } = useJogo();
  const circuito = CATALOGO.circuitos[estado!.calendario[estado!.gpAtual]];
  const ultimoGP = estado!.historico.at(-1);
  const clima = EVENTOS_ATIVADOS ? climaDoGP(estado!, circuito) : 'seco';

  const passoAtual =
    estado!.fase === 'gp-classificacao' ? 0 : estado!.fase === 'gp-estrategia' ? 1 : 2;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold">{circuito.nome}</h1>
        <span className="text-sm text-mudo">
          Etapa {estado!.gpAtual + 1} de {estado!.calendario.length} · {circuito.voltas} voltas ·
          desgaste de pneu {circuito.desgastePneu.toFixed(2)}×
        </span>
        {EVENTOS_ATIVADOS && <ClimaBadge clima={clima} />}
        {/* Fluxo linear do fim de semana: onde estou, o que vem depois */}
        <ol className="ml-auto flex items-center gap-1 text-xs font-semibold uppercase tracking-wider">
          {['Classificação', 'Estratégia', 'Corrida'].map((passo, i) => (
            <li key={passo} className="flex items-center gap-1">
              {i > 0 && <span className="text-mudo/50">→</span>}
              <span
                className={`rounded px-2 py-1 ${
                  i === passoAtual
                    ? 'bg-acento/15 text-acento'
                    : i < passoAtual
                      ? 'text-positivo'
                      : 'text-mudo/60'
                }`}
              >
                {i < passoAtual ? '✓ ' : ''}{passo}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {estado!.fase === 'gp-classificacao' && <EtapaClassificacao ultimoGP={ultimoGP} />}
      {estado!.fase === 'gp-estrategia' && (
        <EtapaEstrategia desgaste={circuito.desgastePneu} clima={clima} />
      )}
      {estado!.fase === 'gp-corrida' && <EtapaCorrida />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) Classificação (ao vivo — QualiAoVivo.tsx)
// ---------------------------------------------------------------------------

function EtapaClassificacao({ ultimoGP }: { ultimoGP?: ResultadoGP }) {
  return (
    <>
      <QualiAoVivo />
      {ultimoGP && <ResultadoCorridaCard resultado={ultimoGP} titulo={`Resultado — ${CATALOGO.circuitos[ultimoGP.circuitoId].nome}`} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// 2) Sala de estratégia
// ---------------------------------------------------------------------------

function EtapaEstrategia({ desgaste, clima }: { desgaste: number; clima: Clima }) {
  const { estado, definirTaticas, erros } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;

  const [taticas, setTaticas] = useState<[TaticaCorrida, TaticaCorrida]>(() => [
    { pilotoId: jogador.pilotos[0].pilotoId, paradas: 1, stints: ['medium', 'hard'] },
    { pilotoId: jogador.pilotos[1].pilotoId, paradas: 1, stints: ['medium', 'hard'] },
  ]);

  const atualizar = (indice: 0 | 1, tatica: TaticaCorrida) => {
    const novas: [TaticaCorrida, TaticaCorrida] = [...taticas];
    novas[indice] = tatica;
    setTaticas(novas);
  };

  return (
    <>
      <GridCard />
      <ListaErros erros={erros} />
      <div className="grid gap-4 md:grid-cols-2">
        {([0, 1] as const).map((indice) => (
          <EstrategiaPiloto
            key={indice}
            tatica={taticas[indice]}
            onChange={(t) => atualizar(indice, t)}
          />
        ))}
      </div>
      <p className="text-sm text-mudo">
        Desgaste desta pista: {desgaste.toFixed(2)}× — desgaste alto favorece compostos duros
        e pneus frescos; desgaste baixo deixa o soft render mais tempo.
      </p>
      {clima === 'chuva' && (
        <p className="rounded border border-sky-400/40 bg-sky-400/10 p-3 text-sm text-sky-300">
          🌧 Corrida de chuva: a escolha de composto pesa menos, o talento do piloto pesa
          mais e erros ficam bem mais prováveis. Chuva é a chance da zebra — e o risco de
          batida (e da conta do reparo) sobe junto.
        </p>
      )}
      <Botao onClick={() => definirTaticas(taticas)} className="self-start">
        Confirmar estratégia
      </Botao>
    </>
  );
}

function EstrategiaPiloto(props: { tatica: TaticaCorrida; onChange: (t: TaticaCorrida) => void }) {
  const piloto = useJogo.getState().estado!.pilotos[props.tatica.pilotoId];
  const { tatica } = props;

  const setParadas = (paradas: number) => {
    // Ajusta o nº de stints preservando os compostos já escolhidos
    const stints: Pneu[] = Array.from(
      { length: paradas + 1 },
      (_, i) => tatica.stints[i] ?? 'medium'
    );
    props.onChange({ ...tatica, paradas, stints });
  };

  const setStint = (indice: number, pneu: Pneu) => {
    const stints = tatica.stints.map((s, i) => (i === indice ? pneu : s));
    props.onChange({ ...tatica, stints });
  };

  return (
    <Card titulo={piloto.nome}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-mudo">Paradas:</span>
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setParadas(n)}
              className={`rounded border px-3 py-1 font-semibold ${
                tatica.paradas === n ? 'border-acento text-acento' : 'border-borda text-mudo hover:text-texto'
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {tatica.stints.map((pneu, indice) => (
            <div key={indice} className="flex items-center gap-2 text-sm">
              <span className="w-16 text-mudo">Stint {indice + 1}</span>
              {(['soft', 'medium', 'hard'] as Pneu[]).map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  onClick={() => setStint(indice, opcao)}
                  className={`rounded border px-2 py-1 text-xs font-semibold uppercase ${
                    pneu === opcao ? 'border-acento text-texto' : 'border-borda text-mudo hover:text-texto'
                  }`}
                >
                  {opcao}
                </button>
              ))}
              <span className="ml-auto"><PneuChip pneu={pneu} /></span>
            </div>
          ))}
        </div>

        <div>
          <p className="rotulo mb-1.5">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS_TATICA.map((preset, i) => (
              <button
                key={i}
                type="button"
                onClick={() => props.onChange({ pilotoId: tatica.pilotoId, ...structuredClone(preset) })}
                className="flex items-center gap-1 rounded border border-borda px-2 py-1 text-xs text-mudo hover:border-mudo hover:text-texto"
              >
                {preset.paradas}p
                {preset.stints.map((p, j) => (
                  <PneuChip key={j} pneu={p} />
                ))}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3) Corrida (ao vivo — CorridaAoVivo.tsx)
// ---------------------------------------------------------------------------

function EtapaCorrida() {
  return <CorridaAoVivo />;
}

// ---------------------------------------------------------------------------
// Tabelas
// ---------------------------------------------------------------------------

function GridCard() {
  const { estado } = useJogo();
  const grid = estado!.gridAtual;
  if (!grid) return null;
  const polePosition = grid[0];

  return (
    <Card titulo="Grid de largada">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rotulo text-left">
              <th className="pb-2 pr-3">Pos</th>
              <th className="pb-2 pr-3">Piloto</th>
              <th className="pb-2 pr-3">Equipe</th>
              <th className="pb-2 pr-3 text-right">Tempo</th>
              <th className="pb-2 text-right">Gap</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((linha) => (
              <LinhaTabela key={linha.pilotoId} equipeId={linha.equipeId}>
                <td className="num py-1 pr-3">{linha.posicao}</td>
                <td className="py-1 pr-3 font-medium">{nomePiloto(linha.pilotoId)}</td>
                <td className="py-1 pr-3 text-mudo">{nomeEquipe(linha.equipeId)}</td>
                <td className="num py-1 pr-3 text-right">{formatarTempoVolta(linha.tempoVolta)}</td>
                <td className="num py-1 text-right text-mudo">
                  {linha.posicao === 1 ? '—' : formatarGap(linha.tempoVolta - polePosition.tempoVolta)}
                </td>
              </LinhaTabela>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ResultadoCorridaCard({ resultado, titulo }: { resultado: ResultadoGP; titulo: string }) {
  const vencedor = resultado.corrida[0];
  const vmr = resultado.voltaMaisRapida;
  return (
    <Card titulo={titulo}>
      {(resultado.clima === 'chuva' || (resultado.safetyCars?.length ?? 0) > 0 || vmr) && (
        <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mudo">
          {resultado.clima === 'chuva' && <span className="text-sky-300">🌧 corrida de chuva</span>}
          {(resultado.safetyCars?.length ?? 0) > 0 && (
            <span className="text-alerta">
              safety car: volta{resultado.safetyCars!.length > 1 ? 's' : ''} {resultado.safetyCars!.join(', ')}
            </span>
          )}
          {vmr && (
            <span>
              volta mais rápida: <span className="text-acento">{nomePiloto(vmr.pilotoId)}</span>{' '}
              <span className="num">{formatarTempoVolta(vmr.tempo)}</span>
            </span>
          )}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="rotulo text-left">
              <th className="pb-2 pr-3">Pos</th>
              <th className="pb-2 pr-3">Piloto</th>
              <th className="pb-2 pr-3">Equipe</th>
              <th className="pb-2 pr-3 text-right">Tempo / Gap</th>
              <th className="pb-2 text-right">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {resultado.corrida.map((linha) => (
              <LinhaTabela key={linha.pilotoId} equipeId={linha.equipeId}>
                <td className="num py-1 pr-3">{linha.posicao}</td>
                <td className="py-1 pr-3 font-medium">{nomePiloto(linha.pilotoId)}</td>
                <td className="py-1 pr-3 text-mudo">{nomeEquipe(linha.equipeId)}</td>
                <td className="num py-1 pr-3 text-right">
                  {linha.dnf ? (
                    <span className="text-negativo">DNF ({linha.motivoDnf === 'quebra' ? 'quebra' : 'erro'})</span>
                  ) : linha.posicao === 1 ? (
                    formatarTempoCorrida(linha.tempoTotal)
                  ) : (
                    formatarGap(linha.tempoTotal - vencedor.tempoTotal, 1)
                  )}
                </td>
                <td className="num py-1 text-right font-semibold">{linha.pontos > 0 ? linha.pontos : ''}</td>
              </LinhaTabela>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** Linha de tabela com destaque para os carros do jogador. */
function LinhaTabela({ equipeId, children }: { equipeId: string; children: React.ReactNode }) {
  const { estado } = useJogo();
  const ehJogador = equipeId === estado!.equipeJogadorId;
  return (
    <tr className={`border-t border-borda/60 ${ehJogador ? 'bg-acento/10' : ''}`}>{children}</tr>
  );
}

function nomeEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.nome ?? equipeId;
}
