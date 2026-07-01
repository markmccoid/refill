"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useDemoHousehold } from "@/hooks/useDemoHousehold";
import { PERSON_COLORS, colorValue } from "@/lib/person-colors";
import { PersonRegimen } from "@/components/PersonRegimen";

type Person = {
  _id: Id<"people">;
  name: string;
  color: string;
  status?: "active" | "disabled";
};

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERSON_COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          onClick={() => onChange(c.name)}
          title={c.label}
          className={`w-7 h-7 rounded-full border-2 transition-transform ${
            value === c.name
              ? "border-text scale-110"
              : "border-transparent hover:scale-105"
          }`}
          style={{ backgroundColor: c.value }}
        />
      ))}
    </div>
  );
}

export default function PeoplePage() {
  const householdId = useDemoHousehold();
  const people = useQuery(
    api.people.list,
    householdId ? { householdId } : "skip"
  ) as Person[] | undefined;

  const createPerson = useMutation(api.people.create);
  const updatePerson = useMutation(api.people.update);
  const disablePerson = useMutation(api.people.disable);
  const enablePerson = useMutation(api.people.enable);
  const removePerson = useMutation(api.people.remove);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PERSON_COLORS[0].name);

  const [editingId, setEditingId] = useState<Id<"people"> | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState(PERSON_COLORS[0].name);

  const [deleting, setDeleting] = useState<Person | null>(null);
  const [expandedId, setExpandedId] = useState<Id<"people"> | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleExpand = (id: Id<"people">) =>
    setExpandedId((cur) => (cur === id ? null : id));

  if (!householdId || !people) {
    return <div className="text-center py-12">Loading people...</div>;
  }

  const active = people.filter((p) => p.status !== "disabled");
  const disabled = people.filter((p) => p.status === "disabled");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await createPerson({
        householdId,
        name: newName.trim(),
        color: newColor,
      });
      setNewName("");
      setNewColor(PERSON_COLORS[0].name);
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (p: Person) => {
    setEditingId(p._id);
    setEditName(p.name);
    setEditColor(p.color);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    try {
      await updatePerson({
        id: editingId,
        name: editName.trim(),
        color: editColor,
      });
      setEditingId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="text-text-muted text-sm mt-1">
            Who takes supplements in this household.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary">
            + Add person
          </button>
        )}
      </div>

      {/* Add form */}
      {adding && (
        <div className="card p-4 space-y-3">
          <input
            type="text"
            autoFocus
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full px-3 py-2 border border-black/16 rounded-lg"
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={busy || !newName.trim()}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {busy ? "Adding..." : "Add person"}
            </button>
            <button
              onClick={() => {
                setAdding(false);
                setNewName("");
              }}
              className="btn-outline flex-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Active */}
      <div>
        <h2 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-3">
          Active
        </h2>
        <div className="card divide-y divide-black/10">
          {active.length === 0 && (
            <div className="px-4 py-6 text-sm text-text-muted text-center">
              No active people yet.
            </div>
          )}
          {active.map((p) =>
            editingId === p._id ? (
              <div key={p._id} className="p-4 space-y-3">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                  className="w-full px-3 py-2 border border-black/16 rounded-lg"
                />
                <ColorPicker value={editColor} onChange={setEditColor} />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={busy || !editName.trim()}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    {busy ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={p._id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(p._id)}
                    className="flex items-center gap-3 flex-1 text-left"
                    aria-expanded={expandedId === p._id}
                  >
                    <span className="text-text-muted text-4xl leading-none w-6 flex-shrink-0">
                      {expandedId === p._id ? "▾" : "▸"}
                    </span>
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: colorValue(p.color) }}
                    />
                    <span className="font-medium">{p.name}</span>
                  </button>
                  <button
                    onClick={() => startEdit(p)}
                    className="text-sm text-primary hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => disablePerson({ id: p._id })}
                    className="text-sm text-text-muted hover:text-text"
                  >
                    Disable
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="text-sm text-critical hover:text-critical/80"
                  >
                    Delete
                  </button>
                </div>
                {expandedId === p._id && (
                  <PersonRegimen personId={p._id} householdId={householdId} />
                )}
              </div>
            )
          )}
        </div>
      </div>

      {/* Disabled */}
      {disabled.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-text-label uppercase tracking-wide mb-3">
            Disabled
          </h2>
          <div className="card divide-y divide-black/10">
            {disabled.map((p) => (
              <div key={p._id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(p._id)}
                    className="flex items-center gap-3 flex-1 text-left opacity-60"
                    aria-expanded={expandedId === p._id}
                  >
                    <span className="text-text-muted text-4xl leading-none w-6 flex-shrink-0">
                      {expandedId === p._id ? "▾" : "▸"}
                    </span>
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-black/20"
                      style={{ backgroundColor: colorValue(p.color) }}
                    />
                    <span className="font-medium">
                      {p.name}{" "}
                      <span className="text-xs text-text-muted font-normal">
                        · paused
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => enablePerson({ id: p._id })}
                    className="text-sm text-primary hover:underline"
                  >
                    Re-enable
                  </button>
                  <button
                    onClick={() => setDeleting(p)}
                    className="text-sm text-critical hover:text-critical/80"
                  >
                    Delete
                  </button>
                </div>
                {expandedId === p._id && (
                  <PersonRegimen
                    personId={p._id}
                    householdId={householdId}
                    readOnly
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-2">
            Disabled people keep their dosages but don&apos;t count toward
            consumption, forecasts, or costs. Re-enable to resume.
          </p>
        </div>
      )}

      {deleting && (
        <DeleteDialog
          person={deleting}
          busy={busy}
          onCancel={() => setDeleting(null)}
          onDisable={
            deleting.status === "disabled"
              ? undefined
              : async () => {
                  setBusy(true);
                  try {
                    await disablePerson({ id: deleting._id });
                    setDeleting(null);
                  } finally {
                    setBusy(false);
                  }
                }
          }
          onDelete={async () => {
            setBusy(true);
            try {
              await removePerson({ id: deleting._id });
              setDeleting(null);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function DeleteDialog({
  person,
  busy,
  onCancel,
  onDisable,
  onDelete,
}: {
  person: Person;
  busy: boolean;
  onCancel: () => void;
  onDisable?: () => void;
  onDelete: () => void;
}) {
  const impact = useQuery(api.people.impact, { id: person._id });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="card p-6 space-y-4 max-w-md w-full">
        <h2 className="text-lg font-bold">
          Permanently delete {person.name}?
        </h2>

        {impact === undefined ? (
          <p className="text-sm text-text-muted">Checking impact...</p>
        ) : impact.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm">
              This removes {impact.length}{" "}
              {impact.length === 1 ? "dosage" : "dosages"}:
            </p>
            <ul className="text-sm space-y-1">
              {impact.map((row) => (
                <li key={row.supplementId} className="flex justify-between">
                  <span>{row.name}</span>
                  <span className="font-mono text-text-muted">
                    {row.perWeek}/wk
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted">
              Those supplements&apos; forecasts will recompute. This cannot be
              undone.
            </p>
          </div>
        ) : (
          <p className="text-sm text-text-muted">
            They have no dosages. This cannot be undone.
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="btn-outline flex-1">
            Cancel
          </button>
          {onDisable && (
            <button
              onClick={onDisable}
              disabled={busy}
              className="btn-outline flex-1 disabled:opacity-50"
            >
              Disable instead
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            className="flex-1 px-4 py-2 rounded-lg font-semibold bg-critical text-white hover:bg-critical/90 disabled:opacity-50"
          >
            {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
