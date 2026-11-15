"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual, type ModeloAula } from "@/lib/dados";
import { limparConteudo, momentosDo, momentosVazios, type Segmento } from "@/lib/modelos";
import { ehSegunda } from "@/lib/semanas";

function caminhoPlano(grade: number | string, semana: string) {
  return `/planos/${grade}/${semana}`;
}

function voltar(caminho: string, tipo: "ok" | "erro", msg: string): never {
  revalidatePath("/", "layout");
  const sep = caminho.includes("?") ? "&" : "?";
  redirect(`${caminho}${sep}${tipo}=${encodeURIComponent(msg)}`);
}

/** Traduz erros do banco para mensagens da escola. */
function mensagemDoBanco(msg: string) {
  if (/row-level security/i.test(msg)) return "Esta aula não está atribuída a você.";
  return msg.split("\n")[0];
}

/** Professor: salvar rascunho ou enviar para revisão. */
export async function salvarPlano(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");

  const grade_id = Number(form.get("grade_id"));
  const semana = String(form.get("semana") ?? "");
  const acao = String(form.get("acao") ?? "salvar");
  const voltarPara = caminhoPlano(grade_id, semana);
  if (!grade_id || !ehSegunda(semana)) voltar("/planos", "erro", "Aula ou semana inválida.");

  const supabase = await criarClienteServidor();
  const { data: aula } = await supabase
    .from("aulas_semanais")
    .select("turma_id, disciplina_id, segmento, modelo, professor_id")
    .eq("grade_id", grade_id)
    .single();
  if (!aula) voltar("/planos", "erro", "Aula não encontrada.");
  if (aula.professor_id !== perfil.id) voltar(voltarPara, "erro", "Esta aula não está atribuída a você.");

  const momentos = momentosDo(aula.modelo as ModeloAula, aula.segmento as Segmento);
  let bruto: unknown = {};
  try {
    bruto = JSON.parse(String(form.get("conteudo") ?? "{}"));
  } catch {
    voltar(voltarPara, "erro", "Não foi possível ler o plano. Tente novamente.");
  }
  const conteudo = limparConteudo(bruto, momentos);
  const topico = String(form.get("topico") ?? "").trim().slice(0, 300) || null;
  const enviar = acao === "enviar" && aula.modelo !== "leitura";

  if (enviar) {
    const vazios = momentosVazios(conteudo, momentos);
    if (vazios.length) {
      // Guarda o que foi escrito antes de avisar.
      await gravar();
      voltar(voltarPara, "erro", `Rascunho salvo. Para enviar, preencha: ${vazios.join(", ")}.`);
    }
  }

  await gravar(enviar);

  // O catecismo do plano enviado passa a fazer parte do banco da disciplina.
  const cat = conteudo.catecismo;
  if (enviar && cat?.pergunta?.trim() && cat?.resposta?.trim()) {
    await supabase.from("catecismos").upsert(
      {
        disciplina_id: aula.disciplina_id,
        turma_id: aula.turma_id,
        pergunta: cat.pergunta.trim(),
        resposta: cat.resposta.trim(),
        criado_por: perfil.id,
      },
      { onConflict: "disciplina_id,turma_id,pergunta", ignoreDuplicates: true },
    );
  }

  voltar(
    voltarPara,
    "ok",
    aula.modelo === "leitura"
      ? "Registro de leitura salvo."
      : enviar
        ? "Plano enviado para revisão."
        : "Rascunho salvo.",
  );

  async function gravar(comEnvio = false) {
    const { data: existente } = await supabase
      .from("planos_aula")
      .select("id")
      .eq("grade_id", grade_id)
      .eq("semana_inicio", semana)
      .maybeSingle();

    const { error } = existente
      ? await supabase
          .from("planos_aula")
          .update({ conteudo, topico, ...(comEnvio ? { status: "enviado" } : {}) })
          .eq("id", existente.id)
      : await supabase.from("planos_aula").insert({
          grade_id,
          semana_inicio: semana,
          professor_id: perfil!.id,
          conteudo,
          topico,
          status: comEnvio ? "enviado" : "rascunho",
        });
    if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  }
}

/** Professor ou gestão: comentário no plano. */
export async function comentar(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const plano_id = Number(form.get("plano_id"));
  const voltarPara = String(form.get("voltar") ?? "/planos");
  const texto = String(form.get("texto") ?? "").trim().slice(0, 2000);
  const bloco = String(form.get("bloco") ?? "").trim() || null;
  if (!texto) voltar(voltarPara, "erro", "Escreva o comentário antes de enviar.");

  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("plano_comentarios").insert({ plano_id, autor_id: perfil.id, bloco, texto });
  if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  voltar(voltarPara, "ok", "Comentário registrado.");
}

/** Gestão: aprovar ou pedir ajustes, com comentário opcional (obrigatório para ajustes). */
export async function revisarPlano(form: FormData) {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) redirect("/");
  const plano_id = Number(form.get("plano_id"));
  const decisao = String(form.get("decisao") ?? "");
  const voltarPara = String(form.get("voltar") ?? "/revisao");
  const texto = String(form.get("texto") ?? "").trim().slice(0, 2000);
  const bloco = String(form.get("bloco") ?? "").trim() || null;

  if (decisao !== "aprovado" && decisao !== "ajustes") voltar(voltarPara, "erro", "Decisão inválida.");
  if (decisao === "ajustes" && !texto) voltar(voltarPara, "erro", "Para pedir ajustes, escreva o que precisa mudar.");

  const supabase = await criarClienteServidor();
  if (texto) {
    const { error } = await supabase.from("plano_comentarios").insert({ plano_id, autor_id: perfil!.id, bloco, texto });
    if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  }
  const { error } = await supabase.from("planos_aula").update({ status: decisao }).eq("id", plano_id);
  if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  voltar(voltarPara, "ok", decisao === "aprovado" ? "Plano aprovado." : "Ajustes solicitados ao professor.");
}

/** Gestão: aprovar vários planos de uma vez. */
export async function aprovarEmLote(form: FormData) {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) redirect("/");
  const semana = String(form.get("semana") ?? "");
  const turma = String(form.get("turma") ?? "");
  const ids = form.getAll("plano").map(Number).filter(Boolean);
  const q = new URLSearchParams({ semana });
  if (turma) q.set("turma", turma);
  const voltarPara = `/revisao?${q.toString()}`;
  if (!ids.length) voltar(voltarPara, "erro", "Marque os planos que deseja aprovar.");

  const supabase = await criarClienteServidor();
  const { data, error } = await supabase
    .from("planos_aula")
    .update({ status: "aprovado" })
    .in("id", ids)
    .eq("status", "enviado")
    .select("id");
  if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  const n = data?.length ?? 0;
  voltar(voltarPara, "ok", n === 1 ? "1 plano aprovado." : `${n} planos aprovados.`);
}

/** Professor: registro depois da aula. */
export async function registrarAula(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const plano_id = Number(form.get("plano_id"));
  const voltarPara = String(form.get("voltar") ?? "/planos");
  const realizacao = String(form.get("realizacao") ?? "");
  const obs = String(form.get("obs") ?? "").trim().slice(0, 2000) || null;
  if (!["planejada", "parcial", "nao_dada"].includes(realizacao)) voltar(voltarPara, "erro", "Escolha como a aula transcorreu.");

  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("planos_aula")
    .update({ status: "realizado", realizacao, obs_pos_aula: obs })
    .eq("id", plano_id);
  if (error) voltar(voltarPara, "erro", mensagemDoBanco(error.message));
  voltar(voltarPara, "ok", "Registro da aula salvo.");
}
