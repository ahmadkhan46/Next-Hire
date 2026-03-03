"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Users, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseCSV } from "@/lib/csv-parser";
import { JobProgress } from "@/components/job-progress";
import { sanitizeHtml } from "@/lib/security";

export function BulkImport({ orgId }: { orgId: string }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [csvData, setCsvData] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [targetJobId, setTargetJobId] = useState("none");
  const [importSummary, setImportSummary] = useState<{
    totalRows: number;
    queuedRows: number;
    skippedMissingName: number;
    skippedMissingEmail: number;
  } | null>(null);
  const [apiErrorSummary, setApiErrorSummary] = useState<string | null>(null);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const router = useRouter();

  const makeCorrelationId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const loadJobs = async () => {
    const response = await fetch(`/api/orgs/${orgId}/jobs`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || "Failed to load jobs");
    }
    const nextJobs = Array.isArray(data?.jobs) ? data.jobs : [];
    setJobs(nextJobs.filter((job: { status?: string }) => job.status === "OPEN"));
  };

  const downloadTemplate = (type: "basic" | "full") => {
    const header =
      type === "basic"
        ? "fullName,email,phone,dateOfBirth,externalId,skills"
        : "fullName,email,phone,dateOfBirth,location,currentTitle,yearsOfExperience,externalId,linkedinUrl,githubUrl,portfolioUrl,status,source,notes,skills,educationSchool,educationDegree,educationYear,experience1Company,experience1Role,experience1StartMonth,experience1EndMonth,experience1Location,experience1Bullets,experience2Company,experience2Role,experience2StartMonth,experience2EndMonth,experience2Location,experience2Bullets,project1Title,project1Dates,project1TechStack,project1Link,project1Bullets,project2Title,project2Dates,project2TechStack,project2Link,project2Bullets,resumeText";
    const example =
      type === "basic"
        ? "John Doe,john@example.com,555-1234,1990-01-15T00:00:00.000Z,EMP-001,\"React,Node.js,Python\""
        : "John Doe,john@example.com,555-1234,1990-01-15T00:00:00.000Z,San Francisco,Senior Developer,8,EMP-001,https://linkedin.com/in/johndoe,https://github.com/johndoe,https://johndoe.com,ACTIVE,REFERRAL,Great candidate,\"React,Node.js,Python\",Stanford University,BS Computer Science,2012,Google,Senior Engineer,2018-01-01,2024-01-01,Mountain View,\"Led team | Built microservices\",Facebook,Software Engineer,2015-06-01,2017-12-01,Menlo Park,\"Developed React components\",E-Commerce Platform,2023,\"React,Node.js\",https://github.com/johndoe/ecommerce,\"Built full-stack platform\",AI Chatbot,2022,\"Python,TensorFlow\",https://github.com/johndoe/chatbot,\"Trained NLP model\",";
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = type === "basic" ? "candidate-template-basic.csv" : "candidate-template-full.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvData(text);
    };
    reader.readAsText(uploadedFile);
  };

  const handleImport = async () => {
    if (!csvData.trim()) return;

    setImporting(true);
    setApiErrorSummary(null);
    setCorrelationId(null);
    
    try {
      const rows = parseCSV(csvData);
      if (rows.length < 2) {
        throw new Error('CSV must have header and at least one data row');
      }

      const [header, ...dataRows] = rows;
      
      // Map header to indices
      const headerMap: Record<string, number> = {};
      header.forEach((col, idx) => {
        headerMap[col.toLowerCase()] = idx;
      });

      const parsedCandidates = dataRows.map((row) => {
        const get = (field: string) => {
          const idx = headerMap[field.toLowerCase()];
          return idx !== undefined ? row[idx] : undefined;
        };

        const candidate: any = {
          fullName: get('fullname') || get('name'),
          email: get('email') || undefined,
          phone: get('phone') || undefined,
          externalId: get('externalid') || undefined,
          dateOfBirth: get('dateofbirth') || undefined,
          location: get('location') || undefined,
          currentTitle: get('currenttitle') || undefined,
          yearsOfExperience: get('yearsofexperience') ? parseInt(get('yearsofexperience')!) : undefined,
          linkedinUrl: get('linkedinurl') || undefined,
          githubUrl: get('githuburl') || undefined,
          portfolioUrl: get('portfoliourl') || undefined,
          status: get('status') || undefined,
          source: get('source') || 'IMPORT',
          notes: get('notes') || undefined,
          skills: get('skills') ? get('skills')!.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          resumeText: get('resumetext') || get('resume') || undefined,
          // Education
          educationSchool: get('educationschool') || undefined,
          educationDegree: get('educationdegree') || undefined,
          educationYear: get('educationyear') ? parseInt(get('educationyear')!) : undefined,
          // Experience 1
          experience1Company: get('experience1company') || undefined,
          experience1Role: get('experience1role') || undefined,
          experience1StartMonth: get('experience1startmonth') || undefined,
          experience1EndMonth: get('experience1endmonth') || undefined,
          experience1Location: get('experience1location') || undefined,
          experience1Bullets: get('experience1bullets') || undefined,
          // Experience 2
          experience2Company: get('experience2company') || undefined,
          experience2Role: get('experience2role') || undefined,
          experience2StartMonth: get('experience2startmonth') || undefined,
          experience2EndMonth: get('experience2endmonth') || undefined,
          experience2Location: get('experience2location') || undefined,
          experience2Bullets: get('experience2bullets') || undefined,
          // Project 1
          project1Title: get('project1title') || undefined,
          project1Dates: get('project1dates') || undefined,
          project1TechStack: get('project1techstack') || undefined,
          project1Link: get('project1link') || undefined,
          project1Bullets: get('project1bullets') || undefined,
          // Project 2
          project2Title: get('project2title') || undefined,
          project2Dates: get('project2dates') || undefined,
          project2TechStack: get('project2techstack') || undefined,
          project2Link: get('project2link') || undefined,
          project2Bullets: get('project2bullets') || undefined,
        };

        // Remove undefined/empty values
        Object.keys(candidate).forEach(key => {
          if (candidate[key] === undefined || candidate[key] === '' || candidate[key] === null) {
            delete candidate[key];
          }
        });

        return candidate;
      });

      const totalRows = parsedCandidates.length;
      const skippedMissingName = parsedCandidates.filter((c) => !c.fullName).length;
      const skippedMissingEmail = parsedCandidates.filter((c) => !!c.fullName && !c.email).length;
      const candidates = parsedCandidates.filter((c) => c.fullName && c.email);

      setImportSummary({
        totalRows,
        queuedRows: candidates.length,
        skippedMissingName,
        skippedMissingEmail,
      });

      if (candidates.length === 0) {
        throw new Error("No valid rows to import. CSV rows require fullName and email.");
      }

      const requestCorrelationId = makeCorrelationId();
      setCorrelationId(requestCorrelationId);

      const response = await fetch(`/api/orgs/${orgId}/candidates/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-correlation-id': requestCorrelationId,
        },
        body: JSON.stringify({
          candidates,
          targetJobId: targetJobId === "none" ? undefined : targetJobId,
        }),
      });

      const data = await response.json();
      const responseCorrelationId =
        response.headers.get("x-correlation-id") || data?.correlationId || requestCorrelationId;
      setCorrelationId(responseCorrelationId);
      
      if (response.ok && data.jobId) {
        setJobId(data.jobId);
      } else {
        const apiError = sanitizeHtml(data.error || 'Import failed');
        setApiErrorSummary(apiError);
        throw new Error(apiError);
      }
    } catch (error: any) {
      const safeMessage = sanitizeHtml(error.message || 'Import failed');
      console.error('Import failed:', safeMessage);
      setApiErrorSummary(safeMessage);
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setJobId(null);
    setCsvData("");
    setFile(null);
    setImporting(false);
    setTargetJobId("none");
    setImportSummary(null);
    setApiErrorSummary(null);
    setCorrelationId(null);
    setOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      loadJobs().catch((error: any) => {
        const safeMessage = sanitizeHtml(error.message || "Failed to load jobs");
        console.error("Failed to load jobs:", safeMessage);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Candidates
          </DialogTitle>
        </DialogHeader>

        {jobId ? (
          <div className="space-y-4">
            <JobProgress
              jobId={jobId}
              queueName="bulkImport"
              onComplete={(result) => {
                setImporting(false);
                if (result?.correlationId) {
                  setCorrelationId(result.correlationId);
                }
                if (result.imported > 0) {
                  router.refresh();
                }
              }}
              onError={(error) => {
                setImporting(false);
                console.error('Import job failed:', error);
              }}
            />

            <Button onClick={resetDialog} className="w-full">
              Import More Candidates
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>
                Upload CSV file or paste data. Use templates below for correct format.
              </div>
              <div>Email is required for each candidate row.</div>
              <div>
                Skills should be comma-separated in quotes (e.g., "React,Node.js,Python")
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" onClick={() => downloadTemplate("basic")}>
                  Download Basic Template
                </Button>
                <Button variant="outline" onClick={() => downloadTemplate("full")}>
                  Download Full Template
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-job">Optional: target job for auto-match</Label>
              <select
                id="target-job"
                value={targetJobId}
                onChange={(e) => setTargetJobId(e.target.value)}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                disabled={importing}
              >
                <option value="none">All open jobs (default)</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-file">Upload CSV File</Label>
              <input
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              {file && <div className="text-xs text-muted-foreground">Loaded: {file.name}</div>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-data">Or Paste CSV Data</Label>
              <Textarea
                id="csv-data"
                placeholder="fullName,email,phone,skills&#10;John Doe,john@example.com,555-0123,\&quot;React,Node.js,Python\&quot;"
                value={csvData}
                onChange={(e) => setCsvData(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>

            {importSummary ? (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="font-medium">Import summary</div>
                <div className="mt-1 text-muted-foreground">
                  {importSummary.queuedRows} of {importSummary.totalRows} row(s) will be queued.
                </div>
                {(importSummary.skippedMissingName > 0 || importSummary.skippedMissingEmail > 0) && (
                  <div className="mt-1 text-amber-700">
                    {importSummary.skippedMissingName > 0
                      ? `${importSummary.skippedMissingName} row(s) skipped: missing fullName. `
                      : ""}
                    {importSummary.skippedMissingEmail > 0
                      ? `${importSummary.skippedMissingEmail} row(s) skipped: missing email.`
                      : ""}
                  </div>
                )}
              </div>
            ) : null}

            {apiErrorSummary ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                API error: {apiErrorSummary}
                {correlationId ? <div className="mt-1 text-xs">Correlation ID: {correlationId}</div> : null}
              </div>
            ) : null}

            {importing && (
              <div className="rounded-lg border bg-blue-50 p-3 text-sm text-blue-700">
                Job queued. Processing in background...
                {correlationId ? <div className="mt-1 text-xs">Correlation ID: {correlationId}</div> : null}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={handleImport} 
                disabled={!csvData.trim() || importing}
                className="flex-1 gap-2"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Candidates"
                )}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

