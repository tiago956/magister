"use client";

import { useLinkStatus } from "next/link";
import { Indicador } from "@/components/botao-enviar";

/**
 * Usar dentro de um <Link>. Enquanto a página carrega, o texto do link dá lugar
 * a um indicador girando, sem mudar o tamanho do botão.
 */
export function RotuloLink({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    <span className="relative inline-flex items-center justify-center" aria-busy={pending || undefined}>
      <span className={pending ? "opacity-0" : undefined}>{children}</span>
      {pending && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Indicador />
        </span>
      )}
    </span>
  );
}

/** Usar dentro de um <Link> de menu: indicador discreto ao lado do texto. */
export function IndicadorAoLado() {
  const { pending } = useLinkStatus();
  return (
    <span className={"text-trinitas-profundo transition-opacity " + (pending ? "opacity-100" : "opacity-0")} aria-hidden="true">
      <Indicador />
    </span>
  );
}
