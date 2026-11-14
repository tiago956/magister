export default function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl">{titulo}</h1>
      <p className="mt-4 border-l-4 border-lima bg-white px-5 py-4 leading-relaxed text-cinza-escuro">{texto}</p>
    </div>
  );
}
