import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquareHeart,
  Bug,
  Lightbulb,
  AlertCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  User,
  PlusCircle,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Trash2,
  Maximize2,
  ShieldCheck,
  Flame,
  Check
} from 'lucide-react';
import { IssueReport, IssueReportType } from '../domain/types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  userEmail?: string;
  userName?: string;
  userId?: string;
  communityIssues: IssueReport[];
  onVoteIssue: (
    issueId: string,
    voteType: 'like' | 'dislike',
    voterId: string
  ) => Promise<{ likes: number; dislikes: number; userVote: 'like' | 'dislike' | null }>;
  onSubmitReport: (report: IssueReport) => Promise<void> | void;
  showToast: (msg: string) => void;
}

/**
 * Client-Side Screenshot Compression (No Cloud Required)
 * Scales image to max 1000px and compresses to lightweight JPEG.
 * Output is ~25 KB to 40 KB, perfectly stored directly in document state.
 */
function compressImage(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 1000;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.65);
        resolve(compressed);
      };
      img.onerror = () => reject(new Error('Image failed to load'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  currentPage,
  userEmail,
  userName,
  userId,
  communityIssues = [],
  onVoteIssue,
  onSubmitReport,
  showToast
}) => {
  // Navigation Tabs: 'submit' (submit issue) vs 'community' (view community issues & voting)
  const [activeTab, setActiveTab] = useState<'submit' | 'community'>('submit');

  // Form State
  const [reportType, setReportType] = useState<IssueReportType>('bug');
  const [title, setTitle] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedSection, setSelectedSection] = useState<string>(currentPage || 'Home');
  const [submitterName, setSubmitterName] = useState<string>(userName || 'EcO User');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Community Issues Filter & Search
  const [communitySearch, setCommunitySearch] = useState<string>('');
  const [communityTypeFilter, setCommunityTypeFilter] = useState<string>('all');
  const [communitySort, setCommunitySort] = useState<'hot' | 'recent'>('hot');

  // Full-size image modal lightbox
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voter ID (persists across visits in localStorage)
  const voterId = useMemo(() => {
    if (userId) return userId;
    let localVoter = typeof window !== 'undefined' ? localStorage.getItem('eco_local_voter_id') : null;
    if (!localVoter) {
      localVoter = `voter_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      if (typeof window !== 'undefined') {
        localStorage.setItem('eco_local_voter_id', localVoter);
      }
    }
    return localVoter;
  }, [userId]);

  // Sync selectedSection and user name when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSection(currentPage || 'Home');
      if (userName) setSubmitterName(userName);
      setValidationError(null);
    }
  }, [isOpen, currentPage, userName]);

  // Lock body scroll on open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Support Ctrl+V paste of screenshots
  useEffect(() => {
    if (!isOpen || activeTab !== 'submit') return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            try {
              const compressed = await compressImage(file);
              setScreenshot(compressed);
              showToast('Screenshot pasted from clipboard!');
            } catch (err) {
              console.warn('Paste image failed:', err);
            }
          }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, activeTab, showToast]);

  // Reset form
  const resetForm = () => {
    setTitle('');
    setMessage('');
    setScreenshot(null);
    setValidationError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // File selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressed = await compressImage(file);
      setScreenshot(compressed);
      showToast('Screenshot attached successfully!');
    } catch (err) {
      showToast('Failed to load image.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedMsg = message.trim();
    if (trimmedMsg.length < 5) {
      setValidationError('Please enter at least 5 characters describing the issue.');
      return;
    }

    setIsSubmitting(true);

    try {
      const generatedTitle =
        title.trim() ||
        (trimmedMsg.length > 50 ? `${trimmedMsg.substring(0, 47)}...` : trimmedMsg);

      const displayName = isAnonymous
        ? 'Anonymous User'
        : submitterName.trim() || userName || 'EcO User';

      const newReport: IssueReport = {
        id: `report_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: userId || voterId,
        userName: displayName,
        userEmail: isAnonymous ? undefined : userEmail,
        title: generatedTitle,
        type: reportType,
        message: trimmedMsg,
        page: selectedSection,
        deviceContext: {
          browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
          screen: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'N/A',
          theme: 'dark',
          version: 'v2.2'
        },
        contactPermission: !isAnonymous,
        status: 'new',
        likesCount: 1, // Submitter auto-upvotes their own entry
        dislikesCount: 0,
        likedBy: [voterId],
        dislikedBy: [],
        screenshot: screenshot || undefined,
        createdAt: Date.now()
      };

      await onSubmitReport(newReport);
      resetForm();
      setIsSubmitting(false);
      showToast('Thank you! Your issue was posted to the community board.');
      setActiveTab('community');
    } catch (err: any) {
      setIsSubmitting(false);
      setValidationError(err?.message || 'Failed to submit report. Please try again.');
    }
  };

  // Voting Handler: A user can choose ONE (Like OR Dislike)
  const handleVote = async (issueId: string, voteType: 'like' | 'dislike') => {
    try {
      await onVoteIssue(issueId, voteType, voterId);
    } catch (e) {
      console.error('Failed to register vote:', e);
    }
  };

  // Filtered & Sorted Community Issues
  const filteredCommunityIssues = useMemo(() => {
    return communityIssues
      .filter((issue) => {
        if (communityTypeFilter !== 'all' && issue.type !== communityTypeFilter) {
          return false;
        }
        if (communitySearch.trim()) {
          const term = communitySearch.toLowerCase();
          const matchTitle = (issue.title || '').toLowerCase().includes(term);
          const matchMsg = (issue.message || '').toLowerCase().includes(term);
          const matchAuthor = (issue.userName || '').toLowerCase().includes(term);
          const matchPage = (issue.page || '').toLowerCase().includes(term);
          if (!matchTitle && !matchMsg && !matchAuthor && !matchPage) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (communitySort === 'hot') {
          const scoreA = (a.likesCount || 0) - (a.dislikesCount || 0);
          const scoreB = (b.likesCount || 0) - (b.dislikesCount || 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (b.createdAt || 0) - (a.createdAt || 0);
        }
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }, [communityIssues, communityTypeFilter, communitySearch, communitySort]);

  if (!isOpen) return null;

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'Just now';
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
        role="dialog"
        aria-modal="true"
      >
        <div className="w-full max-w-2xl bg-[#1A1C20] border border-[#3D4943]/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]">
          {/* --- Header: Only the brand title is in Bangla as requested --- */}
          <div className="px-5 pt-4 pb-3 border-b border-[#3D4943]/40 bg-[#1E2024]/90 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#0C0E12] border border-[#73E3B4]/40 flex items-center justify-center text-[#73E3B4] shadow-sm">
                <MessageSquareHeart className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-[#E2E2E8] tracking-tight">
                    অ্যাপ রে গালাবো
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#73E3B4]/15 text-[#73E3B4] font-semibold border border-[#73E3B4]/30">
                    Community Hub
                  </span>
                </div>
                <p className="text-[11px] text-[#BCCAC1]">
                  Submit issues, complaints, or feature suggestions and vote on community feedback
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-[#87948C] hover:text-[#E2E2E8] hover:bg-[#282A2E] transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* --- Top Tab Switcher (English) --- */}
          <div className="px-5 pt-3 pb-2 bg-[#1A1C20] border-b border-[#3D4943]/30">
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#0C0E12] border border-[#3D4943]/40">
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'submit'
                    ? 'bg-[#1E2024] text-[#73E3B4] shadow-sm border border-[#73E3B4]/30'
                    : 'text-[#87948C] hover:text-[#E2E2E8]'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Submit Issue</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('community')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'community'
                    ? 'bg-[#1E2024] text-[#73E3B4] shadow-sm border border-[#73E3B4]/30'
                    : 'text-[#87948C] hover:text-[#E2E2E8]'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Community Issues & Feedback</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-[#73E3B4]/20 text-[#73E3B4]">
                  {communityIssues.length}
                </span>
              </button>
            </div>
          </div>

          {/* =========================================================================
              TAB 1: SUBMIT AN ISSUE (CLEAN, INTUITIVE FORM IN ENGLISH)
             ========================================================================= */}
          {activeTab === 'submit' && (
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              {validationError && (
                <div className="p-3 rounded-xl bg-[#FFB4AB]/10 border border-[#FFB4AB]/30 text-[#FFB4AB] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Step 1: Select Type */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#BCCAC1] uppercase tracking-wider block">
                  1. Issue Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'bug' as const, label: 'Bug / Error', desc: 'Broken feature or math', icon: Bug, color: 'text-[#FFB4AB]' },
                    { id: 'idea' as const, label: 'Feature Idea', desc: 'New suggestions', icon: Lightbulb, color: 'text-[#FACC15]' },
                    { id: 'complaint' as const, label: 'Complaint', desc: 'Workflow frustration', icon: AlertCircle, color: 'text-[#FB923C]' },
                    { id: 'other' as const, label: 'General', desc: 'Questions or notes', icon: HelpCircle, color: 'text-[#73E3B4]' }
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = reportType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setReportType(item.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#1E2024] border-[#73E3B4] shadow-sm ring-1 ring-[#73E3B4]/40'
                            : 'bg-[#0C0E12] border-[#3D4943]/40 text-[#BCCAC1] hover:border-[#3D4943]/80'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[#73E3B4]' : item.color}`} />
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#73E3B4]" />}
                        </div>
                        <div className="mt-2">
                          <div className={`font-bold text-xs ${isSelected ? 'text-[#E2E2E8]' : 'text-[#BCCAC1]'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] text-[#87948C]">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#BCCAC1] uppercase tracking-wider block">
                  2. Short Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. bKash cashout fee calculation mismatch, mobile touch delay..."
                  className="w-full bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl px-3.5 py-2.5 text-xs text-[#E2E2E8] placeholder-[#87948C]/70 focus:outline-none focus:border-[#73E3B4] transition-colors"
                />
              </div>

              {/* Step 3: Message / Details */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#BCCAC1] uppercase tracking-wider">
                    3. Detailed Description <span className="text-[#FFB4AB]">*</span>
                  </label>
                  <span className="text-[10px] font-mono text-[#87948C]">
                    {message.length}/1000
                  </span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  rows={4}
                  maxLength={1000}
                  placeholder="Explain what happened, what went wrong, or what improvement you would like to see..."
                  className="w-full bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl p-3.5 text-xs text-[#E2E2E8] placeholder-[#87948C]/70 focus:outline-none focus:border-[#73E3B4] transition-colors resize-none leading-relaxed"
                />
              </div>

              {/* Step 4: Screenshot Attachment (100% Client-Side Compression — No Cloud Required) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-[#BCCAC1] uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-[#73E3B4]" />
                    <span>4. Attach Screenshot (Optional)</span>
                  </label>
                  <span className="text-[10px] text-[#73E3B4] font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Zero Cloud Storage Cost (Auto-compressed)</span>
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {screenshot ? (
                  <div className="p-3 rounded-xl bg-[#0C0E12] border border-[#73E3B4]/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        onClick={() => setPreviewImage(screenshot)}
                        className="relative w-14 h-14 rounded-lg overflow-hidden border border-[#3D4943]/60 bg-black cursor-pointer group shrink-0"
                      >
                        <img
                          src={screenshot}
                          alt="Attached Screenshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Maximize2 className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="min-w-0 text-xs">
                        <div className="font-semibold text-[#E2E2E8] flex items-center gap-1.5">
                          <span>Screenshot attached</span>
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#73E3B4]" />
                        </div>
                        <p className="text-[11px] text-[#87948C] truncate mt-0.5">
                          Click to view enlarged image or replace
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-lg bg-[#1E2024] hover:bg-[#282A2E] text-[#BCCAC1] hover:text-[#E2E2E8] text-xs transition-colors cursor-pointer"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => setScreenshot(null)}
                        className="p-1.5 rounded-lg text-[#FFB4AB] hover:bg-[#FFB4AB]/10 transition-colors cursor-pointer"
                        title="Remove image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="p-4 rounded-xl border border-dashed border-[#3D4943]/70 hover:border-[#73E3B4]/60 bg-[#0C0E12]/60 hover:bg-[#0C0E12] transition-colors cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#1E2024] border border-[#3D4943]/50 flex items-center justify-center text-[#73E3B4] shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-[#E2E2E8]">
                          Select image or drag & drop screenshot
                        </div>
                        <div className="text-[10px] text-[#87948C] mt-0.5">
                          Or paste directly from clipboard anytime (<kbd className="px-1.5 py-0.5 rounded bg-[#1E2024] text-[#BCCAC1]">Ctrl+V</kbd>)
                        </div>
                      </div>
                    </div>
                    <span className="px-3 py-1.5 rounded-lg bg-[#1E2024] text-[#73E3B4] font-medium text-xs whitespace-nowrap">
                      Browse File
                    </span>
                  </div>
                )}
              </div>

              {/* Step 5: Metadata (Page & Submitter) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-semibold text-[#87948C] uppercase tracking-wider block mb-1">
                    Related App Section
                  </label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl px-3 py-2 text-xs text-[#E2E2E8] focus:border-[#73E3B4] outline-none cursor-pointer"
                  >
                    <option value="Home">Home / Dashboard</option>
                    <option value="Ledger History">Ledger History</option>
                    <option value="Wallets">Wallets & Accounts</option>
                    <option value="People & Debts">People & Debts</option>
                    <option value="Stats">Financial Statistics</option>
                    <option value="Settings">Settings & Backup</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-semibold text-[#87948C] uppercase tracking-wider block mb-1">
                    Your Name
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={isAnonymous}
                      value={isAnonymous ? 'Anonymous User' : submitterName}
                      onChange={(e) => setSubmitterName(e.target.value)}
                      className="flex-1 bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl px-3 py-2 text-xs text-[#E2E2E8] disabled:opacity-50 disabled:text-[#87948C] focus:border-[#73E3B4] outline-none"
                    />
                    <label className="flex items-center gap-1.5 text-[11px] text-[#BCCAC1] cursor-pointer whitespace-nowrap bg-[#0C0E12] px-2.5 py-2 rounded-xl border border-[#3D4943]/40 hover:border-[#3D4943]">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="rounded border-[#3D4943] text-[#55C79A] focus:ring-0"
                      />
                      <span>Anonymous</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Submission Actions */}
              <div className="pt-2 flex items-center justify-between border-t border-[#3D4943]/30">
                <button
                  type="button"
                  onClick={() => setActiveTab('community')}
                  className="text-xs text-[#87948C] hover:text-[#73E3B4] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Explore community issues</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-[#282A2E] hover:bg-[#3D4943]/60 text-[#BCCAC1] hover:text-[#E2E2E8] text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || message.trim().length < 5}
                    className="px-5 py-2.5 rounded-xl bg-[#55C79A] hover:bg-[#73E3B4] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed text-[#003826] font-bold text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Submitting...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Issue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* =========================================================================
              TAB 2: COMMUNITY ISSUES BOARD (ENGLISH WITH VISUAL CARDS & VOTING)
             ========================================================================= */}
          {activeTab === 'community' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
              {/* Filter & Search Bar */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#87948C] absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={communitySearch}
                      onChange={(e) => setCommunitySearch(e.target.value)}
                      placeholder="Search community issues, bugs, or suggestions..."
                      className="w-full pl-9 pr-7 py-2 bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl text-xs text-[#E2E2E8] placeholder-[#87948C] focus:outline-none focus:border-[#73E3B4]"
                    />
                    {communitySearch && (
                      <button
                        type="button"
                        onClick={() => setCommunitySearch('')}
                        className="absolute right-2.5 top-2.5 text-[#87948C] hover:text-[#E2E2E8]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort Option */}
                  <select
                    value={communitySort}
                    onChange={(e) => setCommunitySort(e.target.value as 'hot' | 'recent')}
                    className="px-3 py-2 bg-[#0C0E12] border border-[#3D4943]/50 rounded-xl text-xs text-[#E2E2E8] focus:border-[#73E3B4] outline-none cursor-pointer"
                  >
                    <option value="hot">🔥 Most Voted</option>
                    <option value="recent">⏱️ Newest First</option>
                  </select>
                </div>

                {/* Type Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                  {[
                    { id: 'all', label: 'All Issues' },
                    { id: 'bug', label: 'Bugs & Errors' },
                    { id: 'idea', label: 'Feature Ideas' },
                    { id: 'complaint', label: 'Complaints' },
                    { id: 'other', label: 'General' }
                  ].map((chip) => {
                    const isActive = communityTypeFilter === chip.id;
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setCommunityTypeFilter(chip.id)}
                        className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#1E2024] text-[#73E3B4] font-semibold border border-[#73E3B4]/40'
                            : 'text-[#87948C] hover:text-[#E2E2E8] hover:bg-[#0C0E12] border border-transparent'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* List of Community Issues */}
              <div className="space-y-3">
                {filteredCommunityIssues.length === 0 ? (
                  <div className="p-10 text-center text-xs text-[#87948C] bg-[#0C0E12] rounded-xl border border-[#3D4943]/30 space-y-2">
                    <div>No community issues found matching your criteria.</div>
                    <button
                      type="button"
                      onClick={() => {
                        setCommunitySearch('');
                        setCommunityTypeFilter('all');
                      }}
                      className="text-[#73E3B4] hover:underline cursor-pointer"
                    >
                      Clear search filters
                    </button>
                  </div>
                ) : (
                  filteredCommunityIssues.map((issue) => {
                    const hasLiked = Array.isArray(issue.likedBy) && issue.likedBy.includes(voterId);
                    const hasDisliked = Array.isArray(issue.dislikedBy) && issue.dislikedBy.includes(voterId);
                    const likes = typeof issue.likesCount === 'number' ? issue.likesCount : (issue.likedBy?.length || 0);
                    const dislikes = typeof issue.dislikesCount === 'number' ? issue.dislikesCount : (issue.dislikedBy?.length || 0);

                    const typeColor =
                      issue.type === 'bug'
                        ? 'bg-[#FFB4AB]/15 text-[#FFB4AB] border-[#FFB4AB]/30'
                        : issue.type === 'idea'
                        ? 'bg-[#FACC15]/15 text-[#FACC15] border-[#FACC15]/30'
                        : issue.type === 'complaint'
                        ? 'bg-[#FB923C]/15 text-[#FB923C] border-[#FB923C]/30'
                        : 'bg-[#73E3B4]/15 text-[#73E3B4] border-[#73E3B4]/30';

                    const typeLabel =
                      issue.type === 'bug'
                        ? 'Bug'
                        : issue.type === 'idea'
                        ? 'Feature Idea'
                        : issue.type === 'complaint'
                        ? 'Complaint'
                        : 'General';

                    return (
                      <div
                        key={issue.id}
                        className="p-4 rounded-xl bg-[#0C0E12] border border-[#3D4943]/40 hover:border-[#3D4943]/80 transition-all shadow-sm space-y-2.5"
                      >
                        {/* Top Row: Author, Badge, Time */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#1E2024] border border-[#3D4943]/60 flex items-center justify-center text-[11px] font-bold text-[#73E3B4]">
                              {(issue.userName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="font-semibold text-xs text-[#E2E2E8]">
                              {issue.userName || 'Anonymous'}
                            </span>
                            <span className="text-[10px] text-[#87948C]">·</span>
                            <span className="text-[10px] text-[#87948C]">
                              {formatRelativeTime(issue.createdAt || Date.now())}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {issue.page && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A1C20] text-[#BCCAC1] border border-[#3D4943]/40">
                                {issue.page}
                              </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${typeColor}`}>
                              {typeLabel}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          {issue.title && (
                            <h4 className="text-xs sm:text-sm font-bold text-[#E2E2E8] mb-1">
                              {issue.title}
                            </h4>
                          )}
                          <p className="text-xs text-[#BCCAC1] leading-relaxed whitespace-pre-wrap">
                            {issue.message}
                          </p>
                        </div>

                        {/* Attached Screenshot Thumbnail (if present) */}
                        {issue.screenshot && (
                          <div className="pt-1">
                            <div
                              onClick={() => setPreviewImage(issue.screenshot!)}
                              className="inline-flex items-center gap-2 p-1.5 pr-3 rounded-lg bg-[#1E2024] border border-[#3D4943]/50 hover:border-[#73E3B4]/50 cursor-pointer transition-colors group"
                            >
                              <img
                                src={issue.screenshot}
                                alt="Issue Attachment"
                                className="w-10 h-10 rounded object-cover border border-black/40 group-hover:scale-105 transition-transform"
                              />
                              <div className="text-left">
                                <div className="text-[11px] font-medium text-[#E2E2E8] group-hover:text-[#73E3B4] flex items-center gap-1 transition-colors">
                                  <span>View Screenshot</span>
                                  <Maximize2 className="w-3 h-3" />
                                </div>
                                <div className="text-[10px] text-[#87948C]">Click to enlarge</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Bottom Row: Like & Dislike Voting Controls */}
                        <div className="pt-2 border-t border-[#3D4943]/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* Like Button */}
                            <button
                              type="button"
                              onClick={() => handleVote(issue.id, 'like')}
                              title={hasLiked ? 'Remove Like' : 'Vote Like'}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                hasLiked
                                  ? 'bg-[#73E3B4]/20 text-[#73E3B4] border border-[#73E3B4]/60 font-bold shadow-sm'
                                  : 'bg-[#1A1C20] hover:bg-[#282A2E] text-[#87948C] hover:text-[#73E3B4] border border-[#3D4943]/40'
                              }`}
                            >
                              <ThumbsUp className={`w-3.5 h-3.5 ${hasLiked ? 'fill-[#73E3B4]' : ''}`} />
                              <span>{likes}</span>
                            </button>

                            {/* Dislike Button */}
                            <button
                              type="button"
                              onClick={() => handleVote(issue.id, 'dislike')}
                              title={hasDisliked ? 'Remove Dislike' : 'Vote Dislike'}
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                                hasDisliked
                                  ? 'bg-[#FFB4AB]/20 text-[#FFB4AB] border border-[#FFB4AB]/60 font-bold shadow-sm'
                                  : 'bg-[#1A1C20] hover:bg-[#282A2E] text-[#87948C] hover:text-[#FFB4AB] border border-[#3D4943]/40'
                              }`}
                            >
                              <ThumbsDown className={`w-3.5 h-3.5 ${hasDisliked ? 'fill-[#FFB4AB]' : ''}`} />
                              <span>{dislikes}</span>
                            </button>
                          </div>

                          {/* Status Note */}
                          <div className="text-[10px] text-[#87948C] flex items-center gap-1">
                            {issue.status === 'fixed' ? (
                              <span className="text-[#73E3B4] font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Resolved</span>
                              </span>
                            ) : issue.status === 'seen' ? (
                              <span className="text-[#FACC15] font-medium">Under Review</span>
                            ) : (
                              <span>Submitted</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick CTA to submit a new problem */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setActiveTab('submit')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1E2024] hover:bg-[#282A2E] border border-[#73E3B4]/40 text-[#73E3B4] text-xs font-semibold transition-all cursor-pointer shadow-sm"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Have an issue or idea? Submit a New Issue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Preview Modal for Zooming Screenshots */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-[#111317] border border-[#3D4943]/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-3 bg-[#1A1C20] border-b border-[#3D4943]/40 flex items-center justify-between">
              <span className="text-xs font-semibold text-[#E2E2E8]">Screenshot Preview</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-[#87948C] hover:text-[#E2E2E8] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 overflow-auto max-h-[82vh] flex items-center justify-center bg-black/50">
              <img
                src={previewImage}
                alt="Enlarged Screenshot"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
