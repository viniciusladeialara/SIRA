import React, { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";

interface Class { id: string; name: string; teacherIds: string[]; teacherNames: string[]; period: string; courseId?: string; courseName?: string; }
interface Room { id: string; name: string; block: string; floor: string; type: string; capacity: number; }
interface Teacher { id: string; name: string; }

interface ScheduleFormProps {
  classes: Class[];
  teachers: Teacher[];
  rooms: Room[];
  availableBlocks: string[];
  formData: {
    classId: string;
    professorId: string;
    blockId: string;
    environmentId: string;
    startDate: string;
    endDate: string;
    observation: string;
    isDirectBooking?: boolean;
    customEventName?: string;
  };
  setFormData: (data: any) => void;
  currentAllocation: {
    startTime: string;
    endTime: string;
    daysOfWeek: number[];
  };
  setCurrentAllocation: (data: any) => void;
  loggedInUserName?: string;
}

const daysOfWeekButtons = [
  { label: 'S', value: 1, title: 'Segunda-feira' }, { label: 'T', value: 2, title: 'Terça-feira' },
  { label: 'Q', value: 3, title: 'Quarta-feira' }, { label: 'Q', value: 4, title: 'Quinta-feira' },
  { label: 'S', value: 5, title: 'Sexta-feira' }
];

export function ScheduleForm({
  classes,
  teachers,
  rooms,
  availableBlocks,
  formData,
  setFormData,
  currentAllocation,
  setCurrentAllocation,
  loggedInUserName
}: ScheduleFormProps) {
  
  const [turmaSearch, setTurmaSearch] = React.useState("");
  const [profSearch, setProfSearch] = React.useState("");

  const filteredClasses = useMemo(() => {
    if (!turmaSearch) return classes;
    return classes.filter(c => 
      c.name.toLowerCase().includes(turmaSearch.toLowerCase()) || 
      (c.period && c.period.toLowerCase().includes(turmaSearch.toLowerCase()))
    );
  }, [classes, turmaSearch]);

  const filteredTeachersByClass = useMemo(() => {
    if (formData.isDirectBooking) {
      if (!profSearch) return teachers;
      return teachers.filter(t => t.name.toLowerCase().includes(profSearch.toLowerCase()));
    }
    if (!formData.classId || !classes.length || !teachers.length) return [];
    const selectedClass = classes.find(c => c.id === formData.classId);
    if (!selectedClass || !selectedClass.teacherIds || !Array.isArray(selectedClass.teacherIds)) return [];
    const classTeachers = teachers.filter(teacher => selectedClass.teacherIds.includes(teacher.id));
    
    if (!profSearch) return classTeachers;
    return classTeachers.filter(t => t.name.toLowerCase().includes(profSearch.toLowerCase()));
  }, [formData.classId, formData.isDirectBooking, classes, teachers, profSearch]);

  const filteredRoomsByBlock = useMemo(() => {
    if (!formData.blockId) return [];
    return rooms.filter(room => room.block === formData.blockId);
  }, [rooms, formData.blockId]);

  const handleClassChange = (classId: string) => {
    setFormData((prev: any) => ({ ...prev, classId, professorId: '' }));
    setProfSearch("");
  };

  const handleBlockChange = (blockId: string) => {
    setFormData((prev: any) => ({ ...prev, blockId, environmentId: '' }));
  };

  const handleToggleDayOfWeek = (dayValue: number) => {
    setCurrentAllocation((prev: any) => {
      const current = prev.daysOfWeek;
      const updated = current.includes(dayValue) ? current.filter((d: number) => d !== dayValue) : [...current, dayValue].sort();
      return { ...prev, daysOfWeek: updated };
    });
  };

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="direct-booking-toggle"
            checked={formData.isDirectBooking || false}
            onChange={(e) => {
              const isChecked = e.target.checked;
              setFormData({
                ...formData,
                isDirectBooking: isChecked,
                classId: isChecked ? 'direct_booking' : '',
                professorId: '',
                customEventName: ''
              });
            }}
            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4"
          />
          <Label htmlFor="direct-booking-toggle" className="font-semibold cursor-pointer text-slate-700 dark:text-slate-300">
            Reserva Direta (Reunião / Evento / Uso Livre)
          </Label>
        </div>

        {formData.isDirectBooking && loggedInUserName && (
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
            Solicitante: <strong>{loggedInUserName}</strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {formData.isDirectBooking ? (
          <div className="space-y-2">
            <Label htmlFor="create-event-name">Nome do Evento / Reserva *</Label>
            <Input
              id="create-event-name"
              value={formData.customEventName || ''}
              onChange={(e) => setFormData({ ...formData, customEventName: e.target.value })}
              placeholder="Ex: Reunião de Alinhamento / Manutenção"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="create-class">Turma *</Label>
            <Select value={formData.classId} onValueChange={handleClassChange}>
              <SelectTrigger id="create-class"><SelectValue placeholder="Selecione uma turma" /></SelectTrigger>
              <SelectContent>
                <div className="flex items-center px-3 pb-2 border-b">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <input
                    className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Buscar turma..."
                    value={turmaSearch}
                    onChange={(e) => setTurmaSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto pt-1">
                  {filteredClasses.length > 0 ? (
                    filteredClasses.map(turma => (
                      <SelectItem key={turma.id} value={turma.id}>
                        {turma.name} {turma.period ? `(${turma.period.charAt(0).toUpperCase()})` : ''}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="py-6 text-center text-sm">Nenhuma turma encontrada.</div>
                  )}
                </div>
              </SelectContent>
            </Select>
          </div>
        )}
        
        <div className="space-y-2">
          <Label htmlFor="create-teacher">{formData.isDirectBooking ? "Professor Responsável (Opcional)" : "Professor * "}</Label>
          <Select value={formData.professorId} onValueChange={(value) => setFormData({ ...formData, professorId: value })} disabled={!formData.isDirectBooking && !formData.classId}>
            <SelectTrigger id="create-teacher"><SelectValue placeholder={formData.isDirectBooking ? "Selecione o professor (opcional)" : (formData.classId ? "Selecione um professor" : "Selecione a turma")} /></SelectTrigger>
            <SelectContent>
              <div className="flex items-center px-3 pb-2 border-b">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Buscar professor..."
                  value={profSearch}
                  onChange={(e) => setProfSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="max-h-[200px] overflow-y-auto pt-1">
                {filteredTeachersByClass.length > 0 ? (
                  filteredTeachersByClass.map(prof => (
                    <SelectItem key={prof.id} value={prof.id}>{prof.name}</SelectItem>
                  ))
                ) : (
                  <div className="py-6 text-center text-sm">
                    {formData.isDirectBooking ? "Nenhum professor encontrado." : "Selecione uma turma primeiro."}
                  </div>
                )}
              </div>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-block">Bloco *</Label>
          <Select value={formData.blockId} onValueChange={handleBlockChange}>
            <SelectTrigger id="create-block"><SelectValue placeholder="Selecione um bloco" /></SelectTrigger>
            <SelectContent>
              {availableBlocks.map(block => <SelectItem key={block} value={block}>Bloco {block}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-environment">Ambiente *</Label>
          <Select value={formData.environmentId} onValueChange={(value) => setFormData({ ...formData, environmentId: value })} disabled={!formData.blockId}>
            <SelectTrigger id="create-environment"><SelectValue placeholder={formData.blockId ? "Selecione um ambiente" : "Selecione o bloco"} /></SelectTrigger>
            <SelectContent>
              {filteredRoomsByBlock.length > 0 ? filteredRoomsByBlock.map(env => <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>) : <div className="px-2 py-1.5 text-sm">Nenhum ambiente neste bloco</div>}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-startDate">Data de Início *</Label>
          <Input id="create-startDate" type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="create-endDate">Data de Fim (Opcional)</Label>
          <Input id="create-endDate" type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observation">Observação (Opcional)</Label>
        <Input id="observation" placeholder="Campo livre para escrita..." value={formData.observation} onChange={(e) => setFormData({ ...formData, observation: e.target.value })} maxLength={100} />
      </div>

      <div className="space-y-4 pt-2 border-t mt-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          Horários de Alocação
        </h3>
        <Card className="p-4 space-y-4 bg-muted/30">
          <div>
            <Label className="mb-3 block text-sm font-medium">Dias da Semana</Label>
            <div className="flex gap-2 justify-between">
              {daysOfWeekButtons.map(day => (
                <Button
                  key={day.value}
                  type="button"
                  variant={currentAllocation.daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => handleToggleDayOfWeek(day.value)}
                  className="h-10 w-10 transition-all duration-200"
                  title={day.title}
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Horário de Início</Label>
              <Input type="time" value={currentAllocation.startTime} onChange={(e) => setCurrentAllocation({ ...currentAllocation, startTime: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Horário de Fim</Label>
              <Input type="time" value={currentAllocation.endTime} onChange={(e) => setCurrentAllocation({ ...currentAllocation, endTime: e.target.value })} />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
