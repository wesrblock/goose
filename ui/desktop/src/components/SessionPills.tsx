import React, { useEffect, useState } from "react"

const useCombinedSessions = (workingDir: string) => {
  const [sessions, setSessions] = useState([]);
  const [latestSessions, setLatestSessions] = useState([]);

  useEffect(() => {
    async function loadSessions() {
      const sessions = await window.electron.listSessions(workingDir);
      setSessions(sessions);
      const latestSessions = await window.electron.listSessions();
      setLatestSessions(latestSessions);
    };
    loadSessions();
  }, [workingDir]);

  const getCombinedSessions = () => {
    if (sessions.length === 0 && latestSessions.length === 0) {
      return [];
    }

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

    return combinedSessions;
  };

  return getCombinedSessions();
};

export default function SessionPills() {
  const workingDir = window.appConfig.get("GOOSE_WORKING_DIR");
  const combinedSessions = useCombinedSessions(workingDir);

  if (combinedSessions.length === 0) {
    return null;
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
          title={session.directory}
        >
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