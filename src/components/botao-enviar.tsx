"use client";

import { useFormStatus } from "react-dom";

/**
 * Botão de envio de formulário que mostra que o sistema está trabalhando:
 * enquanto grava, o botão clicado exibe um indicador e o texto de espera,
 * e todos os botões do formulário ficam bloqueados (evita clique duplo).
 */
export default function BotaoEnviar({
  children,
  pendente = "Salvando...",
  className = "",
  name,
  value,
}: {
  children: React.ReactNode;
  pendente?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, data } = useFormStatus();
  // Com vários botões no mesmo formulário, só o clicado mostra o indicador.
  const esteBotao = pending && (!name || data?.get(name) === value);

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-busy={esteBotao || undefined}
      className={className + " inline-flex items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-80"}
    >
      {esteBotao && <Indicador />}
      {esteBotao ? pendente : children}
    </button>
  );
}

export function Indicador() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
