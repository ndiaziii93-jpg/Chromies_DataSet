/** The scorebook document. Mirrors the prototype's localStorage shape exactly. */

export type Theme = 'light' | 'dark';
export type Half = 'top' | 'bottom';
export type Mode = 'full' | 'score_only';
export type GameStatus = 'in_progress' | 'final';

export type Outcome =
  | '1B' | '2B' | '3B' | 'HR'
  | 'BB' | 'HBP' | 'E' | 'FC'
  | 'K' | 'GO' | 'FO' | 'LO' | 'PO' | 'SF' | 'DP';

export type Contact = 'GB' | 'FB' | 'LD' | 'PU' | 'none';

/** Slowpitch fielding slots, plus the two non-fielding assignments. */
export type Position =
  | 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'LC' | 'RC' | 'RF'
  | 'EH' | 'UT';

export interface Player {
  id: string;
  num: string;
  name: string;
  pos: Position;
  /** In the batting order for new games. */
  bat: boolean;
}

export interface OppBatter {
  num: string;
  name: string;
}

/** A batted/charged plate appearance. */
export interface PlayLog {
  inning: number;
  half: Half;
  batter: string;
  outcome: Outcome;
  contact: Contact;
  fieldX?: number;
  fieldY?: number;
  fielder?: string;
  attr: { PO?: string; A?: string; E?: string };
  runs: string[];
  rbi: number;
  outsBefore: number;
  basesBefore: (string | null)[];
  basesAfter: (string | null)[];
  scoreOnly?: undefined;
  manager?: undefined;
}

/** Opposition half scored without positioning data. */
export interface ScoreOnlyLog {
  inning: number;
  half: Half;
  scoreOnly: true;
  runs: number;
  manager?: undefined;
}

/** A manager move (pinch hit, reorder), written to the log for the record. */
export interface ManagerLog {
  inning: number;
  half: Half;
  manager: true;
  note: string;
  scoreOnly?: undefined;
}

export type LogEntry = PlayLog | ScoreOnlyLog | ManagerLog;

export interface Game {
  id: string;
  opp: string;
  date: number;
  inning: number;
  half: Half;
  outs: number;
  bases: (string | null)[];
  score: { us: number; them: number };
  log: LogEntry[];
  /** Undo stack. Client-only — never synced or persisted to the server. */
  history?: Game[];
  pending: { outcome: Outcome } | null;
  batterIdx: number;
  oppBatter: string | null;
  lineup: string[];
  mode: Mode;
  weBatFirst: boolean;
  startedAt: number;
  timeLimitMins: number;
  status: GameStatus;
  oppLineup?: OppBatter[];
  oppIdx?: number;
  lob?: number;
  sample?: boolean;
}

export interface Settings {
  timeLimit: number;
  theme?: Theme;
}

export interface ScorebookData {
  roster: Player[];
  oppLineup: OppBatter[];
  oppTeam?: string;
  games: Game[];
  activeId: string | null;
  settings: Settings;
}

export type Tab = 'today' | 'live' | 'games' | 'players' | 'trends' | 'manage';
export type SidePanel = 'score' | 'lineup' | 'manager';
export type RangeKey = '5' | '10' | 'weekend' | 'season' | 'last' | 'all';
export type SprayFilter = 'all' | 'hits' | 'outs';
