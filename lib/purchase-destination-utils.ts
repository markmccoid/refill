/** Subject of a restock plan line — solo supplement or pooled group. */
export type ItemSubject =
  | { kind: "supplement"; supplementId: string }
  | { kind: "group"; groupId: string };

/**
 * Ensure an existing-destination supplement belongs to the item's subject scope.
 * Solo items may only land on the subject supplement; group items on a member brand.
 */
export function assertExistingDestinationAllowed(args: {
  itemSubject: ItemSubject;
  destinationSupplementId: string;
  /** Member supplement ids when itemSubject is a group; ignored for solo. */
  groupMemberIds: string[];
}): void {
  const allowed =
    args.itemSubject.kind === "supplement"
      ? [args.itemSubject.supplementId]
      : args.groupMemberIds;

  if (!allowed.includes(args.destinationSupplementId)) {
    throw new Error(
      "Destination supplement is not valid for this item's subject."
    );
  }
}
