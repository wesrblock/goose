import { execSync } from 'child_process';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Checks if a path is a directory and exists
 * @param filePath Path to check
 * @returns boolean indicating if path is a directory
 */
function isDirectory(filePath: string): boolean {
    try {
        return fs.statSync(filePath).isDirectory();
    } catch (e) {
        return false;
    }
}

/**
 * Normalizes a path to a maximum depth while preserving the base structure
 * @param filePath Path to normalize
 * @param homeDir User's home directory
 * @param maxDepth Maximum depth to preserve (relative to home directory)
 * @returns Normalized path truncated to maxDepth
 */
function normalizePathDepth(filePath: string, homeDir: string, maxDepth: number = 5): string {
    const normalizedPath = path.normalize(filePath);

    // Handle .xcodeproj paths by returning parent directory
    if (normalizedPath.endsWith('.xcodeproj')) {
        return path.dirname(normalizedPath);
    }

    // Handle node_modules paths by returning parent directory
    if (normalizedPath.includes('node_modules')) {
        const parts = normalizedPath.split(path.sep);
        const nodeModulesIndex = parts.indexOf('node_modules');
        if (nodeModulesIndex !== -1) {
            return parts.slice(0, nodeModulesIndex).join(path.sep);
        }
    }

    if (!normalizedPath.startsWith(homeDir) && !normalizedPath.startsWith('/Applications')) {
        return normalizedPath;
    }

    const basePath = normalizedPath.startsWith(homeDir) ? homeDir : '/Applications';
    const relativePath = normalizedPath.slice(basePath.length);
    const components = relativePath.split(path.sep).filter(Boolean);

    if (components.length <= maxDepth) {
        return normalizedPath;
    }

    const truncatedComponents = components.slice(0, maxDepth);
    return path.join(basePath, ...truncatedComponents);
}

/**
 * Checks if a path should be excluded based on filtering rules
 * @param filePath Path to check
 * @param homeDir User's home directory
 * @returns boolean indicating if path should be excluded
 */
function shouldExcludePath(filePath: string, homeDir: string): boolean {
    if (filePath.endsWith('.app')) {
        return true;
    }
    const normalizedPath = path.normalize(filePath);
    

    if (normalizedPath.split(path.sep).some(part => part.startsWith('.') && part !== '..')) {
        return true;
    }

    if (normalizedPath.includes('Library')) {
        return true;
    }

    if (!isDirectory(normalizedPath)) {
        return true;
    }

    return false;
}

/**
 * Gets recently accessed paths using various methods
 * @returns Array of unique paths that appear to be recently or actively accessed
 */
export function listRecentPaths(): string[] {
    const homeDir = os.homedir();
    const username = os.userInfo().username;
    const paths = new Set<string>();

    // Get paths from Spotlight using kMDItemLastUsedDate
    try {
        const spotlightResults = execSync(
            'mdfind "kMDItemLastUsedDate >= 0"',
            { encoding: 'utf8' }
        ).split('\n');

        spotlightResults.forEach(filePath => {
            if ((filePath.startsWith(homeDir) || filePath.startsWith('/Applications')) &&
                !shouldExcludePath(filePath, homeDir)) {
                const normalizedPath = normalizePathDepth(filePath, homeDir);
                paths.add(normalizedPath);
            }
        });
    } catch (e) {
        console.error('Error querying Spotlight:', e);
    }

    // Parse shell history for paths
    try {
        const shellHistory = fs.readFileSync(path.join(homeDir, '.zsh_history'), 'utf8');
        const historyPaths = shellHistory.match(new RegExp(`${homeDir}/[^\\s]+`, 'g'));

        historyPaths?.forEach(filePath => {
            if (!shouldExcludePath(filePath, homeDir)) {
                const normalizedPath = normalizePathDepth(filePath, homeDir);
                paths.add(normalizedPath);
            }
        });
    } catch (e) {
        console.error('Error reading shell history:', e);
    }

    // Get recent folders from Finder
    try {
        const recentFolders = execSync(
            'defaults read com.apple.finder FXRecentFolders',
            { encoding: 'utf8' }
        );

        const folderMatches = recentFolders.match(/Name = [^\n]+\n[^"]*"([^"]+)"/g);
        if (folderMatches) {
            folderMatches.forEach(match => {
                const filePath = match.split('\n')[1].trim().replace(/^"|"$/g, '');
                if ((filePath.startsWith(homeDir) || filePath.startsWith('/Applications')) &&
                    !shouldExcludePath(filePath, homeDir)) {
                    const normalizedPath = normalizePathDepth(filePath, homeDir);
                    paths.add(normalizedPath);
                }
            });
        }
    } catch (e) {
        console.error('Error reading Finder recent folders:', e);
    }

    // Get paths from active processes
    try {
        const processes = execSync(
            `ps aux | grep "${username}/" | grep -v "grep"`,
            { encoding: 'utf8' }
        );

        processes.split('\n').forEach(line => {
            const matches = line.match(new RegExp(`${homeDir}/[^\\s]+`));
            if (matches) {
                const filePath = matches[0];
                if ((filePath.startsWith(homeDir) || filePath.startsWith('/Applications')) &&
                    !shouldExcludePath(filePath, homeDir)) {
                    const normalizedPath = normalizePathDepth(filePath, homeDir);
                    paths.add(normalizedPath);
                }
            }
        });
    } catch (e) {
        console.error('Error reading process list:', e);
    }

    return Array.from(paths).sort();
}
