"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Zap, Eye, CheckCircle, XCircle, Clock } from "lucide-react";

interface WorkflowResult {
  candidateId: string;
  candidateName: string;
  currentStatus: string;
  suggestedStatus: string;
  reason: string;
  appliedRule: string;
  score: number;
}

interface WorkflowResponse {
  jobId: string;
  jobTitle: string;
  totalMatches: number;
  rulesApplied: number;
  dryRun: boolean;
  results: WorkflowResult[];
}

export function WorkflowAutomation({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<WorkflowResponse | null>(null);
  const [applied, setApplied] = useState<WorkflowResponse | null>(null);

  const runWorkflow = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });

      const data = await response.json();
      
      if (dryRun) {
        setPreview(data);
      } else {
        setApplied(data);
        setPreview(null);
      }
    } catch (error) {
      console.error('Workflow failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setPreview(null);
    setApplied(null);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Zap className="h-4 w-4" />
          Auto Workflow
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Automated Workflow Rules
          </DialogTitle>
        </DialogHeader>

        {applied ? (
          <div className="space-y-4">
            <Card className="p-4 bg-green-50 border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium">Workflow Applied Successfully</span>
              </div>
              <div className="mt-2 text-sm text-green-700">
                Applied {applied.rulesApplied} automated decisions to {applied.totalMatches} candidates
              </div>
            </Card>

            {applied.results.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto inner-scroll">
                {applied.results.map((result, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{result.candidateName}</div>
                      <div className="text-sm text-muted-foreground">{result.reason}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{result.score}%</Badge>
                      <Badge variant={result.suggestedStatus === 'SHORTLISTED' ? 'default' : 'destructive'}>
                        {result.suggestedStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button onClick={resetDialog} className="w-full">
              Done
            </Button>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Preview Mode</span>
              </div>
              <div className="mt-2 text-sm text-blue-700">
                Found {preview.rulesApplied} candidates that match automation rules out of {preview.totalMatches} total
              </div>
            </Card>

            {preview.results.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto inner-scroll">
                {preview.results.map((result, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{result.candidateName}</div>
                      <div className="text-sm text-muted-foreground">{result.reason}</div>
                      <div className="text-xs text-muted-foreground">Rule: {result.appliedRule}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{result.score}%</Badge>
                      <Badge variant={result.suggestedStatus === 'SHORTLISTED' ? 'default' : 'destructive'}>
                        {result.suggestedStatus}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No candidates match the current automation rules
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={() => runWorkflow(false)} 
                disabled={loading || preview.results.length === 0}
                className="flex-1"
              >
                {loading ? "Applying..." : `Apply ${preview.results.length} Changes`}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Automated workflow rules help you process candidates faster by applying consistent business logic.
            </div>

            <Card className="p-4">
              <h3 className="font-medium mb-3">Active Rules</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Auto-reject critical gaps</div>
                    <div className="text-xs text-muted-foreground">
                      Automatically reject candidates missing critical requirements
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Auto-shortlist perfect matches</div>
                    <div className="text-xs text-muted-foreground">
                      Automatically shortlist candidates with 95%+ score and no critical gaps
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium">Flag low scoring candidates</div>
                    <div className="text-xs text-muted-foreground">
                      Automatically reject candidates with less than 30% skill match
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Separator />

            <div className="flex gap-2">
              <Button 
                onClick={() => runWorkflow(true)} 
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                {loading ? "Analyzing..." : "Preview Changes"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
