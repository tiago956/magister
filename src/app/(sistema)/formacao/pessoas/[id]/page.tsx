import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, nomeFuncoes, perfilAtual, type Papel } from "@/lib/dados";
import { hojeIso } from "@/lib/semanas";
import {
  CAMPOS_CURSO,
  CAMPOS_PROGRESSO,
  COR_SITUACAO,
  dataBr,
  ehPublicoDo,
  NOME_SECAO,
  NOME_SITUACAO,
  situacaoCurso,
  type Curso,
  type Progresso,
} from "@/lib/formacao";
import { RotuloLink } from "@/components/link-status";

export const metadata: Metadata = { title: "Formação · pessoa" };

const quando = (ts: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(ts));

export default async function PessoaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eu = await perfilAtual();
  if (!ehGestor(eu)) return <p className="text-cinza-escuro">Esta área é da direção e da coordenação.</p>;

  const supabase = await criarClienteServidor();
  const { data: pessoa } = await supabase.from("perfis").select("id, nome, funcoes, email").eq("id", id).maybeSingle();
  if (!pessoa) notFound();

  const [{ data: c }, { data: cp }, { data: a }, { data: pr }] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).eq("publicado", true).order("secao").order("ordem").order("id"),
    supabase.from("curso_pessoas").select("curso_id").eq("perfil_id", id),
    supabase.from("curso_aulas").select("id, curso_id, titulo, pergunta").order("ordem").order("id"),
    supabase.from("aula_progresso").select(CAMPOS_PROGRESSO).eq("perfil_id", id),
  ]);
  const nominal = new Set((cp ?? []).map((x) => x.curso_id as number));
  const cursos = ((c ?? []) as Curso[]).filter((x) => ehPublicoDo(x, { id, funcoes: pessoa.funcoes as Papel[] }, nominal.has(x.id) ? new Set([id]) : new Set()));
  const aulas = (a ?? []) as { id: number; curso_id: number; titulo: string; pergunta: string | null }[];
  const prog = new Map(((pr ?? []) as Progresso[]).map((x) => [x.aula_id, x]));
  const hoje = hojeIso();

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-borda pb-6">
        <Link href="/formacao" className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
          <RotuloLink>Voltar à formação da equipe</RotuloLink>
        </Link>
        <h1 className="text-3xl">{pessoa.nome}</h1>
        <span className="text-[13px] text-cinza-medio">{nomeFuncoes(pessoa.funcoes as Papel[])}</span>
      </header>

      {cursos.length === 0 && <p className="text-sm text-cinza-medio">Nenhum curso publicado é destinado a esta pessoa.</p>}

      {cursos.map((curso) => {
        const daqui = aulas.filter((x) => x.curso_id === curso.id);
        const feitas = daqui.filter((x) => prog.get(x.id)?.concluida_em).length;
        const iniciadas = daqui.filter((x) => prog.has(x.id)).length;
        const sit = situacaoCurso(daqui.length, feitas, iniciadas, curso.prazo, hoje);
        return (
          <section key={curso.id} className="border border-borda bg-white" aria-labelledby={`curso-${curso.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <h2 id={`curso-${curso.id}`} className="text-lg">
                  {curso.titulo}
                </h2>
                <span className="text-xs text-cinza-medio">
                  {NOME_SECAO[curso.secao]} · {feitas} de {daqui.length} aulas{curso.prazo && ` · prazo ${dataBr(curso.prazo)}`}
                </span>
              </div>
              <span className={"rounded-full px-2.5 py-1 text-[11px] font-medium " + COR_SITUACAO[sit]}>{NOME_SITUACAO[sit]}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-cinza-medio">
                    <th scope="col" className="border-b border-borda px-5 py-2 font-medium">Aula</th>
                    <th scope="col" className="border-b border-borda px-3 py-2 font-medium">Vídeo assistido</th>
                    <th scope="col" className="border-b border-borda px-3 py-2 font-medium">Pergunta</th>
                    <th scope="col" className="border-b border-borda px-3 py-2 font-medium">Concluída em</th>
                  </tr>
                </thead>
                <tbody>
                  {daqui.map((x, i) => {
                    const p = prog.get(x.id);
                    return (
                      <tr key={x.id}>
                        <td className="border-b border-borda px-5 py-2.5">
                          {i + 1}. {x.titulo}
                        </td>
                        <td className="border-b border-borda px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-cinza-claro" aria-hidden="true">
                              <div className={"h-full " + ((p?.percentual ?? 0) >= 90 ? "bg-trinitas" : "bg-lima")} style={{ width: `${p?.percentual ?? 0}%` }} />
                            </div>
                            <span className="tabular-nums text-cinza-escuro">{p ? `${p.percentual}%` : "—"}</span>
                          </div>
                        </td>
                        <td className="border-b border-borda px-3 py-2.5 text-cinza-escuro">
                          {!x.pergunta
                            ? <span className="text-cinza-medio">sem pergunta</span>
                            : !p?.tentativas
                              ? <span className="text-cinza-medio">não respondida</span>
                              : p.acertou
                                ? `acertou (${p.tentativas} ${p.tentativas === 1 ? "tentativa" : "tentativas"})`
                                : `errou ${p.tentativas}×, ainda sem acerto`}
                        </td>
                        <td className="border-b border-borda px-3 py-2.5 text-cinza-escuro">
                          {p?.concluida_em ? quando(p.concluida_em) : p ? <span className="text-cinza-medio">em andamento · visto {quando(p.atualizado_em)}</span> : <span className="text-cinza-medio">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
