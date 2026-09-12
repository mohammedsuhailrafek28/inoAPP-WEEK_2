"use client";

import React from "react";

interface HeaderProps {
  onNewChat: () => void;
  canReset: boolean;
  disabled?: boolean;
}

export default function Header({ onNewChat, canReset, disabled = false }: HeaderProps) {
  return (
    <header className="flex-shrink-0 border-b border-line">
      <div className="mx-auto flex max-w-[1140px] items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-[13px] leading-none text-accent">
            ✦
          </span>
          <span className="text-[12px] font-medium uppercase tracking-[0.2em] text-ink">
            Study
          </span>
        </div>

        <button
          onClick={onNewChat}
          disabled={disabled || !canReset}
          className="rounded-sm text-[11px] font-medium uppercase tracking-[0.18em] text-[#c4c2bb] transition-colors hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-30"
          aria-label="Start a new chat"
        >
          New Chat
        </button>
      </div>
    </header>
  );
}
