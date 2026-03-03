export interface ComplianceReport {
  reportType: 'equal-opportunity' | 'gdpr-audit' | 'decision-transparency';
  generatedAt: string;
  orgId: string;
  period: {
    startDate: string;
    endDate: string;
  };
  summary: Record<string, any>;
  details: any[];
}

export function generateEqualOpportunityReport(
  decisions: any[],
  candidates: any[]
): ComplianceReport {
  void candidates;
  const now = new Date().toISOString();
  
  // Analyze decision patterns
  const decisionsByJob = decisions.reduce((acc, decision) => {
    const jobId = decision.jobId;
    if (!acc[jobId]) {
      acc[jobId] = { shortlisted: 0, rejected: 0, total: 0 };
    }
    acc[jobId][decision.toStatus.toLowerCase()]++;
    acc[jobId].total++;
    return acc;
  }, {});

  // Calculate selection rates
  const jobAnalysis = Object.entries(decisionsByJob).map(([jobId, stats]: [string, any]) => ({
    jobId,
    jobTitle: decisions.find(d => d.jobId === jobId)?.job?.title || 'Unknown',
    totalCandidates: stats.total,
    shortlistedCount: stats.shortlisted || 0,
    rejectedCount: stats.rejected || 0,
    selectionRate: stats.total > 0 ? Math.round((stats.shortlisted / stats.total) * 100) : 0,
  }));

  return {
    reportType: 'equal-opportunity',
    generatedAt: now,
    orgId: decisions[0]?.orgId || '',
    period: {
      startDate: decisions[0]?.createdAt || now,
      endDate: now,
    },
    summary: {
      totalDecisions: decisions.length,
      totalJobs: Object.keys(decisionsByJob).length,
      averageSelectionRate: jobAnalysis.length > 0 
        ? Math.round(jobAnalysis.reduce((sum, job) => sum + job.selectionRate, 0) / jobAnalysis.length)
        : 0,
      automatedDecisions: decisions.filter(d => d.note?.includes('Automated:')).length,
    },
    details: jobAnalysis,
  };
}

export function generateGDPRAuditReport(
  candidates: any[],
  decisions: any[]
): ComplianceReport {
  const now = new Date().toISOString();
  
  // Data processing analysis
  const dataProcessing = {
    candidatesWithEmail: candidates.filter(c => c.email).length,
    candidatesWithPhone: candidates.filter(c => c.phone).length,
    skillsExtracted: candidates.reduce((sum, c) => sum + (c.skills?.length || 0), 0),
    decisionsLogged: decisions.length,
  };

  // Retention analysis
  const oldestCandidate = candidates.reduce((oldest, candidate) => {
    const candidateDate = new Date(candidate.createdAt);
    const oldestDate = new Date(oldest.createdAt || now);
    return candidateDate < oldestDate ? candidate : oldest;
  }, { createdAt: now });

  const retentionDays = Math.floor(
    (new Date().getTime() - new Date(oldestCandidate.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    reportType: 'gdpr-audit',
    generatedAt: now,
    orgId: candidates[0]?.orgId || '',
    period: {
      startDate: oldestCandidate.createdAt,
      endDate: now,
    },
    summary: {
      totalCandidates: candidates.length,
      dataRetentionDays: retentionDays,
      personalDataFields: ['fullName', 'email', 'phone', 'skills'],
      ...dataProcessing,
    },
    details: candidates.map(candidate => ({
      candidateId: candidate.id,
      fullName: candidate.fullName,
      hasEmail: !!candidate.email,
      hasPhone: !!candidate.phone,
      skillsCount: candidate.skills?.length || 0,
      createdAt: candidate.createdAt,
      lastDecision: decisions
        .filter(d => d.candidateId === candidate.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt,
    })),
  };
}

export function generateDecisionTransparencyReport(
  decisions: any[]
): ComplianceReport {
  const now = new Date().toISOString();
  
  // Decision reasoning analysis
  const reasoningAnalysis = {
    withReason: decisions.filter(d => d.note && d.note.trim().length > 0).length,
    automated: decisions.filter(d => d.note?.includes('Automated:')).length,
    manual: decisions.filter(d => d.note && !d.note.includes('Automated:')).length,
    noReason: decisions.filter(d => !d.note || d.note.trim().length === 0).length,
  };

  // Common rejection reasons
  const rejectionReasons = decisions
    .filter(d => d.toStatus === 'REJECTED' && d.note)
    .reduce((acc, decision) => {
      const reason = decision.note.toLowerCase();
      if (reason.includes('critical')) acc.critical++;
      else if (reason.includes('skill')) acc.skillMismatch++;
      else if (reason.includes('experience')) acc.experience++;
      else acc.other++;
      return acc;
    }, { critical: 0, skillMismatch: 0, experience: 0, other: 0 });

  return {
    reportType: 'decision-transparency',
    generatedAt: now,
    orgId: decisions[0]?.orgId || '',
    period: {
      startDate: decisions[0]?.createdAt || now,
      endDate: now,
    },
    summary: {
      totalDecisions: decisions.length,
      transparencyRate: decisions.length > 0 
        ? Math.round((reasoningAnalysis.withReason / decisions.length) * 100)
        : 0,
      ...reasoningAnalysis,
      rejectionReasons,
    },
    details: decisions.map(decision => ({
      decisionId: decision.id,
      candidateName: decision.candidate?.fullName,
      jobTitle: decision.job?.title,
      fromStatus: decision.fromStatus,
      toStatus: decision.toStatus,
      hasReason: !!decision.note,
      reasonLength: decision.note?.length || 0,
      isAutomated: decision.note?.includes('Automated:') || false,
      createdAt: decision.createdAt,
      decidedBy: decision.decidedBy,
    })),
  };
}

export function exportComplianceReport(report: ComplianceReport, format: 'json' | 'csv' = 'json') {
  const filename = `${report.reportType}-${report.orgId}-${new Date().toISOString().split('T')[0]}`;
  
  if (format === 'json') {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${filename}.json`);
  } else {
    const csv = convertReportToCSV(report);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `${filename}.csv`);
  }
}

function convertReportToCSV(report: ComplianceReport): string {
  const headers = ['Metric', 'Value'];
  const rows = [headers.join(',')];
  
  // Add summary data
  Object.entries(report.summary).forEach(([key, value]) => {
    rows.push(`"${key}","${value}"`);
  });
  
  return rows.join('\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
