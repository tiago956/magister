"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";

const campo =
  "w-full rounded-sm border border-borda bg-cinza-claro px-3 py-3 text-base text-carvao placeholder:text-cinza-medio";
const botao =
  "w-full rounded-sm border-2 border-trinitas-profundo bg-trinitas-profundo px-5 py-3 text-sm font-medium text-white transition-colors hover:border-trinitas-hover hover:bg-trinitas-hover disabled:opacity-60";

export default function EntrarComCodigo({ dominio }: { dominio: string }) {
  const router = useRouter();
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviarCodigo(e: React.FormEvent) {
    e.preventDefault();
    const endereco = email.trim().toLowerCase();
    if (dominio && !endereco.endsWith("@" + dominio)) {
      setErro(`Use o seu e-mail da escola (@${dominio}).`);
      return;
    }
    setCarregando(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.signInWithOtp({
      email: endereco,
      options: { shouldCreateUser: true },
    });
    setCarregando(false);
    if (error) {
      const semEnvio = error.code === "email_address_not_authorized";
      setErro(
        semEnvio
          ? "O envio de e-mails para este endereço ainda não foi liberado. Avise a direção."
          : /rate|limit|seconds/i.test(error.message)
            ? "Muitos pedidos em pouco tempo. Aguarde um minuto e tente novamente."
            : "Não foi possível enviar o código. Confira o e-mail e tente novamente.",
      );
      return;
    }
    setEmail(endereco);
    setEtapa("codigo");
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: codigo.trim(),
      type: "email",
    });
    if (error) {
      setCarregando(false);
      setErro("Código incorreto ou vencido. Confira o e-mail ou peça um novo código.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  if (etapa === "email") {
    return (
      <form onSubmit={enviarCodigo} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
          E-mail da escola
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={dominio ? `seu.nome@${dominio}` : "Digite o seu e-mail"}
            className={campo}
          />
        </label>
        {erro && (
          <p role="alert" className="text-sm text-alerta-texto">
            {erro}
          </p>
        )}
        <button type="submit" disabled={carregando} className={botao}>
          {carregando ? "Enviando o código..." : "Receber código por e-mail"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={confirmarCodigo} className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-cinza-escuro">
        Enviamos um código para <strong>{email}</strong>. Digite-o abaixo para entrar.
      </p>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-cinza-escuro">
        Código
        <input
          type="text"
          name="codigo"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6,10}"
          maxLength={10}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          placeholder="Digite o código recebido"
          className={campo + " tracking-[0.3em] tabular-nums"}
        />
      </label>
      {erro && (
        <p role="alert" className="text-sm text-alerta-texto">
          {erro}
        </p>
      )}
      <button type="submit" disabled={carregando} className={botao}>
        {carregando ? "Entrando..." : "Entrar"}
      </button>
      <button
        type="button"
        onClick={() => {
          setEtapa("email");
          setCodigo("");
          setErro(null);
        }}
        className="text-sm font-medium text-trinitas-profundo hover:text-trinitas-hover"
      >
        Usar outro e-mail ou pedir novo código
      </button>
    </form>
  );
}
