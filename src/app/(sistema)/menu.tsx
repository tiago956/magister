"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; nome: string; emBreve?: boolean; soGestao?: boolean };

const ITENS: Item[] = [
  { href: "/", nome: "Painel" },
  { href: "/planos", nome: "Planos de aula" },
  { href: "/revisao", nome: "Revisão", soGestao: true },
  { href: "/calendario", nome: "Calendário", emBreve: true },
  { href: "/atribuicoes", nome: "Atribuições", soGestao: true },
];

export default function Menu({ gestor }: { gestor: boolean }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5 text-sm">
      {ITENS.filter((i) => gestor || !i.soGestao).map((i) => {
        const ativo = i.href === "/" ? caminho === "/" : caminho.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={ativo ? "page" : undefined}
            className={
              "flex items-center justify-between border-l-2 px-3 py-2.5 transition-colors " +
              (ativo
                ? "border-trinitas bg-cinza-claro font-semibold text-trinitas-profundo"
                : "border-transparent text-cinza-escuro hover:bg-cinza-claro hover:text-carvao")
            }
          >
            {i.nome}
            {i.emBreve && <span className="text-[11px] font-normal text-cinza-medio">em breve</span>}
          </Link>
        );
      })}
    </nav>
  );
}
