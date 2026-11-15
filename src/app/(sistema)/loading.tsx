import { Indicador } from "@/components/botao-enviar";

/** Mostrado na hora em que o usuário troca de página, enquanto os dados carregam. */
export default function Carregando() {
  return (
    <div role="status" className="flex items-center gap-3 py-10 text-sm text-cinza-escuro">
      <span className="text-trinitas-profundo">
        <Indicador />
      </span>
      Carregando...
    </div>
  );
}
