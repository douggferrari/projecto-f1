// Tela de nova carreira: escolher uma equipe pequena para começar.

import { EQUIPES_INICIAIS } from '../../data/equipes';
import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { existeSave } from '../../state/persistencia';
import { formatarDinheiro } from '../formatar';
import { Botao, Card, Estrelas } from '../componentes';

export function NovaCarreira() {
  const { novaCarreira, carregar } = useJogo();
  const pequenas = EQUIPES_INICIAIS.filter((e) => e.tier === 'pequena');

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-acento">Projecto F1</p>
      <h1 className="mt-1 text-2xl font-bold">Nova carreira</h1>
      <p className="mt-2 max-w-prose text-mudo">
        Você é o novo chefe de equipe. Comece no fundo do grid, feche bons contratos,
        invista no carro e suba na classificação — as equipes grandes estão de olho.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {pequenas.map((equipe) => {
          const motor = CATALOGO.motores[equipe.contratoMotor.motorId];
          const [p1, p2] = equipe.pilotos.map((c) => CATALOGO.pilotos[c.pilotoId]);
          return (
            <Card key={equipe.id} className="relative flex flex-col gap-3 overflow-hidden">
              <div
                className="absolute inset-x-0 top-0 h-1"
                style={{ background: `linear-gradient(90deg, ${equipe.corPrimaria} 60%, ${equipe.corSecundaria})` }}
              />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{equipe.nome}</h2>
                <Estrelas valor={equipe.prestigio} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-mudo">Orçamento-base</dt>
                <dd className="num text-right">{formatarDinheiro(equipe.orcamentoBase)}</dd>
                <dt className="text-mudo">Nível de chassi</dt>
                <dd className="num text-right">{equipe.nivelChassi}</dd>
                <dt className="text-mudo">Motor</dt>
                <dd className="text-right">{motor.nome}</dd>
                <dt className="text-mudo">Pilotos</dt>
                <dd className="text-right">{p1.nome} · {p2.nome}</dd>
              </dl>
              <Botao onClick={() => novaCarreira(equipe.id)} className="mt-auto">
                Assumir equipe
              </Botao>
            </Card>
          );
        })}
      </div>

      {existeSave() && (
        <div className="mt-8">
          <Botao variante="secundario" onClick={carregar}>Continuar jogo salvo</Botao>
        </div>
      )}
    </div>
  );
}
