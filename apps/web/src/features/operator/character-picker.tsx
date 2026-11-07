"use client";
import { useLocale } from "@/i18n/provider";
import { characters } from "./characters";

export function CharacterPicker({
  value,
  onSelect,
  disabled = false,
}: {
  value?: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <fieldset className="character-grid" aria-label={t("Sign-in character")}>
      {characters.map((character) => (
        <button
          key={character.id}
          className={`character-card ${value === character.id ? "selected" : ""}`}
          type="button"
          aria-label={t(character.label)}
          disabled={disabled}
          aria-pressed={value === character.id}
          onClick={() => onSelect(character.id)}
        >
          <span className="character-picture" role="img" aria-label={t(character.label)}>
            {character.image}
          </span>
          <span>{t(character.label)}</span>
        </button>
      ))}
    </fieldset>
  );
}
