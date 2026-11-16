"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { Indicador } from "@/components/botao-enviar";

const ESCOPO = "https://www.googleapis.com/auth/drive.metadata.readonly";

/** Pede ao Google permissão para o Magister ler a lista de arquivos do Drive da pessoa. */
export default function ConectarDrive({ voltarPara, rotulo = "Conectar ao Google Drive" }: { voltarPara: string; rotulo?: string }) {
  const [abrindo, setAbrindo] = useState(false);
  const [erro, setErro] = useState(false);
  async function conectar() {
    setAbrindo(true);
    setErro(false);
    const { error } = await criarClienteNavegador().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(voltarPara)}`,
        scopes: ESCOPO,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
          hd: process.env.NEXT_PUBLIC_ESCOLA_DOMINIO ?? "trinitasvillabranca.com.br",
        },
      },
    });
    if (error) {
      setErro(true);
      setAbrindo(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={conectar}
        disabled={abrindo}
        className="inline-flex items-center gap-2 self-start rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:bg-trinitas-hover disabled:cursor-wait disabled:opacity-80"
      >
        {abrindo && <Indicador />}
        {abrindo ? "Abrindo o Google..." : rotulo}
      </button>
      {erro && <p className="text-sm text-alerta-texto">Não foi possível abrir o Google. Tente de novo.</p>}
    </div>
  );
}
