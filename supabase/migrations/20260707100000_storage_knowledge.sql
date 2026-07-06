insert into storage.buckets (id, name, public) values ('knowledge', 'knowledge', false) on conflict do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Allow service role all operations on knowledge'
  ) then
    create policy "Allow service role all operations on knowledge"
      on storage.objects for all
      to service_role
      using (bucket_id = 'knowledge')
      with check (bucket_id = 'knowledge');
  end if;
end
$$;
