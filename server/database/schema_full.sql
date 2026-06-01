--
-- PostgreSQL database dump
--

-- Dumped from database version 12.15
-- Dumped by pg_dump version 12.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: blind_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blind_templates (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name character varying(100) NOT NULL,
    stages jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blind_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blind_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blind_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blind_templates_id_seq OWNED BY public.blind_templates.id;


--
-- Name: change_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.change_logs (
    id integer NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id integer NOT NULL,
    entity_name character varying(200),
    action character varying(30) NOT NULL,
    changed_by integer,
    changed_by_name character varying(200),
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: change_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.change_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: change_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.change_logs_id_seq OWNED BY public.change_logs.id;


--
-- Name: event_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_templates (
    id integer NOT NULL,
    user_id integer,
    name character varying(100) NOT NULL,
    config jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: event_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_templates_id_seq OWNED BY public.event_templates.id;


--
-- Name: registration_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registration_logs (
    id integer NOT NULL,
    tournament_id integer,
    tournament_name character varying(150) NOT NULL,
    venue_id integer,
    venue_name character varying(150) NOT NULL,
    tournament_date timestamp without time zone,
    user_id integer,
    registrant_name character varying(100) NOT NULL,
    registrant_phone character varying(20),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: registration_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.registration_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: registration_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.registration_logs_id_seq OWNED BY public.registration_logs.id;


--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id integer NOT NULL,
    venue_id integer,
    name character varying(150) NOT NULL,
    description text,
    cost numeric(10,2) DEFAULT 0 NOT NULL,
    start_time timestamp without time zone NOT NULL,
    estimated_end_time timestamp without time zone,
    stages jsonb DEFAULT '[]'::jsonb,
    day_of_week integer,
    is_recurring boolean DEFAULT false,
    status character varying(20) DEFAULT 'pending'::character varying,
    rejection_reason text,
    created_by integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    is_boosted boolean DEFAULT false,
    boost_label character varying(50) DEFAULT ''::character varying,
    starting_stack integer,
    level_duration integer,
    re_entry character varying(20) DEFAULT NULL::character varying,
    late_reg_level integer,
    gtd integer,
    tournament_type character varying(20) DEFAULT 'live'::character varying NOT NULL,
    rake numeric(8,2) DEFAULT NULL::numeric,
    rake_type character varying(10) DEFAULT 'amount'::character varying,
    secondary_games jsonb DEFAULT '[]'::jsonb,
    platform character varying(50) DEFAULT NULL::character varying,
    game_type character varying(20) DEFAULT NULL::character varying,
    cash_sb integer,
    cash_bb integer,
    skipped_dates jsonb DEFAULT '[]'::jsonb
);


--
-- Name: tournaments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tournaments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tournaments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tournaments_id_seq OWNED BY public.tournaments.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255),
    phone character varying(20),
    role character varying(20) DEFAULT 'player'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts integer DEFAULT 0,
    is_locked boolean DEFAULT false,
    locked_at timestamp without time zone,
    email_verified boolean DEFAULT false,
    verification_token character varying(100),
    verification_expires timestamp without time zone,
    google_id character varying(255),
    auth_provider character varying(20) DEFAULT 'local'::character varying NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: venue_videos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venue_videos (
    id integer NOT NULL,
    venue_id integer,
    video_url text NOT NULL,
    title character varying(150) DEFAULT ''::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: venue_videos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venue_videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venue_videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venue_videos_id_seq OWNED BY public.venue_videos.id;


--
-- Name: venues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.venues (
    id integer NOT NULL,
    owner_id integer,
    name character varying(150) NOT NULL,
    address text,
    city character varying(100),
    whatsapp_number character varying(20) NOT NULL,
    description text,
    logo_url text,
    is_approved boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    venue_type character varying(20) DEFAULT 'physical'::character varying NOT NULL,
    club_number character varying(50),
    agent_number character varying(50)
);


--
-- Name: venues_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.venues_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: venues_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.venues_id_seq OWNED BY public.venues.id;


--
-- Name: blind_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blind_templates ALTER COLUMN id SET DEFAULT nextval('public.blind_templates_id_seq'::regclass);


--
-- Name: change_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_logs ALTER COLUMN id SET DEFAULT nextval('public.change_logs_id_seq'::regclass);


--
-- Name: event_templates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_templates ALTER COLUMN id SET DEFAULT nextval('public.event_templates_id_seq'::regclass);


--
-- Name: registration_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_logs ALTER COLUMN id SET DEFAULT nextval('public.registration_logs_id_seq'::regclass);


--
-- Name: tournaments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments ALTER COLUMN id SET DEFAULT nextval('public.tournaments_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: venue_videos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_videos ALTER COLUMN id SET DEFAULT nextval('public.venue_videos_id_seq'::regclass);


--
-- Name: venues id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues ALTER COLUMN id SET DEFAULT nextval('public.venues_id_seq'::regclass);


--
-- Name: blind_templates blind_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blind_templates
    ADD CONSTRAINT blind_templates_pkey PRIMARY KEY (id);


--
-- Name: change_logs change_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_logs
    ADD CONSTRAINT change_logs_pkey PRIMARY KEY (id);


--
-- Name: event_templates event_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_templates
    ADD CONSTRAINT event_templates_pkey PRIMARY KEY (id);


--
-- Name: registration_logs registration_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registration_logs
    ADD CONSTRAINT registration_logs_pkey PRIMARY KEY (id);


--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_google_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_google_id_key UNIQUE (google_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: venue_videos venue_videos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_videos
    ADD CONSTRAINT venue_videos_pkey PRIMARY KEY (id);


--
-- Name: venues venues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_pkey PRIMARY KEY (id);


--
-- Name: idx_blind_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blind_templates_user ON public.blind_templates USING btree (user_id);


--
-- Name: idx_change_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_logs_created ON public.change_logs USING btree (created_at DESC);


--
-- Name: idx_change_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_change_logs_entity ON public.change_logs USING btree (entity_type, entity_id);


--
-- Name: idx_event_templates_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_templates_user ON public.event_templates USING btree (user_id);


--
-- Name: idx_reg_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_logs_created ON public.registration_logs USING btree (created_at DESC);


--
-- Name: idx_reg_logs_tournament; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_logs_tournament ON public.registration_logs USING btree (tournament_id);


--
-- Name: idx_tournaments_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_start_time ON public.tournaments USING btree (start_time);


--
-- Name: idx_tournaments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_status ON public.tournaments USING btree (status);


--
-- Name: idx_tournaments_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tournaments_type ON public.tournaments USING btree (tournament_type);


--
-- Name: idx_venues_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_venues_owner ON public.venues USING btree (owner_id);


--
-- Name: blind_templates blind_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blind_templates
    ADD CONSTRAINT blind_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: change_logs change_logs_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.change_logs
    ADD CONSTRAINT change_logs_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: event_templates event_templates_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_templates
    ADD CONSTRAINT event_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tournaments tournaments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: tournaments tournaments_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: venue_videos venue_videos_venue_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venue_videos
    ADD CONSTRAINT venue_videos_venue_id_fkey FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;


--
-- Name: venues venues_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.venues
    ADD CONSTRAINT venues_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

