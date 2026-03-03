const admin = require('firebase-admin');
const { parseISO, subDays, addDays, format } = require('date-fns');

// Initialize Firebase Admin (Using application default credentials or explicitly initialize if needed. In development local emulator/env, it might work without strict certs, but if it fails we will need a service account JSON. However, let's try assuming the user might be authenticated or we can use the web SDK but disable auth checks if possible, wait, admin SDK requires service account).

require('dotenv').config({ path: '../.env.local' });

// Workaround for DB seeding: Since we're using the standard frontend DB without rules issues from client-side SDK normally, wait, the client SDK threw INVALID_ARGUMENT above. This often happens if the projectId in config doesn't perfectly match what Firestore expects, or the API key had bad characters. Let's check config.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Instead of Admin SDK which needs service account JSON, let's just make sure the config strings don't have carriage returns!
for (const key in firebaseConfig) {
    if (firebaseConfig[key]) firebaseConfig[key] = firebaseConfig[key].trim();
}

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, doc, deleteDoc } = require('firebase/firestore');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedData() {
    console.log("Starting DB seeding...");
    console.log("Using Project ID:", firebaseConfig.projectId);

    try {
        // 1. Check if demo project exists, if so, delete it and its tasks
        const projectsSnapshot = await getDocs(collection(db, 'projects'));
        let demoProjectId = null;

        for (const projectDoc of projectsSnapshot.docs) {
            if (projectDoc.data().name === "Monday.com Style Demo") {
                console.log(`Found existing demo project: ${projectDoc.id}. Deleting it and its tasks...`);
                demoProjectId = projectDoc.id;

                // Delete tasks
                const tasksSnapshot = await getDocs(collection(db, 'tasks'));
                for (const taskDoc of tasksSnapshot.docs) {
                    if (taskDoc.data().projectId === demoProjectId) {
                        await deleteDoc(doc(db, 'tasks', taskDoc.id));
                    }
                }

                // Delete project
                await deleteDoc(doc(db, 'projects', demoProjectId));
                console.log("Deleted old demo data.");
            }
        }

        // 2. Create new Project
        const now = new Date();
        const projectData = {
            name: "Monday.com Style Demo",
            description: "A demonstration project mapping to monday.com board view",
            owner: "System Admin",
            status: "in-progress",
            startDate: format(subDays(now, 10), "yyyy-MM-dd"),
            endDate: format(addDays(now, 50), "yyyy-MM-dd"),
            overallProgress: 35,
            createdAt: now,
            updatedAt: now
        };

        const projectRef = await addDoc(collection(db, 'projects'), projectData);
        const projectId = projectRef.id;
        console.log(`Created new Project ID: ${projectId}`);

        // 3. Create Tasks
        const tasks = [
            // Planning Group
            {
                projectId,
                name: "Define MVP scope",
                category: "Planning",
                responsible: "Alex M.",
                planStartDate: format(subDays(now, 10), "yyyy-MM-dd"),
                planEndDate: format(subDays(now, 5), "yyyy-MM-dd"),
                planDuration: 5,
                progress: 100,
                status: "completed",
                order: 1
            },
            {
                projectId,
                name: "Design Database Schema",
                category: "Planning",
                responsible: "Sarah T.",
                planStartDate: format(subDays(now, 4), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 2), "yyyy-MM-dd"),
                planDuration: 6,
                progress: 60,
                status: "in-progress",
                order: 2
            },
            {
                projectId,
                name: "Finalize UI Mockups",
                category: "Planning",
                responsible: "Chris P.",
                planStartDate: format(now, "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 7), "yyyy-MM-dd"),
                planDuration: 7,
                progress: 10,
                status: "in-progress",
                order: 3
            },

            // Development Group
            {
                projectId,
                name: "Setup Next.js environment",
                category: "Development",
                responsible: "Alex M.",
                planStartDate: format(subDays(now, 2), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 1), "yyyy-MM-dd"),
                planDuration: 3,
                progress: 80,
                status: "in-progress",
                order: 4
            },
            {
                projectId,
                name: "Implement Auth Flow",
                category: "Development",
                responsible: "Mike D.",
                planStartDate: format(addDays(now, 2), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 10), "yyyy-MM-dd"),
                planDuration: 8,
                progress: 0,
                status: "not-started",
                order: 5
            },
            {
                projectId,
                name: "Build Dashboard Core",
                category: "Development",
                responsible: "Anna K.",
                planStartDate: format(addDays(now, 8), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 25), "yyyy-MM-dd"),
                planDuration: 17,
                progress: 0,
                status: "not-started",
                order: 6
            },

            // Review Group
            {
                projectId,
                name: "Security Audit",
                category: "Review",
                responsible: "John H.",
                planStartDate: format(addDays(now, 26), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 30), "yyyy-MM-dd"),
                planDuration: 4,
                progress: 0,
                status: "not-started",
                order: 7
            },
            {
                projectId,
                name: "UAT Testing",
                category: "Review",
                responsible: "Customer",
                planStartDate: format(addDays(now, 31), "yyyy-MM-dd"),
                planEndDate: format(addDays(now, 45), "yyyy-MM-dd"),
                planDuration: 14,
                progress: 0,
                status: "not-started",
                order: 8
            }
        ];

        for (const task of tasks) {
            await addDoc(collection(db, 'tasks'), {
                ...task,
                createdAt: now,
                updatedAt: now
            });
            console.log(`Added task: ${task.name}`);
        }

        console.log("Seeding complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error seeding data:", error);
        process.exit(1);
    }
}

seedData();
