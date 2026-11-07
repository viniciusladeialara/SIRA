import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export interface TeacherData {
    id: string; // Auth UID
    name: string;
    email: string;
    mustChangePassword?: boolean;
}

export function useTeacherAuth() {
    const [emailInput, setEmailInput] = useState<string>("");
    const [passwordInput, setPasswordInput] = useState<string>("");

    const [teacher, setTeacher] = useState<TeacherData | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authError, setAuthError] = useState<string>("");
    const [isInitialized, setIsInitialized] = useState(false);

    // Monitor Firebase Auth State
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Try to fetch teacher data from Firestore to ensure the user is a PROFESSOR
                    const teacherDoc = await getDoc(doc(db, "teachers", user.uid));
                    if (teacherDoc.exists()) {
                        const data = teacherDoc.data();

                        // Security check: Make sure professor is active
                        if (data.isActive === false) {
                            await signOut(auth);
                            setAuthError("Sua conta de professor está inativada. Entre em contato com o administrador.");
                            setTeacher(null);
                        } else {
                            setTeacher({
                                id: user.uid,
                                name: data.name || user.displayName || "Professor",
                                email: user.email || data.email || "",
                                mustChangePassword: data.mustChangePassword === true,
                            });
                            setAuthError("");
                        }
                    } else {
                        // User exists but has no teacher profile
                        // Maybe it's an admin or student logged in. We log them out of the teacher panel.
                        await signOut(auth);
                        setTeacher(null);
                        setAuthError("Esta conta não é de um professor cadastrado.");
                    }
                } catch (error) {
                    console.error("Error fetching teacher profile:", error);
                    setTeacher(null);
                }
            } else {
                setTeacher(null);
            }
            setIsInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    const login = async () => {
        setAuthError("");
        if (!emailInput.trim() || !passwordInput) {
            setAuthError("Preencha email e senha.");
            return;
        }

        setIsAuthenticating(true);
        try {
            await signInWithEmailAndPassword(auth, emailInput.trim(), passwordInput);
            setEmailInput("");
            setPasswordInput("");
        } catch (error: any) {
            console.error("Erro ao autenticar:", error);
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                setAuthError("Email ou senha inválidos.");
            } else {
                setAuthError("Falha na autenticação. Tente novamente.");
            }
        } finally {
            setIsAuthenticating(false);
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setTeacher(null);
            setEmailInput("");
            setPasswordInput("");
            setAuthError("");
        } catch (error) {
            console.error("Erro ao deslogar:", error);
        }
    };

    return {
        teacher,
        emailInput,
        setEmailInput,
        passwordInput,
        setPasswordInput,
        login,
        logout,
        isAuthenticating,
        authError,
        isInitialized,
    };
}
