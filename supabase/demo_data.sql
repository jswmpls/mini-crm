do $$
declare
  m  uuid; e1 uuid; e2 uuid;
  o1 uuid; o2 uuid; o3 uuid;
  t  uuid;
begin
  select id into m  from public.profiles where email = 'manager@demo.test';
  select id into e1 from public.profiles where email = 'executor1@demo.test';
  select id into e2 from public.profiles where email = 'executor2@demo.test';
  if m is null or e1 is null or e2 is null then
    raise exception 'Сначала создайте пользователей manager@demo.test, executor1@demo.test, executor2@demo.test';
  end if;

  update public.profiles set role = 'manager',  full_name = 'Иван Руководитель' where id = m;
  update public.profiles set role = 'executor', full_name = 'Пётр Исполнитель'  where id = e1;
  update public.profiles set role = 'executor', full_name = 'Анна Исполнитель'  where id = e2;

  set local role authenticated;

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);

  insert into public.construction_objects (name, address) values ('ЖК «Северный»', 'г. Москва, ул. Северная, 12') returning id into o1;
  insert into public.construction_objects (name, address) values ('Склад «Восток»', 'г. Казань, ул. Заводская, 5') returning id into o2;
  insert into public.construction_objects (name, address) values ('Офис на Ленина', 'г. Тверь, пр. Ленина, 40') returning id into o3;

  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Залить фундамент секции А', 'Бетон B25, контроль температуры', o1, e1);
  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Смонтировать опалубку', 'Секция Б, 2 этаж', o1, e1) returning id into t;
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'in_progress');

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Принять арматуру', 'Проверить сертификаты', o2, e1) returning id into t;
  perform set_config('request.jwt.claims', json_build_object('sub', e1, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'in_review', 'Арматура принята, сертификаты в папке');

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Ограждение площадки', 'Периметр 120 м', o2, e2) returning id into t;
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'in_review');
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'accepted', 'Всё в порядке');

  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Штукатурка холла', 'Первый этаж', o3, e2) returning id into t;
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'in_progress');
  perform public.change_task_status(t, 'in_review');
  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'rework', 'Неровности у окон, переделать');

  perform set_config('request.jwt.claims', json_build_object('sub', m, 'role', 'authenticated')::text, true);
  insert into public.tasks (title, description, object_id, assignee_id)
    values ('Электромонтаж этажа 1', 'Кабельные трассы и щиты', o3, e2) returning id into t;
  perform set_config('request.jwt.claims', json_build_object('sub', e2, 'role', 'authenticated')::text, true);
  perform public.change_task_status(t, 'in_progress');

  reset role;
end;
$$;