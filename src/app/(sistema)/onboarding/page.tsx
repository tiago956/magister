import type { Metadata } from "next";
import ListaCursos from "../cursos/lista";

export const metadata: Metadata = { title: "Onboarding" };

export default function Page() {
  return <ListaCursos secao="onboarding" />;
}
