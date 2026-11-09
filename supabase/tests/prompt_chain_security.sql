-- Run as the database administrator. All test changes roll back.
-- Uses an existing active superadmin session only inside this transaction.
begin;
set local role anon;
do $$ begin
  if public.admin_access() then raise exception 'Anonymous caller received admin access'; end if;
exception when insufficient_privilege then null;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub',gen_random_uuid(),'role','authenticated','app_metadata',json_build_object('provider','google'),'amr',json_build_array(json_build_object('method','oauth')),'session_id',gen_random_uuid())::text,true);
set local role authenticated;
do $$ begin
  if public.admin_access() then raise exception 'Nonadmin received admin access'; end if;
  if exists(select 1 from public.prompt_chain_runs) then raise exception 'Nonadmin could read runs'; end if;
  begin
    perform public.pc_save_chain('{}'::jsonb);
    raise exception 'Nonadmin could save a chain';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
select set_config('request.jwt.claims', (
  select json_build_object('sub',s.user_id,'role','authenticated','app_metadata',json_build_object('provider','google'),'amr',json_build_array(json_build_object('method','oauth')),'session_id',s.id)::text
  from auth.sessions s join public.profiles p on p.user_id=s.user_id where p.is_superadmin limit 1
), true);
set local role authenticated;
do $$
declare
  cid uuid := gen_random_uuid();
  sid1 uuid := gen_random_uuid();
  sid2 uuid := gen_random_uuid();
  mid uuid;
  version timestamptz;
  payload jsonb;
begin
  if not public.admin_access() then raise exception 'No active Google superadmin session available'; end if;
  select id into mid from public.llm_models where model_identifier='gemini-3.5-flash-lite' limit 1;
  payload := jsonb_build_object('id',cid,'name','Temporary verification chain','description','','is_active',true,'expected_updated_at',null,
    'steps',jsonb_build_array(
      jsonb_build_object('id',sid1,'name','First','llm_model_id',mid,'system_prompt','','user_prompt','Describe {{input}}','temperature',null,'output_type','text'),
      jsonb_build_object('id',sid2,'name','Second','llm_model_id',mid,'system_prompt','','user_prompt','Summarize {{previous}}','temperature',null,'output_type','text')));
  perform public.pc_save_chain(payload);
  if (select count(*) from public.prompt_chain_steps where prompt_chain_id=cid) <> 2 then raise exception 'Step creation failed'; end if;
  select updated_at into version from public.prompt_chains where id=cid;
  payload := payload || jsonb_build_object('expected_updated_at',version,'name','Updated verification chain','steps',jsonb_build_array(payload->'steps'->1,payload->'steps'->0));
  perform public.pc_save_chain(payload);
  if (select position from public.prompt_chain_steps where id=sid2) <> 1 then raise exception 'Atomic reorder failed'; end if;
  begin
    perform public.pc_save_chain(payload || jsonb_build_object('expected_updated_at','2000-01-01T00:00:00Z'));
    raise exception 'Stale save was accepted';
  exception when serialization_failure then null;
  end;
  select updated_at into version from public.prompt_chains where id=cid;
  payload := payload || jsonb_build_object('expected_updated_at',version,'steps',jsonb_build_array(payload->'steps'->0));
  perform public.pc_save_chain(payload);
  if exists(select 1 from public.prompt_chain_steps where id=sid1) then raise exception 'Step deletion failed'; end if;
  insert into public.prompt_chain_runs(prompt_chain_id,created_by,input,chain_snapshot,status,outputs)
    values(cid,auth.uid(),'test','{"name":"Snapshot","steps":[]}'::jsonb,'completed','[]'::jsonb);
  delete from public.prompt_chains where id=cid;
  if exists(select 1 from public.prompt_chain_steps where prompt_chain_id=cid) or exists(select 1 from public.prompt_chain_runs where prompt_chain_id=cid) then
    raise exception 'Chain deletion did not cascade';
  end if;
end $$;
rollback;
select 'Passed: anonymous denial, nonadmin denial, chain CRUD, step CRUD, atomic reorder, stale-save rejection, run persistence, cascade deletion. All test writes rolled back.' as result;
