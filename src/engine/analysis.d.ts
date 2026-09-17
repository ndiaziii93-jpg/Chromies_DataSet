// Types for analysis.js. The implementation is kept verbatim from the design handoff.
import type { Game, Player } from '../lib/types';

export interface PlayerAnalysis {
  contribution: string[];
  strengths: string[];
  trends: string[];
  note?: string;
}

export interface GameAnalysis {
  headline: string;
  summary: string[];
  turning: string[];
  performers: string[];
  defense: string[];
}

export interface PlayerGameAnalysis {
  headline: string;
  lines: string[];
}

export function playerAnalysis(games: Game[], player: Player, roster: Player[]): PlayerAnalysis;
export function gameAnalysis(g: Game, roster: Player[], allGames?: Game[]): GameAnalysis;
export function playerGameAnalysis(g: Game, player: Player, allGames?: Game[]): PlayerGameAnalysis;
