-- Formação da equipe: Onboarding e Treinamentos em vídeo (YouTube não listado),
-- com medição do trecho assistido, pergunta de verificação e acompanhamento pela gestão.

create type public.secao_curso as enum ('onboarding', 'treinamento');
create type public.publico_curso as enum ('todos', 'papeis', 'pessoas');

create table public.cursos (
  id integer generated always as identity primary key,
  secao public.secao_curso not null,
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descricao text check (descricao is null or length(descricao) <= 4000),
  prazo date,
  publicado boolean not null default false,
  publico public.publico_curso not null default 'todos',
  papeis public.papel[] not null default '{}',
  ordem smallint not null default 0,
  criado_por uuid references public.perfis (id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint cursos_papeis check (publico <> 'papeis' or cardinality(papeis) > 0)
);

create table public.curso_pessoas (
  curso_id integer not null references public.cursos (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  primary key (curso_id, perfil_id)
);
create index curso_pessoas_perfil_idx on public.curso_pessoas (perfil_id);

create table public.curso_aulas (
  id integer generated always as identity primary key,
  curso_id integer not null references public.cursos (id) on delete cascade,
  ordem smallint not null default 0,
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descricao text check (descricao is null or length(descricao) <= 4000),
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  pergunta text check (pergunta is null or length(btrim(pergunta)) between 1 and 500),
  opcoes text[],
  constraint curso_aulas_pergunta check (
    (pergunta is null and opcoes is null)
    or (pergunta is not null and cardinality(opcoes) between 2 and 6)
  )
);
create index curso_aulas_curso_idx on public.curso_aulas (curso_id, ordem);

-- Resposta certa fica numa tabela só da gestão, para não chegar ao navegador de quem faz o curso.
create table public.aula_gabaritos (
  aula_id integer primary key references public.curso_aulas (id) on delete cascade,
  correta smallint not null check (correta >= 0)
);

-- Progresso: escrito apenas pelas funções abaixo.
create table public.aula_progresso (
  aula_id integer not null references public.curso_aulas (id) on delete cascade,
  perfil_id uuid not null references public.perfis (id) on delete cascade,
  trechos integer[] not null default '{}',      -- blocos de 10 s assistidos de fato
  total_trechos integer not null default 0,
  percentual smallint not null default 0 check (percentual between 0 and 100),
  posicao integer not null default 0,           -- onde parou, em segundos
  video_concluido_em timestamptz,
  tentativas smallint not null default 0,
  acertou boolean,
  concluida_em timestamptz,
  iniciado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (aula_id, perfil_id)
);
create index aula_progresso_perfil_idx on public.aula_progresso (perfil_id);

-- Visibilidade --------------------------------------------------

create or replace function privado.curso_e_para(p_curso integer, p_perfil uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cursos c join public.perfis p on p.id = p_perfil
    where c.id = p_curso and p.ativo and (
      c.publico = 'todos'
      or (c.publico = 'papeis' and p.papel = any (c.papeis))
      or (c.publico = 'pessoas' and exists (
            select 1 from public.curso_pessoas cp where cp.curso_id = c.id and cp.perfil_id = p.id))
    )
  );
$$;

create or replace function privado.ve_curso(p_curso integer)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select privado.eh_gestor())
      or exists (
        select 1 from public.cursos c
        where c.id = p_curso and c.publicado and privado.curso_e_para(c.id, (select auth.uid()))
      );
$$;

revoke execute on function privado.curso_e_para(integer, uuid) from public, anon;
revoke execute on function privado.ve_curso(integer) from public, anon;
grant execute on function privado.curso_e_para(integer, uuid) to authenticated;
grant execute on function privado.ve_curso(integer) to authenticated;

create or replace function public.carimbar_curso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  if tg_op = 'INSERT' then
    new.criado_por := (select auth.uid());
  else
    new.criado_por := old.criado_por;
    new.criado_em := old.criado_em;
  end if;
  return new;
end;
$$;
revoke execute on function public.carimbar_curso() from public, anon, authenticated;

create trigger carimbar_curso before insert or update on public.cursos
for each row execute function public.carimbar_curso();

-- RLS -------------------------------------------------------------

alter table public.cursos enable row level security;
alter table public.curso_pessoas enable row level security;
alter table public.curso_aulas enable row level security;
alter table public.aula_gabaritos enable row level security;
alter table public.aula_progresso enable row level security;

create policy "vê cursos" on public.cursos for select to authenticated using ((select privado.ve_curso(id)));
create policy "gestão insere cursos" on public.cursos for insert to authenticated with check ((select privado.eh_gestor()));
create policy "gestão altera cursos" on public.cursos for update to authenticated
  using ((select privado.eh_gestor())) with check ((select privado.eh_gestor()));
create policy "gestão remove cursos" on public.cursos for delete to authenticated using ((select privado.eh_gestor()));

create policy "vê pessoas do curso" on public.curso_pessoas for select to authenticated
  using ((select privado.eh_gestor()) or perfil_id = (select auth.uid()));
create policy "gestão insere pessoas do curso" on public.curso_pessoas for insert to authenticated with check ((select privado.eh_gestor()));
create policy "gestão remove pessoas do curso" on public.curso_pessoas for delete to authenticated using ((select privado.eh_gestor()));

create policy "vê aulas" on public.curso_aulas for select to authenticated using ((select privado.ve_curso(curso_id)));
create policy "gestão insere aulas" on public.curso_aulas for insert to authenticated with check ((select privado.eh_gestor()));
create policy "gestão altera aulas" on public.curso_aulas for update to authenticated
  using ((select privado.eh_gestor())) with check ((select privado.eh_gestor()));
create policy "gestão remove aulas" on public.curso_aulas for delete to authenticated using ((select privado.eh_gestor()));

create policy "gestão lê gabaritos" on public.aula_gabaritos for select to authenticated using ((select privado.eh_gestor()));
create policy "gestão insere gabaritos" on public.aula_gabaritos for insert to authenticated with check ((select privado.eh_gestor()));
create policy "gestão altera gabaritos" on public.aula_gabaritos for update to authenticated
  using ((select privado.eh_gestor())) with check ((select privado.eh_gestor()));
create policy "gestão remove gabaritos" on public.aula_gabaritos for delete to authenticated using ((select privado.eh_gestor()));

create policy "vê progresso" on public.aula_progresso for select to authenticated
  using (perfil_id = (select auth.uid()) or (select privado.eh_gestor()));

-- Funções de progresso ---------------------------------------------

create or replace function privado.fechar_aula(p_aula integer, p_perfil uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.aula_progresso pr
     set concluida_em = now()
    from public.curso_aulas a
   where pr.aula_id = p_aula and pr.perfil_id = p_perfil and a.id = p_aula
     and pr.concluida_em is null
     and pr.percentual >= 90
     and (a.pergunta is null or pr.acertou);
$$;
revoke execute on function privado.fechar_aula(integer, uuid) from public, anon, authenticated;

-- Registra blocos de 10 s assistidos. p_total = número de blocos do vídeo.
create or replace function public.registrar_progresso(p_aula integer, p_trechos integer[], p_total integer, p_posicao integer)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_curso integer;
  v_pct smallint;
begin
  if (select auth.uid()) is null then raise exception 'Sessão expirada.'; end if;
  select curso_id into v_curso from public.curso_aulas where id = p_aula;
  if v_curso is null or not exists (
       select 1 from public.cursos where id = v_curso and publicado and privado.curso_e_para(id, (select auth.uid())))
  then raise exception 'Aula não disponível para você.'; end if;
  if p_total is null or p_total < 1 or p_total > 2000 then raise exception 'Duração inválida.'; end if;

  insert into public.aula_progresso (aula_id, perfil_id, total_trechos)
  values (p_aula, (select auth.uid()), p_total)
  on conflict (aula_id, perfil_id) do nothing;

  update public.aula_progresso
     set trechos = (select coalesce(array_agg(distinct t order by t), '{}')
                      from unnest(trechos || coalesce(p_trechos, '{}')) t
                     where t >= 0 and t < p_total),
         total_trechos = p_total,
         posicao = greatest(0, coalesce(p_posicao, posicao)),
         atualizado_em = now()
   where aula_id = p_aula and perfil_id = (select auth.uid());

  update public.aula_progresso
     set percentual = least(100, round(100.0 * cardinality(trechos) / total_trechos)),
         video_concluido_em = case
           when video_concluido_em is null and 100.0 * cardinality(trechos) / total_trechos >= 90 then now()
           else video_concluido_em end
   where aula_id = p_aula and perfil_id = (select auth.uid())
  returning percentual into v_pct;

  perform privado.fechar_aula(p_aula, (select auth.uid()));
  return v_pct;
end;
$$;

-- Responde a pergunta da aula (só depois de assistir 90%). Devolve se acertou.
create or replace function public.responder_aula(p_aula integer, p_opcao smallint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_certa smallint;
  v_ok boolean;
begin
  if (select auth.uid()) is null then raise exception 'Sessão expirada.'; end if;
  if not exists (
       select 1 from public.aula_progresso
        where aula_id = p_aula and perfil_id = (select auth.uid()) and percentual >= 90)
  then raise exception 'Assista ao vídeo antes de responder.'; end if;
  select correta into v_certa from public.aula_gabaritos where aula_id = p_aula;
  if v_certa is null then raise exception 'Esta aula não tem pergunta.'; end if;

  v_ok := p_opcao = v_certa;
  update public.aula_progresso
     set tentativas = tentativas + 1,
         acertou = coalesce(acertou, false) or v_ok,
         atualizado_em = now()
   where aula_id = p_aula and perfil_id = (select auth.uid());
  perform privado.fechar_aula(p_aula, (select auth.uid()));
  return v_ok;
end;
$$;

revoke execute on function public.registrar_progresso(integer, integer[], integer, integer) from public, anon;
grant execute on function public.registrar_progresso(integer, integer[], integer, integer) to authenticated;
revoke execute on function public.responder_aula(integer, smallint) from public, anon;
grant execute on function public.responder_aula(integer, smallint) to authenticated;
