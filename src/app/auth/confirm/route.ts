import { NextResponse, type NextRequest } from "next/server";
import { criarClienteServidor } from "@/lib/supabase/server";

/** Link do e-mail de acesso: confirma o código embutido no link e entra no sistema. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");

  if (!token_hash) {
    return NextResponse.redirect(`${origin}/login?erro=falha`);
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });
  if (error) {
    return NextResponse.redirect(`${origin}/login?erro=link`);
  }

  return NextResponse.redirect(`${origin}/`);
}
