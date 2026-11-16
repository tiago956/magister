import type { SupabaseClient } from "@supabase/supabase-js";
import type { Perfil } from "@/lib/dados";
import { somarDias } from "@/lib/semanas";

export type TipoEvento = "avaliacao" | "evento" | "reuniao" | "feriado" | "recesso" | "letivo";

export const TIPOS: TipoEvento[] = ["letivo", "avaliacao", "evento", "reuniao", "feriado", "recesso"];

export const NOME_TIPO: Record<TipoEvento, string> = {
  letivo: "Ano letivo",
  avaliacao: "Avaliações",
  evento: "Eventos",
  reuniao: "Reuniões e formação",
  feriado: "Feriados",
  recesso: "Recesso e férias",
};

/** Classes de cor por tipo (fundo suave, borda à esquerda e texto escuro). */
export const COR_TIPO: Record<TipoEvento, string> = {
  letivo: "bg-trinitas-suave border-l-trinitas text-trinitas-texto",
  avaliacao: "bg-[#EEF0FB] border-l-[#4F5BB8] text-[#2E3780]",
  evento: "bg-lima-suave border-l-lima text-lima-texto",
  reuniao: "bg-[#F1F2F4] border-l-cinza-medio text-cinza-escuro",
  feriado: "bg-alerta-suave border-l-alerta-texto text-alerta-texto",
  recesso: "bg-[#FBF1E6] border-l-[#B5651D] text-[#7A3F0C]",
};

export type Evento = {
  id: number;
  titulo: string;
  tipo: TipoEvento;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  suspende_aulas: boolean;
  disciplina_id: number | null;
  turmas: number[];
};

/** Eventos que tocam o intervalo [de, ate], com as turmas envolvidas. */
export async function eventosEntre(supabase: SupabaseClient, de: string, ate: string): Promise<Evento[]> {
  const { data } = await supabase
    .from("eventos")
    .select(
      "id, titulo, tipo, descricao, data_inicio, data_fim, hora_inicio, hora_fim, suspende_aulas, disciplina_id, evento_turmas(turma_id)",
    )
    .lte("data_inicio", ate)
    .gte("data_fim", de)
    .order("data_inicio")
    .order("hora_inicio", { nullsFirst: true });
  return ((data ?? []) as unknown as (Omit<Evento, "turmas"> & { evento_turmas: { turma_id: number }[] })[]).map(
    ({ evento_turmas, ...e }) => ({ ...e, turmas: evento_turmas.map((t) => t.turma_id) }),
  );
}

export function ocorreEm(e: Evento, dia: string) {
  return e.data_inicio <= dia && dia <= e.data_fim;
}

/** O evento vale para a turma (sem turmas = escola toda). */
export function valeParaTurma(e: Evento, turmaId: number) {
  return e.turmas.length === 0 || e.turmas.includes(turmaId);
}

/** Evento que suspende as aulas desta turma neste dia, se houver. */
export function suspensao(eventos: Evento[], dia: string, turmaId: number) {
  return eventos.find((e) => e.suspende_aulas && ocorreEm(e, dia) && valeParaTurma(e, turmaId));
}

export function doDia(eventos: Evento[], dia: string, turmaId?: number) {
  return eventos.filter((e) => ocorreEm(e, dia) && (turmaId === undefined || valeParaTurma(e, turmaId)));
}

export function podeAgendar(p: Perfil | null) {
  return !!p && p.ativo && p.funcoes.some((f) => f === "coordenacao" || f === "direcao" || f === "secretaria");
}

/** "2027-03" a partir de uma data ISO. */
export function mesDe(iso: string) {
  return iso.slice(0, 7);
}

export function ehMes(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}

export function somarMeses(mes: string, n: number) {
  const [a, m] = mes.split("-").map(Number);
  const t = a * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

export function ultimoDiaDoMes(mes: string) {
  return somarDias(`${somarMeses(mes, 1)}-01`, -1);
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function nomeDoMes(mes: string) {
  const [a, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

/** 0 = segunda ... 6 = domingo */
export function diaDaSemana(iso: string) {
  return (new Date(`${iso}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function ehFimDeSemana(iso: string) {
  return diaDaSemana(iso) >= 5;
}

/** "Seg 25/01" */
export function rotuloDia(iso: string) {
  const [, m, d] = iso.split("-");
  return `${["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"][diaDaSemana(iso)]} ${d}/${m}`;
}

/** "25/01" ou "25/01 a 29/01" e, se houver, "· 19h às 20h". */
export function quando(e: Pick<Evento, "data_inicio" | "data_fim" | "hora_inicio" | "hora_fim">) {
  const d = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const h = (t: string) => {
    const [hh, mm] = t.split(":");
    return mm === "00" ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
  };
  const datas = e.data_inicio === e.data_fim ? d(e.data_inicio) : `${d(e.data_inicio)} a ${d(e.data_fim)}`;
  return e.hora_inicio && e.hora_fim ? `${datas} · ${h(e.hora_inicio)} às ${h(e.hora_fim)}` : datas;
}
