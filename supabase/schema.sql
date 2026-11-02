-- =====================================================================
-- Mercadim — banco de dados (Supabase)
-- Cole tudo no SQL Editor do projeto e clique em Run. Pode rodar de novo
-- sem problema: os comandos são idempotentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Notas (compras). Cada pessoa só vê e mexe nas próprias notas.
-- ---------------------------------------------------------------------
create table if not exists public.compras (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data          date not null,
  mercado       text not null,
  cidade        text not null default '',
  estado        text not null default '',
  chave         text,            -- chave de acesso da NFC-e (44 dígitos)
  cnpj          text,
  qr_url        text,            -- link da consulta na Sefaz, quando o QR foi lido
  total         numeric(12,2) not null default 0,
  itens         jsonb not null default '[]'::jsonb,  -- [{c,d,m,q,u,p,t}]
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists compras_user_data on public.compras (user_id, data desc);
create unique index if not exists compras_user_chave on public.compras (user_id, chave) where chave is not null;

alter table public.compras enable row level security;
drop policy if exists "compras: ver as minhas"      on public.compras;
drop policy if exists "compras: criar as minhas"    on public.compras;
drop policy if exists "compras: editar as minhas"   on public.compras;
drop policy if exists "compras: excluir as minhas"  on public.compras;
create policy "compras: ver as minhas"     on public.compras for select to authenticated using (user_id = auth.uid());
create policy "compras: criar as minhas"   on public.compras for insert to authenticated with check (user_id = auth.uid());
create policy "compras: editar as minhas"  on public.compras for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "compras: excluir as minhas" on public.compras for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. Casas: grupo que divide a mesma lista de compras.
--    Cada pessoa está em uma casa; entra em outra pelo código de convite.
-- ---------------------------------------------------------------------
create table if not exists public.casas (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null default 'Minha casa',
  codigo    text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  criado_em timestamptz not null default now()
);
create table if not exists public.casa_membros (
  casa_id  uuid not null references public.casas(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  entrou_em timestamptz not null default now(),
  primary key (casa_id, user_id)
);
create index if not exists casa_membros_user on public.casa_membros (user_id);

create table if not exists public.lista_itens (
  id            uuid primary key default gen_random_uuid(),
  casa_id       uuid not null references public.casas(id) on delete cascade,
  nome          text not null,
  chave_produto text,                       -- "ean:789..." ou descrição|marca normalizada
  unidade       text not null default 'UN',
  qtd           numeric(10,3) not null default 1,
  feito         boolean not null default false,
  criado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em     timestamptz not null default now()
);
create index if not exists lista_itens_casa on public.lista_itens (casa_id, criado_em);

-- quem é membro de uma casa (usada nas regras abaixo)
create or replace function public.eh_membro(p_casa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.casa_membros where casa_id = p_casa and user_id = auth.uid());
$$;

alter table public.casas        enable row level security;
alter table public.casa_membros enable row level security;
alter table public.lista_itens  enable row level security;

drop policy if exists "casas: ver a minha"            on public.casas;
drop policy if exists "membros: ver os da minha casa" on public.casa_membros;
drop policy if exists "lista: membros veem"           on public.lista_itens;
drop policy if exists "lista: membros criam"          on public.lista_itens;
drop policy if exists "lista: membros editam"         on public.lista_itens;
drop policy if exists "lista: membros excluem"        on public.lista_itens;
create policy "casas: ver a minha"            on public.casas        for select to authenticated using (public.eh_membro(id));
create policy "membros: ver os da minha casa" on public.casa_membros for select to authenticated using (public.eh_membro(casa_id));
create policy "lista: membros veem"    on public.lista_itens for select to authenticated using (public.eh_membro(casa_id));
create policy "lista: membros criam"   on public.lista_itens for insert to authenticated with check (public.eh_membro(casa_id));
create policy "lista: membros editam"  on public.lista_itens for update to authenticated using (public.eh_membro(casa_id)) with check (public.eh_membro(casa_id));
create policy "lista: membros excluem" on public.lista_itens for delete to authenticated using (public.eh_membro(casa_id));
-- casas e membros só mudam pelas funções abaixo (sem insert/update/delete direto)

-- devolve a casa da pessoa; cria uma na primeira vez
create or replace function public.minha_casa()
returns table (id uuid, nome text, codigo text)
language plpgsql security definer set search_path = public as $$
declare v_casa uuid;
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  select m.casa_id into v_casa from public.casa_membros m where m.user_id = auth.uid() order by m.entrou_em desc limit 1;
  if v_casa is null then
    insert into public.casas default values returning casas.id into v_casa;
    insert into public.casa_membros (casa_id, user_id) values (v_casa, auth.uid());
  end if;
  return query select c.id, c.nome, c.codigo from public.casas c where c.id = v_casa;
end $$;

-- entra na casa de outra pessoa pelo código; sai da casa anterior
-- (se a casa anterior ficar vazia, ela e a lista dela são apagadas)
create or replace function public.entrar_na_casa(p_codigo text)
returns table (id uuid, nome text, codigo text)
language plpgsql security definer set search_path = public as $$
declare v_nova uuid; v_antiga uuid;
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  select c.id into v_nova from public.casas c where c.codigo = upper(trim(p_codigo));
  if v_nova is null then raise exception 'casa_nao_encontrada'; end if;
  for v_antiga in select m.casa_id from public.casa_membros m where m.user_id = auth.uid() and m.casa_id <> v_nova loop
    delete from public.casa_membros where casa_id = v_antiga and user_id = auth.uid();
    if not exists (select 1 from public.casa_membros where casa_id = v_antiga) then
      delete from public.casas where casas.id = v_antiga;
    end if;
  end loop;
  insert into public.casa_membros (casa_id, user_id) values (v_nova, auth.uid()) on conflict do nothing;
  return query select c.id, c.nome, c.codigo from public.casas c where c.id = v_nova;
end $$;

revoke all on function public.minha_casa()            from public, anon;
revoke all on function public.entrar_na_casa(text)    from public, anon;
grant execute on function public.minha_casa()         to authenticated;
grant execute on function public.entrar_na_casa(text) to authenticated;
grant execute on function public.eh_membro(uuid)      to authenticated;

-- ---------------------------------------------------------------------
-- 3. Tempo real: a lista atualiza sozinha em todos os celulares da casa
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.lista_itens;
exception when duplicate_object then null; end $$;
