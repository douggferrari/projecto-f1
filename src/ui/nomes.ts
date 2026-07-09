// Helpers de nome/cor que leem o ESTADO (pilotos vivos incluem novatos
// que não existem no catálogo estático).

import { useJogo } from '../state/store';

// Bandeiras por código de nacionalidade (3 letras) — fallback bandeira branca
const BANDEIRAS: Record<string, string> = {
  BRA: '🇧🇷', JPN: '🇯🇵', FRA: '🇫🇷', ITA: '🇮🇹', BEL: '🇧🇪', SWE: '🇸🇪',
  POR: '🇵🇹', POL: '🇵🇱', ARG: '🇦🇷', NED: '🇳🇱', ESP: '🇪🇸', IRL: '🇮🇪',
  BUL: '🇧🇬', RSA: '🇿🇦', GER: '🇩🇪', GBR: '🇬🇧', AUS: '🇦🇺',
};

export function bandeira(nacionalidade?: string): string {
  return BANDEIRAS[nacionalidade ?? ''] ?? '🏳️';
}

/** Nome do piloto com a bandeira da nacionalidade (padrão nas tabelas). */
export function nomePiloto(pilotoId: string): string {
  const { estado } = useJogo.getState();
  const piloto = estado?.pilotos[pilotoId];
  return piloto ? `${bandeira(piloto.nacionalidade)} ${piloto.nome}` : pilotoId;
}

export function nomeEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.nome ?? equipeId;
}

export function corEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.corPrimaria ?? '#888888';
}
