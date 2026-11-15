import type { ModeloAula } from "@/lib/dados";

export type Segmento = "infantil" | "fundamental";

export type Campo = {
  id: string;
  label: string;
  ph?: string;
  linhas?: number;
};

export type Momento = {
  id: string;
  nome: string;
  min: number;
  guia: string;
  campos: Campo[];
  /** Momento do catecismo: oferece o banco de perguntas da disciplina. */
  catecismo?: boolean;
};

/** Conteúdo de um plano: { momento: { campo: texto } } */
export type Conteudo = Record<string, Record<string, string>>;

const catecismo = (min: number): Momento => ({
  id: "catecismo",
  nome: "Catecismo",
  min,
  catecismo: true,
  guia: "Recitação de pé, para focar a turma e gravar a matéria na memória de longo prazo.",
  campos: [
    { id: "pergunta", label: "Pergunta", ph: "Pergunta do catecismo da disciplina", linhas: 2 },
    { id: "resposta", label: "Resposta", ph: "Resposta que a turma vai recitar", linhas: 2 },
  ],
});

const SETE: Momento[] = [
  catecismo(3),
  {
    id: "faca_agora",
    nome: "Faça Agora",
    min: 3,
    guia: "Atividade escrita curta e autogerenciada, afixada no quadro ou em folha, iniciada em silêncio assim que o aluno senta, sem orientação verbal.",
    campos: [
      { id: "atividade", label: "Atividade de recuperação de memória", linhas: 3 },
      { id: "local", label: "Onde estará afixada", ph: "Quadro ou folha", linhas: 1 },
    ],
  },
  {
    id: "conexao",
    nome: "Conexão & Objetivo",
    min: 4,
    guia: "Conecte o conteúdo novo a algo que o aluno já domina, declare o objetivo da aula e apresente o vocabulário-chave.",
    campos: [
      { id: "ponte", label: "Ponte com o que o aluno já domina", linhas: 2 },
      { id: "objetivo", label: "Objetivo da aula", linhas: 1 },
      { id: "vocabulario", label: "Vocabulário-chave", linhas: 1 },
    ],
  },
  {
    id: "mini_licao",
    nome: "Mini Lição",
    min: 10,
    guia: "Apresente os novos conceitos em passos pequenos. O registro no quadro é o modelo exato da folha do aluno (quadro = papel). Dê orientações de pé, parado e com poucas palavras.",
    campos: [
      { id: "passos", label: "Passos do novo conceito", linhas: 4 },
      { id: "quadro", label: "Registro do quadro (modelo da folha do aluno)", linhas: 2 },
    ],
  },
  {
    id: "pratica_guiada",
    nome: "Prática Guiada",
    min: 10,
    guia: "Eu faço, nós fazemos. Troque \"Entenderam?\" por perguntas direcionadas, alterne \"virem e conversem\" de 1 minuto e use a chamada de surpresa. Se o aluno errar, volte a ele até a resposta correta (sem escapatória).",
    campos: [
      { id: "exemplos", label: "Exemplos resolvidos com a turma", linhas: 2 },
      { id: "perguntas", label: "Perguntas direcionadas", linhas: 3 },
      { id: "virem", label: "Momentos de \"virem e conversem\"", linhas: 2 },
    ],
  },
  {
    id: "pratica_independente",
    nome: "Prática Independente",
    min: 10,
    guia: "Os alunos resolvem a sequência de exercícios sozinhos. Circule pela sala com olhar de radar, identificando dificuldades.",
    campos: [
      { id: "exercicios", label: "Sequência de exercícios", linhas: 2 },
      { id: "dificuldades", label: "Dificuldades a observar", linhas: 2 },
    ],
  },
  {
    id: "verificacao",
    nome: "Verificação",
    min: 2,
    guia: "Faça 2 a 3 perguntas curtas e individuais para checar se o objetivo da aula foi atingido.",
    campos: [{ id: "perguntas", label: "Perguntas de verificação", linhas: 3 }],
  },
];

