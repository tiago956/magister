import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, NOME_PAPEL, nomeFuncoes, perfilAtual, type Papel } from "@/lib/dados";
import { hojeIso } from "@/lib/semanas";
import {
  CAMPOS_CURSO,
  COR_SITUACAO,
  dataBr,
  ehPublicoDo,
  NOME_SECAO,
  NOME_SITUACAO,
  situacaoCurso,
  type Curso,
  type Secao,
} from "@/lib/formacao";
import { RotuloLink } from "@/components/link-status";

export const metadata: Metadata = { title: "Formação da equipe" };

type Pessoa = { id: string; nome: string; funcoes: Papel[] };
type Prog = { aula_id: number; perfil_id: string; percentual: number; concluida_em: string | null; atualizado_em: string };

export default async function FormacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; secao?: string; curso?: string; ok?: string; erro?: string }>;
}) {
  const sp = await searchParams;
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl">Formação da equipe</h1>
        <p className="mt-4 text-cinza-escuro">Esta área é da direção e da coordenação.</p>
      </div>
    );
  }
  const hoje = hojeIso();
  const aba = sp.aba === "cursos" ? "cursos" : "acompanhamento";
  const secaoSel: Secao | null = sp.secao === "onboarding" || sp.secao === "treinamento" ? sp.secao : null;

  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: a }, { data: pr }, { data: cp }, { data: pe }] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).order("secao").order("ordem").order("id"),
    supabase.from("curso_aulas").select("id, curso_id, titulo, ordem").order("ordem").order("id"),
    supabase.from("aula_progresso").select("aula_id, perfil_id, percentual, concluida_em, atualizado_em"),
    supabase.from("curso_pessoas").select("curso_id, perfil_id"),
    supabase.from("perfis").select("id, nome, funcoes").eq("ativo", true).order("nome"),
  ]);
  const cursos = (c ?? []) as Curso[];
  const aulas = (a ?? []) as { id: number; curso_id: number; titulo: string; ordem: number }[];
  const progresso = (pr ?? []) as Prog[];
  const pessoas = (pe ?? []) as Pessoa[];
  const pessoasDo = new Map<number, Set<string>>();
  for (const x of cp ?? []) {
    const s = pessoasDo.get(x.curso_id as number) ?? new Set<string>();
    s.add(x.perfil_id as string);
    pessoasDo.set(x.curso_id as number, s);
  }
  const prog = new Map(progresso.map((x) => [`${x.aula_id}|${x.perfil_id}`, x]));
  const aulasDo = (cursoId: number) => aulas.filter((x) => x.curso_id === cursoId);

  const publicados = cursos.filter((x) => x.publicado && (!secaoSel || x.secao === secaoSel));
  const publico = (curso: Curso) => pessoas.filter((p) => ehPublicoDo(curso, p, pessoasDo.get(curso.id) ?? new Set()));

  function resumo(curso: Curso, pessoaId: string) {
    const as = aulasDo(curso.id);
    let feitas = 0;
    let iniciadas = 0;
    let ultima: string | null = null;
    for (const x of as) {
      const p = prog.get(`${x.id}|${pessoaId}`);
      if (!p) continue;
      iniciadas++;
      if (p.concluida_em) feitas++;
      if (!ultima || p.atualizado_em > ultima) ultima = p.atualizado_em;
    }
    return { total: as.length, feitas, iniciadas, ultima, sit: situacaoCurso(as.length, feitas, iniciadas, curso.prazo, hoje) };
  }

  // Totais
  let atribuicoes = 0;
  let concluidos = 0;
  let atrasados = 0;
  for (const curso of publicados)
    for (const p of publico(curso)) {
      atribuicoes++;
      const r = resumo(curso, p.id);
      if (r.sit === "concluido") concluidos++;
      if (r.sit === "atrasado") atrasados++;
    }

  const cursoFoco = sp.curso ? cursos.find((x) => x.id === Number(sp.curso)) : undefined;
  const linhas = pessoas.filter((p) => publicados.some((curso) => ehPublicoDo(curso, p, pessoasDo.get(curso.id) ?? new Set())));

  const link = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | null> = { aba, secao: secaoSel, ...extra };
    for (const [k, v] of Object.entries(base)) if (v && !(k === "aba" && v === "acompanhamento")) q.set(k, v);
    const s = q.toString();
    return `/formacao${s ? `?${s}` : ""}`;
  };

  return (
    <div className="flex max-w-7xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">Onboarding e treinamentos</span>
          <h1 className="text-3xl">Formação da equipe</h1>
        </div>
        <Link
          href={`/formacao/cursos/novo${secaoSel ? `?secao=${secaoSel}` : ""}`}
          className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:bg-trinitas-hover"
        >
          <RotuloLink>Novo curso</RotuloLink>
        </Link>
      </header>

      {sp.ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {sp.ok}
        </p>
      )}
      {sp.erro && (
        <p role="alert" className="rounded-sm border border-alerta-texto/30 bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {sp.erro}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Abas" className="flex gap-1 border-b border-borda">
          {[
            ["acompanhamento", "Acompanhamento"],
            ["cursos", "Cursos"],
          ].map(([k, nome]) => (
            <Link
              key={k}
              href={link({ aba: k, curso: null })}
              aria-current={aba === k ? "page" : undefined}
              className={"-mb-px border-b-2 px-4 py-2 text-sm " + (aba === k ? "border-trinitas font-semibold text-trinitas-profundo" : "border-transparent text-cinza-escuro hover:text-carvao")}
            >
              <RotuloLink>{nome}</RotuloLink>
            </Link>
          ))}
        </nav>
        <nav aria-label="Filtrar por seção" className="flex flex-wrap gap-1.5">
          <Filtro href={link({ secao: null, curso: null })} ativo={!secaoSel}>
            Todas as seções
          </Filtro>
          {(["onboarding", "treinamento"] as Secao[]).map((s) => (
            <Filtro key={s} href={link({ secao: s, curso: null })} ativo={secaoSel === s}>
              {NOME_SECAO[s]}
            </Filtro>
          ))}
        </nav>
      </div>

      {aba === "cursos" ? (
        <section className="border border-borda bg-white">
          {cursos.filter((x) => !secaoSel || x.secao === secaoSel).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-cinza-medio">Nenhum curso cadastrado ainda. Comece em “Novo curso”.</p>
          ) : (
            <ul>
              {cursos
                .filter((x) => !secaoSel || x.secao === secaoSel)
                .map((curso) => (
                  <li key={curso.id} className="flex flex-wrap items-center gap-4 border-b border-borda px-5 py-3.5 last:border-b-0">
                    <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                      <span className="font-semibold">{curso.titulo}</span>
                      <span className="text-xs text-cinza-medio">
                        {NOME_SECAO[curso.secao]} · {aulasDo(curso.id).length} aulas ·{" "}
                        {curso.publico === "todos"
                          ? "toda a equipe"
                          : curso.publico === "papeis"
                            ? curso.papeis.map((p) => NOME_PAPEL[p]).join(", ")
                            : `${pessoasDo.get(curso.id)?.size ?? 0} pessoas`}
                        {curso.prazo && ` · prazo ${dataBr(curso.prazo)}`}
                      </span>
                    </div>
                    <span className={"rounded-full px-2.5 py-1 text-[11px] font-medium " + (curso.publicado ? "bg-trinitas-suave text-trinitas-texto" : "bg-cinza-claro text-cinza-escuro")}>
                      {curso.publicado ? "Publicado" : "Rascunho"}
                    </span>
                    <Link href={`/formacao/cursos/${curso.id}`} className="rounded-sm border border-borda px-3.5 py-2 text-[13px] font-medium hover:bg-cinza-claro">
                      <RotuloLink>Editar</RotuloLink>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ) : cursoFoco ? (
        <DetalheCurso
          curso={cursoFoco}
          aulas={aulasDo(cursoFoco.id)}
          pessoas={publico(cursoFoco)}
          prog={prog}
          resumo={resumo}
          voltar={link({ curso: null })}
        />
      ) : (
        <>
          <section className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4" aria-label="Resumo">
            <Resumo rotulo="Cursos publicados" valor={publicados.length} />
            <Resumo rotulo="Cursos a fazer (pessoa × curso)" valor={atribuicoes} />
            <Resumo rotulo="Concluídos" valor={concluidos} cor="text-trinitas-profundo" />
            <Resumo rotulo="Atrasados" valor={atrasados} cor={atrasados ? "text-alerta-texto" : "text-carvao"} />
          </section>

          {publicados.length === 0 || linhas.length === 0 ? (
            <p className="border border-borda bg-white px-6 py-10 text-center text-sm text-cinza-medio">
              Nenhum curso publicado {secaoSel ? "nesta seção " : ""}ainda.
            </p>
          ) : (
            <section className="overflow-x-auto border border-borda bg-white" aria-label="Progresso por pessoa e curso">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-cinza-claro text-left text-[13px]">
                    <th scope="col" className="sticky left-0 border-b border-borda bg-cinza-claro px-5 py-2.5 font-semibold">
                      Pessoa
                    </th>
                    {publicados.map((curso) => (
                      <th key={curso.id} scope="col" className="min-w-36 border-b border-l border-borda px-3 py-2.5 align-bottom font-semibold">
                        <Link href={link({ curso: String(curso.id) })} className="hover:text-trinitas-profundo">
                          <RotuloLink>{curso.titulo}</RotuloLink>
                        </Link>
                        <span className="block text-[11px] font-normal text-cinza-medio">
                          {NOME_SECAO[curso.secao]}
                          {curso.prazo && ` · até ${dataBr(curso.prazo).slice(0, 5)}`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="sticky left-0 border-b border-borda bg-white px-5 py-3 text-left font-normal">
                        <Link href={`/formacao/pessoas/${p.id}`} className="font-medium hover:text-trinitas-profundo">
                          <RotuloLink>{p.nome}</RotuloLink>
                        </Link>
                        <span className="block text-xs text-cinza-medio">{nomeFuncoes(p.funcoes)}</span>
                      </th>
                      {publicados.map((curso) => {
                        if (!ehPublicoDo(curso, p, pessoasDo.get(curso.id) ?? new Set()))
                          return (
                            <td key={curso.id} className="border-b border-l border-borda px-3 py-3 text-center text-cinza-medio">
                              <span aria-label="Não se aplica">—</span>
                            </td>
                          );
                        const r = resumo(curso, p.id);
                        return (
                          <td key={curso.id} className="border-b border-l border-borda px-3 py-3">
                            <span className={"inline-block rounded-full px-2 py-0.5 text-[11px] font-medium " + COR_SITUACAO[r.sit]}>{NOME_SITUACAO[r.sit]}</span>
                            <span className="mt-1 block text-xs tabular-nums text-cinza-medio">
                              {r.feitas}/{r.total} aulas
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function DetalheCurso({
  curso,
  aulas,
  pessoas,
  prog,
  resumo,
  voltar,
}: {
  curso: Curso;
  aulas: { id: number; titulo: string }[];
  pessoas: Pessoa[];
  prog: Map<string, Prog>;
  resumo: (c: Curso, p: string) => { total: number; feitas: number; ultima: string | null; sit: keyof typeof NOME_SITUACAO };
  voltar: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">{curso.titulo}</h2>
        <div className="flex gap-4 text-sm">
          <Link href={`/formacao/cursos/${curso.id}`} className="font-medium text-trinitas-profundo">
            <RotuloLink>Editar curso</RotuloLink>
          </Link>
          <Link href={voltar} className="font-medium text-trinitas-profundo">
            <RotuloLink>Ver todos os cursos</RotuloLink>
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto border border-borda bg-white">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-cinza-claro text-left text-[13px]">
              <th scope="col" className="border-b border-borda px-5 py-2.5 font-semibold">Pessoa</th>
              <th scope="col" className="border-b border-borda px-3 py-2.5 font-semibold">Situação</th>
              {aulas.map((x, i) => (
                <th key={x.id} scope="col" title={x.titulo} className="border-b border-l border-borda px-3 py-2.5 font-semibold">
                  Aula {i + 1}
                </th>
              ))}
              <th scope="col" className="border-b border-l border-borda px-3 py-2.5 font-semibold">Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => {
              const r = resumo(curso, p.id);
              return (
                <tr key={p.id}>
                  <th scope="row" className="border-b border-borda px-5 py-3 text-left font-normal">
                    <Link href={`/formacao/pessoas/${p.id}`} className="font-medium hover:text-trinitas-profundo">
                      <RotuloLink>{p.nome}</RotuloLink>
                    </Link>
                  </th>
                  <td className="border-b border-borda px-3 py-3">
                    <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + COR_SITUACAO[r.sit]}>{NOME_SITUACAO[r.sit]}</span>
                  </td>
                  {aulas.map((x) => {
                    const pr = prog.get(`${x.id}|${p.id}`);
                    return (
                      <td key={x.id} className="border-b border-l border-borda px-3 py-3 tabular-nums">
                        {pr?.concluida_em ? <span className="font-medium text-trinitas-profundo">✓</span> : pr ? `${pr.percentual}%` : <span className="text-cinza-medio">—</span>}
                      </td>
                    );
                  })}
                  <td className="border-b border-l border-borda px-3 py-3 text-xs text-cinza-medio">{r.ultima ? dataBr(r.ultima) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
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
        (ativo ? "border-trinitas-profundo bg-trinitas-profundo text-white" : "border-borda bg-white text-cinza-escuro hover:bg-cinza-claro")
      }
    >
      <RotuloLink>{children}</RotuloLink>
    </Link>
  );
}
