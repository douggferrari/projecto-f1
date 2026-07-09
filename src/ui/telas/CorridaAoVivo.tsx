// ============================================================================
// Corrida ao vivo (~2min): playback da timeline volta a volta com posições,
// gaps, pneus, pit stops e abandonos. Velocidades 1×/2×/4×/8× e Pular.
// O resultado exibido é EXATAMENTE o que rodarCorrida() commita no fim —
// preverCorridaAoVivo usa a mesma seed e o mesmo caminho de código.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { preverCorridaAoVivo } from '../../engine/corridaAoVivo';
import { nomePiloto } from '../nomes';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarGap, formatarTempoVolta } from '../formatar';
import { Botao, Card, PneuChip } from '../componentes';
import { ClimaBadge } from './FimDeSemana';

const DURACAO_ALVO_MS = 120_000;

export function CorridaAoVivo() {
  const { estado, rodarCorrida } = useJogo();

  const transmissao = useMemo(() => preverCorridaAoVivo(estado!, CATALOGO), [estado]);
  const { voltasTotais, quadros, eventos } = transmissao;

  const [largou, setLargou] = useState(false);
  const [volta, setVolta] = useState(0); // 0 = pré-largada
  const [velocidade, setVelocidade] = useState(1);
  const terminou = volta >= voltasTotais;

  // Avanço volta a volta
  useEffect(() => {
    if (!largou || terminou) return;
    const intervalo = DURACAO_ALVO_MS / voltasTotais / velocidade;
    const timer = setInterval(() => setVolta((v) => Math.min(voltasTotais, v + 1)), intervalo);
    return () => clearInterval(timer);
  }, [largou, terminou, velocidade, voltasTotais]);

  // Bandeirada: pausa breve no resultado e commita
  useEffect(() => {
    if (!largou || !terminou) return;
    const timer = setTimeout(rodarCorrida, 2000);
    return () => clearTimeout(timer);
  }, [largou, terminou, rodarCorrida]);

  // ------------------------- Pré-largada -------------------------
  if (!largou) {
    const taticas = estado!.taticasJogador ?? [];
    return (
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-sm text-mudo">
            <p className="rotulo mb-1">Sua estratégia</p>
            {taticas.map((t) => (
              <span key={t.pilotoId} className="flex items-center gap-2">
                {nomePiloto(t.pilotoId)}: {t.paradas} parada{t.paradas > 1 ? 's' : ''}
                {t.stints.map((p, i) => (
                  <PneuChip key={i} pneu={p} />
                ))}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ClimaBadge clima={transmissao.clima} />
            <Botao variante="secundario" onClick={rodarCorrida}>Pular direto para o resultado</Botao>
            <Botao onClick={() => { setLargou(true); setVolta(1); }}>Largada! (~2 min ao vivo)</Botao>
          </div>
        </div>
        {transmissao.clima === 'chuva' && (
          <p className="mt-3 rounded border border-sky-400/40 bg-sky-400/10 p-2 text-sm text-sky-300">
            🌧 Pista molhada: piloto vale mais que carro, e batidas são bem mais prováveis.
          </p>
        )}
      </Card>
    );
  }

  // ------------------------- Ao vivo -------------------------
  const quadro = quadros[Math.max(0, volta - 1)];
  const quadroAnterior = volta > 1 ? quadros[volta - 2] : null;
  const posicaoAnterior = new Map(
    (quadroAnterior?.carros ?? []).map((c) => [c.pilotoId, c.posicao])
  );
  const eventosAteAgora = eventos.filter((e) => e.volta <= volta).slice(-5).reverse();

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
      <Card titulo={terminou ? 'Bandeirada final' : 'Corrida — ao vivo'}>
        {/* Progresso + controles */}
        <div className="mb-3 flex items-center gap-3">
          <span className="num text-sm font-bold">
            Volta {volta}/{voltasTotais}
          </span>
          {transmissao.clima === 'chuva' && <span title="corrida de chuva">🌧</span>}
          {transmissao.safetyCars.includes(volta) && (
            <span className="rounded bg-alerta/20 px-2 py-0.5 text-xs font-bold text-alerta">
              SAFETY CAR
            </span>
          )}
          <div className="h-1.5 flex-1 overflow-hidden rounded bg-superficie-2">
            <div
              className="h-full bg-acento transition-[width] duration-200"
              style={{ width: `${(volta / voltasTotais) * 100}%` }}
            />
          </div>
          {[1, 2, 4, 8].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVelocidade(v)}
              className={`rounded border px-2 py-0.5 text-xs font-semibold ${
                velocidade === v ? 'border-acento text-acento' : 'border-borda text-mudo hover:text-texto'
              }`}
            >
              {v}×
            </button>
          ))}
          <Botao variante="secundario" onClick={rodarCorrida}>Pular</Botao>
        </div>

        {terminou && (
          <p className="mb-2 text-sm text-positivo">
            Corrida encerrada — aplicando o resultado ao campeonato...
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="pb-2 pr-2">Pos</th>
                <th className="pb-2 pr-2 text-center">Δ</th>
                <th className="pb-2 pr-3">Piloto</th>
                <th className="pb-2 pr-3">Equipe</th>
                <th className="pb-2 pr-2 text-center">Pneu</th>
                <th className="pb-2 text-right">Gap</th>
              </tr>
            </thead>
            <tbody>
              {quadro.carros.map((carro) => {
                const ehJogador = carro.equipeId === estado!.equipeJogadorId;
                const anterior = posicaoAnterior.get(carro.pilotoId);
                const delta = anterior !== undefined ? anterior - carro.posicao : 0;
                return (
                  <tr
                    key={carro.pilotoId}
                    className={`border-t border-borda/60 ${ehJogador ? 'bg-acento/10' : ''} ${
                      carro.foraDaCorrida ? 'opacity-45' : ''
                    }`}
                  >
                    <td className="num w-10 py-1 pr-2">{carro.posicao}</td>
                    <td className="w-8 py-1 pr-2 text-center">
                      {delta > 0 && <span className="text-positivo">▲{delta}</span>}
                      {delta < 0 && <span className="text-negativo">▼{-delta}</span>}
                      {delta === 0 && <span className="text-mudo/40">·</span>}
                    </td>
                    <td className="py-1 pr-3 font-medium">
                      {nomePiloto(carro.pilotoId)}
                      {carro.pitNestaVolta && (
                        <span className="ml-2 rounded bg-alerta/20 px-1.5 py-0.5 text-[10px] font-bold text-alerta">PIT</span>
                      )}
                    </td>
                    <td className="py-1 pr-3 text-mudo">{nomeEquipe(carro.equipeId)}</td>
                    <td className="py-1 pr-2 text-center">
                      {carro.pneu ? <PneuChip pneu={carro.pneu} /> : null}
                    </td>
                    <td className="num py-1 text-right text-mudo">
                      {carro.foraDaCorrida ? (
                        <span className="text-negativo">
                          DNF{carro.motivoDnf ? ` (${carro.motivoDnf})` : ''}
                        </span>
                      ) : carro.posicao === 1 ? (
                        'líder'
                      ) : (
                        formatarGap(carro.gapLider, 1)
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Feed de eventos */}
      <Card titulo="Rádio da equipe" className="lg:sticky lg:top-4 lg:self-start">
        {eventosAteAgora.length === 0 ? (
          <p className="text-sm text-mudo">Corrida limpa até aqui.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {eventosAteAgora.map((evento, i) => (
              <li key={`${evento.pilotoId ?? 'pista'}-${evento.volta}-${i}`} className="flex gap-2">
                <span className="num shrink-0 text-xs text-mudo">V{evento.volta}</span>
                {evento.tipo === 'safety-car' ? (
                  <span className="font-semibold text-alerta">
                    Safety car na pista — pelotão comprimido!
                  </span>
                ) : (
                  <span>
                    {nomePiloto(evento.pilotoId!)}{' '}
                    {evento.tipo === 'pit' ? (
                      <span className="text-alerta">faz pit stop</span>
                    ) : (
                      <span className="text-negativo">abandona a corrida</span>
                    )}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {terminou && transmissao.voltaMaisRapida && (
          <p className="mt-3 border-t border-borda pt-2 text-sm">
            <span className="text-acento">Volta mais rápida:</span>{' '}
            {nomePiloto(transmissao.voltaMaisRapida.pilotoId)}{' '}
            <span className="num text-mudo">{formatarTempoVolta(transmissao.voltaMaisRapida.tempo)}</span>
          </p>
        )}
      </Card>
    </div>
  );
}

function nomeEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.nome ?? equipeId;
}
