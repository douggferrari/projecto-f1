// ============================================================================
// Fim de temporada — Fase 4: classificação, premiação, BALANÇO FINANCEIRO
// (incidentes, saldo, aviso/vermelho/demissão), prestígio, reputação,
// convites — ou ofertas de emprego, se o chefe foi demitido.
// ============================================================================

import { useMemo, useState } from 'react';
import { gerarRelatorioFimTemporada } from '../../engine/fimTemporada';
import { anosRestantes } from '../../engine/contratos';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarDinheiro } from '../formatar';
import { Botao, Card, CorEquipe, Estrelas } from '../componentes';

export function FimTemporada() {
  const { estado, concluirTemporada } = useJogo();
  const [escolha, setEscolha] = useState<string | undefined>();

  const relatorio = useMemo(() => gerarRelatorioFimTemporada(estado!, CATALOGO), [estado]);
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;
  const { financeiro } = relatorio;
  const deltaReputacao = relatorio.jogador.reputacaoDepois - relatorio.jogador.reputacaoAntes;
  const contratosExpirando = jogador.pilotos.filter((c) => anosRestantes(c, estado!.ano + 1) === 0);
  const opcoes = financeiro.demitido ? relatorio.ofertasEmprego : relatorio.convites;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Fim da temporada {estado!.ano}</h1>

      {financeiro.demitido && (
        <div className="rounded border border-negativo/50 bg-negativo/10 p-4">
          <p className="font-bold text-negativo">Você foi demitido.</p>
          <p className="mt-1 text-sm text-mudo">
            {financeiro.saldo < 0 && `A temporada fechou com déficit de ${formatarDinheiro(-financeiro.saldo)}. `}
            {financeiro.carreiraEncerrada
              ? 'Nenhuma equipe quis apostar em você — a carreira termina aqui.'
              : 'Equipes de prestígio igual ou menor ainda topam te contratar — escolha abaixo.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Classificação final */}
        <Card titulo="Classificação final — construtores">
          <table className="w-full text-sm">
            <tbody>
              {relatorio.classificacao.map(({ equipeId, pontos, posicao }) => {
                const equipe = estado!.equipes.find((e) => e.id === equipeId)!;
                const prestigio = relatorio.prestigio[equipeId];
                const delta = prestigio.depois - prestigio.antes;
                return (
                  <tr
                    key={equipeId}
                    className={`border-t border-borda/60 ${equipe.ehJogador ? 'bg-acento/10' : ''}`}
                  >
                    <td className="num w-8 py-1.5 pr-3">{posicao}</td>
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2 font-medium">
                        <CorEquipe cor={equipe.corPrimaria} />
                        {equipe.nome}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <Estrelas valor={prestigio.depois} />
                      {delta !== 0 && (
                        <span className={`ml-1 text-xs ${delta > 0 ? 'text-positivo' : 'text-negativo'}`}>
                          {delta > 0 ? '▲' : '▼'}
                        </span>
                      )}
                    </td>
                    <td className="num py-1.5 pr-3 text-right">{pontos} pts</td>
                    <td className="num py-1.5 text-right text-positivo">
                      {formatarDinheiro(relatorio.premiacoes[equipeId])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div className="flex flex-col gap-4">
          {/* Balanço financeiro */}
          <Card titulo="Balanço do ano">
            <dl className="flex flex-col gap-1.5 text-sm">
              <LinhaFin nome="Receita" valor={financeiro.receita} />
              <LinhaFin nome="Motor + salários" valor={-financeiro.gastosFixos} />
              <LinhaFin nome="Desenvolvimento" valor={-financeiro.investimento} />
              <LinhaFin nome="Incidentes" valor={-financeiro.incidentes} />
              {financeiro.rescisao > 0 && <LinhaFin nome="Rescisão (mercado)" valor={-financeiro.rescisao} />}
              <div className="my-1 border-t border-borda" />
              <div className="flex justify-between font-semibold">
                <dt>Saldo</dt>
                <dd className={`num ${financeiro.saldo < 0 ? 'text-negativo' : 'text-positivo'}`}>
                  {formatarDinheiro(financeiro.saldo)}
                </dd>
              </div>
              {financeiro.situacao === 'aviso' && !financeiro.demitido && (
                <p className="rounded border border-alerta/40 bg-alerta/10 p-2 text-alerta">
                  Fechou no negativo: a diretoria avisou — e a sua reputação sentiu.
                </p>
              )}
              {financeiro.situacao === 'vermelho' && !financeiro.demitido && (
                <p className="rounded border border-negativo/40 bg-negativo/10 p-2 text-negativo">
                  Déficit sério. Mais um ano assim e você está fora.
                </p>
              )}
            </dl>
          </Card>

          {/* Resumo esportivo */}
          <Card titulo="Sua temporada">
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-mudo">Posição final</dt>
                <dd className="num font-bold">P{relatorio.jogador.posicao} (esperado: P{relatorio.jogador.expectativa})</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mudo">Reputação do chefe</dt>
                <dd className="num">
                  {Math.round(relatorio.jogador.reputacaoAntes)} →{' '}
                  <span className={deltaReputacao >= 0 ? 'text-positivo' : 'text-negativo'}>
                    {Math.round(relatorio.jogador.reputacaoDepois)}
                  </span>
                </dd>
              </div>
              {relatorio.jogador.metaPatrocinio && (
                <div className="flex justify-between">
                  <dt className="text-mudo">Meta de patrocínio</dt>
                  <dd className={relatorio.jogador.metaPatrocinio.cumprida ? 'text-positivo' : 'text-negativo'}>
                    {relatorio.jogador.metaPatrocinio.cumprida
                      ? `cumprida (+${formatarDinheiro(relatorio.jogador.metaPatrocinio.bonus)})`
                      : 'não cumprida — sem renovação'}
                  </dd>
                </div>
              )}
              {relatorio.saltoRegulamento && (
                <p className="rounded border border-alerta/40 bg-alerta/10 p-2 text-alerta">
                  ⚠ Novo regulamento no ano que vem: chassis normalizados — quem investiu
                  o ciclo inteiro larga na frente.
                </p>
              )}
              {contratosExpirando.length > 0 && (
                <p className="text-mudo">
                  Contratos expirando:{' '}
                  {contratosExpirando.map((c) => estado!.pilotos[c.pilotoId].nome).join(', ')}
                </p>
              )}
            </dl>
          </Card>

          {/* Convites ou ofertas de emprego */}
          <Card titulo={financeiro.demitido ? 'Ofertas de emprego' : 'Convites'}>
            {opcoes.length === 0 ? (
              <p className="text-sm text-mudo">
                {financeiro.demitido
                  ? 'Nenhuma equipe se apresentou.'
                  : 'Nenhuma equipe veio bater na sua porta este ano. Reputação alta e resultados destravam convites.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {opcoes.map((equipeId) => {
                  const equipe = estado!.equipes.find((e) => e.id === equipeId)!;
                  const selecionada = escolha === equipeId;
                  return (
                    <button
                      key={equipeId}
                      type="button"
                      onClick={() => setEscolha(selecionada ? undefined : equipeId)}
                      className={`flex items-center gap-3 rounded border p-2 text-left ${
                        selecionada ? 'border-acento bg-superficie-2' : 'border-borda hover:border-mudo'
                      }`}
                    >
                      <CorEquipe cor={equipe.corPrimaria} />
                      <span className="flex-1 font-medium">{equipe.nome}</span>
                      <Estrelas valor={relatorio.prestigio[equipeId].depois} />
                      <span className="num text-xs text-mudo">base {formatarDinheiro(equipe.orcamentoBase)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          <Botao
            onClick={() => concluirTemporada(escolha)}
            desabilitado={financeiro.demitido && !financeiro.carreiraEncerrada && !escolha && opcoes.length > 0 && false}
            className="w-full"
          >
            {financeiro.carreiraEncerrada
              ? 'Encerrar carreira'
              : escolha
                ? `Assumir a ${estado!.equipes.find((e) => e.id === escolha)!.nome} em ${estado!.ano + 1}`
                : financeiro.demitido
                  ? `Aceitar a melhor oferta disponível`
                  : `Continuar na ${jogador.nome} em ${estado!.ano + 1}`}
          </Botao>
        </div>
      </div>
    </div>
  );
}

function LinhaFin(props: { nome: string; valor: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-mudo">{props.nome}</dt>
      <dd className="num">{formatarDinheiro(props.valor)}</dd>
    </div>
  );
}
