import { useState } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Schedule } from "@/services/reservationService";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TeacherWeeklyCalendarProps {
    schedules: Schedule[];
    onSlotClick: (date: Date, hour: number) => void;
    onReservationClick: (schedule: Schedule) => void;
}

export function TeacherWeeklyCalendar({ schedules, onSlotClick, onReservationClick }: TeacherWeeklyCalendarProps) {
    const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
    const days = Array.from({ length: 5 }).map((_, i) => addDays(currentWeek, i));
    const hours = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

    const handlePrevWeek = () => setCurrentWeek(addDays(currentWeek, -7));
    const handleNextWeek = () => setCurrentWeek(addDays(currentWeek, 7));
    const handleToday = () => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }));

    return (
        <div className="flex flex-col border rounded-lg bg-white overflow-hidden shadow-sm">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50/50">
                <h3 className="font-semibold text-lg text-gray-800">Agenda Semanal</h3>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday}>Hoje</Button>
                    <div className="flex items-center border rounded-md bg-white">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={handlePrevWeek}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-3 text-sm font-medium border-x">
                            {format(days[0], "dd MMM", { locale: ptBR })} - {format(days[4], "dd MMM yyyy", { locale: ptBR })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={handleNextWeek}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    <div className="grid grid-cols-6 border-b bg-gray-50">
                        <div className="p-3 border-r text-center font-semibold text-xs text-gray-500 flex items-center justify-center uppercase tracking-wider">
                            Horario
                        </div>
                        {days.map(day => (
                            <div key={day.toISOString()} className="p-3 border-r text-center last:border-r-0">
                                <div className="font-bold text-gray-800 capitalize">{format(day, "EEEE", { locale: ptBR }).split("-")[0]}</div>
                                <div className={`text-xs mt-1 ${isSameDay(day, new Date()) ? "inline-block bg-blue-600 text-white rounded-full px-2 py-0.5" : "text-gray-500"}`}>
                                    {format(day, "dd/MM")}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="divide-y bg-white">
                        {hours.map(hour => (
                            <div key={hour} className="grid grid-cols-6 group">
                                <div className="p-2 border-r text-center text-xs font-medium text-gray-500 bg-gray-50/50 flex items-center justify-center">
                                    {hour.toString().padStart(2, "0")}:00
                                </div>
                                {days.map(day => {
                                    const slotSchedules = schedules.filter(s => {
                                        const start = s.startTime.toDate();
                                        const end = s.endTime.toDate();
                                        return isSameDay(start, day) && start.getHours() <= hour && end.getHours() > hour;
                                    });

                                    return (
                                        <div
                                            key={day.toISOString() + hour}
                                            className="p-1 border-r last:border-r-0 relative min-h-[70px] cursor-pointer hover:bg-blue-50/50 transition-colors"
                                            onClick={() => {
                                                if (slotSchedules.length === 0) {
                                                    onSlotClick(day, hour);
                                                }
                                            }}
                                        >
                                            <div className="absolute inset-0 opacity-0 hover:opacity-100 flex items-center justify-center pointer-events-none">
                                                {slotSchedules.length === 0 && (
                                                    <span className="text-xs text-blue-600 font-medium">+ Reservar</span>
                                                )}
                                            </div>

                                            <div className="absolute inset-1 flex flex-col gap-1 overflow-y-auto">
                                                {slotSchedules.map(schedule => (
                                                    <div
                                                        key={schedule.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onReservationClick(schedule);
                                                        }}
                                                        className="relative z-10 w-full p-2 flex flex-col items-start justify-start overflow-hidden text-xs shadow-sm rounded-md transition-shadow hover:shadow-md cursor-pointer border-l-4 bg-blue-50 border-blue-500 text-blue-900 border"
                                                        title={schedule.observation || undefined}
                                                    >
                                                        <span className="font-bold truncate w-full">{schedule.className || "Reserva Avulsa"}</span>
                                                        <span className="truncate text-xs opacity-80 w-full mt-0.5">{schedule.roomName}</span>
                                                        {schedule.observation && (
                                                            <span className="text-[11px] opacity-80 w-full mt-1 line-clamp-2">Obs: {schedule.observation}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
