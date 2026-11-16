import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import { caminhoAte, linkAbrir, linkDownload, linkPreview, MENSAGEM_ERRO, nomeDoTipo, PASTA, tokenDrive } from "@/lib/drive";
import { RotuloLink } from "@/components/link-status";
import ConectarDrive from "../../conectar";

export const metadata: Metadata = { title: "Arquivo" };

export default async function VerArquivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  if (!f || !/^[A-Za-z0-9_-]{10,100}$/.test(f)) notFound();

  const supabase = await criarClienteServidor();
  const { data: pasta } = await supabase.from("pastas_drive").select("id, titulo, drive_id").eq("id", Number(id)).maybeSingle();
  if (!pasta) notFound();

  const token = await tokenDrive(supabase);
  if (!token.ok) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-3xl">Arquivo</h1>
        <p className="text-sm text-cinza-escuro">{MENSAGEM_ERRO[token.erro]}</p>
        {(token.erro === "desconectado" || token.erro === "reconectar") && <ConectarDrive voltarPara={`/arquivos/${pasta.id}/ver?f=${f}`} />}
      </div>
    );
  }

  const trilha = await caminhoAte(token.valor, f, pasta.drive_id as string);
  const arquivo = trilha?.at(-1);
  if (!trilha || !arquivo || arquivo.mimeType === PASTA) {
    return (
      <div className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-3xl">Arquivo</h1>
        <p className="text-sm text-cinza-escuro">Este arquivo não faz parte das pastas liberadas para você, ou não está compartilhado com você no Drive.</p>
      </div>
    );
  }
  const pai = trilha.at(-2);
  const voltar = pai && pai.id !== pasta.drive_id ? `/arquivos/${pasta.id}?sub=${pai.id}` : `/arquivos/${pasta.id}`;
  const baixar = linkDownload(arquivo);

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href={voltar} className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
            <RotuloLink>Voltar a {pai && pai.id !== pasta.drive_id ? pai.name : (pasta.titulo as string)}</RotuloLink>
          </Link>
          <h1 className="text-2xl break-words">{arquivo.name}</h1>
          <span className="text-xs text-cinza-medio">{nomeDoTipo(arquivo.mimeType)}</span>
        </div>
        <div className="flex gap-2">
          <a href={linkAbrir(arquivo)} target="_blank" rel="noreferrer" className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-4 py-2 text-sm font-medium text-white hover:bg-trinitas-hover">
            Abrir no Drive
          </a>
          {baixar && (
            <a href={baixar} target="_blank" rel="noreferrer" className="rounded-sm border border-borda bg-white px-4 py-2 text-sm font-medium hover:bg-cinza-claro">
              Baixar
            </a>
          )}
        </div>
      </header>
      <iframe
        src={linkPreview(arquivo)}
        title={`Visualização de ${arquivo.name}`}
        className="h-[78vh] w-full border border-borda bg-white"
        allow="autoplay"
      />
      <p className="text-xs text-cinza-medio">
        Se a visualização não aparecer (alguns navegadores bloqueiam o Google dentro de outros sites), use “Abrir no Drive”.
      </p>
    </div>
  );
}
