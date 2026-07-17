"use client";

import { Id } from "@/convex/_generated/dataModel";
import { suggestGroup } from "@/lib/group-suggest";

export type GroupChoice = "solo" | "group";
export type GroupSelectValue = Id<"groups"> | "new";

interface GroupOption {
  _id: Id<"groups">;
  name: string;
  members: { supplement: { name: string; brand?: string } }[];
  takers: { personId: Id<"people">; pillsPerWeek: number }[];
}

interface PersonName {
  _id: Id<"people">;
  name: string;
}

export function GroupQuestionCard({
  choice,
  onChoiceChange,
  groups,
  people,
  selectedGroupId,
  onSelectGroup,
  newGroupName,
  onNewGroupNameChange,
  supplementName,
  suggestedGroupId,
}: {
  choice: GroupChoice;
  onChoiceChange: (c: GroupChoice) => void;
  groups: GroupOption[];
  people: PersonName[];
  selectedGroupId: GroupSelectValue | null;
  onSelectGroup: (v: GroupSelectValue) => void;
  newGroupName: string;
  onNewGroupNameChange: (name: string) => void;
  supplementName: string;
  suggestedGroupId?: Id<"groups"> | null;
}) {
  const suggested =
    suggestedGroupId ??
    (suggestGroup(
      supplementName,
      groups.map((g) => ({
        _id: g._id,
        name: g.name,
        members: g.members.map((m) => ({
          name: m.supplement.name,
          brand: m.supplement.brand,
        })),
      }))
    )?._id as Id<"groups"> | undefined);

  const suggestedGroup = groups.find((g) => g._id === suggested);

  function formatGroupLabel(g: GroupOption): string {
    const brandCount = g.members.length;
    const takerNames = g.takers
      .map((t) => {
        const person = people.find((p) => p._id === t.personId);
        return person
          ? `${person.name} ${t.pillsPerWeek}/wk`
          : `${t.pillsPerWeek}/wk`;
      })
      .join(", ");
    const takerPart = takerNames ? ` · ${takerNames}` : "";
    return `${g.name} — ${brandCount} brand${brandCount === 1 ? "" : "s"}${takerPart}`;
  }

  return (
    <div className="border border-border-strong rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-surface-alt border-b border-border-strong">
        <div className="font-bold text-sm">
          Is this a new brand of something you already track?
        </div>
        <div className="text-[12.5px] text-text-muted mt-0.5">
          Grouped brands share one supply and one dosage — you finish one
          bottle, then start the next brand.
        </div>
      </div>

      <label
        className={`flex gap-3 px-4 py-3 cursor-pointer items-start border-b border-border hover:bg-surface-alt ${
          choice === "solo" ? "bg-surface-alt/50" : ""
        }`}
      >
        <input
          type="radio"
          name="group-q"
          checked={choice === "solo"}
          onChange={() => onChoiceChange("solo")}
          className="mt-0.5 accent-primary w-4 h-4"
        />
        <span>
          <span className="block font-semibold text-sm">
            No — it&apos;s a new supplement
          </span>
          <span className="block text-[12.5px] text-text-muted mt-px">
            It gets its own supply and dosage.
          </span>
        </span>
      </label>

      <label
        className={`flex gap-3 px-4 py-3 cursor-pointer items-start hover:bg-surface-alt ${
          choice === "group" ? "bg-surface-alt/50" : ""
        }`}
      >
        <input
          type="radio"
          name="group-q"
          checked={choice === "group"}
          onChange={() => onChoiceChange("group")}
          className="mt-0.5 accent-primary w-4 h-4"
        />
        <span>
          <span className="block font-semibold text-sm">
            Yes — group it with other brands
          </span>
          <span className="block text-[12.5px] text-text-muted mt-px">
            Join an existing group or start a new one. Grouped brands share one
            supply &amp; dosage.
          </span>
          {choice === "group" && suggestedGroup && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light rounded-full px-2.5 py-0.5 mt-1.5">
              ✨ Suggested: looks like your &ldquo;{suggestedGroup.name}&rdquo;
              group
            </span>
          )}
        </span>
      </label>

      {choice === "group" && (
        <div className="px-4 pb-3.5 pl-11 space-y-2">
          <label className="text-xs font-bold text-text-label block mt-1.5">
            Add to group
          </label>
          <select
            value={selectedGroupId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "new") onSelectGroup("new");
              else onSelectGroup(v as Id<"groups">);
            }}
            className="w-full max-w-xs px-3 py-2 border border-border-strong rounded-lg text-sm bg-surface"
          >
            <option value="" disabled>
              Select a group…
            </option>
            {groups.map((g) => (
              <option key={g._id} value={g._id}>
                {formatGroupLabel(g)}
              </option>
            ))}
            <option value="new">＋ Start a new group with this…</option>
          </select>

          {selectedGroupId && selectedGroupId !== "new" && (
            <p className="text-[12.5px] text-text-muted">
              Skips step 3 — this brand inherits the group&apos;s &ldquo;who
              takes it&rdquo;.
            </p>
          )}

          {selectedGroupId === "new" && (
            <div className="mt-3 p-3.5 border border-border-strong rounded-lg bg-surface-alt space-y-2">
              <label className="text-xs font-bold text-text-label block">
                New group name
              </label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => onNewGroupNameChange(e.target.value)}
                placeholder="e.g. Vitamin D3"
                className="w-full max-w-xs px-3 py-2 border border-border-strong rounded-lg text-sm"
              />
              <p className="text-[12.5px] text-text-muted leading-relaxed">
                This supplement becomes the group&apos;s{" "}
                <b className="text-text font-semibold">first brand</b>. The
                dosage you set in step 3 becomes the group&apos;s dosage —
                future brands you add will inherit it.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary-light rounded-full px-2.5 py-0.5">
                💡 Next time you add a brand of this, it&apos;ll be suggested
                automatically
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
