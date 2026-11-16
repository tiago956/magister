import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";
import {
  CAMPOS_AULA,
  CAMPOS_CURSO,
  CAMPOS_PROGRESSO,
  dataBr,
  ehPublicoDo,
  NOME_SECAO,
  ROTA_SECAO,
  type Aula,
  type Curso,
  type Progresso,
} from "@/lib/formacao";
import { RotuloLink } from "@/components/link-status";
import AulaInterativa from "./aula";

export const metadata: Metadata = { title: "Curso" };

export default async function CursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aula?: string }>;
}) {
  const { id } = await params;
  const { aula: aulaParam } = await searchParams;
  const cursoId = Number(id);
  if (!cursoId) notFound();

  const perfil = (await perfilAtual())!;
  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: a }, { data: cp }] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).eq("id", cursoId).maybeSingle(),
    supabase.from("curso_aulas").select(CAMPOS_AULA).eq("curso_id", cursoId).order("ordem").order("id"),
    supabase.from("curso_pessoas").select("perfil_id").eq("curso_id", cursoId).eq("perfil_id", perfil.id),
  ]);
  const curso = c as Curso | null;
  if (!curso) notFound();
  const aulas = (a ?? []) as Aula[];
  const participa = curso.publicado && ehPublicoDo(curso, perfil, new Set((cp ?? []).map((x) => x.perfil_id as string)));

  const { data: p } = aulas.length
    ? await supabase.from("aula_progresso").select(CAMPOS_PROGRESSO).eq("perfil_id", perfil.id).in("aula_id", aulas.map((x) => x.id))
    : { data: [] };
  const prog = new Map(((p ?? []) as Progresso[]).map((x) => [x.aula_id, x]));

  const indice = Math.max(
    0,
    aulaParam ? aulas.findIndex((x) => x.id === Number(aulaParam)) : aulas.findIndex((x) => !prog.get(x.id)?.concluida_em),
  );
  const atual = aulas[indice];
  const pa = atual ? prog.get(atual.id) : undefined;
  const proxima = aulas[indice + 1] ? `/cursos/${curso.id}?aula=${aulas[indice + 1].id}` : null;
  const feitas = aulas.filter((x) => prog.get(x.id)?.concluida_em).length;

  return (
    <div className="flex max-w-7xl flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-borda pb-6">
        <Link href={ROTA_SECAO[curso.secao]} className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
          <RotuloLink>Voltar a {NOME_SECAO[curso.secao]}</RotuloLink>
        </Link>
        <h1 className="text-3xl">{curso.titulo}</h1>
        <span className="text-[13px] text-cinza-medio">
          {feitas} de {aulas.length} {aulas.length === 1 ? "aula concluída" : "aulas concluídas"}
          {curso.prazo && ` · prazo ${dataBr(curso.prazo)}`}
          {!curso.publicado && " · não publicado"}
        </span>
        {ehGestor(perfil) && (
          <Link href={`/formacao/cursos/${curso.id}`} className="self-start text-[13px] font-medium text-trinitas-profundo hover:text-trinitas-hover">
            <RotuloLink>Editar curso</RotuloLink>
          </Link>
        )}
      </header>

      {!atual ? (
        <p className="border border-borda bg-white px-6 py-10 text-center text-sm text-cinza-medio">Este curso ainda não tem aulas.</p>
      ) : (
        <div className="flex flex-wrap-reverse items-start gap-8">
          <nav aria-label="Aulas do curso" className="min-w-0 flex-[1_1_260px] border border-borda bg-white">
            <h2 className="border-b border-borda px-4 py-3 font-sans text-sm font-semibold">Aulas</h2>
            <ol>
              {aulas.map((x, i) => {
                const pr = prog.get(x.id);
                const ativa = x.id === atual.id;
                return (
                  <li key={x.id}>
                    <Link
                      href={`/cursos/${curso.id}?aula=${x.id}`}
                      aria-current={ativa ? "page" : undefined}
                      className={
                        "flex items-start gap-3 border-b border-l-2 border-b-borda px-4 py-3 text-sm last:border-b-0 hover:bg-cinza-claro " +
                        (ativa ? "border-l-trinitas bg-cinza-claro font-semibold" : "border-l-transparent")
                      }
                    >
                      <span
                        className={
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] " +
                          (pr?.concluida_em ? "bg-trinitas-profundo text-white" : "border border-borda text-cinza-medio")
                        }
                        aria-hidden="true"
                      >
                        {pr?.concluida_em ? "✓" : i + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <RotuloLink>{x.titulo}</RotuloLink>
                        <span className="text-xs font-normal text-cinza-medio">
                          {pr?.concluida_em ? "Concluída" : pr ? `${pr.percentual}% assistido` : "Não iniciada"}
                          {x.pergunta ? " · com pergunta" : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-4" aria-labelledby="titulo-aula">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-cinza-medio">
                Aula {indice + 1} de {aulas.length}
              </span>
              <h2 id="titulo-aula" className="text-2xl">
                {atual.titulo}
              </h2>
            </div>
            <AulaInterativa
              key={atual.id}
              aulaId={atual.id}
              youtubeId={atual.youtube_id}
              participa={participa}
              inicial={{
                trechos: pa?.trechos ?? [],
                percentual: pa?.percentual ?? 0,
                posicao: pa?.posicao ?? 0,
                acertou: pa?.acertou ?? null,
                tentativas: pa?.tentativas ?? 0,
                concluida: !!pa?.concluida_em,
              }}
              pergunta={atual.pergunta}
              opcoes={atual.opcoes}
              proxima={proxima}
            />
            {atual.descricao && <p className="whitespace-pre-line text-[15px] leading-relaxed text-cinza-escuro">{atual.descricao}</p>}
            {curso.descricao && indice === 0 && (
              <p className="whitespace-pre-line border-t border-borda pt-4 text-sm leading-relaxed text-cinza-medio">{curso.descricao}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
