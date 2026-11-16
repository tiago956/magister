import type { Metadata } from "next";
import ListaCursos from "../cursos/lista";

export const metadata: Metadata = { title: "Treinamentos" };

export default function Page() {
  return <ListaCursos secao="treinamento" />;
}
