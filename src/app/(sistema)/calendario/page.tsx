import type { Metadata } from "next";
import EmBreve from "../em-breve";

export const metadata: Metadata = { title: "Calendário" };

export default function Page() {
  return (
    <EmBreve
      titulo="Calendário pedagógico"
      texto="O calendário da escola, sincronizado com o Google Calendar, entra numa das próximas etapas."
    />
  );
}
