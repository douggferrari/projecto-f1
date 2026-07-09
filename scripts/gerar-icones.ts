// ============================================================================
// Gera os PNGs do PWA a partir de public/icone-app.svg — npm run icones
// (roda uma vez; os PNGs gerados ficam commitados em /public)
// ============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const raiz = join(import.meta.dirname, '..');
const svg = readFileSync(join(raiz, 'public', 'icone-app.svg'));

/** Ícone padrão: o SVG rasterizado direto. */
async function gerar(nome: string, tamanho: number): Promise<void> {
  await sharp(svg).resize(tamanho, tamanho).png().toFile(join(raiz, 'public', nome));
  console.log(`✓ ${nome} (${tamanho}×${tamanho})`);
}

/**
 * Ícone "maskable": a arte é reduzida para ~80% sobre o fundo, para nada
 * importante ser cortado quando o Android/iOS aplica a máscara redonda.
 */
async function gerarMaskable(nome: string, tamanho: number): Promise<void> {
  const arte = Math.round(tamanho * 0.8);
  const margem = Math.round((tamanho - arte) / 2);
  const arteBuffer = await sharp(svg).resize(arte, arte).png().toBuffer();
  await sharp({
    create: { width: tamanho, height: tamanho, channels: 4, background: '#11141b' },
  })
    .composite([{ input: arteBuffer, left: margem, top: margem }])
    .png()
    .toFile(join(raiz, 'public', nome));
  console.log(`✓ ${nome} (${tamanho}×${tamanho}, maskable)`);
}

await gerar('pwa-192.png', 192);
await gerar('pwa-512.png', 512);
await gerar('apple-touch-icon.png', 180);
await gerarMaskable('pwa-maskable-512.png', 512);
console.log('Ícones gerados em /public.');
