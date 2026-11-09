-- Extend the shared model catalog; existing models and saved chains are preserved.
insert into public.llm_providers (name, slug, api_base_url)
values ('OpenAI', 'openai', 'https://api.openai.com/v1')
on conflict do nothing;

insert into public.llm_models (llm_provider_id, name, model_identifier, modality)
select p.id, m.name, m.identifier, m.modality
from public.llm_providers p
cross join (values
  ('GPT-6 Luna (OpenAI)', 'gpt-6-luna', 'multimodal'),
  ('GPT Image 2.5 Flare (OpenAI)', 'gpt-image-2.5-flare', 'image')
) as m(name, identifier, modality)
where p.slug = 'openai'
on conflict (llm_provider_id, model_identifier) do nothing;
