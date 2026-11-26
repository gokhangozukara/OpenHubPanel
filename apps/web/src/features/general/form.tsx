"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { useLocale } from "@/i18n/provider";

export type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string;
  optional?: boolean;
  checked?: boolean;
  options?: { value: string; label: string }[];
};
const limits: Record<string, number> = {
  name: 100,
  title: 180,
  email: 254,
  password: 256,
  code: 6,
  credential: 1024,
  url: 2048,
  panelUrl: 2048,
};
export function GeneralForm({
  title,
  fields,
  submit,
  disabled,
  run,
  onStart,
}: {
  title: string;
  fields: Field[];
  submit: string;
  disabled: boolean;
  run: (input: Record<string, string | boolean>) => Promise<unknown>;
  onStart?: () => void;
}) {
  const { t } = useLocale();
  const id = useId();
  const pending = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [invalid, setInvalid] = useState<Record<string, string>>({});
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || pending.current) return;
    onStart?.();
    const form = event.currentTarget;
    const active = document.activeElement;
    const data = new FormData(form);
    const input: Record<string, string | boolean> = {};
    const problems: Record<string, string> = {};
    for (const field of fields) {
      const value = field.type === "checkbox" ? data.has(field.name) : String(data.get(field.name) ?? "");
      input[field.name] = value;
      if (!field.optional && (value === false || (typeof value === "string" && !value.trim())))
        problems[field.name] = t("This field is required.");
      else if (typeof value === "string" && value) {
        const max = limits[field.name] ?? 2048;
        if (value.length > max) problems[field.name] = t("Use at most {count} characters.", { count: max });
        else if (field.name === "password" && value.length < 6)
          problems[field.name] = t("Use a password between 6 and 256 characters.");
        else if (field.name === "code" && !/^\d{6}$/.test(value))
          problems[field.name] = t("Enter the six-digit authenticator code.");
        else if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          problems[field.name] = t("Enter a valid email address.");
        else if (field.type === "url") {
          try {
            const url = new URL(value);
            if (url.protocol !== "https:" || url.username || url.password) throw new Error();
          } catch {
            problems[field.name] = t("Enter a valid HTTPS URL.");
          }
        }
      }
    }
    setInvalid(problems);
    const first = Object.keys(problems)[0];
    if (first) {
      const element = form.elements.namedItem(first);
      if (element instanceof HTMLElement) element.focus();
      return;
    }
    pending.current = true;
    setSubmitting(true);
    try {
      await run(input);
    } finally {
      pending.current = false;
      setSubmitting(false);
      // Keep non-secret drafts after errors. Never persist passwords/codes in browser storage.
      for (const element of form.elements)
        if (element instanceof HTMLInputElement && element.type === "password") element.value = "";
      requestAnimationFrame(() => {
        if (active instanceof HTMLElement && active.isConnected && document.activeElement === document.body)
          active.focus();
      });
    }
  }
  return (
    <form
      className="general-form"
      onSubmit={onSubmit}
      aria-label={t(title)}
      noValidate
      aria-busy={submitting}
    >
      <h3>{t(title)}</h3>
      {Object.keys(invalid).length > 0 && (
        <p role="alert" className="general-error">
          {t("Check the highlighted fields.")}
        </p>
      )}
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={`${id}-${field.name}`}>{t(field.label)}</label>
          {field.options ? (
            <select
              id={`${id}-${field.name}`}
              name={field.name}
              defaultValue={field.value}
              disabled={disabled || submitting}
              aria-invalid={!!invalid[field.name]}
              aria-describedby={invalid[field.name] ? `${id}-${field.name}-error` : undefined}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.label)}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${id}-${field.name}`}
              name={field.name}
              type={field.type ?? "text"}
              defaultValue={field.value}
              defaultChecked={field.checked}
              required={!field.optional}
              readOnly={field.type !== "checkbox" && (disabled || submitting)}
              disabled={field.type === "checkbox" && (disabled || submitting)}
              autoComplete={
                field.name === "password"
                  ? ["First installation", "Join with invitation"].includes(title)
                    ? "new-password"
                    : "current-password"
                  : field.name === "code"
                    ? "one-time-code"
                    : field.type === "email"
                      ? "username"
                      : "off"
              }
              minLength={field.name === "password" ? 6 : undefined}
              maxLength={limits[field.name]}
              inputMode={field.name === "code" ? "numeric" : undefined}
              pattern={field.name === "code" ? "[0-9]{6}" : undefined}
              aria-invalid={!!invalid[field.name]}
              aria-describedby={invalid[field.name] ? `${id}-${field.name}-error` : undefined}
            />
          )}
          {invalid[field.name] && (
            <p id={`${id}-${field.name}-error`} className="general-field-error">
              {invalid[field.name]}
            </p>
          )}
        </div>
      ))}
      <button type="submit" disabled={disabled || submitting}>
        {t(submit)}
      </button>
    </form>
  );
}
