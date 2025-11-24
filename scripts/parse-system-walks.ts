import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

export interface SystemWalkData {
  hasSystemWalk: boolean;
  subsystems: string[];
  architectureFile?: string;
  totalLines?: number;
}

/**
 * Parse SYSTEM-WALK-TRACKER.md to identify issues with complete system walks
 */
export function parseSystemWalkTracker(parentRepoPath: string): Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }> {
  const trackerPath = join(parentRepoPath, 'docs/technical/simulation-systems/SYSTEM-WALK-TRACKER.md');

  if (!existsSync(trackerPath)) {
    console.warn('⚠️  SYSTEM-WALK-TRACKER.md not found');
    return new Map();
  }

  const content = readFileSync(trackerPath, 'utf-8');
  const systemWalkMap = new Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }>();

  // Look for lines with the 🎯 emoji indicating complete system walks
  // Format: ✅ **NN** Issue Name - `file.md` + **N sub-systems** (N,NNN lines total) 🎯
  const regex = /✅\s+\*\*(\d+)\*\*\s+([^-]+)\s+-\s+`([^`]+)`\s+\+\s+\*\*(\d+)\s+sub-systems?\*\*\s+\(([0-9,]+)\s+lines\s+total\)\s+🎯/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const [, issueNum, issueName, archFile, subsysCount, lines] = match;
    const issueNumber = parseInt(issueNum);
    const subsystemCount = parseInt(subsysCount);
    const totalLines = parseInt(lines.replace(/,/g, ''));

    // Extract issue slug from architecture filename
    // e.g., "42-water-desalination-mega-trusts-ARCHITECTURE.md" -> "water-desalination-mega-trusts"
    const slugMatch = archFile.match(/^\d+-(.+)-ARCHITECTURE\.md$/);
    if (slugMatch) {
      const slug = slugMatch[1];
      systemWalkMap.set(slug, { issueNumber, subsystemCount, totalLines });
    }
  }

  console.log(`📐 Found ${systemWalkMap.size} issues with complete system walks`);
  return systemWalkMap;
}

/**
 * Parse an architecture file to extract subsystem names
 */
export function parseSubsystems(parentRepoPath: string, architectureFile: string): string[] {
  const archPath = join(parentRepoPath, 'docs/technical/simulation-systems', architectureFile);

  if (!existsSync(archPath)) {
    return [];
  }

  const content = readFileSync(archPath, 'utf-8');
  const subsystems: string[] = [];

  // Look for subsystem headers
  // Format: ### **Sub-System N: Name** (~NNN lines proposed)
  const regex = /###\s+\*\*Sub-System\s+\d+:\s+([^*]+)\*\*/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const subsystemName = match[1].trim();
    subsystems.push(subsystemName);
  }

  return subsystems;
}

/**
 * Get system walk data for an issue by its slug
 */
export function getSystemWalkData(
  issueSlug: string,
  issueNumber: number,
  parentRepoPath: string,
  systemWalkMap: Map<string, { issueNumber: number; subsystemCount: number; totalLines: number }>
): SystemWalkData {
  const walkData = systemWalkMap.get(issueSlug);

  if (!walkData) {
    return { hasSystemWalk: false, subsystems: [] };
  }

  // Find architecture file
  const systemsDir = join(parentRepoPath, 'docs/technical/simulation-systems');
  const files = readdirSync(systemsDir);

  // Look for file matching pattern: NN-slug-ARCHITECTURE.md
  const archFilePattern = new RegExp(`^${issueNumber}-.*-ARCHITECTURE\\.md$`);
  const archFile = files.find(f => archFilePattern.test(f));

  if (!archFile) {
    return { hasSystemWalk: false, subsystems: [] };
  }

  const subsystems = parseSubsystems(parentRepoPath, archFile);

  return {
    hasSystemWalk: true,
    subsystems,
    architectureFile: archFile,
    totalLines: walkData.totalLines,
  };
}
