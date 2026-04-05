"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  text: string;
  createdAt: string;
  sender: { id: string; name: string; avatar: string | null };
}

interface Conversation {
  id: string;
  participants: Array<{ userId: string; user: { id: string; name: string; avatar: string | null } }>;
  request: { item: { id: string; title: string; images: string[] } };
  messages: Message[];
}

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth");
  }, [user, authLoading, router]);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data.conversations ?? []);
      if (data.conversations?.length > 0 && !activeId) {
        setActiveId(data.conversations[0].id);
      }
    }
    setLoadingConvs(false);
  }, [activeId]);

  useEffect(() => { if (user) fetchConversations(); }, [user, fetchConversations]);

  const fetchMessages = useCallback(async (convId: string) => {
    const res = await fetch(`/api/conversations/${convId}/messages`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    }
  }, []);

  useEffect(() => {
    if (activeId) fetchMessages(activeId);
  }, [activeId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !activeId || sending) return;
    setSending(true);
    const text = input.trim();
    setInput("");

    const optimistic: Message = {
      id: Date.now().toString(),
      text,
      createdAt: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name, avatar: user!.avatar },
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await fetch(`/api/conversations/${activeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data.message : m))
      );
    }
    setSending(false);
  };

  const getOtherParticipant = (conv: Conversation) =>
    conv.participants.find((p) => p.userId !== user?.id)?.user;

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 172800000) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const activeConv = conversations.find((c) => c.id === activeId);
  const otherUser = activeConv ? getOtherParticipant(activeConv) : null;

  if (authLoading) return <div className="loading" style={{ minHeight: "100vh" }}><div className="spinner" /></div>;

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <div className="browse-header">
        <div className="browse-title">Messages</div>
      </div>

      <div style={{ height: "calc(100vh - 74px - 64px)", overflow: "hidden" }}>
        {loadingConvs ? (
          <div className="loading"><div className="spinner" /></div>
        ) : conversations.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💬</div>
            <div className="empty-title">No conversations yet</div>
            <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600 }}>Request an item to start chatting with a donor.</div>
          </div>
        ) : (
          <div className="chat-layout" style={{ height: "100%" }}>
            {/* Sidebar */}
            <div className="chat-sidebar">
              <div className="chat-sidebar-header">Conversations</div>
              {conversations.map((conv) => {
                const other = getOtherParticipant(conv);
                const lastMsg = conv.messages[0];
                const initials = other?.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "?";

                return (
                  <div
                    key={conv.id}
                    className={`chat-item ${activeId === conv.id ? "active" : ""}`}
                    onClick={() => setActiveId(conv.id)}
                  >
                    <div className="avatar">{initials}</div>
                    <div className="chat-item-info">
                      <div className="chat-item-name">{other?.name ?? "Unknown"}</div>
                      <div className="chat-item-preview">{lastMsg?.text ?? "No messages yet"}</div>
                      <div style={{ fontSize: 11, color: "var(--light)", marginTop: 2 }}>
                        re: {conv.request.item.title}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      {lastMsg && <div className="chat-item-time">{formatTime(lastMsg.createdAt)}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main chat */}
            <div className="chat-main">
              {activeConv ? (
                <>
                  <div className="chat-header">
                    <div className="avatar">
                      {otherUser?.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="chat-header-info">
                      <div className="chat-header-name">{otherUser?.name}</div>
                      <div className="chat-header-item">re: {activeConv.request.item.title}</div>
                    </div>
                    <button
                      style={{ fontSize: 12, padding: "6px 14px", background: "var(--green-light)", color: "var(--green)", border: "none", borderRadius: 20, fontWeight: 700, cursor: "pointer", fontFamily: "Nunito, sans-serif" }}
                      onClick={() => router.push(`/items/${activeConv.request.item.id}`)}
                    >
                      View Item
                    </button>
                  </div>

                  <div className="chat-messages">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`msg ${msg.sender.id === user?.id ? "mine" : "theirs"}`}>
                        <div className="msg-bubble">{msg.text}</div>
                        <div className="msg-time">{formatTime(msg.createdAt)}</div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="chat-input-area">
                    <textarea
                      className="chat-input"
                      rows={1}
                      placeholder="Type a message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                    />
                    <button className="btn-send" onClick={sendMessage} disabled={sending}>
                      →
                    </button>
                  </div>
                </>
              ) : (
                <div className="empty">
                  <div style={{ fontSize: 13, color: "var(--mid)", fontWeight: 600 }}>Select a conversation</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
