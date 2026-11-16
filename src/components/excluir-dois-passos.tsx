"use client";

import { useState } from "react";
import BotaoEnviar from "@/components/botao-enviar";

/** Exclusão em dois passos (sem janela do navegador): primeiro clique pede confirmação. */
export default function ExcluirDoisPassos({
  acao,
  campos,
  rotulo,
  pergunta,
}: {
  acao: (form: FormData) => void | Promise<void>;
  campos: Record<string, string | number>;
  rotulo: string;
  pergunta: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="rounded-sm border border-alerta-texto/40 px-3.5 py-2 text-[13px] font-medium text-alerta-texto hover:bg-alerta-suave"
      >
        {rotulo}
      </button>
    );
  }
  return (
    <form action={acao} className="flex flex-wrap items-center gap-2">
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="text-sm text-alerta-texto">{pergunta}</span>
      <BotaoEnviar pendente="Excluindo..." className="rounded-sm border-2 border-alerta-texto bg-alerta-texto px-3.5 py-2 text-[13px] font-medium text-white">
        Sim, excluir
      </BotaoEnviar>
      <button type="button" onClick={() => setConfirmando(false)} className="rounded-sm border border-borda px-3.5 py-2 text-[13px] hover:bg-cinza-claro">
        Cancelar
      </button>
    </form>
  );
}
