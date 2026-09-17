// Types for stats.js. The implementation is kept verbatim from the design handoff.
import type { Game, LogEntry, Outcome, Player, Position } from '../lib/types';

export interface SprayPoint {
  x: number;
  y: number;
  hit: boolean;
  outcome: Outcome;
}

export interface BattingLine {
  pa: number;
  ab: number;
  h: number;
  b2: number;
  b3: number;
  hr: number;
  bb: number;
  hbp: number;
  k: number;
  rbi: number;
  sf: number;
  tb: number;
  r: number;
  spray: SprayPoint[];
  contact: Record<'GB' | 'FB' | 'LD' | 'PU', number>;
  games: number;
  avg: number;
  obp: number;
  slg: number;
  bip: number;
  pull: number;
  center: number;
  oppo: number;
}

export interface TeamBattingLine {
  ab: number;
  h: number;
  bb: number;
  hbp: number;
  sf: number;
  k: number;
  avg: number;
  obp: number;
}

export interface LineScoreCell {
  v: string;
  cur: boolean;
}

export interface LineScore {
  innings: number[];
  us: LineScoreCell[];
  them: LineScoreCell[];
  hitsUs: number;
  hitsThem: number;
  errUs: number;
  errThem: number;
}

export interface SeasonRecord {
  w: number;
  l: number;
  t: number;
  rf: number;
  ra: number;
}

export type TopPerformer = BattingLine & { name: string };

export const HITS: Set<Outcome>;
export function usLog(g: Game, l: LogEntry): boolean;
export function themLog(g: Game, l: LogEntry): boolean;
export function batting(games: Game[], name: string): BattingLine;
export function fielding(games: Game[], pos: Position): { PO: number; A: number; E: number };
export function teamBatting(games: Game[]): TeamBattingLine;
export function lineScore(g: Game, n?: number): LineScore;
export function fmt3(v: number): string;
export function record(games: Game[]): SeasonRecord;
export function topPerformers(g: Game, roster?: Player[]): TopPerformer[];
export function sampleSeason(
  roster: Player[],
  opts?: { games?: number; seasons?: number; year?: number; seed?: number },
): Game[];
