import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";
import {
  COR_TIPO,
  diaDaSemana,
  doDia,
  ehFimDeSemana,
  ehMes,
  eventosEntre,
  mesDe,
  NOME_TIPO,
  nomeDoMes,
  podeAgendar,
  quando,
  somarMeses,
  TIPOS,
  ultimoDiaDoMes,
  valeParaTurma,
  type Evento,
  type TipoEvento,
} from "@/lib/calendario";
import { dataCurta, hojeIso, prazoEnvio, prazoRevisao, somarDias } from "@/lib/semanas";
import BotaoEnviar from "@/components/botao-enviar";
import { RotuloLink } from "@/components/link-status";
import { renovarLink, salvarEvento } from "./actions";
import { CopiarLink, ExcluirEvento } from "./interativos";

export const metadata: Metadata = { title: "Calendário" };

// Primeiro e último dia de aula de 2027, para os prazos de planejamento.
const INICIO_AULAS = "2027-01-25";
const FIM_AULAS = "2027-12-17";

type Prazo = { dia: string; titulo: string };

const botaoPrimario =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";
const campo = "w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm focus:border-trinitas";

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    tipo?: string;
    turma?: string;
    novo?: string;
    data?: string;
    editar?: string;
    assinar?: string;
    ok?: string;
    erro?: string;
  }>;
}) {
  const sp = await searchParams;
  const perfil = (await perfilAtual())!;
  const agenda = podeAgendar(perfil);
  const hoje = hojeIso();
  const mes = ehMes(sp.mes) ? sp.mes : mesDe(hoje) < "2027-01" ? "2027-01" : mesDe(hoje);

  const primeiro = `${mes}-01`;
  const ultimo = ultimoDiaDoMes(mes);
  const gradeIni = somarDias(primeiro, -diaDaSemana(primeiro));
  const gradeFim = somarDias(ultimo, 6 - diaDaSemana(ultimo));

  const supabase = await criarClienteServidor();
  const [eventos, { data: t }, { data: d }, { data: token }] = await Promise.all([
    eventosEntre(supabase, gradeIni, somarDias(gradeFim, 7)),
    supabase.from("turmas").select("id, nome, codigo").order("ordem"),
    supabase.from("disciplinas").select("id, nome").order("nome"),
    supabase.rpc("meu_token_agenda"),
  ]);
  const turmas = (t ?? []) as { id: number; nome: string; codigo: string }[];
  const disciplinas = (d ?? []) as { id: number; nome: string }[];
  const nomeTurma = new Map(turmas.map((x) => [x.id, x.nome]));

  const tipoSel = TIPOS.includes(sp.tipo as TipoEvento) ? (sp.tipo as TipoEvento) : null;
  const turmaSel = turmas.find((x) => x.codigo === sp.turma) ?? null;
  const visiveis = eventos.filter((e) => (!tipoSel || e.tipo === tipoSel) && (!turmaSel || valeParaTurma(e, turmaSel.id)));

  // Prazos de planejamento: só em semanas com aula.
  const prazos: Prazo[] = [];
  if (perfil.papel !== "secretaria" && !tipoSel) {
    for (let dia = gradeIni; dia <= gradeFim; dia = somarDias(dia, 1)) {
      if (diaDaSemana(dia) !== 2) continue;
      const alvo = somarDias(dia, 5);
      if (alvo < somarDias(INICIO_AULAS, -6) || alvo > FIM_AULAS) continue;
      const temAula = [0, 1, 2, 3, 4].some((i) => {
        const x = somarDias(alvo, i);
        return x >= INICIO_AULAS && x <= FIM_AULAS && !eventos.some((e) => e.suspende_aulas && e.turmas.length === 0 && e.data_inicio <= x && x <= e.data_fim);
      });
      if (!temAula) continue;
      prazos.push({ dia: prazoEnvio(alvo), titulo: `Envio dos planos da semana de ${dataCurta(alvo)}` });
      if (ehGestor(perfil)) prazos.push({ dia: prazoRevisao(alvo), titulo: `Revisão dos planos da semana de ${dataCurta(alvo)}` });
    }
  }

  const editando = agenda && sp.editar ? (eventos.find((e) => e.id === Number(sp.editar)) ?? null) : null;
  const abrirForm = agenda && (sp.novo === "1" || !!editando);
  const dataNova = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : mesDe(hoje) === mes ? hoje : primeiro;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "magister-bice.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const linkAgenda = token ? `${proto}://${host}/agenda/${token}.ics` : null;

  const link = (extra: Record<string, string | null>) => {
    const q = new URLSearchParams();
    const base: Record<string, string | null> = { mes, tipo: tipoSel, turma: turmaSel?.codigo ?? null, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) q.set(k, v);
    return `/calendario?${q.toString()}`;
  };

  const dias: string[] = [];
  for (let dia = gradeIni; dia <= gradeFim; dia = somarDias(dia, 1)) dias.push(dia);
  const doMes = visiveis.filter((e) => e.data_fim >= primeiro && e.data_inicio <= ultimo);

  return (
    <div className="flex max-w-7xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">Calendário escolar 2027</span>
          <h1 className="text-3xl first-letter:uppercase">{nomeDoMes(mes)}</h1>
        </div>
        <nav aria-label="Trocar de mês" className="flex flex-wrap items-center gap-2">
          <Link href={link({ mes: somarMeses(mes, -1), novo: null })} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Mês anterior</RotuloLink>
          </Link>
          <Link href={link({ mes: somarMeses(mes, 1) })} className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Próximo mês</RotuloLink>
          </Link>
          {agenda && !abrirForm && (
            <Link href={link({ novo: "1" })} className={botaoPrimario}>
              <RotuloLink>Novo evento</RotuloLink>
            </Link>
          )}
        </nav>
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

      {abrirForm && (
        <section className="border border-borda border-t-4 border-t-trinitas bg-white" aria-labelledby="titulo-form">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
            <h2 id="titulo-form" className="text-lg">
              {editando ? "Editar evento" : "Novo evento"}
            </h2>
            <Link href={link({})} className="text-sm text-trinitas-profundo hover:text-trinitas-hover">
              <RotuloLink>Fechar</RotuloLink>
            </Link>
          </div>
          <form action={salvarEvento} className="grid gap-5 px-5 py-5 md:grid-cols-2">
            <input type="hidden" name="mes" value={mes} />
            {editando && <input type="hidden" name="id" value={editando.id} />}
            <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
              Nome do evento
              <input name="titulo" required maxLength={160} defaultValue={editando?.titulo ?? ""} className={campo} />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Tipo
              <select name="tipo" required defaultValue={editando?.tipo ?? "evento"} className={campo}>
                {TIPOS.map((x) => (
                  <option key={x} value={x}>
                    {NOME_TIPO[x]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Matéria (opcional)
              <select name="disciplina_id" defaultValue={editando?.disciplina_id ?? ""} className={campo}>
                <option value="">Nenhuma</option>
                {disciplinas.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Data inicial
                <input type="date" name="data_inicio" required defaultValue={editando?.data_inicio ?? dataNova} className={campo} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Data final
                <input type="date" name="data_fim" defaultValue={editando?.data_fim ?? ""} className={campo} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Início
                <input type="time" name="hora_inicio" defaultValue={editando?.hora_inicio?.slice(0, 5) ?? ""} className={campo} />
              </label>
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Término
                <input type="time" name="hora_fim" defaultValue={editando?.hora_fim?.slice(0, 5) ?? ""} className={campo} />
              </label>
            </div>
            <p className="-mt-3 text-xs text-cinza-medio md:col-span-2">
              Deixe a data final em branco para um único dia, e os horários em branco para o dia todo.
            </p>
            <fieldset className="flex flex-col gap-2 md:col-span-2">
              <legend className="mb-1.5 text-sm font-medium">Turmas</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {turmas.map((x) => (
                  <label key={x.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="turma"
                      value={x.id}
                      defaultChecked={editando?.turmas.includes(x.id)}
                      className="h-4 w-4 accent-trinitas-profundo"
                    />
                    {x.nome}
                  </label>
                ))}
              </div>
              <span className="text-xs text-cinza-medio">Sem nenhuma turma marcada, o evento vale para a escola toda.</span>
            </fieldset>
            <label className="flex items-start gap-2.5 text-sm md:col-span-2">
              <input type="checkbox" name="suspende_aulas" defaultChecked={editando?.suspende_aulas} className="mt-0.5 h-4 w-4 accent-trinitas-profundo" />
              <span>
                <strong className="font-medium">Não há aulas</strong>
                <span className="block text-xs text-cinza-medio">
                  Nesses dias as aulas das turmas marcadas não entram no planejamento nem na revisão.
                </span>
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
              Observações (opcional)
              <textarea name="descricao" rows={3} maxLength={2000} defaultValue={editando?.descricao ?? ""} className={campo} />
            </label>
            <div className="md:col-span-2">
              <BotaoEnviar pendente="Salvando..." className={botaoPrimario}>
                {editando ? "Salvar alterações" : "Criar evento"}
              </BotaoEnviar>
            </div>
          </form>
          {editando && (
            <div className="border-t border-borda px-5 py-4">
              <ExcluirEvento id={editando.id} mes={mes} />
            </div>
          )}
        </section>
      )}

      <div className="flex flex-col gap-3">
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
          <Filtro href={link({ tipo: null })} ativo={!tipoSel}>
            Todos
          </Filtro>
          {TIPOS.map((x) => (
            <Filtro key={x} href={link({ tipo: x })} ativo={tipoSel === x}>
              {NOME_TIPO[x]}
            </Filtro>
          ))}
        </nav>
        <nav aria-label="Filtrar por turma" className="flex flex-wrap gap-1.5">
          <Filtro href={link({ turma: null })} ativo={!turmaSel}>
            Escola toda
          </Filtro>
          {turmas.map((x) => (
            <Filtro key={x.id} href={link({ turma: x.codigo })} ativo={turmaSel?.id === x.id}>
              {x.nome}
            </Filtro>
          ))}
        </nav>
      </div>

      <section className="overflow-x-auto border border-borda bg-white" aria-label={`Grade de ${nomeDoMes(mes)}`}>
        <div className="grid min-w-[760px] grid-cols-7">
          {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((x) => (
            <div key={x} className="border-b border-borda bg-cinza-claro px-2.5 py-2 text-xs font-semibold text-cinza-escuro">
              {x}
            </div>
          ))}
          {dias.map((dia) => {
            const fora = dia < primeiro || dia > ultimo;
            const evs = doDia(visiveis, dia);
            const pz = prazos.filter((p) => p.dia === dia);
            const semAula =
              !ehFimDeSemana(dia) && evs.some((e) => e.suspende_aulas && (turmaSel ? valeParaTurma(e, turmaSel.id) : e.turmas.length === 0));
            return (
              <div
                key={dia}
                className={
                  "flex min-h-28 flex-col gap-1 border-b border-r border-borda p-1.5 [&:nth-child(7n)]:border-r-0 " +
                  (fora ? "bg-cinza-claro/60 opacity-60 " : "") +
                  (ehFimDeSemana(dia) || semAula ? "bg-[repeating-linear-gradient(135deg,#fafafa_0,#fafafa_6px,#f3f4f6_6px,#f3f4f6_7px)] " : "")
                }
              >
                <div className="flex items-center justify-between px-1">
                  {agenda ? (
                    <Link
                      href={link({ novo: "1", data: dia, mes: mesDe(dia) })}
                      title="Criar evento neste dia"
                      className={"text-xs tabular-nums hover:text-trinitas-profundo " + (dia === hoje ? "rounded-full bg-trinitas-profundo px-1.5 font-semibold text-white" : "text-cinza-escuro")}
                    >
                      {Number(dia.slice(8))}
                    </Link>
                  ) : (
                    <span className={"text-xs tabular-nums " + (dia === hoje ? "rounded-full bg-trinitas-profundo px-1.5 font-semibold text-white" : "text-cinza-escuro")}>
                      {Number(dia.slice(8))}
                    </span>
                  )}
                  {semAula && <span className="text-[10px] font-medium uppercase tracking-wide text-cinza-medio">sem aula</span>}
                </div>
                {evs.slice(0, 4).map((e) => (
                  <Chip key={e.id} e={e} href={agenda ? link({ editar: String(e.id) }) : null} />
                ))}
                {evs.length > 4 && <span className="px-1 text-[11px] text-cinza-medio">+{evs.length - 4} na lista abaixo</span>}
                {pz.map((p) => (
                  <span key={p.titulo} className="rounded-sm border border-dashed border-trinitas px-1.5 py-0.5 text-[11px] leading-tight text-trinitas-texto">
                    {p.titulo.startsWith("Envio") ? "Prazo: envio dos planos" : "Prazo: revisão dos planos"}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-start gap-8">
        <section className="min-w-0 flex-[999_1_560px] border border-borda bg-white" aria-labelledby="lista-mes">
          <h2 id="lista-mes" className="border-b border-borda px-5 py-4 text-lg first-letter:uppercase">
            Eventos de {nomeDoMes(mes)}
          </h2>
          {doMes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-cinza-medio">Nenhum evento neste mês{tipoSel || turmaSel ? " com estes filtros" : ""}.</p>
          ) : (
            <ul>
              {doMes.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 border-b border-borda px-5 py-3.5 last:border-b-0">
                  <span className="w-40 shrink-0 text-[13px] tabular-nums text-cinza-medio">{quando(e)}</span>
                  <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                    <span className="text-[15px] font-semibold">{e.titulo}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-cinza-medio">
                      <span className={"rounded-sm border-l-2 px-1.5 py-0.5 " + COR_TIPO[e.tipo]}>{NOME_TIPO[e.tipo]}</span>
                      {e.turmas.length ? e.turmas.map((x) => nomeTurma.get(x)).join(", ") : "Escola toda"}
                      {e.suspende_aulas && <span className="font-medium text-cinza-escuro">· sem aula</span>}
                    </span>
                    {e.descricao && <p className="text-sm leading-relaxed text-cinza-escuro">{e.descricao}</p>}
                  </div>
                  {agenda && (
                    <Link href={link({ editar: String(e.id) })} className="rounded-sm border border-borda px-3 py-1.5 text-[13px] font-medium hover:bg-cinza-claro">
                      <RotuloLink>Editar</RotuloLink>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4 border border-borda bg-white p-5" aria-labelledby="assinar">
          <h2 id="assinar" className="text-lg">
            Ver no Google Agenda
          </h2>
          {linkAgenda ? (
            <>
              <p className="text-sm leading-relaxed text-cinza-escuro">
                Este é o seu link pessoal. Assinado uma vez, o calendário da escola aparece no seu Google Agenda e no celular.
                {perfil.papel === "professor" && " Você recebe os eventos da escola toda e os das suas turmas."}
              </p>
              <CopiarLink url={linkAgenda} />
              <details open={sp.assinar === "1"} className="text-sm">
                <summary className="cursor-pointer font-medium text-trinitas-profundo">Como assinar</summary>
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 leading-relaxed text-cinza-escuro">
                  <li>Copie o link acima.</li>
                  <li>
                    Abra o{" "}
                    <a href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" target="_blank" rel="noreferrer" className="font-medium text-trinitas-profundo underline">
                      Google Agenda no computador
                    </a>{" "}
                    com a sua conta da escola.
                  </li>
                  <li>Em “Outras agendas”, clique em “+” e depois em “Do URL”.</li>
                  <li>Cole o link e clique em “Adicionar agenda”.</li>
                </ol>
                <p className="mt-3 text-xs leading-relaxed text-cinza-medio">
                  O Google atualiza agendas assinadas por conta própria, normalmente algumas vezes por dia. Uma mudança feita aqui pode levar
                  algumas horas para aparecer lá; no Magister ela aparece na hora.
                </p>
              </details>
              <form action={renovarLink} className="border-t border-borda pt-3">
                <input type="hidden" name="mes" value={mes} />
                <p className="mb-2 text-xs leading-relaxed text-cinza-medio">
                  O link é pessoal. Se ele for compartilhado por engano, gere um novo; o anterior deixa de funcionar.
                </p>
                <BotaoEnviar pendente="Gerando..." className="rounded-sm border border-borda px-3 py-2 text-xs font-medium hover:bg-cinza-claro">
                  Gerar novo link
                </BotaoEnviar>
              </form>
            </>
          ) : (
            <p className="text-sm text-cinza-medio">Não foi possível carregar o seu link agora. Recarregue a página.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Chip({ e, href }: { e: Evento; href: string | null }) {
  const texto = (
    <>
      {e.hora_inicio && <span className="tabular-nums">{e.hora_inicio.slice(0, 5).replace(":00", "h").replace(":", "h")} </span>}
      {e.titulo}
    </>
  );
  const cls = "block truncate rounded-sm border-l-2 px-1.5 py-0.5 text-[11px] leading-tight " + COR_TIPO[e.tipo];
  return href ? (
    <Link href={href} title={`${e.titulo} · ${quando(e)}`} className={cls + " hover:brightness-95"}>
      {texto}
    </Link>
  ) : (
    <span title={`${e.titulo} · ${quando(e)}`} className={cls}>
      {texto}
    </span>
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
