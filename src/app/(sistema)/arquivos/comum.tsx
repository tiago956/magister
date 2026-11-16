export type Pasta = {
  id: number;
  titulo: string;
  descricao: string | null;
  drive_id: string;
  papeis: string[];
  turmas: number[];
  disciplinas: number[];
  ordem: number;
};

export function IconePasta({ className = "h-5 w-5 text-trinitas" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11z" />
    </svg>
  );
}
