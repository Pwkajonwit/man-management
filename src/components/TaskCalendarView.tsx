'use client';

import React, { useMemo, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isAfter,
    isBefore,
    isSameDay,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Task } from '@/types/construction';

interface TaskCalendarViewProps {
    tasks: Task[];
    onOpenTask: (taskId: string) => void;
}

interface CalendarTaskRange {
    task: Task;
    startDate: Date;
    endDate: Date;
}

interface WeekBar {
    task: Task;
    startDate: Date;
    endDate: Date;
    startIndex: number;
    endIndex: number;
    lane: number;
    isRangeStart: boolean;
    isRangeEnd: boolean;
}

const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const maxVisibleLanes = 4;
const cellHeight = 132;
const laneTop = 40;
const laneHeight = 21;

const statusBarClassName: Record<Task['status'], string> = {
    'not-started': 'bg-[#8b95a7] hover:bg-[#727d90]',
    'in-progress': 'bg-[#f59e0b] hover:bg-[#d97706]',
    completed: 'bg-[#10b981] hover:bg-[#059669]',
    delayed: 'bg-[#e2445c] hover:bg-[#c9344b]',
};

const parseDateKey = (value?: string) => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
};

const getLaterDate = (a: Date, b: Date) => (isAfter(a, b) ? a : b);
const getEarlierDate = (a: Date, b: Date) => (isBefore(a, b) ? a : b);

