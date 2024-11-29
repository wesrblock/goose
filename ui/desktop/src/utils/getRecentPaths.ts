import { execSync } from 'child_process';
import os from 'node:os';

/**
 * Gets recently accessed paths from both Finder preferences and active processes
 * @returns Array of unique paths that appear to be recently or actively accessed
 */
export function listRecentPaths(): string[] {

    const homeDir = os.homedir();
    const username = os.userInfo().username;

    const paths = new Set<string>();

    // Get paths from Finder preferences
    try {
        const finderPrefs = execSync(
            'defaults read com.apple.finder RecentMoveAndCopyDestinations',
            { encoding: 'utf8' }
        );

        // Extract paths from preferences output
        finderPrefs.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('"') && !line.startsWith('("'))
            .forEach(line => {
                const path = line
                    .replace(/^"/, '')           // Remove leading quote
                    .replace(/",$/, '')          // Remove trailing quote and comma
                    .replace(/file:\/\//, '')    // Remove file:// prefix
                    .replace(/\/$/, '');         // Remove trailing slash
                
                if (path.startsWith(homeDir)) {
                    // Extract project paths (2 levels deep from known directories)
                    const match = path.match(
                        new RegExp(`${homeDir}/(Documents|Development|projects|code)/[^/]+/[^/]+`)
                    );
                    if (match) {
                        paths.add(match[0]);
                    }
                }
            });
    } catch (e) {
        console.error('Error reading Finder preferences:', e);
    }

    // Get paths from active processes
    try {
        const processes = execSync(
            `ps aux | grep "${username}/" | grep -v "grep"`,
            { encoding: 'utf8' }
        );

        // Search for project paths in process output
        processes.split('\n').forEach(line => {
            const matches = line.match(
                new RegExp(`${homeDir}/(Documents|Development|projects|code)/[^/]+/[^/ ]+`)
            );
            if (matches) {
                paths.add(matches[0]);
            }
        });
    } catch (e) {
        console.error('Error reading process list:', e);
    }

    return Array.from(paths).sort();
}

// Example usage:
// const recentPaths = getRecentPaths('username');
// console.log(recentPaths);