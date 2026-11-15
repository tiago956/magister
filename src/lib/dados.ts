import { criarClienteServidor } from "@/lib/supabase/server";

export type Papel = "professor" | "coordenacao" | "direcao" | "secretaria";
export type ModeloAula = "padrao" | "sete_momentos" | "quatro_momentos" | "artes_musica" | "leitura";

export type Perfil = {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  perfil_docente: "regente" | "especialista" | null;
  ativo: boolean;
};

export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

export const NOME_MODELO: Record<ModeloAula, string> = {
  padrao: "Modelo padrão",
  sete_momentos: "Sete momentos",
  quatro_momentos: "Quatro momentos",
  artes_musica: "Modelo de Música",
  leitura: "Registro de leitura",
};

export const NOME_PAPEL: Record<Papel, string> = {
  professor: "Professor(a)",
  coordenacao: "Coordenação",
  direcao: "Direção",
  secretaria: "Secretaria",
};

/** "07:30:00" → "7h30" */
export function hora(t: string) {
  const [h, m] = t.split(":");
  return `${Number(h)}h${m}`;
}

export function ehGestor(p: Perfil | null) {
  return !!p && p.ativo && (p.papel === "coordenacao" || p.papel === "direcao");
}

/** Perfil de quem está logado (ou null). */
export async function perfilAtual(): Promise<Perfil | null> {
  const supabase = await criarClienteServidor();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) return null;
  const { data } = await supabase
    .from("perfis")
    .select("id, nome, email, papel, perfil_docente, ativo")
    .eq("id", id)
    .single();
  return (data as Perfil) ?? null;
}
