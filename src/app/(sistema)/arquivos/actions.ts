"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual, type Papel } from "@/lib/dados";
import { idDoDrive } from "@/lib/drive";

function voltar(tipo: "ok" | "erro", msg: string, ancora = ""): never {
  revalidatePath("/", "layout");
  redirect(`/arquivos/gerenciar?${tipo}=${encodeURIComponent(msg)}${ancora}`);
}

const PAPEIS: Papel[] = ["professor", "coordenacao", "direcao", "secretaria"];

export async function salvarPasta(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!ehGestor(perfil)) voltar("erro", "Só a direção e a coordenação gerenciam as pastas.");

  const id = Number(form.get("id")) || null;
  const titulo = String(form.get("titulo") ?? "").trim();
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const drive_id = idDoDrive(String(form.get("link") ?? ""));
  const ordem = Number(form.get("ordem")) || 0;
  const papeis = form.getAll("papel").map(String).filter((x): x is Papel => PAPEIS.includes(x as Papel));
  const turmas = form.getAll("turma").map(Number).filter(Boolean);
  const disciplinas = form.getAll("disciplina").map(Number).filter(Boolean);

  if (!titulo) voltar("erro", "Informe o nome da pasta.");
  if (!drive_id) voltar("erro", "Link da pasta do Drive não reconhecido. Copie o endereço da pasta aberta no Drive.");

  const supabase = await criarClienteServidor();
  const linha = { titulo, descricao, drive_id, ordem, papeis, turmas, disciplinas };
  const { error } = id ? await supabase.from("pastas_drive").update(linha).eq("id", id) : await supabase.from("pastas_drive").insert(linha);
  if (error) voltar("erro", /duplicate|unique/i.test(error.message) ? "Esta pasta do Drive já está vinculada." : "Não foi possível salvar: " + error.message.split("\n")[0]);
  voltar("ok", id ? "Pasta atualizada." : "Pasta vinculada.");
}

/** Remove só o vínculo no Magister; a pasta continua intacta no Google Drive. */
export async function desvincularPasta(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!ehGestor(perfil)) voltar("erro", "Só a direção e a coordenação gerenciam as pastas.");
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("pastas_drive").delete({ count: "exact" }).eq("id", Number(form.get("id")));
  if (error || !count) voltar("erro", "Não foi possível desvincular a pasta.");
  voltar("ok", "Pasta desvinculada do Magister. Nada foi alterado no Google Drive.");
}
