-- Run this once in Supabase SQL Editor on your existing project.
-- Existing date_plans are preserved but unlinked historical rows remain private.
create extension if not exists pgcrypto;
create table if not exists public.invitations (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
create index if not exists invitations_owner_idx on public.invitations(owner_id);
alter table public.invitations enable row level security;
revoke all on public.invitations from anon;
grant select,insert,delete on public.invitations to authenticated;

drop policy if exists "Owner select invitations" on public.invitations;
create policy "Owner select invitations" on public.invitations for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists "Owner create invitations" on public.invitations;
create policy "Owner create invitations" on public.invitations for insert to authenticated with check (owner_id=(select auth.uid()));
drop policy if exists "Owner delete invitations" on public.invitations;
create policy "Owner delete invitations" on public.invitations for delete to authenticated using (owner_id=(select auth.uid()));

alter table public.date_plans add column if not exists invitation_id uuid references public.invitations(id) on delete cascade;
create unique index if not exists one_answer_per_invitation on public.date_plans(invitation_id) where invitation_id is not null;
create index if not exists date_plans_invitation_idx on public.date_plans(invitation_id);
alter table public.date_plans enable row level security;
-- Remove old permissive policies, including legacy public insert and broad authenticated SELECT.
do $$ declare pol record; begin
 for pol in select policyname from pg_policies where schemaname='public' and tablename='date_plans' loop
  execute format('drop policy if exists %I on public.date_plans',pol.policyname);
 end loop;
end $$;
revoke all on public.date_plans from anon,authenticated;
grant select on public.date_plans to authenticated;
create policy "Owner read invitation answers" on public.date_plans for select to authenticated
 using (exists(select 1 from public.invitations i where i.id=invitation_id and i.owner_id=(select auth.uid())));

-- A public invite token is an unguessable UUID. Only exposes answered status.
create or replace function public.get_public_invitation(p_token text)
returns table(answered boolean)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 begin v_id := p_token::uuid; exception when invalid_text_representation then return; end;
 return query select exists(select 1 from public.date_plans d where d.invitation_id=i.id)
 from public.invitations i where i.id=v_id;
end $$;

-- Only this validated RPC can insert anonymous answers.
create or replace function public.submit_invitation_response(
 p_token text, p_date text, p_time text, p_activities text[], p_message text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
 begin v_id := p_token::uuid; exception when invalid_text_representation then raise exception 'Invalid invitation'; end;
 if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' or to_char(to_date(p_date,'YYYY-MM-DD'),'YYYY-MM-DD') <> p_date then raise exception 'Invalid date'; end if;
 if p_time is null or p_time !~ '^(1[2-9]|20):00$' then raise exception 'Invalid time'; end if;
 if p_activities is null or cardinality(p_activities) < 1 or cardinality(p_activities) > 6 then raise exception 'Invalid activities'; end if;
 if exists(select 1 from unnest(p_activities) a where a <> all(array['🍰 맛있는 거 먹기','🎬 영화 보기','🌳 산책하기','🎮 같이 게임하기','☕ 카페 가기','📷 사진 찍기'])) then raise exception 'Invalid activities'; end if;
 if length(coalesce(p_message,'')) > 100 then raise exception 'Message too long'; end if;
 perform 1 from public.invitations where id=v_id for update;
 if not found then raise exception 'Invitation not found'; end if;
 if exists(select 1 from public.date_plans where invitation_id=v_id) then raise exception 'Already answered'; end if;
 -- Support both the original text[] schema and the older jsonb schema.
 if (select a.atttypid = 'text[]'::regtype
     from pg_attribute a
     where a.attrelid = 'public.date_plans'::regclass
       and a.attname = 'activities' and not a.attisdropped) then
   insert into public.date_plans(invitation_id,date,time,activities,message)
   values(v_id,p_date,p_time,p_activities,coalesce(p_message,''));
 else
   execute 'insert into public.date_plans(invitation_id,date,time,activities,message) values ($1,$2,$3,$4,$5)'
   using v_id,p_date,p_time,to_jsonb(p_activities),coalesce(p_message,'');
 end if;
end $$;
revoke all on function public.get_public_invitation(text) from public;
revoke all on function public.submit_invitation_response(text,text,text,text[],text) from public;
grant execute on function public.get_public_invitation(text) to anon,authenticated;
grant execute on function public.submit_invitation_response(text,text,text,text[],text) to anon,authenticated;
