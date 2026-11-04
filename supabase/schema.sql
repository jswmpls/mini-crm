create type public.user_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'in_review', 'accepted', 'rework');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'executor',
  created_at  timestamptz not null default now()
);

create table public.construction_objects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) > 0),
  address     text not null check (length(btrim(address)) > 0),
  created_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(btrim(title)) > 0),
  description  text not null default '',
  object_id    uuid not null references public.construction_objects (id) on delete cascade,
  assignee_id  uuid not null references public.profiles (id),
  status       public.task_status not null default 'new',
  author_id    uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.task_status_history (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  changed_by   uuid references public.profiles (id),
  from_status  public.task_status,
  to_status    public.task_status not null,
  comment      text,
  created_at   timestamptz not null default now()
);

create index tasks_object_idx   on public.tasks (object_id);
create index tasks_assignee_idx on public.tasks (assignee_id);
create index history_task_idx   on public.task_status_history (task_id, created_at);

create function public.is_manager()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'manager'
  );
$$;

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.tasks_before_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.is_manager() then
    raise exception 'Создавать задачи может только постановщик' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Исполнителем может быть только пользователь с ролью исполнителя';
  end if;

  new.status     := 'new';
  new.author_id  := auth.uid();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create function public.tasks_before_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid     uuid    := auth.uid();
  v_manager boolean := public.is_manager();
  v_comment text    := nullif(btrim(coalesce(current_setting('app.status_comment', true), '')), '');
  v_ok      boolean := false;
begin
  if new.id is distinct from old.id
     or new.author_id  is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Поля id, автор и дата создания изменять нельзя';
  end if;

  if not v_manager and (
        new.title       is distinct from old.title
     or new.description is distinct from old.description
     or new.object_id   is distinct from old.object_id
     or new.assignee_id is distinct from old.assignee_id) then
    raise exception 'Исполнитель может менять только статус задачи' using errcode = '42501';
  end if;

  if new.assignee_id is distinct from old.assignee_id
     and not exists (select 1 from public.profiles where id = new.assignee_id and role = 'executor') then
    raise exception 'Исполнителем может быть только пользователь с ролью исполнителя';
  end if;

  if new.status is distinct from old.status then
    if v_manager then
      v_ok := old.status = 'in_review' and new.status in ('accepted', 'rework');
    elsif old.assignee_id = v_uid then
      v_ok := (old.status = 'new'         and new.status = 'in_progress')
           or (old.status = 'in_progress' and new.status = 'in_review')
           or (old.status = 'rework'      and new.status = 'in_progress');
    end if;

    if not v_ok then
      raise exception 'Переход % -> % запрещён для текущего пользователя', old.status, new.status
        using errcode = '42501';
    end if;

    if new.status = 'rework' and v_comment is null then
      raise exception 'При возврате на доработку комментарий обязателен' using errcode = '23514';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create function public.tasks_after_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (task_id, changed_by, from_status, to_status)
    values (new.id, auth.uid(), null, new.status);
  elsif new.status is distinct from old.status then
    insert into public.task_status_history (task_id, changed_by, from_status, to_status, comment)
    values (
      new.id, auth.uid(), old.status, new.status,
      nullif(btrim(coalesce(current_setting('app.status_comment', true), '')), '')
    );
  end if;
  return null;
end;
$$;

create trigger tasks_bi before insert on public.tasks
  for each row execute function public.tasks_before_insert();
create trigger tasks_bu before update on public.tasks
  for each row execute function public.tasks_before_update();
create trigger tasks_ai after insert or update on public.tasks
  for each row execute function public.tasks_after_change();

create function public.change_task_status(
  p_task_id    uuid,
  p_new_status public.task_status,
  p_comment    text default null
)
returns public.tasks
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  perform set_config('app.status_comment', coalesce(p_comment, ''), true);

  update public.tasks
     set status = p_new_status
   where id = p_task_id
  returning * into v_task;

  perform set_config('app.status_comment', '', true);

  if v_task.id is null then
    raise exception 'Задача не найдена или нет доступа' using errcode = 'P0002';
  end if;
  return v_task;
end;
$$;

revoke all on public.profiles, public.construction_objects, public.tasks, public.task_status_history
  from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.construction_objects to authenticated;
grant select, delete on public.tasks to authenticated;
grant insert (title, description, object_id, assignee_id) on public.tasks to authenticated;
grant update (title, description, object_id, assignee_id, status) on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.change_task_status(uuid, public.task_status, text) to authenticated;

alter table public.profiles             enable row level security;
alter table public.construction_objects enable row level security;
alter table public.tasks                enable row level security;
alter table public.task_status_history  enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_manager()
  or exists (select 1 from public.tasks t
             where t.assignee_id = auth.uid() and t.author_id = profiles.id)
  or exists (select 1 from public.task_status_history h
             join public.tasks t on t.id = h.task_id
             where t.assignee_id = auth.uid() and h.changed_by = profiles.id)
);

create policy objects_select on public.construction_objects for select to authenticated
using (
  public.is_manager()
  or exists (select 1 from public.tasks t
             where t.object_id = construction_objects.id and t.assignee_id = auth.uid())
);
create policy objects_insert on public.construction_objects for insert to authenticated
with check (public.is_manager());
create policy objects_update on public.construction_objects for update to authenticated
using (public.is_manager()) with check (public.is_manager());
create policy objects_delete on public.construction_objects for delete to authenticated
using (public.is_manager());

create policy tasks_select on public.tasks for select to authenticated
using (public.is_manager() or assignee_id = auth.uid());
create policy tasks_insert on public.tasks for insert to authenticated
with check (public.is_manager());
create policy tasks_update on public.tasks for update to authenticated
using (public.is_manager() or assignee_id = auth.uid())
with check (public.is_manager() or assignee_id = auth.uid());
create policy tasks_delete on public.tasks for delete to authenticated
using (public.is_manager());

create policy history_select on public.task_status_history for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_status_history.task_id));