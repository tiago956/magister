import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, NOME_MODELO, perfilAtual, type ModeloAula } from "@/lib/dados";
import { duracaoAula, momentosDo, type Conteudo, type Segmento } from "@/lib/modelos";
import { dataCurta, dataDaAula, ehSegunda, prazoEnvio, rotuloSemana } from "@/lib/semanas";
import { Selo, situacao, type StatusPlano } from "@/lib/status";
import Editor from "./editor";

export const metadata: Metadata = { title: "Plano de aula" };

export default async function PlanoPage({
  params,
  searchParams,
}: {
  params: Promise<{ grade: string; semana: string }>;
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { grade, semana } = await params;
  const { ok, erro } = await searchParams;
  const grade_id = Number(grade);
  if (!grade_id || !ehSegunda(semana)) notFound();

  const perfil = (await perfilAtual())!;
  const gestor = ehGestor(perfil);
  const supabase = await criarClienteServidor();

  const { data: aula } = await supabase
    .from("aulas_semanais")
    .select("grade_id, dia_semana, inicio, fim, turma, turma_id, disciplina, disciplina_id, segmento, modelo, professor_id")
    .eq("grade_id", grade_id)
    .single();
  if (!aula) notFound();

  const responsavel = aula.professor_id === perfil.id;
  const caminho = `/planos/${grade_id}/${semana}`;

  if (!responsavel && !gestor) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl">Plano de aula</h1>
        <p className="mt-4 text-cinza-escuro">Esta aula não está atribuída a você.</p>
        <Link href="/planos" className="mt-4 inline-block text-sm font-medium text-trinitas-profundo">
          Voltar aos meus planos
        </Link>
      </div>
    );
  }

  const [{ data: plano }, { data: banco }, { data: dono }] = await Promise.all([
    supabase
      .from("planos_aula")
      .select("id, topico, conteudo, status, realizacao, obs_pos_aula, enviado_em, revisado_em")
      .eq("grade_id", grade_id)
      .eq("semana_inicio", semana)
      .maybeSingle(),
    supabase
      .from("catecismos")
      .select("id, pergunta, resposta")
      .eq("disciplina_id", aula.disciplina_id)
      .eq("turma_id", aula.turma_id)
      .order("criado_em", { ascending: false })
      .limit(50),
    aula.professor_id
      ? supabase.from("perfis").select("nome").eq("id", aula.professor_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const { data: coms } = plano
    ? await supabase
        .from("plano_comentarios")
        .select("id, bloco, texto, criado_em, autor:perfis!plano_comentarios_autor_id_fkey(nome, papel)")
        .eq("plano_id", plano.id)
        .order("criado_em")
    : { data: [] };

  const segmento = aula.segmento as Segmento;
  const modelo = aula.modelo as ModeloAula;
  const momentos = momentosDo(modelo, segmento);
  const status = (plano?.status ?? null) as StatusPlano | null;
  const editavel = responsavel && (!status || status === "rascunho" || status === "enviado" || status === "ajustes");
  const sit = situacao(plano ? { status: plano.status as StatusPlano, conteudo: plano.conteudo } : undefined, modelo);

  const comentarios = ((coms ?? []) as unknown as {
    id: number;
    bloco: string | null;
    texto: string;
    criado_em: string;
    autor: { nome: string; papel: string } | null;
  }[]).map((c) => ({
    id: c.id,
    bloco: c.bloco,
    texto: c.texto,
    quando: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(
      new Date(c.criado_em),
    ),
    autor: c.autor?.nome ?? "—",
    daGestao: c.autor?.papel === "coordenacao" || c.autor?.papel === "direcao",
  }));

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-borda pb-6">
        <Link href={gestor && !responsavel ? `/revisao?semana=${semana}` : `/planos?semana=${semana}`} className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
          {gestor && !responsavel ? "Voltar à revisão" : "Voltar aos planos da semana"}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-cinza-medio">
              {aula.turma} · {DIAS[aula.dia_semana - 1]}, {dataCurta(dataDaAula(semana, aula.dia_semana))} · {hora(aula.inicio)} às {hora(aula.fim)}
              {dono?.nome && !responsavel ? ` · ${dono.nome}` : ""}
            </span>
            <h1 className="text-3xl">{aula.disciplina}</h1>
            <span className="text-[13px] text-cinza-medio">
              {NOME_MODELO[modelo]} · semana de {rotuloSemana(semana)}
              {modelo !== "leitura" && ` · envio até quarta, ${dataCurta(prazoEnvio(semana))}`}
            </span>
          </div>
          <Selo status={sit} />
        </div>
      </header>

      {ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {ok}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-sm border border-alerta-texto/30 bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {erro}
        </p>
      )}

      <Editor
        gradeId={grade_id}
        semana={semana}
        caminho={caminho}
        modelo={modelo}
        momentos={momentos}
        duracao={duracaoAula(segmento)}
        conteudoInicial={(plano?.conteudo ?? {}) as Conteudo}
        topicoInicial={plano?.topico ?? ""}
        planoId={plano?.id ?? null}
        status={status}
        realizacao={plano?.realizacao ?? null}
        obsPosAula={plano?.obs_pos_aula ?? null}
        editavel={editavel}
        responsavel={responsavel}
        gestor={gestor}
        banco={banco ?? []}
        comentarios={comentarios}
      />
    </div>
  );
}
