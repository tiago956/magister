import type { Metadata } from "next";
import Link from "next/link";
import { criarClienteServidor } from "@/lib/supabase/server";
import { ehGestor, NOME_PAPEL, perfilAtual, type Papel } from "@/lib/dados";
import BotaoEnviar from "@/components/botao-enviar";
import ExcluirDoisPassos from "@/components/excluir-dois-passos";
import { RotuloLink } from "@/components/link-status";
import { desvincularPasta, salvarPasta } from "../actions";
import type { Pasta } from "../comum";

export const metadata: Metadata = { title: "Gerenciar pastas" };

const campo = "w-full rounded-sm border border-borda bg-white px-3 py-2 text-sm font-normal focus:border-trinitas";
const botaoPrimario =
  "rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:border-trinitas-hover hover:bg-trinitas-hover";

type Opcao = { id: number; nome: string };

export default async function GerenciarPastasPage({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams;
  const perfil = await perfilAtual();
  if (!ehGestor(perfil)) return <p className="text-cinza-escuro">Esta área é da direção e da coordenação.</p>;

  const supabase = await criarClienteServidor();
  const [{ data: p }, { data: t }, { data: d }] = await Promise.all([
    supabase.from("pastas_drive").select("id, titulo, descricao, drive_id, papeis, turmas, disciplinas, ordem").order("ordem").order("titulo"),
    supabase.from("turmas").select("id, nome").order("ordem"),
    supabase.from("disciplinas").select("id, nome").order("nome"),
  ]);
  const pastas = (p ?? []) as Pasta[];
  const turmas = (t ?? []) as Opcao[];
  const disciplinas = (d ?? []) as Opcao[];
  const nomeT = new Map(turmas.map((x) => [x.id, x.nome]));
  const nomeD = new Map(disciplinas.map((x) => [x.id, x.nome]));

  const regra = (x: Pasta) => {
    const partes = [
      x.papeis.length ? x.papeis.map((r) => NOME_PAPEL[r as Papel]).join(", ") : null,
      x.turmas.length ? "turmas: " + x.turmas.map((i) => nomeT.get(i)).join(", ") : null,
      x.disciplinas.length ? "matérias: " + x.disciplinas.map((i) => nomeD.get(i)).join(", ") : null,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : "toda a equipe";
  };

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2 border-b border-borda pb-6">
        <Link href="/arquivos" className="text-[13px] text-trinitas-profundo hover:text-trinitas-hover">
          <RotuloLink>Voltar a Arquivos</RotuloLink>
        </Link>
        <h1 className="text-3xl">Gerenciar pastas</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-cinza-escuro">
          Ligue pastas do Google Drive ao Magister e escolha quem as vê. Tudo o que for colocado na pasta aparece sozinho. Lembre-se de
          compartilhar a pasta no Drive com a escola (ou com as pessoas), senão ela aparece no Magister mas não abre.
        </p>
      </header>

      {sp.ok && (
        <p role="status" className="rounded-sm border border-trinitas bg-trinitas-suave px-4 py-3 text-sm text-trinitas-texto">
          {sp.ok}
        </p>
      )}
      {sp.erro && (
        <p role="alert" className="rounded-sm border border-alerta-texto/30 bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {sp.erro}
        </p>
      )}

      {pastas.map((x) => (
        <details key={x.id} className="border border-borda bg-white">
          <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="flex-1 font-semibold">{x.titulo}</span>
            <span className="text-xs text-cinza-medio">{regra(x)}</span>
          </summary>
          <div className="border-t border-borda">
            <FormPasta pasta={x} turmas={turmas} disciplinas={disciplinas} />
            <div className="border-t border-borda px-5 py-3">
              <ExcluirDoisPassos
                acao={desvincularPasta}
                campos={{ id: x.id }}
                rotulo="Desvincular do Magister"
                pergunta="Tirar esta pasta do Magister? Ela continua intacta no Google Drive."
              />
            </div>
          </div>
        </details>
      ))}

      <section className="border border-dashed border-trinitas bg-white">
        <h2 className="border-b border-borda px-5 py-3.5 font-sans text-sm font-semibold">Vincular pasta</h2>
        <FormPasta turmas={turmas} disciplinas={disciplinas} />
      </section>
    </div>
  );
}

function FormPasta({ pasta, turmas, disciplinas }: { pasta?: Pasta; turmas: Opcao[]; disciplinas: Opcao[] }) {
  return (
    <form action={salvarPasta} className="grid gap-5 px-5 py-5 md:grid-cols-[1fr_120px]">
      {pasta && <input type="hidden" name="id" value={pasta.id} />}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome no Magister
        <input name="titulo" required maxLength={120} defaultValue={pasta?.titulo ?? ""} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Ordem
        <input type="number" name="ordem" min={0} max={999} defaultValue={pasta?.ordem ?? 0} className={campo} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
        Link da pasta no Google Drive
        <input
          name="link"
          required
          placeholder="https://drive.google.com/drive/folders/..."
          defaultValue={pasta ? `https://drive.google.com/drive/folders/${pasta.drive_id}` : ""}
          className={campo}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
        Descrição (opcional)
        <input name="descricao" maxLength={1000} defaultValue={pasta?.descricao ?? ""} className={campo} />
      </label>

      <fieldset className="flex flex-col gap-4 border-t border-borda pt-4 md:col-span-2">
        <legend className="sr-only">Quem vê</legend>
        <p className="text-sm font-medium">
          Quem vê <span className="font-normal text-cinza-medio">— deixe um grupo sem marcar para não restringir por ele; os grupos marcados se somam.</span>
        </p>
        <Grupo titulo="Função" nome="papel" opcoes={(Object.keys(NOME_PAPEL) as Papel[]).map((p) => ({ id: p, nome: NOME_PAPEL[p] }))} marcados={pasta?.papeis ?? []} />
        <Grupo titulo="Turmas que leciona" nome="turma" opcoes={turmas} marcados={pasta?.turmas ?? []} />
        <Grupo titulo="Matérias que leciona" nome="disciplina" opcoes={disciplinas} marcados={pasta?.disciplinas ?? []} />
        <p className="text-xs text-cinza-medio">Direção e coordenação veem todas as pastas.</p>
      </fieldset>

      <div className="md:col-span-2">
        <BotaoEnviar className={botaoPrimario}>{pasta ? "Salvar pasta" : "Vincular pasta"}</BotaoEnviar>
      </div>
    </form>
  );
}

function Grupo({
  titulo,
  nome,
  opcoes,
  marcados,
}: {
  titulo: string;
  nome: string;
  opcoes: { id: number | string; nome: string }[];
  marcados: (number | string)[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium text-cinza-escuro">{titulo}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {opcoes.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name={nome} value={o.id} defaultChecked={marcados.includes(o.id)} className="h-4 w-4 accent-trinitas-profundo" />
            {o.nome}
          </label>
        ))}
      </div>
    </div>
  );
}