const QUATRO: Momento[] = [
  { ...catecismo(5), guia: "Recitação de pé, para focar a turma e fixar na memória." },
  {
    id: "objetivo_mini",
    nome: "Objetivo & Mini Lição",
    min: 10,
    guia: "Declare o objetivo e apresente em passos pequenos, com poucas palavras e demonstração.",
    campos: [
      { id: "objetivo", label: "Objetivo da aula", linhas: 1 },
      { id: "vocabulario", label: "Vocabulário-chave", linhas: 1 },
      { id: "passos", label: "Passos do conceito ou movimento", linhas: 3 },
    ],
  },
  {
    id: "pratica_guiada",
    nome: "Prática Guiada",
    min: 10,
    guia: "Eu faço, nós fazemos. Envolva todos, sem escapatória.",
    campos: [
      { id: "atividades", label: "Atividades feitas junto com a turma", linhas: 2 },
      { id: "comandos", label: "Perguntas ou comandos planejados", linhas: 2 },
    ],
  },
  {
    id: "pratica_individual",
    nome: "Prática Individual",
    min: 15,
    guia: "Circule com olhar de radar, identificando quem precisa de ajuda.",
    campos: [
      { id: "atividade", label: "Atividade ou circuito que cada aluno realiza", linhas: 2 },
      { id: "observar", label: "Pontos a observar", linhas: 2 },
    ],
  },
];

const artesMusica = (segmento: Segmento): Momento[] => [
  { ...catecismo(5), guia: "Recitação de pé, para focar a turma e fixar na memória." },
  {
    id: "objetivo",
    nome: "Objetivo",
    min: 2,
    guia: "Declare com clareza o que será aprendido ou produzido.",
    campos: [{ id: "objetivo", label: "Objetivo da aula", linhas: 1 }],
  },
  {
    id: "mini_licao",
    nome: "Mini Lição",
    min: 10,
    guia: "Mostre antes de pedir, em passos pequenos e com poucas palavras.",
    campos: [
      { id: "apresentacao", label: "Técnica, obra, artista ou conceito musical", linhas: 2 },
      { id: "demonstracao", label: "Demonstração", linhas: 2 },
    ],
  },
  {
    id: "atividade_pratica",
    nome: "Atividade Prática",
    min: segmento === "infantil" ? 20 : 25,
    guia: "Circule, oriente individualmente e observe o progresso de cada aluno.",
    campos: [
      { id: "proposta", label: "Proposta da atividade", linhas: 2 },
      { id: "materiais", label: "Materiais ou instrumentos", linhas: 1 },
      { id: "observar", label: "Pontos a observar", linhas: 2 },
    ],
  },
];

const LEITURA: Momento[] = [
  {
    id: "leitura",
    nome: "Leitura",
    min: 0,
    guia: "Tempo de literatura infantil. Informe apenas o livro e as páginas a serem lidas. Este registro não passa pela revisão.",
    campos: [
      { id: "livro", label: "Livro", ph: "Título e autor", linhas: 1 },
      { id: "paginas", label: "Páginas", ph: "Exemplo: 12 a 18", linhas: 1 },
    ],
  },
];

export function momentosDo(modelo: ModeloAula, segmento: Segmento): Momento[] {
  switch (modelo) {
    case "sete_momentos":
      return SETE;
    case "quatro_momentos":
      return QUATRO;
    case "artes_musica":
      return artesMusica(segmento);
    case "leitura":
      return LEITURA;
  }
}

export function duracaoAula(segmento: Segmento) {
  return segmento === "infantil" ? 40 : 45;
}

/** Limpa o conteúdo recebido do formulário: só momentos e campos do modelo, só texto. */
export function limparConteudo(bruto: unknown, momentos: Momento[]): Conteudo {
  const limpo: Conteudo = {};
  const fonte = (bruto && typeof bruto === "object" ? bruto : {}) as Record<string, unknown>;
  for (const m of momentos) {
    const blocoBruto = (fonte[m.id] && typeof fonte[m.id] === "object" ? fonte[m.id] : {}) as Record<string, unknown>;
    const bloco: Record<string, string> = {};
    for (const c of m.campos) {
      const v = blocoBruto[c.id];
      if (typeof v === "string" && v.trim()) bloco[c.id] = v.slice(0, 4000);
    }
    if (Object.keys(bloco).length) limpo[m.id] = bloco;
  }
  return limpo;
}

/** Momentos sem nenhum campo preenchido. */
export function momentosVazios(conteudo: Conteudo, momentos: Momento[]): string[] {
  return momentos.filter((m) => !m.campos.some((c) => conteudo[m.id]?.[c.id]?.trim())).map((m) => m.nome);
}
