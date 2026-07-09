# Projecto F1 — Roteiro para jogo comercial

Do estado atual (jogo completo, single-player, 100% client-side, PWA) até um
produto vendável na App Store. Ordenado por dependência: cada etapa destrava
a seguinte. Contexto: desenvolvimento no Windows + **MacBook disponível**
para builds iOS (sem custo de serviços de build na nuvem).

---

## Etapa 0 — PWA no ar (fundação, custo R$ 0)

- [x] Manifest + service worker (`vite-plugin-pwa`, atualização automática)
- [x] Ícones (192/512/maskable/apple-touch) — regenerar com `npm run icones`
- [x] Metas iOS (`apple-mobile-web-app-*`, `theme-color`, `viewport-fit=cover`)
- [ ] **Deploy com HTTPS** — Vercel/Netlify/Cloudflare Pages (grátis): `npm run build` → publicar `dist/`
- [ ] Testar instalação real no iPhone (Safari → Compartilhar → Adicionar à Tela de Início)
- [ ] Migrar o save de `localStorage` para **IndexedDB** (via `idb-keyval`) — o iOS pode
      apagar localStorage de sites sem uso por ~7 dias; IndexedDB em PWA instalada é mais estável

## Etapa 1 — Experiência mobile (pré-requisito de tudo)

- [ ] Passe de responsividade tela a tela em 390px (iPhone): tabelas condensadas ou em
      cards empilhados; painel de orçamento vira seção, não sidebar
- [ ] Navegação inferior (bottom tabs) no mobile no lugar das abas do topo
- [ ] Alvos de toque ≥ 44px (botões de pneu/paradas/velocidade da corrida ao vivo)
- [ ] Safe areas (notch/home indicator) — `env(safe-area-inset-*)` no header/nav
- [ ] Testar os fluxos longos no aparelho: pré-temporada completa, corrida ao vivo 2min, mercado
- [ ] Performance: evitar re-render da tabela inteira por volta na corrida ao vivo (memoizar linhas)

## Etapa 2 — Conta e save na nuvem (o "login")

> Recomendação: **Supabase** (Postgres + Auth + Row Level Security, faixa grátis
> generosa, LGPD-friendly). Alternativa equivalente: Firebase.

- [ ] Escolher provedor (Supabase vs Firebase) e criar o projeto
- [ ] Login: **Sign in with Apple** (obrigatório na App Store se houver login social),
      Google e e-mail/senha
- [ ] Modo convidado (jogar sem conta; vincular depois sem perder o save)
- [ ] Save na nuvem: sincronizar `EstadoJogo` (hoje ~200KB JSON) com versionamento de
      schema (`save:v2` → migrações) e resolução de conflito (last-write-wins + backup)
- [ ] Múltiplos slots de carreira por usuário
- [ ] Tela de conta na UI (login/logout/apagar conta — apagar é exigência da Apple e da LGPD)

## Etapa 3 — Escalabilidade e integridade

> O jogo é single-player offline-first — o servidor guarda saves e identidade,
> não simula corridas. Isso escala barato: sem servidor de jogo.

- [ ] Definir o que é fonte da verdade: cliente simula, servidor armazena (documentar)
- [ ] Telemetria mínima de balanceamento (posição por temporada, taxa de demissão,
      uso de estratégias) — agregada e anônima, para calibrar constantes com dados reais
- [ ] Leaderboards opcionais (ex.: pontos na carreira, título mais rápido) — aí sim exige
      validação server-side básica (limites de sanidade por temporada)
- [ ] CI (GitHub Actions): `npm test` + `tsc` + build a cada push; deploy automático do PWA

## Etapa 4 — Monetização e loja

- [ ] Decidir o modelo: **premium** (pagar uma vez, recomendado para este gênero) vs
      grátis + IAP (ex.: carreiras extras/temporadas longas). Evitar ads — briga com o gênero
- [ ] Preço e mercados (App Store Connect cuida de câmbio/impostos)
- [ ] Se houver IAP: usar **RevenueCat** (abstrai StoreKit, recibos e restauração)
- [ ] Inscrever no **App Store Small Business Program** (comissão cai de 30% → 15%
      para receita < US$ 1 mi/ano)
- [ ] Versão demo/web grátis limitada (ex.: 2 temporadas) como funil para a compra

## Etapa 5 — App Store via Capacitor (você tem MacBook: build local)

- [ ] Conta **Apple Developer** (US$ 99/ano)
- [ ] `@capacitor/core` + `@capacitor/ios`, `cap init` + `cap add ios`
- [ ] Trocar persistência local por `@capacitor/preferences` no app nativo
      (mesma interface de `persistencia.ts` — só o backend muda)
- [ ] No MacBook: Xcode + assinatura + rodar no aparelho físico
- [ ] TestFlight com 5-10 pessoas antes do review
- [ ] Materiais da loja: screenshots (6.7" e 6.1"), descrição, palavras-chave, ícone 1024
- [ ] Diretriz 4.2 (funcionalidade mínima): garantir que o app não pareça "site embrulhado" —
      haptics (`@capacitor/haptics` na largada/pódio) e splash screen nativa ajudam
- [ ] Privacidade: "nutrition label" do App Store Connect coerente com a telemetria real

## Etapa 6 — Qualidade de produto comercial

- [ ] **Onboarding/tutorial**: primeira pré-temporada guiada (orçamento → contratos →
      investimento) e dicas contextuais na primeira corrida
- [ ] Som: UI, largada, ambiente de corrida, pódio (desligável) — muda muito a percepção de valor
- [ ] Animações de transição e microinterações (pódio do título, convite de equipe grande)
- [ ] Localização: **inglês** primeiro (multiplica o mercado por ~20), depois espanhol
      — extrair strings da UI para um dicionário (o engine já separa dados de textos)
- [ ] Acessibilidade: contraste, fontes escaláveis, VoiceOver nas telas principais
- [ ] Conteúdo: mais circuitos (16-20), 2-3 gerações de novatos com narrativa,
      recordes/histórico de carreira (hall de campeões)
- [ ] Balanceamento contínuo: manter `npm run balancear`/`carreira` como gate de release

## Etapa 7 — Legal e negócio

- [ ] **Marca**: pesquisar "Projecto F1" — "F1" é marca registrada da Formula One Licensing.
      Provável necessidade de renomear (ex.: "Projecto GP", "Apex Principal"). Todos os nomes
      internos (equipes/pilotos/circuitos) já são fictícios ✓
- [ ] Política de privacidade + termos de uso (obrigatórios na App Store com login)
- [ ] LGPD: consentimento de telemetria, exportar/apagar dados da conta
- [ ] CNPJ/MEI para receber da Apple (ou pessoa física + imposto de renda — falar com contador)

## Etapa 8 — Operação pós-lançamento

- [ ] Crash/erro: Sentry (web + Capacitor)
- [ ] Analytics de produto (retenção D1/D7, funil do onboarding) — PostHog ou equivalente
- [ ] Canal de feedback dentro do jogo (link para Discord/formulário)
- [ ] Cadência de updates (conteúdo novo por temporada real de F1 é um gancho natural)

---

### Ordem sugerida de execução

**0 → 1** (PWA jogável no iPhone) → **2** (login + nuvem) → **6-onboarding/som** →
**7-marca/legal** → **5** (App Store) → **4** (venda) → **3/8** (operação).

A regra que vale para tudo: o motor (`src/engine`) permanece puro e testado —
login, nuvem e loja são camadas em volta dele, nunca dentro dele.
