import type { Role } from './supabase';

/**
 * What each passcode unlocks. Mirrors the row-level security policies in
 * supabase/migrations — the client hides what the server would refuse anyway.
 */
export type Capability =
  | 'score'         // live scoring, undo, end half/game, manager moves
  | 'startGame'     // create a game from Today
  | 'editOpponent'  // the Bad Guys tab
  | 'editRoster'    // the Chromies roster and batting order
  | 'editSettings'  // appearance + default time limit
  | 'editData'      // export / import / sample season / reset
  | 'deleteGame';

const CAPABILITIES: Record<Role, Capability[]> = {
  manager: ['score', 'startGame', 'editOpponent', 'editRoster', 'editSettings', 'editData', 'deleteGame'],
  scorer: ['score', 'startGame', 'editOpponent'],
  viewer: [],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

/** Manage is hidden entirely from viewers; scorers see only Bad Guys inside it. */
export function seesManageTab(role: Role): boolean {
  return can(role, 'editOpponent') || can(role, 'editRoster');
}

export const ROLE_LABEL: Record<Role, string> = {
  manager: 'MANAGER',
  scorer: 'SCORER',
  viewer: 'VIEWER',
};
