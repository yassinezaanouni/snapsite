import { create } from "zustand"
import { persist } from "zustand/middleware"

type SavedSession = {
  id: string
  url: string
  hostname: string
  pageCount: number
  breakpointCount: number
  screenshotCount: number
  createdAt: number
}

type SessionsStore = {
  sessions: SavedSession[]
  addSession: (session: Omit<SavedSession, "createdAt">) => void
  removeSession: (id: string) => void
  clearSessions: () => void
}

export const useSessions = create<SessionsStore>()(
  persist(
    (set) => ({
      sessions: [],

      addSession: (session) =>
        set((s) => ({
          sessions: [
            { ...session, createdAt: Date.now() },
            ...s.sessions.filter((existing) => existing.id !== session.id),
          ],
        })),

      removeSession: (id) =>
        set((s) => ({
          sessions: s.sessions.filter((session) => session.id !== id),
        })),

      clearSessions: () => set({ sessions: [] }),
    }),
    {
      name: "snapsite-sessions",
    },
  ),
)
