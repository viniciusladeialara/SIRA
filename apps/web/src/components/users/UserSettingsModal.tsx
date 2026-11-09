import { useState, useEffect } from "react";
import { auth, db } from "@/lib/db";
import { apiService } from "@/services/apiService";
import { doc, updateDoc } from "@/lib/sira-sql-adapter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader, Settings, Lock, User, CheckCircle2, AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: any;
    currentUser: any;
}

export function UserSettingsModal({ isOpen, onClose, userData, currentUser }: UserSettingsModalProps) {
    const { toast } = useToast();
    const [name, setName] = useState(userData?.name || "");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("profile");

    useEffect(() => {
        if (userData?.name) setName(userData.name);
    }, [userData]);

    const handleUpdateProfile = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            // Atualizar na coleção users
            const userRef = doc(db, "users", currentUser.uid);
            await updateDoc(userRef, { name: name.trim() });

            // Se for professor, atualizar na coleção teachers também
            if (userData?.role === "PROFESSOR") {
                const teacherRef = doc(db, "teachers", currentUser.uid);
                await updateDoc(teacherRef, { name: name.trim() });
            }

            toast({ title: "Perfil Atualizado", description: "Seu nome foi alterado com sucesso." });
            onClose();
        } catch (error: any) {
            console.error("Erro ao atualizar perfil:", error);
            toast({ title: "Erro", description: "Falha ao atualizar perfil.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (newPassword.length < 6) {
            toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
            return;
        }
        if (newPassword !== confirmPassword) {
            toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            await apiService.changePassword(newPassword);
            toast({ title: "Senha Alterada", description: "Sua senha foi atualizada com sucesso." });
            setNewPassword("");
            setConfirmPassword("");
            onClose();
        } catch (error: any) {
            console.error("Erro ao atualizar senha:", error);
            const msg = error.message || "Falha ao alterar senha.";
            toast({ title: "Erro", description: msg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-blue-600" />
                        Configurações da Conta
                    </DialogTitle>
                    <DialogDescription>
                        Gerencie suas informações de perfil e segurança.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profile" className="flex items-center gap-2">
                            <User className="h-4 w-4" /> Perfil
                        </TabsTrigger>
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Lock className="h-4 w-4" /> Segurança
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Seu Nome</Label>
                            <Input 
                                id="name" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                placeholder="Digite seu nome completo"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase">E-mail (Não editável)</Label>
                            <p className="text-sm font-medium bg-gray-50 p-2 rounded border">{currentUser?.email}</p>
                        </div>
                        <Button 
                            onClick={handleUpdateProfile} 
                            disabled={loading || !name.trim() || name === userData?.name}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Salvar Alterações
                        </Button>
                    </TabsContent>

                    <TabsContent value="security" className="space-y-4 py-4">
                        <div className="bg-amber-50 border border-amber-200 p-3 rounded-md flex gap-3 text-amber-900 text-xs">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <p>Para sua segurança, a alteração de senha exige que você tenha feito login recentemente (últimos 5-10 minutos).</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <Input 
                                id="new-password" 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                placeholder="Mínimo 6 caracteres"
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input 
                                id="confirm-password" 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                placeholder="Repita a nova senha"
                                disabled={loading}
                            />
                        </div>
                        <Button 
                            onClick={handleUpdatePassword} 
                            disabled={loading || !newPassword || newPassword !== confirmPassword}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? <Loader className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                            Atualizar Senha
                        </Button>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="sm:justify-start">
                    <Button variant="ghost" onClick={onClose} disabled={loading}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
