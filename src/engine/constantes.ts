// ============================================================================
// BALANCEAMENTO — todas as constantes de calibragem do jogo em um lugar só.
// Ajuste aqui sem tocar na lógica do motor.
// ============================================================================

import type { Pneu } from './tipos';

// ---------------------------------------------------------------------------
// Desempenho do carro
// desempenhoCarro = PESO_MOTOR * potencia + PESO_CHASSI * nivelChassi
// ---------------------------------------------------------------------------
export const PESO_MOTOR = 0.45;
export const PESO_CHASSI = 0.55;

// ---------------------------------------------------------------------------
// Classificação
// ritmoQuali = PESO_CARRO_QUALI * desempenhoCarro
//            + PESO_PILOTO_QUALI * piloto.classificacao
//            + random(-VARIACAO_QUALI, +VARIACAO_QUALI)
// ---------------------------------------------------------------------------
export const PESO_CARRO_QUALI = 0.7;
export const PESO_PILOTO_QUALI = 0.3;
export const VARIACAO_QUALI = 3; // amplitude do fator sorte (± pontos de ritmo)

// Conversão de ritmo para tempo de volta:
// tempoVolta = TEMPO_BASE_VOLTA - FATOR_RITMO_TEMPO * ritmo
// Esta é a constante que dita o "peso" do rating no resultado: com 0.03,
// o gap de ~31 pontos de ritmo entre o melhor e o pior carro vira ~46s numa
// corrida de 50 voltas (era ~185s com 0.12 — fundo de grid tomava volta).
export const TEMPO_BASE_VOLTA = 90.0; // segundos
export const FATOR_RITMO_TEMPO = 0.03; // segundos ganhos por ponto de ritmo

// ---------------------------------------------------------------------------
// Corrida
// ritmoBase = PESO_CARRO_CORRIDA * desempenhoCarro + PESO_PILOTO_CORRIDA * piloto.corrida
// ---------------------------------------------------------------------------
export const PESO_CARRO_CORRIDA = 0.6;
export const PESO_PILOTO_CORRIDA = 0.4;

// Ruído por volta (± pontos de ritmo). O ruído da corrida inteira cresce
// com a raiz do nº de voltas: o desvio-padrão fica em
// FATOR_RITMO_TEMPO * V/√3 * √voltas ≈ ±3-4s (2σ) por corrida com V=14.
// É o que impede P1 vs P2 do mesmo tier de ser resultado garantido.
export const VARIACAO_VOLTA = 14.0;

// Forma do fim de semana (± pontos de ritmo, UM sorteio por carro por
// corrida). Diferente do ruído por volta — que se dilui na média de ~50
// voltas — a forma desloca a corrida inteira (~±7,5s com 5.0). É o que
// permite a "zebra": um carro médio num grande dia incomodando os grandes.
// Sem este termo, os 3 grandes venceriam 100% das corridas para sempre.
export const VARIACAO_FORMA = 8.0;

// Modificador de ritmo no início do stint, por composto.
// O soft precisa de vantagem grande o bastante para compensar sua
// degradação em stints curtos/pistas de desgaste baixo — é isso que faz
// a escolha de composto depender do circuito.
export const MODIFICADOR_PNEU: Record<Pneu, number> = {
  soft: +6.0,
  medium: 0.0,
  hard: -3.5,
};

// Perda de ritmo acumulada por volta do stint (degradação).
// Calibrada junto com MODIFICADOR_PNEU: o cruzamento soft→medium fica em
// stints de ~20 voltas (desgaste 1.0) e o soft→hard em ~32 voltas.
export const DEGRADACAO_POR_VOLTA: Record<Pneu, number> = {
  soft: 0.7,
  medium: 0.3,
  hard: 0.1,
};

// Teto da perda de ritmo por degradação numa volta (pontos de ritmo).
// Evita que stints muito longos gerem ritmo absurdamente negativo
// (20 pontos ≈ 0,6s/volta de perda máxima).
export const DEGRADACAO_MAXIMA_POR_VOLTA = 20;

// Tempo equivalente perdido em cada pit stop (segundos).
// Precisa ser da mesma ordem que o custo de degradação de um stint,
// senão "menos paradas" domina qualquer escolha de composto.
export const CUSTO_PIT_STOP = 8;

