import React from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "@/lib/date-utils";
import { ptBR } from "date-fns/locale";
import { clsx } from "clsx";
import { Building, Users, Hash, CalendarDays, Plus } from "lucide-react";
import { Timestamp } from "@/lib/sira-sql-adapter";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScheduleCard } from "./ScheduleCard";

interface Schedule {
    id: string;
    className: string;
    roomName: string;
    teacherName: string;
    startTime: Timestamp;
    endTime: Timestamp;
    roomId: string;
    teacherId: string;
    classId?: string;
    observation?: string;
    scheduleStatus?: string;
}

interface Room {
    id: string;
    name: string;
    block: string;
    floor: string;
    type: string;
    capacity: number;
}

interface Holiday {
    id: string;
    date: { toDate: () => Date };
    name: string;
}

interface ScheduleGridProps {
    groupedRooms: Record<string, Room[]>;
    weekDays: Date[];
    getHolidayForDay: (day: Date) => Holiday | undefined;
    handleAddHoliday?: (day: Date) => void;
    handleDeleteHoliday?: (id: string) => void;
    getSchedulesForRoomAndDay: (roomId: string, day: Date) => Schedule[];
    getTurnoAndColor: (startTime: Timestamp) => { name: string; colors: { bg: string; border: string; text: string } };
    handleDeleteSchedule?: (id: string) => void;
    onEditSchedule?: (schedule: Schedule) => void;
    onScheduleClick?: (schedule: Schedule) => void;
    onEmptyCellClick?: (room: Room, day: Date) => void;
    renderScheduleActions?: (schedule: Schedule) => ReactNode;
    userRole?: string;
    teacherId?: string;
    shifts?: string[];
}

