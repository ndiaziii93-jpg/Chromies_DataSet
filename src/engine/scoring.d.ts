// Types for scoring.js. The implementation is kept verbatim from the design handoff.
import type { Game, Outcome, Position, Mode, Contact } from '../lib/types';

export const OUTCOMES: { hits: Outcome[]; onBase: Outcome[]; outs: Outcome[] };
export const NO_FIELD: Set<Outcome>;
export const LABEL: Record<Outcome, string>;

export interface Fielder {
  pos: Position;
  x: number;
  y: number;
}
export const FIELDERS: Fielder[];
export const BASE_XY: { x: number; y: number }[];

export function newGame(
  lineup: string[],
  opts?: { weBatFirst?: boolean; startedAt?: number; timeLimitMins?: number },
): Game;
export function weAreBatting(g: Game): boolean;
export function undo(g: Game): Game;
export function inferFielder(x: number, y: number): Position;
export function inferContact(outcome: Outcome, y: number): Contact;
export function attribution(
  outcome: Outcome,
  contact: Contact | null,
  fielder: string | undefined,
): { PO?: string; A?: string; E?: string };
export function recordOutcome(g: Game, outcome: Outcome): Game;
export function recordField(g: Game, x: number, y: number): Game;
export function cancelPending(g: Game): Game;
export function endHalf(g: Game): Game;
export function scoreOnlyRun(g: Game, delta: number): Game;
export function scoreOnlyOut(g: Game): Game;
export function moveRunner(g: Game, baseIdx: number): Game;
export function setOppBatter(g: Game, num: string): Game;
export function managerMove(g: Game, note: string, lineup?: string[]): Game;
export function setMode(g: Game, mode: Mode): Game;
export function endGame(g: Game): Game;
export function elapsed(g: Game, now?: number): string;
export function timeLeft(g: Game, now?: number): string;
export function ordinal(n: number): string;
