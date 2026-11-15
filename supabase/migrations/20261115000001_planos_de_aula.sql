-- =============================================================
-- Magister · Planos de aula, comentários da revisão e catecismos
-- =============================================================

create type public.status_plano as enum ('rascunho', 'enviado', 'ajustes', 'aprovado', 'realizado');

-- Um plano por aula da grade, por semana ------------------------

create table public.planos_aula (
  id bigint generated always as identity primary key,
  grade_id integer not null references public.grade_horaria (id) on delete cascade,
  semana_inicio date not null check (extract(isodow from semana_inicio) = 1), -- sempre uma segunda-feira
  professor_id uuid references public.perfis (id),
  topico text,
  conteudo jsonb not null default '{}'::jsonb,  -- { "<momento>": { "<campo>": "texto" } }
  status public.status_plano not null default 'rascunho',
  enviado_em timestamptz,
  revisado_por uuid references public.perfis (id),
  revisado_em timestamptz,
  realizacao text check (realizacao in ('planejada', 'parcial', 'nao_dada')),
  obs_pos_aula text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (grade_id, semana_inicio)
);

create index planos_aula_semana_idx on public.planos_aula (semana_inicio, status);
create index planos_aula_professor_idx on public.planos_aula (professor_id);
create index planos_aula_revisado_por_idx on public.planos_aula (revisado_por);

-- Comentários da revisão ----------------------------------------

create table public.plano_comentarios (
  id bigint generated always as identity primary key,
  plano_id bigint not null references public.planos_aula (id) on delete cascade,
  autor_id uuid not null references public.perfis (id),
  bloco text,            -- nome do momento comentado (opcional)
  texto text not null check (length(trim(texto)) > 0),
  criado_em timestamptz not null default now()
);

create index plano_comentarios_plano_idx on public.plano_comentarios (plano_id);
create index plano_comentarios_autor_idx on public.plano_comentarios (autor_id);

-- Banco de catecismos, formado a partir dos planos ---------------

create table public.catecismos (
  id bigint generated always as identity primary key,
  disciplina_id smallint not null references public.disciplinas (id) on delete cascade,
  turma_id smallint not null references public.turmas (id) on delete cascade,
  pergunta text not null check (length(trim(pergunta)) > 0),
  resposta text not null check (length(trim(resposta)) > 0),
  criado_por uuid references public.perfis (id),
  criado_em timestamptz not null default now(),
  unique (disciplina_id, turma_id, pergunta)
);

create index catecismos_turma_idx on public.catecismos (turma_id);
create index catecismos_criado_por_idx on public.catecismos (criado_por);

-- Quem responde por uma aula da grade ----------------------------

create or replace function privado.responsavel_por(p_grade_id integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.grade_horaria g
    join public.atribuicoes a on a.turma_id = g.turma_id and a.disciplina_id = g.disciplina_id
    where g.id = p_grade_id
      and a.professor_id = (select auth.uid())
  );
$$;

revoke execute on function privado.responsavel_por(integer) from public, anon;
grant execute on function privado.responsavel_por(integer) to authenticated;

-- Regras do fluxo: rascunho → enviado → (ajustes → enviado) → aprovado → realizado

create or replace function public.regras_plano()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  gestor boolean := coalesce(privado.eh_gestor(), false);
begin
  new.atualizado_em := now();

  if tg_op = 'INSERT' then
    if not gestor and new.status not in ('rascunho', 'enviado') then
      raise exception 'Um plano novo começa como rascunho ou enviado.';
    end if;
    if new.status = 'enviado' then
      new.enviado_em := now();
    end if;
    return new;
  end if;

  if new.grade_id <> old.grade_id or new.semana_inicio <> old.semana_inicio then
    raise exception 'A aula e a semana de um plano não podem ser trocadas.';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('aprovado', 'ajustes') then
      if not gestor then
        raise exception 'Apenas a coordenação e a direção aprovam ou pedem ajustes.';
      end if;
      new.revisado_por := auth.uid();
      new.revisado_em := now();
    elsif new.status = 'realizado' then
      if old.status <> 'aprovado' then
        raise exception 'Só um plano aprovado pode ser marcado como realizado.';
      end if;
    elsif new.status = 'enviado' then
      if old.status not in ('rascunho', 'ajustes') and not gestor then
        raise exception 'Este plano já foi revisado.';
      end if;
      new.enviado_em := now();
    elsif new.status = 'rascunho' and not gestor then
      raise exception 'Um plano enviado não volta a rascunho.';
    end if;
  end if;

  if not gestor
     and old.status in ('aprovado', 'realizado')
     and (new.conteudo is distinct from old.conteudo or new.topico is distinct from old.topico) then
    raise exception 'Um plano aprovado não pode ser alterado.';
  end if;

  return new;
end;
$$;

revoke execute on function public.regras_plano() from public, anon, authenticated;

create trigger regras_plano
  before insert or update on public.planos_aula
  for each row execute function public.regras_plano();

-- Regras de acesso (RLS) ---------------------------------------

alter table public.planos_aula enable row level security;
alter table public.plano_comentarios enable row level security;
alter table public.catecismos enable row level security;

-- Planos: o professor responsável pela aula e a gestão.
create policy "responsável e gestão leem planos" on public.planos_aula for select to authenticated
  using ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()));

create policy "responsável cria plano" on public.planos_aula for insert to authenticated
  with check ((select privado.responsavel_por(grade_id)) and professor_id = (select auth.uid()));

create policy "responsável e gestão alteram planos" on public.planos_aula for update to authenticated
  using ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()))
  with check ((select privado.responsavel_por(grade_id)) or (select privado.eh_gestor()));

-- Comentários: quem enxerga o plano enxerga e escreve comentários nele.
create policy "leem comentários do plano" on public.plano_comentarios for select to authenticated
  using (exists (select 1 from public.planos_aula p where p.id = plano_id));

create policy "comentam no plano" on public.plano_comentarios for insert to authenticated
  with check (
    autor_id = (select auth.uid())
    and exists (select 1 from public.planos_aula p where p.id = plano_id)
  );

-- Catecismos: toda a equipe lê e acrescenta; a gestão corrige e remove.
create policy "equipe lê catecismos" on public.catecismos for select to authenticated using (true);

create policy "equipe acrescenta catecismos" on public.catecismos for insert to authenticated
  with check (criado_por = (select auth.uid()));

create policy "gestão altera catecismos" on public.catecismos for update to authenticated
  using ((select privado.eh_gestor())) with check ((select privado.eh_gestor()));

create policy "gestão remove catecismos" on public.catecismos for delete to authenticated
  using ((select privado.eh_gestor()));