// Bônus de largada: partir na frente vale alguns segundos "virtuais",
// representando pista limpa / dificuldade de ultrapassar.
// tempoTotal -= BONUS_POSICAO_GRID * (numCarros - posicaoGrid)
// Com 0.12, a pole vale ~2,3s sobre o último do grid de 20 carros.
export const BONUS_POSICAO_GRID = 0.12; // segundos por posição ganha no grid

// ---------------------------------------------------------------------------
// Confiabilidade / DNF (probabilidades POR CORRIDA, por carro)
// chance = (100 - confiabilidade) * FATOR
// Ex.: motor com confiabilidade 70 → 30 * 0.006 = 18% de quebra por corrida
// O atrito é o principal mecanismo que abre portas para os tiers de baixo:
// com estes fatores, uma corrida tem ~3 DNFs em média.
// ---------------------------------------------------------------------------
export const FATOR_QUEBRA_MOTOR = 0.006;
export const FATOR_ERRO_PILOTO = 0.004;

// ---------------------------------------------------------------------------
// Pontuação (padrão F1 para os 10 primeiros)
// ---------------------------------------------------------------------------
export const PONTOS_POR_POSICAO = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

// ---------------------------------------------------------------------------
// Desenvolvimento do carro (ciclos de 5 anos)
// Ganho anual de chassi com retornos decrescentes:
//   ganho = GANHO_MAXIMO_ANUAL * (1 - e^(-investimento / ESCALA_INVESTIMENTO))
// Ao fim do ciclo (ano 5), "salto de regulamento":
//   novoNivel = NIVEL_POS_REGULAMENTO_BASE
//             + RETENCAO_REGULAMENTO * (nivelAtual - NIVEL_POS_REGULAMENTO_BASE)
//             + BONUS_INVESTIMENTO_CICLO * min(1, investimentoAcumulado / INVESTIMENTO_CICLO_REFERENCIA)
// ---------------------------------------------------------------------------
export const GANHO_MAXIMO_ANUAL = 10;             // pontos de chassi/ano no teto
// ESCALA alta = investir mais continua rendendo mais (menos saturação):
// ganho(30M)=5.8, ganho(60M)=8.2, ganho(120M)=9.7 — orçamento diferencia.
export const ESCALA_INVESTIMENTO = 35_000_000;    // $ p/ ~63% do ganho máximo
export const ANOS_POR_CICLO = 5;
export const NIVEL_POS_REGULAMENTO_BASE = 40;     // piso após troca de regulamento
// O salto de regulamento é A janela de ultrapassagem de quem vem de trás:
// retém pouco do nível antigo e paga muito pelo investimento acumulado no
// ciclo — quem investiu consistente entra no regulamento novo na frente.
export const RETENCAO_REGULAMENTO = 0.2;          // fração do excedente mantida
export const BONUS_INVESTIMENTO_CICLO = 22;       // bônus máx. p/ ciclo bem investido
export const INVESTIMENTO_CICLO_REFERENCIA = 220_000_000; // referência de ciclo "cheio"

// ---------------------------------------------------------------------------
// Premiação de fim de temporada por posição no construtores (1º..10º)
// ---------------------------------------------------------------------------
// Distribuição achatada de propósito: o fundo do grid precisa de fôlego
// para investir, senão "começar pequeno e subir" não fecha a conta.
export const PREMIACAO_CONSTRUTORES = [
  52_000_000, 46_000_000, 41_000_000, 37_000_000, 34_000_000,
  31_000_000, 29_000_000, 27_000_000, 26_000_000, 25_000_000,
];

// ===========================================================================
// FASE 2 — Constantes de gestão (contratos, orçamento, reputação, convites)
// Nada abaixo desta linha afeta a simulação de corrida.
// ===========================================================================

// ---------------------------------------------------------------------------
// Contratos: contrato mais longo dá desconto no custo anual, mas trava.
// custoAnual = base * (1 - DESCONTO_POR_ANO_CONTRATO * (duracaoAnos - 1)),
// limitado a DESCONTO_MAXIMO_CONTRATO. Vale para motor e para pilotos.
// ---------------------------------------------------------------------------
export const DESCONTO_POR_ANO_CONTRATO = 0.04;
export const DESCONTO_MAXIMO_CONTRATO = 0.12; // teto do desconto (contrato de 4+ anos)
export const DURACAO_MAXIMA_CONTRATO = 5;

