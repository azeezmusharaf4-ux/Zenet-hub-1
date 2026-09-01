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
  AlertCircle
} from 'lucide-react';
import { UserProfile, SupportTicket, TicketMessage } from '../types';

interface SupportViewProps {
  user?: User | null;
  userProfile?: UserProfile | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

export const SupportView: React.FC<SupportViewProps> = ({
  user,
  userProfile,
  isOwner = false,
  isAdmin = false,
  onOpenAuth
}) => {
  const effectiveIsOwner = isOwner || userProfile?.role === 'owner' || user?.email === 'azeezmusharaf4@gmail.com';
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
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl mx-auto pb-12 select-none">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950/90 via-[#170a33] to-indigo-950/90 border border-[#381d6d] p-6 sm:p-8 rounded-3xl space-y-3 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>Central Support & Escrow Resolution Center</span>
          </div>

          {effectiveIsAdmin && (
            <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-md">
              <ShieldCheck className="w-4 h-4 text-slate-950" />
              {effectiveIsOwner ? 'OWNER MODERATION PANEL' : 'ADMIN SUPPORT PANEL'}
            </span>
          )}
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight relative z-10">
          {effectiveIsAdmin ? 'Support & Escalated Dispute Management' : 'How can we help you today?'}
        </h1>

        <p className="text-xs sm:text-sm text-purple-200/80 max-w-3xl leading-relaxed relative z-10">
          All customer issues, order disputes, escrow holds, payment verification, delivery concerns, and platform reports are handled centrally through our encrypted Support & Ticket system.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 relative z-10">
          <div className="bg-[#150a2b] border border-[#2e1952] p-3.5 rounded-2xl flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-white block">7-Day Escrow Guarantee</span>
              <span className="text-[10px] text-purple-300/60 font-semibold block">Full refund warranty protection</span>
            </div>
          </div>

          <div className="bg-[#150a2b] border border-[#2e1952] p-3.5 rounded-2xl flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-white block">Average Reply: &lt; 30 Mins</span>
              <span className="text-[10px] text-purple-300/60 font-semibold block">24/7 Moderation Desk</span>
            </div>
          </div>

          <div className="bg-[#150a2b] border border-[#2e1952] p-3.5 rounded-2xl flex items-center gap-3">
            <Lock className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-xs font-bold text-white block">Centralized Ticket System</span>
              <span className="text-[10px] text-purple-300/60 font-semibold block">End-to-end issue logging</span>
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN OR OWNER SUPPORT MANAGEMENT DASHBOARD */}
      {effectiveIsAdmin && (
        <div className="bg-[#120826] border border-[#2c1752] p-5 sm:p-6 rounded-3xl space-y-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#261448]">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-amber-400" />
                <span>All Customer Tickets & Disputes ({tickets.length})</span>
              </h2>
              <p className="text-xs text-purple-300/70">
                Logged user issues requiring admin review, response, or escrow intervention
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold px-3 py-1 rounded-xl">
                Open: <strong>{tickets.filter(t => t.status === 'open').length}</strong>
              </span>
              <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold px-3 py-1 rounded-xl">
                In Progress: <strong>{tickets.filter(t => t.status === 'in_progress').length}</strong>
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold px-3 py-1 rounded-xl">
                Resolved: <strong>{tickets.filter(t => t.status === 'resolved').length}</strong>
              </span>
            </div>
          </div>

          {/* Admin Search & Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search ticket #, email, subject..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d051a] text-white pl-9 pr-3 py-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-[#0d051a] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs font-bold"
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
              className="bg-[#0d051a] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs font-bold"
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
            <div className="py-12 text-center text-purple-300/70 text-xs font-bold">
              Loading support tickets from Firestore...
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="py-12 text-center text-purple-300/60 text-xs bg-[#0c051a] rounded-2xl border border-[#231244] p-6">
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
                    className={`bg-[#0d051a] border rounded-2xl p-4 transition ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-lg'
                        : isUnreadByAdmin
                        ? 'border-purple-500/80 bg-[#150a2b]'
                        : 'border-[#261448] hover:border-[#3d1f70]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                            {ticket.ticketNumber || '#ZN-00000'}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                            ticket.status === 'open'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : ticket.status === 'in_progress'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                          {isUnreadByAdmin && (
                            <span className="bg-rose-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">
                              NEW UNREAD
                            </span>
                          )}
                          <span className="text-[10px] text-purple-300/60 font-semibold">
                            {ticket.category.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-white text-sm">{ticket.subject}</h3>
                        <p className="text-xs text-purple-200/80 line-clamp-2">{ticket.message}</p>
                        <p className="text-[11px] text-purple-300/60 font-mono">
                          Submitted by: <strong className="text-white">{ticket.userName}</strong> ({ticket.userEmail}) • {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedTicket(isSelected ? null : ticket)}
                        className="bg-[#241247] hover:bg-[#321961] text-white font-bold px-4 py-2 rounded-xl text-xs border border-[#3f1f78] transition cursor-pointer shrink-0"
                      >
                        {isSelected ? 'Close Ticket Details' : 'Manage & Reply'}
                      </button>
                    </div>

                    {/* Expanded Detail & Admin Reply Box */}
                    {isSelected && (
                      <div className="mt-4 pt-4 border-t border-[#261448] space-y-4 bg-[#120726] p-4 rounded-xl">
                        <div className="space-y-2">
                          <h4 className="font-extrabold text-purple-300 text-xs uppercase tracking-wider">
                            Ticket Message History & Conversation Thread
                          </h4>
                          
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {(ticket.messages && ticket.messages.length > 0) ? (
                              ticket.messages.map((msg, i) => (
                                <div 
                                  key={msg.id || i}
                                  className={`p-3 rounded-xl text-xs space-y-1 ${
                                    msg.senderRole === 'owner' || msg.senderRole === 'admin'
                                      ? 'bg-purple-950/80 border border-purple-500/30 ml-4'
                                      : 'bg-[#0a0314] border border-[#28134d] mr-4'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className={`font-bold ${msg.senderRole === 'owner' ? 'text-amber-400 font-extrabold' : msg.senderRole === 'admin' ? 'text-purple-300' : 'text-emerald-400'}`}>
                                      {msg.senderName} ({msg.senderRole.toUpperCase()})
                                    </span>
                                    <span className="text-purple-300/50 font-mono">{new Date(msg.createdAt).toLocaleString()}</span>
                                  </div>
                                  <p className="text-white whitespace-pre-wrap">{msg.message}</p>
                                </div>
                              ))
                            ) : (
                              <div className="p-3 bg-[#0a0314] rounded-xl text-xs text-white">
                                <p className="whitespace-pre-wrap">{ticket.message}</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Bar */}
                        <div className="space-y-3 pt-2 border-t border-[#261448]">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <label className="text-xs font-bold text-white">Send Admin / Moderator Response:</label>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-purple-300/70 font-semibold">Update Status:</span>
                              <select
                                value={adminNewStatus}
                                onChange={(e) => setAdminNewStatus(e.target.value as any)}
                                className="bg-[#0c051a] text-white px-2.5 py-1 rounded-lg border border-[#3d1f70] text-xs font-bold"
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
                            className="w-full bg-[#080212] text-white p-3 rounded-xl border border-[#351966] focus:outline-none focus:border-amber-500 text-xs resize-none"
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={handleSendReply}
                              disabled={isUpdatingTicket || !adminReplyText.trim()}
                              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs py-2 px-5 rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
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
            <div className="bg-[#120826] border border-[#2c1752] p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-[#261448]">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-purple-400" />
                  My Support Tickets ({tickets.length})
                </h2>
                <span className="text-[11px] text-purple-300/60 font-semibold">Live Ticket Tracking</span>
              </div>

              {tickets.length === 0 ? (
                <div className="py-8 text-center text-purple-300/60 text-xs bg-[#0c051a] rounded-2xl border border-[#231244] p-4">
                  You have not submitted any support tickets yet. Use the form on the right to open a ticket if you need assistance.
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {tickets.map((t) => {
                    const hasAdminResponse = !!t.adminResponse;

                    return (
                      <div key={t.id} className="bg-[#0c051a] border border-[#28134d] p-4 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                            {t.ticketNumber || '#ZN-00000'}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                            t.status === 'open'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : t.status === 'in_progress'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-white text-xs">{t.subject}</h4>
                        <p className="text-[11px] text-purple-200/80">{t.message}</p>

                        {/* Admin reply section */}
                        {hasAdminResponse && (
                          <div className="bg-[#180a33] border border-purple-500/30 p-3 rounded-xl mt-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] font-bold text-amber-400">
                              <span>Official Support Response ({t.respondedBy || 'Moderator'}):</span>
                              <span className="text-purple-300/50 font-mono">{t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : ''}</span>
                            </div>
                            <p className="text-xs text-white whitespace-pre-wrap">{t.adminResponse}</p>
                          </div>
                        )}

                        <div className="text-[10px] text-purple-300/50 font-mono pt-1">
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
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-purple-400" />
              Frequently Asked Questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx;

                return (
                  <div
                    key={idx}
                    className="bg-[#120826] border border-[#2c1752] rounded-2xl overflow-hidden transition"
                  >
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left p-4 flex items-center justify-between gap-3 text-xs sm:text-sm font-extrabold text-white hover:text-purple-300 transition cursor-pointer"
                    >
                      <span>{faq.q}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-purple-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" />
                      )}
                    </button>

                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-purple-200/80 leading-relaxed border-t border-[#231244] bg-[#0c051a]">
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
        <div className="bg-[#120826] border border-[#2c1752] p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl self-start">
          <div className="space-y-1 pb-2 border-b border-[#261448]">
            <h3 className="font-extrabold text-white text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-purple-400" />
              Submit Support Ticket
            </h3>
            <p className="text-xs text-purple-300/70">
              Direct encrypted line to ZENET Escrow Moderators
            </p>
          </div>

          {submitSuccess && (
            <div className="bg-emerald-950/80 border border-emerald-500/50 p-3 rounded-2xl text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{submitSuccess}</span>
            </div>
          )}

          <form onSubmit={handleTicketSubmit} className="space-y-3">
            <div>
              <label className="block text-purple-300/80 font-semibold mb-1 text-xs">Issue Category</label>
              <select
                value={ticketCategory}
                onChange={(e) => setTicketCategory(e.target.value as any)}
                className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs font-bold"
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
              <label className="block text-purple-300/80 font-semibold mb-1 text-xs">Priority Level</label>
              <select
                value={ticketPriority}
                onChange={(e) => setTicketPriority(e.target.value as any)}
                className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs font-bold"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
                <option value="urgent">Urgent Escrow Hold</option>
              </select>
            </div>

            <div>
              <label className="block text-purple-300/80 font-semibold mb-1 text-xs">Subject / Title</label>
              <input
                type="text"
                required
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="e.g. Virtual Account Deposit Pending / Credentials Login Error"
                className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>

            <div>
              <label className="block text-purple-300/80 font-semibold mb-1 text-xs">Detailed Description</label>
              <textarea
                required
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Describe your issue, order ID, or transaction reference here..."
                className="w-full bg-[#100722] text-white p-2.5 rounded-xl border border-[#2d1850] focus:outline-none focus:border-purple-500 text-xs resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={ticketSubmitting}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-lg transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
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
          <div className="pt-3 border-t border-[#231244] space-y-2 text-[11px] text-purple-300/70">
            <span className="font-bold text-white block">Official Channel Direct Info:</span>
            <div className="flex items-center gap-2 text-purple-200">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>support@zenetmarket.com</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>WhatsApp Support: +234 800 ZENET SAFE</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
