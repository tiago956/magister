import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, NOME_PAPEL, nomeFuncoes, perfilAtual, type Papel } from "@/lib/dados";
import { CAMPOS_AULA, CAMPOS_CURSO, NOME_SECAO, type Aula, type Curso } from "@/lib/formacao";
import BotaoEnviar from "@/components/botao-enviar";
import ExcluirDoisPassos from "@/components/excluir-dois-passos";
import { RotuloLink } from "@/components/link-status";
import { excluirAula, excluirCurso, salvarAula, salvarCurso } from "../../actions";

export const metadata: Metadata = { title: "Editar curso" };

const campo = "w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm font-normal focus:border-trinitas";
const botaoPrimario =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";

export default async function EditarCursoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erro?: string; secao?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) {
    return <p className="text-cinza-escuro">Esta área é da direção e da coordenação.</p>;
  }
  const novo = id === "novo";
  const cursoId = Number(id);
  if (!novo && !cursoId) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: c }, { data: a }, { data: cp }, { data: pessoas }] = await Promise.all([
    novo ? Promise.resolve({ data: null }) : supabase.from("cursos").select(CAMPOS_CURSO).eq("id", cursoId).maybeSingle(),
    novo ? Promise.resolve({ data: [] }) : supabase.from("curso_aulas").select(CAMPOS_AULA).eq("curso_id", cursoId).order("ordem").order("id"),
    novo ? Promise.resolve({ data: [] }) : supabase.from("curso_pessoas").select("perfil_id").eq("curso_id", cursoId),
    supabase.from("perfis").select("id, nome, funcoes").eq("ativo", true).order("nome"),
  ]);
  const curso = c as Curso | null;
  if (!novo && !curso) notFound();
  const aulas = (a ?? []) as Aula[];
  const escolhidas = new Set((cp ?? []).map((x) => x.perfil_id as string));
  const { data: g } = aulas.length
    ? await supabase.from("aula_gabaritos").select("aula_id, correta").in("aula_id", aulas.map((x) => x.id))
    : { data: [] };
  const gabarito = new Map((g ?? []).map((x) => [x.aula_id as number, x.correta as number]));

  const secaoPadrao = curso?.secao ?? (sp.secao === "onboarding" ? "onboarding" : "treinamento");
  const proximaOrdem = (aulas.at(-1)?.ordem ?? 0) + 1;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-borda pb-6">
        <Link href="/formacao?aba=cursos" className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
          <RotuloLink>Voltar aos cursos</RotuloLink>
        </Link>
        <h1 className="text-3xl">{novo ? "Novo curso" : curso!.titulo}</h1>
        {!novo && (
          <div className="flex flex-wrap gap-4 text-[13px]">
            <Link href={`/cursos/${cursoId}`} className="font-medium text-trinitas-profundo hover:text-trinitas-hover">
              <RotuloLink>Ver como participante</RotuloLink>
            </Link>
            <Link href={`/formacao?curso=${cursoId}`} className="font-medium text-trinitas-profundo hover:text-trinitas-hover">
              <RotuloLink>Ver acompanhamento</RotuloLink>
            </Link>
          </div>
        )}
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

      <section className="border border-borda bg-white" aria-labelledby="dados-curso">
        <h2 id="dados-curso" className="border-b border-borda px-5 py-4 text-lg">
          Dados do curso
        </h2>
        <form action={salvarCurso} className="grid gap-5 px-5 py-5 md:grid-cols-2">
          {!novo && <input type="hidden" name="id" value={cursoId} />}
          <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
            Nome do curso
            <input name="titulo" required maxLength={160} defaultValue={curso?.titulo ?? ""} className={campo} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Seção
            <select name="secao" defaultValue={secaoPadrao} className={campo}>
              <option value="onboarding">{NOME_SECAO.onboarding}</option>
              <option value="treinamento">{NOME_SECAO.treinamento}</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Prazo (opcional)
              <input type="date" name="prazo" defaultValue={curso?.prazo ?? ""} className={campo} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Ordem na lista
              <input type="number" name="ordem" min={0} max={999} defaultValue={curso?.ordem ?? 0} className={campo} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
            Descrição (opcional)
            <textarea name="descricao" rows={3} maxLength={4000} defaultValue={curso?.descricao ?? ""} className={campo} />
          </label>

          <fieldset className="flex flex-col gap-3 md:col-span-2">
            <legend className="mb-1 text-sm font-medium">Para quem é o curso</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="publico" value="todos" defaultChecked={(curso?.publico ?? "todos") === "todos"} className="h-4 w-4 accent-trinitas-profundo" />
              Toda a equipe
            </label>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="publico" value="papeis" defaultChecked={curso?.publico === "papeis"} className="h-4 w-4 accent-trinitas-profundo" />
                Funções escolhidas
              </label>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pl-6">
                {(Object.keys(NOME_PAPEL) as Papel[]).map((x) => (
                  <label key={x} className="flex items-center gap-2 text-sm text-cinza-escuro">
                    <input type="checkbox" name="papel" value={x} defaultChecked={curso?.papeis.includes(x)} className="h-4 w-4 accent-trinitas-profundo" />
                    {NOME_PAPEL[x]}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="publico" value="pessoas" defaultChecked={curso?.publico === "pessoas"} className="h-4 w-4 accent-trinitas-profundo" />
                Pessoas escolhidas
              </label>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-x-5 gap-y-2 pl-6">
                {(pessoas ?? []).map((x) => (
                  <label key={x.id} className="flex items-center gap-2 text-sm text-cinza-escuro">
                    <input type="checkbox" name="pessoa" value={x.id} defaultChecked={escolhidas.has(x.id)} className="h-4 w-4 accent-trinitas-profundo" />
                    {x.nome} <span className="text-xs text-cinza-medio">({nomeFuncoes(x.funcoes as Papel[])})</span>
                  </label>
                ))}
              </div>
            </div>
          </fieldset>

          <label className="flex items-start gap-2.5 text-sm md:col-span-2">
            <input type="checkbox" name="publicado" defaultChecked={curso?.publicado ?? false} className="mt-0.5 h-4 w-4 accent-trinitas-profundo" />
            <span>
              <strong className="font-medium">Publicado</strong>
              <span className="block text-xs text-cinza-medio">Enquanto não estiver publicado, só a direção e a coordenação veem o curso.</span>
            </span>
          </label>
          <div className="md:col-span-2">
            <BotaoEnviar className={botaoPrimario}>{novo ? "Criar curso" : "Salvar curso"}</BotaoEnviar>
          </div>
        </form>
      </section>

      {!novo && (
        <section className="flex flex-col gap-4" aria-labelledby="aulas-curso">
          <h2 id="aulas-curso" className="text-xl">
            Aulas
          </h2>
          {aulas.map((x, i) => (
            <details key={x.id} className="border border-borda bg-white">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5">
                <span className="text-[13px] tabular-nums text-cinza-medio">{i + 1}.</span>
                <span className="flex-1 font-semibold">{x.titulo}</span>
                <span className="text-xs text-cinza-medio">{x.pergunta ? "com pergunta" : "sem pergunta"}</span>
              </summary>
              <div className="border-t border-borda">
                <FormAula cursoId={cursoId} aula={x} correta={gabarito.get(x.id)} ordem={x.ordem} />
                <div className="border-t border-borda px-5 py-3">
                  <ExcluirDoisPassos
                    acao={excluirAula}
                    campos={{ id: x.id, curso_id: cursoId }}
                    rotulo="Excluir aula"
                    pergunta="Excluir esta aula? O progresso da equipe nela também será apagado."
                  />
                </div>
              </div>
            </details>
          ))}
          <div className="border border-dashed border-trinitas bg-white">
            <h3 className="border-b border-borda px-5 py-3.5 font-sans text-sm font-semibold">Adicionar aula</h3>
            <FormAula cursoId={cursoId} ordem={proximaOrdem} />
          </div>

          <div className="mt-4 border-t border-borda pt-6">
            <ExcluirDoisPassos
              acao={excluirCurso}
              campos={{ id: cursoId }}
              rotulo="Excluir curso"
              pergunta="Excluir o curso, todas as aulas e o progresso da equipe? Não dá para desfazer."
            />
          </div>
        </section>
      )}
    </div>
  );
}

function FormAula({ cursoId, aula, correta, ordem }: { cursoId: number; aula?: Aula; correta?: number; ordem: number }) {
  return (
    <form action={salvarAula} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_120px]">
      <input type="hidden" name="curso_id" value={cursoId} />
      {aula && <input type="hidden" name="id" value={aula.id} />}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Título da aula
        <input name="titulo" required maxLength={160} defaultValue={aula?.titulo ?? ""} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Ordem
        <input type="number" name="ordem" min={0} max={999} defaultValue={ordem} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
        Link do vídeo no YouTube
        <input
          name="youtube"
          required
          placeholder="https://youtu.be/..."
          defaultValue={aula ? `https://youtu.be/${aula.youtube_id}` : ""}
          className={campo}
        />
        <span className="text-xs font-normal text-cinza-medio">Use vídeos “não listados”: não aparecem em buscas, mas tocam aqui.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
        Texto de apoio (opcional)
        <textarea name="descricao" rows={2} maxLength={4000} defaultValue={aula?.descricao ?? ""} className={campo} />
      </label>
      <fieldset className="flex flex-col gap-3 border-t border-borda pt-4 md:col-span-2">
        <legend className="sr-only">Pergunta de verificação</legend>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Pergunta de verificação (opcional)
          <input name="pergunta" maxLength={500} defaultValue={aula?.pergunta ?? ""} className={campo} />
        </label>
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Alternativas (uma por linha)
            <textarea name="opcoes" rows={4} defaultValue={aula?.opcoes?.join("\n") ?? ""} className={campo} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Nº da correta
            <input type="number" name="correta" min={1} max={6} defaultValue={correta !== undefined ? correta + 1 : ""} className={campo} />
            <span className="text-xs font-normal text-cinza-medio">Ex.: 2 para a segunda linha. Não é mostrada a quem faz o curso.</span>
          </label>
        </div>
      </fieldset>
      <div className="md:col-span-2">
        <BotaoEnviar className={botaoPrimario}>{aula ? "Salvar aula" : "Adicionar aula"}</BotaoEnviar>
      </div>
    </form>
  );
}
