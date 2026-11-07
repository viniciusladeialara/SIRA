import { Badge } from "@/components/ui/badge";
import { format, getHours } from "date-fns";
import { Schedule } from "@/services/reservationService";
import { MapPin, BookOpen, ArrowRightLeft } from "lucide-react";

interface TeacherCalendarProps {
    schedules: Schedule[];
    onSwapRequest?: (schedule: Schedule) => void;
    onReportIssue?: (schedule: Schedule) => void;
}

const turnoColors = {
    matutino: { bg: "bg-blue-100", border: "border-blue-500", text: "text-blue-800" },
    vespertino: { bg: "bg-orange-100", border: "border-orange-500", text: "text-orange-800" },
    noturno: { bg: "bg-purple-100", border: "border-purple-500", text: "text-purple-800" },
};

const getTurnoAndColor = (startTime: Date) => {
    const hour = getHours(startTime);
    if (hour >= 7 && hour < 13) return turnoColors.matutino;
    if (hour >= 13 && hour < 18) return turnoColors.vespertino;
    return turnoColors.noturno;
};

export function TeacherCalendar({ schedules, onSwapRequest, onReportIssue }: TeacherCalendarProps) {
    if (schedules.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg border border-dashed mt-4">
                <p className="text-muted-foreground text-center">
                    Nenhuma aula encontrada para voce neste periodo.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {schedules.map((schedule) => {
                const start = schedule.startTime.toDate();
                const end = schedule.endTime.toDate();
                const colors = getTurnoAndColor(start);

                return (
                    <div
                        key={schedule.id}
                        className={`flex flex-col md:flex-row gap-4 p-4 rounded-lg border ${colors.bg} ${colors.border} transition-all hover:shadow-md cursor-pointer`}
                    >
                        <div className="hidden md:flex flex-col items-center justify-center min-w-24 border-r pr-4 border-gray-200">
                            <span className={`text-lg font-bold ${colors.text}`}>
                                {format(start, "HH:mm")}
                            </span>
                            <span className={`text-sm ${colors.text}`}>
                                {format(end, "HH:mm")}
                            </span>
                        </div>

                        <div className="flex-1 space-y-3">
                            <div className="flex justify-between items-start gap-3">
                                <h3 className={`font-semibold text-lg ${colors.text}`}>
                                    {schedule.className}
                                </h3>
                                <span className={`text-xs font-medium md:hidden ${colors.text}`}>
                                    {format(start, "HH:mm")} - {format(end, "HH:mm")}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                                <div className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{schedule.roomName}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{schedule.courseName}</span>
                                </div>
                            </div>

                            {schedule.observation && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                                    <strong>Observacao:</strong> {schedule.observation}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2 md:flex-col md:justify-center">
                            {onSwapRequest && (
                                <Badge
                                    variant="default"
                                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-xs gap-1"
                                    onClick={() => onSwapRequest(schedule)}
                                >
                                    <ArrowRightLeft className="w-3 h-3" /> Trocar
                                </Badge>
                            )}
                            {onReportIssue && (
                                <Badge
                                    variant="destructive"
                                    className="cursor-pointer text-xs gap-1"
                                    onClick={() => onReportIssue(schedule)}
                                >
                                    Reportar Problema
                                </Badge>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
