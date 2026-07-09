// Helpers de formatação da UI (tempos, gaps, nomes).

export { formatarDinheiro } from '../engine/orcamento';

/** 88.734 → "1:28.734" */
export function formatarTempoVolta(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const resto = segundos - min * 60;
  return `${min}:${resto.toFixed(3).padStart(6, '0')}`;
}

/** 4532.8 → "1:15:32.8" */
export function formatarTempoCorrida(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const min = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const mm = String(min).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${s.toFixed(1).padStart(4, '0')}` : `${min}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Gap para o líder: 0.234 → "+0.234" */
export function formatarGap(segundos: number, casas = 3): string {
  return `+${segundos.toFixed(casas)}`;
}
