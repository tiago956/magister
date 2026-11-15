/**
 * Datas no formato AAAA-MM-DD, sempre no fuso de São Paulo.
 * A semana de um plano é identificada pela sua segunda-feira.
 */

const FUSO = "America/Sao_Paulo";

function paraData(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function paraIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function hojeIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

export function somarDias(iso: string, dias: number) {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return paraIso(d);
}

export function segundaDaSemana(iso: string) {
  const diaDaSemana = (paraData(iso).getUTCDay() + 6) % 7; // 0 = segunda
  return somarDias(iso, -diaDaSemana);
}

/** Semana que está sendo planejada agora: a próxima. */
export function semanaDePlanejamento() {
  return somarDias(segundaDaSemana(hojeIso()), 7);
}

export function ehSegunda(valor: string | undefined | null): valor is string {
  return !!valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && paraData(valor).getUTCDay() === 1;
}

export function dataCurta(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function rotuloSemana(segunda: string) {
  return `${dataCurta(segunda)} a ${dataCurta(somarDias(segunda, 4))}`;
}

/** Envio até a quarta-feira da semana anterior. */
export function prazoEnvio(segunda: string) {
  return somarDias(segunda, -5);
}

/** Revisão concluída até a sexta-feira da semana anterior. */
export function prazoRevisao(segunda: string) {
  return somarDias(segunda, -3);
}

export function dataDaAula(segunda: string, diaSemana: number) {
  return somarDias(segunda, diaSemana - 1);
}

export function prazoVencido(segunda: string) {
  return hojeIso() > prazoEnvio(segunda);
}
