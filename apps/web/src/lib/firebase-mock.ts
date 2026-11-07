import { Timestamp } from "./timestamp";

export { Timestamp };

export const db = {};
export const auth = {
  currentUser: null,
  onAuthStateChanged: (cb: any) => { cb(null); return () => {}; }
};
export const functions = {};

// Firestore exports
export const collection = (...args: any[]) => ({});
export const doc = (...args: any[]) => ({});
export const getDocs = async (...args: any[]) => ({ docs: [] });
export const getDoc = async (...args: any[]) => ({ exists: () => false, data: () => ({}) });
export const setDoc = async (...args: any[]) => {};
export const updateDoc = async (...args: any[]) => {};
export const deleteDoc = async (...args: any[]) => {};
export const addDoc = async (...args: any[]) => ({ id: 'mock_id' });
export const query = (...args: any[]) => ({});
export const where = (...args: any[]) => ({});
export const orderBy = (...args: any[]) => ({});
export const limit = (...args: any[]) => ({});
export const startAfter = (...args: any[]) => ({});
export const onSnapshot = (...args: any[]) => { return () => {}; };
export const serverTimestamp = () => new Date();
export const arrayUnion = (...args: any[]) => args;
export const arrayRemove = (...args: any[]) => args;
export const increment = (n: number) => n;
export const runTransaction = async (db: any, updateFunction: any) => updateFunction({
  get: async () => ({ exists: () => false, data: () => ({}) }),
  set: () => {},
  update: () => {},
  delete: () => {}
});
export const writeBatch = (...args: any[]) => ({
  set: () => {},
  update: () => {},
  delete: () => {},
  commit: async () => {}
});

// Auth exports
export const signInWithEmailAndPassword = async () => ({ user: null });
export const signOut = async () => {};
export const onAuthStateChanged = (auth: any, cb: any) => { cb(null); return () => {}; };
export const updatePassword = async () => {};
export const verifyPasswordResetCode = async () => "user@example.com";
export const confirmPasswordReset = async () => {};
export const setPersistence = async () => {};
export const browserSessionPersistence = "SESSION";
export const sendPasswordResetEmail = async () => {};

// Functions exports
export const httpsCallable = (...args: any[]) => async (...fnArgs: any[]) => ({ data: {} });
