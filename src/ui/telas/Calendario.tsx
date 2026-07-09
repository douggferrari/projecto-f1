// Calendário da temporada: GPs disputados (com vencedor) e o próximo.

import { CATALOGO } from '../../state/catalogo';
import { useJogo } from '../../state/store';
import { nomePiloto } from '../nomes';
import { Card } from '../componentes';

export function Calendario() {
  const { estado } = useJogo();

  return (
    <Card titulo={`Calendário ${estado!.ano}`}>
      <ol className="flex flex-col">
        {estado!.calendario.map((circuitoId, i) => {
          const circuito = CATALOGO.circuitos[circuitoId];
          const disputado = estado!.historico[i];
          const ehProximo = i === estado!.gpAtual && estado!.fase !== 'fim-temporada';
          const vencedor = disputado?.corrida[0];

          return (
            <li
              key={circuitoId}
              className={`flex items-center gap-4 border-t border-borda/60 px-2 py-2 first:border-t-0 ${
                ehProximo ? 'rounded bg-acento/10' : ''
              }`}
            >
              <span className="num w-6 text-right text-mudo">{i + 1}</span>
              <span className={`flex-1 font-medium ${disputado ? 'text-mudo' : ''}`}>{circuito.nome}</span>
              <span className="num hidden text-xs text-mudo sm:inline">{circuito.voltas} voltas</span>
              <span className="num hidden text-xs text-mudo sm:inline">desgaste {circuito.desgastePneu.toFixed(2)}×</span>
              {ehProximo && <span className="rotulo text-acento">próximo</span>}
              {vencedor && (
                <span className="text-sm text-mudo">
                  🏆 {nomePiloto(vencedor.pilotoId)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
