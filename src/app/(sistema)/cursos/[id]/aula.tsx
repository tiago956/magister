"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RotuloLink } from "@/components/link-status";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { Indicador } from "@/components/botao-enviar";

/* Tipos mínimos da API do player do YouTube. */
type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: { onReady?: () => void; onStateChange?: (e: { data: number }) => void };
    },
  ) => YTPlayer;
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let carregando: Promise<YTNamespace> | null = null;
function carregarApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!carregando) {
    carregando = new Promise((ok) => {
      const anterior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        anterior?.();
        ok(window.YT!);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
  }
  return carregando;
}

const BLOCO = 10; // segundos

type Props = {
  aulaId: number;
  youtubeId: string;
  participa: boolean;
  inicial: { trechos: number[]; percentual: number; posicao: number; acertou: boolean | null; tentativas: number; concluida: boolean };
  pergunta: string | null;
  opcoes: string[] | null;
  proxima: string | null;
};

export default function AulaInterativa({ aulaId, youtubeId, participa, inicial, pergunta, opcoes, proxima }: Props) {
  const router = useRouter();
  const alvo = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(inicial.percentual);
  const [concluida, setConcluida] = useState(inicial.concluida);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let cancelado = false;
    const vistos = new Set<number>(inicial.trechos);
    const pendentes = new Set<number>();
    const segundos = new Map<number, number>();
    let anterior: number | null = null;
    let ultimoEnvio = Date.now();
    const supabase = criarClienteNavegador();

    async function enviar() {
      if (!participa || !player) return;
      const dur = player.getDuration();
      if (!dur) return;
      const total = Math.max(1, Math.ceil(dur / BLOCO));
      const lote = [...pendentes];
      pendentes.clear();
      ultimoEnvio = Date.now();
      const { data, error } = await supabase.rpc("registrar_progresso", {
        p_aula: aulaId,
        p_trechos: lote,
        p_total: total,
        p_posicao: Math.floor(player.getCurrentTime()),
      });
      if (error) {
        lote.forEach((b) => pendentes.add(b));
        setErro("Não foi possível salvar o progresso. Verifique a internet; o vídeo continua.");
        return;
      }
      setErro(null);
      if (typeof data === "number") {
        setPct((v) => {
          if (v < 90 && data >= 90) router.refresh();
          return Math.max(v, data);
        });
      }
    }

    function tique() {
      if (!player || !window.YT) return;
      const tocando = player.getPlayerState() === window.YT.PlayerState.PLAYING;
      const t = player.getCurrentTime();
      if (tocando && anterior !== null) {
        const d = t - anterior;
        // Só conta avanço natural (até 2x de velocidade); pulos não contam.
        if (d > 0 && d <= 2.5) {
          const dur = player.getDuration();
          const b = Math.floor(t / BLOCO);
          const tamanho = Math.min(BLOCO, Math.max(1, dur - b * BLOCO));
          const n = (segundos.get(b) ?? 0) + d;
          segundos.set(b, n);
          if (!vistos.has(b) && n >= Math.min(7, tamanho * 0.7)) {
            vistos.add(b);
            pendentes.add(b);
            setPct((v) => Math.max(v, Math.min(100, Math.round((100 * vistos.size) / Math.ceil(dur / BLOCO)))));
          }
        }
      }
      anterior = tocando ? t : null;
      if (pendentes.size && Date.now() - ultimoEnvio > 15000) void enviar();
    }

    carregarApi().then((YT) => {
      if (cancelado || !alvo.current) return;
      player = new YT.Player(alvo.current, {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, start: inicial.percentual >= 99 ? 0 : inicial.posicao },
        events: {
          onReady: () => {
            timer = setInterval(tique, 1000);
          },
          onStateChange: (e) => {
            if (e.data === YT.PlayerState.PAUSED || e.data === YT.PlayerState.ENDED) {
              tique();
              void enviar();
            }
          },
        },
      });
    });

    const aoSair = () => {
      if (document.visibilityState === "hidden") void enviar();
    };
    document.addEventListener("visibilitychange", aoSair);
    return () => {
      cancelado = true;
      document.removeEventListener("visibilitychange", aoSair);
      if (timer) clearInterval(timer);
      void enviar().finally(() => player?.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aulaId, youtubeId]);

  async function responder(form: FormData) {
    const opcao = form.get("opcao");
    if (opcao === null) {
      setErro("Escolha uma alternativa.");
      return;
    }
    setSalvando(true);
    setErro(null);
    const { data, error } = await criarClienteNavegador().rpc("responder_aula", { p_aula: aulaId, p_opcao: Number(opcao) });
    setSalvando(false);
    if (error) {
      setErro(error.message);
      return;
    }
    if (data) {
      setConcluida(true);
      router.refresh();
    } else setErro("Resposta incorreta. Reveja o vídeo, se precisar, e tente de novo.");
  }

  const videoOk = pct >= 90;
  const feito = concluida || inicial.concluida || (participa && !pergunta && videoOk);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-video w-full overflow-hidden bg-carvao">
        <div ref={alvo} className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>

      {participa ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-xs text-cinza-medio">
            <span>Assistido: {pct}%</span>
            <span>{feito ? "Aula concluída" : videoOk ? (pergunta ? "Responda a pergunta abaixo" : "Aula concluída") : "Conclui ao assistir 90%"}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cinza-claro" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Quanto do vídeo foi assistido">
            <div className={"h-full transition-[width] " + (videoOk ? "bg-trinitas" : "bg-lima")} style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="border border-borda border-l-4 border-l-lima bg-white px-4 py-3 text-sm text-cinza-escuro">
          Pré-visualização: este curso não está destinado a você (ou ainda não foi publicado), então o progresso não é registrado.
        </p>
      )}

      {erro && (
        <p role="alert" className="rounded-sm bg-alerta-suave px-4 py-3 text-sm text-alerta-texto">
          {erro}
        </p>
      )}

      {pergunta && opcoes && participa && !feito && (
        <form action={responder} className="flex flex-col gap-3 border border-borda bg-white p-5">
          <h3 className="font-sans text-sm font-semibold">Pergunta de verificação</h3>
          {!videoOk ? (
            <p className="text-sm text-cinza-medio">A pergunta aparece quando você tiver assistido a 90% do vídeo.</p>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed">{pergunta}</p>
              <fieldset className="flex flex-col gap-2" disabled={salvando}>
                <legend className="sr-only">Alternativas</legend>
                {opcoes.map((o, i) => (
                  <label key={i} className="flex cursor-pointer items-start gap-2.5 rounded-sm border border-borda px-3 py-2.5 text-sm hover:bg-cinza-claro has-[:checked]:border-trinitas has-[:checked]:bg-trinitas-suave">
                    <input type="radio" name="opcao" value={i} className="mt-0.5 h-4 w-4 accent-trinitas-profundo" />
                    {o}
                  </label>
                ))}
              </fieldset>
              <button
                type="submit"
                disabled={salvando}
                className="inline-flex items-center gap-2 self-start rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-2.5 text-sm font-medium text-white hover:bg-trinitas-hover disabled:cursor-wait disabled:opacity-80"
              >
                {salvando && <Indicador />}
                {salvando ? "Conferindo..." : "Responder"}
              </button>
            </>
          )}
        </form>
      )}

      {feito && (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-borda border-l-4 border-l-trinitas bg-white px-5 py-4">
          <span className="text-sm text-cinza-escuro">Aula concluída.</span>
          {proxima && (
            <Link href={proxima} className="rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-4 py-2 text-sm font-medium text-white hover:bg-trinitas-hover">
              <RotuloLink>Próxima aula</RotuloLink>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
