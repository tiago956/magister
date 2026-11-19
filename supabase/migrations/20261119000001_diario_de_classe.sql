-- =============================================================
-- Magister · Diário de classe
-- Registro, depois da aula, do que foi dado de fato em sala.
-- Um registro por aula da grade, por semana (como o plano de aula).
-- =============================================================

create table public.diario_classe (
  id bigint generated always as identity primary key,
  grade_id integer not null references public.grade_horaria (id) on delete cascade,
  semana_inicio date not null check (extract(isodow from semana_inicio) = 1), -- sempre uma segunda-feira
  professor_id uuid references public.perfis (id),
  conteudo_dado text not null check (length(trim(conteudo_dado)) > 0),
  objetivo text not null check (length(trim(objetivo)) > 0),
  materiais text,      -- livro e página e/ou material usado, se for o caso
  observacoes text,
  registrado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references public.perfis (id),
  unique (grade_id, semana_inicio)
);

create index diario_classe_semana_idx on public.diario_classe (semana_inicio);
create index diario_classe_professor_idx on public.diario_classe (professor_id);
create index diario_classe_atualizado_por_idx on public.diario_classe (atualizado_por);

-- Só depois (ou no dia) da aula; a aula e a semana não mudam.
create or replace function public.regras_diario()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_dia smallint;
begin
  if tg_op = 'UPDATE' and (new.grade_id <> old.grade_id or new.semana_inicio <> old.semana_inicio) then
    raise exception 'A aula e a semana de um registro não podem ser trocadas.';
  end if;
  select dia_semana into v_dia from public.grade_horaria where id = new.grade_id;
  if new.semana_inicio + (v_dia - 1) > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'O diário só pode ser preenchido no dia da aula ou depois dela.';
  end if;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  if tg_op = 'UPDATE' then
    new.registrado_em := old.registrado_em;
    new.professor_id := old.professor_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.regras_diario() from public, anon, authenticated;

create trigger regras_diario
  before insert or update on public.diario_classe
  for each row execute function public.regras_diario();

-- Acesso: a mesma estrutura do plano de aula (o professor da aula e a gestão).
alter table public.diario_classe enable row level security;

create policy "responsável e gestão leem o diário" on public.diario_classe for select to authenticated
  using ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()));

create policy "responsável registra no diário" on public.diario_classe for insert to authenticated
  with check ((select privado.responsavel_por(grade_id)) and professor_id = (select auth.uid()));

create policy "responsável e gestão corrigem o diário" on public.diario_classe for update to authenticated
  using ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()))
  with check ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()));
