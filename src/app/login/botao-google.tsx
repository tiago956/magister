"use client";

import { useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";

export default function BotaoGoogle({ dominio }: { dominio: string }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function entrar() {
    setCarregando(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Sugere ao Google mostrar apenas contas do domínio da escola.
        queryParams: { hd: dominio, prompt: "select_account" },
      },
    });
    if (error) {
      setErro("Não foi possível abrir o login do Google. Tente novamente.");
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={entrar}
        disabled={carregando}
        className="flex w-full items-center justify-center gap-3 rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-3 text-sm font-medium text-white transition-colors hover:border-trinitas-hover hover:bg-trinitas-hover disabled:opacity-60"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
          <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
          <path fill="#fff" opacity=".85" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
          <path fill="#fff" opacity=".7" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14z" />
          <path fill="#fff" opacity=".55" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z" />
        </svg>
        {carregando ? "Abrindo o Google..." : "Entrar com Google"}
      </button>
      {erro && (
        <p role="alert" className="mt-3 text-sm text-alerta-texto">
          {erro}
        </p>
      )}
    </>
  );
}
