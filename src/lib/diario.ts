import type { Conteudo } from "@/lib/modelos";

export type RegistroDiario = {
  id: number;
  grade_id: number;
  semana_inicio: string;
  professor_id: string | null;
  conteudo_dado: string;
  objetivo: string;
  materiais: string | null;
  observacoes: string | null;
  registrado_em: string;
  atualizado_em: string;
  atualizado_por: string | null;
};

export const CAMPOS_DIARIO =
  "id, grade_id, semana_inicio, professor_id, conteudo_dado, objetivo, materiais, observacoes, registrado_em, atualizado_em, atualizado_por";

export type Rascunho = { conteudo_dado: string; objetivo: string; materiais: string };

/** Primeiro valor preenchido entre os campos indicados (momento.campo). */
function primeiro(conteudo: Conteudo, caminhos: string[]) {
  for (const c of caminhos) {
    const [m, f] = c.split(".");
    const v = conteudo[m]?.[f]?.trim();
    if (v) return v;
  }
  return "";
}

/**
 * Pré-preenche o diário com o que foi planejado. Funciona com todos os modelos de plano:
 * padrão, sete momentos, quatro momentos, artes/música e leitura.
 */
export function rascunhoDoPlano(plano: { topico: string | null; conteudo: unknown } | null): Rascunho | null {
  if (!plano) return null;
  const conteudo = (plano.conteudo && typeof plano.conteudo === "object" ? plano.conteudo : {}) as Conteudo;

  const objetivo = primeiro(conteudo, ["objetivo.objetivo", "conexao.objetivo", "objetivo_mini.objetivo"]);

  let materiais = primeiro(conteudo, ["materiais.materiais", "atividade_pratica.materiais"]);
  const livro = conteudo.leitura?.livro?.trim();
  const paginas = conteudo.leitura?.paginas?.trim();
  if (!materiais && (livro || paginas)) materiais = [livro, paginas ? `p. ${paginas}` : ""].filter(Boolean).join(", ");

  const conceito = primeiro(conteudo, [
    "estrategias.conceito",
    "mini_licao.passos",
    "objetivo_mini.passos",
    "mini_licao.apresentacao",
    "atividade_pratica.proposta",
  ]);
  const topico = plano.topico?.trim() ?? "";
  const conteudo_dado = [topico, conceito].filter(Boolean).join("\n\n");

  if (!objetivo && !materiais && !conteudo_dado) return null;
  return { conteudo_dado, objetivo, materiais };
}
