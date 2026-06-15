"use client";

// Per-user cloud storage in Firestore.
// Layout:
//   users/{uid}                      → { settings, tasks, exam, installed }  (synced state)
//   users/{uid}/chats/{chatId}       → { title, createdAt, updatedAt, messages: [...] }
// Security rules (set in Firebase console) restrict every doc to its owner.

import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query,
  serverTimestamp, setDoc, updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type ChatMsg = { who: "you" | "nova"; text: string };
export type ChatSummary = { id: string; title: string; updatedAt: number };

/* ---------- synced state (settings, tasks, exam, plugins) ---------- */

export async function loadUserState(uid: string) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function saveUserState(uid: string, state: Record<string, unknown>) {
  // debounce so rapid changes (typing a task) don't spam Firestore
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    setDoc(doc(db, "users", uid), state, { merge: true }).catch(() => {});
  }, 800);
}

/* ---------- chat history ---------- */

export async function listChats(uid: string): Promise<ChatSummary[]> {
  try {
    const q = query(collection(db, "users", uid, "chats"), orderBy("updatedAt", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as { title?: string; updatedAt?: { toMillis?: () => number } };
      return {
        id: d.id,
        title: data.title || "Untitled chat",
        updatedAt: data.updatedAt?.toMillis?.() ?? 0,
      };
    });
  } catch {
    return [];
  }
}

export async function loadChat(uid: string, chatId: string): Promise<ChatMsg[]> {
  try {
    const snap = await getDoc(doc(db, "users", uid, "chats", chatId));
    if (!snap.exists()) return [];
    return (snap.data().messages as ChatMsg[]) || [];
  } catch {
    return [];
  }
}

export async function createChat(uid: string, firstUserText: string): Promise<string> {
  const id = `chat_${Date.now()}`;
  const title = firstUserText.slice(0, 40) || "New chat";
  await setDoc(doc(db, "users", uid, "chats", id), {
    title, messages: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return id;
}

export async function saveChat(uid: string, chatId: string, messages: ChatMsg[]) {
  try {
    await updateDoc(doc(db, "users", uid, "chats", chatId), {
      messages, updatedAt: serverTimestamp(),
    });
  } catch {
    // doc may not exist yet (race) — create it
    await setDoc(doc(db, "users", uid, "chats", chatId), {
      title: messages.find((m) => m.who === "you")?.text.slice(0, 40) || "New chat",
      messages, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

export async function deleteChat(uid: string, chatId: string) {
  try {
    await deleteDoc(doc(db, "users", uid, "chats", chatId));
  } catch {
    /* ignore */
  }
}
