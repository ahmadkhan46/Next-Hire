'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Users, Search, TrendingUp, TrendingDown, Minus, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Candidate {
  id: string;
  fullName: string;
  email: string | null;
  currentTitle: string | null;
  yearsOfExperience: number | null;
  location: string | null;
  skills: string[];
  avgMatchScore: number;
  projectsCount?: number;
  educationsCount?: number;
  experiencesCount?: number;
}

interface CandidateComparisonProps {
  orgId: string;
  currentCandidate: Candidate;
}

export function CandidateComparison({ orgId, currentCandidate }: CandidateComparisonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `/api/orgs/${orgId}/candidates?search=${encodeURIComponent(search)}&limit=10&view=compare`
      );
      if (!res.ok) throw new Error('Search failed');
      
      const data = await res.json();
      setCandidates(data.candidates.filter((c: Candidate) => c.id !== currentCandidate.id));
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const compareSkills = () => {
    if (!selectedCandidate) return { shared: [], onlyA: [], onlyB: [] };
    
    const skillsA = new Set(currentCandidate.skills);
    const skillsB = new Set(selectedCandidate.skills);
    
    const shared = currentCandidate.skills.filter(s => skillsB.has(s));
    const onlyA = currentCandidate.skills.filter(s => !skillsB.has(s));
    const onlyB = selectedCandidate.skills.filter(s => !skillsA.has(s));
    
    return { shared, onlyA, onlyB };
  };

  const { shared, onlyA, onlyB } = selectedCandidate ? compareSkills() : { shared: [], onlyA: [], onlyB: [] };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-2xl">
          <Users className="h-4 w-4 mr-2" />
          Compare
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto inner-scroll rounded-3xl">
        <DialogHeader>
          <DialogTitle>Compare Candidates</DialogTitle>
        </DialogHeader>

        {!selectedCandidate ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Search candidates by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="rounded-2xl"
              />
              <Button onClick={handleSearch} disabled={loading} className="rounded-2xl">
                <Search className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              {candidates.map((candidate) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidate(candidate)}
                  className="w-full text-left p-4 rounded-2xl border hover:bg-accent transition"
                >
                  <div className="font-semibold">{candidate.fullName}</div>
                  <div className="text-sm text-muted-foreground">
                    {candidate.currentTitle || 'No title'} • {candidate.skills.length} skills
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">Comparing with</div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCandidate(null)}
                className="rounded-2xl"
              >
                Change
              </Button>
            </div>

            {/* Header Comparison */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="premium-subblock rounded-2xl border bg-white/70 p-4">
                <div className="font-semibold">{currentCandidate.fullName}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {currentCandidate.currentTitle || 'No title'}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {currentCandidate.location || 'Location not specified'}
                </div>
              </div>

              <div className="premium-subblock rounded-2xl border bg-white/70 p-4">
                <div className="font-semibold">{selectedCandidate.fullName}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {selectedCandidate.currentTitle || 'No title'}
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {selectedCandidate.location || 'Location not specified'}
                </div>
              </div>
            </div>

            <Separator />

            {/* Experience Comparison */}
            <div>
              <h4 className="font-semibold mb-3">Experience</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="text-center p-4 rounded-2xl border">
                  <div className="text-2xl font-bold">
                    {currentCandidate.yearsOfExperience || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">years</div>
                </div>
                <div className="text-center p-4 rounded-2xl border">
                  <div className="text-2xl font-bold">
                    {selectedCandidate.yearsOfExperience || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">years</div>
                  {(selectedCandidate.yearsOfExperience || 0) > (currentCandidate.yearsOfExperience || 0) && (
                    <TrendingUp className="h-4 w-4 text-green-600 mx-auto mt-1" />
                  )}
                  {(selectedCandidate.yearsOfExperience || 0) < (currentCandidate.yearsOfExperience || 0) && (
                    <TrendingDown className="h-4 w-4 text-red-600 mx-auto mt-1" />
                  )}
                  {(selectedCandidate.yearsOfExperience || 0) === (currentCandidate.yearsOfExperience || 0) && (
                    <Minus className="h-4 w-4 text-gray-600 mx-auto mt-1" />
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Profile Completeness */}
            <div>
              <h4 className="font-semibold mb-3">Profile depth</h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Experience</div>
                  <div className="mt-1 text-lg font-semibold">
                    {(currentCandidate.experiencesCount ?? 0)} vs {(selectedCandidate.experiencesCount ?? 0)}
                  </div>
                </div>
                <div className="rounded-2xl border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Education</div>
                  <div className="mt-1 text-lg font-semibold">
                    {(currentCandidate.educationsCount ?? 0)} vs {(selectedCandidate.educationsCount ?? 0)}
                  </div>
                </div>
                <div className="rounded-2xl border p-3 text-center">
                  <div className="text-xs text-muted-foreground">Projects</div>
                  <div className="mt-1 text-lg font-semibold">
                    {(currentCandidate.projectsCount ?? 0)} vs {(selectedCandidate.projectsCount ?? 0)}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Skills Comparison */}
            <div>
              <h4 className="font-semibold mb-3">Skills Analysis</h4>
              
              <div className="space-y-4">
                {/* Shared Skills */}
                {shared.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Shared Skills ({shared.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {shared.map((skill, i) => (
                        <Badge key={i} variant="outline" className="rounded-full bg-green-50 text-green-700 border-green-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Only Current Candidate */}
                {onlyA.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium">Only {currentCandidate.fullName.split(' ')[0]} ({onlyA.length})</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {onlyA.map((skill, i) => (
                        <Badge key={i} variant="outline" className="rounded-full bg-blue-50 text-blue-700 border-blue-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Only Selected Candidate */}
                {onlyB.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="text-sm font-medium">Only {selectedCandidate.fullName.split(' ')[0]} ({onlyB.length})</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {onlyB.map((skill, i) => (
                        <Badge key={i} variant="outline" className="rounded-full bg-purple-50 text-purple-700 border-purple-200">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Match Score Comparison */}
            <div>
              <h4 className="font-semibold mb-3">Average Match Score</h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="text-center p-4 rounded-2xl border">
                  <div className="text-2xl font-bold">
                    {Math.round(currentCandidate.avgMatchScore * 100)}%
                  </div>
                </div>
                <div className="text-center p-4 rounded-2xl border">
                  <div className="text-2xl font-bold">
                    {Math.round(selectedCandidate.avgMatchScore * 100)}%
                  </div>
                  {selectedCandidate.avgMatchScore > currentCandidate.avgMatchScore && (
                    <TrendingUp className="h-4 w-4 text-green-600 mx-auto mt-1" />
                  )}
                  {selectedCandidate.avgMatchScore < currentCandidate.avgMatchScore && (
                    <TrendingDown className="h-4 w-4 text-red-600 mx-auto mt-1" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

