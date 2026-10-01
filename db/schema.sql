create table users (
  id bigint generated always as identity primary key,
  username text not null unique,
  pass_hash text not null,
  failed int not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table sessions (
  token_hash bytea primary key,
  user_id bigint not null references users (id) on delete cascade,
  expires_at timestamptz not null
);

create table months (
  user_id bigint not null references users (id) on delete cascade,
  month char(7) not null,
  -- null marks a deleted month, so other devices pick up the delete
  data bytea,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

-- data is gzipped by the client; skip Postgres's own compression attempt.
alter table months alter column data set storage external;
