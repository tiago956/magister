"use client";

import { useState } from "react";
import BotaoEnviar from "@/components/botao-enviar";

type Opcao = { id: number; nome: string };
type TurmaDaMateria = { id: number; nome: string; professor: string | null };

/** Atribui uma matéria a um especialista nas turmas escolhidas (dois especialistas podem dividir a mesma matéria). */
export default function FormEspecialista({
  acao,
  pessoas,
  materias,
  turmasPorMateria,
  campo,
  botao,
}: {
  acao: (form: FormData) => void | Promise<void>;
  pessoas: { id: string; nome: string }[];
  materias: Opcao[];
  turmasPorMateria: Record<number, TurmaDaMateria[]>;
  campo: string;
  botao: string;
}) {
  const [materia, setMateria] = useState<number | null>(null);
  const turmas = materia ? (turmasPorMateria[materia] ?? []) : [];
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());

  function escolherMateria(id: number) {
    setMateria(id);
    // Começa marcando só as turmas ainda sem professor, para não tirar a turma de outro especialista sem querer.
    setMarcadas(new Set((turmasPorMateria[id] ?? []).filter((t) => !t.professor).map((t) => t.id)));
  }
  function alternar(id: number) {
    setMarcadas((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <form action={acao} className="flex flex-col gap-4 border border-borda bg-white p-6">
      <div>
        <h2 className="text-lg">Atribuir especialista</h2>
        <p className="mt-1 text-sm text-cinza-medio">Uma matéria, nas turmas que você marcar. Dois especialistas podem dividir a mesma matéria.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
        Professor(a)
        <select name="professor_id" required className={campo} defaultValue="">
          <option value="" disabled>Escolha</option>
          {pessoas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
        Matéria
        <select
          name="disciplina_id"
          required
          className={campo}
          defaultValue=""
          onChange={(e) => escolherMateria(Number(e.target.value))}
        >
          <option value="" disabled>Escolha</option>
          {materias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
        </select>
      </label>

      {materia !== null && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-[13px] font-medium text-cinza-escuro">Turmas</legend>
          {turmas.length === 0 ? (
            <p className="text-sm text-cinza-medio">Nenhuma turma tem esta matéria na grade.</p>
          ) : (
            <>
              <div className="flex gap-3 text-xs">
                <button type="button" className="text-trinitas-texto underline" onClick={() => setMarcadas(new Set(turmas.map((t) => t.id)))}>
                  Marcar todas
                </button>
                <button type="button" className="text-trinitas-texto underline" onClick={() => setMarcadas(new Set())}>
                  Desmarcar todas
                </button>
              </div>
              {turmas.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="turma_id"
                    value={t.id}
                    checked={marcadas.has(t.id)}
                    onChange={() => alternar(t.id)}
                    className="h-4 w-4 accent-trinitas-profundo"
                  />
                  <span>{t.nome}</span>
                  <span className="text-xs text-cinza-medio">
                    {t.professor ? `hoje: ${t.professor}${marcadas.has(t.id) ? " (será substituído)" : ""}` : "sem professor"}
                  </span>
                </label>
              ))}
            </>
          )}
        </fieldset>
      )}

      <BotaoEnviar className={botao + " self-start"}>Atribuir especialista</BotaoEnviar>
    </form>
  );
}
