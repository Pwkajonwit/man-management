declare module 'frappe-gantt' {
    export type GanttTaskInput = Record<string, unknown>;

    export interface GanttOptions {
        [key: string]: unknown;
        on_click?: (task: unknown) => void;
    }

    export default class Gantt {
        constructor(element: string | HTMLElement, tasks: GanttTaskInput[], options?: GanttOptions);
        change_view_mode(mode: string): void;
        refresh(tasks: GanttTaskInput[]): void;
    }
}
