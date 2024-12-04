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
      return { currentDirSessions: [], otherLocationSessions: [] };
    }

    const currentDirSessions = [];
    const otherLocationSessions = [];
    const seenNames = new Set();

    // Process latest sessions first
    for (const session of latestSessions) {
      if (!seenNames.has(session.name)) {
        if (session.directory === workingDir) {
          currentDirSessions.push({ ...session, isLatest: true });
        } else {
          otherLocationSessions.push({ ...session, isLatest: true });
        }
        seenNames.add(session.name);
      }
    }

    // Process regular sessions
    for (const session of sessions) {
      if (!seenNames.has(session.name)) {
        if (session.directory === workingDir) {
          currentDirSessions.push({ ...session, isLatest: false });
        } else {
          otherLocationSessions.push({ ...session, isLatest: false });
        }
        seenNames.add(session.name);
      }
    }

    // Sort sessions by name
    currentDirSessions.sort((a, b) => a.name.localeCompare(b.name));
    otherLocationSessions.sort((a, b) => a.name.localeCompare(b.name));

    return {
      currentDirSessions: currentDirSessions.slice(0, 5),
      otherLocationSessions: otherLocationSessions.slice(0, 5)
    };
  };

  return getCombinedSessions();
};

export default function SessionPills() {
  const workingDir = window.appConfig.get("GOOSE_WORKING_DIR");
  const { currentDirSessions, otherLocationSessions } = useCombinedSessions(workingDir);

  if (currentDirSessions.length === 0 && otherLocationSessions.length === 0) {
    return null;
  }

  const SessionPill = ({ session }) => (
    <div
      key={session.directory + session.name}
      className="w-[312px] px-16 py-4 mb-2 text-center text-splash-pills-text whitespace-nowrap cursor-pointer bg-prev-goose-gradient text-prev-goose-text rounded-[14px] inline-block hover:scale-[1.02] transition-all duration-150"
      onClick={async () => {
        window.electron.createChatWindow(undefined, session.directory, session.name);
      }}
      title={session.directory}
    >
      <div className="text-14">{`${session.name.slice(0, 50)}`}</div>
      {session.directory !== workingDir && (
        <div className="text-xs opacity-70 mt-1">{session.directory}</div>
      )}
    </div>
  );

  return (
      <div className="grid grid-cols-1  ">
          {currentDirSessions.length > 0 && (
              <div>
                  <h3 className="text-11 text-splash-pills-text mb-2 text-center">Recent sessions in
                      this directory</h3>
                  <div className="grid grid-cols-1 gap-4 mb-[16px]">
                      {currentDirSessions.map((session) => (
                          <SessionPill key={session.directory + session.name} session={session}/>
                      ))}
                  </div>
              </div>
          )}
          {otherLocationSessions.length > 0 && (
              <div>
                  <h3 className="text-11 text-splash-pills-text mb-2 text-center">Recent sessions in other
                      locations</h3>
                  <div className="grid grid-cols-1">
                      {otherLocationSessions.map((session) => (
                          <SessionPill key={session.directory + session.name} session={session}/>
                      ))}
                  </div>
              </div>
          )}
      </div>
  );
}
