-- 独立 PostgreSQL 初始化（无 Supabase / 无 auth schema）
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES app_users (id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  username TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT profiles_username_format CHECK (
    char_length(username) BETWEEN 2 AND 32 AND username ~ '^[a-z_][a-z0-9_]*$'
  )
);

CREATE UNIQUE INDEX profiles_username_lower_key ON profiles (lower(username));

CREATE TABLE family_members (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  generation INTEGER,
  sibling_order INTEGER,
  father_id BIGINT REFERENCES family_members (id) ON DELETE SET NULL,
  gender TEXT CHECK (gender IN ('男', '女')),
  official_position TEXT,
  is_alive BOOLEAN NOT NULL DEFAULT TRUE,
  spouse_ids BIGINT[] NOT NULL DEFAULT '{}',
  is_married_in BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  birthday TEXT,
  death_date TEXT,
  residence_place TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_family_members_user_id ON family_members (user_id);
CREATE INDEX idx_family_members_father_id ON family_members (father_id);
CREATE INDEX idx_family_members_generation ON family_members (generation);
CREATE INDEX idx_family_members_name ON family_members (name);

CREATE TABLE blog_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  view_count INTEGER NOT NULL DEFAULT 0,
  hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, slug)
);

CREATE INDEX idx_blog_posts_user_id ON blog_posts (user_id);
CREATE INDEX idx_blog_posts_status ON blog_posts (status);
CREATE INDEX idx_blog_posts_created ON blog_posts (created_at);
CREATE INDEX idx_blog_posts_hash ON blog_posts (hash);