export function ScheduleGrid({
    groupedRooms,
    weekDays,
    getHolidayForDay,
    handleAddHoliday,
    handleDeleteHoliday,
    getSchedulesForRoomAndDay,
    getTurnoAndColor,
    handleDeleteSchedule,
    onEditSchedule,
    onScheduleClick,
    onEmptyCellClick,
    renderScheduleActions,
    userRole,
    teacherId,
    shifts,
}: ScheduleGridProps) {
    return (
        <table className="w-full border-separate border-spacing-0 text-center table-fixed">
            <colgroup>
                <col className="w-[200px]" />
                {weekDays.map((day) => (
                    <col key={day.toISOString()} className="w-auto" />
                ))}
            </colgroup>

            <thead className="sticky top-0 z-30 bg-slate-50 dark:bg-slate-800 shadow-sm">
                <tr>
                    <th className="p-3 text-left sticky top-0 left-0 z-50 bg-slate-50 dark:bg-slate-800 border-b border-r shadow-sm">
                        Ambiente
                    </th>
                    {weekDays.map((day) => (
                        <th key={day.toISOString()} className="p-3 sticky top-0 bg-slate-50 dark:bg-slate-800 z-30 border-b border-r shadow-sm align-top">
                            {handleAddHoliday || handleDeleteHoliday ? (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <button type="button" className="flex w-full flex-col items-center cursor-pointer hover:bg-background/80 rounded-md p-1 text-center">
                                            <div className="font-semibold capitalize">{formatInTimeZone(day, "EEEE")}</div>
                                            <div className="text-sm font-normal text-muted-foreground">{formatInTimeZone(day, "dd/MM")}</div>
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-48 text-sm p-2">
                                        {getHolidayForDay(day) ? (
                                            <div className="flex flex-col space-y-1 text-left">
                                                <span>Feriado: {getHolidayForDay(day)!.name}</span>
                                                {handleDeleteHoliday && (
                                                    <Button variant="destructive" size="sm" onClick={() => handleDeleteHoliday(getHolidayForDay(day)!.id)}>
                                                        Remover
                                                    </Button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col space-y-1 text-left">
                                                <span>{formatInTimeZone(day, "dd 'de' MMMM")}</span>
                                                {handleAddHoliday && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleAddHoliday(day)}>
                                                        Marcar Feriado
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </PopoverContent>
                                </Popover>
                            ) : (
                                <div className="flex flex-col items-center rounded-md p-1 text-center">
                                    <div className="font-semibold capitalize">{formatInTimeZone(day, "EEEE")}</div>
                                    <div className="text-sm font-normal text-muted-foreground">{formatInTimeZone(day, "dd/MM")}</div>
                                    {getHolidayForDay(day) && (
                                        <Badge variant="secondary" className="mt-2">
                                            {getHolidayForDay(day)!.name}
                                        </Badge>
                                    )}
                                </div>
                            )}
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {Object.entries(groupedRooms).map(([block, roomsInBlock]) => (
                    <React.Fragment key={block}>
                        <tr className="bg-slate-200 dark:bg-slate-800">
                            <td colSpan={weekDays.length + 1} className="p-2 text-left font-bold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-200 dark:bg-slate-800 z-20 border-b border-r">
                                BLOCO {block}
                            </td>
                        </tr>

                        {roomsInBlock.map((room) => {
                            const getShiftOrder = (name: string) => {
                                const lower = name.toLowerCase();
                                if (lower.includes("matutino") || lower.includes("morning")) return 1;
                                if (lower.includes("vespertino") || lower.includes("afternoon")) return 2;
                                if (lower.includes("noturno") || lower.includes("night")) return 3;
                                return 4;
                            };
                            const shiftsList = ((shifts && shifts.length > 0) ? shifts.map(s => s.toLowerCase()) : ["matutino", "vespertino", "noturno"])
                                .sort((a, b) => getShiftOrder(a) - getShiftOrder(b));
                            return (
                                <React.Fragment key={room.id}>
                                    {shiftsList.map((shift, shiftIndex) => (
                                        <tr key={`${room.id}-${shift}`} className="group hover:bg-slate-50/50 transition-colors">
                                            {shiftIndex === 0 && (
                                                <td rowSpan={shiftsList.length} className="p-3 font-medium text-sm align-top text-left sticky left-0 bg-white dark:bg-slate-900 z-20 border-r border-b shadow-sm w-[200px]">
                                                    <p className="font-bold text-sm leading-tight text-slate-900">{room.name}</p>
                                                    <div className="text-[10px] text-muted-foreground mt-2 space-y-1.5 opacity-80">
                                                        <div className="flex items-center gap-2"><Building className="h-2.5 w-2.5 shrink-0" />{room.type}</div>
                                                        <div className="flex items-center gap-2"><Users className="h-2.5 w-2.5 shrink-0" />Cap: {room.capacity}</div>
                                                    </div>
                                                </td>
                                            )}

                                            {weekDays.map((day) => {
                                                const schedules = getSchedulesForRoomAndDay(room.id, day);
                                                const holiday = getHolidayForDay(day);
                                                const shiftSchedules = schedules.filter(s => getTurnoAndColor(s.startTime).name === shift);
                                                
                                                if (holiday) {
                                                    if (shiftIndex === 0) {
                                                        return (
                                                            <td key={day.toISOString()} rowSpan={shiftsList.length} className="border-r border-b p-2 align-middle bg-amber-50/30">
                                                                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center">
                                                                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] mb-1">
                                                                        Feriado
                                                                    </Badge>
                                                                    <p className="text-xs font-bold text-amber-900 line-clamp-2">{holiday.name}</p>
                                                                </div>
                                                            </td>
                                                        );
                                                    }
                                                    return null;
                                                }

                                                return (
                                                    <td key={day.toISOString()} className={clsx(
                                                        "border-r border-b p-1.5 align-top transition-all",
                                                        shift === 'matutino' ? "bg-blue-50/5" : shift === 'vespertino' ? "bg-orange-50/5" : "bg-purple-50/5",
                                                        "min-h-[60px]"
                                                    )}>
                                                        {shiftSchedules.length === 0 ? (
                                                            <div className="flex items-center h-full min-h-[48px] px-2 py-1 rounded-md border border-dashed border-transparent hover:border-slate-200 hover:bg-slate-50 group/item transition-all">
                                                                <div className="flex flex-col items-start mr-auto">
                                                                    <span className="text-[9px] font-black text-blue-600/40 uppercase tracking-tighter mb-0.5">
                                                                        {shift}
                                                                    </span>
                                                                    <span className="text-[8px] font-bold text-slate-400 uppercase leading-tight">
                                                                        Ambiente Livre para Agendamento
                                                                    </span>
                                                                </div>
                                                                {onEmptyCellClick && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity rounded-full bg-white shadow-sm border"
                                                                        onClick={() => onEmptyCellClick(room, day)}
                                                                        title={`Reservar (${shift})`}
                                                                    >
                                                                        <Plus className="h-3 w-3 text-blue-600" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-1.5 relative">
                                                                <span className="absolute -top-1 -left-1 text-[8px] font-black text-slate-200 uppercase pointer-events-none select-none z-0">
                                                                    {shift.charAt(0)}
                                                                </span>
                                                                <div className="relative z-10 space-y-1">
                                                                    {shiftSchedules.map((item) => {
                                                                        const { colors } = getTurnoAndColor(item.startTime);
                                                                        return (
                                                                            <ScheduleCard 
                                                                                key={item.id}
                                                                                item={item as any}
                                                                                colors={colors}
                                                                                onScheduleClick={onScheduleClick as any}
                                                                                handleDeleteSchedule={handleDeleteSchedule}
                                                                                onEditSchedule={onEditSchedule as any}
                                                                                renderScheduleActions={renderScheduleActions as any}
                                                                                canEdit={userRole === 'ADMIN' || userRole === 'USER' || (userRole === 'PROFESSOR' && item.teacherId === teacherId)}
                                                                                canDelete={userRole === 'ADMIN' || userRole === 'USER' || (userRole === 'PROFESSOR' && item.teacherId === teacherId)}
                                                                            />
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </React.Fragment>
                            );
                        })}
                    </React.Fragment>
                ))}
            </tbody>
        </table>
    );
}
