import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, onSnapshot, setDoc, deleteField
} from 'firebase/firestore';
import { db } from './firebase';
import { Project, Task, TeamMember, SubTask, Attachment, ActivityEntry, NotificationSettings, SystemUserAccount, ProjectDocument } from '@/types/construction';

function omitUndefinedFields(data: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) payload[key] = value;
    });
    return payload;
}

function withDeleteFieldForUndefined(data: Record<string, unknown>): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    Object.entries(data).forEach(([key, value]) => {
        payload[key] = value === undefined ? deleteField() : value;
    });
    return payload;
}

// ========== PROJECTS ==========

export async function getProjects(): Promise<Project[]> {
    const snapshot = await getDocs(collection(db, 'projects'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
}

export async function createProject(project: Omit<Project, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'projects'), project);
    return docRef.id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
    const payload = withDeleteFieldForUndefined({ ...data, updatedAt: new Date().toISOString() });
    await updateDoc(doc(db, 'projects', id), payload);
}

export async function deleteProject(id: string): Promise<void> {
    await deleteDoc(doc(db, 'projects', id));
}

export function subscribeProjects(callback: (projects: Project[]) => void) {
    return onSnapshot(collection(db, 'projects'), (snapshot) => {
        const projects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
        callback(projects);
    });
}

// ========== PROJECT DOCUMENTS ==========

export async function createProjectDocument(projectDocument: Omit<ProjectDocument, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'projectDocuments'), omitUndefinedFields(projectDocument as Record<string, unknown>));
    return docRef.id;
}

export async function deleteProjectDocumentDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'projectDocuments', id));
}

export function subscribeProjectDocumentsForProject(projectId: string, callback: (documents: ProjectDocument[]) => void) {
    const q = query(collection(db, 'projectDocuments'), where('projectId', '==', projectId));
    return onSnapshot(q, (snapshot) => {
        const documents = snapshot.docs
            .map(docItem => ({ ...docItem.data(), id: docItem.id } as ProjectDocument))
            .sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
        callback(documents);
    });
}

// ========== TASKS ==========

export async function getTasks(projectId?: string): Promise<Task[]> {
    let q;
    if (projectId) {
        q = query(collection(db, 'tasks'), where('projectId', '==', projectId));
    } else {
        q = collection(db, 'tasks');
    }
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
}

export async function createTask(task: Omit<Task, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'tasks'), task);
    return docRef.id;
}

export async function updateTask(id: string, data: Partial<Task>): Promise<void> {
    const payload: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    Object.entries(data).forEach(([key, value]) => {
        // Firestore rejects undefined. Use deleteField() so clearing optional values works.
        payload[key] = value === undefined ? deleteField() : value;
    });
    await updateDoc(doc(db, 'tasks', id), payload);
}

export async function deleteTaskDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'tasks', id));
}

export function subscribeTasks(callback: (tasks: Task[]) => void) {
    return onSnapshot(collection(db, 'tasks'), (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        callback(tasks);
    });
}

// ========== TEAM MEMBERS ==========

export async function getTeamMembers(): Promise<TeamMember[]> {
    const snapshot = await getDocs(collection(db, 'teamMembers'));
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TeamMember));
}

export async function createTeamMember(member: Omit<TeamMember, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'teamMembers'), omitUndefinedFields(member as Record<string, unknown>));
    return docRef.id;
}

export async function upsertTeamMember(id: string, member: Omit<TeamMember, 'id'>): Promise<void> {
    await setDoc(doc(db, 'teamMembers', id), omitUndefinedFields(member as Record<string, unknown>), { merge: true });
}

export async function updateTeamMember(id: string, data: Partial<TeamMember>): Promise<void> {
    const payload = withDeleteFieldForUndefined(data as Record<string, unknown>);
    if (Object.keys(payload).length === 0) return;
    await updateDoc(doc(db, 'teamMembers', id), payload);
}

