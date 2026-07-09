// ============================================================================
// Tipos do domínio do jogo — Projecto F1
// Este módulo não depende de React nem de nada da UI.
// ============================================================================

export type Tier = 'pequena' | 'media' | 'grande';
export type Pneu = 'soft' | 'medium' | 'hard';

// ---------------------------------------------------------------------------
// Entidades-base (dados estáticos ficam em /src/data)
// ---------------------------------------------------------------------------

export interface Motor {
  id: string;
  nome: string;
  tier: Tier;
  potencia: number;       // 0-100
  confiabilidade: number; // 0-100
  custoAnualBase: number; // em $ do jogo
  // --- Evolução do fornecedor (Fase 6; presente nos motores "vivos" do estado) ---
  /** Drift anual oculto do random walk — a trajetória do fornecedor. */
  tendencia?: number;
  /** Ratings de cada temporada passada (alimenta o ranking e a dica ▲▬▼). */
  historicoRatings?: { ano: number; potencia: number; confiabilidade: number }[];
}

export type FaseCarreiraPiloto = 'subindo' | 'auge' | 'declinio' | 'veterano';

export interface Piloto {
  id: string;
  nome: string;
  /** Código de 3 letras do país (ex.: 'BRA') — bandeira exibida na UI. */
  nacionalidade: string;
  // --- Qualidade ATUAL (o que a simulação de corrida lê) ---
  // Derivada de potencial × curva de idade; recalculada a cada virada de ano.
  classificacao: number;  // 0-100 — ritmo de uma volta
  corrida: number;        // 0-100 — ritmo de longa distância / consistência
  confiabilidade: number; // 0-100 — quanto maior, menos erros que causam DNF
  salarioBase: number;    // salário EXIGIDO no mercado (recalculado por ano)
  // --- Arco de carreira (Fase 4) ---
  idade: number;
  potencialClassificacao: number; // qualidade de pico (0-100)
  potencialCorrida: number;
  confiabilidadeBase: number;     // confiabilidade sem o bônus de experiência
  // Reputação do piloto (0-100): acumula com resultados de carreira e
  // persiste com a idade — puxa o salário (nome grande custa caro).
  reputacao: number;
  aposentado?: boolean;
  // --- Histórico de carreira (Fase 6) ---
  historico?: TemporadaPiloto[];
  titulosCarreira?: number;
  vitoriasCarreira?: number;
  podiosCarreira?: number;
}

/** Uma temporada na carreira de um piloto. */
export interface TemporadaPiloto {
  ano: number;
  equipeId: string;
  posicaoCampeonato: number;
  campeao: boolean;
}

// ---------------------------------------------------------------------------
// Chefes de equipe (Fase 6) — o jogador é um deles
// ---------------------------------------------------------------------------

export interface TemporadaChefe {
  ano: number;
  equipeId: string;
  posicaoConstrutores: number;
  campeao: boolean;
}

export interface Chefe {
  id: string;
  nome: string;
  reputacao: number;           // evolui pelos resultados (IA e jogador)
  campeonatosVencidos: number; // títulos de construtores — escada de status
  historico: TemporadaChefe[];
}

export interface Patrocinador {
  id: string;
  nome: string;
  aporte: number; // valor anual pago à equipe
  // Patrocinadores grandes exigem uma equipe de prestígio — impede a
  // equipe pequena de assinar o maior aporte no ano 1.
  prestigioMinimo: number;
  // Prestígio da MARCA (0-100): ajuda a atrair pilotos (Fase 6). Uma grife
  // de herança pode pagar pouco e ainda assim valorizar o projeto; dinheiro
  // novo paga muito e não impressiona ninguém.
  prestigio: number;
  // Meta: posição máxima no construtores. Cumprir dá bônus (receita do ano
  // seguinte); falhar bloqueia a renovação com este patrocinador por 1 ano.
  meta?: { posicaoConstrutoresMax: number; bonus: number };
}

export type Clima = 'seco' | 'chuva';

export interface Circuito {
  id: string;
  nome: string;
  voltas: number;       // número de voltas da corrida
  desgastePneu: number; // multiplicador de degradação (1.0 = normal)
  chanceChuva?: number; // 0-1; ausente → CHANCE_CHUVA_PADRAO
}

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

export interface ContratoMotor {
  motorId: string;
  duracaoAnos: number;
  custoAnual: number;
  anoInicio: number;
}

export interface ContratoPiloto {
  pilotoId: string;
  duracaoAnos: number;
  salarioAnual: number;
  anoInicio: number;
}

// ---------------------------------------------------------------------------
// Equipe
// ---------------------------------------------------------------------------

export interface CicloDesenvolvimento {
  anoDoCiclo: number;            // 1 a 5
  investimentoAcumulado: number; // soma dos investimentos no ciclo atual
}

