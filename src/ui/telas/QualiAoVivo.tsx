// ============================================================================
// Classificação ao vivo (~30s): os tempos dos 20 carros são revelados um a
// um em ordem embaralhada e a tabela se reordena a cada volta marcada.
// O grid final é o MESMO que rodarClassificacao() commita (mesma seed) —
// a animação é só playback. Botões de acelerar e pular.
// ============================================================================

import { useEffect, useMemo, useState } from 'react';
import { preverClassificacao } from '../../engine/carreira';
import { criarRng, derivarSeed } from '../../engine/rng';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarGap, formatarTempoVolta } from '../formatar';
import { nomePiloto } from '../nomes';
import { Botao, Card } from '../componentes';

const DURACAO_ALVO_MS = 30_000;

export function QualiAoVivo() {
  const { estado, rodarClassificacao } = useJogo();

  // Grid final (determinístico) e ordem de revelação (RNG de apresentação)
  const grid = useMemo(() => preverClassificacao(estado!, CATALOGO), [estado]);
  const ordemRevelacao = useMemo(() => {
    const rng = criarRng(derivarSeed(estado!.seed, estado!.ano, estado!.gpAtual, 3));
    const indices = grid.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = rng.inteiroEntre(0, i);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [grid, estado]);

  const [iniciada, setIniciada] = useState(false);
  const [revelados, setRevelados] = useState(0);
  const [velocidade, setVelocidade] = useState(1);
  const total = grid.length;
  const concluida = revelados >= total;

  // Avanço da sessão: um carro marca tempo a cada tick
  useEffect(() => {
    if (!iniciada || concluida) return;
    const intervalo = DURACAO_ALVO_MS / total / velocidade;
    const timer = setInterval(() => setRevelados((r) => Math.min(total, r + 1)), intervalo);
    return () => clearInterval(timer);
  }, [iniciada, concluida, velocidade, total]);

  // Sessão encerrada: pequena pausa e commita o grid
  useEffect(() => {
    if (!iniciada || !concluida) return;
    const timer = setTimeout(rodarClassificacao, 1200);
    return () => clearTimeout(timer);
  }, [iniciada, concluida, rodarClassificacao]);

  if (!iniciada) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <p className="text-mudo">Sessão de classificação: os tempos saem ao vivo (~30s).</p>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={rodarClassificacao}>Pular direto para o grid</Botao>
            <Botao onClick={() => setIniciada(true)}>Iniciar classificação</Botao>
          </div>
        </div>
      </Card>
    );
  }

  const indicesRevelados = new Set(ordemRevelacao.slice(0, revelados));
  const ultimoRevelado = revelados > 0 ? ordemRevelacao[revelados - 1] : -1;
  const tabela = grid.filter((_, i) => indicesRevelados.has(i));
  const pole = tabela[0];

  return (
    <Card titulo="Classificação — ao vivo">
      {/* Controles + progresso */}
      <div className="mb-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-superficie-2">
          <div
            className="h-full bg-acento transition-[width] duration-300"
            style={{ width: `${(revelados / total) * 100}%` }}
          />
        </div>
        <span className="num text-xs text-mudo">{revelados}/{total}</span>
        {[1, 2, 4].map((v) => (
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
        <Botao variante="secundario" onClick={rodarClassificacao}>Pular</Botao>
      </div>

      {concluida && <p className="mb-2 text-sm text-positivo">Sessão encerrada — grid definido.</p>}

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
            {tabela.map((linha) => {
              const ehJogador = linha.equipeId === estado!.equipeJogadorId;
              const recemMarcado = grid.indexOf(linha) === ultimoRevelado;
              return (
                <tr
                  key={linha.pilotoId}
                  className={`border-t border-borda/60 ${ehJogador ? 'bg-acento/10' : ''} ${
                    recemMarcado && !concluida ? 'bg-superficie-2' : ''
                  }`}
                >
                  <td className="num w-10 py-1 pr-3">{tabela.indexOf(linha) + 1}</td>
                  <td className="py-1 pr-3 font-medium">
                    {nomePiloto(linha.pilotoId)}
                    {recemMarcado && !concluida && <span className="ml-2 text-xs text-acento">● volta marcada</span>}
                  </td>
                  <td className="py-1 pr-3 text-mudo">{nomeEquipe(linha.equipeId)}</td>
                  <td className="num py-1 pr-3 text-right">{formatarTempoVolta(linha.tempoVolta)}</td>
                  <td className="num py-1 text-right text-mudo">
                    {linha.pilotoId === pole.pilotoId ? '—' : formatarGap(linha.tempoVolta - pole.tempoVolta)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function nomeEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.nome ?? equipeId;
}
