import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, perfilAtual } from "@/lib/dados";
import { MENSAGEM_ERRO, tokenDrive } from "@/lib/drive";
import { RotuloLink } from "@/components/link-status";
import ConectarDrive from "./conectar";
import { IconePasta, type Pasta } from "./comum";

export const metadata: Metadata = { title: "Arquivos" };


export default async function ArquivosPage() {
  const perfil = (await perfilAtual())!;
  const gestor = ehGestor(perfil);
  const supabase = await criarClienteServidor();
  const [{ data }, token] = await Promise.all([
    supabase.from("pastas_drive").select("id, titulo, descricao, drive_id, papeis, turmas, disciplinas, ordem").order("ordem").order("titulo"),
    tokenDrive(supabase),
  ]);
  const pastas = (data ?? []) as Pasta[];

  return (
    <div className="flex max-w-5xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-cinza-medio">Google Drive da escola</span>
          <h1 className="text-3xl">Arquivos</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-cinza-escuro">
            As pastas que fazem parte do seu trabalho, conforme a sua função, turmas e matérias.
          </p>
        </div>
        {gestor && (
          <Link href="/arquivos/gerenciar" className="rounded-sm border border-borda bg-white px-3 py-2 text-sm hover:bg-cinza-claro">
            <RotuloLink>Gerenciar pastas</RotuloLink>
          </Link>
        )}
      </header>

      {!token.ok && (
        <section className="flex flex-col gap-3 border border-borda border-l-4 border-l-lima bg-white px-5 py-4">
          <p className="text-sm leading-relaxed text-cinza-escuro">
            {MENSAGEM_ERRO[token.erro]}
            {(token.erro === "desconectado" || token.erro === "reconectar") &&
              " O Magister só lê a lista de arquivos, com a sua conta da escola; ele não altera nem apaga nada no Drive."}
          </p>
          {(token.erro === "desconectado" || token.erro === "reconectar") && <ConectarDrive voltarPara="/arquivos" />}
        </section>
      )}

      {pastas.length === 0 ? (
        <p className="border border-borda bg-white px-6 py-10 text-center text-sm text-cinza-medio">
          {gestor ? "Nenhuma pasta vinculada ainda. Use “Gerenciar pastas” para ligar pastas do Drive." : "Nenhuma pasta liberada para o seu perfil por enquanto."}
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {pastas.map((p) => (
            <li key={p.id}>
              <Link href={`/arquivos/${p.id}`} className="flex h-full flex-col gap-2 border border-borda bg-white p-5 transition-colors hover:border-trinitas">
                <span className="flex items-center gap-2.5">
                  <IconePasta />
                  <span className="font-display text-lg font-bold leading-snug">{p.titulo}</span>
                </span>
                {p.descricao && <span className="text-sm leading-relaxed text-cinza-escuro">{p.descricao}</span>}
                <span className="mt-auto pt-2 text-sm font-medium text-trinitas-profundo">
                  <RotuloLink>Abrir pasta</RotuloLink>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
