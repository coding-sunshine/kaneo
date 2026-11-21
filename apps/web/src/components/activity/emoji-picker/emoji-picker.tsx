import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import {
  loadFrequencies,
  recordEmojiUse,
  saveFrequencies,
  topEmoji,
} from "./emoji-frequency";
import {
  type EmojiEntry,
  type EmojiGroup,
  loadEmojiGroups,
  searchEmoji,
} from "./emoji-groups";

type EmojiPickerProps = {
  onSelect: (emoji: string) => void;
};

function EmojiGrid({
  emojis,
  onSelect,
}: {
  emojis: Array<Pick<EmojiEntry, "emoji"> & Partial<EmojiEntry>>;
  onSelect: (emoji: string) => void;
}) {
  return (
    <div className="grid grid-cols-9">
      {emojis.map(({ emoji, name }) => (
        <button
          key={emoji}
          type="button"
          title={name}
          aria-label={name ?? emoji}
          onClick={() => onSelect(emoji)}
          className="flex size-7 items-center justify-center rounded-md text-lg leading-none outline-none hover:bg-accent focus-visible:bg-accent"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default function EmojiPicker({ onSelect: onPick }: EmojiPickerProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const [frequent] = useState(() => topEmoji(loadFrequencies(userId)));
  const onSelect = (emoji: string) => {
    saveFrequencies(userId, recordEmojiUse(loadFrequencies(userId), emoji));
    onPick(emoji);
  };
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<EmojiGroup[]>([]);

  useEffect(() => {
    let active = true;
    void loadEmojiGroups().then((loaded) => {
      if (active) setGroups(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  const results = query.trim() ? searchEmoji(groups, query) : null;

  return (
    <div className="flex w-68 flex-col">
      <input
        // biome-ignore lint/a11y/noAutofocus: the picker opens to type into
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && results?.[0]) {
            event.preventDefault();
            onSelect(results[0].emoji);
          }
        }}
        placeholder={t("activity:reactions.search")}
        aria-label={t("activity:reactions.search")}
        className="h-9 border-border border-b bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground"
      />
      <div className="max-h-72 overflow-y-auto px-2 pt-1.5 pb-2">
        {results ? (
          results.length > 0 ? (
            <EmojiGrid emojis={results} onSelect={onSelect} />
          ) : (
            <p className="px-1 py-6 text-center text-muted-foreground text-xs">
              {t("activity:reactions.noResults")}
            </p>
          )
        ) : (
          <>
            <p className="px-1 pt-1 pb-1 text-muted-foreground text-xs">
              {t("activity:reactions.frequentlyUsed")}
            </p>
            <EmojiGrid
              emojis={frequent.map((emoji) => ({ emoji }))}
              onSelect={onSelect}
            />
            {groups.map((group) => (
              <section key={group.slug}>
                <p className="px-1 pt-2.5 pb-1 text-muted-foreground text-xs">
                  {t(`activity:reactions.groups.${group.slug}`)}
                </p>
                <EmojiGrid emojis={group.emojis} onSelect={onSelect} />
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
