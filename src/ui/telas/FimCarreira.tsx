// Tela de fim de carreira: demitido sem nenhuma oferta de emprego.

import { useJogo } from '../../state/store';
import { Botao } from '../componentes';

export function FimCarreira() {
  const { estado, abandonarCarreira } = useJogo();
  const jogador = estado!.equipes.find((e) => e.ehJogador)!;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-black uppercase tracking-[0.2em] text-negativo">Fim de carreira</p>
      <h1 className="text-2xl font-bold">O paddock fechou as portas.</h1>
      <p className="text-mudo">
        Demitido da {jogador.nome} após {estado!.ano - 2026 + 1} temporada(s), com reputação{' '}
        <span className="num text-texto">{Math.round(jogador.reputacao)}</span>, nenhuma equipe
        quis apostar em você. Os déficits cobraram o preço — na próxima, reserve uma folga
        para os incidentes antes de despejar tudo em desenvolvimento.
      </p>
      <Botao onClick={abandonarCarreira}>Começar uma nova carreira</Botao>
    </div>
  );
}
