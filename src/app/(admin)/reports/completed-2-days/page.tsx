'use client';

import React, { useMemo } from 'react';
import { addDays, format } from 'date-fns';
import { ArrowLeft, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Task } from '@/types/construction';
import { useAppContext } from '@/contexts/AppContext';
import { getTaskOwnerNames as resolveTaskOwnerNames } from '@/utils/taskOwnerUtils';

type ReportRow = {
  id: string;
  category: string;
  name: string;
  ownerLabel: string;
  crewLabel: string;
  completedAt: string;
};

const toLocalDateKey = (isoValue?: string) => {
  if (!isoValue) return '';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
};

const toLocalTimeLabel = (isoValue?: string) => {
  if (!isoValue) return '-';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'HH:mm');
};

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="border border-[#d0d4e4] rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-[#f5f6f8] border-b border-[#e6e9ef]">
        <h2 className="text-[14px] font-semibold text-[#323338]">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-[#676879]">No completed tasks</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead className="bg-white">
              <tr className="border-b border-[#e6e9ef]">
                <th className="px-3 py-2 text-left font-semibold text-[#676879] w-[56px]">No.</th>
                <th className="px-3 py-2 text-left font-semibold text-[#676879] w-[170px]">Category</th>
                <th className="px-3 py-2 text-left font-semibold text-[#676879]">Task</th>
                <th className="px-3 py-2 text-left font-semibold text-[#676879] w-[170px]">Owner</th>
                <th className="px-3 py-2 text-left font-semibold text-[#676879] w-[170px]">Crew</th>
                <th className="px-3 py-2 text-left font-semibold text-[#676879] w-[110px]">Done Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-[#f0f1f4] last:border-b-0">
                  <td className="px-3 py-2 text-[#676879]">{index + 1}</td>
                  <td className="px-3 py-2 text-[#676879] break-words">{row.category}</td>
                  <td className="px-3 py-2 text-[#323338] break-words">{row.name}</td>
                  <td className="px-3 py-2 text-[#676879] break-words">{row.ownerLabel}</td>
                  <td className="px-3 py-2 text-[#676879] break-words">{row.crewLabel}</td>
                  <td className="px-3 py-2 text-[#323338]">{row.completedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function CompletedTwoDayReportPage() {
  const router = useRouter();
  const { projects, tasks, teamMembers, activeProjectId } = useAppContext();

  const activeProject = projects.find((project) => project.id === activeProjectId);
  const projectTasks = tasks.filter((task) => task.projectId === activeProjectId);

  const report = useMemo(() => {
    const today = new Date();
    const todayKey = format(today, 'yyyy-MM-dd');
    const yesterdayDate = addDays(today, -1);
    const yesterdayKey = format(yesterdayDate, 'yyyy-MM-dd');
    const memberTypeByName = new Map<string, 'team' | 'crew'>(
      teamMembers.map((member) => [member.name, member.memberType === 'crew' ? 'crew' : 'team'])
    );

    const completedTasks = projectTasks.filter((task) => task.status === 'completed');
    const sortedByUpdatedAt = (items: Task[]) =>
      [...items].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const mapRows = (items: Task[]): ReportRow[] =>
      sortedByUpdatedAt(items).map((task) => {
        const assignedNames = resolveTaskOwnerNames(task, teamMembers);
        const ownerNames = assignedNames.filter((name) => memberTypeByName.get(name) !== 'crew');
        const crewNames = assignedNames.filter((name) => memberTypeByName.get(name) === 'crew');
        return {
          id: task.id,
          category: task.category || 'No Category',
          name: task.name,
          ownerLabel: ownerNames.length > 0 ? ownerNames.join(', ') : 'Unassigned',
          crewLabel: crewNames.length > 0 ? crewNames.join(', ') : '-',
          completedAt: toLocalTimeLabel(task.updatedAt),
        };
      });

    const todayRows = mapRows(
      completedTasks.filter((task) => toLocalDateKey(task.updatedAt) === todayKey)
    );
    const yesterdayRows = mapRows(
      completedTasks.filter((task) => toLocalDateKey(task.updatedAt) === yesterdayKey)
    );

    return {
      generatedAt: format(today, 'dd/MM/yyyy HH:mm'),
      todayDateLabel: format(today, 'dd/MM/yyyy'),
      yesterdayDateLabel: format(yesterdayDate, 'dd/MM/yyyy'),
      todayRows,
      yesterdayRows,
      todayDoneCount: todayRows.length,
      yesterdayDoneCount: yesterdayRows.length,
      twoDayDoneCount: todayRows.length + yesterdayRows.length,
      totalCompletedCount: completedTasks.length,
    };
  }, [projectTasks, teamMembers]);

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 sm:p-6 lg:p-8">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .report-paper {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          body {
            background: #ffffff !important;
          }
        }
      `}</style>

      <div className="max-w-[1100px] mx-auto space-y-4">
        <div className="no-print flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg border border-[#d0d4e4] bg-white text-[#323338] hover:bg-[#f5f6f8]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-[#0073ea] text-white hover:bg-[#0060c0]"
          >
            <Printer className="w-4 h-4" />
            Print / Save PDF
          </button>
        </div>

        <article className="print-area report-paper bg-white border border-[#d0d4e4] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-5">
          <header className="border-b border-[#e6e9ef] pb-4">
            <h1 className="text-[20px] sm:text-[22px] font-black text-[#323338]">2-Day Completion Report</h1>
            <div className="mt-1 text-[13px] text-[#676879]">
              Project: <span className="font-semibold text-[#323338]">{activeProject?.name || 'No Project Selected'}</span>
            </div>
            <div className="mt-1 text-[12px] text-[#676879]">Generated: {report.generatedAt}</div>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-[#d0d4e4] rounded-lg px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[#676879] font-semibold">Today</div>
              <div className="mt-1 text-[22px] font-black text-[#323338]">{report.todayDoneCount}</div>
              <div className="text-[11px] text-[#676879]">{report.todayDateLabel}</div>
            </div>
            <div className="border border-[#d0d4e4] rounded-lg px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[#676879] font-semibold">Yesterday</div>
              <div className="mt-1 text-[22px] font-black text-[#323338]">{report.yesterdayDoneCount}</div>
              <div className="text-[11px] text-[#676879]">{report.yesterdayDateLabel}</div>
            </div>
            <div className="border border-[#d0d4e4] rounded-lg px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[#676879] font-semibold">2-Day Total</div>
              <div className="mt-1 text-[22px] font-black text-[#0073ea]">{report.twoDayDoneCount}</div>
              <div className="text-[11px] text-[#676879]">Today + Yesterday</div>
            </div>
            <div className="border border-[#d0d4e4] rounded-lg px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-wider text-[#676879] font-semibold">All Completed</div>
              <div className="mt-1 text-[22px] font-black text-[#00a650]">{report.totalCompletedCount}</div>
              <div className="text-[11px] text-[#676879]">Current project</div>
            </div>
          </section>

          <ReportTable
            title={`Today (${report.todayDateLabel}) - ${report.todayDoneCount} task(s)`}
            rows={report.todayRows}
          />
          <ReportTable
            title={`Yesterday (${report.yesterdayDateLabel}) - ${report.yesterdayDoneCount} task(s)`}
            rows={report.yesterdayRows}
          />
        </article>
      </div>
    </div>
  );
}
