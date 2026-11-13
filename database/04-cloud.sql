create table public.intake_records (
 owner_id uuid not null references auth.users(id) on delete cascade,
 id uuid not null,
 version integer not null default 1 check (version > 0),
 client_revision uuid not null,
 object_path text not null,
 updated_at timestamptz not null default now(),
 primary key (owner_id,id),
 check (object_path like owner_id::text || '/' || id::text || '/%')
);
alter table public.intake_records enable row level security;
revoke all on public.intake_records from anon;
grant select,insert,update on public.intake_records to authenticated;
create policy intake_select on public.intake_records for select to authenticated using ((select auth.uid())=owner_id);
create policy intake_insert on public.intake_records for insert to authenticated with check ((select auth.uid())=owner_id);
create policy intake_update on public.intake_records for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create function public.save_intake(p_id uuid,p_revision uuid,p_expected integer,p_path text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_row public.intake_records; result_version integer;
begin
 if auth.uid() is null then raise exception 'authentication_required'; end if;
 if p_path <> auth.uid()::text || '/' || p_id::text || '/' || p_revision::text || '.json' then raise exception 'invalid_path'; end if;
 select * into current_row from public.intake_records where owner_id=auth.uid() and id=p_id for update;
 if found then
   if current_row.client_revision=p_revision then return jsonb_build_object('version',current_row.version); end if;
   if current_row.version<>p_expected then raise exception 'sync_conflict'; end if;
   update public.intake_records set version=version+1,client_revision=p_revision,object_path=p_path,updated_at=now() where owner_id=auth.uid() and id=p_id returning version into result_version;
 else
   if p_expected<>0 then raise exception 'sync_conflict'; end if;
   insert into public.intake_records(owner_id,id,client_revision,object_path) values(auth.uid(),p_id,p_revision,p_path) on conflict do nothing returning version into result_version;
   if result_version is null then raise exception 'sync_conflict'; end if;
 end if;
 return jsonb_build_object('version',result_version);
end $$;
revoke all on function public.save_intake(uuid,uuid,integer,text) from public,anon;
grant execute on function public.save_intake(uuid,uuid,integer,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('intake-private','intake-private',false,41943040,array['application/json']);
create policy intake_storage_read on storage.objects for select to authenticated using (bucket_id='intake-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy intake_storage_insert on storage.objects for insert to authenticated with check (bucket_id='intake-private' and (storage.foldername(name))[1]=(select auth.uid())::text);
