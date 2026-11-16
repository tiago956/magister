import { createClient } from "@supabase/supabase-js";
import { NOME_TIPO, type TipoEvento } from "@/lib/calendario";
import { somarDias } from "@/lib/semanas";

/**
 * Link de assinatura do calendário (formato iCalendar).
 * O Google Agenda, o Outlook e o Calendário da Apple leem este endereço
 * periodicamente. Não exige login: o token pessoal na URL identifica a pessoa.
 */

export const dynamic = "force-dynamic";

type Linha = {
  id: number;
  titulo: string;
  tipo: TipoEvento;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  suspende_aulas: boolean;
  turmas: string | null;
  atualizado_em: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapar(t: string) {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Quebra linhas com mais de 75 bytes, como pede a RFC 5545. */
function dobrar(linha: string) {
  const enc = new TextEncoder();
  if (enc.encode(linha).length <= 75) return linha;
  const partes: string[] = [];
  let atual = "";
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74;
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual);
      atual = ch;
    } else atual += ch;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const data = (iso: string) => iso.replace(/-/g, "");
const horario = (t: string) => t.slice(0, 8).replace(/:/g, "").padEnd(6, "0");
const carimbo = (ts: string) => new Date(ts).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");

function vevento(e: Linha) {
  const desc = [
    e.descricao,
    e.turmas ? `Turmas: ${e.turmas}` : "Escola toda",
    e.suspende_aulas ? "Não há aulas." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const l = [
    "BEGIN:VEVENT",
    `UID:evento-${e.id}@magister.trinitas`,
    `DTSTAMP:${carimbo(e.atualizado_em)}`,
    `LAST-MODIFIED:${carimbo(e.atualizado_em)}`,
    `SUMMARY:${escapar(e.titulo)}`,
    `DESCRIPTION:${escapar(desc)}`,
    `CATEGORIES:${escapar(NOME_TIPO[e.tipo])}`,
  ];
  if (e.hora_inicio && e.hora_fim) {
    l.push(`DTSTART;TZID=America/Sao_Paulo:${data(e.data_inicio)}T${horario(e.hora_inicio)}`);
    l.push(`DTEND;TZID=America/Sao_Paulo:${data(e.data_inicio)}T${horario(e.hora_fim)}`);
    if (e.data_fim > e.data_inicio) l.push(`RRULE:FREQ=DAILY;UNTIL=${data(e.data_fim)}T235959`);
  } else {
    l.push(`DTSTART;VALUE=DATE:${data(e.data_inicio)}`);
    l.push(`DTEND;VALUE=DATE:${data(somarDias(e.data_fim, 1))}`);
    l.push("TRANSP:TRANSPARENT");
  }
  l.push("END:VEVENT");
  return l;
}

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: bruto } = await params;
  const token = bruto.replace(/\.ics$/i, "");
  if (!UUID.test(token)) return new Response("Link inválido.", { status: 404 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: linhas, error } = await supabase.rpc("agenda_do_token", { p_token: token });
  if (error) return new Response("Calendário indisponível no momento.", { status: 503 });
  if (!linhas?.length) return new Response("Link inválido ou substituído.", { status: 404 });

  const corpo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trinitas Escola Cristã Clássica//Magister//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Trinitas · Calendário escolar",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    "BEGIN:VTIMEZONE",
    "TZID:America/Sao_Paulo",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0300",
    "TZOFFSETTO:-0300",
    "TZNAME:-03",
    "END:STANDARD",
    "END:VTIMEZONE",
    ...(linhas as Linha[]).flatMap(vevento),
    "END:VCALENDAR",
  ]
    .map(dobrar)
    .join("\r\n");

  return new Response(corpo + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="trinitas.ics"',
      "Cache-Control": "private, max-age=300",
    },
  });
}
