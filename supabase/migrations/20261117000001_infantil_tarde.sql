-- Infantil passa a ter dois períodos: manhã (8h às 12h) e tarde (13h30 às 17h30).
-- Cada período é uma turma própria, com professora, grade e planos de aula próprios.

update public.turmas set nome = 'Infantil 4 · Manhã' where codigo = 'INF4';
update public.turmas set nome = 'Infantil 5 · Manhã' where codigo = 'INF5';

insert into public.turmas (codigo, nome, segmento, duracao_aula_min, ordem, ano_letivo)
select v.codigo, v.nome, t.segmento, t.duracao_aula_min, t.ordem, t.ano_letivo
from (values ('INF4T', 'Infantil 4 · Tarde', 'INF4'),
             ('INF5T', 'Infantil 5 · Tarde', 'INF5')) v(codigo, nome, origem)
join public.turmas t on t.codigo = v.origem;

-- Mesma grade da manhã, 5h30 depois.
insert into public.grade_horaria (turma_id, dia_semana, inicio, fim, disciplina_id, rotulo)
select n.id, g.dia_semana, g.inicio + interval '5 hours 30 minutes', g.fim + interval '5 hours 30 minutes', g.disciplina_id, g.rotulo
from public.grade_horaria g
join public.turmas o on o.id = g.turma_id
join public.turmas n on n.codigo = o.codigo || 'T'
where o.codigo in ('INF4', 'INF5');

-- Ordem: cada período da tarde logo depois da sua manhã.
update public.turmas set ordem = case codigo
  when 'INF4' then 1 when 'INF4T' then 2 when 'INF5' then 3 when 'INF5T' then 4
  when '1EFI' then 5 when '2EFI' then 6 when '3EFI' then 7 when '4EFI' then 8 when '5EFI' then 9 when '6EFII' then 10
  else ordem end;
