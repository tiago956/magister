import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, perfilAtual } from "@/lib/dados";
import { dataCurta, dataDaAula, ehSegunda, hojeIso, rotuloSemana, segundaDaSemana, somarDias } from "@/lib/semanas";
import { RotuloLink } from "@/components/link-status";
import { COR_TIPO, doDia, eventosEntre, suspensao } from "@/lib/calendario";

export const metadata: Metadata = { title: "Diário de classe" };

type Aula = {
  grade_id: number;
  dia_semana: number;
  inicio: string;
  fim: string;
  turma: string;
  turma_id: number;
  disciplina: string;
  professor_id: string | null;
};
type Turma = { id: number; codigo: string; nome: string };

type Situacao = "registrado" | "pendente" | "aguardando";
const SELO: Record<Situacao, { nome: string; classe: string }> = {
  registrado: { nome: "Registrado", classe: "bg-trinitas-suave text-trinitas-texto" },
  pendente: { nome: "Pendente", classe: "bg-alerta-suave text-alerta-texto" },
  aguardando: { nome: "Aguardando a aula", classe: "border border-borda bg-white text-cinza-medio" },
};

export default async function DiarioPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; turma?: string }>;
}) {
  const perfil = (await perfilAtual())!;
  const gestor = ehGestor(perfil);
  const { semana: semanaParam, turma: turmaParam } = await searchParams;
  const hoje = hojeIso();
  const semana = ehSegunda(semanaParam) ? semanaParam : segundaDaSemana(hoje);

  const supabase = await criarClienteServidor();
  const [{ data: minhasA }, { data: t }] = await Promise.all([
    supabase
      .from("aulas_semanais")
      .select("grade_id, dia_semana, inicio, fim, turma, turma_id, disciplina, professor_id")
      .eq("professor_id", perfil.id)
      .order("dia_semana")
      .order("inicio"),
    gestor ? supabase.from("turmas").select("id, codigo, nome").order("ordem") : Promise.resolve({ data: [] }),
  ]);
  const minhas = (minhasA ?? []) as Aula[];
  const turmas = (t ?? []) as Turma[];

  // A gestão acompanha o diário por turma; quem também leciona tem a aba "Minhas aulas".
  const turmaSel = gestor ? (turmas.find((x) => x.codigo === turmaParam) ?? (minhas.length ? null : turmas[0])) : null;
  let todas = minhas;
  if (turmaSel) {
    const { data } = await supabase
      .from("aulas_semanais")
      .select("grade_id, dia_semana, inicio, fim, turma, turma_id, disciplina, professor_id")
      .eq("turma_id", turmaSel.id)
      .not("disciplina_id", "is", null)
      .order("dia_semana")
      .order("inicio");
    todas = (data ?? []) as Aula[];
  }

  const eventos = await eventosEntre(supabase, semana, somarDias(semana, 4));
  const motivo = (x: Aula) => suspensao(eventos, dataDaAula(semana, x.dia_semana), x.turma_id);
  const aulas = todas.filter((x) => !motivo(x));

  const [{ data: r }, { data: pe }] = await Promise.all([
    aulas.length
      ? supabase.from("diario_classe").select("grade_id").eq("semana_inicio", semana).in("grade_id", aulas.map((x) => x.grade_id))
      : Promise.resolve({ data: [] }),
    turmaSel ? supabase.from("perfis").select("id, nome") : Promise.resolve({ data: [] }),
  ]);
  const registradas = new Set(((r ?? []) as { grade_id: number }[]).map((x) => x.grade_id));
  const nomeDe = new Map(((pe ?? []) as { id: string; nome: string }[]).map((x) => [x.id, x.nome]));

  const sit = (x: Aula): Situacao =>
    registradas.has(x.grade_id) ? "registrado" : dataDaAula(semana, x.dia_semana) <= hoje ? "pendente" : "aguardando";
  const dadas = aulas.filter((x) => sit(x) !== "aguardando").length;
  const feitos = aulas.filter((x) => sit(x) === "registrado").length;
  const pendentes = aulas.filter((x) => sit(x) === "pendente").length;
  const minhasTurmas = [...new Set(todas.map((x) => x.turma_id))];

  const q = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ semana, ...(turmaSel ? { turma: turmaSel.codigo } : {}), ...extra });
    return `/diario?${p.toString()}`;
  };

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">Preencha depois de cada aula o que foi dado de fato em sala</span>
          <h1 className="text-3xl">Diário de classe · {rotuloSemana(semana)}</h1>
        </div>
        <nav aria-label="Trocar de semana" className="flex items-center gap-2">
          <Link href={q({ semana: somarDias(semana, -7) })} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Semana anterior</RotuloLink>
          </Link>
          {semana !== segundaDaSemana(hoje) && (
            <Link href={q({ semana: segundaDaSemana(hoje) })} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
              <RotuloLink>Esta semana</RotuloLink>
            </Link>
          )}
          <Link href={q({ semana: somarDias(semana, 7) })} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Próxima semana</RotuloLink>
          </Link>
        </nav>
      </header>

      {gestor && (
        <nav aria-label="Turma exibida" className="flex flex-wrap gap-1.5">
          {minhas.length > 0 && <Chip href={`/diario?semana=${semana}`} ativo={!turmaSel} nome="Minhas aulas" />}
          {turmas.map((x) => (
            <Chip key={x.id} href={`/diario?semana=${semana}&turma=${x.codigo}`} ativo={turmaSel?.id === x.id} nome={x.nome} />
          ))}
        </nav>
      )}

      {todas.length === 0 ? (
        <section className="border border-borda bg-white p-6">
          <p className="leading-relaxed text-cinza-escuro">
            {turmaSel ? "Esta turma ainda não tem aulas na grade." : "Nenhuma aula atribuída a você. A coordenação define as turmas e matérias de cada professor."}
          </p>
        </section>
      ) : aulas.length === 0 ? (
        <section className="border border-borda border-l-4 border-l-trinitas bg-white p-6">
          <p className="leading-relaxed text-cinza-escuro">Não há aulas nesta semana pelo calendário escolar.</p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4" aria-label="Resumo da semana">
            <Resumo rotulo="Aulas já dadas" valor={dadas} />
            <Resumo rotulo="Registradas" valor={feitos} cor="text-trinitas-profundo" />
            <Resumo rotulo="Pendentes" valor={pendentes} cor={pendentes ? "text-alerta-texto" : undefined} />
          </section>

          <section className="flex flex-col gap-6" aria-label="Aulas da semana">
            {DIAS.map((dia, i) => {
              const daqui = todas.filter((x) => x.dia_semana === i + 1);
              if (!daqui.length) return null;
              const data = dataDaAula(semana, i + 1);
              const evs = doDia(eventos, data).filter((e) => !e.turmas.length || e.turmas.some((tt) => minhasTurmas.includes(tt)));
              return (
                <div key={dia} className="border border-borda bg-white">
                  <div className="flex flex-wrap items-center gap-2 border-b border-borda px-5 py-3">
                    <h2 className="mr-2 font-sans text-sm font-semibold">
                      {dia}, {dataCurta(data)}
                      {data === hoje && <span className="ml-2 text-xs font-normal text-trinitas-texto">hoje</span>}
                    </h2>
                    {evs.map((e) => (
                      <span key={e.id} className={"rounded-sm border-l-2 px-1.5 py-0.5 text-xs " + COR_TIPO[e.tipo]}>
                        {e.titulo}
                      </span>
                    ))}
                  </div>
                  <ul>
                    {daqui.map((x) => {
                      const sem = motivo(x);
                      const detalhe = turmaSel ? (x.professor_id ? (nomeDe.get(x.professor_id) ?? "") : "Sem professor") : x.turma;
                      if (sem) {
                        return (
                          <li key={x.grade_id} className="flex flex-wrap items-center gap-4 border-b border-borda bg-cinza-claro px-5 py-3.5 text-cinza-medio last:border-b-0">
                            <span className="w-28 text-[13px] tabular-nums">{hora(x.inicio)} às {hora(x.fim)}</span>
                            <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                              <span className="text-[15px] font-semibold line-through decoration-1">{x.disciplina}</span>
                              <span className="text-[13px]">{detalhe}</span>
                            </div>
                            <span className="text-[13px]">Sem aula · {sem.titulo}</span>
                          </li>
                        );
                      }
                      const s = sit(x);
                      const meu = x.professor_id === perfil.id;
                      const acao = s === "registrado" ? (meu ? "Ver e corrigir" : "Ver registro") : s === "pendente" && meu ? "Preencher" : s === "pendente" ? "Abrir" : null;
                      return (
                        <li key={x.grade_id} className="flex flex-wrap items-center gap-4 border-b border-borda px-5 py-3.5 last:border-b-0">
                          <span className="w-28 text-[13px] tabular-nums text-cinza-medio">{hora(x.inicio)} às {hora(x.fim)}</span>
                          <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                            <span className="text-[15px] font-semibold">{x.disciplina}</span>
                            <span className="text-[13px] text-cinza-medio">{detalhe}</span>
                          </div>
                          <span className={"inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium " + SELO[s].classe}>{SELO[s].nome}</span>
                          {acao ? (
                            <Link
                              href={`/diario/${x.grade_id}/${semana}`}
                              className={
                                "rounded-sm border px-3.5 py-2 text-[13px] font-medium " +
                                (acao === "Preencher"
                                  ? "border-trinitas-profundo bg-trinitas-profundo text-white hover:bg-trinitas-hover"
                                  : "border-borda bg-white hover:bg-cinza-claro")
                              }
                            >
                              <RotuloLink>{acao}</RotuloLink>
                            </Link>
                          ) : (
                            <span className="w-[86px]" />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}

function Chip({ href, ativo, nome }: { href: string; ativo: boolean; nome: string }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={
        "rounded-full border px-3 py-1.5 text-xs font-medium " +
        (ativo ? "border-cinza-escuro bg-cinza-escuro text-white" : "border-borda text-cinza-escuro hover:bg-cinza-claro")
      }
    >
      <RotuloLink>{nome}</RotuloLink>
    </Link>
  );
}

function Resumo({ rotulo, valor, cor }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="flex flex-col gap-1 border border-borda bg-white px-5 py-4">
      <span className="text-[13px] text-cinza-medio">{rotulo}</span>
      <span className={"font-display text-3xl font-bold " + (cor ?? "text-carvao")}>{valor}</span>
    </div>
  );
}
