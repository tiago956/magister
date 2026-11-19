import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, hora, perfilAtual } from "@/lib/dados";
import { dataCurta, dataDaAula, ehSegunda, hojeIso } from "@/lib/semanas";
import { CAMPOS_DIARIO, rascunhoDoPlano, type RegistroDiario } from "@/lib/diario";
import { doDia, eventosEntre } from "@/lib/calendario";
import BotaoEnviar from "@/components/botao-enviar";
import { RotuloLink } from "@/components/link-status";
import { salvarDiario } from "../../actions";

export const metadata: Metadata = { title: "Diário de classe" };

const campo =
  "w-full rounded-sm border border-borda bg-white px-3 py-2.5 text-sm leading-relaxed text-carvao focus:border-trinitas-profundo focus:outline-none";
const rotulo = "flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro";

function quando(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);
}

export default async function DiarioAulaPage({
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
    .select("grade_id, dia_semana, inicio, fim, turma, turma_id, turma_codigo, disciplina, professor_id")
    .eq("grade_id", grade_id)
    .single();
  if (!aula) notFound();

  const responsavel = aula.professor_id === perfil.id;
  const voltarPara = !responsavel && gestor ? `/diario?semana=${semana}&turma=${aula.turma_codigo}` : `/diario?semana=${semana}`;
  const dia = dataDaAula(semana, aula.dia_semana);

  const cabecalho = (
    <header className="flex flex-col gap-1.5 border-b border-borda pb-6">
      <Link href={voltarPara} className="text-[13px] font-medium text-trinitas-profundo">
        <RotuloLink>Voltar ao diário</RotuloLink>
      </Link>
      <span className="text-[13px] text-cinza-medio">
        {aula.turma} · {DIAS[aula.dia_semana - 1]}, {dataCurta(dia)} · {hora(aula.inicio)} às {hora(aula.fim)}
      </span>
      <h1 className="text-3xl">{aula.disciplina}</h1>
    </header>
  );

  if (!responsavel && !gestor) {
    return (
      <div className="flex max-w-3xl flex-col gap-6">
        {cabecalho}
        <p className="text-cinza-escuro">Esta aula não está atribuída a você.</p>
      </div>
    );
  }

  const [{ data: reg }, { data: plano }, eventosDoDia] = await Promise.all([
    supabase.from("diario_classe").select(CAMPOS_DIARIO).eq("grade_id", grade_id).eq("semana_inicio", semana).maybeSingle(),
    supabase.from("planos_aula").select("topico, conteudo, status").eq("grade_id", grade_id).eq("semana_inicio", semana).maybeSingle(),
    eventosEntre(supabase, dia, dia).then((evs) => doDia(evs, dia, aula.turma_id)),
  ]);
  const registro = reg as RegistroDiario | null;
  const semAula = eventosDoDia.find((e) => e.suspende_aulas);
  const futura = dia > hojeIso();

  const nomes = new Map<string, string>();
  const ids = [aula.professor_id, registro?.atualizado_por].filter((x): x is string => !!x);
  if (ids.length) {
    const { data: pe } = await supabase.from("perfis").select("id, nome").in("id", ids);
    for (const p of pe ?? []) nomes.set(p.id, p.nome);
  }

  const doPlano = registro ? null : rascunhoDoPlano(plano);
  const valores = registro
    ? { conteudo_dado: registro.conteudo_dado, objetivo: registro.objetivo, materiais: registro.materiais ?? "", observacoes: registro.observacoes ?? "" }
    : { ...(doPlano ?? { conteudo_dado: "", objetivo: "", materiais: "" }), observacoes: "" };
  const podeEditar = !futura && (responsavel || (gestor && !!registro));

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {cabecalho}

      {ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {ok}
        </p>
      )}
      {erro && (
        <p role="alert" className="rounded-sm border border-alerta-texto/40 bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {erro}
        </p>
      )}

      {semAula && (
        <p className="border border-borda border-l-4 border-l-lima bg-white px-5 py-4 text-sm text-cinza-escuro">
          Pelo calendário escolar não houve aula neste dia ({semAula.titulo}).
        </p>
      )}

      {futura ? (
        <p className="border border-borda bg-white px-5 py-4 text-sm text-cinza-escuro">
          O diário desta aula abre no dia da aula, {dataCurta(dia)}.{" "}
          <Link href={`/planos/${grade_id}/${semana}`} className="font-medium text-trinitas-profundo">
            Ver o plano de aula
          </Link>
        </p>
      ) : !registro && !responsavel ? (
        <p className="border border-borda bg-white px-5 py-4 text-sm text-cinza-escuro">
          {aula.professor_id
            ? `${nomes.get(aula.professor_id) ?? "O professor"} ainda não registrou esta aula no diário.`
            : "Esta aula não tem professor atribuído."}
        </p>
      ) : (
        <>
          {registro ? (
            <p className="text-[13px] text-cinza-medio">
              Registrado em {quando(registro.registrado_em)}
              {registro.atualizado_em !== registro.registrado_em &&
                ` · corrigido em ${quando(registro.atualizado_em)}${registro.atualizado_por && nomes.get(registro.atualizado_por) ? ` por ${nomes.get(registro.atualizado_por)}` : ""}`}
            </p>
          ) : doPlano ? (
            <p className="border border-borda border-l-4 border-l-lima bg-white px-5 py-4 text-sm leading-relaxed text-cinza-escuro">
              <strong className="font-semibold">Preenchido com o plano de aula.</strong> Revise cada campo e corrija o que foi diferente na sala de
              aula antes de registrar.
            </p>
          ) : (
            <p className="border border-borda bg-white px-5 py-4 text-sm text-cinza-escuro">
              Esta aula não tem plano preenchido. Registre o que foi dado em sala.
            </p>
          )}

          <form action={salvarDiario} className="flex flex-col gap-5 border border-borda bg-white p-6">
            <input type="hidden" name="grade_id" value={grade_id} />
            <input type="hidden" name="semana" value={semana} />
            <fieldset disabled={!podeEditar} className="flex flex-col gap-5">
              <label className={rotulo}>
                Objetivo da aula
                <textarea name="objetivo" required rows={2} defaultValue={valores.objetivo} className={campo} />
              </label>
              <label className={rotulo}>
                Conteúdo dado em sala
                <span className="font-normal text-cinza-medio">O que foi trabalhado de fato com a turma.</span>
                <textarea name="conteudo_dado" required rows={6} defaultValue={valores.conteudo_dado} className={campo} />
              </label>
              <label className={rotulo}>
                Livro, páginas e materiais usados
                <span className="font-normal text-cinza-medio">Se for o caso. Exemplo: Livro “No Princípio era a Palavra”, p. 11 a 15; caderno.</span>
                <textarea name="materiais" rows={2} defaultValue={valores.materiais} className={campo} />
              </label>
              <label className={rotulo}>
                Observações
                <span className="font-normal text-cinza-medio">Opcional: o que ficou para a próxima aula, ocorrências, ajustes.</span>
                <textarea name="observacoes" rows={3} defaultValue={valores.observacoes} className={campo} />
              </label>
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              {podeEditar && (
                <BotaoEnviar className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover">
                  {registro ? "Salvar correção" : "Registrar aula"}
                </BotaoEnviar>
              )}
              {plano && (
                <Link href={`/planos/${grade_id}/${semana}`} className="text-sm font-medium text-trinitas-profundo">
                  Ver o plano de aula
                </Link>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
