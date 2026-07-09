// ============================================================================
// Componentes compartilhados da UI (painel de gestão).
// ============================================================================

import type { ReactNode } from 'react';
import { statusChefe } from '../engine/chefes';
import { tendenciaMotor } from '../engine/motorCarreira';
import { categoriaPiloto, faseCarreira } from '../engine/pilotoCarreira';
import type { FaseCarreiraPiloto, Motor, Piloto, Pneu } from '../engine/tipos';

export function Card(props: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-md border border-borda bg-superficie p-4 ${props.className ?? ''}`}>
      {props.titulo && <h2 className="rotulo mb-3">{props.titulo}</h2>}
      {props.children}
    </section>
  );
}

export function Botao(props: {
  children: ReactNode;
  onClick?: () => void;
  variante?: 'primario' | 'secundario' | 'perigo';
  desabilitado?: boolean;
  className?: string;
}) {
  const base = 'rounded px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40';
  const variantes = {
    primario: 'bg-acento text-fundo hover:bg-acento/85',
    secundario: 'border border-borda bg-superficie-2 text-texto hover:border-mudo',
    perigo: 'border border-negativo/50 text-negativo hover:bg-negativo/10',
  };
  return (
    <button
      type="button"
      className={`${base} ${variantes[props.variante ?? 'primario']} ${props.className ?? ''}`}
      onClick={props.onClick}
      disabled={props.desabilitado}
    >
      {props.children}
    </button>
  );
}

/** Prestígio de equipe (0-100) exibido como 1-5 estrelas. */
export function Estrelas({ valor, titulo }: { valor: number; titulo?: string }) {
  const estrelas = Math.max(1, Math.min(5, Math.round(valor / 20)));
  return (
    <span
      title={titulo ?? `Prestígio ${Math.round(valor)}/100`}
      className="num text-[13px] tracking-tight text-alerta"
      aria-label={`${estrelas} de 5 estrelas`}
    >
      {'★'.repeat(estrelas)}
      <span className="text-mudo/40">{'★'.repeat(5 - estrelas)}</span>
    </span>
  );
}

/** Bolinha com a cor primária da equipe — leitura rápida do grid. */
export function CorEquipe({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-full border border-white/20"
      style={{ backgroundColor: cor }}
    />
  );
}

const NOME_FASE_PILOTO: Record<FaseCarreiraPiloto, { rotulo: string; cor: string }> = {
  subindo: { rotulo: '↗ subindo', cor: 'text-positivo' },
  auge: { rotulo: '● auge', cor: 'text-acento' },
  declinio: { rotulo: '↘ declínio', cor: 'text-alerta' },
  veterano: { rotulo: '↘ veterano', cor: 'text-negativo' },
};

/** Fase de carreira do piloto (subindo/auge/declínio). */
export function FaseBadge({ idade }: { idade: number }) {
  const fase = NOME_FASE_PILOTO[faseCarreira(idade)];
  return <span className={`text-xs ${fase.cor}`}>{fase.rotulo}</span>;
}

/** Categoria do piloto (Elite/Forte/Regular/Promessa/Iniciante) com estrelas. */
export function CategoriaBadge({ piloto }: { piloto: Pick<Piloto, 'classificacao' | 'corrida'> }) {
  const { categoria, estrelas } = categoriaPiloto(piloto);
  return (
    <span className="inline-flex items-center gap-1 rounded border border-borda px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-texto">
      {categoria}
      <span className="num text-alerta">{'★'.repeat(estrelas)}</span>
    </span>
  );
}

const CORES_PNEU: Record<Pneu, string> = {
  soft: 'border-pneu-soft text-pneu-soft',
  medium: 'border-pneu-medium text-pneu-medium',
  hard: 'border-pneu-hard text-pneu-hard',
};
const LETRA_PNEU: Record<Pneu, string> = { soft: 'S', medium: 'M', hard: 'H' };

/** Chip circular com o código de cor real dos compostos. */
export function PneuChip({ pneu }: { pneu: Pneu }) {
  return (
    <span
      title={pneu}
      className={`inline-flex size-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${CORES_PNEU[pneu]}`}
    >
      {LETRA_PNEU[pneu]}
    </span>
  );
}

export function ListaErros({ erros }: { erros: string[] }) {
  if (erros.length === 0) return null;
  return (
    <div className="rounded border border-negativo/50 bg-negativo/10 p-3 text-sm text-negativo">
      <p className="mb-1 font-semibold">Não dá para continuar assim:</p>
      <ul className="list-inside list-disc space-y-0.5">
        {erros.map((erro) => (
          <li key={erro}>{erro}</li>
        ))}
      </ul>
    </div>
  );
}

/** Dica de tendência do fornecedor de motor (Fase 6): retrovisor, não bola de cristal. */
export function TendenciaMotorBadge({ motor }: { motor: Motor }) {
  const tendencia = tendenciaMotor(motor);
  if (tendencia === 'subindo') {
    return <span className="text-positivo" title="Em ascensão nos últimos anos">▲</span>;
  }
  if (tendencia === 'caindo') {
    return <span className="text-negativo" title="Em queda nos últimos anos">▼</span>;
  }
  return <span className="text-mudo/60" title="Estável nos últimos anos">▬</span>;
}

/** Selo de status do chefe (Novato → Veterano → Estabelecido → Consagrado → Lendário). */
export function StatusChefeBadge({ campeonatos, temporadas }: { campeonatos: number; temporadas: number }) {
  const status = statusChefe(campeonatos, temporadas);
  const cores: Record<string, string> = {
    'Lendário': 'border-alerta/60 text-alerta',
    'Consagrado': 'border-acento/60 text-acento',
    'Estabelecido': 'border-positivo/50 text-positivo',
    'Veterano': 'border-borda text-texto',
    'Novato': 'border-borda text-mudo',
  };
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cores[status]}`}>
      {status}{campeonatos > 0 ? ` · ${campeonatos}×` : ''}
    </span>
  );
}
