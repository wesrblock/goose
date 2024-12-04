import React, { useEffect, useState } from "react"

export default function SessionPills() {
    const [sessions, setSessions] = useState([]);
    const [latestSessions, setLatestSessions] = useState([]);

    const workingDir = window.appConfig.get("GOOSE_WORKING_DIR");
    
    useEffect(() => {
        async function loadSessions() {
            window.electron.logInfo(`_------______________ Looking for sessions related to ${workingDir}`);
            const sessions = await window.electron.listSessions(workingDir);
      
            window.electron.logInfo(`_------______________ Found ${sessions.length} sessions in ${workingDir}`);
            window.electron.logInfo(`Sessions: ${JSON.stringify(sessions)}`);
            setSessions(sessions);
        };
        loadSessions();
    }, []);

    useEffect(() => {
        async function loadSessions() {                        
            const sessions = await window.electron.listSessions();                              
            setLatestSessions(sessions);
        };
        loadSessions();
    }, []);    

    if (sessions.length === 0 && latestSessions.length === 0) {
        return null;
    }

    // Create a combined list of sessions, prioritizing latest ones and removing duplicates
    const combinedSessions = [];
    const seenNames = new Set();

    // Add at least one latest session if available
    if (latestSessions.length > 0) {
        const latest = latestSessions[0];
        combinedSessions.push({ ...latest, isLatest: true });
        seenNames.add(latest.name);
    }

    // Add remaining latest sessions (up to 5 total)
    for (let i = 1; i < latestSessions.length && combinedSessions.length < 5; i++) {
        const session = latestSessions[i];
        if (!seenNames.has(session.name)) {
            combinedSessions.push({ ...session, isLatest: true });
            seenNames.add(session.name);
        }
    }

    // Fill remaining slots with regular sessions (up to 5 total)
    for (const session of sessions) {
        if (combinedSessions.length >= 5) break;
        if (!seenNames.has(session.name)) {
            combinedSessions.push({ ...session, isLatest: false });
            seenNames.add(session.name);
        }
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 gap-4 mb-[8px]">
                {combinedSessions.map((session) => (
                    <div
                    key={session.directory + session.name}
                    className="w-[312px] px-16 py-4 text-14 text-center text-splash-pills-text whitespace-nowrap cursor-pointer bg-prev-goose-gradient text-prev-goose-text rounded-[14px] inline-block hover:scale-[1.02] transition-all duration-150"
                    onClick={async () => {
                        window.electron.createChatWindow(undefined, session.directory, session.name);
                    }}
                    title={session.directory}>

                        {`${session.name.slice(0, 50)}`}
                        {session.isLatest && !(session.directory === workingDir) && (
                            <span className="ml-2 text-10 opacity-70">(recent)</span>
                        )}
                    </div>                                  
                ))}
            </div>
        </div>
    )
}