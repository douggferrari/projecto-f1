// Helpers de nome/cor que leem o ESTADO (pilotos vivos incluem novatos
// que não existem no catálogo estático).

import { useJogo } from '../state/store';

export function nomePiloto(pilotoId: string): string {
  const { estado } = useJogo.getState();
  return estado?.pilotos[pilotoId]?.nome ?? pilotoId;
}

export function nomeEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.nome ?? equipeId;
}

export function corEquipe(equipeId: string): string {
  const { estado } = useJogo.getState();
  return estado?.equipes.find((e) => e.id === equipeId)?.corPrimaria ?? '#888888';
}