// ---------------------------------------------------------------------------
// Patrocínio: patrocinadores grandes só assinam com chefes de reputação.
// Mapa aporte → reputação mínima fica em data/patrocinadores.ts; aqui só a
// regra da meta: falhar a meta bloqueia a renovação no ano seguinte.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Reputação do chefe (0-100)
// expectativa = min(EXPECTATIVA_POR_TIER[tier], posicaoAnterior + 1)
// delta = (expectativa - posicaoFinal) * REPUTACAO_POR_POSICAO, com teto.
// ---------------------------------------------------------------------------
export const EXPECTATIVA_POR_TIER: Record<'pequena' | 'media' | 'grande', number> = {
  pequena: 9, // fundo do grid: escapar da última posição já cumpre a expectativa
  media: 6,
  grande: 2,
};
// A posição anterior só endurece a expectativa com 2 posições de folga —
// melhorar devagar não pode virar punição de reputação.
export const FOLGA_EXPECTATIVA_POSICAO_ANTERIOR = 2;
export const REPUTACAO_POR_POSICAO = 3; // pontos de reputação por posição acima/abaixo
export const REPUTACAO_DELTA_MAXIMO = 12; // teto de variação por temporada

// ---------------------------------------------------------------------------
// Convites de outras equipes no fim da temporada.
// Uma equipe de tier igual/superior convida se a reputação do jogador
// alcançar o limiar do tier dela E ela tiver terminado abaixo da
// expectativa do próprio tier (equipe frustrada procura chefe novo).
// ---------------------------------------------------------------------------
export const REPUTACAO_MINIMA_CONVITE: Record<'pequena' | 'media' | 'grande', number> = {
  pequena: 0,
  media: 60,
  grande: 80,
};

// ---------------------------------------------------------------------------
// IA de gestão dos rivais: fração da receita que a IA reserva para
// desenvolvimento antes de decidir salários (não torra tudo em piloto).
// ---------------------------------------------------------------------------
export const RESERVA_DESENVOLVIMENTO_IA = 0.25;

// ===========================================================================
// FASE 4 — Prestígio, mercado de pilotos, arco de carreira e risco financeiro
// Nada abaixo desta linha afeta a simulação de corrida.
// ===========================================================================

// ---------------------------------------------------------------------------
// Prestígio de equipe (0-100) — quão cobiçada a equipe é (pilotos e
// patrocinadores olham para ele). Distinto da reputação do chefe.
// Evolui no fim da temporada: expectativa = posição da equipe no ranking
// de prestígio do grid; superar/ficar abaixo move o prestígio.
// ---------------------------------------------------------------------------
export const PRESTIGIO_POR_POSICAO = 2;   // pontos por posição acima/abaixo da expectativa
export const PRESTIGIO_DELTA_MAXIMO = 8;  // teto de variação por temporada
export const PRESTIGIO_MINIMO = 5;
export const PRESTIGIO_MAXIMO = 98;

// Convites ao chefe: uma equipe (de prestígio igual/maior) frustrada convida
// se a reputação do chefe alcançar FATOR × prestígio dela.
export const FATOR_REPUTACAO_CONVITE = 0.9;

// ---------------------------------------------------------------------------
// Curva de carreira do piloto: a qualidade atual = potencial × multiplicador
// da idade. O ritmo de UMA VOLTA (classificação) decai mais rápido que o
// ritmo de corrida; a confiabilidade melhora com a experiência.
// ---------------------------------------------------------------------------
export const IDADE_ESTREIA = 18;
export const MULT_IDADE_INICIAL = 0.78;    // multiplicador aos 18 anos
export const IDADE_PICO_INICIO = 27;       // daqui até o fim do pico, mult = 1.0
export const IDADE_PICO_FIM = 32;
export const IDADE_DECLINIO_TARDIO = 36;   // depois daqui o declínio acelera
export const DECLINIO_ANUAL_QUALI = 0.014;        // 33-36 anos
export const DECLINIO_ANUAL_CORRIDA = 0.007;
export const DECLINIO_TARDIO_QUALI = 0.035;       // 37+
export const DECLINIO_TARDIO_CORRIDA = 0.02;
export const MULT_IDADE_MINIMO = 0.55;
// Experiência: +confiabilidade por ano acima dos 22, com teto
export const EXPERIENCIA_CONF_POR_ANO = 0.6;
export const EXPERIENCIA_CONF_MAXIMA = 10;