export async function deleteTeamMember(id: string): Promise<void> {
    await deleteDoc(doc(db, 'teamMembers', id));
}

export function subscribeTeamMembers(callback: (members: TeamMember[]) => void) {
    return onSnapshot(collection(db, 'teamMembers'), (snapshot) => {
        const members = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TeamMember));
        callback(members);
    });
}

// ========== SYSTEM USERS (AUTH ACCOUNTS) ==========

export async function upsertSystemUserAccount(id: string, data: Partial<Omit<SystemUserAccount, 'id'>>): Promise<void> {
    const payload = omitUndefinedFields({
        ...data,
        updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
    await setDoc(doc(db, 'systemUsers', id), payload, { merge: true });
}

export async function deleteSystemUserAccount(id: string): Promise<void> {
    await deleteDoc(doc(db, 'systemUsers', id));
}

export function subscribeSystemUserAccounts(callback: (users: SystemUserAccount[]) => void) {
    return onSnapshot(collection(db, 'systemUsers'), (snapshot) => {
        const users = snapshot.docs
            .map((docItem) => ({ ...docItem.data(), id: docItem.id } as SystemUserAccount))
            .sort((a, b) => {
                const aTime = new Date(a.lastLoginAt || a.updatedAt || a.createdAt || 0).getTime();
                const bTime = new Date(b.lastLoginAt || b.updatedAt || b.createdAt || 0).getTime();
                return bTime - aTime;
            });
        callback(users);
    });
}

// ========== NOTIFICATION SETTINGS ==========

const NOTIFICATION_SETTINGS_DOC = doc(db, 'appConfig', 'notificationSettings');

export function subscribeNotificationSettings(callback: (settings: NotificationSettings | null) => void) {
    return onSnapshot(NOTIFICATION_SETTINGS_DOC, (snapshot) => {
        if (!snapshot.exists()) {
            callback(null);
            return;
        }

        const data = snapshot.data() as Partial<NotificationSettings>;
        callback({
            notifyTaskAssigned: data.notifyTaskAssigned ?? true,
            notifyTaskStatusChanged: data.notifyTaskStatusChanged ?? true,
            notifyTaskCommentAdded: data.notifyTaskCommentAdded ?? true,
            lineAdminUserId: (typeof data.lineAdminUserId === 'string' ? data.lineAdminUserId : '').trim(),
            lineReportType: data.lineReportType === 'today-team-load' || data.lineReportType === 'completed-last-2-days'
                ? data.lineReportType
                : 'project-summary',
            employeeReportEnabled: data.employeeReportEnabled ?? false,
            employeeReportFrequency: data.employeeReportFrequency === 'daily' ? 'daily' : 'weekly',
            employeeReportDayOfWeek: (() => {
                const day = data.employeeReportDayOfWeek;
                if (day === 'monday' || day === 'tuesday' || day === 'wednesday' || day === 'thursday' || day === 'friday' || day === 'saturday' || day === 'sunday') {
                    return day;
                }
                return 'monday';
            })(),
            employeeReportTime: typeof data.employeeReportTime === 'string' && /^\d{2}:\d{2}$/.test(data.employeeReportTime) ? data.employeeReportTime : '17:00',
            employeeReportScope: data.employeeReportScope === 'all-projects' ? 'all-projects' : 'active-project',
            employeeReportTemplate: data.employeeReportTemplate === 'compact' ? 'compact' : 'detailed',
            employeeReportIncludeOverdue: data.employeeReportIncludeOverdue ?? true,
            employeeReportIncludeDueSoon: data.employeeReportIncludeDueSoon ?? true,
            employeeReportIncludeCompleted: data.employeeReportIncludeCompleted ?? true,
            employeeReportIncludeNotStarted: data.employeeReportIncludeNotStarted ?? true,
            employeeReportIncludeInProgress: data.employeeReportIncludeInProgress ?? true,
            employeeReportIncludeTaskList: data.employeeReportIncludeTaskList ?? true,
            employeeReportMaxItems: Number.isFinite(data.employeeReportMaxItems) ? Math.min(Math.max(Number(data.employeeReportMaxItems), 1), 20) : 6,
            employeeReportDueSoonDays: Number.isFinite(data.employeeReportDueSoonDays) ? Math.min(Math.max(Number(data.employeeReportDueSoonDays), 1), 14) : 2,
            employeeReportTestMemberId: typeof data.employeeReportTestMemberId === 'string' ? data.employeeReportTestMemberId : '',
        });
    });
}

export async function upsertNotificationSettings(data: Partial<NotificationSettings>): Promise<void> {
    const payload = omitUndefinedFields({
        ...data,
        updatedAt: new Date().toISOString(),
    } as Record<string, unknown>);
    await setDoc(NOTIFICATION_SETTINGS_DOC, payload, { merge: true });
}

// ========== SUBTASKS ==========

export async function getSubTasks(taskId: string): Promise<SubTask[]> {
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
}

export async function createSubTask(subtask: Omit<SubTask, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'subtasks'), subtask);
    return docRef.id;
}

