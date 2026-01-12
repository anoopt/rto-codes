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

interface StateIndex {
    stateCode: string;
    stateName: string;
    rtoCount: number;
    verifiedCount: number;
    rtoCodes: string[]; // Just the codes for quick lookup
}

interface MasterIndex {
    generatedAt: string;
    totalRTOs: number;
    totalVerified: number;
    states: StateIndex[];
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

function generateStateIndex(stateDir: string): { stateIndex: StateIndex; rtos: RTOCode[] } {
    const rtos = loadRTOsFromState(stateDir);
    const verifiedRTOs = rtos.filter(isVerifiedRTO);

    const stateIndex: StateIndex = {
        stateCode: rtos[0]?.stateCode || stateDir.toUpperCase(),
        stateName: rtos[0]?.state || stateDir,
        rtoCount: rtos.length,
        verifiedCount: verifiedRTOs.length,
        rtoCodes: rtos.map(rto => rto.code.toLowerCase()),
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
        states: [],
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
        masterIndex.totalRTOs += stateIndex.rtoCount;
        masterIndex.totalVerified += stateIndex.verifiedCount;
    }

    // Write master index.json
    const masterIndexPath = path.join(DATA_DIR, 'index.json');
    fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));
    console.log(`\n📊 Created data/index.json`);
    console.log(`   Total: ${masterIndex.totalRTOs} RTOs across ${masterIndex.states.length} state(s)`);
    console.log(`   Verified: ${masterIndex.totalVerified} RTOs with complete data`);

    console.log('\n✨ Index generation complete!');
}

main();
