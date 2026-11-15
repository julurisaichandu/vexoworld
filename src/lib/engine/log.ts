import { store } from "@/lib/store";
import type { Activity } from "@/lib/types";

export const logActivity = (a: Omit<Activity, "id" | "createdAt">): Promise<Activity> => store.insert("activity", { read: false, ...a });
