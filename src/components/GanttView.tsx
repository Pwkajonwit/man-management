'use client';

import React, { useEffect, useRef, useState } from 'react';
import Gantt from 'frappe-gantt';
import './frappe-gantt.css';
import { Task } from '@/types/construction';
import { parseISO, format } from 'date-fns';

type TimestampLike = {
    toDate: () => Date;
};

const isTimestampLike = (value: unknown): value is TimestampLike => {
    return typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as TimestampLike).toDate === 'function';
};

const parseDate = (val: unknown): Date => {
    if (!val) return new Date();
    if (val instanceof Date) return val;
    if (isTimestampLike(val)) return val.toDate();
    if (typeof val === 'string') return parseISO(val);
    return new Date();
};

interface GanttViewProps {
    tasks: Task[];
}

export default function GanttView({ tasks }: GanttViewProps) {
    const ganttContainerRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<string>('Day');

    useEffect(() => {
        if (!ganttContainerRef.current || tasks.length === 0) return;

        // Convert domain tasks into frappe-gantt tasks format
        const formattedTasks = tasks.map(task => {
            const start = parseDate(task.planStartDate);
            const end = parseDate(task.planEndDate);

            // Ensure end date is not before start date (frappe-gantt crashes)
            const safeEnd = end < start ? start : end;

            return {
                id: task.id,
                name: task.name,
                start: format(start, 'yyyy-MM-dd'),
                end: format(safeEnd, 'yyyy-MM-dd'),
                progress: task.progress || 0,
                dependencies: task.predecessors?.join(',') || '',
                custom_class: `status-${task.status}`
            };
        });

        if (formattedTasks.length > 0) {
            ganttContainerRef.current.innerHTML = ''; // prevent duplication
            new Gantt(ganttContainerRef.current, formattedTasks, {
                view_mode: viewMode,
                view_modes: ['Quarter Day', 'Half Day', 'Day', 'Week', 'Month'],
                bar_height: 25,
                padding: 18,
                date_format: 'YYYY-MM-DD',
                on_click: (task: unknown) => console.log('Clicked', task),
            });
        }

    }, [tasks, viewMode]);

    return (
        <div className="flex flex-col h-full w-full bg-white relative">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-800 text-lg">Project Timeline</h3>
                <div className="flex bg-slate-100 p-1 rounded-md">
                    {['Day', 'Week', 'Month'].map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={`px-3 py-1 text-sm rounded ${viewMode === mode ? 'bg-white shadow text-indigo-600 font-medium' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            {mode}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 overflow-auto border border-slate-200 rounded-lg">
                {tasks.length > 0 ? (
                    <div ref={ganttContainerRef} className="frappe-gantt-container" style={{ minHeight: '400px' }}></div>
                ) : (
                    <div className="flex h-full items-center justify-center text-slate-500">
                        No timeline data to display
                    </div>
                )}
            </div>

            {/* CSS for custom status colors in Gantt */}
            <style dangerouslySetInnerHTML={{
                __html: `
            .frappe-gantt-container .bar-wrapper.status-completed .bar { fill: #10b981; }
            .frappe-gantt-container .bar-wrapper.status-completed .bar-progress { fill: #059669; }
            
            .frappe-gantt-container .bar-wrapper.status-in-progress .bar { fill: #fbbf24; }
            .frappe-gantt-container .bar-wrapper.status-in-progress .bar-progress { fill: #d97706; }
            
            .frappe-gantt-container .bar-wrapper.status-delayed .bar { fill: #f43f5e; }
            .frappe-gantt-container .bar-wrapper.status-delayed .bar-progress { fill: #e11d48; }

            .gantt .grid-header { fill: #f8fafc; }
            .gantt .tick line { stroke: #e2e8f0; }
            .gantt .tick text { fill: #64748b; font-size: 11px; }
            .gantt .pointer { cursor: pointer; }
        `}} />
        </div>
    );
}
