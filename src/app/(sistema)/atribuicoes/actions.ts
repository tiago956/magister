"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";

async function exigirGestao() {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) throw new Error("Apenas a coordenação e a direção podem alterar atribuições.");
  return criarClienteServidor();
}

function voltar(msg: string, turma?: string | null) {
  revalidatePath("/atribuicoes");
  revalidatePath("/");
  const q = new URLSearchParams({ ok: msg });
  if (turma) q.set("turma", turma);
  redirect(`/atribuicoes?${q.toString()}`);
}

/** Salva a matriz inteira: campos "a:<turma_id>:<disciplina_id>" = id do professor ou vazio. */
export async function salvarMatriz(form: FormData) {
  const supabase = await exigirGestao();
  const inserir: { turma_id: number; disciplina_id: number; professor_id: string }[] = [];
  const remover: { turma_id: number; disciplina_id: number }[] = [];

  for (const [chave, valor] of form.entries()) {
    if (!chave.startsWith("a:")) continue;
    const [, t, d] = chave.split(":");
    const turma_id = Number(t);
    const disciplina_id = Number(d);
    const professor_id = String(valor);
    if (professor_id) inserir.push({ turma_id, disciplina_id, professor_id });
    else remover.push({ turma_id, disciplina_id });
  }

  if (inserir.length) {
    const { error } = await supabase.from("atribuicoes").upsert(inserir, { onConflict: "turma_id,disciplina_id" });
    if (error) throw new Error("Não foi possível salvar as atribuições.");
  }
  for (const r of remover) {
    await supabase.from("atribuicoes").delete().eq("turma_id", r.turma_id).eq("disciplina_id", r.disciplina_id);
  }
  voltar("Atribuições salvas.", form.get("turma_ver") as string | null);
}

/** Regente: um professor recebe todas as matérias do regente numa turma. */
export async function atribuirRegente(form: FormData) {
  const supabase = await exigirGestao();
  const professor_id = String(form.get("professor_id") ?? "");
  const turma_id = Number(form.get("turma_id"));
  if (!professor_id || !turma_id) voltar("Escolha o professor e a turma.");

  const { data: doRegente } = await supabase.from("disciplinas").select("id").eq("do_regente", true);
  const regentes = new Set((doRegente ?? []).map((d) => d.id as number));
  const { data: aulas } = await supabase.from("aulas_semanais").select("disciplina_id").eq("turma_id", turma_id);
  const ids = [...new Set((aulas ?? []).map((a) => a.disciplina_id as number))].filter((id) => regentes.has(id));
  if (ids.length) {
    const linhas = ids.map((disciplina_id) => ({ professor_id, turma_id, disciplina_id }));
    const { error } = await supabase.from("atribuicoes").upsert(linhas, { onConflict: "turma_id,disciplina_id" });
    if (error) throw new Error("Não foi possível atribuir o regente.");
  }
  await supabase.from("perfis").update({ perfil_docente: "regente" }).eq("id", professor_id);
  voltar(`Regente atribuído a ${ids.length} matérias da turma.`);
}

/** Especialista: um professor recebe uma matéria em todas as turmas que a têm na grade. */
export async function atribuirEspecialista(form: FormData) {
  const supabase = await exigirGestao();
  const professor_id = String(form.get("professor_id") ?? "");
  const disciplina_id = Number(form.get("disciplina_id"));
  if (!professor_id || !disciplina_id) voltar("Escolha o professor e a matéria.");

  const { data: aulas } = await supabase.from("aulas_semanais").select("turma_id").eq("disciplina_id", disciplina_id);
  const ids = [...new Set((aulas ?? []).map((a) => a.turma_id as number))];
  if (ids.length) {
    const linhas = ids.map((turma_id) => ({ professor_id, turma_id, disciplina_id }));
    const { error } = await supabase.from("atribuicoes").upsert(linhas, { onConflict: "turma_id,disciplina_id" });
    if (error) throw new Error("Não foi possível atribuir o especialista.");
  }
  await supabase.from("perfis").update({ perfil_docente: "especialista" }).eq("id", professor_id);
  voltar(`Especialista atribuído em ${ids.length} turmas.`);
}

/** Papel de acesso de uma pessoa da equipe. */
export async function alterarPapel(form: FormData) {
  const supabase = await exigirGestao();
  const id = String(form.get("id") ?? "");
  const papel = String(form.get("papel") ?? "");
  if (!["professor", "coordenacao", "direcao", "secretaria"].includes(papel)) voltar("Papel inválido.");
  const { error } = await supabase.from("perfis").update({ papel }).eq("id", id);
  if (error) throw new Error("Não foi possível alterar o papel.");
  voltar("Papel atualizado.");
}
