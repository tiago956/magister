"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/dados";
import { ehMes, mesDe, podeAgendar, TIPOS, type TipoEvento } from "@/lib/calendario";

function voltar(mes: string, tipo: "ok" | "erro", msg: string, extra = ""): never {
  revalidatePath("/", "layout");
  const m = ehMes(mes) ? mes : "";
  redirect(`/calendario?${m ? `mes=${m}&` : ""}${extra}${tipo}=${encodeURIComponent(msg)}`);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

export async function salvarEvento(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const mesVolta = String(form.get("mes") ?? "");
  const id = Number(form.get("id")) || null;
  const reabrir = id ? `editar=${id}&` : "novo=1&";
  if (!podeAgendar(perfil)) voltar(mesVolta, "erro", "Só a coordenação, a direção e a secretaria podem agendar eventos.");

  const titulo = String(form.get("titulo") ?? "").trim();
  const tipo = String(form.get("tipo") ?? "") as TipoEvento;
  const data_inicio = String(form.get("data_inicio") ?? "");
  const data_fim = String(form.get("data_fim") ?? "") || data_inicio;
  const hi = String(form.get("hora_inicio") ?? "");
  const hf = String(form.get("hora_fim") ?? "");
  const descricao = String(form.get("descricao") ?? "").trim() || null;
  const disciplina_id = Number(form.get("disciplina_id")) || null;
  const suspende_aulas = form.get("suspende_aulas") === "on";
  const turmas = form.getAll("turma").map(Number).filter(Boolean);

  if (!titulo) voltar(mesVolta, "erro", "Informe o nome do evento.", reabrir);
  if (!TIPOS.includes(tipo)) voltar(mesVolta, "erro", "Escolha o tipo do evento.", reabrir);
  if (!DATA.test(data_inicio) || !DATA.test(data_fim)) voltar(mesVolta, "erro", "Informe a data do evento.", reabrir);
  if (data_fim < data_inicio) voltar(mesVolta, "erro", "A data final não pode ser anterior à inicial.", reabrir);
  if ((hi && !hf) || (!hi && hf)) voltar(mesVolta, "erro", "Informe o horário de início e de término, ou deixe os dois em branco para o dia todo.", reabrir);
  if (hi && (!HORA.test(hi) || !HORA.test(hf) || hf <= hi)) voltar(mesVolta, "erro", "O horário de término precisa ser depois do início.", reabrir);

  const linha = {
    titulo,
    tipo,
    data_inicio,
    data_fim,
    hora_inicio: hi || null,
    hora_fim: hf || null,
    descricao,
    disciplina_id,
    suspende_aulas,
  };

  const supabase = await criarClienteServidor();
  let eventoId = id;
  if (id) {
    const { error } = await supabase.from("eventos").update(linha).eq("id", id);
    if (error) voltar(mesVolta, "erro", "Não foi possível salvar: " + error.message.split("\n")[0], reabrir);
    const { error: e2 } = await supabase.from("evento_turmas").delete().eq("evento_id", id);
    if (e2) voltar(mesVolta, "erro", "Não foi possível atualizar as turmas do evento.", reabrir);
  } else {
    const { data, error } = await supabase.from("eventos").insert(linha).select("id").single();
    if (error || !data) voltar(mesVolta, "erro", "Não foi possível criar o evento: " + (error?.message.split("\n")[0] ?? ""), reabrir);
    eventoId = data.id;
  }
  if (turmas.length) {
    const { error } = await supabase.from("evento_turmas").insert(turmas.map((turma_id) => ({ evento_id: eventoId, turma_id })));
    if (error) voltar(mesDe(data_inicio), "erro", "O evento foi salvo, mas as turmas não. Abra-o e salve de novo.");
  }
  voltar(mesDe(data_inicio), "ok", id ? "Evento atualizado." : "Evento criado.");
}

export async function excluirEvento(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const mes = String(form.get("mes") ?? "");
  const id = Number(form.get("id"));
  if (!podeAgendar(perfil)) voltar(mes, "erro", "Só a coordenação, a direção e a secretaria podem excluir eventos.");
  const supabase = await criarClienteServidor();
  const { error, count } = await supabase.from("eventos").delete({ count: "exact" }).eq("id", id);
  if (error || !count) voltar(mes, "erro", "Não foi possível excluir o evento.");
  voltar(mes, "ok", "Evento excluído.");
}

export async function renovarLink(form: FormData) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  const mes = String(form.get("mes") ?? "");
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("renovar_token_agenda");
  if (error) voltar(mes, "erro", "Não foi possível gerar um novo link.");
  voltar(mes, "ok", "Novo link gerado. O link anterior deixou de funcionar; assine o novo no Google Agenda.", "assinar=1&");
}
