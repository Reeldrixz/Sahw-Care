"use client";

import {
  Bell, CheckCircle, XCircle, Clock, Heart, AlertTriangle, Package, Gift,
  MessageSquare, Shield, ShieldCheck, ShieldX, MessageCircle, Star,
  TrendingUp, TrendingDown, Crown, Unlock, type LucideIcon,
} from "lucide-react";

export interface Notif {
  id: string;
  type: string;
  title: string | null;
  message: string;
  isRead: boolean;
  actionLabel: string | null;
  link: string | null;
  createdAt: string;
}

interface TypeConfig {
  Icon: LucideIcon;
  iconColor: string;
  iconBg: string;
}

const TYPE_CONFIG: Record<string, TypeConfig> = {
  REQUEST_ACCEPTED:         { Icon: CheckCircle,    iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  FULFILLMENT_CONFIRMED:    { Icon: CheckCircle,    iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  REQUEST_DECLINED:         { Icon: XCircle,        iconColor: "#c0392b", iconBg: "#fdecea" },
  REQUEST_RECEIVED:         { Icon: Bell,           iconColor: "#d97706", iconBg: "#fff8ed" },
  ITEM_RESERVED:            { Icon: Clock,          iconColor: "#d97706", iconBg: "#fff8ed" },
  ITEM_FULFILLED:           { Icon: Heart,          iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  DELIVERY_CONFIRMED:       { Icon: Heart,          iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  ITEM_DELIVERED:           { Icon: Heart,          iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  FULFILLMENT_DISPUTED:     { Icon: AlertTriangle,  iconColor: "#c0392b", iconBg: "#fdecea" },
  BUNDLE_UPDATE:            { Icon: Package,        iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  BUNDLE_DELIVERED:         { Icon: Package,        iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  BUNDLE_GOAL_MET:          { Icon: Gift,           iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  BUNDLE_ALLOCATION_CONFIRM:{ Icon: Package,        iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  ITEM_FULLY_FUNDED:        { Icon: Gift,           iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  ITEM_PURCHASED:           { Icon: Package,        iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  ITEM_DISPATCHED:          { Icon: Package,        iconColor: "#d97706", iconBg: "#fff8ed" },
  ADMIN_MESSAGE:            { Icon: MessageSquare,  iconColor: "#6366f1", iconBg: "#eef2ff" },
  MODERATION_ACTION:        { Icon: Shield,         iconColor: "#c0392b", iconBg: "#fdecea" },
  RBW_RESTRICTION:          { Icon: Shield,         iconColor: "#c0392b", iconBg: "#fdecea" },
  REPORT_CONFIRMED:         { Icon: Shield,         iconColor: "#d97706", iconBg: "#fff8ed" },
  VERIFICATION_APPROVED:    { Icon: ShieldCheck,    iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  MANUAL_VERIFIED:          { Icon: ShieldCheck,    iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  VERIFICATION_REJECTED:    { Icon: ShieldX,        iconColor: "#c0392b", iconBg: "#fdecea" },
  CIRCLE_REPLY:             { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  CIRCLE_THREAD_REPLY:      { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  CIRCLE_NEW_POST:          { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  NEW_POST:                 { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  REPLY:                    { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  THREAD_REPLY:             { Icon: MessageCircle,  iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  CIRCLE_MILESTONE:         { Icon: Star,           iconColor: "#d97706", iconBg: "#fff8ed" },
  TRUST_MILESTONE:          { Icon: TrendingUp,     iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  TRUST_WARNING:            { Icon: TrendingDown,   iconColor: "#d97706", iconBg: "#fff8ed" },
  DONOR_LEVEL_UP:           { Icon: Crown,          iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  REQUEST_LOCK_CLEARED:     { Icon: Unlock,         iconColor: "#1a7a5e", iconBg: "#e8f5f1" },
  FULFILLMENT_PENDING:      { Icon: Clock,          iconColor: "#d97706", iconBg: "#fff8ed" },
  FULFILLMENT_REMINDER:     { Icon: Bell,           iconColor: "#d97706", iconBg: "#fff8ed" },
};

const DEFAULT_CONFIG: TypeConfig = { Icon: Bell, iconColor: "#555555", iconBg: "#f5f5f5" };

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  notif: Notif;
  compact?: boolean;
  onRead: (id: string, link: string | null) => void;
}

export default function NotifCard({ notif, compact, onRead }: Props) {
  const cfg = TYPE_CONFIG[notif.type] ?? DEFAULT_CONFIG;
  const { Icon, iconColor, iconBg } = cfg;
  const pad = compact ? "10px 14px" : "14px 16px";
  const iconSize = compact ? 34 : 38;
  const iconInner = compact ? 16 : 18;

  return (
    <button
      onClick={() => onRead(notif.id, notif.link)}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        width: "100%", padding: pad,
        borderBottom: "1px solid var(--border)",
        background: notif.isRead ? "white" : "#f0faf7",
        borderLeft: notif.isRead ? "none" : "3px solid #1a7a5e",
        border: "none", cursor: "pointer", textAlign: "left",
      }}
    >
      {/* Icon */}
      <div style={{
        width: iconSize, height: iconSize, borderRadius: "50%",
        background: iconBg, display: "flex", alignItems: "center",
        justifyContent: "center", flexShrink: 0,
      }}>
        <Icon size={iconInner} color={iconColor} strokeWidth={1.75} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {notif.title && (
          <div style={{
            fontSize: compact ? 12 : 13, fontWeight: 800,
            color: "#1a1a1a", fontFamily: "Nunito, sans-serif",
            marginBottom: 2, lineHeight: 1.3,
          }}>
            {notif.title}
          </div>
        )}
        <div style={{
          fontSize: compact ? 12 : 13, color: "#555555",
          fontFamily: "Nunito, sans-serif", lineHeight: 1.45,
          display: "-webkit-box", WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical", overflow: "hidden",
          marginBottom: 4,
        }}>
          {notif.message}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "Nunito, sans-serif" }}>
          {timeAgo(notif.createdAt)}
        </div>
      </div>

      {/* Action label */}
      {notif.actionLabel && notif.link && (
        <span style={{
          flexShrink: 0, alignSelf: "center",
          fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
          border: "1.5px solid #1a7a5e", color: "#1a7a5e",
          fontFamily: "Nunito, sans-serif", whiteSpace: "nowrap",
        }}>
          {notif.actionLabel}
        </span>
      )}
    </button>
  );
}
