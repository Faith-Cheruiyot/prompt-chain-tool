-- Integrates with the Humor Project's existing schema and authorization helper.
-- No service-role key is required by this application.
alter table public.prompt_chain_steps
  add column output_type text not null default 'text'
  check (output_type in ('text', 'image'));

create table public.prompt_chain_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_chain_id uuid not null references public.prompt_chains(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  input text not null default '',
  input_image text,
  status text not null default 'running' check (status in ('running','completed','failed')),
  chain_snapshot jsonb not null,
  outputs jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index prompt_chain_runs_chain_created_idx on public.prompt_chain_runs(prompt_chain_id, created_at desc);
create index prompt_chain_runs_created_by_idx on public.prompt_chain_runs(created_by);
create index prompt_chain_runs_created_idx on public.prompt_chain_runs(created_at desc);
alter table public.prompt_chain_runs enable row level security;
create policy pc_admin_runs on public.prompt_chain_runs for all to authenticated
  using ((select humor_private.is_superadmin()))
  with check ((select humor_private.is_superadmin()));
create policy pc_admin_write_chains on public.prompt_chains for all to authenticated
  using ((select humor_private.is_superadmin()))
  with check ((select humor_private.is_superadmin()));
create policy pc_admin_write_steps on public.prompt_chain_steps for all to authenticated
  using ((select humor_private.is_superadmin()))
  with check ((select humor_private.is_superadmin()));
grant select, insert, update, delete on public.prompt_chains, public.prompt_chain_steps, public.prompt_chain_runs to authenticated;

create function public.pc_save_chain(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  chain_id uuid := (payload->>'id')::uuid;
  existing_updated timestamptz;
  step jsonb;
  step_count integer;
  offset_position integer;
  n integer := 0;
begin
  if not humor_private.is_superadmin() then
    raise exception 'Superadmin access required.' using errcode = '42501';
  end if;
  if jsonb_typeof(payload->'steps') <> 'array' or payload->'steps' is null then
    raise exception 'Steps must be an array.';
  end if;
  step_count := jsonb_array_length(payload->'steps');
  if step_count > 12 or length(trim(payload->>'name')) not between 1 and 120
    or coalesce(length(payload->>'description'),0) > 1000 then
    raise exception 'Invalid chain details.';
  end if;
  if step_count <> (select count(distinct value->>'id') from jsonb_array_elements(payload->'steps')) then
    raise exception 'Step IDs must be unique.';
  end if;
  if exists (select 1 from public.prompt_chain_steps s where s.id in
    (select (value->>'id')::uuid from jsonb_array_elements(payload->'steps')) and s.prompt_chain_id <> chain_id) then
    raise exception 'A step cannot be moved between chains.';
  end if;
  select updated_at into existing_updated from public.prompt_chains where id = chain_id for update;
  if found then
    if existing_updated is distinct from (payload->>'expected_updated_at')::timestamptz then
      raise exception 'This chain changed in another window.' using errcode = '40001';
    end if;
    update public.prompt_chains set name=trim(payload->>'name'), description=payload->>'description',
      is_active=(payload->>'is_active')::boolean where id=chain_id;
  else
    if payload->>'expected_updated_at' is not null then
      raise exception 'This chain no longer exists.' using errcode = '40001';
    end if;
    insert into public.prompt_chains(id,name,description,is_active)
      values(chain_id,trim(payload->>'name'),payload->>'description',(payload->>'is_active')::boolean);
  end if;
  delete from public.prompt_chain_steps s where s.prompt_chain_id = chain_id and not exists
    (select 1 from jsonb_array_elements(payload->'steps') e where (e->>'id')::uuid=s.id);
  -- Move existing positions above the previous maximum, then write the final order.
  -- The parent row lock serializes concurrent saves of the same chain.
  select coalesce(max(position),0)+12 into offset_position from public.prompt_chain_steps where prompt_chain_id=chain_id;
  update public.prompt_chain_steps set position=position+offset_position where prompt_chain_id=chain_id;
  for step in select value from jsonb_array_elements(payload->'steps') loop
    n := n+1;
    if coalesce(length(trim(step->>'name')),0) not between 1 and 120
      or coalesce(length(trim(step->>'user_prompt')),0) not between 1 and 12000
      or coalesce(length(step->>'system_prompt'),0) > 12000
      or step->>'output_type' not in ('text','image')
      or not exists(select 1 from public.llm_models where id=(step->>'llm_model_id')::uuid and is_active) then
      raise exception 'Invalid step details.';
    end if;
    insert into public.prompt_chain_steps(id,prompt_chain_id,position,name,llm_model_id,system_prompt,user_prompt,temperature,output_type)
      values ((step->>'id')::uuid,chain_id,n,trim(step->>'name'),(step->>'llm_model_id')::uuid,
        step->>'system_prompt',step->>'user_prompt',(step->>'temperature')::numeric,step->>'output_type')
      on conflict (id) do update set position=excluded.position,name=excluded.name,llm_model_id=excluded.llm_model_id,
        system_prompt=excluded.system_prompt,user_prompt=excluded.user_prompt,temperature=excluded.temperature,output_type=excluded.output_type;
  end loop;
  return chain_id;
end;
$$;
revoke all on function public.pc_save_chain(jsonb) from public, anon;
grant execute on function public.pc_save_chain(jsonb) to authenticated;

insert into public.llm_models(llm_provider_id,name,model_identifier,modality)
  select id,'Gemini 3.1 Flash Image','gemini-3.1-flash-image','multimodal' from public.llm_providers
  where slug='google' and not exists (select 1 from public.llm_models where model_identifier='gemini-3.1-flash-image');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('prompt-chain-media','prompt-chain-media',false,10485760,array['image/png','image/jpeg','image/webp']);
create policy pc_media_read on storage.objects for select to authenticated
  using (bucket_id='prompt-chain-media' and (select humor_private.is_superadmin()));
create policy pc_media_insert on storage.objects for insert to authenticated
  with check (bucket_id='prompt-chain-media' and (storage.foldername(name))[1]=(select auth.uid())::text and (select humor_private.is_superadmin()));
create policy pc_media_delete on storage.objects for delete to authenticated
  using (bucket_id='prompt-chain-media' and (select humor_private.is_superadmin()));
