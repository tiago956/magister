"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";
import { ehSegunda } from "@/lib/semanas";

function voltar(caminho: string, tipo: "ok" | "erro", msg: string): never {
  revalidatePath("/", "layout");
  redirect(`${caminho}?${tipo}=${encodeURIComponent(msg)}`);
}

function mensagemDoBanco(msg: string) {
  if (/row-level security/i.test(msg)) return "Esta aula não está atribuída a você.";
  if (/objetivo_check/.test(msg)) return "Preencha o objetivo da aula.";
  if (/conteudo_dado_check/.test(msg)) return "Preencha o conteúdo dado em sala.";
  return msg.split("\n")[0];
}

const texto = (form: FormData, campo: string, max = 4000) => String(form.get(campo) ?? "").trim().slice(0, max);

/** Professor da aula (ou gestão, para corrigir): grava o diário de classe. */
export async function salvarDiario(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");

  const grade_id = Number(form.get("grade_id"));
  const semana = String(form.get("semana") ?? "");
  if (!grade_id || !ehSegunda(semana)) voltar("/diario", "erro", "Aula ou semana inválida.");
  const caminho = `/diario/${grade_id}/${semana}`;

  const conteudo_dado = texto(form, "conteudo_dado");
  const objetivo = texto(form, "objetivo", 1000);
  const materiais = texto(form, "materiais", 1000) || null;
  const observacoes = texto(form, "observacoes", 2000) || null;
  if (!conteudo_dado || !objetivo) voltar(caminho, "erro", "Preencha o conteúdo dado em sala e o objetivo da aula.");

  const supabase = await criarClienteServidor();
  const { data: aula } = await supabase.from("aulas_semanais").select("professor_id").eq("grade_id", grade_id).single();
  if (!aula) voltar("/diario", "erro", "Aula não encontrada.");
  const responsavel = aula.professor_id === perfil.id;
  if (!responsavel && !ehGestor(perfil)) voltar(caminho, "erro", "Esta aula não está atribuída a você.");

  const { data: existente } = await supabase
    .from("diario_classe")
    .select("id")
    .eq("grade_id", grade_id)
    .eq("semana_inicio", semana)
    .maybeSingle();

  if (!existente && !responsavel) voltar(caminho, "erro", "O primeiro registro é feito pelo professor da aula.");

  const { error } = existente
    ? await supabase.from("diario_classe").update({ conteudo_dado, objetivo, materiais, observacoes }).eq("id", existente.id)
    : await supabase
        .from("diario_classe")
        .insert({ grade_id, semana_inicio: semana, professor_id: perfil.id, conteudo_dado, objetivo, materiais, observacoes });
  if (error) voltar(caminho, "erro", mensagemDoBanco(error.message));

  voltar(caminho, "ok", existente ? "Diário corrigido." : "Aula registrada no diário.");
}
