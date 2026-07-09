// ============================================================================
// Sede da Equipe — o hub persistente. Visão geral: próximo GP, campeonato,
// orçamento do ano, carro e pilotos. Ponto de partida de tudo.
// ============================================================================

import { contratoVigente, anosRestantes } from '../../engine/contratos';
import { classificacaoConstrutores } from '../../engine/fimTemporada';
import { estimativaIncidentes } from '../../engine/incidentes';
import { gastosFixos, receitaTemporada } from '../../engine/orcamento';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarDinheiro } from '../formatar';
import { bandeira } from '../nomes';
import { Botao, Card, CategoriaBadge, Estrelas, FaseBadge } from '../componentes';

export function Sede() {
  const { estado, irPara, simularTemporadaInteira } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;
  const motor = estado!.motores[jogador.contratoMotor.motorId];
  const patrocinador = CATALOGO.patrocinadores[jogador.patrocinadorId];

  const classificacao = classificacaoConstrutores(estado!);
  const posicao = classificacao.find((c) => c.equipeId === jogador.id)!;
  const proximoCircuito =
    estado!.gpAtual < estado!.calendario.length
      ? CATALOGO.circuitos[estado!.calendario[estado!.gpAtual]]
      : undefined;

  const receita = receitaTemporada(jogador, CATALOGO.patrocinadores, estado!.premiacaoAnterior[jogador.id] ?? 0);
  const fixos = gastosFixos(jogador);
  const investido = estado!.investimentosAno[jogador.id] ?? 0;
  const saldoProjetado = receita - fixos - investido - estado!.custosIncidentesAno - estado!.custoRescisaoAno;
  const estimativa = estimativaIncidentes(jogador, estado!.pilotos, estado!.motores, estado!.calendario.length);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Temporada */}
      <Card titulo="Temporada">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-mudo">Posição no construtores</span>
            <span className="num font-bold">P{posicao.posicao} · {posicao.pontos} pts</span>
          </div>
          {proximoCircuito ? (
            <>
              <div className="flex justify-between">
                <span className="text-mudo">Próximo GP</span>
                <span className="font-medium">{proximoCircuito.nome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mudo">Etapa</span>
                <span className="num">{estado!.gpAtual + 1}/{estado!.calendario.length}</span>
              </div>
            </>
          ) : (
            <p className="text-mudo">Calendário concluído — encerre a temporada.</p>
          )}
          {estado!.fase === 'pre-temporada' ? (
            <Botao onClick={() => irPara('escritorio')} className="mt-2">Resolver a pré-temporada</Botao>
          ) : estado!.fase === 'gp-classificacao' ? (
            <>
              <Botao onClick={() => irPara('gp')} className="mt-2">Ir para o fim de semana</Botao>
              <Botao variante="secundario" onClick={simularTemporadaInteira}>
                {estado!.gpAtual === 0
                  ? 'Simular a temporada inteira'
                  : `Simular os ${estado!.calendario.length - estado!.gpAtual} GPs restantes`}
              </Botao>
              <p className="text-xs text-mudo">
                A simulação usa a estratégia padrão da equipe em cada pista e vai direto
                para o fim da temporada (mesmas seeds — a sorte não muda, só você abre
                mão de escolher os pneus).
              </p>
            </>
          ) : null}
        </div>
      </Card>

      {/* Orçamento do ano */}
      <Card titulo="Orçamento do ano">
        <dl className="flex flex-col gap-1.5 text-sm">
          <Linha nome="Receita" valor={receita} />
          <Linha nome="Motor + salários" valor={-fixos} />
          <Linha nome="Desenvolvimento" valor={-investido} />
          <Linha nome="Incidentes até agora" valor={-estado!.custosIncidentesAno} alerta={estado!.custosIncidentesAno > estimativa} />
          {estado!.custoRescisaoAno > 0 && <Linha nome="Rescisão (mercado)" valor={-estado!.custoRescisaoAno} />}
          <div className="my-1 border-t border-borda" />
          <div className="flex justify-between font-semibold">
            <dt>Saldo projetado</dt>
            <dd className={`num ${saldoProjetado < 0 ? 'text-negativo' : 'text-positivo'}`}>
              {formatarDinheiro(saldoProjetado)}
            </dd>
          </div>
          <p className="mt-1 text-xs text-mudo">
            Estimativa de incidentes na temporada: <span className="num">{formatarDinheiro(estimativa)}</span>.
            Fechar o ano no vermelho custa reputação — e pode custar o cargo.
          </p>
        </dl>
      </Card>

      {/* Identidade */}
      <Card titulo="Equipe">
        <dl className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-mudo">Prestígio da equipe</dt>
            <dd><Estrelas valor={jogador.prestigio} /></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mudo">Reputação do chefe</dt>
            <dd className="num">{Math.round(jogador.reputacao)}/100</dd>
          </div>
          <p className="text-xs text-mudo">
            Prestígio atrai pilotos e patrocinadores; reputação atrai convites para VOCÊ.
          </p>
          <div className="my-1 border-t border-borda" />
          <div className="flex justify-between">
            <dt className="text-mudo">Chassi</dt>
            <dd className="num">{jogador.nivelChassi.toFixed(1)}/100 · ciclo ano {jogador.cicloDesenvolvimento.anoDoCiclo}/5</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mudo">Motor</dt>
            <dd>{motor.nome} <span className="num text-mudo">({anosRestantes(jogador.contratoMotor, estado!.ano)}a)</span></dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-mudo">Patrocinador</dt>
            <dd>{patrocinador?.nome ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      {/* Pilotos */}
      <Card titulo="Seus pilotos" className="lg:col-span-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {jogador.pilotos.map((contrato) => {
            const piloto = estado!.pilotos[contrato.pilotoId];
            const vigente = contratoVigente(contrato, estado!.ano);
            return (
              <div key={contrato.pilotoId} className="flex items-center gap-3 rounded border border-borda p-3">
                <div className="flex-1">
                  <p className="font-semibold">{bandeira(piloto.nacionalidade)} {piloto.nome} <span className="num text-sm text-mudo">{piloto.idade} anos</span></p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-mudo">
                    <CategoriaBadge piloto={piloto} />
                    <FaseBadge idade={piloto.idade} />
                    <span>reputação <span className="num">{Math.round(piloto.reputacao)}</span></span>
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p className="num">{formatarDinheiro(contrato.salarioAnual)}/ano</p>
                  <p className={`text-xs ${vigente && anosRestantes(contrato, estado!.ano) === 1 ? 'text-alerta' : 'text-mudo'}`}>
                    {vigente ? `${anosRestantes(contrato, estado!.ano)} ano(s) de contrato` : 'contrato expirado'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {estado!.poachesPendentes.map((p) => (
          <p key={p.pilotoId} className="mt-3 rounded border border-acento/40 bg-acento/10 p-2 text-sm">
            Contratação pendente: <strong>{estado!.pilotos[p.pilotoId].nome}</strong> assume o assento{' '}
            {p.slot + 1} <strong>nesta temporada</strong> ao confirmar a pré-temporada (rescisão
            reservada: <span className="num">{formatarDinheiro(p.custoRescisao)}</span> — cancelável no Mercado).
          </p>
        ))}
      </Card>
    </div>
  );
}

function Linha(props: { nome: string; valor: number; alerta?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-mudo">{props.nome}</dt>
      <dd className={`num ${props.alerta ? 'text-negativo' : props.valor < 0 ? 'text-texto' : ''}`}>
        {formatarDinheiro(props.valor)}
      </dd>
    </div>
  );
}
