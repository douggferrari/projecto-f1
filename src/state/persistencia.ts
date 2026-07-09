// ============================================================================
// Persistência do save em localStorage (chave versionada).
// Projeto Vite local (npm run dev) — localStorage disponível no navegador.
// As funções degradam com segurança fora do navegador (harness/testes).
// ============================================================================

import type { EstadoJogo } from '../engine/tipos';

// v3: Fase 6 mudou o shape do estado (motores vivos, chefes, históricos) —
// saves anteriores não são compatíveis e são ignorados na carga.
export const CHAVE_SAVE = 'projecto-f1:save:v3';

function temLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

/** Salva o estado inteiro do jogo. Devolve false se não houver storage. */
export function salvarJogo(estado: EstadoJogo): boolean {
  if (!temLocalStorage()) return false;
  try {
    localStorage.setItem(CHAVE_SAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false; // storage cheio/bloqueado — o jogo segue sem salvar
  }
}

/** Carrega o save, ou null se não existir/estiver corrompido. */
export function carregarJogo(): EstadoJogo | null {
  if (!temLocalStorage()) return null;
  try {
    const texto = localStorage.getItem(CHAVE_SAVE);
    if (!texto) return null;
    const estado = JSON.parse(texto) as EstadoJogo;
    // Validação mínima de shape — um save de versão incompatível vira null
    if (
      typeof estado.ano !== 'number' ||
      !Array.isArray(estado.equipes) ||
      !estado.equipeJogadorId ||
      typeof estado.pilotos !== 'object' ||
      typeof estado.motores !== 'object' ||
      typeof estado.chefes !== 'object'
    ) {
      return null;
    }
    return estado;
  } catch {
    return null;
  }
}

export function existeSave(): boolean {
  return temLocalStorage() && localStorage.getItem(CHAVE_SAVE) !== null;
}

export function apagarSave(): void {
  if (temLocalStorage()) localStorage.removeItem(CHAVE_SAVE);
}