// Aposentadoria: a partir dos 38, chance crescente por ano
export const IDADE_APOSENTADORIA_BASE = 38;
export const CHANCE_APOSENTADORIA_POR_ANO = 0.25; // 38: 25%, 39: 50%, 40: 75%, 41+: 100%

// Pipeline de novatos: 1-2 por temporada, com cauda rara de craque
export const NOVATOS_POR_ANO_MINIMO = 1;
export const CHANCE_SEGUNDO_NOVATO = 0.5;
export const POTENCIAL_NOVATO_MINIMO = 62;
export const POTENCIAL_NOVATO_MAXIMO = 86;
export const CHANCE_NOVATO_CRAQUE = 0.12;          // cauda rara
export const POTENCIAL_CRAQUE_MINIMO = 87;
export const POTENCIAL_CRAQUE_MAXIMO = 96;

// Reputação do piloto (0-100): acumula com resultados e NÃO decai com a
// idade — é ela que puxa o salário exigido (nome grande custa caro).
export const REPUTACAO_PILOTO_VITORIA = 3;
export const REPUTACAO_PILOTO_PODIO = 1;
export const REPUTACAO_PILOTO_TITULO = 12;

// Salário exigido = BASE × e^(EXPOENTE × score), score = mistura de
// qualidade atual e reputação. Calibrado para reproduzir os salários
// originais do grid (elite ~$24 mi, meio ~$8 mi, novato ~$1,5 mi).
export const SALARIO_PESO_QUALIDADE = 0.55;
export const SALARIO_PESO_REPUTACAO = 0.45;
export const SALARIO_MERCADO_BASE = 350_000;
export const SALARIO_MERCADO_EXPOENTE = 0.0465;
export const SALARIO_MINIMO = 800_000;

// ---------------------------------------------------------------------------
// Mercado: interesse do piloto numa oferta.
// score = pesoPrestigio × (prestígio da equipe − (ambição − FOLGA)) / 25
//       + pesoSalario × min(TETO, salárioOferta/salárioExigido − 1)
// A ambição efetiva = potencial × fator da fase de carreira: jovens ambicionam
// projeto grande; veteranos realizados aceitam descer por salário — o
// "efeito Alonso" vem do pesoSalario crescer com a idade.
// ---------------------------------------------------------------------------
export const FATOR_AMBICAO_POR_FASE = { subindo: 1.0, auge: 0.85, declinio: 0.55, veterano: 0.4 } as const;
export const PESO_SALARIO_POR_FASE = { subindo: 0.25, auge: 0.4, declinio: 0.65, veterano: 0.8 } as const;
export const FOLGA_AMBICAO = 25;          // ambição 90 → satisfeito com prestígio 65+
export const TETO_SCORE_SALARIO = 0.5;    // dinheiro não compra tudo
export const BONUS_SEM_VOLANTE = 0.3;     // piloto sem contrato aceita mais fácil
export const LIMIAR_ACEITE_EMPREGADO = 0.15; // fricção de sair de um contrato
export const LIMIAR_ACEITE_LIVRE = -0.25;
export const LIMIAR_ACEITE_DESCER_NO_AUGE = 0.45; // auge raramente desce de prestígio
// Gate duro: jovem de potencial elite não assina com equipe pequena
export const POTENCIAL_ELITE = 87;
export const PRESTIGIO_MINIMO_JOVEM_ELITE = 62;
// Rescisão ao roubar piloto contratado (custo = anos restantes × salário × fator)
export const FATOR_RESCISAO = 0.5;

