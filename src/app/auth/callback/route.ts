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
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=falha`);
  }

  // Ao conectar o Google Drive, o Google devolve um token de renovação: guardamos para listar as pastas.
  const s = data.session;
  if (s?.provider_refresh_token) {
    await supabase.rpc("guardar_google_drive", {
      p_refresh: s.provider_refresh_token,
      p_access: s.provider_token ?? null,
      p_expira: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    });
  }

  const proximo = searchParams.get("next") ?? "/";
  const seguro = proximo.startsWith("/") && !proximo.startsWith("//") ? proximo : "/";
  return NextResponse.redirect(`${origin}${seguro}`);
}
