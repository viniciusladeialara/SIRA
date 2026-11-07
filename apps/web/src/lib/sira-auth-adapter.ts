import { apiService } from '@/services/apiService';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export const browserSessionPersistence = 'SESSION';

export const getAuth = (app?: any) => ({
  currentUser: null,
});

export const setPersistence = async (auth: any, persistence: any) => {};

export const signInWithEmailAndPassword = async (auth: any, email: string, password: string) => {
  const res = await apiService.login(email, password);
  return {
    user: {
      uid: res.user?.id || 'admin_uid',
      email: res.user?.email || email,
      displayName: res.user?.nome || 'Administrador',
    },
  };
};

export const signOut = async (auth?: any) => {
  await apiService.logout();
};

export const onAuthStateChanged = (auth: any, callback: (user: User | null) => void) => {
  const check = () => {
    try {
      const stored = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      if (stored && token) {
        const u = JSON.parse(stored);
        callback({
          uid: u.id || 'uid',
          email: u.email || 'admin@sira.local',
          displayName: u.nome || 'Usuário SIRA',
        });
        return;
      }
    } catch {}
    callback(null);
  };

  check();
  window.addEventListener('storage', check);
  return () => {
    window.removeEventListener('storage', check);
  };
};

export const updatePassword = async (user: any, newPassword: string) => {};
export const sendPasswordResetEmail = async (auth: any, email: string) => {};
export const verifyPasswordResetCode = async (auth: any, code: string) => 'admin@sira.local';
export const confirmPasswordReset = async (auth: any, code: string, newPassword: string) => {};
