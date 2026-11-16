import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";
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

const TEXTO: Record<Secao, string> = {
  onboarding: "Os primeiros passos na Trinitas: quem somos, como trabalhamos e o que se espera de cada um.",
  treinamento: "Formação continuada da equipe. Assista às aulas na ordem; o seu progresso fica salvo.",
};

export default async function ListaCursos({ secao }: { secao: Secao }) {
  const perfil = (await perfilAtual())!;
  const supabase = await criarClienteServidor();
  const hoje = hojeIso();

  const [{ data: c }, { data: cp }] = await Promise.all([
    supabase.from("cursos").select(CAMPOS_CURSO).eq("secao", secao).eq("publicado", true).order("ordem").order("id"),
    supabase.from("curso_pessoas").select("curso_id").eq("perfil_id", perfil.id),
  ]);
  const meus = new Set((cp ?? []).map((x) => x.curso_id as number));
  const cursos = ((c ?? []) as Curso[]).filter((x) => ehPublicoDo(x, perfil, meus.has(x.id) ? new Set([perfil.id]) : new Set()));

  const ids = cursos.map((x) => x.id);
  const { data: a } = ids.length ? await supabase.from("curso_aulas").select("id, curso_id").in("curso_id", ids) : { data: [] };
  const aulas = (a ?? []) as { id: number; curso_id: number }[];
  const { data: p } = aulas.length
    ? await supabase.from("aula_progresso").select("aula_id, concluida_em").eq("perfil_id", perfil.id).in("aula_id", aulas.map((x) => x.id))
    : { data: [] };
  const prog = new Map((p ?? []).map((x) => [x.aula_id as number, x.concluida_em as string | null]));

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">Formação da equipe</span>
          <h1 className="text-3xl">{NOME_SECAO[secao]}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-cinza-escuro">{TEXTO[secao]}</p>
        </div>
        {ehGestor(perfil) && (
          <Link href="/formacao" className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Gerenciar cursos</RotuloLink>
          </Link>
        )}
      </header>

      {cursos.length === 0 ? (
        <p className="border border-borda bg-white px-6 py-10 text-center text-sm text-cinza-medio">
          Nenhum curso disponível para você nesta seção por enquanto.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {cursos.map((curso) => {
            const daqui = aulas.filter((x) => x.curso_id === curso.id);
            const feitas = daqui.filter((x) => prog.get(x.id)).length;
            const iniciadas = daqui.filter((x) => prog.has(x.id)).length;
            const sit = situacaoCurso(daqui.length, feitas, iniciadas, curso.prazo, hoje);
            const pct = daqui.length ? Math.round((100 * feitas) / daqui.length) : 0;
            return (
              <li key={curso.id}>
                <Link href={`/cursos/${curso.id}`} className="flex h-full flex-col gap-3 border border-borda bg-white p-5 transition-colors hover:border-trinitas">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg leading-snug">{curso.titulo}</h2>
                    <span className={"shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium " + COR_SITUACAO[sit]}>{NOME_SITUACAO[sit]}</span>
                  </div>
                  {curso.descricao && <p className="line-clamp-3 text-sm leading-relaxed text-cinza-escuro">{curso.descricao}</p>}
                  <div className="mt-auto flex flex-col gap-1.5 pt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-cinza-claro" aria-hidden="true">
                      <div className="h-full bg-trinitas" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="flex justify-between text-xs text-cinza-medio">
                      <span>
                        {feitas} de {daqui.length} {daqui.length === 1 ? "aula" : "aulas"}
                      </span>
                      {curso.prazo && <span className={sit === "atrasado" ? "font-medium text-alerta-texto" : ""}>Prazo: {dataBr(curso.prazo)}</span>}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-trinitas-profundo">
                    <RotuloLink>{sit === "concluido" ? "Rever curso" : iniciadas ? "Continuar" : "Começar"}</RotuloLink>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
