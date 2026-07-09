// ============================================================================
// Mercado de pilotos — Fase 4.
// Lista todo o grid + pilotos livres com idade, categoria, fase de carreira,
// reputação e salário exigido. Permite ofertar a pilotos CONTRATADOS de
// outras equipes (poach): rescisão paga agora, piloto chega no ano seguinte.
// Pilotos livres são contratados nos assentos vagos, no Escritório.
// ============================================================================

import { useMemo, useState } from 'react';
import { anosRestantes } from '../../engine/contratos';
import { equipeDoPiloto, interessePiloto, validarPoach } from '../../engine/mercado';
import { overallAtual, salarioExigido } from '../../engine/pilotoCarreira';
import type { Piloto } from '../../engine/tipos';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarDinheiro } from '../formatar';
import { nomeEquipe } from '../nomes';
import { Botao, Card, CategoriaBadge, CorEquipe, FaseBadge } from '../componentes';

export function Mercado() {
  const { estado, fazerPoach, ultimaDecisaoMercado } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;

  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [fatorSalario, setFatorSalario] = useState(1.2);
  const [duracao, setDuracao] = useState(2);
  const [slot, setSlot] = useState<0 | 1>(0);

  const pilotos = useMemo(
    () =>
      Object.values(estado!.pilotos)
        .filter((p) => !p.aposentado)
        .sort((a, b) => overallAtual(b) - overallAtual(a)),
    [estado]
  );

  const alvo = selecionado ? estado!.pilotos[selecionado] : null;
  const equipeDoAlvo = alvo ? equipeDoPiloto(estado!, alvo.id) : undefined;
  const podePoach = alvo && equipeDoAlvo && !equipeDoAlvo.ehJogador;
  const validacao = podePoach ? validarPoach(estado!, alvo.id, slot) : null;
  const oferta = alvo
    ? { pilotoId: alvo.id, salarioAnual: Math.round((salarioExigido(alvo) * fatorSalario) / 100_000) * 100_000, duracaoAnos: duracao }
    : null;
  // Prévia do interesse (a mesma função que decide de verdade) — a marca
  // do patrocinador do jogador entra na conta (Fase 6)
  const marcaDoJogador = CATALOGO.patrocinadores[jogador.patrocinadorId];
  const previa = alvo && oferta
    ? interessePiloto(alvo, jogador, oferta, equipeDoAlvo, marcaDoJogador)
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card titulo={`Mercado de pilotos — ${pilotos.length} em atividade`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rotulo text-left">
                <th className="pb-2 pr-3">Piloto</th>
                <th className="pb-2 pr-3">Idade</th>
                <th className="pb-2 pr-3">Categoria</th>
                <th className="pb-2 pr-3">Fase</th>
                <th className="pb-2 pr-3 text-right">Reputação</th>
                <th className="pb-2 pr-3 text-right">Exige</th>
                <th className="pb-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pilotos.map((piloto) => {
                const equipe = equipeDoPiloto(estado!, piloto.id);
                const livre = !equipe;
                return (
                  <tr
                    key={piloto.id}
                    onClick={() => setSelecionado(piloto.id)}
                    className={`cursor-pointer border-t border-borda/60 hover:bg-superficie-2/60 ${
                      selecionado === piloto.id ? 'bg-superficie-2' : ''
                    } ${equipe?.ehJogador ? 'bg-acento/10' : ''}`}
                  >
                    <td className="py-1.5 pr-3 font-medium">{piloto.nome}</td>
                    <td className="num py-1.5 pr-3">{piloto.idade}</td>
                    <td className="py-1.5 pr-3"><CategoriaBadge piloto={piloto} /></td>
                    <td className="py-1.5 pr-3"><FaseBadge idade={piloto.idade} /></td>
                    <td className="num py-1.5 pr-3 text-right">{Math.round(piloto.reputacao)}</td>
                    <td className="num py-1.5 pr-3 text-right">{formatarDinheiro(salarioExigido(piloto))}</td>
                    <td className="py-1.5">
                      {livre ? (
                        <span className="text-positivo">livre</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-mudo">
                          <CorEquipe cor={equipe.corPrimaria} />
                          {equipe.nome}
                          <span className="num">
                            ({anosRestantes(equipe.pilotos.find((c) => c.pilotoId === piloto.id)!, estado!.ano)}a)
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Painel de oferta */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card titulo="Fazer oferta">
          {!alvo ? (
            <p className="text-sm text-mudo">
              Selecione um piloto na lista. Pilotos <span className="text-positivo">livres</span> são
              contratados no Escritório (assentos vagos); pilotos de outras equipes podem ser
              roubados com rescisão — chegam na temporada seguinte.
            </p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="font-semibold">{alvo.nome} <span className="num text-mudo">{alvo.idade} anos</span></p>
                <p className="mt-1 flex items-center gap-2 text-xs">
                  <CategoriaBadge piloto={alvo} />
                  <FaseBadge idade={alvo.idade} />
                </p>
              </div>

              <HistoricoPiloto piloto={alvo} />

              {equipeDoAlvo?.ehJogador ? (
                <p className="text-mudo">Já é da sua equipe.</p>
              ) : !equipeDoAlvo ? (
                <PreviaLivre alvo={alvo} />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-mudo">Salário da oferta</span>
                    <span className="num font-semibold">{formatarDinheiro(oferta!.salarioAnual)}/ano</span>
                  </div>
                  <input
                    type="range" min={0.8} max={2.5} step={0.1} value={fatorSalario}
                    onChange={(e) => setFatorSalario(Number(e.target.value))}
                    className="w-full accent-(--color-acento)"
                    aria-label="Fator do salário sobre o exigido"
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-mudo">Duração:</span>
                    {[1, 2, 3, 4].map((anos) => (
                      <button
                        key={anos} type="button" onClick={() => setDuracao(anos)}
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${duracao === anos ? 'border-acento text-acento' : 'border-borda text-mudo'}`}
                      >
                        {anos}a
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-mudo">Assento que vaga:</span>
                    {([0, 1] as const).map((s) => (
                      <button
                        key={s} type="button" onClick={() => setSlot(s)}
                        className={`rounded border px-2 py-0.5 text-xs font-semibold ${slot === s ? 'border-acento text-acento' : 'border-borda text-mudo'}`}
                      >
                        {estado!.pilotos[jogador.pilotos[s].pilotoId].nome.split(' ').at(-1)}
                      </button>
                    ))}
                  </div>

                  {validacao && !validacao.valido ? (
                    <p className="text-negativo">{validacao.erro}</p>
                  ) : (
                    <>
                      <p className="text-mudo">
                        Rescisão a pagar: <span className="num text-texto">{formatarDinheiro(validacao?.custoRescisao ?? 0)}</span>
                        {' '}(pesa no saldo deste ano; o piloto chega em {estado!.ano + 1}).
                      </p>
                      {previa && (
                        <p className={previa.aceita ? 'text-positivo' : 'text-alerta'}>
                          Sondagem: {previa.aceita ? 'ele toparia.' : previa.motivo}
                        </p>
                      )}
                      <Botao
                        onClick={() => fazerPoach({ ...oferta!, slot })}
                        desabilitado={Boolean(estado!.ofertaPendente)}
                      >
                        Enviar oferta
                      </Botao>
                    </>
                  )}
                </>
              )}

              {ultimaDecisaoMercado?.pilotoId === alvo.id && (
                <p className={`rounded border p-2 text-xs ${
                  ultimaDecisaoMercado.decisao?.aceita
                    ? 'border-positivo/40 bg-positivo/10 text-positivo'
                    : 'border-negativo/40 bg-negativo/10 text-negativo'
                }`}>
                  {ultimaDecisaoMercado.erro ??
                    (ultimaDecisaoMercado.decisao?.aceita
                      ? `Aceitou! ${ultimaDecisaoMercado.decisao.motivo}`
                      : `Recusou: ${ultimaDecisaoMercado.decisao?.motivo}`)}
                </p>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Histórico de carreira do piloto (Fase 6): temporadas, títulos, vitórias. */
export function HistoricoPiloto({ piloto }: { piloto: Piloto }) {
  const historico = piloto.historico ?? [];
  return (
    <div className="rounded border border-borda p-2">
      <p className="rotulo mb-1.5">Carreira</p>
      <p className="num text-xs text-mudo">
        {piloto.titulosCarreira ?? 0} título(s) · {piloto.vitoriasCarreira ?? 0} vitória(s) ·{' '}
        {piloto.podiosCarreira ?? 0} pódio(s)
      </p>
      {historico.length === 0 ? (
        <p className="mt-1 text-xs text-mudo">Primeira temporada no grid.</p>
      ) : (
        <ul className="mt-1.5 flex flex-col gap-0.5 text-xs">
          {[...historico].slice(-6).reverse().map((t) => (
            <li key={t.ano} className="flex items-center gap-2">
              <span className="num w-10 text-mudo">{t.ano}</span>
              <span className={`num w-8 font-semibold ${t.campeao ? 'text-alerta' : ''}`}>
                P{t.posicaoCampeonato}{t.campeao ? ' 🏆' : ''}
              </span>
              <span className="truncate text-mudo">{nomeEquipe(t.equipeId)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Para pilotos livres: mostra se ele aceitaria a sua equipe hoje. */
function PreviaLivre({ alvo }: { alvo: Piloto }) {
  const { estado, irPara } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;
  const previa = interessePiloto(
    alvo,
    jogador,
    { pilotoId: alvo.id, salarioAnual: salarioExigido(alvo), duracaoAnos: 2 },
    undefined,
    CATALOGO.patrocinadores[jogador.patrocinadorId]
  );
  return (
    <>
      <p className={previa.aceita ? 'text-positivo' : 'text-alerta'}>
        {previa.aceita
          ? 'Aceitaria correr pela sua equipe pelo salário de mercado.'
          : `Hoje recusaria: ${previa.motivo}`}
      </p>
      <p className="text-xs text-mudo">Contratação de pilotos livres acontece no Escritório, num assento vago.</p>
      <Botao variante="secundario" onClick={() => irPara('escritorio')}>Ir para o Escritório</Botao>
    </>
  );
}
