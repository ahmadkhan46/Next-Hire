import { MatchStatus } from '@prisma/client';

export interface WorkflowRule {
  id: string;
  name: string;
  condition: (candidate: any, job: any) => boolean;
  action: MatchStatus;
  reason: string;
  priority: number;
}

export const WORKFLOW_RULES: WorkflowRule[] = [
  {
    id: 'auto-reject-critical',
    name: 'Auto-reject critical gaps',
    condition: (candidate) => (candidate.missingCritical?.length || 0) > 0,
    action: 'REJECTED',
    reason: 'Missing critical requirements',
    priority: 1,
  },
  {
    id: 'auto-shortlist-perfect',
    name: 'Auto-shortlist perfect matches',
    condition: (candidate) => 
      (candidate.score || 0) >= 0.95 && 
      (candidate.missingCritical?.length || 0) === 0,
    action: 'SHORTLISTED',
    reason: 'Perfect skill match with no critical gaps',
    priority: 2,
  },
  {
    id: 'flag-low-score',
    name: 'Flag low scoring candidates',
    condition: (candidate) => (candidate.score || 0) < 0.3,
    action: 'REJECTED',
    reason: 'Low overall skill match (<30%)',
    priority: 3,
  },
];

export function evaluateWorkflowRules(candidate: any, job: any): {
  suggestedStatus: MatchStatus;
  reason: string;
  appliedRule: string;
} | null {
  // Sort by priority and find first matching rule
  const sortedRules = WORKFLOW_RULES.sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    if (rule.condition(candidate, job)) {
      return {
        suggestedStatus: rule.action,
        reason: rule.reason,
        appliedRule: rule.name,
      };
    }
  }
  
  return null;
}

export interface StatusTransition {
  from: MatchStatus;
  to: MatchStatus;
  requiresReason: boolean;
  allowedBy: string[];
}

export const STATUS_TRANSITIONS: StatusTransition[] = [
  { from: 'NONE', to: 'SHORTLISTED', requiresReason: false, allowedBy: ['recruiter', 'admin'] },
  { from: 'NONE', to: 'REJECTED', requiresReason: true, allowedBy: ['recruiter', 'admin'] },
  { from: 'SHORTLISTED', to: 'REJECTED', requiresReason: true, allowedBy: ['recruiter', 'admin'] },
  { from: 'SHORTLISTED', to: 'NONE', requiresReason: false, allowedBy: ['admin'] },
  { from: 'REJECTED', to: 'NONE', requiresReason: false, allowedBy: ['admin'] },
  { from: 'REJECTED', to: 'SHORTLISTED', requiresReason: true, allowedBy: ['admin'] },
];

export function validateStatusTransition(
  from: MatchStatus,
  to: MatchStatus,
  reason?: string,
  userRole: string = 'recruiter'
): { valid: boolean; error?: string } {
  const transition = STATUS_TRANSITIONS.find(t => t.from === from && t.to === to);
  
  if (!transition) {
    return { valid: false, error: `Invalid transition from ${from} to ${to}` };
  }
  
  if (!transition.allowedBy.includes(userRole)) {
    return { valid: false, error: `Role ${userRole} cannot perform this transition` };
  }
  
  if (transition.requiresReason && (!reason || reason.trim().length < 5)) {
    return { valid: false, error: 'Reason required (minimum 5 characters)' };
  }
  
  return { valid: true };
}