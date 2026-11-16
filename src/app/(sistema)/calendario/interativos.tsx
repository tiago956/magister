"use client";

import { useState } from "react";
import BotaoEnviar from "@/components/botao-enviar";
import { excluirEvento } from "./actions";

export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <input
        readOnly
        value={url}
        aria-label="Link de assinatura do calendário"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-[1_1_260px] rounded-sm border border-borda bg-cinza-claro px-3 py-2 font-mono text-xs text-cinza-escuro"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2500);
          } catch {
            setCopiado(false);
          }
        }}
        className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-4 py-2 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover"
      >
        {copiado ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}

/** Exclusão em dois passos, sem janela do navegador. */
export function ExcluirEvento({ id, mes }: { id: number; mes: string }) {
  const [confirmando, setConfirmando] = useState(false);
  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="rounded-sm border border-alerta-texto/40 px-4 py-2.5 text-sm font-medium text-alerta-texto hover:bg-alerta-suave"
      >
        Excluir evento
      </button>
    );
  }
  return (
    <form action={excluirEvento} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="mes" value={mes} />
      <span className="text-sm text-alerta-texto">Excluir este evento do calendário?</span>
      <BotaoEnviar pendente="Excluindo..." className="rounded-sm border-2 border-alerta-texto bg-alerta-texto px-4 py-2 text-sm font-medium text-white">
        Sim, excluir
      </BotaoEnviar>
      <button type="button" onClick={() => setConfirmando(false)} className="rounded-sm border border-borda px-4 py-2 text-sm hover:bg-cinza-claro">
        Cancelar
      </button>
    </form>
  );
}
