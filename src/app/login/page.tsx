import type { Metadata } from "next";
import BotaoGoogle from "./botao-google";

export const metadata: Metadata = { title: "Entrar" };

const MENSAGENS: Record<string, string> = {
  dominio: "Use a sua conta Google da Trinitas para entrar.",
  link: "Este link já foi usado ou venceu. Peça um novo código.",
  falha: "Não foi possível concluir o login. Tente novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagem = erro ? MENSAGENS[erro] ?? MENSAGENS.falha : null;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md border border-borda bg-white p-8 sm:p-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-trinitas.svg" alt="Trinitas Escola Cristã Clássica" width={176} height={61} className="h-auto w-44" />
        <h1 className="mt-8 text-3xl">Magister</h1>
        <p className="mt-2 leading-relaxed text-cinza-escuro">
          Sistema pedagógico da Trinitas: planos de aula, calendário e materiais da escola.
        </p>

        {mensagem && (
          <p role="alert" className="mt-6 rounded-sm bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
            {mensagem}
          </p>
        )}

        <div className="mt-8">
          <BotaoGoogle dominio={process.env.NEXT_PUBLIC_ESCOLA_DOMINIO ?? ""} />
        </div>
        <p className="mt-4 text-xs text-cinza-medio">
          Acesso restrito às contas Google da escola.
        </p>
      </div>
    </main>
  );
}
