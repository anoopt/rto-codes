/**
 * Script to generate index.json files for efficient RTO data loading
 * 
 * This script reads all individual RTO JSON files and creates:
 * 1. data/karnataka/index.json - Array of all Karnataka RTOs
 * 2. data/index.json - Master index listing all states
 * 
 * Run: bun scripts/generate-index.ts
 */

import fs from 'fs';
import path from 'path';
import type { RTOCode } from '../types/rto.js';
import type { StateConfig } from '../types/state-config.js';

interface StateIndex {
    stateCode: string;
    stateName: string;
    rtoCount: number;
    verifiedCount: number;
    rtoCodes: string[]; // Just the codes for quick lookup
    isComplete: boolean;
    type: "state" | "union-territory";
    status: string;
}

interface MasterIndex {
    generatedAt: string;
    totalRTOs: number;
    totalVerified: number;
    totalStates: number;
    completedStates: number;
    totalUTs: number;
    completedUTs: number;
    states: StateIndex[];
    stateMap: Record<string, StateIndex>;
}

const DATA_DIR = path.join(process.cwd(), 'data');

function getStateDirectories(): string[] {
    return fs.readdirSync(DATA_DIR).filter(item => {
        const itemPath = path.join(DATA_DIR, item);
        return fs.statSync(itemPath).isDirectory();
    });
}

function loadRTOsFromState(stateDir: string): RTOCode[] {
    const statePath = path.join(DATA_DIR, stateDir);
    const files = fs.readdirSync(statePath).filter(file =>
        file.endsWith('.json') &&
        !file.includes('index') &&
        !file.includes('raw-') &&
        !file.includes('config') &&
        // Only include files matching RTO code pattern (e.g., ka-01.json)
        /^[a-z]{2}-\d+\.json$/i.test(file)
    );

    const rtos: RTOCode[] = files.map(file => {
        const filePath = path.join(statePath, file);
        const fileContents = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(fileContents) as RTOCode;
    });

    // Sort by code
    return rtos.sort((a, b) => a.code.localeCompare(b.code));
}

function isVerifiedRTO(rto: RTOCode): boolean {
    return !!(rto.region && rto.region.trim() !== '');
}

function loadStateConfig(stateDir: string): StateConfig | null {
    try {
        const configPath = path.join(DATA_DIR, stateDir, 'config.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }
        const configContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent) as StateConfig;
    } catch (error) {
        console.warn(`Failed to load config for ${stateDir}:`, error);
        return null;
    }
}

function generateStateIndex(stateDir: string): { stateIndex: StateIndex; rtos: RTOCode[] } {
    const rtos = loadRTOsFromState(stateDir);
    const verifiedRTOs = rtos.filter(isVerifiedRTO);

    // Try to get state info from config.json first, then fall back to first RTO
    const config = loadStateConfig(stateDir);
    
    // Determine status based on RTO count and configuration
    // 1. Complete: Explicitly marked complete OR RTO count matches/exceeds total (and total is known)
    // 2. In Progress: Has some RTOs but not all
    // 3. Not Started: No RTOs (previously Scaffolded)
    const totalRTOs = config?.totalRTOs || 0;
    const isActuallyComplete = config?.isComplete || (totalRTOs > 0 && rtos.length >= totalRTOs);

    let status = "Not Started";
    if (isActuallyComplete) {
        status = "Complete";
    } else if (rtos.length > 0) {
        status = "In Progress";
    }

    const stateIndex: StateIndex = {
        stateCode: config?.stateCode || rtos[0]?.stateCode || stateDir.toUpperCase(),
        stateName: config?.name || rtos[0]?.state || stateDir,
        rtoCount: rtos.length,
        verifiedCount: verifiedRTOs.length,
        rtoCodes: rtos.map(rto => rto.code.toLowerCase()),
        isComplete: config?.isComplete ?? false,
        type: config?.type ?? "state",
        status: status,
    };

    return { stateIndex, rtos };
}

function main() {
    console.log('🔄 Generating RTO index files...\n');

    const stateDirectories = getStateDirectories();
    const masterIndex: MasterIndex = {
        generatedAt: new Date().toISOString(),
        totalRTOs: 0,
        totalVerified: 0,
        totalStates: 0,
        completedStates: 0,
        totalUTs: 0,
        completedUTs: 0,
        states: [],
        stateMap: {},
    };

    for (const stateDir of stateDirectories) {
        console.log(`📁 Processing ${stateDir}...`);

        const { stateIndex, rtos } = generateStateIndex(stateDir);

        // Write state-level index.json
        const stateIndexPath = path.join(DATA_DIR, stateDir, 'index.json');
        fs.writeFileSync(stateIndexPath, JSON.stringify(rtos, null, 2));
        console.log(`   ✅ Created ${stateDir}/index.json (${rtos.length} RTOs, ${stateIndex.verifiedCount} verified)`);

        // Add to master index
        masterIndex.states.push(stateIndex);
        masterIndex.stateMap[stateIndex.stateCode] = stateIndex;
        masterIndex.totalRTOs += stateIndex.rtoCount;
        masterIndex.totalVerified += stateIndex.verifiedCount;

        // Count states vs UTs and their completion status
        if (stateIndex.type === "union-territory") {
            masterIndex.totalUTs++;
            if (stateIndex.isComplete) masterIndex.completedUTs++;
        } else {
            masterIndex.totalStates++;
            if (stateIndex.isComplete) masterIndex.completedStates++;
        }
    }

    // Write master index.json
    const masterIndexPath = path.join(DATA_DIR, 'index.json');
    fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));
    console.log(`\n📊 Created data/index.json`);
    console.log(`   Total: ${masterIndex.totalRTOs} RTOs across ${masterIndex.states.length} state(s)/UT(s)`);
    console.log(`   States: ${masterIndex.completedStates}/${masterIndex.totalStates} complete`);
    console.log(`   UTs: ${masterIndex.completedUTs}/${masterIndex.totalUTs} complete`);
    console.log(`   Verified: ${masterIndex.totalVerified} RTOs with complete data`);

    console.log('\n✨ Index generation complete!');
}

main();
