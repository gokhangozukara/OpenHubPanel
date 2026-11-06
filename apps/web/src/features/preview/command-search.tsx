"use client";

import { ArrowUpRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/i18n/provider";

export type SearchCommand = { id: string; label: string; group: string; run: () => void };

export function CommandSearch({
  open,
  onClose,
  commands,
}: {
  open: boolean;
  onClose: () => void;
  commands: SearchCommand[];
}) {
  const { t } = useLocale();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const results = commands.filter((command) =>
    command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      dialog.current?.showModal();
      input.current?.focus();
    } else dialog.current?.close();
  }, [open]);

  function move(current: number, direction: number) {
    const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(".command-result");
    if (!buttons?.length) return;
    if (current === 0 && direction < 0) input.current?.focus();
    else buttons[(current + direction + buttons.length) % buttons.length]?.focus();
  }

  return (
    <dialog
      ref={dialog}
      className="panel-dialog command-dialog"
      aria-labelledby="command-title"
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="command-heading">
        <Search size={18} aria-hidden="true" />
        <h2 id="command-title" className="sr-only">
          {t("Search workspace")}
        </h2>
        <input
          ref={input}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("Search pages and applications")}
          placeholder={t("Search pages and applications")}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              move(-1, 1);
            }
            if (event.key === "Enter" && results[0]) {
              event.preventDefault();
              dialog.current?.close();
              onClose();
              results[0].run();
            }
          }}
        />
        <button type="button" className="icon-button" aria-label={t("Close dialog")} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="command-results">
        {results.map((command, index) => (
          <button
            type="button"
            className="command-result"
            key={command.id}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                move(index, event.key === "ArrowDown" ? 1 : -1);
              }
            }}
            onClick={() => {
              dialog.current?.close();
              onClose();
              command.run();
            }}
          >
            <span>
              <strong>{command.label}</strong>
              <small>{command.group}</small>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        ))}
        {!results.length && (
          <p className="empty-search" role="status">
            {t("No matching results")}
          </p>
        )}
      </div>
      <div className="command-footer">{t("Use arrow keys to navigate. Enter to open. Escape to close.")}</div>
    </dialog>
  );
}
