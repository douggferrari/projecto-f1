// ============================================================================
// Casco da aplicação — Fase 4.
// Sede da Equipe como hub persistente + dois modos claros:
//   MODO GESTÃO (pré-temporada / entre GPs): Sede, Escritório, Mercado,
//     Calendário, Campeonatos.
//   MODO FIM DE SEMANA (quali → estratégia → corrida): fluxo linear, sem
//     menus de gestão no meio.
// A UI inteira é tematizada pela cor da equipe do jogador (CSS variables):
// trocar de equipe re-skina o layout na temporada seguinte.
// ============================================================================

import type { CSSProperties } from 'react';
import { useJogo, type Tela } from '../state/store';
import { formatarDinheiro } from './formatar';
import { Botao, Estrelas } from './componentes';
import { Calendario } from './telas/Calendario';
import { Campeonatos } from './telas/Campeonatos';
import { Escritorio } from './telas/Escritorio';
import { FimCarreira } from './telas/FimCarreira';
import { FimDeSemana } from './telas/FimDeSemana';
import { FimTemporada } from './telas/FimTemporada';
import { Mercado } from './telas/Mercado';
import { NovaCarreira } from './telas/NovaCarreira';
import { Sede } from './telas/Sede';

export default function App() {
  const { estado, tela, irPara, salvar, carregar, avisoSave } = useJogo();

  if (!estado) return <NovaCarreira />;
  if (estado.fase === 'fim-carreira') return <FimCarreira />;

  const jogador = estado.equipes.find((e) => e.ehJogador)!;
  // Fim de semana "travado": da estratégia em diante o fluxo é linear
  const emFimDeSemana = estado.fase === 'gp-estrategia' || estado.fase === 'gp-corrida';
  const emFimTemporada = estado.fase === 'fim-temporada';

  // Tematização pela equipe do jogador: o acento da UI vira a cor primária
  const tema = {
    '--color-acento': jogador.corPrimaria,
    '--cor-equipe-secundaria': jogador.corSecundaria,
  } as CSSProperties;

  const abasGestao: { id: Tela; nome: string }[] = [
    { id: 'sede', nome: 'Sede' },
    { id: 'escritorio', nome: 'Escritório' },
    { id: 'mercado', nome: 'Mercado' },
    { id: 'calendario', nome: 'Calendário' },
    { id: 'campeonatos', nome: 'Campeonatos' },
  ];

  // "Qual é o próximo passo?" — sempre visível no cabeçalho
  const proximoPasso = emFimTemporada
    ? { rotulo: 'Encerrar a temporada', tela: 'sede' as Tela }
    : estado.fase === 'pre-temporada'
      ? { rotulo: 'Pré-temporada: fechar contratos', tela: 'escritorio' as Tela }
      : { rotulo: `GP ${estado.gpAtual + 1}/${estado.calendario.length}: ir para a pista`, tela: 'gp' as Tela };

  const telaAtiva: Tela = emFimDeSemana ? 'gp' : tela;

  return (
    <div className="min-h-screen" style={tema}>
      <header className="border-b border-borda bg-superficie">
        {/* Faixa de identidade da equipe */}
        <div
          className="h-1.5"
          style={{ background: `linear-gradient(90deg, ${jogador.corPrimaria} 60%, ${jogador.corSecundaria})` }}
        />
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-3">
            <span
              className="flex size-9 items-center justify-center rounded font-black"
              style={{ backgroundColor: jogador.corPrimaria, color: '#0d0f14' }}
            >
              {jogador.nome.slice(0, 1)}
            </span>
            <div>
              <p className="font-bold leading-tight">{jogador.nome}</p>
              <p className="flex items-center gap-2 text-xs text-mudo">
                <Estrelas valor={jogador.prestigio} titulo={`Prestígio da equipe: ${Math.round(jogador.prestigio)}/100 — quão cobiçada ela é`} />
                <span title="Reputação do chefe — quão cobiçado VOCÊ é (dispara convites)">
                  chefe <span className="num text-texto">{Math.round(jogador.reputacao)}</span>
                </span>
                <span className="num">{estado.ano}</span>
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-4 text-sm text-mudo md:flex">
            <span title="Custos de incidentes acumulados na temporada">
              incidentes <span className={`num ${estado.custosIncidentesAno > 0 ? 'text-negativo' : 'text-texto'}`}>{formatarDinheiro(estado.custosIncidentesAno)}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {avisoSave && <span className="text-sm text-positivo">{avisoSave}</span>}
            {!emFimDeSemana && (
              <Botao onClick={() => irPara(proximoPasso.tela)}>{proximoPasso.rotulo}</Botao>
            )}
            <Botao variante="secundario" onClick={salvar}>Salvar</Botao>
            <Botao variante="secundario" onClick={carregar}>Carregar</Botao>
          </div>
        </div>

        {/* Navegação: some no modo fim de semana (fluxo linear) */}
        {!emFimDeSemana && !emFimTemporada && (
          <nav className="mx-auto flex max-w-6xl gap-1 px-4">
            {abasGestao.map((aba) => (
              <button
                key={aba.id}
                type="button"
                onClick={() => irPara(aba.id)}
                className={`rounded-t border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                  telaAtiva === aba.id
                    ? 'border-acento text-texto'
                    : 'border-transparent text-mudo hover:text-texto'
                }`}
              >
                {aba.nome}
              </button>
            ))}
            {estado.fase === 'gp-classificacao' && (
              <button
                type="button"
                onClick={() => irPara('gp')}
                className={`ml-auto rounded-t border-b-2 px-4 py-2 text-sm font-semibold ${
                  telaAtiva === 'gp' ? 'border-acento text-acento' : 'border-transparent text-acento/80 hover:text-acento'
                }`}
              >
                🏁 Fim de semana de GP
              </button>
            )}
          </nav>
        )}
        {emFimDeSemana && (
          <p className="mx-auto max-w-6xl px-4 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-acento">
            Modo fim de semana — termine a corrida para voltar à gestão
          </p>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {emFimTemporada ? (
          <FimTemporada />
        ) : emFimDeSemana || telaAtiva === 'gp' ? (
          <FimDeSemana />
        ) : (
          <>
            {telaAtiva === 'sede' && <Sede />}
            {telaAtiva === 'escritorio' && <Escritorio />}
            {telaAtiva === 'mercado' && <Mercado />}
            {telaAtiva === 'calendario' && <Calendario />}
            {telaAtiva === 'campeonatos' && <Campeonatos />}
          </>
        )}
      </main>
    </div>
  );
}
