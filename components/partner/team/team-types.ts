/**
 * Finition 1 (E-13) — forme de la réponse de GET /api/partner/team (RPC partner_team_view), lue par TeamPanel. Rien
 * n'est calculé à l'écran : états, dates, comptages et portes viennent du serveur.
 */
export type AccountState = 'ACTIVE' | 'PENDING_ACTIVATION' | 'SUSPENDED';
export type InvitationState = 'PENDING' | 'EXPIRED' | 'DECLINED' | 'CANCELLED';

/** Catégorie admise par une porte, avec sa couleur au contrôle (palette fermée du scanner, ou null). */
export interface TeamCategory { name: string; scan_color: string | null }

export interface TeamGate { id: string; name: string; zone_name: string; categories: TeamCategory[] }

export interface TeamAssignment {
    assignment_id: string;
    event_id: string;
    title: string;
    status: string;
    start_at: string | null;
    past: boolean;
    gate: TeamGate | null;
    has_zones: boolean;
    gate_change_allowed: boolean;
    entry_point: string | null;
    can_accept_cash: boolean;
    open_shift: boolean;
    entries: number;
    last_scan_at: string | null;
}

export interface TeamMember {
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    account_state: AccountState;
    active_since: string | null;
    activation: { sent_at: string; expires_at: string } | null;
    other_organizers: boolean;
    assignments: TeamAssignment[];
}

export interface TeamInvitation {
    id: string;
    state: InvitationState;
    phone_entered: string | null;
    display_name: string;
    created_at: string;
    last_sent_at: string;
    expires_at: string;
    responded_at: string | null;
    send_count: number;
    events: Array<{ id: string; title: string; start_at: string | null; assignable: boolean }>;
}

export interface TeamEvent {
    id: string;
    title: string;
    status: string;
    start_at: string | null;
    assignable: boolean;
    past: boolean;
    has_zones: boolean;
    gates: TeamGate[];
    /** Complément 9 : catégories en vente qu'aucune porte ne laisse entrer (événement à zones). */
    uncovered_categories: TeamCategory[];
    /** Complément 9 : portes sans contrôleur. */
    gates_without_controller: string[];
}

export interface TeamView {
    ok: true;
    partner_id: string;
    partner_name: string | null;
    can_manage: boolean;
    acts_as_admin: boolean;
    event: { id: string; title: string; status: string; start_at: string | null; assignable: boolean; has_zones: boolean } | null;
    members: TeamMember[];
    invitations: TeamInvitation[];
    events: TeamEvent[];
    counts: { members: number; ready: number; pending: number; without_gate: number; to_follow_up: number };
}

export type TeamScope = 'all' | 'event';
