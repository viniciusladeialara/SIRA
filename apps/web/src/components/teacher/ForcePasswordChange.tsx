import { useState } from "react";
import { auth, db } from "@/lib/db";
import { updatePassword, signOut } from "@/lib/sira-auth-adapter";
import { doc, updateDoc, writeBatch, Timestamp } from "@/lib/sira-sql-adapter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader, ShieldAlert, LogOut } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ForcePasswordChangeProps {
    teacherId: string;
    onSuccess: () => void;
}

export function ForcePasswordChange({ teacherId, onSuccess }: ForcePasswordChangeProps) {
    const { toast } = useToast();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (newPassword !== confirmPassword) {
            toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
            return;
        }
        if (newPassword.length < 6) {
            toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            // 1. Atualizar senha no Firebase Auth
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, newPassword);
            } else {
                throw new Error("Usuário não autenticado no Firebase Auth");
            }

            // 2. Preparar as atualizações do banco
            const batch = writeBatch(db);
            const userRef = doc(db, "users", teacherId);
            const teacherRef = doc(db, "teachers", teacherId);

            // Atualização na coleção users (independente de ser professor ou não, o doc users existe)
            batch.update(userRef, {
                mustChangePassword: false,
                status: "active",
                updatedAt: Timestamp.now()
            });

            // Atualização na coleção teachers
            batch.update(teacherRef, {
                mustChangePassword: false,
                status: "active",
                updatedAt: Timestamp.now()
            });

            // 3. Executar o batch
            await batch.commit();

            toast({
                title: "Sucesso!",
                description: "Senha alterada com sucesso. Redirecionando...",
            });

            // 4. Notificar sucesso
            if (onSuccess) {
                setTimeout(() => {
                    onSuccess();
                }, 1500);
            }
        } catch (error: any) {
            console.error("Erro ao atualizar senha:", error);
            let errorMessage = "Ocorreu um erro ao atualizar sua senha.";
            
            if (error.code === 'auth/requires-recent-login') {
                errorMessage = "Por segurança, você precisa fazer login novamente antes de trocar a senha.";
            } else if (error.message?.includes("PERMISSION_DENIED")) {
                errorMessage = "Erro de permissão no banco de dados. Contate o administrador.";
            }

            setError(errorMessage);
            toast({
                title: "Falha na Atualização",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            window.location.reload();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4">
            <Card className="w-full max-w-md border-orange-200">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <ShieldAlert className="h-12 w-12 text-orange-500" />
                    </div>
                    <CardTitle>Troca de Senha Obrigatória</CardTitle>
                    <CardDescription className="text-orange-700 dark:text-orange-400">
                        Como este é seu primeiro acesso, é obrigatório trocar a senha padrão por uma senha pessoal segura.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
                            {error}
                        </div>
                    )}

                    <div>
                        <Label htmlFor="new-pwd">Nova Senha</Label>
                        <Input
                            id="new-pwd"
                            type="password"
                            placeholder="No mínimo 6 caracteres"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <Label htmlFor="confirm-pwd">Confirmar Nova Senha</Label>
                        <Input
                            id="confirm-pwd"
                            type="password"
                            placeholder="Repita a nova senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <div className="pt-2 flex flex-col gap-2">
                        <Button onClick={handleUpdate} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 text-white">
                            {loading ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar Nova Senha
                        </Button>
                        <Button variant="ghost" onClick={handleLogout} disabled={loading} className="w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            Sair e Fazer Login Novamente
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
