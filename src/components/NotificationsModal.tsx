import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { 
  X, 
  Bell, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  CheckCheck,
  Package,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { db, getSafeIdToken } from '../lib/firebase';
import { isAuthorizedOwner } from '../lib/authorizedOwners';
import { safeApiFetch } from '../utils/api';
import { UserNotification, UserProfile } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  userProfile: UserProfile | null;
  onOpenLogApprove?: () => void;
  onOpenSellerDashboard?: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  user,
  userProfile,
  onOpenLogApprove,
  onOpenSellerDashboard
}) => {
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const isOwner = isAuthorizedOwner(user, userProfile);

  useEffect(() => {
    if (!isOpen || !user || !db) return;

    setLoading(true);

    // If owner, listen to notifications for user.uid and 'owner'
    const targetUids = isOwner ? [user.uid, 'owner'] : [user.uid];
    
    // Firestore 'in' query supports up to 10 values
    const q = query(
      collection(db, 'user_notifications'),
      where('userId', 'in', targetUids)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: UserNotification[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UserNotification, 'id'>)
      }));

      // Sort by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(items);
      setLoading(false);
    }, (err) => {
      console.warn('Notifications listener notice:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, user?.uid, isOwner]);

  if (!isOpen) return null;

  const handleMarkAsRead = async (notif: UserNotification) => {
    if (notif.read) return;
    try {
      if (db) {
        const notifRef = doc(db, 'user_notifications', notif.id);
        await updateDoc(notifRef, {
          read: true,
          readAt: new Date().toISOString()
        });
      }
    } catch {
      // Fallback to server endpoint
      const token = user ? await getSafeIdToken(user) : null;
      await safeApiFetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ notificationId: notif.id })
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (notifications.filter(n => !n.read).length === 0) return;
    setMarkingAll(true);
    try {
      const token = user ? await getSafeIdToken(user) : null;
      await safeApiFetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      // Local state update immediately
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.warn('Mark all read error:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Recently';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div 
      className="fixed inset-0 z-[170] bg-white md:bg-slate-900/60 md:backdrop-blur-xs flex flex-col md:items-center md:justify-center md:p-4 w-full h-[100dvh] max-h-[100dvh] overflow-hidden animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl mx-auto bg-white border-0 md:border md:border-[#EAE6F8] rounded-none md:rounded-3xl md:shadow-2xl flex flex-col h-full min-h-0 flex-1 md:flex-initial md:h-[88vh] md:max-h-[750px] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-4 py-3.5 border-b border-[#F1EEF9] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#EDE9FE] text-[#5B4DF5] flex items-center justify-center">
              <Bell className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-[#0F172A]">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-[#5B4DF5] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                disabled={markingAll}
                className="text-xs font-bold text-[#5B4DF5] hover:text-[#4838EE] px-2.5 py-1 rounded-lg hover:bg-[#F3EEFF] transition cursor-pointer flex items-center gap-1"
                title="Mark all notifications as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Mark all as read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-3.5 sm:p-4 overflow-y-auto overscroll-contain touch-pan-y space-y-2.5 flex-1 min-h-0 pb-24 md:pb-6">
          {loading ? (
            <div className="py-16 text-center text-xs text-[#64748B] font-semibold space-y-2">
              <div className="w-6 h-6 border-2 border-[#5B4DF5]/20 border-t-[#5B4DF5] rounded-full animate-spin mx-auto"></div>
              <p>Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF8FE] text-[#94A3B8] flex items-center justify-center mx-auto border border-[#EDE9FE]">
                <Bell className="w-5 h-5 opacity-40" />
              </div>
              <h4 className="text-sm font-bold text-[#0F172A]">No notifications yet</h4>
              <p className="text-xs text-[#64748B] max-w-xs mx-auto">
                Updates regarding your account submissions, stock approvals, and orders will appear here permanently.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              const isUnread = !notif.read;
              const isPendingStock = notif.type === 'stock_pending' || notif.type === 'stock_pending_approval';
              const isApprovedStock = notif.type === 'stock_approved';
              const isRejectedStock = notif.type === 'stock_rejected';

              return (
                <div
                  key={notif.id}
                  onClick={() => handleMarkAsRead(notif)}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 relative ${
                    isUnread
                      ? 'bg-[#F9F7FE] border-[#DDD6FE] shadow-2xs'
                      : 'bg-white border-[#EAE6F8] hover:bg-[#FAF9FF]'
                  }`}
                >
                  {/* Status Indicator Dot */}
                  {isUnread && (
                    <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-[#5B4DF5]"></span>
                  )}

                  {/* Icon Indicator */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isApprovedStock
                      ? 'bg-emerald-100 text-emerald-700'
                      : isRejectedStock
                      ? 'bg-rose-100 text-rose-700'
                      : isPendingStock
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-[#EDE9FE] text-[#5B4DF5]'
                  }`}>
                    {isApprovedStock ? (
                      <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
                    ) : isRejectedStock ? (
                      <AlertCircle className="w-4 h-4 stroke-[2.4]" />
                    ) : isPendingStock ? (
                      <Package className="w-4 h-4 stroke-[2.4]" />
                    ) : (
                      <Bell className="w-4 h-4 stroke-[2.4]" />
                    )}
                  </div>

                  {/* Notification Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-xs sm:text-sm truncate ${isUnread ? 'font-black text-[#0F172A]' : 'font-bold text-[#334155]'}`}>
                        {notif.title}
                      </h4>
                    </div>

                    <p className={`text-xs mt-1 leading-snug ${isUnread ? 'text-[#0F172A] font-semibold' : 'text-[#64748B]'}`}>
                      {notif.message}
                    </p>

                    {/* Rejection Reason Callout if rejected */}
                    {notif.rejectionReason && (
                      <div className="mt-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-0.5">
                        <span className="font-extrabold block text-[10px] uppercase text-rose-700">Rejection Reason:</span>
                        <p className="font-semibold">{notif.rejectionReason}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 pt-1 text-[11px] text-[#94A3B8]">
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3 h-3" />
                        <span>{formatTime(notif.createdAt)}</span>
                      </span>

                      {/* Quick action button based on notification type */}
                      {isPendingStock && isOwner && onOpenLogApprove && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif);
                            onClose();
                            onOpenLogApprove();
                          }}
                          className="font-extrabold text-[#5B4DF5] hover:text-[#4838EE] flex items-center gap-0.5 cursor-pointer text-[11px]"
                        >
                          <span>Review Stock</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}

                      {(isApprovedStock || isRejectedStock) && onOpenSellerDashboard && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif);
                            onClose();
                            onOpenSellerDashboard();
                          }}
                          className="font-extrabold text-[#5B4DF5] hover:text-[#4838EE] flex items-center gap-0.5 cursor-pointer text-[11px]"
                        >
                          <span>View My Listings</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
