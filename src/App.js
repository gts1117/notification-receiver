import React, { useState, useEffect, useRef } from 'react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, getDocs, writeBatch } from 'firebase/firestore';

// Icon Imports
import { Copy, Trash2, Server, Code, Terminal, Sparkles, X, BrainCircuit, FileText, PanelRightClose, PanelRightOpen, Printer } from 'lucide-react';

// --- Firebase Configuration ---
// IMPORTANT: Replace this with the configuration object from your Firebase project.
// Go to your Firebase Console -> Project Settings -> General -> Your apps -> Firebase SDK snippet -> Config
const firebaseConfig = {
    apiKey: "AIzaSyA3BaMo5wUDAnN-R24J1cBMQwO7kolXHnY",
    authDomain: "notification-receiver-g1.firebaseapp.com",
    projectId: "notification-receiver-g1",
    storageBucket: "notification-receiver-g1.firebasestorage.app",
    messagingSenderId: "442112140332",
    appId: "1:442112140332:web:2c3ae34d6cbf23df191d89"
};

// This is part of the path where your data is stored.
// It can be any string, but it's good practice to use your app's name.
const appId = 'notification-receiver';

// --- Gemini API Helper ---
async function callGemini(prompt) {
    // IMPORTANT: For local development, you need to get a Gemini API key.
    // 1. Visit https://aistudio.google.com/app/apikey
    // 2. Create an API key.
    // 3. Paste it here.
    const apiKey = "AIzaSyAJS54hEXUVqHJZM8cuAJtXPGq4jyApsac";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    if (apiKey === "PASTE_YOUR_GEMINI_API_KEY_HERE") {
        return "Error: Please add your Gemini API key to the `callGemini` function in `App.js` to enable AI features.";
    }

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`API Error: ${response.status} - ${errorBody.error.message}`);
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0) {
            return result.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Failed to parse the response from the AI model.");
        }
    } catch (error) {
        console.error("Gemini API call failed:", error);
        throw error;
    }
}


