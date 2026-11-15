"use client";

import { useState } from "react";
import type { ModeloAula } from "@/lib/dados";
import type { Conteudo, Momento } from "@/lib/modelos";
import type { StatusPlano } from "@/lib/status";
import { comentar, registrarAula, revisarPlano, salvarPlano } from "../../actions";

type Comentario = { id: number; bloco: string | null; texto: string; quando: string; autor: string; daGestao: boolean };

const CORES = ["#1BA89A", "#0E7C72", "#B5C81A", "#374151", "#6B7280", "#0B6159", "#8A9A12"];

const campo =
  "w-full rounded-sm border border-borda bg-cinza-claro px-3 py-2.5 text-sm leading-relaxed text-carvao placeholder:text-cinza-medio disabled:bg-white disabled:text-carvao";
const botaoPrimario =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";
const botaoSecundario = "rounded-sm border border-borda bg-white px-5 py-2.5 text-sm font-medium hover:bg-cinza-claro";

export default function Editor(props: {
  gradeId: number;
  semana: string;
  caminho: string;
  modelo: ModeloAula;
  momentos: Momento[];
  duracao: number;
  conteudoInicial: Conteudo;
  topicoInicial: string;
  planoId: number | null;
  status: StatusPlano | null;
  realizacao: string | null;
  obsPosAula: string | null;
  editavel: boolean;
  responsavel: boolean;
  gestor: boolean;
  banco: { id: number; pergunta: string; resposta: string }[];
  comentarios: Comentario[];
}) {
  const { momentos, editavel, modelo } = props;
  const [conteudo, setConteudo] = useState<Conteudo>(props.conteudoInicial);
  const [topico, setTopico] = useState(props.topicoInicial);

  function alterar(momento: string, campoId: string, valor: string) {
    setConteudo((c) => ({ ...c, [momento]: { ...(c[momento] ?? {}), [campoId]: valor } }));
  }

  const total = momentos.reduce((s, m) => s + m.min, 0);
  const leitura = modelo === "leitura";
  const comentariosPorBloco = (nome: string) => props.comentarios.filter((c) => c.bloco === nome);
  const comentariosGerais = props.comentarios.filter((c) => !c.bloco || !momentos.some((m) => m.nome === c.bloco));

  return (
    <div className="flex flex-col gap-6">
      <form action={salvarPlano} className="flex flex-col gap-6">
        <input type="hidden" name="grade_id" value={props.gradeId} />
        <input type="hidden" name="semana" value={props.semana} />
        <input type="hidden" name="conteudo" value={JSON.stringify(conteudo)} />

        {!leitura && (
          <section className="flex flex-col gap-4 border border-borda bg-white p-5">
            <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
              Tópico do Plano Mestre
              <input
                name="topico"
                value={topico}
                onChange={(e) => setTopico(e.target.value)}
                disabled={!editavel}
                placeholder="Exemplo: Subtração sem reagrupamento"
                className={campo}
              />
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap justify-between gap-2 text-[13px]">
                <strong>Tempo da aula</strong>
                <span className="text-cinza-escuro">
                  {total} de {props.duracao} minutos
                  {props.duracao > total ? ` · ${props.duracao - total} de margem para transições` : ""}
                </span>
              </div>
              <div className="flex h-7 gap-0.5" aria-hidden="true">
                {momentos.map((m, i) => (
                  <div
                    key={m.id}
                    className="flex min-w-6 items-center justify-center rounded-[2px] text-xs font-semibold"
                    style={{
                      flex: `${m.min} 1 0`,
                      background: CORES[i % CORES.length],
                      color: CORES[i % CORES.length] === "#B5C81A" ? "#1A1A1A" : "#FFFFFF",
                    }}
                    title={`${m.nome}: ${m.min} min`}
                  >
                    {m.min}&apos;
                  </div>
                ))}
                {props.duracao > total && (
                  <div
                    className="flex min-w-6 items-center justify-center rounded-[2px] bg-[#F3F4F6] text-xs font-semibold text-cinza-escuro"
                    style={{ flex: `${props.duracao - total} 1 0` }}
                  >
                    {props.duracao - total}&apos;
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {momentos.map((m, i) => {
          const coms = comentariosPorBloco(m.nome);
          return (
            <article key={m.id} className="flex flex-wrap border border-borda bg-white">
              <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-baseline gap-3">
                  {!leitura && (
                    <span className="font-display text-sm font-bold text-trinitas-profundo">{String(i + 1).padStart(2, "0")}</span>
                  )}
                  <h2 className="text-lg">{m.nome}</h2>
                  {m.min > 0 && <span className="text-[13px] text-cinza-medio">{m.min} min</span>}
                </div>

                {m.catecismo && editavel && props.banco.length > 0 && (
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
                    Banco de catecismos desta disciplina e turma
                    <select
                      className={campo}
                      defaultValue=""
                      onChange={(e) => {
                        const item = props.banco.find((b) => String(b.id) === e.target.value);
                        if (item) {
                          alterar(m.id, "pergunta", item.pergunta);
                          alterar(m.id, "resposta", item.resposta);
                        }
                      }}
                    >
                      <option value="">Escolher uma pergunta já usada (ou escrever nova abaixo)</option>
                      {props.banco.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.pergunta}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {m.campos.map((c) => (
                  <label key={c.id} className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
                    {c.label}
                    {(c.linhas ?? 2) <= 1 ? (
                      <input
                        value={conteudo[m.id]?.[c.id] ?? ""}
                        onChange={(e) => alterar(m.id, c.id, e.target.value)}
                        disabled={!editavel}
                        placeholder={c.ph}
                        className={campo}
                      />
                    ) : (
                      <textarea
                        rows={c.linhas ?? 2}
                        value={conteudo[m.id]?.[c.id] ?? ""}
                        onChange={(e) => alterar(m.id, c.id, e.target.value)}
                        disabled={!editavel}
                        placeholder={c.ph}
                        className={campo + " resize-y"}
                      />
                    )}
                  </label>
                ))}

                {coms.map((c) => (
                  <Comentario key={c.id} c={c} />
                ))}
              </div>
              <aside className="flex min-w-0 flex-[1_1_220px] flex-col gap-2 border-t border-borda bg-cinza-claro p-5 sm:border-t-0 sm:border-l sm:p-6">
                <span className="text-xs font-semibold tracking-wide text-cinza-medio uppercase">Orientação</span>
                <p className="text-sm leading-relaxed text-cinza-escuro">{m.guia}</p>
              </aside>
            </article>
          );
        })}

        {editavel && (
          <div className="flex flex-wrap justify-end gap-3 border-t border-borda pt-6">
            {leitura ? (
              <button type="submit" name="acao" value="salvar" className={botaoPrimario}>
                Salvar registro
              </button>
            ) : (
              <>
                <button type="submit" name="acao" value="salvar" className={botaoSecundario}>
                  Salvar rascunho
                </button>
                <button type="submit" name="acao" value="enviar" className={botaoPrimario}>
                  {props.status === "enviado" ? "Salvar e manter em revisão" : "Enviar para revisão"}
                </button>
              </>
            )}
          </div>
        )}
      </form>

      {/* Conversa com a coordenação */}
      {props.planoId && !leitura && (
        <section className="flex flex-col gap-4 border border-borda bg-white p-5 sm:p-6">
          <h2 className="text-lg">Conversa sobre o plano</h2>
          {comentariosGerais.length === 0 && props.comentarios.length === 0 && (
            <p className="text-sm text-cinza-medio">Nenhum comentário ainda.</p>
          )}
          {comentariosGerais.map((c) => (
            <Comentario key={c.id} c={c} />
          ))}
          {props.comentarios.length > comentariosGerais.length && (
            <p className="text-[13px] text-cinza-medio">Os comentários sobre momentos específicos aparecem dentro de cada momento.</p>
          )}

          {props.gestor && props.status && props.status !== "realizado" ? (
            <form action={revisarPlano} className="flex flex-col gap-3 border-t border-borda pt-4">
              <input type="hidden" name="plano_id" value={props.planoId} />
              <input type="hidden" name="voltar" value={props.caminho} />
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
                Sobre qual parte
                <select name="bloco" className={campo} defaultValue="">
                  <option value="">O plano todo</option>
                  {momentos.map((m) => (
                    <option key={m.id} value={m.nome}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
                Comentário da revisão
                <textarea name="texto" rows={3} className={campo} placeholder="Obrigatório para pedir ajustes" />
              </label>
              <div className="flex flex-wrap justify-end gap-3">
                <button type="submit" name="decisao" value="ajustes" className={botaoSecundario}>
                  Pedir ajustes
                </button>
                <button type="submit" name="decisao" value="aprovado" className={botaoPrimario}>
                  Aprovar plano
                </button>
              </div>
            </form>
          ) : (
            props.responsavel && (
              <form action={comentar} className="flex flex-col gap-3 border-t border-borda pt-4">
                <input type="hidden" name="plano_id" value={props.planoId} />
                <input type="hidden" name="voltar" value={props.caminho} />
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
                  Responder à coordenação
                  <textarea name="texto" rows={2} className={campo} />
                </label>
                <button type="submit" className={botaoSecundario + " self-end"}>
                  Enviar comentário
                </button>
              </form>
            )
          )}
        </section>
      )}

      {/* Registro depois da aula */}
      {props.planoId && props.responsavel && props.status === "aprovado" && (
        <form action={registrarAula} className="flex flex-col gap-4 border border-borda bg-white p-5 sm:p-6">
          <input type="hidden" name="plano_id" value={props.planoId} />
          <input type="hidden" name="voltar" value={props.caminho} />
          <h2 className="text-lg">Depois da aula</h2>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-2 text-[13px] font-medium text-cinza-escuro">Como a aula transcorreu?</legend>
            {[
              ["planejada", "Dada como planejada"],
              ["parcial", "Dada parcialmente"],
              ["nao_dada", "Não foi dada"],
            ].map(([v, t]) => (
              <label key={v} className="flex items-center gap-2">
                <input type="radio" name="realizacao" value={v} required className="h-4 w-4 accent-trinitas-profundo" />
                {t}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
            Observação (opcional)
            <textarea name="obs" rows={2} className={campo} placeholder="Exemplo: 18 de 22 alunos acertaram a verificação" />
          </label>
          <button type="submit" className={botaoPrimario + " self-end"}>
            Registrar aula
          </button>
        </form>
      )}

      {props.status === "realizado" && (
        <section className="border border-borda bg-white p-5 text-sm sm:p-6">
          <h2 className="text-lg">Depois da aula</h2>
          <p className="mt-2 text-cinza-escuro">
            {props.realizacao === "planejada"
              ? "Dada como planejada."
              : props.realizacao === "parcial"
                ? "Dada parcialmente."
                : "Não foi dada."}
            {props.obsPosAula ? ` ${props.obsPosAula}` : ""}
          </p>
        </section>
      )}
    </div>
  );
}

function Comentario({ c }: { c: Comentario }) {
  return (
    <div
      className={
        "flex flex-col gap-1 rounded-sm border px-4 py-3 " +
        (c.daGestao ? "border-[#DCE5A0] bg-[#FAFBEF]" : "border-borda bg-cinza-claro")
      }
    >
      <span className={"text-xs font-semibold " + (c.daGestao ? "text-lima-texto" : "text-cinza-escuro")}>
        {c.autor} · {c.quando}
        {c.bloco ? ` · ${c.bloco}` : ""}
      </span>
      <p className="text-sm leading-relaxed whitespace-pre-line text-cinza-escuro">{c.texto}</p>
    </div>
  );
}
