'use client';

import { useEffect, useState } from 'react';
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Mail, Share2, Tag, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';

interface QuickActionsProps {
  candidateId: string;
  orgId: string;
  candidateName: string;
  candidateEmail?: string | null;
  tags: Array<{ id: string; name: string; color: string }>;
  status: string;
}

export function QuickActions({
  candidateId,
  orgId,
  candidateName,
  candidateEmail,
  tags,
  status,
}: QuickActionsProps) {
  const { user } = useUser();
  const router = useRouter();
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showInterviewDialog, setShowInterviewDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [selectedColor, setSelectedColor] = useState('#64748b');
  const [loading, setLoading] = useState(false);
  const [currentTags, setCurrentTags] = useState(tags);
  const [currentStatus, setCurrentStatus] = useState(status);
  const [interviewForm, setInterviewForm] = useState({
    title: "Interview",
    round: "Round 1",
    scheduledAt: "",
    durationMinutes: 45,
    timezone: "UTC",
    meetingType: "Video",
    meetingLink: "",
    interviewer: "",
    notes: "",
  });
  const [emailForm, setEmailForm] = useState({
    template: "FOLLOW_UP",
    recipientEmail: "",
    subject: "",
    body: "",
  });
  const senderEmail =
    user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || "";

  useEffect(() => {
    setCurrentTags(tags);
  }, [tags]);

  useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  useEffect(() => {
    setEmailForm((prev) => ({
      ...prev,
      recipientEmail: candidateEmail ?? "",
    }));
  }, [candidateEmail]);

  const colors = [
    { name: 'Slate', value: '#64748b' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
  ];

  const statuses = [
    { value: 'ACTIVE', label: 'Active', color: 'bg-green-500' },
    { value: 'IN_PROCESS', label: 'In Process', color: 'bg-yellow-500' },
    { value: 'HIRED', label: 'Hired', color: 'bg-blue-500' },
    { value: 'ARCHIVED', label: 'Archived', color: 'bg-gray-500' },
    { value: 'REJECTED', label: 'Rejected', color: 'bg-red-500' },
  ];

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTag.trim(), color: selectedColor }),
      });

      if (!res.ok) throw new Error('Failed to add tag');

      const data = await res.json();
      toast.success('Tag added');
      setCurrentTags((prev) => {
        const nextTag = data.tag as { id: string; name: string; color: string };
        if (prev.some((tag) => tag.id === nextTag.id)) return prev;
        return [...prev, nextTag];
      });
      setNewTag('');
      setShowTagDialog(false);
      router.refresh();
    } catch {
      toast.error('Failed to add tag');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/tags/${tagId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove tag');

      toast.success('Tag removed');
      setCurrentTags((prev) => prev.filter((tag) => tag.id !== tagId));
      router.refresh();
    } catch {
      toast.error('Failed to remove tag');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      toast.success('Status updated');
      setCurrentStatus(newStatus);
      setShowStatusDialog(false);
      router.refresh();
    } catch {
      toast.error('Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };

  const handleScheduleInterview = async () => {
    if (!interviewForm.scheduledAt) {
      toast.error('Please choose interview date and time');
      return;
    }

    setLoading(true);
    try {
      const scheduledAtIso = new Date(interviewForm.scheduledAt).toISOString();
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/interviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...interviewForm, scheduledAt: scheduledAtIso }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to schedule interview');

      toast.success('Interview scheduled');
      setShowInterviewDialog(false);
      setInterviewForm({
        title: "Interview",
        round: "Round 1",
        scheduledAt: "",
        durationMinutes: 45,
        timezone: "UTC",
        meetingType: "Video",
        meetingLink: "",
        interviewer: "",
        notes: "",
      });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to schedule interview');
    } finally {
      setLoading(false);
    }
  };

  const setTemplate = (template: string) => {
    const base = {
      recipientEmail: emailForm.recipientEmail,
      template,
    };
    if (template === "INTERVIEW_INVITE") {
      setEmailForm({
        ...base,
        subject: `Interview invitation - ${candidateName}`,
        body: `Hi ${candidateName},\n\nWe would like to invite you to an interview.\n\nPlease confirm your availability.\n\nRegards,\nRecruitment Team`,
      });
      return;
    }
    if (template === "REJECTION") {
      setEmailForm({
        ...base,
        subject: `Update on your application - ${candidateName}`,
        body: `Hi ${candidateName},\n\nThank you for your time. We have decided to proceed with other candidates for this role.\n\nWe appreciate your interest and wish you success.\n\nRegards,\nRecruitment Team`,
      });
      return;
    }
    setEmailForm({
      ...base,
      subject: `Follow-up regarding your application - ${candidateName}`,
      body: `Hi ${candidateName},\n\nI wanted to follow up regarding your application.\n\nRegards,\nRecruitment Team`,
    });
  };

  const handleLogCommunication = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) {
      toast.error('Subject and message are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orgs/${orgId}/candidates/${candidateId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: emailForm.template,
          channel: "EMAIL",
          recipientEmail: emailForm.recipientEmail || null,
          subject: emailForm.subject.trim(),
          body: emailForm.body.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save communication');
      toast.success('Communication logged');
      setShowEmailDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save communication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setShowStatusDialog(true)}
        >
          <div className={`h-2 w-2 rounded-full ${statuses.find(s => s.value === currentStatus)?.color || 'bg-gray-500'} mr-2`} />
          {statuses.find(s => s.value === currentStatus)?.label || currentStatus}
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2">
        {currentTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="rounded-full gap-1"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            <Tag className="h-3 w-3" />
            {tag.name}
            <button
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-1 hover:bg-accent rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Add Tag */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-full h-7"
          onClick={() => setShowTagDialog(true)}
        >
          <Tag className="h-3 w-3 mr-1" />
          Add Tag
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => setShowInterviewDialog(true)}>
          <CalendarClock className="h-4 w-4 mr-2" />
          Schedule Interview
        </Button>
        <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => setShowEmailDialog(true)}>
          <Mail className="h-4 w-4 mr-2" />
          Log Communication
        </Button>
        <Button variant="outline" size="sm" className="rounded-2xl" onClick={handleShare}>
          <Share2 className="h-4 w-4 mr-2" />
          Share Profile
        </Button>
      </div>

      {/* Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Add tag for {candidateName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tag Name</Label>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="e.g., Senior Developer"
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-2">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColor(color.value)}
                    className={`h-8 w-8 rounded-full border-2 ${
                      selectedColor === color.value ? 'border-slate-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTagDialog(false)} className="rounded-2xl">
                Cancel
              </Button>
              <Button onClick={handleAddTag} disabled={loading} className="rounded-2xl">
                Add Tag
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Dialog */}
      <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {statuses.map((s) => (
              <button
                key={s.value}
                onClick={() => handleStatusChange(s.value)}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border hover:bg-accent transition"
              >
                <div className={`h-3 w-3 rounded-full ${s.color}`} />
                <span className="font-medium">{s.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showInterviewDialog} onOpenChange={setShowInterviewDialog}>
        <DialogContent className="rounded-3xl border-slate-300/80 bg-gradient-to-br from-white via-white to-slate-50 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Schedule Interview</DialogTitle>
          </DialogHeader>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
            This creates an interview record and automatically logs the activity in the candidate timeline.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={interviewForm.title}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, title: e.target.value }))}
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Round</Label>
              <Input
                value={interviewForm.round}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, round: e.target.value }))}
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Date & Time (UTC)</Label>
              <Input
                type="datetime-local"
                value={interviewForm.scheduledAt}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min={15}
                max={240}
                value={interviewForm.durationMinutes}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, durationMinutes: Number(e.target.value || 45) }))}
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Interviewer</Label>
              <Input
                value={interviewForm.interviewer}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, interviewer: e.target.value }))}
                className="rounded-2xl mt-2"
                placeholder="e.g., Sarah Johnson"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Meeting Link</Label>
              <Input
                value={interviewForm.meetingLink}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, meetingLink: e.target.value }))}
                className="rounded-2xl mt-2"
                placeholder="https://..."
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                value={interviewForm.notes}
                onChange={(e) => setInterviewForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="rounded-2xl mt-2 min-h-[90px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowInterviewDialog(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={handleScheduleInterview} disabled={loading}>
              Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="rounded-3xl border-slate-300/80 bg-gradient-to-br from-white via-white to-slate-50 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Communication</DialogTitle>
          </DialogHeader>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-xs text-slate-600">
            This logs outreach in the activity timeline. It does not send emails yet.
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { label: "Follow-up", value: "FOLLOW_UP" },
                { label: "Interview invite", value: "INTERVIEW_INVITE" },
                { label: "Rejection", value: "REJECTION" },
                { label: "Custom", value: "CUSTOM" },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant={emailForm.template === item.value ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setTemplate(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div>
              <Label>Sender Email</Label>
              <Input
                value={senderEmail}
                readOnly
                className="rounded-2xl mt-2 bg-slate-50"
                placeholder="signed-in user email"
              />
            </div>
            <div>
              <Label>Recipient Email (optional)</Label>
              <Input
                value={emailForm.recipientEmail}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                className="rounded-2xl mt-2"
                placeholder="leave empty to use candidate email"
              />
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5" />
                <span>Candidate: {candidateName}</span>
              </div>
            </div>
            <div>
              <Label>Subject</Label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="rounded-2xl mt-2"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, body: e.target.value }))}
                className="rounded-2xl mt-2 min-h-[140px]"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setShowEmailDialog(false)}>
              Cancel
            </Button>
            <Button className="rounded-2xl" onClick={handleLogCommunication} disabled={loading}>
              Save communication
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