export default function TaskCalendarView({ tasks, onOpenTask }: TaskCalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
    const [expandedWeeks, setExpandedWeeks] = useState<Record<number, boolean>>({});

    const calendarWeeks = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
        const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
        const weeks: Date[][] = [];

        for (let i = 0; i < days.length; i += 7) {
            weeks.push(days.slice(i, i + 7));
        }

        return weeks;
    }, [currentMonth]);

    const taskRanges = useMemo<CalendarTaskRange[]>(() => {
        return tasks
            .map((task) => {
                const startDate = parseDateKey(task.planStartDate);
                const endDate = parseDateKey(task.planEndDate);
                const fallbackDate = startDate || endDate;
                if (!fallbackDate) return null;

                const normalizedStart = startDate || fallbackDate;
                const normalizedEnd = endDate || fallbackDate;
                const rangeStart = getEarlierDate(normalizedStart, normalizedEnd);
                const rangeEnd = getLaterDate(normalizedStart, normalizedEnd);

                return {
                    task,
                    startDate: rangeStart,
                    endDate: rangeEnd,
                };
            })
            .filter((range): range is CalendarTaskRange => Boolean(range))
            .sort((a, b) => (
                a.startDate.getTime() - b.startDate.getTime()
                || a.endDate.getTime() - b.endDate.getTime()
                || a.task.name.localeCompare(b.task.name)
            ));
    }, [tasks]);

    const weekBars = useMemo(() => {
        return calendarWeeks.map((week) => {
            const weekStart = week[0];
            const weekEnd = week[6];
            const lanesEndIndex: number[] = [];
            const bars: WeekBar[] = [];

            taskRanges.forEach(({ task, startDate, endDate }) => {
                if (isAfter(startDate, weekEnd) || isBefore(endDate, weekStart)) return;

                const visibleStart = getLaterDate(startDate, weekStart);
                const visibleEnd = getEarlierDate(endDate, weekEnd);
                const startIndex = week.findIndex((day) => isSameDay(day, visibleStart));
                const endIndex = week.findIndex((day) => isSameDay(day, visibleEnd));
                if (startIndex < 0 || endIndex < 0) return;

                const lane = lanesEndIndex.findIndex((laneEndIndex) => laneEndIndex < startIndex);
                const nextLane = lane >= 0 ? lane : lanesEndIndex.length;
                lanesEndIndex[nextLane] = endIndex;

                bars.push({
                    task,
                    startDate,
                    endDate,
                    startIndex,
                    endIndex,
                    lane: nextLane,
                    isRangeStart: isSameDay(visibleStart, startDate),
                    isRangeEnd: isSameDay(visibleEnd, endDate),
                });
            });

            return {
                bars,
                laneCount: lanesEndIndex.length,
            };
        });
    }, [calendarWeeks, taskRanges]);

    return (
        <div className="h-full overflow-hidden rounded-xl border border-[#d0d4e4] bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6e9ef] px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#323338]">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-[#0073ea]" />
                        <h3 className="text-[15px] font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-[#64748b]">
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-5 rounded-full bg-[#f59e0b]" />
                            กำลังดำเนินการ
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-5 rounded-full bg-[#10b981]" />
                            เสร็จสิ้น
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="h-2 w-5 rounded-full bg-[#e2445c]" />
                            ติดขัด
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                        className="h-8 w-8 rounded-md border border-[#d0d4e4] text-[#676879] hover:bg-[#f5f6f8]"
                        title="Previous month"
                    >
                        <ChevronLeft className="mx-auto h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMonth(startOfMonth(new Date()))}
                        className="h-8 rounded-md border border-[#d0d4e4] px-2.5 text-[12px] text-[#323338] hover:bg-[#f5f6f8]"
                    >
                        Today
                    </button>
                    <button
                        type="button"
                        onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                        className="h-8 w-8 rounded-md border border-[#d0d4e4] text-[#676879] hover:bg-[#f5f6f8]"
                        title="Next month"
                    >
                        <ChevronRight className="mx-auto h-4 w-4" />
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <div className="min-w-[780px]">
                    <div className="grid grid-cols-7 border-b border-[#e6e9ef] bg-[#f9fafb]">
                        {weekdayLabels.map((label) => (
                            <div
                                key={label}
                                className="border-r border-[#eef1f6] px-3 py-2 text-[12px] font-semibold text-[#676879] last:border-r-0"
                            >
                                {label}
                            </div>
                        ))}
                    </div>

                    <div>
                        {calendarWeeks.map((week, weekIndex) => {
                            const { bars, laneCount } = weekBars[weekIndex];
                            const isExpanded = Boolean(expandedWeeks[weekIndex]);
                            const visibleLaneLimit = isExpanded ? Math.max(laneCount, maxVisibleLanes) : maxVisibleLanes;
                            const hiddenCount = bars.filter((bar) => bar.lane >= visibleLaneLimit).length;
                            const rowHeight = Math.max(
                                cellHeight,
                                laneTop + (Math.min(laneCount, visibleLaneLimit) * laneHeight) + 34
                            );

                            return (
                                <div
                                    key={week[0].toISOString()}
                                    className="relative border-b border-[#eef1f6] last:border-b-0"
                                    style={{ height: rowHeight }}
                                >
                                    <div className="grid h-full grid-cols-7">
                                        {week.map((day) => {
                                            const isToday = isSameDay(day, new Date());
                                            const isInMonth = isSameMonth(day, currentMonth);

                                            return (
                                                <div
                                                    key={day.toISOString()}
                                                    className={`border-r border-[#eef1f6] px-2 py-1.5 last:border-r-0 ${isInMonth ? 'bg-white' : 'bg-[#fbfcfd]'}`}
                                                >
                                                    <span
                                                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                                                            isToday
                                                                ? 'bg-[#0073ea] font-semibold text-white'
                                                                : isInMonth
                                                                    ? 'text-[#323338]'
                                                                    : 'text-[#a0a2b1]'
                                                        }`}
                                                    >
                                                        {format(day, 'd')}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="pointer-events-none absolute inset-0">
                                        {bars
                                            .filter((bar) => bar.lane < visibleLaneLimit)
                                            .map((bar) => {
                                                const leftPercent = (bar.startIndex / 7) * 100;
                                                const widthPercent = ((bar.endIndex - bar.startIndex + 1) / 7) * 100;
                                                const top = laneTop + (bar.lane * laneHeight);
                                                const roundedClassName = bar.isRangeStart && bar.isRangeEnd
                                                    ? 'rounded-full'
                                                    : bar.isRangeStart
                                                        ? 'rounded-l-full rounded-r-sm'
                                                        : bar.isRangeEnd
                                                            ? 'rounded-l-sm rounded-r-full'
                                                            : 'rounded-sm';

                                                return (
                                                    <button
                                                        key={`${bar.task.id}-${weekIndex}-${bar.startIndex}-${bar.endIndex}`}
                                                        type="button"
                                                        onClick={() => onOpenTask(bar.task.id)}
                                                        className={`pointer-events-auto absolute h-[17px] px-2 text-left text-[10px] font-semibold leading-[17px] text-white shadow-sm transition-colors ${statusBarClassName[bar.task.status]} ${roundedClassName}`}
                                                        style={{
                                                            left: `calc(${leftPercent}% + 6px)`,
                                                            width: `calc(${widthPercent}% - 12px)`,
                                                            top,
                                                        }}
                                                        title={`${bar.task.name} | ${format(bar.startDate, 'dd/MM/yyyy')} - ${format(bar.endDate, 'dd/MM/yyyy')}`}
                                                    >
                                                        <span className="block truncate">
                                                            {bar.isRangeStart ? bar.task.name : ''}
                                                        </span>
                                                    </button>
                                                );
                                            })}

                                        {hiddenCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setExpandedWeeks((prev) => ({
                                                        ...prev,
                                                        [weekIndex]: true,
                                                    }));
                                                }}
                                                className="pointer-events-auto absolute bottom-2 left-2 rounded bg-white/95 px-2 py-0.5 text-[11px] font-medium text-[#2563eb] shadow-sm ring-1 ring-[#bfdbfe] transition-colors hover:bg-[#eff6ff]"
                                            >
                                                +{hiddenCount} เพิ่มเติม
                                            </button>
                                        )}

                                        {isExpanded && laneCount > maxVisibleLanes && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setExpandedWeeks((prev) => ({
                                                        ...prev,
                                                        [weekIndex]: false,
                                                    }));
                                                }}
                                                className="pointer-events-auto absolute bottom-2 right-2 rounded bg-white/95 px-2 py-0.5 text-[11px] font-medium text-[#64748b] shadow-sm ring-1 ring-[#e2e8f0] transition-colors hover:bg-[#f8fafc]"
                                            >
                                                ย่อ
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
