import React, { useEffect, useState } from "react"

export default function SessionPills() {
    const [sessions, setSessions] = useState([]);

    const dir = window.appConfig.get("GOOSE_WORKING_DIR");
    useEffect(() => {
        async function loadSessions() {
            
            window.electron.logInfo(`_------______________ Looking for sessions related to ${dir}`);
            const sessions = await window.electron.listSessions(dir);
      
            window.electron.logInfo(`_------______________ Found ${sessions.length} sessions in ${dir}`);
            window.electron.logInfo(`Sessions: ${JSON.stringify(sessions)}`);
            setSessions(sessions);
        };
        loadSessions();
    }, []);

    if (sessions.length === 0) {
        return null;
    }

    return (
        <div className="grid grid-cols-1 gap-4">
            
            <div className="grid grid-cols-1 gap-4 mb-[8px]">
                <div className="text-splash-pills-text text-center text-11">Previous gooses:</div>
                {sessions.map((session) => (
                    <div
                    className="w-[312px] px-16 py-4 text-14 text-center text-splash-pills-text whitespace-nowrap cursor-pointer bg-prev-goose-gradient text-prev-goose-text rounded-[14px] inline-block hover:scale-[1.02] transition-all duration-150"
                    onClick={async () => {
                        window.electron.createChatWindow(undefined, dir, session);
                    }}>
                        {session}                
                    </div>                                  
                ))} 
            </div>
        </div>
    )
}