export async function updateSubTask(id: string, data: Partial<SubTask>): Promise<void> {
    await updateDoc(doc(db, 'subtasks', id), data);
}

export async function deleteSubTaskDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'subtasks', id));
}

export function subscribeSubTasks(callback: (subtasks: SubTask[]) => void) {
    return onSnapshot(collection(db, 'subtasks'), (snapshot) => {
        const subtasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
        callback(subtasks);
    });
}

// ========== ATTACHMENTS ==========

export async function createAttachment(attachment: Omit<Attachment, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'attachments'), omitUndefinedFields(attachment as Record<string, unknown>));
    return docRef.id;
}

export async function deleteAttachmentDoc(id: string): Promise<void> {
    await deleteDoc(doc(db, 'attachments', id));
}

export function subscribeAttachments(callback: (attachments: Attachment[]) => void) {
    return onSnapshot(collection(db, 'attachments'), (snapshot) => {
        const attachments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attachment));
        callback(attachments);
    });
}

// ========== ACTIVITY LOG ==========

export async function createActivityEntry(entry: Omit<ActivityEntry, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'activityLog'), omitUndefinedFields(entry as Record<string, unknown>));
    return docRef.id;
}

export function subscribeActivityLog(callback: (entries: ActivityEntry[]) => void) {
    return onSnapshot(collection(db, 'activityLog'), (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityEntry));
        callback(entries);
    });
}

// ========== TASK UPDATES (Comments) ==========

export interface TaskUpdateDoc {
    id: string;
    taskId: string;
    text: string;
    author: string;
    date: string;
}

export async function createTaskUpdate(update: Omit<TaskUpdateDoc, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'taskUpdates'), update);
    return docRef.id;
}

export function subscribeTaskUpdates(callback: (updates: TaskUpdateDoc[]) => void) {
    return onSnapshot(collection(db, 'taskUpdates'), (snapshot) => {
        const updates = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as TaskUpdateDoc));
        callback(updates);
    });
}

// ========== PER-TASK SUBSCRIPTIONS (optimized — only loads data for specific task) ==========

export function subscribeSubTasksForTask(taskId: string, callback: (subtasks: SubTask[]) => void) {
    const q = query(collection(db, 'subtasks'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const subtasks = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SubTask));
        callback(subtasks);
    });
}

export function subscribeAttachmentsForTask(taskId: string, callback: (attachments: Attachment[]) => void) {
    const q = query(collection(db, 'attachments'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const attachments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Attachment));
        callback(attachments);
    });
}

export function subscribeActivityLogForTask(taskId: string, callback: (entries: ActivityEntry[]) => void) {
    const q = query(collection(db, 'activityLog'), where('taskId', '==', taskId));
    return onSnapshot(q, (snapshot) => {
        const entries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ActivityEntry));
        callback(entries);
    });
}

