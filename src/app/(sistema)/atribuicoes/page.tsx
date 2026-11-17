import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { DIAS, ehGestor, FUNCOES, hora, NOME_PAPEL, perfilAtual, tem, type Perfil } from "@/lib/dados";
import { atribuirEspecialista, atribuirRegente, salvarFuncoes, salvarMatriz } from "./actions";
import BotaoEnviar from "@/components/botao-enviar";
import FormEspecialista from "./especialista";
import { RotuloLink } from "@/components/link-status";

export const metadata: Metadata = { title: "Atribuições" };

type Turma = { id: number; codigo: string; nome: string; ordem: number };
type Disciplina = { id: number; nome: string; do_regente: boolean; ordem: number };
type Atribuicao = { turma_id: number; disciplina_id: number; professor_id: string };
type Slot = { turma_id: number; dia_semana: number; inicio: string; fim: string; disciplina_id: number | null; rotulo: string | null };

const campo = "rounded-sm border border-borda bg-cinza-claro px-3 py-2.5 text-sm text-carvao";
const botao =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";

export default async function AtribuicoesPage({
  searchParams,
}: {
  searchParams: Promise<{ turma?: string; ok?: string }>;
}) {
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-3xl">Atribuições</h1>
        <p className="mt-4 text-cinza-escuro">Esta área é da coordenação e da direção.</p>
      </div>
    );
  }

  const { turma: turmaParam, ok } = await searchParams;
  const supabase = await criarClienteServidor();
  const [{ data: t }, { data: d }, { data: p }, { data: a }, { data: g }] = await Promise.all([
    supabase.from("turmas").select("id, codigo, nome, ordem").order("ordem"),
    supabase.from("disciplinas").select("id, nome, do_regente, ordem").order("ordem"),
    supabase.from("perfis").select("id, nome, email, papel, funcoes, perfil_docente, ativo").eq("ativo", true).order("nome"),
    supabase.from("atribuicoes").select("turma_id, disciplina_id, professor_id"),
    supabase.from("grade_horaria").select("turma_id, dia_semana, inicio, fim, disciplina_id, rotulo").order("inicio"),
  ]);
  const turmas = (t ?? []) as Turma[];
  const disciplinas = (d ?? []) as Disciplina[];
  const pessoas = (p ?? []) as Perfil[];
  const atribuicoes = (a ?? []) as Atribuicao[];
  const grade = (g ?? []) as Slot[];

  const nomeDe = new Map(pessoas.map((x) => [x.id, x.nome]));
  const dono = new Map(atribuicoes.map((x) => [`${x.turma_id}:${x.disciplina_id}`, x.professor_id]));
  const nasTurmas = new Map<number, Set<number>>();
  for (const s of grade) {
    if (s.disciplina_id == null) continue;
    if (!nasTurmas.has(s.turma_id)) nasTurmas.set(s.turma_id, new Set());
    nasTurmas.get(s.turma_id)!.add(s.disciplina_id);
  }
  const aulasPorProfessor = new Map<string, number>();
  for (const s of grade) {
    if (s.disciplina_id == null) continue;
    const pid = dono.get(`${s.turma_id}:${s.disciplina_id}`);
    if (pid) aulasPorProfessor.set(pid, (aulasPorProfessor.get(pid) ?? 0) + 1);
  }
  // O que cada pessoa leciona, a partir das atribuições (uma pessoa pode ser regente e especialista ao mesmo tempo).
  const regenteEm = new Map<string, Set<number>>();
  const especialistaEm = new Map<string, Map<number, Set<number>>>(); // professor → matéria → turmas
  const discPorId = new Map(disciplinas.map((x) => [x.id, x]));
  for (const x of atribuicoes) {
    if (discPorId.get(x.disciplina_id)?.do_regente) {
      if (!regenteEm.has(x.professor_id)) regenteEm.set(x.professor_id, new Set());
      regenteEm.get(x.professor_id)!.add(x.turma_id);
    } else {
      if (!especialistaEm.has(x.professor_id)) especialistaEm.set(x.professor_id, new Map());
      const m = especialistaEm.get(x.professor_id)!;
      if (!m.has(x.disciplina_id)) m.set(x.disciplina_id, new Set());
      m.get(x.disciplina_id)!.add(x.turma_id);
    }
  }
  const nomeTurma = new Map(turmas.map((x) => [x.id, x]));
  const leciona = (id: string) => {
    const partes: string[] = [];
    const r = [...(regenteEm.get(id) ?? [])].map((i) => nomeTurma.get(i)).filter((x) => !!x).sort((a, b) => a!.ordem - b!.ordem);
    if (r.length) partes.push(`Regente: ${r.map((x) => x!.nome).join(", ")}`);
    const e = [...(especialistaEm.get(id) ?? new Map<number, Set<number>>())]
      .map(([di, ts]) => ({ d: discPorId.get(di), ts }))
      .filter((x) => !!x.d)
      .sort((a, b) => a.d!.ordem - b.d!.ordem);
    for (const { d, ts } of e) {
      const nomes = [...ts].map((i) => nomeTurma.get(i)).filter((x) => !!x).sort((a, b) => a!.ordem - b!.ordem).map((x) => x!.nome);
      partes.push(`${d!.nome}: ${nomes.join(", ")}`);
    }
    return partes;
  };
  const souDirecao = tem(perfil, "direcao");
  const turmasPorMateria: Record<number, { id: number; nome: string; professor: string | null }[]> = {};
  for (const di of disciplinas) {
    if (di.do_regente) continue;
    turmasPorMateria[di.id] = turmas
      .filter((tu) => nasTurmas.get(tu.id)?.has(di.id))
      .map((tu) => {
        const pid = dono.get(`${tu.id}:${di.id}`);
        return { id: tu.id, nome: tu.nome, professor: pid ? (nomeDe.get(pid) ?? null) : null };
      });
  }

  const lacunas = turmas.reduce(
    (n, tu) => n + [...(nasTurmas.get(tu.id) ?? [])].filter((di) => !dono.has(`${tu.id}:${di}`)).length,
    0,
  );

  const turmaVer = turmas.find((x) => x.codigo === turmaParam) ?? turmas[0];
  const gradeTurma = grade.filter((s) => s.turma_id === turmaVer?.id);
  const horarios = [...new Set(gradeTurma.map((s) => s.inicio))].sort();
  const nomeDisc = new Map(disciplinas.map((x) => [x.id, x.nome]));

  return (
    <div className="flex max-w-7xl flex-col gap-8">
      <header className="flex flex-col gap-1.5 border-b border-borda pb-6">
        <span className="text-[13px] text-cinza-medio">Ano letivo de 2027 · definido pela coordenação</span>
        <h1 className="text-3xl">Atribuições de turmas e matérias</h1>
      </header>

      {ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {ok}
        </p>
      )}

      {/* Atalhos pelos dois perfis */}
      <section className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
        <form action={atribuirRegente} className="flex flex-col gap-4 border border-borda bg-white p-6">
          <div>
            <h2 className="text-lg">Atribuir regente</h2>
            <p className="mt-1 text-sm text-cinza-medio">Uma turma, todas as matérias do professor da turma.</p>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
            Professor(a)
            <select name="professor_id" required className={campo} defaultValue="">
              <option value="" disabled>Escolha</option>
              {pessoas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
            Turma
            <select name="turma_id" required className={campo} defaultValue="">
              <option value="" disabled>Escolha</option>
              {turmas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
            </select>
          </label>
          <BotaoEnviar className={botao + " self-start"}>Atribuir regente</BotaoEnviar>
        </form>

        <FormEspecialista
          acao={atribuirEspecialista}
          pessoas={pessoas.map((x) => ({ id: x.id, nome: x.nome }))}
          materias={disciplinas.filter((x) => !x.do_regente).map((x) => ({ id: x.id, nome: x.nome }))}
          turmasPorMateria={turmasPorMateria}
          campo={campo}
          botao={botao}
        />
      </section>

      {/* Grade semanal da turma */}
      <section className="border border-borda bg-white">
        <div className="flex flex-col gap-3 border-b border-borda px-5 py-4">
          <h2 className="text-lg">Grade da semana · {turmaVer?.nome}</h2>
          <nav aria-label="Turma exibida" className="flex flex-wrap gap-1.5">
            {turmas.map((x) => (
              <Link
                key={x.id}
                href={`/atribuicoes?turma=${x.codigo}`}
                aria-current={x.id === turmaVer?.id ? "page" : undefined}
                className={
                  "rounded-full border px-3 py-1.5 text-xs font-medium " +
                  (x.id === turmaVer?.id ? "border-cinza-escuro bg-cinza-escuro text-white" : "border-borda text-cinza-escuro hover:bg-cinza-claro")
                }
              >
                <RotuloLink>{x.nome}</RotuloLink>
              </Link>
            ))}
          </nav>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-[13px]">
            <thead>
              <tr className="bg-cinza-claro text-left">
                <th scope="col" className="w-28 border-b border-borda px-3 py-2.5 text-xs font-semibold">Horário</th>
                {DIAS.map((dia) => (
                  <th key={dia} scope="col" className="border-b border-l border-borda px-2 py-2.5 text-xs font-semibold">{dia}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {horarios.map((h) => (
                <tr key={h}>
                  <th scope="row" className="border-b border-borda px-3 py-2 text-left text-xs font-medium text-cinza-medio tabular-nums">
                    {hora(h)}
                  </th>
                  {DIAS.map((_, i) => {
                    const s = gradeTurma.find((x) => x.inicio === h && x.dia_semana === i + 1);
                    if (!s) return <td key={i} className="border-b border-l border-borda" />;
                    if (s.disciplina_id == null)
                      return <td key={i} className="border-b border-l border-borda bg-[#F3F4F6] px-2 py-2 align-top text-cinza-medio">{s.rotulo}</td>;
                    const pid = dono.get(`${s.turma_id}:${s.disciplina_id}`);
                    return (
                      <td key={i} className={"border-b border-l border-borda px-2 py-2 align-top " + (pid ? "bg-white" : "bg-alerta-suave text-alerta-texto")}>
                        <span className="block font-semibold">{nomeDisc.get(s.disciplina_id)}</span>
                        <span className={"mt-0.5 block text-[11px] " + (pid ? "text-cinza-medio" : "")}>
                          {pid ? nomeDe.get(pid) : "Sem professor"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Matriz completa */}
      <form action={salvarMatriz} className="border border-borda bg-white">
        <input type="hidden" name="turma_ver" value={turmaVer?.codigo ?? ""} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda px-5 py-4">
          <div>
            <h2 className="text-lg">Cobertura da grade</h2>
            <p className={"mt-1 text-sm " + (lacunas ? "text-alerta-texto" : "text-trinitas-texto")}>
              {lacunas ? `${lacunas} matérias sem professor` : "Todas as matérias da grade têm professor"}
            </p>
          </div>
          <BotaoEnviar className={botao}>Salvar atribuições</BotaoEnviar>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-xs">
            <thead>
              <tr className="bg-cinza-claro text-left">
                <th scope="col" className="border-b border-borda px-3 py-2.5 font-semibold">Turma</th>
                {disciplinas.map((x) => (
                  <th key={x.id} scope="col" className="border-b border-l border-borda px-2 py-2.5 font-semibold">{x.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turmas.map((tu) => (
                <tr key={tu.id}>
                  <th scope="row" className="whitespace-nowrap border-b border-borda px-3 py-2 text-left font-semibold">{tu.nome}</th>
                  {disciplinas.map((di) => {
                    if (!nasTurmas.get(tu.id)?.has(di.id))
                      return <td key={di.id} className="border-b border-l border-borda px-2 py-2 text-center text-[#9CA3AF]">—</td>;
                    const atual = dono.get(`${tu.id}:${di.id}`) ?? "";
                    return (
                      <td key={di.id} className={"border-b border-l border-borda px-1.5 py-1.5 " + (atual ? "" : "bg-alerta-suave")}>
                        <select
                          name={`a:${tu.id}:${di.id}`}
                          defaultValue={atual}
                          aria-label={`${di.nome}, ${tu.nome}`}
                          className="w-full min-w-[110px] rounded-sm border border-borda bg-white px-1.5 py-1.5 text-xs"
                        >
                          <option value="">Sem professor</option>
                          {pessoas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>

      {/* Equipe */}
      <section className="border border-borda bg-white">
        <div className="border-b border-borda px-5 py-4">
          <h2 className="text-lg">Equipe</h2>
          <p className="mt-1 text-sm text-cinza-medio">
            Cada pessoa aparece aqui depois do primeiro login com a conta Google da escola. Uma pessoa pode acumular funções (por exemplo,
            Coordenação e Professor(a)) e lecionar várias matérias; o acesso é a soma das funções marcadas.
            {!souDirecao && " Só a direção concede ou retira a função Direção."}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="bg-cinza-claro text-left">
                <th scope="col" className="border-b border-borda px-5 py-2.5 text-[13px] font-semibold">Nome</th>
                <th scope="col" className="border-b border-borda px-3 py-2.5 text-[13px] font-semibold">Leciona</th>
                <th scope="col" className="border-b border-borda px-3 py-2.5 text-[13px] font-semibold">Aulas por semana</th>
                <th scope="col" className="border-b border-borda px-3 py-2.5 text-[13px] font-semibold">Funções</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((x) => (
                <tr key={x.id}>
                  <td className="border-b border-borda px-5 py-3">
                    <span className="block font-semibold">{x.nome}</span>
                    <span className="block text-xs text-cinza-medio">{x.email}</span>
                  </td>
                  <td className="border-b border-borda px-3 py-3 text-[13px] text-cinza-escuro">
                    {leciona(x.id).length ? leciona(x.id).map((l) => <span key={l} className="block">{l}</span>) : "—"}
                  </td>
                  <td className="border-b border-borda px-3 py-3 tabular-nums">{aulasPorProfessor.get(x.id) ?? 0}</td>
                  <td className="border-b border-borda px-3 py-3">
                    <form action={salvarFuncoes} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <input type="hidden" name="id" value={x.id} />
                      <input type="hidden" name="nome" value={x.nome} />
                      <fieldset className="flex flex-wrap gap-x-3 gap-y-1.5">
                        <legend className="sr-only">Funções de {x.nome}</legend>
                        {FUNCOES.map((k) => {
                          const marcada = x.funcoes.includes(k);
                          const travada = k === "direcao" && !souDirecao;
                          return (
                            <label key={k} className={"flex items-center gap-1.5 text-[13px] " + (travada ? "text-cinza-medio" : "")}>
                              <input
                                type="checkbox"
                                name="funcao"
                                value={k}
                                defaultChecked={marcada}
                                disabled={travada}
                                className="h-4 w-4 accent-trinitas-profundo"
                              />
                              {travada && marcada && <input type="hidden" name="funcao" value={k} />}
                              {NOME_PAPEL[k]}
                            </label>
                          );
                        })}
                      </fieldset>
                      <BotaoEnviar className="rounded-sm border border-borda px-3 py-1.5 text-xs font-medium hover:bg-cinza-claro">Salvar</BotaoEnviar>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
