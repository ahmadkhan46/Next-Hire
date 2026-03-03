import { sanitizeHtml } from './security';

export interface CommunicationTemplate {
  id: string;
  name: string;
  trigger: 'SHORTLISTED' | 'REJECTED' | 'INTERVIEW_SCHEDULED';
  subject: string;
  body: string;
  variables: string[];
}

export const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    id: 'shortlist-notification',
    name: 'Shortlist Notification',
    trigger: 'SHORTLISTED',
    subject: 'Great news about your application for {{jobTitle}}',
    body: `Hi {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}}.

We're pleased to inform you that your application has been shortlisted for further review. Your skills in {{topSkills}} particularly caught our attention.

Our team will be in touch within the next few days to discuss next steps.

Best regards,
{{recruiterName}}
{{companyName}} Talent Team`,
    variables: ['candidateName', 'jobTitle', 'companyName', 'topSkills', 'recruiterName'],
  },
  {
    id: 'rejection-notification',
    name: 'Rejection Notification',
    trigger: 'REJECTED',
    subject: 'Update on your application for {{jobTitle}}',
    body: `Hi {{candidateName}},

Thank you for your interest in the {{jobTitle}} position at {{companyName}}.

After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current requirements.

We were particularly impressed by your {{strongSkills}} and encourage you to apply for future opportunities that may be a better fit.

Best regards,
{{recruiterName}}
{{companyName}} Talent Team`,
    variables: ['candidateName', 'jobTitle', 'companyName', 'strongSkills', 'recruiterName'],
  },
];

export function generateCommunication(
  templateId: string,
  variables: Record<string, string>
): { subject: string; body: string } | null {
  const template = COMMUNICATION_TEMPLATES.find(t => t.id === templateId);
  if (!template) return null;

  let subject = template.subject;
  let body = template.body;

  // Replace variables with sanitized values
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`;
    const sanitized = sanitizeHtml(value);
    subject = subject.replace(new RegExp(placeholder, 'g'), sanitized);
    body = body.replace(new RegExp(placeholder, 'g'), sanitized);
  });

  return { subject, body };
}

export function extractCandidateVariables(candidate: any, job: any): Record<string, string> {
  const topSkills = (candidate.matched || []).slice(0, 3).join(', ');
  const strongSkills = (candidate.matched || []).slice(0, 2).join(' and ');

  return {
    candidateName: candidate.fullName || 'Candidate',
    jobTitle: job.title || 'Position',
    companyName: 'Your Company', // Would come from org settings
    topSkills: topSkills || 'your background',
    strongSkills: strongSkills || 'your experience',
    recruiterName: 'Hiring Team', // Would come from user context
  };
}