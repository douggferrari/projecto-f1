# Projecto F1 🏎️

Simulador de gestão de equipe de Fórmula 1 ("Brasfoot da F1"). O jogador é o
chefe de equipe: gerencia orçamento, contratos e desenvolvimento para subir
do fundo do grid até o topo.

## Status das fases

- [x] **Fase 1** — Motor de simulação puro (`src/engine`) + dados-base (`src/data`) + testes
- [x] **Fase 2** — Loop básico jogável (carreira, contratos, orçamento, GPs, fim de temporada, UI)
- [x] **Fase 3** — Simulações ao vivo (quali ~30s, corrida ~2min volta a volta, acelerar/pular)
- [x] **Fase 4** — Profundidade de carreira: prestígio de equipe (estrelas), mercado de
      pilotos com idade/arco de carreira e "efeito Alonso", custos de incidente com risco
      de demissão, hub Sede + modos Gestão/Fim de Semana, cores por equipe na UI
- [x] **Fase 5** — Eventos de corrida: chuva (equalizador — piloto vale mais, erros ×2.5)
      e safety car (comprime o pelotão), ambos desligáveis via `EVENTOS_ATIVADOS`;
      ponto de volta mais rápida (top 10). Com eventos desligados, a corrida é
      bit-idêntica à da Fase 4 (testado).

## Comandos

```bash
npm install          # dependências
npm test             # testes do motor (Vitest)
npm run simular      # simula uma temporada completa no console
npm run simular 42   # ... com seed fixa (determinístico)
npm run balancear    # harness de calibragem (200 temporadas + sensibilidade)
npm run balancear 400 # ... com mais seeds
npm run carreira     # harness de progressão (bom × mau gestor, 12 temporadas)
npm run dev          # jogar no navegador
```

## Estrutura

```
src/
├── engine/     # motor de simulação — funções puras, sem React
│   ├── tipos.ts          # interfaces do domínio
│   ├── constantes.ts     # TODO o balanceamento, em um lugar só
│   ├── rng.ts            # RNG com seed (determinismo nos testes)
│   ├── desempenho.ts     # desempenho do carro + ciclos de desenvolvimento
│   ├── classificacao.ts  # qualifying → grid
│   ├── corrida.ts        # stints, pneus, degradação, pits, DNF
│   ├── pontuacao.ts      # pontos e campeonatos
│   ├── taticas.ts        # táticas da IA e presets
│   └── temporada.ts      # simularGP / simularTemporada
│   ├── contratos.ts      # (F2) durações, descontos, pool de pilotos livres
│   ├── orcamento.ts      # (F2) receita, gastos fixos, validação dura
│   ├── gestaoIA.ts       # (F2) pré-temporada das equipes rivais
│   ├── fimTemporada.ts   # (F2/F4) premiação, prestígio, finanças, demissão, virada
│   ├── carreira.ts       # (F2) orquestração do loop jogável
│   ├── corridaAoVivo.ts  # (F3) timeline volta a volta p/ transmissão —
│   │                     #      mesmo resultado do commit (testado)
│   ├── pilotoCarreira.ts # (F4) curva de idade, categorias, salário, novatos
│   ├── mercado.ts        # (F4) interesse do piloto (gate de prestígio, efeito Alonso)
│   └── incidentes.ts     # (F4) custos de DNF em RNG separado + estimativa de reserva
├── data/       # dados-base: 10 equipes, 6 motores, 24 pilotos,
│               # 8 patrocinadores, 12 circuitos (nomes fictícios)
├── state/      # store Zustand + catálogo + save/load em localStorage
└── ui/         # telas React + Tailwind (painel de gestão "pit wall")
```

## Notas de modelo

- Ritmo → tempo de volta: `tempo = 90s − 0.03 × ritmo`; degradação e
  modificadores de pneu são em "pontos de ritmo" (ver `constantes.ts`).
  Com 0.03, o gap melhor→pior carro fica em ~46s por corrida.
- Pneus (desgaste 1.0): o **soft** compensa até stints de ~29 voltas; acima
  disso **medium**/**hard** rendem mais. O `desgastePneu` de cada circuito
  desloca esse ponto de equilíbrio — é o que muda a estratégia ótima por pista.
- Três fontes de variância, em escalas diferentes: ruído por volta (±3-4s
  por corrida, dilui com √voltas), **forma do fim de semana** (um sorteio por
  carro/corrida, ±12s — é o que permite zebras) e DNFs (~3-4 por corrida).
- Calibragem: `npm run balancear` roda N temporadas e imprime distribuição
  por tier, paisagem de estratégia e teste de sensibilidade (estratégia boa
  no carro lento vs ruim no rápido). Itere em `constantes.ts` contra ele.
