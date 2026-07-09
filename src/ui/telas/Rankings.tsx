// ============================================================================
// Rankings — Fase 6. Três leituras de longo prazo, fora da tabela do ano:
//   1. Fornecedores de motor: rating atual + delta de posições vs. ano
//      anterior + dica de tendência (retrovisor, não bola de cristal).
//   2. Chefes: reputação, selo de status por títulos e histórico expansível.
//   3. Equipes por prestígio: quem está avançando entre as temporadas.
// ============================================================================

import { useState } from 'react';
import { rankingChefes } from '../../engine/chefes';
import { deltaRankingMotor, rankingMotores } from '../../engine/motorCarreira';
import { useJogo } from '../../state/store';
import { nomeEquipe } from '../nomes';
import { Card, CorEquipe, Estrelas, StatusChefeBadge, TendenciaMotorBadge } from '../componentes';

export function Rankings() {
  const { estado } = useJogo();
  const [chefeAberto, setChefeAberto] = useState<string | null>(null);

  const motores = estado!.motores;
  const chefes = rankingChefes(estado!.chefes);
  const equipesPorPrestigio = [...estado!.equipes].sort((a, b) => b.prestigio - a.prestigio);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ------------------- 1. Fornecedores de motor ------------------- */}
      <Card titulo="Fornecedores de motor — rating atual">
        <table className="w-full text-sm">
          <thead>
            <tr className="rotulo text-left">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-3">Fornecedor</th>
              <th className="pb-2 pr-3 text-center">vs. ano passado</th>
              <th className="pb-2 pr-3 text-right">Potência</th>
              <th className="pb-2 pr-3 text-right">Confiab.</th>
              <th className="pb-2 text-center">Tendência</th>
            </tr>
          </thead>
          <tbody>
            {rankingMotores(motores).map((id, i) => {
              const motor = motores[id];
              const delta = deltaRankingMotor(motores, id);
              return (
                <tr key={id} className="border-t border-borda/60">
                  <td className="num w-8 py-1.5 pr-2">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{motor.nome}</td>
                  <td className="py-1.5 pr-3 text-center text-xs">
                    {delta === null || delta === 0 ? (
                      <span className="text-mudo/60">▬</span>
                    ) : delta > 0 ? (
                      <span className="text-positivo">▲ {delta}</span>
                    ) : (
                      <span className="text-negativo">▼ {-delta}</span>
                    )}
                  </td>
                  <td className="num py-1.5 pr-3 text-right font-semibold">{motor.potencia}</td>
                  <td className="num py-1.5 pr-3 text-right text-mudo">{motor.confiabilidade}</td>
                  <td className="py-1.5 text-center"><TendenciaMotorBadge motor={motor} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-mudo">
          Os ratings evoluem a cada temporada. A tendência é o retrovisor dos últimos anos —
          o futuro de um contrato longo continua sendo uma aposta.
        </p>
      </Card>

      {/* ------------------- 3. Equipes por prestígio ------------------- */}
      <Card titulo="Equipes por prestígio">
        <table className="w-full text-sm">
          <tbody>
            {equipesPorPrestigio.map((equipe, i) => {
              const historico = equipe.historicoPrestigio ?? [];
              const anterior = historico.at(-2)?.prestigio ?? historico.at(-1)?.prestigio;
              const delta = anterior !== undefined ? equipe.prestigio - anterior : 0;
              return (
                <tr key={equipe.id} className={`border-t border-borda/60 ${equipe.ehJogador ? 'bg-acento/10' : ''}`}>
                  <td className="num w-8 py-1.5 pr-2">{i + 1}</td>
                  <td className="py-1.5 pr-3">
                    <span className="flex items-center gap-2 font-medium">
                      <CorEquipe cor={equipe.corPrimaria} />
                      {equipe.nome}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3"><Estrelas valor={equipe.prestigio} /></td>
                  <td className="num py-1.5 pr-3 text-right">{Math.round(equipe.prestigio)}</td>
                  <td className="py-1.5 text-right text-xs">
                    {delta > 0.5 ? (
                      <span className="text-positivo">▲ subindo</span>
                    ) : delta < -0.5 ? (
                      <span className="text-negativo">▼ caindo</span>
                    ) : (
                      <span className="text-mudo/60">▬</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-mudo">
          Diferente da tabela do campeonato: aqui é a régua de longo prazo — se a sua equipe
          está virando um projeto cobiçado ou perdendo relevância.
        </p>
      </Card>

      {/* ------------------- 2. Chefes ------------------- */}
      <Card titulo="Chefes de equipe — reputação e legado" className="lg:col-span-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="rotulo text-left">
              <th className="pb-2 pr-2">#</th>
              <th className="pb-2 pr-3">Chefe</th>
              <th className="pb-2 pr-3">Equipe</th>
              <th className="pb-2 pr-3">Status</th>
              <th className="pb-2 pr-3 text-right">Reputação</th>
              <th className="pb-2 text-right">Histórico</th>
            </tr>
          </thead>
          <tbody>
            {chefes.map((chefe, i) => {
              const equipe = estado!.equipes.find((e) => e.chefeId === chefe.id);
              const ehJogador = equipe?.ehJogador ?? false;
              const aberto = chefeAberto === chefe.id;
              return [
                <tr key={chefe.id} className={`border-t border-borda/60 ${ehJogador ? 'bg-acento/10' : ''}`}>
                  <td className="num w-8 py-1.5 pr-2">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{chefe.nome}{ehJogador ? ' (você)' : ''}</td>
                  <td className="py-1.5 pr-3 text-mudo">
                    {equipe ? (
                      <span className="flex items-center gap-1.5">
                        <CorEquipe cor={equipe.corPrimaria} />
                        {equipe.nome}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-1.5 pr-3"><StatusChefeBadge campeonatos={chefe.campeonatosVencidos} /></td>
                  <td className="num py-1.5 pr-3 text-right font-semibold">{Math.round(chefe.reputacao)}</td>
                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => setChefeAberto(aberto ? null : chefe.id)}
                      className="text-xs text-acento hover:underline"
                      disabled={chefe.historico.length === 0}
                    >
                      {chefe.historico.length === 0 ? '—' : aberto ? 'fechar' : `${chefe.historico.length} temporada(s)`}
                    </button>
                  </td>
                </tr>,
                aberto && (
                  <tr key={`${chefe.id}-historico`} className="bg-superficie-2/50">
                    <td />
                    <td colSpan={5} className="px-2 py-2">
                      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
                        {[...chefe.historico].reverse().map((t) => (
                          <li key={t.ano} className="flex items-center gap-1.5">
                            <span className="num text-mudo">{t.ano}</span>
                            <span className={`num font-semibold ${t.campeao ? 'text-alerta' : ''}`}>
                              P{t.posicaoConstrutores}{t.campeao ? ' 🏆' : ''}
                            </span>
                            <span className="text-mudo">{nomeEquipe(t.equipeId)}</span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
