# Magister

Sistema pedagógico da **Trinitas Escola Cristã Clássica** (unidade Jacareí): planos de aula, revisão pela coordenação, calendário pedagógico, atribuições de turmas e matérias e acesso aos materiais do Drive.

Endereço previsto: **magister.trinitasvillabranca.com.br**

## O que já está pronto (etapa 1: base)

- Login por código enviado ao e-mail da escola, sem senha. E-mails de fora do domínio `trinitasvillabranca.com.br` são recusados pelo banco de dados.
- Banco de dados com turmas, matérias, grade horária de 2027 e atribuições, com regras de acesso: toda a equipe lê, só coordenação e direção alteram.
- **Painel**: cada professor vê as suas aulas da semana, com o modelo de aula de cada uma.
- **Atribuições** (coordenação e direção): atribuir regente (uma turma, várias matérias) ou especialista (uma matéria, várias turmas), grade semanal por turma, quadro de cobertura e papéis de acesso da equipe.

Próximas etapas: editor de planos de aula, revisão, calendário sincronizado, Drive e avisos no Slack.

## Tecnologia

- [Next.js](https://nextjs.org) 16 (App Router) e TypeScript
- [Supabase](https://supabase.com): banco Postgres, login e regras de acesso (RLS)
- Tailwind CSS 4, na identidade do Manual de Identidade Visual da Trinitas

## Como colocar para funcionar

### 1. Banco de dados (Supabase)

No painel do Supabase, abra **SQL Editor** e execute, nesta ordem, o conteúdo dos arquivos:

1. `supabase/migrations/20261114000001_base.sql` (tabelas, regras de acesso e restrição de domínio)
2. `supabase/migrations/20261114000002_dados_iniciais.sql` (7 turmas, 12 matérias e a grade semanal)
3. `supabase/migrations/20261114000003_eh_gestor_fora_da_api.sql` (ajuste de segurança)

No projeto `magister` do Supabase (região São Paulo) isso já foi feito.

### 2. Login por código enviado ao e-mail

O professor digita o e-mail da escola, recebe um código e entra. Não há senha. Configuração no painel do Supabase:

**Modelo do e-mail** (Authentication → Email Templates). Nos modelos **Confirm sign up** e **Magic link**, use:

- Assunto: `{{ .Token }} é o seu código do Magister`
- Corpo:

```html
<h2>Seu código de acesso ao Magister</h2>
<p>Digite este código na tela de entrada:</p>
<p style="font-size:28px;letter-spacing:6px"><strong>{{ .Token }}</strong></p>
<p>Ou entre direto por este link: <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}">Entrar no Magister</a></p>
<p>O código vale por pouco tempo e só pode ser usado uma vez. Se você não pediu este código, ignore este e-mail.</p>
```

**Endereço do sistema** (Authentication → URL Configuration): em *Site URL*, coloque `https://magister.trinitasvillabranca.com.br`.

**Envio dos e-mails** (Authentication → SMTP Settings). O envio padrão do Supabase só entrega para os membros da organização no Supabase e tem limite baixo por hora: serve para testes. Para toda a equipe receber o código, configure um serviço de envio (por exemplo Resend ou Brevo, ambos com plano gratuito) com um remetente do domínio da escola.

O login com Google pode ser acrescentado depois, quando a conta da escola tiver acesso ao Google Cloud.

### 3. Primeiro acesso da direção

Depois do seu primeiro login, rode no SQL Editor (trocando o e-mail):

```sql
update public.perfis set papel = 'direcao' where email = 'seu-email@trinitasvillabranca.com.br';
```

A partir daí, os papéis da equipe (professor, coordenação, direção, secretaria) são alterados pela tela de Atribuições.

### 4. Rodar no computador (opcional)

```bash
cp .env.example .env.local   # preencha com a Project URL e a chave anon do Supabase
npm install
npm run dev                  # abre em http://localhost:3000
```

### 5. Publicar

A publicação prevista é na Vercel, apontando o subdomínio `magister.trinitasvillabranca.com.br` por DNS. As variáveis de ambiente são as mesmas do `.env.example`. **Nunca** coloque a chave `service_role` no código nem no GitHub.

## Organização do código

```
src/
  app/
    login/              página de entrada (e-mail e código)
    auth/confirm/       link do e-mail de acesso
    auth/callback/      retorno do Google (uso futuro)
    auth/sair/          encerrar sessão
    (sistema)/          área logada: painel, atribuições e próximos módulos
  lib/
    supabase/           clientes do Supabase e renovação da sessão
    dados.ts            tipos, nomes e funções comuns
  proxy.ts              protege as rotas e renova a sessão
supabase/migrations/    estrutura e dados iniciais do banco
```
