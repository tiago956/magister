import { redirect } from "next/navigation";
import { ehGestor, nomeFuncoes, perfilAtual } from "@/lib/dados";
import Menu from "./menu";
import BotaoEnviar from "@/components/botao-enviar";

export default async function SistemaLayout({ children }: { children: React.ReactNode }) {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");

  return (
    <div className="flex min-h-screen flex-wrap">
      <aside className="flex w-full flex-col gap-6 border-b border-borda bg-white px-4 py-6 md:w-64 md:border-r md:border-b-0">
        <div className="flex flex-col gap-2 px-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-trinitas.svg" alt="Trinitas Escola Cristã Clássica" width={115} height={40} className="h-10 w-auto self-start" />
          <span className="font-display text-xl font-bold">Magister</span>
        </div>
        <Menu gestor={ehGestor(perfil)} />
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-borda px-2 pt-4">
          <div className="flex min-w-0 flex-col text-[13px]">
            <span className="truncate font-semibold">{perfil.nome}</span>
            <span className="text-cinza-medio">{nomeFuncoes(perfil.funcoes)}</span>
          </div>
          <form action="/auth/sair" method="post">
            <BotaoEnviar pendente="Saindo..." className="rounded-sm border border-borda px-3 py-2 text-xs font-medium hover:bg-cinza-claro">
              Sair
            </BotaoEnviar>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-[999_1_560px] px-5 py-8 sm:px-10 sm:py-10">{children}</main>
    </div>
  );
}
