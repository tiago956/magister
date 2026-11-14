import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, NOME_MODELO, perfilAtual, type ModeloAula } from "@/lib/dados";

export const metadata: Metadata = { title: "Painel" };

type Aula = {
  grade_id: number;
  dia_semana: number;
  inicio: string;
  fim: string;
  turma: string;
  disciplina: string;
  modelo: ModeloAula;
};

export default async function PainelPage() {
  const perfil = (await perfilAtual())!;
  const supabase = await criarClienteServidor();

  const { data } = await supabase
    .from("aulas_semanais")
    .select("grade_id, dia_semana, inicio, fim, turma, disciplina, modelo")
    .eq("professor_id", perfil.id)
    .order("dia_semana")
    .order("inicio");
  const aulas = (data ?? []) as Aula[];

  let semProfessor = 0;
  if (ehGestor(perfil)) {
    const { count } = await supabase
      .from("aulas_semanais")
      .select("grade_id", { count: "exact", head: true })
      .is("professor_id", null);
    semProfessor = count ?? 0;
  }

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
            Abrir atribuições
          </Link>
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
