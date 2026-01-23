#!/usr/bin/env bun
/**
 * Script to generate DATA.md with fully dynamic badges
 * All badges read data from JSON files via GitHub raw URLs
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// TODO: Change back to 'main' after merging ralph-osm branch
const BASE_URL = 'https://raw.githubusercontent.com/anoopt/rto-codes/ralph-osm/data';

interface StateInfo {
    stateCode: string;
    stateName: string;
    folderName: string;
    displayName: string;
    type: 'state' | 'union-territory';
}

// Map state codes to folder names
const stateCodeToFolder: Record<string, string> = {
    AN: 'andaman-nicobar',
    AP: 'andhra-pradesh',
    AR: 'arunachal-pradesh',
    AS: 'assam',
    BR: 'bihar',
    CH: 'chandigarh',
    CG: 'chhattisgarh',
    DD: 'dadra-nagar-haveli-daman-diu',
    DL: 'delhi',
    GA: 'goa',
    GJ: 'gujarat',
    HR: 'haryana',
    HP: 'himachal-pradesh',
    JK: 'jammu-kashmir',
    JH: 'jharkhand',
    KA: 'karnataka',
    KL: 'kerala',
    LA: 'ladakh',
    LD: 'lakshadweep',
    MP: 'madhya-pradesh',
    MH: 'maharashtra',
    MN: 'manipur',
    ML: 'meghalaya',
    MZ: 'mizoram',
    NL: 'nagaland',
    OD: 'odisha',
    PB: 'punjab',
    PY: 'puducherry',
    RJ: 'rajasthan',
    SK: 'sikkim',
    TN: 'tamil-nadu',
    TS: 'telangana',
    TR: 'tripura',
    UP: 'uttar-pradesh',
    UK: 'uttarakhand',
    WB: 'west-bengal',
};

// Display names for states/UTs
const displayNames: Record<string, string> = {
    AN: 'Andaman & Nicobar',
    AP: 'Andhra Pradesh',
    AR: 'Arunachal Pradesh',
    AS: 'Assam',
    BR: 'Bihar',
    CH: 'Chandigarh',
    CG: 'Chhattisgarh',
    DD: 'Dadra & Nagar Haveli and Daman & Diu',
    DL: 'Delhi',
    GA: 'Goa',
    GJ: 'Gujarat',
    HR: 'Haryana',
    HP: 'Himachal Pradesh',
    JK: 'Jammu & Kashmir',
    JH: 'Jharkhand',
    KA: 'Karnataka',
    KL: 'Kerala',
    LA: 'Ladakh',
    LD: 'Lakshadweep',
    MP: 'Madhya Pradesh',
    MH: 'Maharashtra',
    MN: 'Manipur',
    ML: 'Meghalaya',
    MZ: 'Mizoram',
    NL: 'Nagaland',
    OD: 'Odisha',
    PB: 'Punjab',
    PY: 'Puducherry',
    RJ: 'Rajasthan',
    SK: 'Sikkim',
    TN: 'Tamil Nadu',
    TS: 'Telangana',
    TR: 'Tripura',
    UP: 'Uttar Pradesh',
    UK: 'Uttarakhand',
    WB: 'West Bengal',
};

// States list (28 states)
const states = ['AP', 'AR', 'AS', 'BR', 'CG', 'GA', 'GJ', 'HR', 'HP', 'JH', 'KA', 'KL', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OD', 'PB', 'RJ', 'SK', 'TN', 'TS', 'TR', 'UP', 'UK', 'WB'];

// Union Territories (8 UTs)
const unionTerritories = ['AN', 'CH', 'DD', 'DL', 'JK', 'LA', 'LD', 'PY'];

function generateStatusBadge(stateCode: string): string {
    // Dynamic badge that reads status from index.json stateMap
    return `![Status](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent(`$.stateMap.${stateCode}.status`)}&label=)`;
}

function generateRTOsBadge(stateCode: string): string {
    const folder = stateCodeToFolder[stateCode];
    // Dynamic badge that reads RTO count from state's index.json
    return `![${stateCode} RTOs](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/' + folder + '/index.json')}&query=${encodeURIComponent('$.length')}&label=RTOs&color=blue)`;
}

function generateOSMBadge(stateCode: string, osmEnabled: boolean): string {
    // Use static badge with color based on local data, but value from dynamic JSON for consistency
    const color = osmEnabled ? 'brightgreen' : 'yellow';
    return `![OSM](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent(`$.stateMap.${stateCode}.osmStatus`)}&label=OSM&color=${color})`;
}

function generateStateRow(stateCode: string, isComplete: boolean = false, osmEnabled: boolean = false): string {
    const displayName = displayNames[stateCode];
    const nameColumn = isComplete ? `**${displayName} (${stateCode})**` : `${displayName} (${stateCode})`;

    return `| ${nameColumn} | ${generateStatusBadge(stateCode)} | ${generateRTOsBadge(stateCode)} | ${generateOSMBadge(stateCode, osmEnabled)} |`;
}

function generateMarkdown(): string {
    // Read index.json to determine which states are complete and have OSM enabled
    const indexPath = join(process.cwd(), 'data', 'index.json');
    const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
    const stateMap = indexData.stateMap || {};

    const completeStates = new Set(
        Object.entries(stateMap)
            .filter(([_, info]: [string, any]) => info.isComplete && info.type === 'state')
            .map(([code]) => code)
    );

    const completeUTs = new Set(
        Object.entries(stateMap)
            .filter(([_, info]: [string, any]) => info.isComplete && info.type === 'union-territory')
            .map(([code]) => code)
    );

    // Track OSM enabled states (read from config files)
    const osmEnabledStates = new Set<string>();
    for (const [code, info] of Object.entries(stateMap) as [string, any][]) {
        const folder = stateCodeToFolder[code];
        if (folder) {
            try {
                const configPath = join(process.cwd(), 'data', folder, 'config.json');
                const config = JSON.parse(readFileSync(configPath, 'utf-8'));
                if (config.osmEnabled) {
                    osmEnabledStates.add(code);
                }
            } catch {
                // Config doesn't exist or osmEnabled not set
            }
        }
    }

    const stateRows = states
        .map(code => generateStateRow(code, completeStates.has(code), osmEnabledStates.has(code)))
        .join('\n');

    const utRows = unionTerritories
        .map(code => generateStateRow(code, completeUTs.has(code), osmEnabledStates.has(code)))
        .join('\n');

    return `# Data & Coverage Status

This document tracks the completeness of the RTO database across all Indian States and Union Territories.

## 📊 Summary

![States Complete](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.completedStates')}&suffix=%2F28%20States&label=States&color=orange)
![UTs Complete](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.completedUTs')}&suffix=%2F8%20UTs&label=UTs&color=orange)
![Total RTOs](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.totalRTOs')}&label=Total%20RTOs&color=blue)
![Verified RTOs](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.totalVerified')}&label=Verified&color=success)

## 🗺️ State-wise Breakdown

| State | Status | RTOs | OSM Map |
| :---- | :----- | :--- | :------ |
${stateRows}

## 🏛️ Union Territory Breakdown

| Union Territory | Status | RTOs | OSM Map |
| :-------------- | :----- | :--- | :------ |
${utRows}

---

[← Back to README](../README.md)
`;
}

// Main execution
const markdown = generateMarkdown();
const outputPath = join(process.cwd(), 'docs', 'DATA.md');
writeFileSync(outputPath, markdown);
console.log('✅ DATA.md has been regenerated with dynamic badges');
