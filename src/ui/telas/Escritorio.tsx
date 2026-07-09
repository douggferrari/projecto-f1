// ============================================================================
// Escritório / pré-temporada: contratos (motor, pilotos, patrocínio),
// investimento com ESTIMATIVA DE RESERVA para incidentes (Fase 4) e
// painel de orçamento sempre visível. Pilotos decidem por interesse.
// ============================================================================

import { useMemo, useState } from 'react';
import type { DecisoesPreTemporada } from '../../engine/carreira';
import { anosRestantes, contratoVigente, criarContratoMotor, custoAnualMotor, salarioAnualPiloto } from '../../engine/contratos';
import { estimativaIncidentes } from '../../engine/incidentes';
import { interessePiloto } from '../../engine/mercado';
import { validarOrcamento } from '../../engine/orcamento';
import type { Equipe, Piloto } from '../../engine/tipos';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { formatarDinheiro } from '../formatar';
import { bandeira } from '../nomes';
import { Botao, Card, CategoriaBadge, FaseBadge, ListaErros, TendenciaMotorBadge } from '../componentes';

interface SelecaoPiloto {
  id: string;
  duracao: number;
  fatorSalario: number; // 1 = salário exigido (com desconto de duração)
}

export function Escritorio() {
  const { estado } = useJogo();
  // Temporada em andamento: contratos, patrocínio e investimento travados.
  // (Componentes separados para os hooks do formulário não serem condicionais.)
  return estado!.fase === 'pre-temporada' ? <EscritorioPreTemporada /> : <EscritorioSomenteLeitura />;
}