// ---------------------------------------------------------------------------
// Custos de incidente (Bloco C) — pagos pelo jogador durante a temporada.
// Sorteados num RNG DERIVADO SEPARADO (etapa 4) — a corrida não muda.
// Alvo: custo esperado ≈ 15-25% do resíduo de uma equipe pequena, com
// variância alta (ano de azar = 2-3× o esperado).
// ---------------------------------------------------------------------------
export const CUSTO_REPARO_QUEBRA = 450_000;   // custo-base de quebra mecânica
export const CUSTO_REPARO_ERRO = 850_000;     // batida do piloto = dano maior
export const MULTIPLICADOR_DANO_MINIMO = 0.5; // sorteio de severidade por incidente
export const MULTIPLICADOR_DANO_MAXIMO = 4.0; // cauda gorda: um ano de azar custa 2-3× o esperado
// Batida com perda total: raro, caro, e é o azar que nem a reserva prudente
// cobre por completo — a fonte dos anos catastróficos.
export const CHANCE_PERDA_TOTAL = 0.06;       // por DNF de erro do piloto
export const CUSTO_PERDA_TOTAL = 11_000_000;
// Estimativa de reserva mostrada ao jogador (= custo médio esperado).
// Reservá-la protege na maioria dos anos, mas um ano de perda total
// ainda fura o colchão — a estimativa é um guia, não um seguro.
export const MARGEM_ESTIMATIVA_RESERVA = 1.0;

// Saldo negativo no fim do ano:
//   déficit ≤ LEVE  → aviso + reputação do chefe cai (zona amarela)
//   déficit  > LEVE → "no vermelho": conta para a demissão
//   déficit  > GRAVE, ou dois anos seguidos no vermelho → demitido
// A zona de aviso é larga de propósito: com a regra dos 2 anos seguidos
// sendo quadrática, um limiar apertado mataria o all-in em 100% das
// carreiras (deixaria de ser aposta) — calibrado no harness.
export const LIMIAR_DEFICIT_LEVE = 9_000_000;
export const LIMIAR_DEFICIT_GRAVE = 17_000_000;
export const QUEDA_REPUTACAO_DEFICIT_LEVE = 6;
export const QUEDA_REPUTACAO_DEFICIT_VERMELHO = 10;
// Demitido: recebe ofertas de equipes de prestígio ≤ o da equipe atual;
// sem nenhuma oferta (reputação abaixo do piso), a carreira termina.
export const REPUTACAO_MINIMA_EMPREGO = 25;

// ===========================================================================
// FASE 5 — Eventos de corrida (chuva e safety car) e volta mais rápida.
// TUDO DESLIGÁVEL: com EVENTOS_ATIVADOS = false, a corrida é bit-idêntica
// à da Fase 4 (o sorteio de eventos usa um RNG derivado separado, etapa 6).
// ===========================================================================
export const EVENTOS_ATIVADOS = true;

// ---------------------------------------------------------------------------
// Chuva: o grande equalizador. Na chuva o CARRO pesa menos e o PILOTO pesa
// mais no ritmo, erros ficam muito mais prováveis, e os compostos importam
// menos (todo mundo em pneu de chuva na prática).
// A chance de chuva é por circuito (data/calendario.ts).
// ---------------------------------------------------------------------------
export const CHANCE_CHUVA_PADRAO = 0.15;          // se o circuito não definir
export const PESO_CARRO_CORRIDA_CHUVA = 0.45;     // seco: 0.60
export const PESO_PILOTO_CORRIDA_CHUVA = 0.55;    // seco: 0.40
export const MULT_ERRO_CHUVA = 2.5;               // chance de erro do piloto ×2.5
export const MULT_MODIFICADOR_PNEU_CHUVA = 0.4;   // compostos importam menos
export const MULT_DEGRADACAO_CHUVA = 0.6;         // pneu sofre menos termicamente
export const MULT_VARIACAO_VOLTA_CHUVA = 1.4;     // mais imprevisibilidade por volta

// ---------------------------------------------------------------------------
// Safety car: comprime o pelotão. Na volta sorteada, o gap de cada carro
// para o líder é reduzido para RETENCAO_GAP_SC do que era — quem vinha
// atrás ganha nova chance de brigar nas voltas restantes.
// ---------------------------------------------------------------------------
export const CHANCE_SAFETY_CAR = 0.3;             // por corrida
export const CHANCE_SEGUNDO_SAFETY_CAR = 0.15;
export const MULT_SAFETY_CAR_CHUVA = 1.8;         // chuva → mais SC
export const RETENCAO_GAP_SC = 0.35;              // 65% do gap é apagado
export const VOLTA_MINIMA_SC = 5;                 // SC não sai na largada...
export const MARGEM_FINAL_SC = 8;                 // ...nem nas últimas voltas

