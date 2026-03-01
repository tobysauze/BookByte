"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import {
  Send,
  BookOpen,
  Bot,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Book = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  category: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function ChatClient() {
  const [books, setBooks] = useState<Book[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [bookSearch, setBookSearch] = useState("");
  const [booksLoading, setBooksLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/user-library-books")
      .then((r) => r.json())
      .then((data) => setBooks(data.books || []))
      .catch(() => {})
      .finally(() => setBooksLoading(false));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const toggleBook = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming || selectedIds.size === 0) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          bookIds: Array.from(selectedIds),
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `Error: ${err.error || "Failed to get response"}` }
              : m,
          ),
        );
        setIsStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id
                    ? { ...m, content: m.content + delta }
                    : m,
                ),
              );
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Error: Failed to connect to the AI service." }
            : m,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredBooks = bookSearch
    ? books.filter(
        (b) =>
          b.title.toLowerCase().includes(bookSearch.toLowerCase()) ||
          (b.author && b.author.toLowerCase().includes(bookSearch.toLowerCase())),
      )
    : books;

  const selectedBooks = books.filter((b) => selectedIds.has(b.id));

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Book selector sidebar */}
      <aside
        className={`flex-shrink-0 border-r border-[rgb(var(--border))] bg-[rgb(var(--card))] transition-all duration-200 ${
          sidebarOpen ? "w-72" : "w-0"
        } overflow-hidden`}
      >
        <div className="flex h-full w-72 flex-col">
          <div className="border-b border-[rgb(var(--border))] p-4">
            <h2 className="text-sm font-semibold mb-2">
              Select books ({selectedIds.size}/10)
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[rgb(var(--muted-foreground))]" />
              <Input
                placeholder="Search books..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
              {bookSearch && (
                <button
                  onClick={() => setBookSearch("")}
                  className="absolute right-2 top-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {booksLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--muted-foreground))]" />
              </div>
            ) : filteredBooks.length === 0 ? (
              <p className="text-xs text-[rgb(var(--muted-foreground))] text-center py-8">
                {bookSearch ? "No matching books" : "No books available"}
              </p>
            ) : (
              filteredBooks.map((book) => {
                const isSelected = selectedIds.has(book.id);
                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => toggleBook(book.id)}
                    disabled={!isSelected && selectedIds.size >= 10}
                    className={`flex w-full items-center gap-2.5 rounded-lg p-2 text-left transition-colors ${
                      isSelected
                        ? "bg-[rgb(var(--accent))]/10 ring-1 ring-[rgb(var(--accent))]/30"
                        : "hover:bg-[rgb(var(--muted))]"
                    } ${!isSelected && selectedIds.size >= 10 ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="relative h-12 w-8 flex-shrink-0 overflow-hidden rounded bg-[rgb(var(--muted))]">
                      {book.cover_url ? (
                        <Image
                          src={book.cover_url}
                          alt={book.title}
                          fill
                          sizes="32px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[rgb(var(--accent))] to-purple-500 text-[8px] font-bold text-white">
                          {book.title.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {book.title}
                      </p>
                      {book.author && (
                        <p className="text-[10px] text-[rgb(var(--muted-foreground))] truncate">
                          {book.author}
                        </p>
                      )}
                    </div>
                    <div
                      className={`h-4 w-4 flex-shrink-0 rounded border transition-colors ${
                        isSelected
                          ? "bg-[rgb(var(--accent))] border-[rgb(var(--accent))]"
                          : "border-[rgb(var(--border))]"
                      }`}
                    >
                      {isSelected && (
                        <svg viewBox="0 0 16 16" className="h-4 w-4 text-white">
                          <path
                            d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z"
                            fill="currentColor"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex-shrink-0 flex items-center justify-center w-5 border-r border-[rgb(var(--border))] bg-[rgb(var(--card))] hover:bg-[rgb(var(--muted))] transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-3.5 w-3.5 text-[rgb(var(--muted-foreground))]" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-[rgb(var(--muted-foreground))]" />
        )}
      </button>

      {/* Chat area */}
      <main className="flex flex-1 flex-col min-w-0">
        {/* Selected books bar */}
        {selectedBooks.length > 0 && (
          <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-4 py-2 overflow-x-auto">
            <span className="text-xs text-[rgb(var(--muted-foreground))] flex-shrink-0">
              Chatting with:
            </span>
            {selectedBooks.map((b) => (
              <Badge
                key={b.id}
                variant="secondary"
                className="text-xs flex-shrink-0 cursor-pointer hover:bg-red-100 hover:text-red-700 transition-colors"
                onClick={() => toggleBook(b.id)}
                title={`Remove ${b.title}`}
              >
                {b.title.length > 25 ? b.title.slice(0, 25) + "…" : b.title}
                <X className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8">
              <div className="max-w-md text-center space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[rgb(var(--accent))]/10">
                  <Bot className="h-8 w-8 text-[rgb(var(--accent))]" />
                </div>
                <h2 className="text-xl font-semibold">BookByte AI</h2>
                <p className="text-sm text-[rgb(var(--muted-foreground))] leading-relaxed">
                  {selectedIds.size === 0
                    ? "Select one or more books from the sidebar, then ask me anything about them. I'll answer using only the book summaries and cite my sources."
                    : `Ask me anything about the ${selectedIds.size} selected book${selectedIds.size !== 1 ? "s" : ""}. I'll draw from the summaries and tell you exactly where each insight comes from.`}
                </p>
                {selectedIds.size > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInput("What are the main ideas across these books?");
                        inputRef.current?.focus();
                      }}
                    >
                      Main ideas
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInput("What actionable advice do these books give?");
                        inputRef.current?.focus();
                      }}
                    >
                      Actionable advice
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        setInput("Compare the key themes across these books");
                        inputRef.current?.focus();
                      }}
                    >
                      Compare themes
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-6 p-4 pb-8">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[rgb(var(--accent))]/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-[rgb(var(--accent))]" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[rgb(var(--accent))] text-white"
                        : "bg-[rgb(var(--muted))]"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="whitespace-pre-wrap">
                        {msg.content || (
                          <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--muted-foreground))]" />
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[rgb(var(--foreground))]/10 flex items-center justify-center">
                      <User className="h-4 w-4 text-[rgb(var(--foreground))]" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--background))] p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height =
                      Math.min(e.target.scrollHeight, 160) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedIds.size === 0
                      ? "Select books first..."
                      : "Ask about your selected books..."
                  }
                  disabled={selectedIds.size === 0 || isStreaming}
                  rows={1}
                  className="w-full resize-none rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--card))] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/30 disabled:opacity-50"
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={
                  !input.trim() || isStreaming || selectedIds.size === 0
                }
                size="icon"
                className="h-11 w-11 rounded-xl flex-shrink-0"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-[10px] text-[rgb(var(--muted-foreground))] text-center">
              BookByte AI only uses information from your selected book summaries
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
