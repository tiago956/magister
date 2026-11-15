import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, NOME_MODELO, perfilAtual, type ModeloAula } from "@/lib/dados";
import {
  dataCurta,
  dataDaAula,
  ehSegunda,
  prazoEnvio,
  prazoRevisao,
  prazoVencido,
  rotuloSemana,
  semanaDePlanejamento,
  somarDias,
} from "@/lib/semanas";
import { Selo, situacao, type StatusPlano } from "@/lib/status";

export const metadata: Metadata = { title: "Planos de aula" };

type Aula = {
  grade_id: number;
  dia_semana: number;
  inicio: string;
  fim: string;
  turma: string;
  disciplina: string;
  modelo: ModeloAula;
};

type Plano = { grade_id: number; status: StatusPlano; conteudo: unknown };

const ACAO: Record<string, string> = {
  nao_iniciado: "Planejar",
  rascunho: "Continuar",
  enviado: "Ver plano",
  ajustes: "Ajustar",
  aprovado: "Ver plano",
  realizado: "Ver plano",
  registrado: "Ver registro",
};

export default async function PlanosPage({ searchParams }: { searchParams: Promise<{ semana?: string }> }) {
  const perfil = (await perfilAtual())!;
  const { semana: semanaParam } = await searchParams;
  const semana = ehSegunda(semanaParam) ? semanaParam : semanaDePlanejamento();

  const supabase = await criarClienteServidor();
  const { data: a } = await supabase
    .from("aulas_semanais")
    .select("grade_id, dia_semana, inicio, fim, turma, disciplina, modelo")
    .eq("professor_id", perfil.id)
    .order("dia_semana")
    .order("inicio");
  const aulas = (a ?? []) as Aula[];

  const { data: p } = aulas.length
    ? await supabase
        .from("planos_aula")
        .select("grade_id, status, conteudo")
        .eq("semana_inicio", semana)
        .in("grade_id", aulas.map((x) => x.grade_id))
    : { data: [] };
  const planos = new Map(((p ?? []) as Plano[]).map((x) => [x.grade_id, x]));

  const sits = aulas.map((x) => situacao(planos.get(x.grade_id), x.modelo));
  const planejaveis = aulas.filter((x) => x.modelo !== "leitura").length;
  const enviados = sits.filter((s) => s === "enviado" || s === "aprovado" || s === "realizado").length;
  const aprovados = sits.filter((s) => s === "aprovado" || s === "realizado").length;
  const ajustes = sits.filter((s) => s === "ajustes").length;
  const pendentes = aulas.filter((x, i) => x.modelo !== "leitura" && (sits[i] === "nao_iniciado" || sits[i] === "rascunho")).length;
  const vencido = prazoVencido(semana);

  return (
    <div className="flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">
            Envio até quarta, {dataCurta(prazoEnvio(semana))} · revisão até sexta, {dataCurta(prazoRevisao(semana))}
          </span>
          <h1 className="text-3xl">Planos da semana de {rotuloSemana(semana)}</h1>
        </div>
        <nav aria-label="Trocar de semana" className="flex items-center gap-2">
          <Link href={`/planos?semana=${somarDias(semana, -7)}`} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            Semana anterior
          </Link>
          <Link href={`/planos?semana=${somarDias(semana, 7)}`} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            Próxima semana
          </Link>
        </nav>
      </header>

      {aulas.length === 0 ? (
        <section className="border border-borda bg-white p-6">
          <p className="leading-relaxed text-cinza-escuro">
            Nenhuma aula atribuída a você.{" "}
            {ehGestor(perfil) ? (
              <>
                Para acompanhar os planos da equipe, use a{" "}
                <Link href={`/revisao?semana=${semana}`} className="font-medium text-trinitas-profundo">
                  Revisão
                </Link>
                .
              </>
            ) : (
              "A coordenação define as turmas e matérias de cada professor."
            )}
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4" aria-label="Resumo da semana">
            <Resumo rotulo="Planos da semana" valor={planejaveis} />
            <Resumo rotulo="Enviados" valor={enviados} />
            <Resumo rotulo="Aprovados" valor={aprovados} cor="text-trinitas-profundo" />
            <Resumo rotulo="Ajustes solicitados" valor={ajustes} cor="text-lima-texto" />
          </section>

          {pendentes > 0 && (
            <p
              className={
                "border border-borda border-l-4 bg-white px-5 py-4 text-sm text-cinza-escuro " +
                (vencido ? "border-l-alerta-texto" : "border-l-lima")
              }
            >
              {vencido
                ? `O prazo de envio passou e ${pendentes} ${pendentes === 1 ? "plano ainda não foi enviado" : "planos ainda não foram enviados"}.`
                : `Faltam ${pendentes} ${pendentes === 1 ? "plano" : "planos"} para enviar até quarta, ${dataCurta(prazoEnvio(semana))}.`}
            </p>
          )}

          <section className="flex flex-col gap-6" aria-label="Aulas da semana">
            {DIAS.map((dia, i) => {
              const doDia = aulas.filter((x) => x.dia_semana === i + 1);
              if (!doDia.length) return null;
              return (
                <div key={dia} className="border border-borda bg-white">
                  <h2 className="border-b border-borda px-5 py-3 font-sans text-sm font-semibold">
                    {dia}, {dataCurta(dataDaAula(semana, i + 1))}
                  </h2>
                  <ul>
                    {doDia.map((x) => {
                      const s = situacao(planos.get(x.grade_id), x.modelo);
                      return (
                        <li key={x.grade_id} className="flex flex-wrap items-center gap-4 border-b border-borda px-5 py-3.5 last:border-b-0">
                          <span className="w-28 text-[13px] tabular-nums text-cinza-medio">
                            {hora(x.inicio)} às {hora(x.fim)}
                          </span>
                          <div className="flex min-w-[180px] flex-1 flex-col gap-0.5">
                            <span className="text-[15px] font-semibold">{x.disciplina}</span>
                            <span className="text-[13px] text-cinza-medio">
                              {x.turma} · {NOME_MODELO[x.modelo]}
                            </span>
                          </div>
                          <Selo status={s} />
                          <Link
                            href={`/planos/${x.grade_id}/${semana}`}
                            className="rounded-sm border border-borda bg-white px-3.5 py-2 text-[13px] font-medium hover:bg-cinza-claro"
                          >
                            {ACAO[s]}
                          </Link>
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

function Resumo({ rotulo, valor, cor = "text-carvao" }: { rotulo: string; valor: number; cor?: string }) {
  return (
    <div className="flex flex-col gap-2 border border-borda bg-white p-5">
      <span className="text-[13px] text-cinza-medio">{rotulo}</span>
      <span className={"font-display text-2xl font-bold " + cor}>{valor}</span>
    </div>
  );
}
