create table if not exists roles (
  id varchar(100) primary key,
  name varchar(255) not null,
  risk_owner varchar(255) not null,
  business_exposure text not null
);

create table if not exists workers (
  id varchar(100) primary key,
  role_id varchar(100) not null,
  name varchar(255) not null,
  tenure varchar(100),
  assessment_score int,
  training_precision int,
  constraint fk_workers_role foreign key (role_id) references roles(id)
);

create table if not exists skills (
  id bigint auto_increment primary key,
  role_id varchar(100) not null,
  skill varchar(255) not null,
  required_level int not null,
  current_level int not null,
  risk_type varchar(100) not null,
  weight int not null,
  evidence text,
  unique key uq_skills_role_skill (role_id, skill),
  constraint fk_skills_role foreign key (role_id) references roles(id)
);

create table if not exists knowledge_documents (
  id bigint auto_increment primary key,
  source varchar(255) not null,
  title varchar(255) not null,
  body longtext not null,
  tags json,
  approved_by varchar(255),
  approved_at datetime,
  unique key uq_knowledge_source_title (source, title)
);

create table if not exists worker_sessions (
  session_id varchar(100) primary key,
  role_id varchar(100),
  role_name varchar(255),
  worker_id varchar(100),
  worker_name varchar(255),
  shift_context varchar(255),
  purpose text,
  login_time datetime default current_timestamp,
  logout_time datetime null
);

create table if not exists worker_activity_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  event varchar(100) not null,
  session_id varchar(100),
  user_role varchar(100),
  user_id varchar(100),
  role_id varchar(100),
  role_name varchar(255),
  worker_id varchar(100),
  worker_name varchar(255),
  purpose text,
  question text,
  target_view varchar(100),
  details text,
  shift_context varchar(255)
);

create table if not exists ai_audit_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  request_id varchar(100) not null,
  user_id varchar(100) not null,
  user_role varchar(100) not null,
  role_name varchar(255),
  worker_name varchar(255),
  source varchar(255),
  confidence varchar(100),
  requires_human_review boolean default false,
  matched_terms json
);

create table if not exists feedback_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  feedback_id varchar(100) not null,
  answer_id varchar(100),
  rating varchar(100) not null,
  comment text,
  user_id varchar(100),
  user_role varchar(100)
);

create table if not exists approval_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  approval_id varchar(100) not null,
  type varchar(100) not null,
  status varchar(100) not null,
  comment text,
  user_id varchar(100),
  user_role varchar(100)
);

create table if not exists supervisor_evidence_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  session_id varchar(100),
  supervisor_role varchar(100),
  worker_id varchar(100) not null,
  worker_name varchar(255),
  role_id varchar(100),
  role_name varchar(255),
  skill varchar(255) not null,
  observation text not null,
  outcome varchar(100) not null
);

create table if not exists training_loop_log (
  id bigint auto_increment primary key,
  created_at datetime default current_timestamp,
  worker_id varchar(100) not null,
  role_id varchar(100),
  role_name varchar(255),
  skill varchar(255),
  stage varchar(100) not null,
  note text
);

create index idx_ai_audit_created_at on ai_audit_log(created_at);
create index idx_feedback_answer_id on feedback_log(answer_id);
create index idx_worker_activity_worker on worker_activity_log(worker_id, created_at);
create index idx_worker_sessions_worker on worker_sessions(worker_id, login_time);
create index idx_evidence_worker on supervisor_evidence_log(worker_id, created_at);
create index idx_training_loop_worker on training_loop_log(worker_id, created_at);
create index idx_approval_created_at on approval_log(created_at);
