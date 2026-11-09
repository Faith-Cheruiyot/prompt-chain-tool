-- Keep the shared provider catalog intact for the Humor Project.
-- This tool filters the catalog to its OpenAI-only supported models.
insert into public.llm_models (llm_provider_id, name, model_identifier, modality)
select id, 'GPT-5 nano (OpenAI)', 'gpt-5-nano', 'multimodal'
from public.llm_providers where slug = 'openai'
on conflict (llm_provider_id, model_identifier) do nothing;

-- Update model choices while preserving prompts, output types, and history.
with changed as (
  update public.prompt_chain_steps s
  set llm_model_id = target.id
  from public.llm_models old, public.llm_models target
  where s.llm_model_id = old.id
    and old.model_identifier in (
      'gpt-6-luna', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-image',
      'openai/gpt-6-luna', 'google/gemini-3.5-flash-lite', 'google/gemini-3.1-flash-image'
    )
    and target.model_identifier = case when s.output_type = 'image'
      then 'gpt-image-2.5-flare' else 'gpt-5-nano' end
    and s.prompt_chain_id in (
      '6cf7f59e-bc56-4756-b71f-ef455ee244dc'::uuid,
      'dcd5cdca-f449-4dc2-96a5-364ad7e111cf'::uuid
    )
  returning s.prompt_chain_id
)
update public.prompt_chains set updated_at = now()
where id in (select prompt_chain_id from changed);
