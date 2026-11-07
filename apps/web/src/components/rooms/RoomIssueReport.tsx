import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useToast } from "@/components/ui/use-toast";
import { collection, addDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { Loader, AlertTriangle } from "lucide-react";

interface RoomIssueReportProps {
    isOpen: boolean;
    onClose: () => void;
    roomId: string;
    roomName: string;
    teacherId: string;
    teacherName: string;
}

export function RoomIssueReport({ isOpen, onClose, roomId, roomName, teacherId, teacherName }: RoomIssueReportProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [type, setType] = useState<string>("");
    const [severity, setSeverity] = useState<string>("medium");
    const [description, setDescription] = useState("");

    const handleReport = async () => {
        if (!type || !description) {
            toast({ title: "Atenção", description: "Selecione o tipo e descreva o problema.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, "room_issues"), {
                roomId,
                roomName,
                teacherId,
                teacherName,
                type,
                severity,
                description,
                status: "open",
                createdAt: Timestamp.now()
            });

            toast({ title: "Problema Registrado", description: "A equipe de manutenção foi notificada." });
            onClose();
        } catch (error) {
            console.error(error);
            toast({ title: "Erro na abertura", description: "Tente novamente mais tarde.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500" /> Reportar Problema
                    </DialogTitle>
                    <DialogDescription>
                        Ambiente selecionado: <span className="font-semibold text-black">{roomName}</span>.
                        Detalhe o que está acontecendo.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>Categoria do Problema</Label>
                        <Select value={type} onValueChange={setType}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hardware">Computador / Peças / Cabo</SelectItem>
                                <SelectItem value="network">Rede / Conexão</SelectItem>
                                <SelectItem value="ac">Ar Condicionado</SelectItem>
                                <SelectItem value="cleaning">Limpeza / Conservação</SelectItem>
                                <SelectItem value="other">Outro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Prioridade</Label>
                        <Select value={severity} onValueChange={setSeverity}>
                            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="low">Baixa (Pode ser consertado depois)</SelectItem>
                                <SelectItem value="medium">Média (Atrapalha aula mas não impede)</SelectItem>
                                <SelectItem value="high">Alta (Impede que a aula aconteça)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea
                            placeholder="Por favor, dê o máximo de detalhes para a TI/Manutenção encontrar rápido..."
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="min-h-[100px]"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                    <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
                    <Button variant="destructive" onClick={handleReport} disabled={loading}>
                        {loading ? <Loader className="animate-spin w-4 h-4 mr-2" /> : null}
                        Gravar Ocorrência
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
