import React, { ReactNode } from "react";
import { format } from "date-fns";
import { formatInTimeZone, getHoursInTimeZone } from "@/lib/date-utils";
import { User, Trash2, Edit2, Calendar, Download } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { clsx } from "clsx";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDisplayName } from "@/lib/utils";
import { generateGoogleCalendarUrl, downloadIcsFile } from "@/lib/calendarExport";

interface Schedule {
    id: string;
    className: string;
    teacherName: string;
    startTime: Timestamp;
    endTime: Timestamp;
    observation?: string;
    teacherId?: string;
    scheduleStatus?: string;
    checkInCompleted?: boolean;
    checkInAt?: Timestamp | null;
    checkInDiscrepancy?: boolean;
    checkOutCompleted?: boolean;
    checkOutAt?: Timestamp | null;
    checkOutDiscrepancy?: boolean;
}

interface ScheduleCardProps {
    item: Schedule;
    colors: { bg: string; border: string; text: string };
    onScheduleClick?: (schedule: Schedule) => void;
    handleDeleteSchedule?: (id: string) => void;
    onEditSchedule?: (schedule: Schedule) => void;
    renderScheduleActions?: (schedule: Schedule) => ReactNode;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function ScheduleCard({
    item,
    colors,
    onScheduleClick,
    handleDeleteSchedule,
    onEditSchedule,
    renderScheduleActions,
    canEdit = true,
    canDelete = true,
}: ScheduleCardProps) {
    const isConflict = item.scheduleStatus === 'conflict_flagged';

    return (
        <div
            className={clsx(
                "border-l-4 rounded-lg p-2.5 text-xs text-left space-y-1.5 relative group transition-all duration-200 shadow-sm hover:shadow-md",
                onScheduleClick ? "cursor-pointer hover:scale-[1.01]" : "cursor-default",
                isConflict ? "bg-red-50 border-red-500 ring-2 ring-red-200 ring-offset-1 animate-pulse" : colors.bg,
                isConflict ? "border-red-600" : colors.border
            )}
            onClick={() => onScheduleClick?.(item)}
            title={isConflict ? "CONFLITO DETECTADO: Verifique o Hub de Conflitos" : (item.observation || undefined)}
        >
            {isConflict && (
                <div className="absolute top-1 right-1">
                    <Badge variant="destructive" className="h-4 p-0 px-1 text-[8px] uppercase">Conflito</Badge>
                </div>
            )}
            
            <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-900/90 rounded px-1 py-0.5 shadow-sm border border-slate-200 dark:border-slate-800 z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-100 text-slate-600 hover:text-blue-600"
                    title="Adicionar ao Google Agenda"
                    onClick={(event) => {
                        event.stopPropagation();
                        const url = generateGoogleCalendarUrl(item as any);
                        window.open(url, "_blank", "noopener,noreferrer");
                    }}
                >
                    <Calendar className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 hover:bg-slate-100 text-slate-600 hover:text-emerald-600"
                    title="Baixar evento iCal (.ics)"
                    onClick={(event) => {
                        event.stopPropagation();
                        downloadIcsFile([item as any], `${item.className || 'aula'}_${item.id.slice(0, 5)}.ics`);
                    }}
                >
                    <Download className="h-3 w-3" />
                </Button>
                {renderScheduleActions?.(item)}
                {onEditSchedule && canEdit && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-slate-100"
                        onClick={(event) => {
                            event.stopPropagation();
                            onEditSchedule(item);
                        }}
                    >
                        <Edit2 className="h-3 w-3" />
                    </Button>
                )}
                {handleDeleteSchedule && canDelete && (
                    <Button
                        variant="destructive"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteSchedule(item.id);
                        }}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                )}
            </div>

            <div className="font-semibold text-slate-900">
                {formatInTimeZone(item.startTime.toDate(), "HH:mm")} - {formatInTimeZone(item.endTime.toDate(), "HH:mm")}
            </div>
            <div>
                <Badge variant="secondary" className="max-w-full truncate">
                    {item.className || "Reserva avulsa"} 
                    {item.className && (
                        <span className="ml-1 opacity-60 text-[9px] font-bold">
                            ({getHoursInTimeZone(item.startTime.toDate()) < 12 ? 'M' : getHoursInTimeZone(item.startTime.toDate()) < 18 ? 'V' : 'N'})
                        </span>
                    )}
                </Badge>
            </div>
            <div className="flex items-center text-slate-700">
                <User className="h-3 w-3 mr-1.5 shrink-0" />
                {formatDisplayName(item.teacherName)}
            </div>

            {/* Badges de Check-in / Check-out / Avaria */}
            {(item.checkInCompleted || item.checkOutCompleted || item.checkInDiscrepancy || item.checkOutDiscrepancy) && (
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {item.checkInCompleted && (
                        <span 
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                            title="Check-in confirmado pelo docente"
                        >
                            ✓ In
                        </span>
                    )}
                    {item.checkOutCompleted && (
                        <span 
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold bg-sky-100 text-sky-800 border border-sky-300 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-800"
                            title="Check-out confirmado pelo docente"
                        >
                            ✓ Out
                        </span>
                    )}
                    {(item.checkInDiscrepancy || item.checkOutDiscrepancy) && (
                        <span 
                            className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-400 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700 animate-pulse"
                            title="Avaria ou item faltante registrado na vistoria"
                        >
                            ⚠ Avaria
                        </span>
                    )}
                </div>
            )}
            {item.observation && (
                <div className="border-t border-slate-300/70 pt-1 text-[11px] leading-snug text-slate-700">
                    <span className="font-semibold text-slate-900">Obs:</span> {item.observation}
                </div>
            )}
        </div>
    );
}
