import type { Papel, Perfil } from "@/lib/dados";

export type Secao = "onboarding" | "treinamento";
export type Publico = "todos" | "papeis" | "pessoas";

export const NOME_SECAO: Record<Secao, string> = { onboarding: "Onboarding", treinamento: "Treinamentos" };
export const ROTA_SECAO: Record<Secao, string> = { onboarding: "/onboarding", treinamento: "/treinamentos" };

export type Curso = {
  id: number;
  secao: Secao;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  publicado: boolean;
  publico: Publico;
  papeis: Papel[];
  ordem: number;
};

export type Aula = {
  id: number;
  curso_id: number;
  ordem: number;
  titulo: string;
  descricao: string | null;
  youtube_id: string;
  pergunta: string | null;
  opcoes: string[] | null;
};

export type Progresso = {
  aula_id: number;
  perfil_id: string;
  trechos: number[];
  percentual: number;
  posicao: number;
  tentativas: number;
  acertou: boolean | null;
  concluida_em: string | null;
  atualizado_em: string;
};

export const CAMPOS_CURSO = "id, secao, titulo, descricao, prazo, publicado, publico, papeis, ordem";
export const CAMPOS_AULA = "id, curso_id, ordem, titulo, descricao, youtube_id, pergunta, opcoes";
export const CAMPOS_PROGRESSO = "aula_id, perfil_id, trechos, percentual, posicao, tentativas, acertou, concluida_em, atualizado_em";

/** Extrai o código do vídeo de um link do YouTube (ou aceita o próprio código). */
export function idDoYoutube(entrada: string): string | null {
  const t = entrada.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(t)) return t;
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      id = u.searchParams.get("v") ?? u.pathname.match(/\/(?:embed|shorts|live|v)\/([^/?#]+)/)?.[1] ?? null;
    }
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** O curso é destinado a esta pessoa (independe de estar publicado). */
export function ehPublicoDo(curso: Curso, perfil: Pick<Perfil, "id" | "funcoes">, pessoasDoCurso: Set<string>) {
  if (curso.publico === "todos") return true;
  if (curso.publico === "papeis") return curso.papeis.some((p) => perfil.funcoes.includes(p));
  return pessoasDoCurso.has(perfil.id);
}

export type Situacao = "concluido" | "andamento" | "nao_iniciado" | "atrasado";

export function situacaoCurso(total: number, concluidas: number, iniciadas: number, prazo: string | null, hoje: string): Situacao {
  if (total > 0 && concluidas >= total) return "concluido";
  if (prazo && prazo < hoje) return "atrasado";
  return iniciadas > 0 ? "andamento" : "nao_iniciado";
}

export const NOME_SITUACAO: Record<Situacao, string> = {
  concluido: "Concluído",
  andamento: "Em andamento",
  nao_iniciado: "Não iniciado",
  atrasado: "Atrasado",
};

export const COR_SITUACAO: Record<Situacao, string> = {
  concluido: "bg-trinitas-suave text-trinitas-texto",
  andamento: "bg-lima-suave text-lima-texto",
  nao_iniciado: "bg-cinza-claro text-cinza-escuro",
  atrasado: "bg-alerta-suave text-alerta-texto",
};

export function dataBr(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}
