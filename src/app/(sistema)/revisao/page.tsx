import type { Metadata } from "next";
import EmBreve from "../em-breve";

export const metadata: Metadata = { title: "Revisão" };

export default function Page() {
  return (
    <EmBreve
      titulo="Revisão de planos"
      texto="A revisão dos planos pela coordenação, com comentários e aprovação em lote, chega junto com o editor de planos de aula."
    />
  );
}
