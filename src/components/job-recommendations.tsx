'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sparkles, MapPin, TrendingUp, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface JobRecommendation {
  id: string;
  title: string;
  location: string | null;
  status: string;
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  criticalGaps: string[];
  matchStatus: string;
}

interface JobRecommendationsProps {
  orgId: string;
  candidateId: string;
  jobs: JobRecommendation[];
}

export function JobRecommendations({ orgId, candidateId, jobs }: JobRecommendationsProps) {
  void candidateId;
  const sortedJobs = [...jobs].sort((a, b) => b.score - a.score);
  const topJobs = sortedJobs.slice(0, 5);
  const bestFit = topJobs.filter(j => j.score >= 0.9);

  return (
    <Card className="premium-block relative overflow-hidden rounded-3xl border border-slate-300 bg-gradient-to-br from-white via-white/90 to-slate-50 p-6 shadow-[0_26px_60px_-32px_rgba(15,23,42,0.4)]">
      <div className="pointer-events-none absolute -top-24 right-10 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Job Recommendations</div>
            <div className="text-lg font-semibold">Best Matches</div>
          </div>
        </div>
        
        {bestFit.length > 0 && (
          <Badge variant="secondary" className="rounded-full">
            <Sparkles className="h-3 w-3 mr-1" />
            {bestFit.length} Perfect Match{bestFit.length > 1 ? 'es' : ''}
          </Badge>
        )}
      </div>

      <Separator className="my-4" />

      {topJobs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No job matches yet</p>
          <p className="text-xs mt-1">Add skills to see recommendations</p>
        </div>
      ) : (
        <div className="space-y-3">
          {topJobs.map((job) => (
            <div
              key={job.id}
              className="premium-subblock relative overflow-hidden rounded-2xl border border-slate-300/80 bg-white/70 p-4 shadow-[0_18px_30px_-30px_rgba(15,23,42,0.35)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold">{job.title}</h4>
                    {job.score >= 0.9 && (
                      <Badge variant="secondary" className="rounded-full text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Best Fit
                      </Badge>
                    )}
                    {job.status === 'OPEN' && (
                      <Badge variant="outline" className="rounded-full text-xs bg-green-50 text-green-700 border-green-200">
                        Open
                      </Badge>
                    )}
                  </div>
                  
                  {job.location && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <MapPin className="h-3 w-3" />
                      {job.location}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="font-semibold text-slate-900">
                        {Math.round(job.score * 100)}%
                      </div>
                      <span className="text-muted-foreground">match</span>
                    </div>
                    
                    {job.matchedSkills.length > 0 && (
                      <div className="text-green-600">
                        {job.matchedSkills.length} skills matched
                      </div>
                    )}
                    
                    {job.criticalGaps.length > 0 && (
                      <div className="flex items-center gap-1 text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {job.criticalGaps.length} critical gap{job.criticalGaps.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>

                  {job.matchedSkills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.matchedSkills.slice(0, 5).map((skill, i) => (
                        <Badge key={i} variant="outline" className="rounded-full text-xs bg-green-50 text-green-700 border-green-200">
                          {skill}
                        </Badge>
                      ))}
                      {job.matchedSkills.length > 5 && (
                        <Badge variant="outline" className="rounded-full text-xs">
                          +{job.matchedSkills.length - 5} more
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Link href={`/orgs/${orgId}/matchboard?jobId=${job.id}`}>
                    <Button size="sm" variant="outline" className="rounded-2xl w-full">
                      View Match
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {jobs.length > 5 && (
            <Link href={`/orgs/${orgId}/jobs`}>
              <Button variant="outline" className="w-full rounded-2xl">
                View All {jobs.length} Jobs
              </Button>
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
