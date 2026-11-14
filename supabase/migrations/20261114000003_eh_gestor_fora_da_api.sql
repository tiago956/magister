-- A função eh_gestor só é usada pelas regras de acesso (RLS);
-- fica num esquema que a API não expõe.
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;
alter function public.eh_gestor() set schema privado;
