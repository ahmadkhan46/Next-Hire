"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Copy } from "lucide-react";

interface Communication {
  subject: string;
  body: string;
}

interface CommunicationPreviewProps {
  open: boolean;
  onClose: () => void;
  communication: Communication | null;
  candidateName: string;
  candidateEmail: string;
  status: 'SHORTLISTED' | 'REJECTED';
}

export function CommunicationPreview({
  open,
  onClose,
  communication,
  candidateName,
  candidateEmail,
  status
}: CommunicationPreviewProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!communication) return;
    
    const text = `Subject: ${communication.subject}\n\n${communication.body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    setCopied(false);
  }, [open]);

  if (!communication) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Communication Preview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Email Details</div>
              <Badge variant={status === 'SHORTLISTED' ? 'default' : 'destructive'}>
                {status === 'SHORTLISTED' ? 'Shortlist' : 'Rejection'} Email
              </Badge>
            </div>
            <div className="space-y-1 text-sm">
              <div><span className="text-muted-foreground">To:</span> {candidateName} &lt;{candidateEmail}&gt;</div>
              <div><span className="text-muted-foreground">Subject:</span> {communication.subject}</div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Email Body</div>
            <Separator className="mb-4" />
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              {communication.body}
            </div>
          </Card>

          <div className="flex items-center justify-between pt-4">
            <div className="text-xs text-muted-foreground">
              This is a preview. No email has been sent yet.
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={copyToClipboard}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copied!' : 'Copy'}
              </Button>
              
              <Button
                onClick={onClose}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Ready to Send
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}