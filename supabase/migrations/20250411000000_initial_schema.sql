create table "public"."company" (
    "id" uuid not null default uuid_generate_v4(),
    "name" character varying(100) not null,
    "code" character varying(8) not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP
);


create table "public"."question" (
    "id" uuid not null default uuid_generate_v4(),
    "name" character varying(100) not null,
    "answers" jsonb not null,
    "training_id" uuid not null,
    "created_at" timestamp without time zone default CURRENT_TIMESTAMP
);


create table "public"."schedule" (
    "id" uuid not null default uuid_generate_v4(),
    "start" timestamp with time zone not null,
    "end" timestamp with time zone not null,
    "category" smallint not null,
    "user_id" uuid not null,
    "company_id" uuid not null,
    "finalized" boolean not null default false
);


create table "public"."submission" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "company_id" uuid not null,
    "training_id" uuid not null,
    "answers" jsonb not null,
    "created_at" timestamp with time zone not null default (now() AT TIME ZONE 'utc'::text)
);


create table "public"."ticket" (
    "id" uuid not null default uuid_generate_v4(),
    "title" character varying(50) not null,
    "content" text not null,
    "closed" boolean not null default false,
    "user_id" uuid not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "company_id" uuid
);


create table "public"."ticket_response" (
    "id" uuid not null default uuid_generate_v4(),
    "content" text not null,
    "user_id" uuid not null,
    "ticket_id" uuid not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP
);


create table "public"."training" (
    "id" uuid not null default uuid_generate_v4(),
    "name" character varying(100) not null,
    "description" text not null,
    "file_url" text not null,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "role" smallint not null,
    "company_id" uuid not null,
    "questions" jsonb not null
);


create table "public"."training_in_progress" (
    "id" uuid not null default gen_random_uuid(),
    "user_id" uuid not null,
    "training_id" uuid not null
);


create table "public"."user" (
    "id" uuid not null default uuid_generate_v4(),
    "name" character varying(150) not null,
    "age" smallint,
    "hourly_wage" integer,
    "role" smallint not null,
    "company_id" uuid,
    "verified" boolean not null default false,
    "created_at" timestamp with time zone default CURRENT_TIMESTAMP,
    "avatar_url" text
);


CREATE UNIQUE INDEX company_pkey ON public.company USING btree (id);

CREATE UNIQUE INDEX in_progress_user_training_unique ON public.training_in_progress USING btree (user_id, training_id);

CREATE UNIQUE INDEX question_pkey ON public.question USING btree (id);

CREATE UNIQUE INDEX schedule_pkey ON public.schedule USING btree (id);

CREATE UNIQUE INDEX submission_pkey ON public.submission USING btree (id);

CREATE UNIQUE INDEX submission_user_training_unique ON public.submission USING btree (user_id, training_id);

CREATE UNIQUE INDEX ticket_pkey ON public.ticket USING btree (id);

CREATE UNIQUE INDEX ticket_response_pkey ON public.ticket_response USING btree (id);

CREATE UNIQUE INDEX training_in_progress_pkey ON public.training_in_progress USING btree (id);

CREATE UNIQUE INDEX training_name_unique ON public.training USING btree (name, company_id);

CREATE UNIQUE INDEX training_pkey ON public.training USING btree (id);

CREATE UNIQUE INDEX user_pkey ON public."user" USING btree (id);

alter table "public"."company" add constraint "company_pkey" PRIMARY KEY using index "company_pkey";

alter table "public"."question" add constraint "question_pkey" PRIMARY KEY using index "question_pkey";

alter table "public"."schedule" add constraint "schedule_pkey" PRIMARY KEY using index "schedule_pkey";

alter table "public"."submission" add constraint "submission_pkey" PRIMARY KEY using index "submission_pkey";

alter table "public"."ticket" add constraint "ticket_pkey" PRIMARY KEY using index "ticket_pkey";

alter table "public"."ticket_response" add constraint "ticket_response_pkey" PRIMARY KEY using index "ticket_response_pkey";

alter table "public"."training" add constraint "training_pkey" PRIMARY KEY using index "training_pkey";

alter table "public"."training_in_progress" add constraint "training_in_progress_pkey" PRIMARY KEY using index "training_in_progress_pkey";

alter table "public"."user" add constraint "user_pkey" PRIMARY KEY using index "user_pkey";

