import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Retorno do Google: troca o código pela sessão e entra no sistema. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const erroOAuth = searchParams.get("error_description") ?? "";

  if (!code) {
    // O banco recusa contas fora do domínio da escola (ver migração base).
    const motivo = /database error|restrito/i.test(erroOAuth) ? "dominio" : "falha";
    return NextResponse.redirect(`${origin}/login?erro=${motivo}`);
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=falha`);
  }

  return NextResponse.redirect(`${origin}/`);
}
