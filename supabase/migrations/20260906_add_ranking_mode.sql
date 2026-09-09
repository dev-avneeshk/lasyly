-- Add ranking_mode to nba_player_rankings
ALTER TABLE public.nba_player_rankings ADD COLUMN ranking_mode TEXT NOT NULL DEFAULT 'projected';
ALTER TABLE public.nba_player_rankings DROP CONSTRAINT IF EXISTS chk_player_ranking_mode;
ALTER TABLE public.nba_player_rankings ADD CONSTRAINT chk_player_ranking_mode CHECK (ranking_mode IN ('historical', 'projected'));

DROP INDEX IF EXISTS public.idx_player_rankings_unique;
CREATE UNIQUE INDEX idx_player_rankings_unique ON public.nba_player_rankings (player_name, season, ranking_mode, ranking_type, ranking_version);

DROP INDEX IF EXISTS public.idx_player_rankings_rank_unique;
CREATE UNIQUE INDEX idx_player_rankings_rank_unique ON public.nba_player_rankings (season, ranking_mode, ranking_type, ranking_version, rank);


-- Add ranking_mode to nba_team_rankings
ALTER TABLE public.nba_team_rankings ADD COLUMN ranking_mode TEXT NOT NULL DEFAULT 'projected';
ALTER TABLE public.nba_team_rankings DROP CONSTRAINT IF EXISTS chk_team_ranking_mode;
ALTER TABLE public.nba_team_rankings ADD CONSTRAINT chk_team_ranking_mode CHECK (ranking_mode IN ('historical', 'projected'));

DROP INDEX IF EXISTS public.idx_team_rankings_unique;
CREATE UNIQUE INDEX idx_team_rankings_unique ON public.nba_team_rankings (team, season, ranking_mode, ranking_version, ranking_type);


-- Add ranking_mode to nba_ranking_history
ALTER TABLE public.nba_ranking_history ADD COLUMN ranking_mode TEXT NOT NULL DEFAULT 'projected';
ALTER TABLE public.nba_ranking_history DROP CONSTRAINT IF EXISTS chk_history_ranking_mode;
ALTER TABLE public.nba_ranking_history ADD CONSTRAINT chk_history_ranking_mode CHECK (ranking_mode IN ('historical', 'projected'));

DROP INDEX IF EXISTS public.idx_ranking_history_entity;
CREATE INDEX idx_ranking_history_entity ON public.nba_ranking_history (entity_id, season, ranking_mode, ranking_type);

DROP INDEX IF EXISTS public.idx_ranking_history_entity_name;
CREATE INDEX idx_ranking_history_entity_name ON public.nba_ranking_history (entity_name, season, ranking_mode, ranking_type);


-- Add ranking_mode to nba_ranking_versions
ALTER TABLE public.nba_ranking_versions ADD COLUMN ranking_mode TEXT NOT NULL DEFAULT 'projected';
ALTER TABLE public.nba_ranking_versions DROP CONSTRAINT IF EXISTS chk_version_ranking_mode;
ALTER TABLE public.nba_ranking_versions ADD CONSTRAINT chk_version_ranking_mode CHECK (ranking_mode IN ('historical', 'projected'));
