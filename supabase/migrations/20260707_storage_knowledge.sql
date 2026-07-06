insert into storage.buckets (id, name, public) values ('knowledge', 'knowledge', false) on conflict do nothing;

create policy "Allow authenticated uploads"
  on storage.objects for insert to authenticated with check (bucket_id = 'knowledge');

create policy "Allow authenticated reads"
  on storage.objects for select to authenticated using (bucket_id = 'knowledge');

create policy "Allow authenticated deletes"
  on storage.objects for delete to authenticated using (bucket_id = 'knowledge');
