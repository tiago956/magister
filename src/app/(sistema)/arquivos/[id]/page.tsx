import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { criarClienteServidor } from "@/lib/supabase/server";
import {
  caminhoAte,
  conteudoDaPasta,
  linkAbrir,
  linkDownload,
  MENSAGEM_ERRO,
  nomeDoTipo,
  PASTA,
  tamanho,
  tokenDrive,
} from "@/lib/drive";
import { RotuloLink } from "@/components/link-status";
import ConectarDrive from "../conectar";
import { IconePasta, type Pasta } from "../comum";

export const metadata: Metadata = { title: "Arquivos" };

const data = (iso?: string) =>
  iso ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" }).format(new Date(iso)) : "";

export default async function PastaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sub?: string }>;
}) {
  const { id } = await params;
  const { sub } = await searchParams;
  const supabase = await criarClienteServidor();
  const { data: p } = await supabase.from("pastas_drive").select("id, titulo, descricao, drive_id").eq("id", Number(id)).maybeSingle();
  const pasta = p as Pick<Pasta, "id" | "titulo" | "descricao" | "drive_id"> | null;
  if (!pasta) notFound();

  const voltar = `/arquivos/${pasta.id}${sub ? `?sub=${encodeURIComponent(sub)}` : ""}`;
  const token = await tokenDrive(supabase);

  let erro: string | null = null;
  let precisaConectar = false;
  let trilha: { id: string; name: string }[] = [];
  let itens: Awaited<ReturnType<typeof conteudoDaPasta>> | null = null;

  if (!token.ok) {
    erro = MENSAGEM_ERRO[token.erro];
    precisaConectar = token.erro === "desconectado" || token.erro === "reconectar";
  } else {
    const alvo = sub && /^[A-Za-z0-9_-]{10,100}$/.test(sub) ? sub : pasta.drive_id;
    const c = alvo === pasta.drive_id ? [] : await caminhoAte(token.valor, alvo, pasta.drive_id);
    if (c === null) erro = "Esta subpasta não faz parte da pasta liberada.";
    else {
      trilha = c.slice(1);
      itens = await conteudoDaPasta(token.valor, alvo);
      if (!itens.ok) {
        erro = MENSAGEM_ERRO[itens.erro];
        precisaConectar = itens.erro === "reconectar";
      }
    }
  }

  const lista = itens?.ok ? itens.valor : [];
  const pastas = lista.filter((x) => x.mimeType === PASTA);
  const arquivos = lista.filter((x) => x.mimeType !== PASTA);
  const linkSub = (driveId: string) => `/arquivos/${pasta.id}?sub=${encodeURIComponent(driveId)}`;

  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-borda pb-6">
        <nav aria-label="Caminho" className="flex flex-wrap items-center gap-1.5 text-[13px]">
          <Link href="/arquivos" className="text-trinitas-profundo hover:text-trinitas-hover">
            <RotuloLink>Arquivos</RotuloLink>
          </Link>
          <span className="text-cinza-medio">/</span>
          {trilha.length ? (
            <Link href={`/arquivos/${pasta.id}`} className="text-trinitas-profundo hover:text-trinitas-hover">
              <RotuloLink>{pasta.titulo}</RotuloLink>
            </Link>
          ) : (
            <span className="text-cinza-escuro">{pasta.titulo}</span>
          )}
          {trilha.map((t, i) => (
            <span key={t.id} className="flex items-center gap-1.5">
              <span className="text-cinza-medio">/</span>
              {i < trilha.length - 1 ? (
                <Link href={linkSub(t.id)} className="text-trinitas-profundo hover:text-trinitas-hover">
                  <RotuloLink>{t.name}</RotuloLink>
                </Link>
              ) : (
                <span className="text-cinza-escuro">{t.name}</span>
              )}
            </span>
          ))}
        </nav>
        <h1 className="text-3xl">{trilha.at(-1)?.name ?? pasta.titulo}</h1>
        {!trilha.length && pasta.descricao && <p className="text-sm text-cinza-escuro">{pasta.descricao}</p>}
      </header>

      {erro && (
        <section className="flex flex-col gap-3 border border-borda border-l-4 border-l-lima bg-white px-5 py-4">
          <p className="text-sm text-cinza-escuro">{erro}</p>
          {precisaConectar && <ConectarDrive voltarPara={voltar} />}
        </section>
      )}

      {itens?.ok && lista.length === 0 && <p className="border border-borda bg-white px-6 py-10 text-center text-sm text-cinza-medio">Pasta vazia.</p>}

      {pastas.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3" aria-label="Subpastas">
          {pastas.map((x) => (
            <li key={x.id}>
              <Link href={linkSub(x.id)} className="flex items-center gap-2.5 border border-borda bg-white px-4 py-3 text-sm font-medium hover:border-trinitas">
                <IconePasta />
                <RotuloLink>{x.name}</RotuloLink>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {arquivos.length > 0 && (
        <section className="border border-borda bg-white" aria-label="Arquivos">
          <ul>
            {arquivos.map((x) => {
              const baixar = linkDownload(x);
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-borda px-5 py-3 last:border-b-0">
                  <div className="flex min-w-[220px] flex-1 flex-col gap-0.5">
                    <Link href={`/arquivos/${pasta.id}/ver?f=${encodeURIComponent(x.id)}`} className="font-medium hover:text-trinitas-profundo">
                      <RotuloLink>{x.name}</RotuloLink>
                    </Link>
                    <span className="text-xs text-cinza-medio">
                      {nomeDoTipo(x.mimeType)}
                      {x.size ? ` · ${tamanho(x.size)}` : ""}
                      {x.modifiedTime ? ` · atualizado em ${data(x.modifiedTime)}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <a href={linkAbrir(x)} target="_blank" rel="noreferrer" className="rounded-sm border border-borda px-3 py-1.5 text-[13px] font-medium hover:bg-cinza-claro">
                      Abrir no Drive
                    </a>
                    {baixar && (
                      <a href={baixar} target="_blank" rel="noreferrer" className="rounded-sm border border-borda px-3 py-1.5 text-[13px] font-medium hover:bg-cinza-claro">
                        Baixar
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