function EscritorioPreTemporada() {
  const { estado, confirmarPreTemporada, erros } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;
  const ano = estado!.ano;
  const premiacao = estado!.premiacaoAnterior[jogador.id] ?? 0;

  const motorVigente = contratoVigente(jogador.contratoMotor, ano);
  const assentosVagos = ([0, 1] as const).filter((s) => !contratoVigente(jogador.pilotos[s], ano));

  const [motorSel, setMotorSel] = useState({ id: jogador.contratoMotor.motorId, duracao: 2 });
  const [pilotosSel, setPilotosSel] = useState<Record<number, SelecaoPiloto>>({});
  const [patrocinadorId, setPatrocinadorId] = useState(jogador.patrocinadorId);
  const [investimento, setInvestimento] = useState(0);

  const salarioDaOferta = (piloto: Piloto, sel: SelecaoPiloto) =>
    Math.round((salarioAnualPiloto(piloto, sel.duracao) * sel.fatorSalario) / 100_000) * 100_000;

  // Equipe "prévia" com as seleções aplicadas — orçamento usa o motor real
  const previa: Equipe = useMemo(() => {
    const eq = structuredClone(jogador);
    if (!motorVigente && estado!.motores[motorSel.id]) {
      eq.contratoMotor = criarContratoMotor(estado!.motores[motorSel.id], motorSel.duracao, ano);
    }
    for (const slot of assentosVagos) {
      const sel = pilotosSel[slot];
      const piloto = sel && estado!.pilotos[sel.id];
      if (piloto) {
        eq.pilotos[slot] = {
          pilotoId: piloto.id, duracaoAnos: sel.duracao,
          salarioAnual: salarioDaOferta(piloto, sel), anoInicio: ano,
        };
      }
    }
    // Poaches pendentes da janela: o salário do poacheado já pesa no orçamento
    for (const poach of estado!.poachesPendentes) {
      eq.pilotos[poach.slot] = {
        pilotoId: poach.pilotoId, duracaoAnos: poach.duracaoAnos,
        salarioAnual: poach.salarioAnual, anoInicio: ano,
      };
    }
    eq.patrocinadorId = patrocinadorId;
    return eq;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jogador, motorSel, pilotosSel, patrocinadorId, ano, estado]);

  const orcamento = validarOrcamento(
    previa, CATALOGO.patrocinadores, premiacao, investimento + estado!.custoRescisaoAno
  );
  const tetoInvestimento = Math.max(0, orcamento.receita - orcamento.gastosFixos - estado!.custoRescisaoAno);
  const estimativa = estimativaIncidentes(previa, estado!.pilotos, estado!.motores, estado!.calendario.length);
  const sugerido = Math.max(0, tetoInvestimento - estimativa);

  const confirmar = () => {
    confirmarPreTemporada({
      patrocinadorId,
      investimento,
      motor: motorVigente ? undefined : { motorId: motorSel.id, duracaoAnos: motorSel.duracao },
      pilotos: assentosVagos
        .filter((slot) => pilotosSel[slot])
        .map((slot) => {
          const sel = pilotosSel[slot];
          const piloto = estado!.pilotos[sel.id];
          return { slot, pilotoId: sel.id, duracaoAnos: sel.duracao, salarioAnual: salarioDaOferta(piloto, sel) };
        }),
    } satisfies DecisoesPreTemporada);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <ListaErros erros={erros} />

        {/* ------------------------- MOTOR ------------------------- */}
        <Card titulo="Contrato de motor">
          {motorVigente ? (
            <InfoContrato
              nome={estado!.motores[jogador.contratoMotor.motorId].nome}
              detalhe={`potência ${estado!.motores[jogador.contratoMotor.motorId].potencia} · confiabilidade ${estado!.motores[jogador.contratoMotor.motorId].confiabilidade}`}
              custo={jogador.contratoMotor.custoAnual}
              anos={anosRestantes(jogador.contratoMotor, ano)}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {Object.values(estado!.motores).map((motor) => (
                <label
                  key={motor.id}
                  className={`flex cursor-pointer items-center gap-3 rounded border p-2 ${
                    motorSel.id === motor.id ? 'border-acento bg-superficie-2' : 'border-borda hover:border-mudo'
                  }`}
                >
                  <input
                    type="radio" name="motor" className="accent-(--color-acento)"
                    checked={motorSel.id === motor.id}
                    onChange={() => setMotorSel({ ...motorSel, id: motor.id })}
                  />
                  <span className="flex-1 font-medium">{motor.nome} <TendenciaMotorBadge motor={motor} /></span>
                  <span className="num w-20 text-right text-sm text-mudo">pot {motor.potencia}</span>
                  <span className="num w-20 text-right text-sm text-mudo">conf {motor.confiabilidade}</span>
                  <span className="num w-24 text-right text-sm">{formatarDinheiro(custoAnualMotor(motor, motorSel.duracao))}/ano</span>
                </label>
              ))}
              <SeletorDuracao valor={motorSel.duracao} onChange={(duracao) => setMotorSel({ ...motorSel, duracao })} />
            </div>
          )}
        </Card>

        {/* ------------------------- PILOTOS ------------------------- */}
        {([0, 1] as const).map((slot) => {
          const contrato = jogador.pilotos[slot];
          const vigente = contratoVigente(contrato, ano);
          const sel = pilotosSel[slot];
          const pilotoAtual = estado!.pilotos[contrato.pilotoId];
          const poachDoSlot = estado!.poachesPendentes.find((p) => p.slot === slot);
          return (
            <Card key={slot} titulo={`Piloto ${slot + 1}`}>
              {poachDoSlot ? (
                <p className="rounded border border-acento/40 bg-acento/10 p-3 text-sm">
                  Reservado para <strong>{estado!.pilotos[poachDoSlot.pilotoId].nome}</strong> (contratação
                  da janela): assume este assento <strong>nesta temporada</strong> ao confirmar
                  {vigente && <> — {pilotoAtual.nome} será liberado</>}.
                  Para mudar, cancele a pendência no Mercado.
                </p>
              ) : vigente ? (
                <InfoContrato
                  nome={`${bandeira(pilotoAtual.nacionalidade)} ${pilotoAtual.nome} · ${pilotoAtual.idade} anos`}
                  detalhe={`quali ${Math.round(pilotoAtual.classificacao)} · corrida ${Math.round(pilotoAtual.corrida)} · conf ${Math.round(pilotoAtual.confiabilidade)}`}
                  custo={contrato.salarioAnual}
                  anos={anosRestantes(contrato, ano)}
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-alerta">Assento vago — faça uma oferta a um piloto livre.</p>
                  <div className="max-h-64 overflow-y-auto rounded border border-borda">
                    {estado!.pilotosLivres
                      .filter((id) => id !== pilotosSel[slot === 0 ? 1 : 0]?.id)
                      .map((id) => estado!.pilotos[id])
                      .filter(Boolean)
                      .sort((a, b) => b.corrida - a.corrida)
                      .map((piloto) => {
                        const selEfetiva: SelecaoPiloto = sel?.id === piloto.id ? sel : { id: piloto.id, duracao: 2, fatorSalario: 1 };
                        const decisao = interessePiloto(piloto, previa, {
                          pilotoId: piloto.id,
                          salarioAnual: salarioDaOferta(piloto, selEfetiva),
                          duracaoAnos: selEfetiva.duracao,
                        });
                        return (
                          <label
                            key={piloto.id}
                            className={`flex cursor-pointer items-center gap-2 border-b border-borda p-2 last:border-b-0 ${
                              sel?.id === piloto.id ? 'bg-superficie-2' : 'hover:bg-superficie-2/50'
                            }`}
                          >
                            <input
                              type="radio" name={`piloto-${slot}`} className="accent-(--color-acento)"
                              checked={sel?.id === piloto.id}
                              onChange={() => setPilotosSel({ ...pilotosSel, [slot]: selEfetiva })}
                            />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">
                              {piloto.nome} <span className="num text-xs text-mudo">{piloto.idade}a</span>
                            </span>
                            <CategoriaBadge piloto={piloto} />
                            <FaseBadge idade={piloto.idade} />
                            <span className="num w-20 text-right text-xs" title="Salário exigido">
                              {formatarDinheiro(piloto.salarioBase)}
                            </span>
                            <span
                              className={`w-14 text-right text-xs ${decisao.aceita ? 'text-positivo' : 'text-negativo'}`}
                              title={decisao.motivo}
                            >
                              {decisao.aceita ? 'aceita' : 'recusa'}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                  {sel && (
                    <>
                      <SeletorDuracao
                        valor={sel.duracao}
                        onChange={(duracao) => setPilotosSel({ ...pilotosSel, [slot]: { ...sel, duracao } })}
                      />
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-mudo">Oferta salarial:</span>
                        {[1, 1.2, 1.5].map((fator) => (
                          <button
                            key={fator} type="button"
                            onClick={() => setPilotosSel({ ...pilotosSel, [slot]: { ...sel, fatorSalario: fator } })}
                            className={`rounded border px-2 py-1 text-xs font-semibold ${
                              sel.fatorSalario === fator ? 'border-acento text-acento' : 'border-borda text-mudo hover:text-texto'
                            }`}
                          >
                            {fator === 1 ? 'mercado' : `${fator}× (convencer)`}
                          </button>
                        ))}
                        <span className="num ml-auto text-xs text-mudo">
                          = {formatarDinheiro(salarioDaOferta(estado!.pilotos[sel.id], sel))}/ano
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}

        {/* ------------------------- PATROCÍNIO ------------------------- */}
        <Card titulo="Patrocínio da temporada">
          <div className="flex flex-col gap-2">
            {Object.values(CATALOGO.patrocinadores)
              .sort((a, b) => b.aporte - a.aporte)
              .map((pat) => {
                const bloqueado = estado!.patrocinadoresBloqueados.includes(pat.id);
                const semPrestigio = jogador.prestigio < pat.prestigioMinimo;
                const indisponivel = bloqueado || semPrestigio;
                return (
                  <label
                    key={pat.id}
                    className={`flex items-center gap-3 rounded border p-2 ${
                      indisponivel
                        ? 'cursor-not-allowed border-borda opacity-45'
                        : patrocinadorId === pat.id
                          ? 'cursor-pointer border-acento bg-superficie-2'
                          : 'cursor-pointer border-borda hover:border-mudo'
                    }`}
                  >
                    <input
                      type="radio" name="patrocinador" className="accent-(--color-acento)"
                      disabled={indisponivel}
                      checked={patrocinadorId === pat.id}
                      onChange={() => setPatrocinadorId(pat.id)}
                    />
                    <span className="flex-1 font-medium">{pat.nome}</span>
                    <span
                      className={`text-xs ${pat.prestigio >= 70 ? 'text-acento' : 'text-mudo'}`}
                      title="Prestígio da marca: soma um bônus (limitado) ao prestígio da equipe aos olhos dos pilotos"
                    >
                      marca {pat.prestigio}
                    </span>
                    {pat.meta && (
                      <span className="text-xs text-mudo">
                        meta: top {pat.meta.posicaoConstrutoresMax} (+{formatarDinheiro(pat.meta.bonus)})
                      </span>
                    )}
                    {bloqueado && <span className="text-xs text-negativo">não renovou</span>}
                    {semPrestigio && !bloqueado && (
                      <span className="text-xs text-alerta">exige prestígio {pat.prestigioMinimo}</span>
                    )}
                    <span className="num w-24 text-right text-sm">{formatarDinheiro(pat.aporte)}</span>
                  </label>
                );
              })}
          </div>
        </Card>
      </div>

      {/* --------------------- PAINEL DE ORÇAMENTO --------------------- */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <Card titulo="Orçamento da temporada">
          <dl className="flex flex-col gap-1.5 text-sm">
            <LinhaOrcamento nome="Orçamento-base" valor={jogador.orcamentoBase} />
            <LinhaOrcamento nome="Patrocínio" valor={CATALOGO.patrocinadores[patrocinadorId]?.aporte ?? 0} />
            <LinhaOrcamento nome="Premiação do ano passado" valor={premiacao} />
            <div className="my-1 border-t border-borda" />
            <LinhaOrcamento nome="Receita total" valor={orcamento.receita} destaque />
            <LinhaOrcamento nome="Motor + salários" valor={-(orcamento.gastosFixos)} />
            {estado!.custoRescisaoAno > 0 && <LinhaOrcamento nome="Rescisão (mercado)" valor={-estado!.custoRescisaoAno} />}
            <LinhaOrcamento nome="Desenvolvimento" valor={-investimento} />
            <div className="my-1 border-t border-borda" />
            <div className="flex justify-between font-semibold">
              <dt>Folga para imprevistos</dt>
              <dd className={`num ${orcamento.saldo < 0 ? 'text-negativo' : orcamento.saldo < estimativa ? 'text-alerta' : 'text-positivo'}`}>
                {formatarDinheiro(orcamento.saldo)}
              </dd>
            </div>
          </dl>

          <div className="mt-3 rounded border border-alerta/40 bg-alerta/10 p-2 text-xs text-alerta">
            Estimativa de incidentes (quebras/batidas) nesta temporada:{' '}
            <span className="num font-semibold">{formatarDinheiro(estimativa)}</span>.
            Investir sem folga é apostar — déficit no fim do ano derruba a reputação e pode custar o cargo.
          </div>

          <div className="mt-4">
            <label htmlFor="investimento" className="rotulo">Investimento em desenvolvimento</label>
            <input
              id="investimento" type="range" min={0} max={tetoInvestimento} step={500_000}
              value={Math.min(investimento, tetoInvestimento)}
              onChange={(e) => setInvestimento(Number(e.target.value))}
              className="mt-2 w-full accent-(--color-acento)"
            />
            <div className="mt-1 flex items-baseline justify-between">
              <button
                type="button"
                onClick={() => setInvestimento(sugerido)}
                className="text-xs text-acento underline-offset-2 hover:underline"
              >
                usar sugestão prudente ({formatarDinheiro(sugerido)})
              </button>
              <p className="num text-lg font-bold text-acento">{formatarDinheiro(investimento)}</p>
            </div>
            <p className="text-right text-xs text-mudo">disponível: {formatarDinheiro(tetoInvestimento)}</p>
          </div>

          {orcamento.mensagem && <p className="mt-3 text-sm text-negativo">{orcamento.mensagem}</p>}

          <Botao onClick={confirmar} desabilitado={!orcamento.valido} className="mt-4 w-full">
            Confirmar e ir para o 1º GP
          </Botao>
        </Card>
      </div>
    </div>
  );
}

/** Visão travada do escritório com a temporada em andamento. */
function EscritorioSomenteLeitura() {
  const { estado, irPara } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;
  const ano = estado!.ano;
  const motor = estado!.motores[jogador.contratoMotor.motorId];
  const patrocinador = CATALOGO.patrocinadores[jogador.patrocinadorId];
  const investimento = estado!.investimentosAno[jogador.id] ?? 0;

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="rounded border border-alerta/40 bg-alerta/10 p-3 text-sm text-alerta">
        A temporada está em andamento: contratos, patrocínio e investimento estão travados
        até a próxima pré-temporada. O mercado continua aberto para ofertas a pilotos de
        outras equipes (chegam no ano que vem).
      </div>

      <Card titulo="Contratos da temporada">
        <div className="flex flex-col gap-3">
          <InfoContrato
            nome={motor.nome}
            detalhe={`potência ${motor.potencia} · confiabilidade ${motor.confiabilidade}`}
            custo={jogador.contratoMotor.custoAnual}
            anos={anosRestantes(jogador.contratoMotor, ano)}
          />
          {jogador.pilotos.map((contrato) => {
            const piloto = estado!.pilotos[contrato.pilotoId];
            return (
              <InfoContrato
                key={contrato.pilotoId}
                nome={`${piloto.nome} · ${piloto.idade} anos`}
                detalhe={`quali ${Math.round(piloto.classificacao)} · corrida ${Math.round(piloto.corrida)} · conf ${Math.round(piloto.confiabilidade)}`}
                custo={contrato.salarioAnual}
                anos={anosRestantes(contrato, ano)}
              />
            );
          })}
        </div>
      </Card>

      <Card titulo="Orçamento comprometido">
        <dl className="flex flex-col gap-1.5 text-sm">
          <LinhaOrcamento nome="Patrocinador" valor={patrocinador?.aporte ?? 0} />
          <LinhaOrcamento nome="Investimento em desenvolvimento" valor={-investimento} />
          <LinhaOrcamento nome="Incidentes até agora" valor={-estado!.custosIncidentesAno} />
          {estado!.custoRescisaoAno > 0 && (
            <LinhaOrcamento nome="Rescisão (mercado)" valor={-estado!.custoRescisaoAno} />
          )}
        </dl>
        <div className="mt-4 flex gap-2">
          <Botao variante="secundario" onClick={() => irPara('mercado')}>Abrir o mercado</Botao>
          <Botao onClick={() => irPara('gp')}>Ir para o próximo GP</Botao>
        </div>
      </Card>
    </div>
  );
}

function InfoContrato(props: { nome: string; detalhe: string; custo: number; anos: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1">
        <p className="font-medium">{props.nome}</p>
        <p className="text-xs text-mudo">{props.detalhe}</p>
      </div>
      <span className="num text-sm">{formatarDinheiro(props.custo)}/ano</span>
      <span className="rounded bg-superficie-2 px-2 py-1 text-xs text-mudo">
        {props.anos} ano{props.anos > 1 ? 's' : ''} restante{props.anos > 1 ? 's' : ''}
      </span>
    </div>
  );
}

function SeletorDuracao(props: { valor: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-mudo">Duração:</span>
      {[1, 2, 3, 4, 5].map((anos) => (
        <button
          key={anos} type="button" onClick={() => props.onChange(anos)}
          className={`rounded border px-2 py-1 text-xs font-semibold ${
            props.valor === anos ? 'border-acento text-acento' : 'border-borda text-mudo hover:text-texto'
          }`}
        >
          {anos}a
        </button>
      ))}
      <span className="ml-auto text-xs text-mudo">mais longo = desconto (até 12%)</span>
    </div>
  );
}

function LinhaOrcamento(props: { nome: string; valor: number; destaque?: boolean }) {
  return (
    <div className={`flex justify-between ${props.destaque ? 'font-semibold' : ''}`}>
      <dt className={props.destaque ? '' : 'text-mudo'}>{props.nome}</dt>
      <dd className={`num ${props.valor < 0 ? 'text-negativo' : ''}`}>{formatarDinheiro(props.valor)}</dd>
    </div>
  );
}
