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
    // Normalize path for consistent handling
    const normalizedPath = path.normalize(filePath);
    
    // If path doesn't start with home directory or is an application, return as is
    if (!normalizedPath.startsWith(homeDir) && !normalizedPath.startsWith('/Applications')) {
        return normalizedPath;
    }

    // Split path into components
    const basePath = normalizedPath.startsWith(homeDir) ? homeDir : '/Applications';
    const relativePath = normalizedPath.slice(basePath.length);
    const components = relativePath.split(path.sep).filter(Boolean);

    // If depth is within limit, return full path
    if (components.length <= maxDepth) {
        return normalizedPath;
    }

    // Otherwise truncate to maxDepth
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
    // Normalize path for consistent comparison
    const normalizedPath = path.normalize(filePath);
    
    // Check if path contains hidden directories (starting with .)
    if (normalizedPath.split(path.sep).some(part => part.startsWith('.') && part !== '..')) {
        return true;
    }

    // Check if path is in Library
    if (normalizedPath.includes('Library')) {
        return true;
    }

    // Exclude if it's not a directory
    if (!isDirectory(normalizedPath)) {
        return true;
    }

    return false;
}

/**
 * Gets recently accessed paths from Finder preferences and active processes
 * @returns Array of unique paths that appear to be recently or actively accessed
 */
export function listRecentPaths(): string[] {
    const homeDir = os.homedir();
    const username = os.userInfo().username;
    const paths = new Set<string>();

    // Get recent folders from Finder
    try {
        const recentFolders = execSync(
            'defaults read com.apple.finder FXRecentFolders',
            { encoding: 'utf8' }
        );

        // Extract paths from recent folders
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

    // Get recent move/copy destinations
    try {
        const moveDestinations = execSync(
            'defaults read com.apple.finder RecentMoveAndCopyDestinations',
            { encoding: 'utf8' }
        );

        moveDestinations.split('\n')
            .map(line => line.trim())
            .filter(line => line.startsWith('"') && !line.startsWith('("'))
            .forEach(line => {
                const filePath = line
                    .replace(/^"/, '')           // Remove leading quote
                    .replace(/",$/, '')          // Remove trailing quote and comma
                    .replace(/file:\/\//, '')    // Remove file:// prefix
                    .replace(/\/$/, '');         // Remove trailing slash
                
                if ((filePath.startsWith(homeDir) || filePath.startsWith('/Applications')) && 
                    !shouldExcludePath(filePath, homeDir)) {
                    const normalizedPath = normalizePathDepth(filePath, homeDir);
                    paths.add(normalizedPath);
                }
            });
    } catch (e) {
        console.error('Error reading Finder move destinations:', e);
    }

    // Get recent searches
    try {
        const recentSearches = execSync(
            'defaults read com.apple.finder SGTRecentFileSearches',
            { encoding: 'utf8' }
        );

        const searchMatches = recentSearches.match(/name = "[^"]+"/g);
        if (searchMatches) {
            searchMatches.forEach(match => {
                const searchTerm = match.replace(/^name = "|"$/g, '');
                // Only add if it looks like a path
                if (searchTerm.includes('/')) {
                    const projectMatch = searchTerm.match(
                        new RegExp(`${homeDir}/[^/]+/[^/]+/[^/]+`)
                    );
                    if (projectMatch && !shouldExcludePath(projectMatch[0], homeDir)) {
                        const normalizedPath = normalizePathDepth(projectMatch[0], homeDir);
                        paths.add(normalizedPath);
                    }
                }
            });
        }
    } catch (e) {
        console.error('Error reading Finder recent searches:', e);
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
                console.log("MATCHES", matches[0]);
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