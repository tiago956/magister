import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Acesso ao Google Drive com a conta da própria pessoa (somente leitura da lista de arquivos).
 * O Drive continua decidindo quem pode abrir cada arquivo; o Magister decide quais pastas
 * aparecem para cada perfil.
 */

export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.metadata.readonly";
const CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ?? "14309479179-shbieb1809hbip96quh4aoii3ld9jivv.apps.googleusercontent.com";

export type ErroDrive = "desconectado" | "configuracao" | "reconectar" | "sem_acesso" | "falha";

export type ItemDrive = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
};

export const PASTA = "application/vnd.google-apps.folder";

type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: ErroDrive };

/** Token de acesso válido da pessoa logada (renova se preciso). */
export async function tokenDrive(supabase: SupabaseClient): Promise<Resultado<string>> {
  const { data } = await supabase.rpc("meu_google_drive");
  const linha = (data as { refresh_token: string; access_token: string | null; expira_em: string | null }[] | null)?.[0];
  if (!linha) return { ok: false, erro: "desconectado" };
  if (linha.access_token && linha.expira_em && new Date(linha.expira_em).getTime() - Date.now() > 60_000) {
    return { ok: true, valor: linha.access_token };
  }
  const segredo = process.env.GOOGLE_CLIENT_SECRET;
  if (!segredo) return { ok: false, erro: "configuracao" };

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: segredo,
      refresh_token: linha.refresh_token,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => ({}))) as { error?: string };
    if (corpo.error === "invalid_grant") {
      await supabase.rpc("desconectar_google_drive");
      return { ok: false, erro: "reconectar" };
    }
    return { ok: false, erro: r.status === 401 ? "configuracao" : "falha" };
  }
  const j = (await r.json()) as { access_token: string; expires_in: number };
  await supabase.rpc("guardar_google_drive", {
    p_refresh: null,
    p_access: j.access_token,
    p_expira: new Date(Date.now() + j.expires_in * 1000).toISOString(),
  });
  return { ok: true, valor: j.access_token };
}

async function api<T>(token: string, caminho: string, params: Record<string, string>): Promise<Resultado<T>> {
  const url = `https://www.googleapis.com/drive/v3/${caminho}?${new URLSearchParams({
    supportsAllDrives: "true",
    ...params,
  })}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (r.status === 404 || r.status === 403) return { ok: false, erro: "sem_acesso" };
  if (r.status === 401) return { ok: false, erro: "reconectar" };
  if (!r.ok) return { ok: false, erro: "falha" };
  return { ok: true, valor: (await r.json()) as T };
}

const CAMPOS = "id,name,mimeType,modifiedTime,size,webViewLink,parents";

export async function conteudoDaPasta(token: string, pastaId: string): Promise<Resultado<ItemDrive[]>> {
  const itens: ItemDrive[] = [];
  let pagina: string | undefined;
  for (let i = 0; i < 5; i++) {
    const r = await api<{ files: ItemDrive[]; nextPageToken?: string }>(token, "files", {
      q: `'${pastaId}' in parents and trashed = false`,
      fields: `nextPageToken,files(${CAMPOS})`,
      orderBy: "folder,name_natural",
      pageSize: "200",
      includeItemsFromAllDrives: "true",
      ...(pagina ? { pageToken: pagina } : {}),
    });
    if (!r.ok) return r;
    itens.push(...r.valor.files);
    pagina = r.valor.nextPageToken;
    if (!pagina) break;
  }
  return { ok: true, valor: itens };
}

export async function itemDrive(token: string, id: string): Promise<Resultado<ItemDrive>> {
  return api<ItemDrive>(token, `files/${encodeURIComponent(id)}`, { fields: CAMPOS });
}

/**
 * Caminho de `id` até a pasta vinculada `raiz` (inclusive), ou null se `id` não estiver dentro dela.
 * Impede abrir pelo Magister algo de fora das pastas liberadas ao perfil.
 */
export async function caminhoAte(token: string, id: string, raiz: string): Promise<ItemDrive[] | null> {
  const trilha: ItemDrive[] = [];
  let atual = id;
  for (let i = 0; i < 12; i++) {
    const r = await itemDrive(token, atual);
    if (!r.ok) return null;
    trilha.unshift(r.valor);
    if (atual === raiz) return trilha;
    const pai = r.valor.parents?.[0];
    if (!pai) return null;
    atual = pai;
  }
  return null;
}

export function idDoDrive(entrada: string): string | null {
  const t = entrada.trim();
  if (/^[A-Za-z0-9_-]{10,100}$/.test(t)) return t;
  const m = t.match(/\/folders\/([A-Za-z0-9_-]{10,100})/) ?? t.match(/[?&]id=([A-Za-z0-9_-]{10,100})/) ?? t.match(/\/d\/([A-Za-z0-9_-]{10,100})/);
  return m?.[1] ?? null;
}

const TIPOS: [RegExp, string][] = [
  [/folder$/, "Pasta"],
  [/document$/, "Documento Google"],
  [/spreadsheet$/, "Planilha Google"],
  [/presentation$/, "Apresentação Google"],
  [/form$/, "Formulário Google"],
  [/pdf$/, "PDF"],
  [/wordprocessingml|msword/, "Word"],
  [/spreadsheetml|ms-excel/, "Excel"],
  [/presentationml|ms-powerpoint/, "PowerPoint"],
  [/^image\//, "Imagem"],
  [/^video\//, "Vídeo"],
  [/^audio\//, "Áudio"],
];

export function nomeDoTipo(mime: string) {
  return TIPOS.find(([r]) => r.test(mime))?.[1] ?? "Arquivo";
}

/** Link para baixar (documentos do Google saem como PDF ou Excel). */
export function linkDownload(item: ItemDrive): string | null {
  const id = encodeURIComponent(item.id);
  if (item.mimeType === PASTA || item.mimeType.endsWith(".form") || item.mimeType.endsWith("shortcut")) return null;
  if (item.mimeType.endsWith(".document")) return `https://docs.google.com/document/d/${id}/export?format=pdf`;
  if (item.mimeType.endsWith(".spreadsheet")) return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  if (item.mimeType.endsWith(".presentation")) return `https://docs.google.com/presentation/d/${id}/export/pdf`;
  if (item.mimeType.startsWith("application/vnd.google-apps")) return null;
  return `https://drive.google.com/uc?export=download&id=${id}`;
}

export function linkAbrir(item: ItemDrive) {
  return item.webViewLink ?? `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/view`;
}

export function linkPreview(item: ItemDrive) {
  return `https://drive.google.com/file/d/${encodeURIComponent(item.id)}/preview`;
}

export function tamanho(bytes?: string) {
  const n = Number(bytes);
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export const MENSAGEM_ERRO: Record<ErroDrive, string> = {
  desconectado: "Conecte sua conta do Google Drive para ver os arquivos.",
  configuracao: "A ligação do Magister com o Google Drive ainda não foi configurada pela direção.",
  reconectar: "O acesso ao Google Drive expirou ou foi revogado. Conecte de novo.",
  sem_acesso: "Esta pasta não está compartilhada com você no Google Drive. Peça acesso à coordenação.",
  falha: "O Google Drive não respondeu agora. Tente de novo em instantes.",
};
