import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { 
  HelpCircle, 
  ShieldCheck, 
  AlertTriangle, 
  MessageSquare, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  Send, 
  Lock, 
  Mail,
  Clock,
  Search,
  Filter,
  UserCheck,
  Tag,
  MessageCircle,
  Inbox,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { UserProfile, SupportTicket, TicketMessage } from '../types';

interface SupportViewProps {
  user?: User | null;
  userProfile?: UserProfile | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
  onBackToMarketplace?: () => void;
}

export const SupportView: React.FC<SupportViewProps> = ({
  user,
  userProfile,
  isOwner = false,
  isAdmin = false,
  onOpenAuth,
  onBackToMarketplace
}) => {
  const effectiveIsOwner = isOwner || isAuthorizedOwner(user, userProfile);
  const effectiveIsAdmin = isAdmin || effectiveIsOwner || userProfile?.role === 'admin';

  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);

  // New ticket form
  const [ticketCategory, setTicketCategory] = useState<'product_issue' | 'order_dispute' | 'payment_escrow' | 'delivery' | 'account' | 'report' | 'general'>('general');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // Admin / User active ticket viewing
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminNewStatus, setAdminNewStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('in_progress');
  const [isUpdatingTicket, setIsUpdatingTicket] = useState(false);

  // Filters for Admin view
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch Tickets from Firestore
  useEffect(() => {
    if (!user) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }

    setLoadingTickets(true);
    let q;
    const ticketsRef = collection(db, 'tickets');

    if (effectiveIsAdmin) {
      // Owner / Admin sees ALL tickets
      q = query(ticketsRef, orderBy('createdAt', 'desc'));
    } else {
      // User sees only their own tickets
      q = query(ticketsRef, where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData: SupportTicket[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      } as SupportTicket));

      setTickets(ticketsData);
      setLoadingTickets(false);

      // Keep selected ticket updated if open
      if (selectedTicket) {
        const updated = ticketsData.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    }, (err) => {
      console.warn('Error listening to tickets snapshot:', err);
      setLoadingTickets(false);
    });

    return () => unsubscribe();
  }, [user?.uid, effectiveIsAdmin]);

  // 2. Submit New Ticket Handler
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      if (onOpenAuth) onOpenAuth('login');
      return;
    }

    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    setTicketSubmitting(true);
    setSubmitSuccess(null);

    const generatedNumber = `#ZN-${Math.floor(10000 + Math.random() * 90000)}`;

    const newTicketData = {
      ticketNumber: generatedNumber,
      userId: user.uid,
      userName: user.displayName || userProfile?.displayName || user.email?.split('@')[0] || 'ZENET User',
      userEmail: user.email || '',
      userRole: userProfile?.role || 'buyer',
      category: ticketCategory,
      subject: ticketSubject.trim(),
      message: ticketMessage.trim(),
      status: 'open',
      priority: ticketPriority,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isReadByAdmin: false,
      isReadByUser: true,
      messages: [
        {
          id: `msg_${Date.now()}`,
          senderId: user.uid,
          senderName: user.displayName || userProfile?.displayName || user.email?.split('@')[0] || 'User',
          senderRole: (effectiveIsOwner ? 'owner' : effectiveIsAdmin ? 'admin' : 'user') as 'owner' | 'admin' | 'user',
          message: ticketMessage.trim(),
          createdAt: new Date().toISOString()
        }
      ]
    };

    try {
      await addDoc(collection(db, 'tickets'), newTicketData);
      setTicketSubject('');
      setTicketMessage('');
      setSubmitSuccess(`Support Ticket ${generatedNumber} submitted successfully! Our Escrow Support team will review it shortly.`);
      setTimeout(() => setSubmitSuccess(null), 8000);
    } catch (err: any) {
      console.error('Error submitting ticket to Firestore:', err);
      alert('Failed to submit support ticket: ' + (err.message || 'Error occurred'));
    } finally {
      setTicketSubmitting(false);
    }
  };

  // 3. Admin / User Reply to Ticket Handler
  const handleSendReply = async () => {
    if (!selectedTicket || !adminReplyText.trim() || !user) return;

    setIsUpdatingTicket(true);
    try {
      const ticketDocRef = doc(db, 'tickets', selectedTicket.id);
      const isSenderAdmin = effectiveIsAdmin;

      const newMessage: TicketMessage = {
        id: `msg_${Date.now()}`,
        senderId: user.uid,
        senderName: effectiveIsOwner ? 'Musharaf Azeez (OWNER)' : effectiveIsAdmin ? 'ZENET Moderator (ADMIN)' : (user.displayName || userProfile?.displayName || 'User'),
        senderRole: effectiveIsOwner ? 'owner' : effectiveIsAdmin ? 'admin' : 'user',
        message: adminReplyText.trim(),
        createdAt: new Date().toISOString()
      };

      const updatedMessages = [...(selectedTicket.messages || []), newMessage];

      const updatePayload: any = {
        messages: updatedMessages,
        updatedAt: new Date().toISOString(),
        status: isSenderAdmin ? adminNewStatus : 'open',
        isReadByAdmin: isSenderAdmin ? true : false,
        isReadByUser: isSenderAdmin ? false : true
      };

      if (isSenderAdmin) {
        updatePayload.adminResponse = adminReplyText.trim();
        updatePayload.respondedBy = effectiveIsOwner ? 'Musharaf Azeez (OWNER)' : 'Admin';
      }

      await updateDoc(ticketDocRef, updatePayload);
      setAdminReplyText('');
    } catch (err: any) {
      console.error('Failed updating ticket:', err);
      alert('Failed to send reply: ' + (err.message || 'Error occurred'));
    } finally {
      setIsUpdatingTicket(false);
    }
  };

  // Filtered Tickets for Admin/User view
  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNum = t.ticketNumber?.toLowerCase().includes(q);
      const matchSubject = t.subject?.toLowerCase().includes(q);
      const matchEmail = t.userEmail?.toLowerCase().includes(q);
      const matchName = t.userName?.toLowerCase().includes(q);
      if (!matchNum && !matchSubject && !matchEmail && !matchName) return false;
    }
    return true;
  });

  const faqs = [
    {
      q: 'How does ZENET Escrow Protection keep my money safe?',
      a: 'When you purchase an account on ZENET Hub, your funds are NOT sent directly to the seller. Instead, they are held in our encrypted Escrow Vault for 7 full days. Once you log in, inspect the credentials, change security emails/passwords, and confirm complete ownership, you release the escrow verification token. If the seller fails to deliver or credentials are invalid, you receive a 100% money-back refund.'
    },
    {
      q: 'How fast will I receive my purchased account credentials?',
      a: '95% of accounts listed on ZENET Hub are delivered instantly upon successful payment. For high-tier accounts requiring 2FA secret key transfers or custom original email handovers, the seller is given a maximum 2-hour window to complete the secure transfer in our chat portal.'
    },
    {
      q: 'What should I do immediately after receiving account details?',
      a: '1. Change the primary login password.\n2. Add your own phone number and recovery email.\n3. Turn on 2FA (Two-Factor Authentication) using an authenticator app.\n4. Log out all unknown active sessions.\n5. Inspect profile settings for 24 hours before releasing the escrow token.'
    },
    {
      q: 'What happens if the seller changes password after purchase?',
      a: 'Our 7-Day Escrow Warranty covers account reclamation issues. If an account is reclaimed within 7 days of purchase, submit a ticket under "Order Dispute" or "Escrow Problem". Our moderation team will freeze the funds in escrow, investigate the audit log, and issue a full refund to your wallet if reclamation is verified.'
    },
    {
      q: 'What payment methods are supported on ZENET Hub?',
      a: 'We support automated bank transfers via your dedicated Paystack Virtual Account and instant ZENET Wallet Escrow checkout.'
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl mx-auto pb-12 select-none text-[#0F172A]">
      
      {/* Top Banner */}
      <div className="bg-[#F8F7FD] border border-[#EBE7F7] p-6 sm:p-8 rounded-3xl space-y-3 shadow-xs relative overflow-hidden">
        {onBackToMarketplace && (
          <button
            type="button"
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'instant' });
              onBackToMarketplace();
            }}
            className="inline-flex items-center gap-2 text-[#64748B] hover:text-[#0F172A] font-extrabold text-xs transition bg-white px-4 py-2 rounded-xl border border-[#EBE7F7] cursor-pointer shadow-2xs relative z-10 active:scale-95"
            title="Back to Marketplace"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Marketplace</span>
          </button>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#EDE9FE] text-[#5B4DF5] border border-[#DDD6FE] text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-[#5B4DF5]" />
            <span>Central Support & Escrow Resolution Center</span>
          </div>

          {effectiveIsAdmin && (
            <span className="bg-amber-500 text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-white" />
              {effectiveIsOwner ? 'OWNER MODERATION PANEL' : 'ADMIN SUPPORT PANEL'}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-[#0F172A] tracking-tight relative z-10">
          {effectiveIsAdmin ? 'Support & Escalated Dispute Management' : 'How can we help you today?'}
        </h1>

        <p className="text-xs sm:text-sm text-[#64748B] max-w-3xl leading-relaxed relative z-10">
          All customer issues, order disputes, escrow holds, payment verification, delivery concerns, and platform reports are handled centrally through our encrypted Support & Ticket system.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 relative z-10">
          <div className="bg-white border border-[#EBE7F7] p-3.5 rounded-2xl flex items-center gap-3 shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#0F172A] block">7-Day Escrow Guarantee</span>
              <span className="text-[10px] text-[#64748B] font-semibold block">Full refund warranty protection</span>
            </div>
          </div>

          <div className="bg-white border border-[#EBE7F7] p-3.5 rounded-2xl flex items-center gap-3 shadow-2xs">
            <Clock className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#0F172A] block">Average Reply: &lt; 30 Mins</span>
              <span className="text-[10px] text-[#64748B] font-semibold block">24/7 Moderation Desk</span>
            </div>
          </div>

          <div className="bg-white border border-[#EBE7F7] p-3.5 rounded-2xl flex items-center gap-3 shadow-2xs">
            <Lock className="w-5 h-5 text-[#5B4DF5] shrink-0" />
            <div>
              <span className="text-xs font-bold text-[#0F172A] block">Centralized Ticket System</span>
              <span className="text-[10px] text-[#64748B] font-semibold block">End-to-end issue logging</span>
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN OR OWNER SUPPORT MANAGEMENT DASHBOARD */}
      {effectiveIsAdmin && (
        <div className="bg-white border border-[#EBE7F7] p-5 sm:p-6 rounded-3xl space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#EBE7F7]">
            <div>
              <h2 className="text-lg font-black text-[#0F172A] flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-500" />
                <span>All Customer Tickets & Disputes ({tickets.length})</span>
              </h2>
              <p className="text-xs text-[#64748B]">
                Logged user issues requiring admin review, response, or escrow intervention
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-amber-50 text-amber-700 border border-amber-200 font-bold px-3 py-1 rounded-xl">
                Open: <strong>{tickets.filter(t => t.status === 'open').length}</strong>
              </span>
              <span className="bg-[#EDE9FE] text-[#5B4DF5] border border-[#DDD6FE] font-bold px-3 py-1 rounded-xl">
                In Progress: <strong>{tickets.filter(t => t.status === 'in_progress').length}</strong>
              </span>
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-3 py-1 rounded-xl">
                Resolved: <strong>{tickets.filter(t => t.status === 'resolved').length}</strong>
              </span>
            </div>
          </div>

          {/* Admin Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search ticket #, email, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] pl-9 pr-3 py-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs placeholder-[#94A3B8]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs font-bold"
            >
              <option value="all">All Ticket Statuses</option>
              <option value="open">Open / Pending Review</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs font-bold"
            >
              <option value="all">All Categories</option>
              <option value="product_issue">Product / Delivery Issue</option>
              <option value="order_dispute">Order Dispute</option>
              <option value="payment_escrow">Payment / Escrow Deposit</option>
              <option value="account">Account Problem</option>
              <option value="report">Report Violation</option>
              <option value="general">General Inquiry</option>
            </select>
          </div>

          {/* Tickets List for Admin */}
          {loadingTickets ? (
            <div className="py-12 text-center text-[#64748B] text-xs font-bold">
              Loading support tickets from Firestore...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-12 text-center text-[#64748B] text-xs bg-[#F8F7FD] rounded-2xl border border-[#EBE7F7] p-6">
              No tickets found matching current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTickets.map((ticket) => {
                const isSelected = selectedTicket?.id === ticket.id;
                const isUnreadByAdmin = ticket.isReadByAdmin === false;

                return (
                  <div
                    key={ticket.id}
                    className={`bg-[#F8F7FD] border rounded-2xl p-4 transition ${
                      isSelected
                        ? 'border-[#5B4DF5] ring-2 ring-[#5B4DF5]/20 bg-white shadow-md'
                        : isUnreadByAdmin
                        ? 'border-[#5B4DF5] bg-white'
                        : 'border-[#EBE7F7] hover:border-[#DDD6FE]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {ticket.ticketNumber || '#ZN-00000'}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                            ticket.status === 'open'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : ticket.status === 'in_progress'
                              ? 'bg-[#EDE9FE] text-[#5B4DF5] border border-[#DDD6FE]'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                          {isUnreadByAdmin && (
                            <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                              NEW UNREAD
                            </span>
                          )}
                          <span className="text-[10px] text-[#64748B] font-semibold">
                            {ticket.category.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-[#0F172A] text-sm">{ticket.subject}</h3>
                        <p className="text-xs text-[#64748B] line-clamp-2">{ticket.message}</p>
                        <p className="text-[11px] text-[#94A3B8] font-mono">
                          Submitted by: <strong className="text-[#0F172A]">{ticket.userName}</strong> ({ticket.userEmail}) • {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedTicket(isSelected ? null : ticket)}
                        className="bg-white hover:bg-[#F8F7FD] text-[#0F172A] font-bold px-4 py-2 rounded-xl text-xs border border-[#EBE7F7] transition cursor-pointer shrink-0 shadow-2xs"
                      >
                        {isSelected ? 'Close Ticket Details' : 'Manage & Reply'}
                      </button>
                    </div>

                    {/* Expanded Detail & Admin Reply Box */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-[#EBE7F7] space-y-4 bg-white p-4 rounded-xl border border-[#EBE7F7]">
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-[#0F172A] text-xs uppercase tracking-wider">
                            Ticket Message History & Conversation Thread
                          </h4>
                          
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {(ticket.messages && ticket.messages.length > 0) ? (
                              ticket.messages.map((msg, i) => (
                                <div 
                                  key={msg.id || i}
                                  className={`p-3 rounded-xl text-xs space-y-1 ${
                                    msg.senderRole === 'owner' || msg.senderRole === 'admin'
                                      ? 'bg-[#EDE9FE] border border-[#DDD6FE] ml-4'
                                      : 'bg-[#F8F7FD] border border-[#EBE7F7] mr-4'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className={`font-bold ${msg.senderRole === 'owner' ? 'text-amber-700 font-extrabold' : msg.senderRole === 'admin' ? 'text-[#5B4DF5]' : 'text-emerald-700'}`}>
                                      {msg.senderName} ({msg.senderRole.toUpperCase()})
                                    </span>
                                    <span className="text-[#64748B] font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-[#0F172A] whitespace-pre-wrap">{msg.message}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-3 bg-[#F8F7FD] rounded-xl text-xs text-[#0F172A]">
                                <p className="whitespace-pre-wrap">{ticket.message}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Bar */}
                        <div className="space-y-3 pt-2 border-t border-[#EBE7F7]">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <label className="text-xs font-bold text-[#0F172A]">Send Admin / Moderator Response:</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-[#64748B] font-semibold">Update Status:</span>
                              <select
                                value={adminNewStatus}
                                onChange={(e) => setAdminNewStatus(e.target.value as any)}
                                className="bg-[#F8F7FD] text-[#0F172A] px-2.5 py-1 rounded-lg border border-[#EBE7F7] text-xs font-bold"
                              >
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                                <option value="open">Re-open Ticket</option>
                              </select>
                            </div>
                          </div>

                          <textarea
                            rows={3}
                            value={adminReplyText}
                            onChange={(e) => setAdminReplyText(e.target.value)}
                            placeholder="Type official response to user here..."
                            className="w-full bg-[#F8F7FD] text-[#0F172A] p-3 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs resize-none placeholder-[#94A3B8]"
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleSendReply}
                              disabled={isUpdatingTicket || !adminReplyText.trim()}
                              className="bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-extrabold text-xs py-2 px-5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{isUpdatingTicket ? 'Updating Ticket...' : 'Send Official Response'}</span>
                            </button>
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* MAIN GRID FOR NORMAL USERS & SUBMITTING TICKETS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Submit Ticket or User's Active Tickets */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* User's Ticket History */}
          {user && (
            <div className="bg-white border border-[#EBE7F7] p-5 sm:p-6 rounded-3xl space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-[#EBE7F7]">
                <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-[#5B4DF5]" />
                  My Support Tickets ({tickets.length})
                </h2>
                <span className="text-[11px] text-[#64748B] font-semibold">Live Ticket Tracking</span>
              </div>

              {tickets.length === 0 ? (
                <div className="py-8 text-center text-[#64748B] text-xs bg-[#F8F7FD] rounded-2xl border border-[#EBE7F7] p-4">
                  You have not submitted any support tickets yet. Use the form on the right to open a ticket if you need assistance.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {tickets.map((t) => {
                    const hasAdminResponse = !!t.adminResponse;

                    return (
                      <div key={t.id} className="bg-[#F8F7FD] border border-[#EBE7F7] p-4 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            {t.ticketNumber || '#ZN-00000'}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                            t.status === 'open'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : t.status === 'in_progress'
                              ? 'bg-[#EDE9FE] text-[#5B4DF5] border border-[#DDD6FE]'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-[#0F172A] text-xs">{t.subject}</h4>
                        <p className="text-[11px] text-[#64748B]">{t.message}</p>

                        {/* Admin reply section */}
                        {hasAdminResponse && (
                          <div className="bg-white border border-[#DDD6FE] p-3 rounded-xl mt-2 space-y-1 shadow-2xs">
                            <div className="flex items-center justify-between text-[10px] font-bold text-[#5B4DF5]">
                              <span>Official Support Response ({t.respondedBy || 'Moderator'}):</span>
                              <span className="text-[#64748B] font-mono">{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : ''}</span>
                            </div>
                            <p className="text-xs text-[#0F172A] whitespace-pre-wrap">{t.adminResponse}</p>
                          </div>
                        )}

                        <div className="text-[10px] text-[#94A3B8] font-mono pt-1">
                          Submitted: {new Date(t.createdAt).toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* FAQs Accordion */}
          <div className="space-y-4">
            <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#5B4DF5]" />
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;

                return (
                  <div
                    key={idx}
                    className="bg-white border border-[#EBE7F7] rounded-2xl overflow-hidden transition shadow-xs"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 text-xs sm:text-sm font-extrabold text-[#0F172A] hover:text-[#5B4DF5] transition cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-[#5B4DF5] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#64748B] shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-[#64748B] leading-relaxed border-t border-[#EBE7F7] bg-[#F8F7FD]">
                        <p className="whitespace-pre-line">{faq.a}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right 1 Col: Create Ticket Form */}
        <div className="bg-white border border-[#EBE7F7] p-5 sm:p-6 rounded-3xl space-y-4 shadow-xs self-start">
          <div className="space-y-1 pb-2 border-b border-[#EBE7F7]">
            <h3 className="font-extrabold text-[#0F172A] text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#5B4DF5]" />
              Submit Support Ticket
            </h3>
            <p className="text-xs text-[#64748B]">
              Direct encrypted line to ZENET Escrow Moderators
            </p>
          </div>

          {submitSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleTicketSubmit} className="space-y-3">
            <div>
              <label className="block text-[#0F172A] font-semibold mb-1 text-xs">Issue Category</label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as any)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs font-bold"
              >
                <option value="general">💬 General Inquiry</option>
                <option value="product_issue">📦 Product / Delivery Problem</option>
                <option value="order_dispute">⚡ Order / Seller Dispute</option>
                <option value="payment_escrow">💳 Payment / Virtual Account Deposit</option>
                <option value="account">👤 Account / Login Problem</option>
                <option value="report">🚨 Report Abuse or Scam</option>
              </select>
            </div>

            <div>
              <label className="block text-[#0F172A] font-semibold mb-1 text-xs">Priority Level</label>
              <select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs font-bold"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Escrow Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-[#0F172A] font-semibold mb-1 text-xs">Subject / Title</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Virtual Account Deposit Pending / Credentials Login Error"
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs placeholder-[#94A3B8]"
              />
            </div>

            <div>
              <label className="block text-[#0F172A] font-semibold mb-1 text-xs">Detailed Description</label>
              <textarea
                required
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe your issue, order ID, or transaction reference here..."
                className="w-full bg-[#F8F7FD] text-[#0F172A] p-2.5 rounded-xl border border-[#EBE7F7] focus:outline-none focus:border-[#5B4DF5] text-xs resize-none placeholder-[#94A3B8]"
              />
            </div>

            <button
              type="submit"
              disabled={ticketSubmitting}
              className="w-full bg-[#5B4DF5] hover:bg-[#4838EE] text-white font-extrabold text-xs py-2.5 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {ticketSubmitting ? (
                <span>Submitting Ticket...</span>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Ticket to Moderation</span>
                </>
              )}
            </button>
          </form>

          {/* Direct Support Info */}
          <div className="pt-3 border-t border-[#EBE7F7] space-y-2 text-[11px] text-[#64748B]">
            <span className="font-bold text-[#0F172A] block">Official Channel Direct Info:</span>
            <div className="flex items-center gap-2 text-[#0F172A]">
              <Mail className="w-3.5 h-3.5 text-[#5B4DF5]" />
              <span>support@zenetmarket.com</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>WhatsApp Support: +234 800 ZENET SAFE</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
