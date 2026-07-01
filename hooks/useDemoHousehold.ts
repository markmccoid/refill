import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

const DEMO_HOUSEHOLD_ID_KEY = "demo-household-id";

export function useDemoHousehold(): Id<"households"> | null {
  const [householdId, setHouseholdId] = useState<Id<"households"> | null>(null);
  const createHousehold = useMutation(api.households.create);
  const createPerson = useMutation(api.people.create);
  const createSupplement = useMutation(api.supplements.create);
  const createDosage = useMutation(api.dosages.create);

  useEffect(() => {
    const savedId = localStorage.getItem(DEMO_HOUSEHOLD_ID_KEY);
    if (savedId) {
      setHouseholdId(savedId as Id<"households">);
    } else {
      // Initialize demo household
      initializeDemoHousehold();
    }
  }, []);

  async function initializeDemoHousehold() {
    try {
      const hId = await createHousehold({ name: "Mark & Lori" });
      localStorage.setItem(DEMO_HOUSEHOLD_ID_KEY, hId);
      setHouseholdId(hId);

      // Create people
      const mark = await createPerson({
        householdId: hId,
        name: "Mark",
        color: "green",
      });

      const lori = await createPerson({
        householdId: hId,
        name: "Lori",
        color: "amber",
      });

      // Create sample supplements
      const fish = await createSupplement({
        householdId: hId,
        name: "Omega-3 Fish Oil",
        brand: "NorSea Naturals",
        form: "Softgel",
        servingSize: "1 softgel",
        servingSizeAmount: 1000,
        servingSizeUnit: "mg",
        category: "Essential fatty acid",
        jarSize: 120,
        bottles: [
          {
            count: 120,
            price: 24.99,
            purchaseUrl: "https://example.com",
            purchasedAt: Date.now(),
          },
        ],
      });

      const vitamin = await createSupplement({
        householdId: hId,
        name: "Vitamin K2",
        brand: "Thorne",
        form: "Capsule",
        servingSize: "1 capsule",
        servingSizeAmount: 100,
        servingSizeUnit: "mcg",
        category: "Vitamin",
        jarSize: 60,
        bottles: [
          {
            count: 60,
            price: 32.5,
            purchaseUrl: "https://example.com",
            purchasedAt: Date.now(),
          },
        ],
      });

      // Create dosages (pills per week)
      await createDosage({
        supplementId: fish,
        personId: mark,
        pillsPerWeek: 14,
      });

      await createDosage({
        supplementId: vitamin,
        personId: lori,
        pillsPerWeek: 7,
      });
    } catch (error) {
      console.error("Failed to initialize demo household:", error);
    }
  }

  return householdId;
}
