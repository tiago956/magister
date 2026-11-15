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
import type { StatusPlano } from "@/lib/status";
import { aprovarEmLote } from "../planos/actions";
import BotaoEnviar from "@/components/botao-enviar";
import { RotuloLink } from "@/components/link-status";

export const metadata: Metadata = { title: "Revisão" };

type Aula = {
  grade_id: number;
  dia_semana: number;
  inicio: string;
  turma: string;
  turma_codigo: string;
  turma_ordem: number;
  disciplina: string;
  modelo: ModeloAula;
  professor_id: string | null;
};
type Plano = { id: number; grade_id: number; status: StatusPlano; enviado_em: string | null };

const botaoPrimario =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";

export default async function RevisaoPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string; turma?: string; ok?: string; erro?: string }>;
}) {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl">Revisão de planos</h1>
        <p className="mt-4 text-cinza-escuro">Esta área é da coordenação e da direção.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const semana = ehSegunda(sp.semana) ? sp.semana : semanaDePlanejamento();
  const supabase = await criarClienteServidor();

  const [{ data: a }, { data: p }, { data: pessoas }] = await Promise.all([
    supabase
      .from("aulas_semanais")
      .select("grade_id, dia_semana, inicio, turma, turma_codigo, turma_ordem, disciplina, modelo, professor_id")
      .neq("modelo", "leitura")
      .order("turma_ordem")
      .order("dia_semana")
      .order("inicio"),
    supabase.from("planos_aula").select("id, grade_id, status, enviado_em").eq("semana_inicio", semana),
    supabase.from("perfis").select("id, nome"),
  ]);
  const aulas = (a ?? []) as Aula[];
  const planos = new Map(((p ?? []) as Plano[]).map((x) => [x.grade_id, x]));
  const nome = new Map((pessoas ?? []).map((x) => [x.id as string, x.nome as string]));

  const statusDe = (g: number) => planos.get(g)?.status;
  const conta = (f: (s: StatusPlano | undefined) => boolean) => aulas.filter((x) => f(statusDe(x.grade_id))).length;
  const aguardando = conta((s) => s === "enviado");
  const aprovados = conta((s) => s === "aprovado" || s === "realizado");
  const ajustes = conta((s) => s === "ajustes");
  const naoEnviados = conta((s) => !s || s === "rascunho");

  const turmas = [...new Map(aulas.map((x) => [x.turma_codigo, { codigo: x.turma_codigo, nome: x.turma, ordem: x.turma_ordem }])).values()].sort(
    (x, y) => x.ordem - y.ordem,
  );
  const turmaSel = turmas.find((t) => t.codigo === sp.turma)?.codigo ?? "";
  const fila = aulas.filter((x) => statusDe(x.grade_id) === "enviado" && (!turmaSel || x.turma_codigo === turmaSel));

  const pendentesPorProfessor = new Map<string, number>();
  let semProfessor = 0;
  for (const x of aulas) {
    const s = statusDe(x.grade_id);
    if (s && s !== "rascunho") continue;
    if (!x.professor_id) semProfessor++;
    else pendentesPorProfessor.set(x.professor_id, (pendentesPorProfessor.get(x.professor_id) ?? 0) + 1);
  }
  const pendentes = [...pendentesPorProfessor.entries()].sort((x, y) => y[1] - x[1]);

  const link = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ semana, ...(turmaSel ? { turma: turmaSel } : {}), ...extra });
    for (const [k, v] of [...q.entries()]) if (!v) q.delete(k);
    return `/revisao?${q.toString()}`;
  };

  return (
    <div className="flex max-w-7xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">
            Envio até quarta, {dataCurta(prazoEnvio(semana))} · revisão até sexta, {dataCurta(prazoRevisao(semana))}
          </span>
          <h1 className="text-3xl">Revisão · semana de {rotuloSemana(semana)}</h1>
        </div>
        <nav aria-label="Trocar de semana" className="flex items-center gap-2">
          <Link href={`/revisao?semana=${somarDias(semana, -7)}`} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Semana anterior</RotuloLink>
          </Link>
          <Link href={`/revisao?semana=${somarDias(semana, 7)}`} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Próxima semana</RotuloLink>
          </Link>
        </nav>
      </header>

      {sp.ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {sp.ok}
        </p>
      )}
      {sp.erro && (
        <p role="alert" className="rounded-sm bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {sp.erro}
        </p>
      )}

      <section className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4" aria-label="Resumo da semana">
        <Resumo rotulo="Planos da semana" valor={aulas.length} />
        <Resumo rotulo="Aguardando revisão" valor={aguardando} />
        <Resumo rotulo="Aprovados" valor={aprovados} cor="text-trinitas-profundo" />
        <Resumo rotulo="Ajustes solicitados" valor={ajustes} cor="text-lima-texto" />
        <Resumo rotulo={prazoVencido(semana) ? "Não enviados (prazo vencido)" : "Ainda não enviados"} valor={naoEnviados} cor={prazoVencido(semana) && naoEnviados ? "text-alerta-texto" : "text-carvao"} />
      </section>

      <div className="flex flex-wrap items-start gap-8">
        <form action={aprovarEmLote} className="min-w-0 flex-[999_1_600px] border border-borda bg-white">
          <input type="hidden" name="semana" value={semana} />
          <input type="hidden" name="turma" value={turmaSel} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
            <nav aria-label="Filtrar por turma" className="flex flex-wrap gap-1.5">
              <Filtro href={link({ turma: "" })} ativo={!turmaSel}>
                Todas
              </Filtro>
              {turmas.map((t) => (
                <Filtro key={t.codigo} href={link({ turma: t.codigo })} ativo={t.codigo === turmaSel}>
                  {t.nome}
                </Filtro>
              ))}
            </nav>
            {fila.length > 0 && (
              <BotaoEnviar pendente="Aprovando..." className={botaoPrimario}>
                Aprovar marcados
              </BotaoEnviar>
            )}
          </div>
          {fila.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cinza-medio">Nenhum plano aguardando revisão{turmaSel ? " nesta turma" : ""}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-cinza-claro text-left text-[13px]">
                    <th scope="col" className="w-10 border-b border-borda px-5 py-2.5">
                      <span className="sr-only">Marcar</span>
                    </th>
                    <th scope="col" className="border-b border-borda px-2 py-2.5 font-semibold">Turma</th>
                    <th scope="col" className="border-b border-borda px-2 py-2.5 font-semibold">Aula</th>
                    <th scope="col" className="border-b border-borda px-2 py-2.5 font-semibold">Professor(a)</th>
                    <th scope="col" className="border-b border-borda px-2 py-2.5 font-semibold">Modelo</th>
                    <th scope="col" className="border-b border-borda px-5 py-2.5">
                      <span className="sr-only">Abrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fila.map((x) => {
                    const pl = planos.get(x.grade_id)!;
                    return (
                      <tr key={x.grade_id}>
                        <td className="border-b border-borda px-5 py-3">
                          <input
                            type="checkbox"
                            name="plano"
                            value={pl.id}
                            aria-label={`Marcar ${x.disciplina}, ${x.turma}`}
                            className="h-4 w-4 cursor-pointer accent-trinitas-profundo"
                          />
                        </td>
                        <td className="border-b border-borda px-2 py-3 whitespace-nowrap">{x.turma}</td>
                        <td className="border-b border-borda px-2 py-3">
                          <span className="block font-semibold">{x.disciplina}</span>
                          <span className="block text-[13px] text-cinza-medio">
                            {DIAS[x.dia_semana - 1]}, {dataCurta(dataDaAula(semana, x.dia_semana))} · {hora(x.inicio)}
                          </span>
                        </td>
                        <td className="border-b border-borda px-2 py-3 text-cinza-escuro">{x.professor_id ? nome.get(x.professor_id) : "—"}</td>
                        <td className="border-b border-borda px-2 py-3 text-[13px] text-cinza-escuro">{NOME_MODELO[x.modelo]}</td>
                        <td className="border-b border-borda px-5 py-3 text-right">
                          <Link
                            href={`/planos/${x.grade_id}/${semana}`}
                            className="rounded-sm border border-borda px-3.5 py-2 text-[13px] font-medium whitespace-nowrap hover:bg-cinza-claro"
                          >
                            <RotuloLink>Revisar</RotuloLink>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </form>

        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4 border border-borda bg-white p-5">
          <h2 className="text-lg">Planos não enviados</h2>
          {pendentes.length === 0 && semProfessor === 0 ? (
            <p className="text-sm text-cinza-medio">Todos os planos da semana foram enviados.</p>
          ) : (
            <ul className="flex flex-col">
              {pendentes.map(([id, n]) => (
                <li key={id} className="flex justify-between gap-3 border-b border-[#F3F4F6] py-2 text-sm">
                  <span className="text-cinza-escuro">{nome.get(id) ?? "—"}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
              {semProfessor > 0 && (
                <li className="flex justify-between gap-3 py-2 text-sm">
                  <Link href="/atribuicoes" className="text-alerta-texto hover:underline">
                    Aulas sem professor atribuído
                  </Link>
                  <span className="font-semibold tabular-nums text-alerta-texto">{semProfessor}</span>
                </li>
              )}
            </ul>
          )}
        </aside>
      </div>
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

function Filtro({ href, ativo, children }: { href: string; ativo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={
        "rounded-full border px-3 py-1.5 text-xs font-medium " +
        (ativo ? "border-trinitas-profundo bg-trinitas-profundo text-white" : "border-borda text-cinza-escuro hover:bg-cinza-claro")
      }
    >
      <RotuloLink>{children}</RotuloLink>
    </Link>
  );
}
