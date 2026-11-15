export type StatusPlano = "rascunho" | "enviado" | "ajustes" | "aprovado" | "realizado";

export const NOME_STATUS: Record<StatusPlano | "nao_iniciado" | "registrado", string> = {
  nao_iniciado: "Não iniciado",
  rascunho: "Rascunho",
  enviado: "Em revisão",
  ajustes: "Ajustes solicitados",
  aprovado: "Aprovado",
  realizado: "Realizado",
  registrado: "Registrado",
};

export const CLASSE_STATUS: Record<keyof typeof NOME_STATUS, string> = {
  nao_iniciado: "border border-borda bg-white text-cinza-medio",
  rascunho: "border border-[#D1D5DB] bg-white text-cinza-escuro",
  enviado: "bg-[#EEF0F3] text-cinza-escuro",
  ajustes: "bg-lima-suave text-lima-texto",
  aprovado: "bg-trinitas-suave text-trinitas-texto",
  realizado: "bg-trinitas-suave text-trinitas-texto",
  registrado: "bg-trinitas-suave text-trinitas-texto",
};

export function Selo({ status }: { status: keyof typeof NOME_STATUS }) {
  return (
    <span className={"inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium " + CLASSE_STATUS[status]}>
      {NOME_STATUS[status]}
    </span>
  );
}

/** Situação de uma aula na semana, a partir do plano (se houver). */
export function situacao(
  plano: { status: StatusPlano; conteudo?: unknown } | undefined,
  modelo: string,
): keyof typeof NOME_STATUS {
  if (!plano) return "nao_iniciado";
  if (modelo === "leitura") return plano.conteudo && Object.keys(plano.conteudo as object).length ? "registrado" : "nao_iniciado";
  return plano.status;
}