// ---------------------------------------------------------------------------
// Volta mais rápida: +1 ponto se o dono dela terminar no top 10.
// (Voltas sob compressão de SC não contam — seriam artificialmente rápidas.)
// ---------------------------------------------------------------------------
export const PONTOS_VOLTA_MAIS_RAPIDA = 1;
export const POSICAO_MAXIMA_PONTO_VMR = 10;

// ===========================================================================
// FASE 6 — Prestígio de patrocinador, evolução de motores, chefes e status.
// Nada abaixo desta linha afeta a simulação de corrida.
// ===========================================================================

// ---------------------------------------------------------------------------
// Prestígio do patrocinador como ímã de pilotos (Bloco A).
// prestigioEfetivo = prestigioEquipe
//                  + min(BONUS_MAX_PATROCINIO, patrocinador.prestigio × PESO)
// O bônus AJUDA mas não fura a regra dura: com BONUS_MAX = 12, uma equipe
// 1-estrela (prestígio ~35) chega no máximo a 47 — ainda abaixo do gate do
// jovem elite (62). Já uma intermediária (52) alcança 64 e passa a disputar
// pilotos que estariam fora do alcance.
// ---------------------------------------------------------------------------
export const PESO_PRESTIGIO_PATROCINIO = 0.15;
export const BONUS_MAX_PATROCINIO = 12;

// ---------------------------------------------------------------------------
// Evolução dos motores (Bloco B): random walk determinístico com reversão
// à média. Cada fornecedor carrega uma TENDÊNCIA oculta (drift anual) que
// persiste entre anos e muda devagar — é ela que cria trajetórias de
// "subindo/estável/caindo" sem ninguém disparar para 100 nem desabar.
//   tendencia' = clamp(tendencia × PERSISTENCIA + ruído, ±TENDENCIA_MAX)
//   rating'    = clamp(rating + tendencia' + REVERSAO × (CENTRO − rating), MIN..MAX)
// ---------------------------------------------------------------------------
export const MOTOR_TENDENCIA_MAX = 2.2;        // drift máximo por ano (pontos)
export const MOTOR_PERSISTENCIA_TENDENCIA = 0.7; // memória da trajetória
export const MOTOR_RUIDO_TENDENCIA = 1.0;      // quanto a trajetória muda por ano
export const MOTOR_REVERSAO_MEDIA = 0.06;      // força que puxa para o centro
export const MOTOR_CENTRO_POTENCIA = 80;
export const MOTOR_CENTRO_CONFIABILIDADE = 82;
export const MOTOR_POTENCIA_MINIMA = 60;
export const MOTOR_POTENCIA_MAXIMA = 97;
export const MOTOR_CONF_MINIMA = 62;
export const MOTOR_CONF_MAXIMA = 96;
// Dica de tendência na UI (▲/▬/▼): variação da potência nos últimos 2 anos
export const LIMIAR_TENDENCIA_VISIVEL = 1.5;

// ---------------------------------------------------------------------------
// Chefes de equipe (Bloco C): reputação da IA evolui como a do jogador
// (expectativa = ranking de prestígio) e títulos de construtores sobem a
// escada de status — Lendário com 3 ou mais campeonatos.
// ---------------------------------------------------------------------------
export const STATUS_CHEFE: { minimo: number; nome: string }[] = [
  { minimo: 3, nome: 'Lendário' },
  { minimo: 2, nome: 'Consagrado' },
  { minimo: 1, nome: 'Estabelecido' },
  { minimo: 0, nome: 'Novato' },
];

// Eficiência de investimento da IA: fração do resíduo que vira de fato
// desenvolvimento (o resto é desperdício de gestão). É a vantagem
// estrutural de um bom chefe humano sobre a burocracia dos rivais — sem
// ela, o orçamento-base maior das equipes grandes torna a ascensão de uma
// equipe pequena impossível em qualquer horizonte.
export const EFICIENCIA_INVESTIMENTO_IA = 0.35;
