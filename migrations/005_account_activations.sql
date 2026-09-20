-- ==========================================================
-- ACTIVACION DE CUENTAS
-- ==========================================================
--
-- Guarda unicamente el HASH del token de activacion,
-- nunca el token en crudo (mismo criterio que
-- password_reset_requests y las invitaciones de proyecto).
--
-- El token en crudo solo existe en memoria, dentro del
-- backend, el tiempo justo para meterlo en el correo.

create table if not exists account_activations (
  id bigserial primary key,

  user_id uuid not null references auth.users(id) on delete cascade,

  email text not null,

  token_hash text not null,

  expires_at timestamptz not null,

  used_at timestamptz,

  created_at timestamptz not null default now()
);

-- Acelera la busqueda por hash al validar el token.
create index if not exists account_activations_token_hash_idx
  on account_activations (token_hash);

-- Acelera "invalidar tokens anteriores de este usuario"
-- cuando el admin reenvia la activacion.
create index if not exists account_activations_user_id_idx
  on account_activations (user_id);

-- Mismo criterio de seguridad que las demas tablas internas:
-- RLS activo, sin policies. Solo el backend (service role,
-- que ignora RLS) puede leer o escribir aqui.
alter table account_activations enable row level security;
