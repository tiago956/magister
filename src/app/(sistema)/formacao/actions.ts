"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual, type Papel } from "@/lib/dados";
import { idDoYoutube } from "@/lib/formacao";

function voltar(caminho: string, tipo: "ok" | "erro", msg: string): never {
  revalidatePath("/", "layout");
  const sep = caminho.includes("?") ? "&" : "?";
  redirect(`${caminho}${sep}${tipo}=${encodeURIComponent(msg)}`);
}

async function exigirGestao() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!ehGestor(perfil)) voltar("/", "erro", "Só a direção e a coordenação gerenciam cursos.");
  return criarClienteServidor();
}

const PAPEIS: Papel[] = ["professor", "coordenacao", "direcao", "secretaria"];
const primeiraLinha = (m: string) => m.split("\n")[0];

export async function salvarCurso(form: FormData) {
  const supabase = await exigirGestao();
  const id = Number(form.get("id")) || null;
  const aqui = id ? `/formacao/cursos/${id}` : "/formacao/cursos/novo";

  const secao = String(form.get("secao"));
  const titulo = String(form.get("titulo") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const prazo = String(form.get("prazo") ?? "") || null;
  const publico = String(form.get("publico"));
  const papeis = form.getAll("papel").map(String).filter((x): x is Papel => PAPEIS.includes(x as Papel));
  const pessoas = form.getAll("pessoa").map(String).filter(Boolean);
  const publicado = form.get("publicado") === "on";
  const ordem = Number(form.get("ordem")) || 0;

  if (secao !== "onboarding" && secao !== "treinamento") voltar(aqui, "erro", "Escolha a seção do curso.");
  if (!titulo) voltar(aqui, "erro", "Informe o nome do curso.");
  if (!["todos", "papeis", "pessoas"].includes(publico)) voltar(aqui, "erro", "Escolha para quem é o curso.");
  if (publico === "papeis" && !papeis.length) voltar(aqui, "erro", "Marque ao menos uma função.");
  if (publico === "pessoas" && !pessoas.length) voltar(aqui, "erro", "Marque ao menos uma pessoa.");
  if (prazo && !/^\d{4}-\d{2}-\d{2}$/.test(prazo)) voltar(aqui, "erro", "Prazo inválido.");

  const linha = { secao, titulo, descricao, prazo, publico, papeis: publico === "papeis" ? papeis : [], publicado, ordem };
  let cursoId = id;
  if (id) {
    const { error } = await supabase.from("cursos").update(linha).eq("id", id);
    if (error) voltar(aqui, "erro", "Não foi possível salvar: " + primeiraLinha(error.message));
  } else {
    const { data, error } = await supabase.from("cursos").insert(linha).select("id").single();
    if (error || !data) voltar(aqui, "erro", "Não foi possível criar o curso: " + primeiraLinha(error?.message ?? ""));
    cursoId = data.id;
  }

  const { error: e1 } = await supabase.from("curso_pessoas").delete().eq("curso_id", cursoId);
  if (e1) voltar(`/formacao/cursos/${cursoId}`, "erro", "Não foi possível atualizar as pessoas do curso.");
  if (publico === "pessoas") {
    const { error: e2 } = await supabase.from("curso_pessoas").insert(pessoas.map((perfil_id) => ({ curso_id: cursoId, perfil_id })));
    if (e2) voltar(`/formacao/cursos/${cursoId}`, "erro", "O curso foi salvo, mas as pessoas não. Salve de novo.");
  }
  voltar(`/formacao/cursos/${cursoId}`, "ok", id ? "Curso atualizado." : "Curso criado. Agora cadastre as aulas.");
}

export async function excluirCurso(form: FormData) {
  const supabase = await exigirGestao();
  const id = Number(form.get("id"));
  const { error, count } = await supabase.from("cursos").delete({ count: "exact" }).eq("id", id);
  if (error || !count) voltar(`/formacao/cursos/${id}`, "erro", "Não foi possível excluir o curso.");
  voltar("/formacao", "ok", "Curso excluído.");
}

export async function salvarAula(form: FormData) {
  const supabase = await exigirGestao();
  const cursoId = Number(form.get("curso_id"));
  const id = Number(form.get("id")) || null;
  const aqui = `/formacao/cursos/${cursoId}`;

  const titulo = String(form.get("titulo") ?? "").trim();
  const youtube_id = idDoYoutube(String(form.get("youtube") ?? ""));
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const ordem = Number(form.get("ordem")) || 0;
  const pergunta = String(form.get("pergunta") ?? "").trim() || null;
  const opcoes = String(form.get("opcoes") ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const correta = Number(form.get("correta"));

  if (!titulo) voltar(aqui, "erro", "Informe o título da aula.");
  if (!youtube_id) voltar(aqui, "erro", "Link do YouTube não reconhecido. Cole o endereço do vídeo, como https://youtu.be/...");
  if (pergunta) {
    if (opcoes.length < 2 || opcoes.length > 6) voltar(aqui, "erro", "A pergunta precisa de 2 a 6 alternativas, uma por linha.");
    if (!Number.isInteger(correta) || correta < 1 || correta > opcoes.length) voltar(aqui, "erro", "Indique o número da alternativa correta.");
  }

  const linha = { curso_id: cursoId, titulo, youtube_id, descricao, ordem, pergunta, opcoes: pergunta ? opcoes : null };
  let aulaId = id;
  if (id) {
    const { error } = await supabase.from("curso_aulas").update(linha).eq("id", id);
    if (error) voltar(aqui, "erro", "Não foi possível salvar a aula: " + primeiraLinha(error.message));
  } else {
    const { data, error } = await supabase.from("curso_aulas").insert(linha).select("id").single();
    if (error || !data) voltar(aqui, "erro", "Não foi possível criar a aula: " + primeiraLinha(error?.message ?? ""));
    aulaId = data.id;
  }

  if (pergunta) {
    const { error } = await supabase.from("aula_gabaritos").upsert({ aula_id: aulaId, correta: correta - 1 });
    if (error) voltar(aqui, "erro", "A aula foi salva, mas a resposta correta não. Salve de novo.");
  } else {
    await supabase.from("aula_gabaritos").delete().eq("aula_id", aulaId);
  }
  voltar(aqui, "ok", id ? "Aula atualizada." : "Aula adicionada.");
}

export async function excluirAula(form: FormData) {
  const supabase = await exigirGestao();
  const cursoId = Number(form.get("curso_id"));
  const id = Number(form.get("id"));
  const { error, count } = await supabase.from("curso_aulas").delete({ count: "exact" }).eq("id", id);
  if (error || !count) voltar(`/formacao/cursos/${cursoId}`, "erro", "Não foi possível excluir a aula.");
  voltar(`/formacao/cursos/${cursoId}`, "ok", "Aula excluída.");
}
