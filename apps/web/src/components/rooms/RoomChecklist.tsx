import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { collection, addDoc, getDocs, query, where, Timestamp } from "@/lib/sira-sql-adapter";
import { db } from "@/lib/db";
import { useToast } from "@/components/ui/use-toast";
import { Loader, CheckCircle2 } from "lucide-react";

interface ChecklistItem {
    id: string;
    label: string;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
    { id: "projector", label: "Projetor ligando e cabos presentes" },
    { id: "computer", label: "Computador da mesa logando" },
    { id: "internet", label: "Acesso à Internet funcional" },
    { id: "ac", label: "Ar Condicionado operando" },
    { id: "whiteboard", label: "Quadro e canetas em ordem" },
];

interface RoomChecklistProps {
    roomId: string;
    roomName: string;
    reservationId: string;
    teacherId: string;
    onComplete?: () => void;
}

export function RoomChecklist({ roomId, roomName, reservationId, teacherId, onComplete }: RoomChecklistProps) {
    const { toast } = useToast();
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    useEffect(() => {
        async function checkExisting() {
            const existing = await getDocs(query(
                collection(db, "room_checklists"),
                where("reservationId", "==", reservationId)
            ));
            if (!existing.empty) {
                setAlreadySubmitted(true);
            }
        }
        checkExisting();
    }, [reservationId]);

    const handleToggle = (id: string, checked: boolean) => {
        setCheckedItems(prev => ({ ...prev, [id]: checked }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await addDoc(collection(db, "room_checklists"), {
                roomId,
                reservationId,
                teacherId,
                items: checkedItems,
                createdAt: Timestamp.now()
            });
            setAlreadySubmitted(true);
            toast({
                title: "Checklist salvo",
                description: `Ambiente ${roomName} vistoriado com sucesso.`
            });
            if (onComplete) onComplete();
        } catch (error) {
            console.error(error);
            toast({
                title: "Houve um erro",
                description: "Não foi possível salvar o checklist da sala.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    if (alreadySubmitted) {
        return (
            <div className="flex flex-col items-center justify-center p-6 text-green-600 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle2 className="w-12 h-12 mb-2 opacity-80" />
                <h4 className="font-semibold text-center">Tudo certo!</h4>
                <p className="text-sm text-center">O checklist dessa aula já foi submetido.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-sm text-muted-foreground border-b pb-2">
                Verifique os equipamentos da {roomName}:
            </h3>
            <div className="grid gap-4">
                {DEFAULT_ITEMS.map((item) => (
                    <div key={item.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`check-${item.id}`}
                            checked={checkedItems[item.id] || false}
                            onCheckedChange={(c) => handleToggle(item.id, c as boolean)}
                        />
                        <Label htmlFor={`check-${item.id}`} className="font-normal cursor-pointer leading-tight">
                            {item.label}
                        </Label>
                    </div>
                ))}
            </div>
            <Button
                className="w-full mt-4"
                onClick={handleSave}
                disabled={loading}
            >
                {loading ? <Loader className="w-4 h-4 mr-2 animate-spin" /> : null}
                Concluir Vistoria
            </Button>
        </div>
    );
}
