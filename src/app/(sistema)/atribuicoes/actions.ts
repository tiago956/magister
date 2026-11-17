"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, FUNCOES, perfilAtual, tem, type Papel } from "@/lib/dados";

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
  voltar(`Regente atribuído a ${ids.length} matérias da turma.`);
}

/** Especialista: um professor recebe uma matéria nas turmas escolhidas (entre as que a têm na grade). */
export async function atribuirEspecialista(form: FormData) {
  const supabase = await exigirGestao();
  const professor_id = String(form.get("professor_id") ?? "");
  const disciplina_id = Number(form.get("disciplina_id"));
  const escolhidas = new Set(form.getAll("turma_id").map(Number));
  if (!professor_id || !disciplina_id) voltar("Escolha o professor e a matéria.");
  if (!escolhidas.size) voltar("Marque ao menos uma turma para o especialista.");

  const { data: aulas } = await supabase.from("aulas_semanais").select("turma_id").eq("disciplina_id", disciplina_id);
  const ids = [...new Set((aulas ?? []).map((a) => a.turma_id as number))].filter((id) => escolhidas.has(id));
  if (ids.length) {
    const linhas = ids.map((turma_id) => ({ professor_id, turma_id, disciplina_id }));
    const { error } = await supabase.from("atribuicoes").upsert(linhas, { onConflict: "turma_id,disciplina_id" });
    if (error) throw new Error("Não foi possível atribuir o especialista.");
  }
  voltar(`Especialista atribuído em ${ids.length} turmas.`);
}

/** Funções de uma pessoa da equipe (pode acumular várias, ex.: coordenação e professor). */
export async function salvarFuncoes(form: FormData) {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) throw new Error("Apenas a coordenação e a direção podem alterar funções.");
  const supabase = await criarClienteServidor();
  const id = String(form.get("id") ?? "");
  const nome = String(form.get("nome") ?? "");
  const funcoes = form.getAll("funcao").map(String).filter((x): x is Papel => FUNCOES.includes(x as Papel));
  if (!funcoes.length) voltar(`Marque ao menos uma função para ${nome}.`);

  const { data: atual } = await supabase.from("perfis").select("funcoes").eq("id", id).maybeSingle();
  const tinhaDirecao = ((atual?.funcoes ?? []) as Papel[]).includes("direcao");
  if (tinhaDirecao !== funcoes.includes("direcao") && !tem(perfil, "direcao")) {
    voltar("Só a direção pode conceder ou retirar a função Direção.");
  }

  const { error } = await supabase.from("perfis").update({ funcoes }).eq("id", id);
  if (error) voltar(error.message.includes("direção") ? error.message : `Não foi possível alterar as funções de ${nome}.`);
  voltar(`Funções de ${nome} atualizadas.`);
}
