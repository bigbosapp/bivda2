import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebase.js";

const DATA_COLLECTIONS = ["categories", "customers", "transactions", "losses"];
const DEFAULT_CATEGORIES = [
  { id: "1", name: "Makanan", price: 15000 },
  { id: "2", name: "Minuman", price: 8000 }
];
const DEFAULT_CUSTOMERS = [
  { id: "1", name: "Bpk. Hendra", address: "Jl. Merdeka No. 45", phone: "081299887766" }
];

function userDocument(uid) {
  return doc(db, "artifacts", "bivda-app", "users", uid);
}

function collectionFor(uid, collectionName) {
  if (!DATA_COLLECTIONS.includes(collectionName)) {
    throw new Error("Jenis data tidak dikenal.");
  }
  return collection(db, "artifacts", "bivda-app", "users", uid, collectionName);
}

function migrationDocument(uid) {
  return doc(db, "artifacts", "bivda-app", "users", uid, "meta", "schema");
}

function sortRows(collectionName, rows) {
  if (collectionName === "categories" || collectionName === "customers") {
    return rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));
  }
  return rows.sort((a, b) => {
    const byDate = String(b.date || "").localeCompare(String(a.date || ""));
    return byDate || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  });
}

function usableDocumentId(value, fallback) {
  const id = String(value ?? "").trim().replaceAll("/", "_").slice(0, 200);
  return id || fallback;
}

function normalizeLegacyRows(collectionName, records) {
  const usedIds = new Set();
  return records.map((record, index) => {
    const fallbackId = `legacy_${collectionName}_${index + 1}`;
    let id = usableDocumentId(record?.id, fallbackId);
    if (usedIds.has(id)) id = fallbackId;
    while (usedIds.has(id)) id = `${fallbackId}_${usedIds.size}`;
    usedIds.add(id);
    return { id, data: { ...record, id } };
  });
}

async function writeMissingLegacyRows(uid, collectionName, rows, existingIds) {
  const missing = rows.filter(({ id }) => !existingIds.has(id));
  for (let offset = 0; offset < missing.length; offset += 400) {
    const batch = writeBatch(db);
    missing.slice(offset, offset + 400).forEach(({ id, data }) => {
      batch.set(doc(collectionFor(uid, collectionName), id), data);
    });
    await batch.commit();
  }
}

// Pindahkan data versi lama (array pada satu dokumen) ke dokumen per item.
// Marker disimpan terpisah supaya data lama tetap utuh dan migrasi aman diulang.
export async function initializeUserData(uid) {
  const markerRef = migrationDocument(uid);
  const markerSnapshot = await getDoc(markerRef);
  if (markerSnapshot.exists() && markerSnapshot.data().version >= 2) return;

  const legacyRef = userDocument(uid);
  const [legacySnapshot, ...collectionSnapshots] = await Promise.all([
    getDoc(legacyRef),
    ...DATA_COLLECTIONS.map((name) => getDocs(collectionFor(uid, name)))
  ]);
  const legacyData = legacySnapshot.exists() ? legacySnapshot.data() : {};
  const existingByName = Object.fromEntries(
    DATA_COLLECTIONS.map((name, index) => [
      name,
      new Set(collectionSnapshots[index].docs.map((item) => item.id))
    ])
  );

  for (const name of DATA_COLLECTIONS) {
    const legacyRows = Array.isArray(legacyData[name]) ? legacyData[name] : [];
    const seedRows = !legacySnapshot.exists() && existingByName[name].size === 0
      ? (name === "categories" ? DEFAULT_CATEGORIES : name === "customers" ? DEFAULT_CUSTOMERS : [])
      : [];
    const sourceRows = legacyRows.length ? legacyRows : seedRows;
    if (sourceRows.length) {
      await writeMissingLegacyRows(
        uid,
        name,
        normalizeLegacyRows(name, sourceRows),
        existingByName[name]
      );
    }
  }

  await setDoc(markerRef, {
    version: 2,
    completedAt: new Date().toISOString()
  });
}

export function createRecordId(prefix) {
  const randomPart = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}_${randomPart}`;
}

export function createNamedRecordId(prefix, name) {
  const normalized = String(name ?? "").trim().toLocaleLowerCase("id");
  const bytes = new TextEncoder().encode(normalized);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const token = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  return `${prefix}_${token || "empty"}`;
}

export async function saveRecord(uid, collectionName, record) {
  const id = usableDocumentId(record.id, createRecordId(collectionName.slice(0, 3)));
  const normalized = {
    ...record,
    id,
    updatedAt: new Date().toISOString()
  };
  await setDoc(doc(collectionFor(uid, collectionName), id), normalized, { merge: true });
  return normalized;
}

export async function saveNamedRecord(uid, collectionName, record) {
  if (collectionName !== "categories" && collectionName !== "customers") {
    throw new Error("Jenis data bernama tidak dikenal.");
  }
  const prefix = collectionName === "categories" ? "cat" : "cust";
  const id = createNamedRecordId(prefix, record.name);
  const previousId = String(record.id || "");
  const normalized = { ...record, id, updatedAt: new Date().toISOString() };
  const batch = writeBatch(db);
  batch.set(doc(collectionFor(uid, collectionName), id), normalized, { merge: true });
  if (previousId && previousId !== id) {
    batch.delete(doc(collectionFor(uid, collectionName), previousId));
  }
  await batch.commit();
  return normalized;
}

export async function removeRecord(uid, collectionName, id) {
  await deleteDoc(doc(collectionFor(uid, collectionName), usableDocumentId(id, "invalid-id")));
}

export function subscribeToUserData(uid, onData, onStatus) {
  const data = Object.fromEntries(DATA_COLLECTIONS.map((name) => [name, []]));
  const initialized = new Set();
  const sourceByCollection = new Map();
  let hasError = false;

  const unsubscribe = DATA_COLLECTIONS.map((name) => onSnapshot(
    collectionFor(uid, name),
    { includeMetadataChanges: true },
    (snapshot) => {
      initialized.add(name);
      sourceByCollection.set(name, snapshot.metadata.fromCache ? "cache" : "server");
      data[name] = sortRows(name, snapshot.docs.map((item) => ({ ...item.data(), id: item.id })));

      if (initialized.size === DATA_COLLECTIONS.length) {
        onData({
          categories: [...data.categories],
          customers: [...data.customers],
          transactions: [...data.transactions],
          losses: [...data.losses]
        });
        const allFromServer = DATA_COLLECTIONS.every((key) => sourceByCollection.get(key) === "server");
        if (!hasError) onStatus(allFromServer ? "connected" : "local", null);
      } else if (!hasError) {
        onStatus("loading", null);
      }
    },
    (error) => {
      if (hasError) return;
      hasError = true;
      onStatus("error", error);
    }
  ));

  return () => {
    unsubscribe.forEach((stop) => stop());
    if (!hasError) onStatus("stopped", null);
  };
}