alter table "public"."question" add constraint "question_training_id_fkey" FOREIGN KEY (training_id) REFERENCES training(id) not valid;

alter table "public"."question" validate constraint "question_training_id_fkey";

alter table "public"."schedule" add constraint "schedule_company_id_fkey" FOREIGN KEY (company_id) REFERENCES company(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."schedule" validate constraint "schedule_company_id_fkey";

alter table "public"."schedule" add constraint "schedule_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) not valid;

alter table "public"."schedule" validate constraint "schedule_user_id_fkey";

alter table "public"."submission" add constraint "submission_company_id_fkey" FOREIGN KEY (company_id) REFERENCES company(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."submission" validate constraint "submission_company_id_fkey";

alter table "public"."submission" add constraint "submission_training_id_fkey" FOREIGN KEY (training_id) REFERENCES training(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."submission" validate constraint "submission_training_id_fkey";

alter table "public"."submission" add constraint "submission_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."submission" validate constraint "submission_user_id_fkey";

alter table "public"."submission" add constraint "submission_user_training_unique" UNIQUE using index "submission_user_training_unique";

alter table "public"."ticket" add constraint "ticket_company_id_fkey" FOREIGN KEY (company_id) REFERENCES company(id) not valid;

alter table "public"."ticket" validate constraint "ticket_company_id_fkey";

alter table "public"."ticket" add constraint "ticket_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) not valid;

alter table "public"."ticket" validate constraint "ticket_user_id_fkey";

alter table "public"."ticket_response" add constraint "ticket_response_ticket_id_fkey" FOREIGN KEY (ticket_id) REFERENCES ticket(id) not valid;

alter table "public"."ticket_response" validate constraint "ticket_response_ticket_id_fkey";

alter table "public"."ticket_response" add constraint "ticket_response_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) not valid;

alter table "public"."ticket_response" validate constraint "ticket_response_user_id_fkey";

alter table "public"."training" add constraint "training_company_id_fkey" FOREIGN KEY (company_id) REFERENCES company(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."training" validate constraint "training_company_id_fkey";

alter table "public"."training" add constraint "training_name_unique" UNIQUE using index "training_name_unique";

alter table "public"."training_in_progress" add constraint "in_progress_training_id_fkey" FOREIGN KEY (training_id) REFERENCES training(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."training_in_progress" validate constraint "in_progress_training_id_fkey";

alter table "public"."training_in_progress" add constraint "in_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE not valid;

alter table "public"."training_in_progress" validate constraint "in_progress_user_id_fkey";

alter table "public"."training_in_progress" add constraint "in_progress_user_training_unique" UNIQUE using index "in_progress_user_training_unique";

alter table "public"."user" add constraint "user_company_id_fkey" FOREIGN KEY (company_id) REFERENCES company(id) not valid;

alter table "public"."user" validate constraint "user_company_id_fkey";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_delete_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.user
  WHERE id = old.id;
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user (id, name, role, company_id)
  VALUES (
    new.id,
    new.raw_user_meta_data ->> 'name',
    (new.raw_user_meta_data ->> 'role')::smallint,
    (new.raw_user_meta_data ->> 'company_id')::uuid
  );
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_update_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.user SET
    name = new.raw_user_meta_data ->> 'name',
    role = (new.raw_user_meta_data ->> 'role')::smallint,
    company_id = (new.raw_user_meta_data ->> 'company_id')::uuid
  WHERE id = new.id;
  RETURN new;
END;
$function$
;

grant delete on table "public"."company" to "anon";

grant insert on table "public"."company" to "anon";

grant references on table "public"."company" to "anon";

grant select on table "public"."company" to "anon";

grant trigger on table "public"."company" to "anon";

grant truncate on table "public"."company" to "anon";

grant update on table "public"."company" to "anon";

grant delete on table "public"."company" to "authenticated";

grant insert on table "public"."company" to "authenticated";

grant references on table "public"."company" to "authenticated";

grant select on table "public"."company" to "authenticated";

grant trigger on table "public"."company" to "authenticated";

grant truncate on table "public"."company" to "authenticated";

grant update on table "public"."company" to "authenticated";

grant delete on table "public"."company" to "service_role";

grant insert on table "public"."company" to "service_role";

grant references on table "public"."company" to "service_role";

grant select on table "public"."company" to "service_role";

grant trigger on table "public"."company" to "service_role";

grant truncate on table "public"."company" to "service_role";

grant update on table "public"."company" to "service_role";

grant delete on table "public"."question" to "anon";

grant insert on table "public"."question" to "anon";

grant references on table "public"."question" to "anon";

grant select on table "public"."question" to "anon";

grant trigger on table "public"."question" to "anon";

grant truncate on table "public"."question" to "anon";

grant update on table "public"."question" to "anon";

grant delete on table "public"."question" to "authenticated";

grant insert on table "public"."question" to "authenticated";

grant references on table "public"."question" to "authenticated";

grant select on table "public"."question" to "authenticated";

grant trigger on table "public"."question" to "authenticated";

grant truncate on table "public"."question" to "authenticated";

grant update on table "public"."question" to "authenticated";

grant delete on table "public"."question" to "service_role";

grant insert on table "public"."question" to "service_role";

grant references on table "public"."question" to "service_role";

grant select on table "public"."question" to "service_role";

grant trigger on table "public"."question" to "service_role";

grant truncate on table "public"."question" to "service_role";

grant update on table "public"."question" to "service_role";

grant delete on table "public"."schedule" to "anon";

grant insert on table "public"."schedule" to "anon";

grant references on table "public"."schedule" to "anon";

grant select on table "public"."schedule" to "anon";

grant trigger on table "public"."schedule" to "anon";

grant truncate on table "public"."schedule" to "anon";

grant update on table "public"."schedule" to "anon";

grant delete on table "public"."schedule" to "authenticated";

grant insert on table "public"."schedule" to "authenticated";

grant references on table "public"."schedule" to "authenticated";

grant select on table "public"."schedule" to "authenticated";

grant trigger on table "public"."schedule" to "authenticated";

grant truncate on table "public"."schedule" to "authenticated";

grant update on table "public"."schedule" to "authenticated";

grant delete on table "public"."schedule" to "service_role";

grant insert on table "public"."schedule" to "service_role";

grant references on table "public"."schedule" to "service_role";

grant select on table "public"."schedule" to "service_role";

grant trigger on table "public"."schedule" to "service_role";

grant truncate on table "public"."schedule" to "service_role";

grant update on table "public"."schedule" to "service_role";

grant delete on table "public"."submission" to "anon";

grant insert on table "public"."submission" to "anon";

grant references on table "public"."submission" to "anon";

grant select on table "public"."submission" to "anon";

grant trigger on table "public"."submission" to "anon";

grant truncate on table "public"."submission" to "anon";

grant update on table "public"."submission" to "anon";

grant delete on table "public"."submission" to "authenticated";

grant insert on table "public"."submission" to "authenticated";

grant references on table "public"."submission" to "authenticated";

grant select on table "public"."submission" to "authenticated";

grant trigger on table "public"."submission" to "authenticated";

grant truncate on table "public"."submission" to "authenticated";

grant update on table "public"."submission" to "authenticated";

grant delete on table "public"."submission" to "service_role";

grant insert on table "public"."submission" to "service_role";

grant references on table "public"."submission" to "service_role";

grant select on table "public"."submission" to "service_role";

grant trigger on table "public"."submission" to "service_role";

grant truncate on table "public"."submission" to "service_role";

grant update on table "public"."submission" to "service_role";

grant delete on table "public"."ticket" to "anon";

grant insert on table "public"."ticket" to "anon";

grant references on table "public"."ticket" to "anon";

grant select on table "public"."ticket" to "anon";

grant trigger on table "public"."ticket" to "anon";

grant truncate on table "public"."ticket" to "anon";

grant update on table "public"."ticket" to "anon";

grant delete on table "public"."ticket" to "authenticated";

grant insert on table "public"."ticket" to "authenticated";

grant references on table "public"."ticket" to "authenticated";

grant select on table "public"."ticket" to "authenticated";

grant trigger on table "public"."ticket" to "authenticated";

grant truncate on table "public"."ticket" to "authenticated";

grant update on table "public"."ticket" to "authenticated";

grant delete on table "public"."ticket" to "service_role";

grant insert on table "public"."ticket" to "service_role";

grant references on table "public"."ticket" to "service_role";

grant select on table "public"."ticket" to "service_role";

grant trigger on table "public"."ticket" to "service_role";

grant truncate on table "public"."ticket" to "service_role";

grant update on table "public"."ticket" to "service_role";

grant delete on table "public"."ticket_response" to "anon";

grant insert on table "public"."ticket_response" to "anon";

grant references on table "public"."ticket_response" to "anon";

grant select on table "public"."ticket_response" to "anon";

grant trigger on table "public"."ticket_response" to "anon";

grant truncate on table "public"."ticket_response" to "anon";

grant update on table "public"."ticket_response" to "anon";

grant delete on table "public"."ticket_response" to "authenticated";

grant insert on table "public"."ticket_response" to "authenticated";

grant references on table "public"."ticket_response" to "authenticated";

grant select on table "public"."ticket_response" to "authenticated";

grant trigger on table "public"."ticket_response" to "authenticated";

grant truncate on table "public"."ticket_response" to "authenticated";

grant update on table "public"."ticket_response" to "authenticated";

grant delete on table "public"."ticket_response" to "service_role";

grant insert on table "public"."ticket_response" to "service_role";

grant references on table "public"."ticket_response" to "service_role";

grant select on table "public"."ticket_response" to "service_role";

grant trigger on table "public"."ticket_response" to "service_role";

grant truncate on table "public"."ticket_response" to "service_role";

grant update on table "public"."ticket_response" to "service_role";

grant delete on table "public"."training" to "anon";

grant insert on table "public"."training" to "anon";

grant references on table "public"."training" to "anon";

grant select on table "public"."training" to "anon";

grant trigger on table "public"."training" to "anon";

grant truncate on table "public"."training" to "anon";

grant update on table "public"."training" to "anon";

grant delete on table "public"."training" to "authenticated";

grant insert on table "public"."training" to "authenticated";

grant references on table "public"."training" to "authenticated";

grant select on table "public"."training" to "authenticated";

grant trigger on table "public"."training" to "authenticated";

grant truncate on table "public"."training" to "authenticated";

grant update on table "public"."training" to "authenticated";

grant delete on table "public"."training" to "service_role";

grant insert on table "public"."training" to "service_role";

grant references on table "public"."training" to "service_role";

grant select on table "public"."training" to "service_role";

grant trigger on table "public"."training" to "service_role";

grant truncate on table "public"."training" to "service_role";

grant update on table "public"."training" to "service_role";

grant delete on table "public"."training_in_progress" to "anon";

grant insert on table "public"."training_in_progress" to "anon";

grant references on table "public"."training_in_progress" to "anon";

grant select on table "public"."training_in_progress" to "anon";

grant trigger on table "public"."training_in_progress" to "anon";

grant truncate on table "public"."training_in_progress" to "anon";

grant update on table "public"."training_in_progress" to "anon";

grant delete on table "public"."training_in_progress" to "authenticated";

grant insert on table "public"."training_in_progress" to "authenticated";

grant references on table "public"."training_in_progress" to "authenticated";

grant select on table "public"."training_in_progress" to "authenticated";

grant trigger on table "public"."training_in_progress" to "authenticated";

grant truncate on table "public"."training_in_progress" to "authenticated";

grant update on table "public"."training_in_progress" to "authenticated";

grant delete on table "public"."training_in_progress" to "service_role";

grant insert on table "public"."training_in_progress" to "service_role";

grant references on table "public"."training_in_progress" to "service_role";

grant select on table "public"."training_in_progress" to "service_role";

grant trigger on table "public"."training_in_progress" to "service_role";

grant truncate on table "public"."training_in_progress" to "service_role";

grant update on table "public"."training_in_progress" to "service_role";

grant delete on table "public"."user" to "anon";

grant insert on table "public"."user" to "anon";

grant references on table "public"."user" to "anon";

grant select on table "public"."user" to "anon";

grant trigger on table "public"."user" to "anon";

grant truncate on table "public"."user" to "anon";

grant update on table "public"."user" to "anon";

grant delete on table "public"."user" to "authenticated";

grant insert on table "public"."user" to "authenticated";

grant references on table "public"."user" to "authenticated";

grant select on table "public"."user" to "authenticated";

grant trigger on table "public"."user" to "authenticated";

grant truncate on table "public"."user" to "authenticated";

grant update on table "public"."user" to "authenticated";

grant delete on table "public"."user" to "service_role";

grant insert on table "public"."user" to "service_role";

grant references on table "public"."user" to "service_role";

grant select on table "public"."user" to "service_role";

grant trigger on table "public"."user" to "service_role";

grant truncate on table "public"."user" to "service_role";

grant update on table "public"."user" to "service_role";



