import type { Metadata } from "next";
import EmBreve from "../em-breve";

export const metadata: Metadata = { title: "Planos de aula" };

export default function Page() {
  return (
    <EmBreve
      titulo="Planos de aula"
      texto="O editor dos planos de aula (sete momentos, quatro momentos, Artes e Música e registro de leitura) chega na próxima etapa da construção."
    />
  );
}
