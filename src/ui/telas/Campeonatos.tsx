// Tabelas dos campeonatos de Pilotos e Construtores.

import { classificarCampeonato } from '../../engine/pontuacao';
import { useJogo } from '../../state/store';
import { nomePiloto } from '../nomes';
import { Card, CorEquipe, Estrelas } from '../componentes';

export function Campeonatos() {
  const { estado } = useJogo();
  const pilotos = classificarCampeonato(estado!.campeonatoPilotos);
  const construtores = classificarCampeonato(estado!.campeonatoConstrutores);
  const equipesPorId = new Map(estado!.equipes.map((e) => [e.id, e]));
  const equipeDoPiloto = (pilotoId: string) =>
    estado!.equipes.find((e) => e.pilotos.some((c) => c.pilotoId === pilotoId));

  if (pilotos.length === 0) {
    return (
      <Card>
        <p className="text-mudo">Os campeonatos começam a contar depois do primeiro GP da temporada.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card titulo={`Campeonato de Pilotos — ${estado!.ano}`}>
        <table className="w-full text-sm">
          <tbody>
            {pilotos.map(({ id, pontos }, i) => {
              const equipe = equipeDoPiloto(id);
              const ehJogador = equipe?.ehJogador ?? false;
              return (
                <tr key={id} className={`border-t border-borda/60 ${ehJogador ? 'bg-acento/10' : ''}`}>
                  <td className="num w-8 py-1.5 pr-3">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{nomePiloto(id)}</td>
                  <td className="py-1.5 pr-3 text-mudo">
                    <span className="flex items-center gap-1.5">
                      {equipe && <CorEquipe cor={equipe.corPrimaria} />}
                      {equipe?.nome ?? '—'}
                    </span>
                  </td>
                  <td className="num py-1.5 text-right font-semibold">{pontos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card titulo={`Campeonato de Construtores — ${estado!.ano}`}>
        <table className="w-full text-sm">
          <tbody>
            {construtores.map(({ id, pontos }, i) => {
              const equipe = equipesPorId.get(id)!;
              return (
                <tr key={id} className={`border-t border-borda/60 ${equipe.ehJogador ? 'bg-acento/10' : ''}`}>
                  <td className="num w-8 py-1.5 pr-3">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-medium">{equipe.nome}</td>
                  <td className="py-1.5 pr-3"><Estrelas valor={equipe.prestigio} /></td>
                  <td className="num py-1.5 text-right font-semibold">{pontos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