export interface Equipe {
  id: string;
  nome: string;
  tier: Tier;          // interno — só semeia valores iniciais; a UI mostra prestígio
  ehJogador: boolean;
  orcamentoBase: number;
  reputacao: number;   // reputação do chefe (0-100) — só relevante p/ jogador
  // Prestígio da equipe (0-100): quão cobiçada ela é. Gate de patrocínio e
  // do mercado de pilotos; evolui com resultados. Distinto da reputação.
  prestigio: number;
  // Identidade visual (Fase 4): tematiza a UI e marca a equipe nas tabelas
  corPrimaria: string;
  corSecundaria: string;
  nivelChassi: number; // 0-100
  cicloDesenvolvimento: CicloDesenvolvimento;
  contratoMotor: ContratoMotor;
  pilotos: [ContratoPiloto, ContratoPiloto];
  patrocinadorId: string;
  // --- Fase 6 ---
  chefeId: string; // chefe atual (o do jogador troca junto com ele)
  /** Prestígio ao fim de cada temporada — mostra avanço/recuo entre anos. */
  historicoPrestigio?: { ano: number; prestigio: number }[];
}

// ---------------------------------------------------------------------------
// Simulação de GP
// ---------------------------------------------------------------------------

export interface TaticaCorrida {
  pilotoId: string;
  paradas: number; // 1, 2 ou 3
  stints: Pneu[];  // length === paradas + 1
}

export interface ResultadoClassificacao {
  pilotoId: string;
  equipeId: string;
  posicao: number;    // 1..N
  tempoVolta: number; // segundos (ex.: 88.734)
}

export interface ResultadoCorridaPiloto {
  pilotoId: string;
  equipeId: string;
  posicao: number;      // posição final (DNFs vão para o fim)
  pontos: number;
  dnf: boolean;
  motivoDnf?: 'quebra' | 'erro';
  tempoTotal: number;   // segundos somados da corrida (Infinity se DNF)
}

export interface ResultadoGP {
  circuitoId: string;
  grid: ResultadoClassificacao[];
  corrida: ResultadoCorridaPiloto[];
  // --- Fase 5: eventos do GP ---
  clima?: Clima;
  safetyCars?: number[]; // voltas em que o safety car entrou
  voltaMaisRapida?: { pilotoId: string; tempo: number };
}

// ---------------------------------------------------------------------------
// Estado do jogo (o que é salvo/carregado)
// ---------------------------------------------------------------------------

// Fases do loop de jogo dentro de uma temporada
export type FaseTemporada =
  | 'pre-temporada'      // contratos + investimento
  | 'gp-classificacao'   // próximo passo: rodar a quali do GP atual
  | 'gp-estrategia'      // grid definido; jogador escolhe táticas
  | 'gp-corrida'         // táticas definidas; rodar a corrida
  | 'fim-temporada'      // calendário terminou; premiação/convites/virada
  | 'fim-carreira';      // demitido sem nenhuma oferta — carreira encerrada

/**
 * Poach aceito na JANELA de pré-temporada — efeito imediato: o piloto entra
 * no assento do jogador na temporada que está sendo montada. Fica pendente
 * (e cancelável, com estorno) até confirmarPreTemporada aplicar tudo.
 */
export interface ContratacaoPendente {
  pilotoId: string;
  slot: 0 | 1;           // assento do jogador (vago OU ocupado — o atual é liberado)
  salarioAnual: number;
  duracaoAnos: number;
  custoRescisao: number; // pago no orçamento DESTA temporada
  equipeOrigemId: string;
}

export interface EstadoJogo {
  ano: number;
  seed: number;            // seed-base da carreira; cada GP deriva a sua
  equipeJogadorId: string;
  fase: FaseTemporada;
  gpAtual: number;         // índice no calendário
  equipes: Equipe[];
  calendario: string[];    // ids de circuitos
  campeonatoPilotos: Record<string, number>;      // pilotoId -> pontos
  campeonatoConstrutores: Record<string, number>; // equipeId -> pontos
  historico: ResultadoGP[];                       // GPs da temporada corrente
  // --- pilotos vivos (Fase 4): envelhecem, evoluem, aposentam, surgem ---
  pilotos: Record<string, Piloto>;
  // --- motores vivos (Fase 6): ratings evoluem por random walk anual ---
  motores: Record<string, Motor>;
  // --- chefes de equipe (Fase 6): reputação, títulos e histórico ---
  chefes: Record<string, Chefe>;
  // --- gestão da temporada ---
  premiacaoAnterior: Record<string, number>; // equipeId -> receita de premiação/bônus
  investimentosAno: Record<string, number>;  // equipeId -> investimento em dev nesta temporada
  pilotosLivres: string[];                   // pool de pilotos contratáveis agora
  patrocinadoresBloqueados: string[];        // meta falhada → sem renovação neste ano
  posicaoAnteriorJogador?: number;           // posição no construtores do ano passado
  // --- risco financeiro (Fase 4) ---
  custosIncidentesAno: number;               // reparos acumulados do JOGADOR nesta temporada
  custoRescisaoAno: number;                  // rescisões pagas por poach nesta temporada
  anosNoVermelhoSeguidos: number;            // déficits acima do limiar leve consecutivos
  /** Poaches aceitos na janela — aplicados (atomicamente) ao confirmar a pré-temporada. */
  poachesPendentes: ContratacaoPendente[];
  // --- fim de semana em andamento ---
  gridAtual?: ResultadoClassificacao[];      // grid entre a quali e a corrida
  taticasJogador?: TaticaCorrida[];          // táticas escolhidas p/ os 2 pilotos
  // --- fim de temporada em andamento ---
  convites?: string[];                       // equipeIds que convidaram o jogador
}
