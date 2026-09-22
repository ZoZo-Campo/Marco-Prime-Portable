import type { MemberSchema } from "../schemas/member.schema";

const STORAGE_KEY = "marco.recent-members";
const MAX_RECENT = 6;

export function loadRecentMembers(): MemberSchema[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addRecentMember(member: MemberSchema): void {
  try {
    const existing = loadRecentMembers().filter((m) => m.id !== member.id);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([member, ...existing].slice(0, MAX_RECENT)),
    );
  } catch {
    /* stockage indisponible */
  }
}