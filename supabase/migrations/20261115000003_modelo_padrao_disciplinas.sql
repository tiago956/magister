-- Separado da migração anterior: um valor novo de enum só pode ser
-- usado depois que a transação que o criou termina.
update public.disciplinas
set modelo_fundamental = 'padrao', modelo_infantil = 'padrao'
where nome not in ('Música', 'Educação Física', 'Leitura');