// --- Main App Component ---
export default function App() {
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState('');
    const [modalTitle, setModalTitle] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const notificationsEndRef = useRef(null);

    // Effect for Firebase Initialization and Authentication
    useEffect(() => {
        try {
            // Check if firebaseConfig is filled out
            if (firebaseConfig.apiKey.startsWith("PASTE_YOUR")) {
                setError("Firebase is not configured. Please add your Firebase project configuration to App.js.");
                setIsLoading(false);
                return;
            }
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        await signInAnonymously(authInstance);
                    } catch (authError) {
                        console.error("Anonymous Sign-In Error:", authError);
                        setError("Failed to authenticate anonymously. Check your Firebase Authentication settings to ensure Anonymous sign-in is enabled.");
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Firebase Init Error:", e);
            setError("Could not initialize Firebase. Please check your configuration object in App.js.");
            setIsLoading(false);
        }
    }, []);

    // Effect for fetching notifications in real-time
    useEffect(() => {
        if (!isAuthReady || !db || !userId) return;

        setIsLoading(true);
        const collectionPath = `/artifacts/${appId}/users/${userId}/notifications`;
        const q = query(collection(db, collectionPath));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const notifs = [];
            querySnapshot.forEach((doc) => {
                notifs.push({ id: doc.id, ...doc.data() });
            });
            notifs.sort((a, b) => {
                const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(0);
                const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(0);
                return timeB - timeA;
            });
            setNotifications(notifs);
            setIsLoading(false);
        }, (err) => {
            console.error("Snapshot Error:", err);
            setError("Failed to listen for notifications. Check your Firestore security rules.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, db, userId]);

    useEffect(() => {
        notificationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [notifications]);

    const handleClearNotifications = async () => {
        if (!db || !userId) return;
        if (window.confirm("Are you sure you want to delete all notifications? This cannot be undone.")) {
            const collectionPath = `/artifacts/${appId}/users/${userId}/notifications`;
            const collectionRef = collection(db, collectionPath);
            try {
                const querySnapshot = await getDocs(collectionRef);
                if (querySnapshot.empty) return;
                const batch = writeBatch(db);
                querySnapshot.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
            } catch (err) {
                console.error("Error clearing notifications:", err);
                setError("Could not clear notifications.");
            }
        }
    };

    const handleAnalyzeNotification = async (notification) => {
        setModalTitle(`✨ AI Analysis for notification from "${notification.source || 'Unknown'}"`);
        setIsModalOpen(true);
        setIsAnalyzing(true);

        const prompt = `A notification was received with the following JSON data: ${JSON.stringify(notification, null, 2)}. As an expert systems analyst, please provide a brief analysis. In your analysis:
1.  Explain what this data likely means in plain English.
2.  Suggest the potential significance or urgency (e.g., is it a critical error, a routine log, a security alert?).
3.  Recommend a concrete next step for the user to take.
Format your response clearly using Markdown.`;

        try {
            const analysis = await callGemini(prompt);
            setModalContent(analysis);
        } catch (e) {
            setModalContent(`Sorry, the AI analysis failed. The error was: ${e.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSummarizeAll = async () => {
        if (notifications.length === 0) return;
        setModalTitle("✨ AI Summary of All Notifications");
        setIsModalOpen(true);
        setIsAnalyzing(true);

        const notificationsJson = JSON.stringify(notifications.slice(0, 50), null, 2);
        const prompt = `Here are the latest ${notifications.length} notifications received by a system, in JSON format: ${notificationsJson}.
As an expert systems analyst, please provide a high-level summary of these events. In your summary:
1.  Identify any recurring patterns, critical errors, or notable trends.
2.  Highlight the most important or urgent notifications that require attention.
3.  Provide a concluding thought on the overall system health based on this data.
Format your response clearly using Markdown.`;

        try {
            const summary = await callGemini(prompt);
            setModalContent(summary);
        } catch (e) {
            setModalContent(`Sorry, the AI summary failed. The error was: ${e.message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="bg-gray-900 text-gray-100 min-h-screen font-sans flex flex-col lg:flex-row">
            <main className="flex-1 p-4 sm:p-6 lg:p-8 flex flex-col max-h-screen">
                <header className="flex-shrink-0 flex flex-wrap gap-4 justify-between items-center pb-4 border-b border-gray-700">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white">Notification Receiver</h1>
                        <p className="text-sm text-gray-400 mt-1">Listening for data sent to your unique endpoint.</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSummarizeAll} disabled={notifications.length === 0 || isAnalyzing} className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg shadow-md transition-all duration-200">
                            <FileText size={16} className="mr-2" />
                            ✨ Summarize
                        </button>
                        <button onClick={handleClearNotifications} disabled={notifications.length === 0} className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg shadow-md transition-all duration-200">
                            <Trash2 size={16} className="mr-2" />
                            Clear All
                        </button>
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors">
                            {isSidebarOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
                        </button>
                    </div>
                </header>

                <div className="flex-grow bg-gray-800 rounded-lg mt-6 shadow-inner overflow-y-auto p-4">
                    {isLoading && <div className="text-center p-10">Loading...</div>}
                    {error && <div className="text-center p-10 text-red-400">{error}</div>}
                    {!isLoading && !error && notifications.length === 0 && (
                        <div className="text-center p-10 text-gray-400">
                            <Server size={48} className="mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">Awaiting Notifications</h3>
                            <p>Send data to this receiver using the instructions on the right.</p>
                        </div>
                    )}

                    {!isLoading && !error && notifications.length > 0 && (
                        <div className="space-y-4">
                            {notifications.map(n => (
                                <NotificationCard key={n.id} notification={n} onAnalyze={handleAnalyzeNotification} />
                            ))}
                            <div ref={notificationsEndRef} />
                        </div>
                    )}
                </div>
            </main>

            <aside className={`bg-gray-900/50 border-t lg:border-t-0 lg:border-l border-gray-700 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-full p-4 sm:p-6 lg:w-1/3 xl:w-1/4' : 'w-0 p-0'}`}>
                <div className="sticky top-6 min-w-[300px]">
                    <SidebarContent userId={userId} />
                </div>
            </aside>

            <AnalysisModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={modalTitle} content={modalContent} isLoading={isAnalyzing} />
        </div>
    );
}

function SidebarContent({ userId }) {
    const copyToClipboard = (text) => navigator.clipboard.writeText(text);

    const instructionSections = [
        {
            id: 'userid',
            title: 'Your Unique User ID',
            isCode: false,
            icon: <Server size={18} className="text-purple-400"/>,
            content: userId || "Loading...",
            copyText: userId || ""
        },
        {
            id: 'path',
            title: 'Firestore Path',
            isCode: false,
            icon: <Server size={18} className="text-purple-400"/>,
            content: `/artifacts/${appId}/users/${userId || 'YOUR_USER_ID'}/notifications`,
            copyText: `/artifacts/${appId}/users/${userId || 'YOUR_USER_ID'}/notifications`
        },
        {
            id: 'nodejs',
            title: 'Example: Node.js (firebase-admin)',
            isCode: true,
            icon: <Code size={18} className="text-orange-400"/>,
            content: `// You need: npm install firebase-admin\nimport { initializeApp, cert } from 'firebase-admin/app';\nimport { getFirestore } from 'firebase-admin/firestore';\n\n// Get key from Firebase Console > Project Settings > Service accounts\nconst serviceAccount = require('./serviceAccountKey.json');\n\ninitializeApp({ credential: cert(serviceAccount) });\nconst db = getFirestore();\n\nasync function sendNotification(userId, data) {\n  const path = \`/artifacts/${appId}/users/\${userId}/notifications\`;\n  const ref = await db.collection(path).add({\n    ...data,\n    timestamp: new Date()\n  });\n  console.log('Sent with ID:', ref.id);\n}\n\nsendNotification('${userId || 'YOUR_USER_ID'}', { \n  source: 'My Node App',\n  status: 'online',\n  value: Math.random()\n});`
        },
        {
            id: 'print_petition',
            title: "Example: Paige's Print Petition",
            isCode: true,
            icon: <Printer size={18} className="text-pink-400"/>,
            content: `// In your Node.js sender script:\nsendNotification('${userId || 'YOUR_USER_ID'}', { \n  source: "Paige's Print Petitions",\n  fileName: "Dragon_Statue_v2.stl",\n  url: "https://files.prusa3d.com/wp-content/uploads/2022/11/Dragon_Statue_0.2mm_PLA_MK4_11h39m.gcode",\n  requestedBy: "Paige"\n});`
        }
    ];

    return (
        <>
            <h2 className="text-xl font-semibold mb-4 text-cyan-300">How to Send Data</h2>
            <div className="space-y-4">
                {instructionSections.map(section => (
                    <InstructionPanel 
                        key={section.id}
                        title={section.title}
                        icon={section.icon}
                        content={section.content}
                        isCode={section.isCode}
                        copyText={section.copyText || section.content}
                    />
                ))}
            </div>
        </>
    );
}

function NotificationCard({ notification, onAnalyze }) {
    const { source, timestamp, id, url, ...data } = notification;
    const formattedTime = timestamp?.toDate ? timestamp.toDate().toLocaleString() : 'No timestamp';
    const isPrintPetition = source === "Paige's Print Petitions";

    const cardBorderColor = isPrintPetition ? 'hover:border-pink-500' : 'hover:border-cyan-500';
    const headerColor = isPrintPetition ? 'text-pink-400' : 'text-cyan-400';

    return (
        <div className={`bg-gray-800/50 rounded-lg p-4 border border-gray-700 ${cardBorderColor} transition-colors duration-300 animate-fade-in`}>
            <div className="flex justify-between items-start mb-2 gap-4">
                <span className={`font-bold ${headerColor} break-all`}>{source || 'Unknown Source'}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formattedTime}</span>
            </div>
            <pre className="bg-gray-900/70 p-3 rounded text-sm text-gray-300 whitespace-pre-wrap break-words">
                {JSON.stringify(data, null, 2)}
            </pre>
            <div className="mt-3 flex justify-end items-center gap-2">
                {isPrintPetition && url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg shadow-sm transition-colors">
                        <Printer size={14} className="mr-2" />
                        Open Print File
                    </a>
                )}
                <button 
                    onClick={() => onAnalyze(notification)}
                    className="inline-flex items-center px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                    <Sparkles size={14} className="mr-2" />
                    Analyze
                </button>
            </div>
        </div>
    );
}

function AnalysisModal({ isOpen, onClose, title, content, isLoading }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-700">
                <header className="flex items-center justify-between p-4 border-b border-gray-700">
                    <h2 className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
                        {isLoading ? <BrainCircuit className="animate-pulse" /> : <BrainCircuit />}
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </header>
                <div className="p-6 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center text-gray-400">
                            <Sparkles size={48} className="animate-spin text-cyan-400" />
                            <p className="mt-4">AI is analyzing the data...</p>
                        </div>
                    ) : (
                        <div className="prose prose-invert prose-sm md:prose-base max-w-none" dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }}></div>
                    )}
                </div>
                <footer className="p-4 border-t border-gray-700 text-right">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors">Close</button>
                </footer>
            </div>
        </div>
    );
}

function InstructionPanel({ title, icon, content, isCode = false, copyText }) {
    const copyToClipboard = (text) => navigator.clipboard.writeText(text);
    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700">
            <header className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className="font-semibold text-sm">{title}</h3>
                </div>
                <button onClick={() => copyToClipboard(copyText || content)} className="p-1 text-gray-400 hover:text-white transition-colors"><Copy size={14} /></button>
            </header>
            <div className="p-3">
                {isCode ? (<pre className="text-xs text-gray-300 whitespace-pre-wrap break-words"><code>{content}</code></pre>)
                    : (<p className="text-xs text-gray-300 font-mono break-all">{content}</p>)}
            </div>
        </div>
    );
}

const style = document.createElement('style');
style.textContent = `
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
.animate-fade-in-fast { animation: fade-in-fast 0.2s ease-out forwards; }
.prose h1, .prose h2, .prose h3 { font-weight: 600; margin-bottom: 0.5em; margin-top: 1em; }
.prose strong { color: #a5f3fc; }
.prose code { background-color: #1f2937; padding: 0.2em 0.4em; margin: 0; font-size: 85%; border-radius: 3px; }
.prose ul { list-style-type: disc; padding-left: 1.5em; }
`;
document.head.appendChild(style);

