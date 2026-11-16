import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, NOME_MODELO, perfilAtual, type ModeloAula } from "@/lib/dados";
import { dataCurta, dataDaAula, hojeIso, prazoEnvio, prazoVencido, rotuloSemana, semanaDePlanejamento, somarDias } from "@/lib/semanas";
import { RotuloLink } from "@/components/link-status";
import { eventosEntre, NOME_TIPO, quando, suspensao } from "@/lib/calendario";
import { CAMPOS_CURSO, dataBr, ehPublicoDo, type Curso } from "@/lib/formacao";

export const metadata: Metadata = { title: "Painel" };

type Aula = {
  grade_id: number;
  dia_semana: number;
  inicio: string;
  fim: string;
  turma: string;
  turma_id: number;
  disciplina: string;
  modelo: ModeloAula;
};

export default async function PainelPage() {
  const perfil = (await perfilAtual())!;
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("aulas_semanais")
    .select("grade_id, dia_semana, inicio, fim, turma, turma_id, disciplina, modelo")
    .eq("professor_id", perfil.id)
    .order("dia_semana")
    .order("inicio");
  const aulas = (data ?? []) as Aula[];

  const semana = semanaDePlanejamento();
  const hoje = hojeIso();
  const [eventosSemana, proximos] = await Promise.all([
    eventosEntre(supabase, semana, somarDias(semana, 4)),
    eventosEntre(supabase, hoje, somarDias(hoje, 14)),
  ]);
  const minhasTurmas = new Set(aulas.map((a) => a.turma_id));
  const agenda = proximos
    .filter((e) => e.data_fim >= hoje && (!e.turmas.length || ehGestor(perfil) || e.turmas.some((t) => minhasTurmas.has(t))))
    .slice(0, 6);
  const planejaveis = aulas.filter(
    (a) => a.modelo !== "leitura" && !suspensao(eventosSemana, dataDaAula(semana, a.dia_semana), a.turma_id),
  );
  const { data: pls } = planejaveis.length
    ? await supabase
        .from("planos_aula")
        .select("status")
        .eq("semana_inicio", semana)
        .in("grade_id", planejaveis.map((a) => a.grade_id))
    : { data: [] };
  const st = (pls ?? []).map((x) => x.status as string);
  const enviados = st.filter((x) => x === "enviado" || x === "aprovado" || x === "realizado").length;
  const ajustes = st.filter((x) => x === "ajustes").length;

  let semProfessor = 0;
  if (ehGestor(perfil)) {
    const { count } = await supabase
      .from("aulas_semanais")
      .select("grade_id", { count: "exact", head: true })
      .is("professor_id", null);
    semProfessor = count ?? 0;
  }

  // Formação: cursos publicados para esta pessoa ainda não concluídos.
  const [{ data: cs }, { data: cpp }, { data: aas }, { data: prs }] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).eq("publicado", true).order("prazo", { nullsFirst: false }),
    supabase.from("curso_pessoas").select("curso_id").eq("perfil_id", perfil.id),
    supabase.from("curso_aulas").select("id, curso_id"),
    supabase.from("aula_progresso").select("aula_id, concluida_em").eq("perfil_id", perfil.id),
  ]);
  const nominal = new Set((cpp ?? []).map((x) => x.curso_id as number));
  const concluidas = new Set((prs ?? []).filter((x) => x.concluida_em).map((x) => x.aula_id as number));
  const cursosPendentes = ((cs ?? []) as Curso[])
    .filter((c) => ehPublicoDo(c, perfil, nominal.has(c.id) ? new Set([perfil.id]) : new Set()))
    .map((c) => {
      const ids = (aas ?? []).filter((x) => x.curso_id === c.id).map((x) => x.id as number);
      return { curso: c, faltam: ids.filter((i) => !concluidas.has(i)).length };
    })
    .filter((x) => x.faltam > 0);

  const turmas = [...new Set(aulas.map((a) => a.turma))];
  const disciplinas = [...new Set(aulas.map((a) => a.disciplina))];
  const primeiroNome = perfil.nome.split(" ")[0];

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-1.5 border-b border-borda pb-6">
        <span className="text-[13px] text-cinza-medio">Ano letivo de 2027</span>
        <h1 className="text-3xl">Olá, {primeiroNome}</h1>
      </header>

      {ehGestor(perfil) && (
        <section
          className={
            "flex flex-wrap items-center justify-between gap-3 border border-borda bg-white px-5 py-4 " +
            (semProfessor ? "border-l-4 border-l-lima" : "border-l-4 border-l-trinitas")
          }
        >
          <p className="text-sm text-cinza-escuro">
            {semProfessor
              ? `${semProfessor} aulas da grade ainda estão sem professor atribuído.`
              : "Todas as aulas da grade têm professor atribuído."}
          </p>
          <Link href="/atribuicoes" className="text-sm font-medium text-trinitas-profundo hover:text-trinitas-hover">
            <RotuloLink>Abrir atribuições</RotuloLink>
          </Link>
        </section>
      )}

      {planejaveis.length > 0 && (
        <section
          className={
            "flex flex-wrap items-center justify-between gap-3 border border-borda border-l-4 bg-white px-5 py-4 " +
            (ajustes || (enviados < planejaveis.length && prazoVencido(semana)) ? "border-l-alerta-texto" : enviados === planejaveis.length ? "border-l-trinitas" : "border-l-lima")
          }
        >
          <div className="flex flex-col gap-1">
            <strong className="text-sm">
              Planejamento da semana de {rotuloSemana(semana)}: {enviados} de {planejaveis.length} planos enviados
            </strong>
            <span className="text-sm text-cinza-escuro">
              {ajustes
                ? `${ajustes} ${ajustes === 1 ? "plano com ajustes solicitados" : "planos com ajustes solicitados"} pela coordenação.`
                : `Prazo de envio: quarta-feira, ${dataCurta(prazoEnvio(semana))}.`}
            </span>
          </div>
          <Link href={`/planos?semana=${semana}`} className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-4 py-2 text-sm font-medium text-white hover:bg-trinitas-hover">
            <RotuloLink>Abrir planos</RotuloLink>
          </Link>
        </section>
      )}

      {cursosPendentes.length > 0 && (
        <section className="border border-borda border-l-4 border-l-lima bg-white">
          <h2 className="border-b border-borda px-5 py-3 text-lg">Sua formação</h2>
          <ul>
            {cursosPendentes.slice(0, 5).map(({ curso, faltam }) => (
              <li key={curso.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-borda px-5 py-2.5 text-sm last:border-b-0">
                <Link href={`/cursos/${curso.id}`} className="flex-1 font-medium hover:text-trinitas-profundo">
                  <RotuloLink>{curso.titulo}</RotuloLink>
                </Link>
                <span className="text-xs text-cinza-medio">
                  {faltam} {faltam === 1 ? "aula a fazer" : "aulas a fazer"}
                  {curso.prazo && ` · prazo ${dataBr(curso.prazo)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agenda.length > 0 && (
        <section className="border border-borda bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-3">
            <h2 className="text-lg">Próximos 15 dias</h2>
            <Link href="/calendario" className="text-sm font-medium text-trinitas-profundo hover:text-trinitas-hover">
              <RotuloLink>Abrir calendário</RotuloLink>
            </Link>
          </div>
          <ul>
            {agenda.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-borda px-5 py-2.5 text-sm last:border-b-0">
                <span className="w-36 shrink-0 text-[13px] tabular-nums text-cinza-medio">{quando(e)}</span>
                <span className="flex-1 font-medium">{e.titulo}</span>
                <span className="text-xs text-cinza-medio">
                  {NOME_TIPO[e.tipo]}
                  {e.suspende_aulas ? " · sem aula" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {aulas.length === 0 ? (
        <section className="border border-borda bg-white p-6">
          <h2 className="text-lg">Suas aulas da semana</h2>
          <p className="mt-2 leading-relaxed text-cinza-escuro">
            Nenhuma aula atribuída a você ainda. A coordenação define as turmas e matérias de cada professor na tela de
            Atribuições.
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4" aria-label="Resumo">
            <Resumo rotulo="Aulas por semana" valor={String(aulas.length)} />
            <Resumo rotulo={turmas.length === 1 ? "Turma" : "Turmas"} valor={turmas.length === 1 ? turmas[0] : String(turmas.length)} />
            <Resumo rotulo="Matérias" valor={String(disciplinas.length)} />
          </section>

          <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4" aria-label="Aulas da semana">
            {DIAS.map((dia, i) => {
              const doDia = aulas.filter((a) => a.dia_semana === i + 1);
              return (
                <div key={dia} className="flex flex-col border border-borda bg-white">
                  <h2 className="border-b border-borda px-4 py-3 font-sans text-sm font-semibold">
                    {dia} <span className="font-normal text-cinza-medio">· {doDia.length} aulas</span>
                  </h2>
                  <ul className="flex flex-col">
                    {doDia.map((a) => (
                      <li key={a.grade_id} className="flex flex-col gap-0.5 border-b border-borda px-4 py-3 last:border-b-0">
                        <span className="text-xs text-cinza-medio tabular-nums">
                          {hora(a.inicio)} às {hora(a.fim)}
                        </span>
                        <span className="text-[15px] font-semibold">{a.disciplina}</span>
                        <span className="text-xs text-cinza-medio">
                          {a.turma} · {NOME_MODELO[a.modelo]}
                        </span>
                      </li>
                    ))}
                    {doDia.length === 0 && <li className="px-4 py-3 text-sm text-cinza-medio">Sem aulas</li>}
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

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-2 border border-borda bg-white p-5">
      <span className="text-[13px] text-cinza-medio">{rotulo}</span>
      <span className="font-display text-2xl font-bold">{valor}</span>
    </div>
  );
}
