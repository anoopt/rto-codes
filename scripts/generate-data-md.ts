#!/usr/bin/env bun
/**
 * Script to generate DATA.md with fully dynamic badges
 * All badges read data from JSON files via GitHub raw URLs
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = 'https://raw.githubusercontent.com/anoopt/rto-codes/main/data';

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

function getStatusColor(status: string): string {
    switch (status) {
        case 'Complete': return 'brightgreen';
        case 'In Progress': return 'orange';
        case 'Not Started': return 'lightgrey';
        default: return 'lightgrey';
    }
}

function generateStatusBadge(stateCode: string, status: string): string {
    // Dynamic badge that reads status from index.json stateMap with color based on status
    const color = getStatusColor(status);
    return `![Status](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent(`$.stateMap.${stateCode}.status`)}&label=&color=${color})`;
}

function generateRTOsBadge(rtoCount: number, totalExpectedRTOs: number): string {
    // Static badge showing current/total RTOs
    // If totalExpectedRTOs is 0 or undefined, just show current count
    if (totalExpectedRTOs > 0) {
        const label = `${rtoCount}%2F${totalExpectedRTOs}`;
        const color = rtoCount >= totalExpectedRTOs ? 'brightgreen' : 'blue';
        return `![RTOs](https://img.shields.io/badge/RTOs-${label}-${color})`;
    }
    return `![RTOs](https://img.shields.io/badge/RTOs-${rtoCount}-lightgrey)`;
}

function generateOSMBadge(stateCode: string, osmColor: string): string {
    // Use osmColor from index.json stateMap (already computed by generate-index.ts)
    return `![OSM](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent(`$.stateMap.${stateCode}.osmStatus`)}&label=OSM&color=${osmColor})`;
}

interface StateRowData {
    stateCode: string;
    status: string;
    osmColor: string;
    rtoCount: number;
    totalExpectedRTOs: number;
    activeRTOs: number; // 0 means unknown
}

function generateActiveRTOsBadge(activeRTOs: number, rtoCount: number): string {
    // If no RTOs documented yet, show TBC
    if (rtoCount === 0) {
        return `![Active](https://img.shields.io/badge/Active-TBC-lightgrey)`;
    }
    // If activeRTOs is not set (0), show N/A - we don't know
    if (!activeRTOs || activeRTOs === 0) {
        return `![Active](https://img.shields.io/badge/Active-N%2FA-lightgrey)`;
    }
    // If activeRTOs equals rtoCount, all documented RTOs are active
    if (activeRTOs === rtoCount) {
        return `![Active](https://img.shields.io/badge/Active-All-brightgreen)`;
    }
    // Show active/documented with orange to indicate some are legacy
    return `![Active](https://img.shields.io/badge/Active-${activeRTOs}%2F${rtoCount}-orange)`;
}

function generateStateRow(data: StateRowData): string {
    const displayName = displayNames[data.stateCode];
    const isComplete = data.status === 'Complete';
    const nameColumn = isComplete ? `**${displayName} (${data.stateCode})**` : `${displayName} (${data.stateCode})`;

    return `| ${nameColumn} | ${generateStatusBadge(data.stateCode, data.status)} | ${generateRTOsBadge(data.rtoCount, data.totalExpectedRTOs)} | ${generateActiveRTOsBadge(data.activeRTOs, data.rtoCount)} | ${generateOSMBadge(data.stateCode, data.osmColor)} |`;
}

function generateMarkdown(): string {
    // Read index.json to determine state status and OSM colors
    const indexPath = join(process.cwd(), 'data', 'index.json');
    const indexData = JSON.parse(readFileSync(indexPath, 'utf-8'));
    const stateMap = indexData.stateMap || {};

    const stateRows = states
        .map(code => generateStateRow({
            stateCode: code,
            status: stateMap[code]?.status || 'Not Started',
            osmColor: stateMap[code]?.osmColor || 'yellow',
            rtoCount: stateMap[code]?.rtoCount || 0,
            totalExpectedRTOs: stateMap[code]?.totalExpectedRTOs || 0,
            activeRTOs: stateMap[code]?.activeRTOs || 0,
        }))
        .join('\n');

    const utRows = unionTerritories
        .map(code => generateStateRow({
            stateCode: code,
            status: stateMap[code]?.status || 'Not Started',
            osmColor: stateMap[code]?.osmColor || 'yellow',
            rtoCount: stateMap[code]?.rtoCount || 0,
            totalExpectedRTOs: stateMap[code]?.totalExpectedRTOs || 0,
            activeRTOs: stateMap[code]?.activeRTOs || 0,
        }))
        .join('\n');

    return `# Data & Coverage Status

This document tracks the completeness of the RTO database across all Indian States and Union Territories.

## 📊 Summary

![States Complete](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.completedStates')}&suffix=%2F28%20States&label=Complete&color=brightgreen)
![States In Progress](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.inProgressStates')}&suffix=%20States&label=In%20Progress&color=orange)
![UTs Complete](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.completedUTs')}&suffix=%2F8%20UTs&label=Complete&color=brightgreen)
![UTs In Progress](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.inProgressUTs')}&suffix=%20UTs&label=In%20Progress&color=orange)
![Total RTOs](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.totalRTOs')}&label=Total%20RTOs&color=blue)
![Verified RTOs](https://img.shields.io/badge/dynamic/json?url=${encodeURIComponent(BASE_URL + '/index.json')}&query=${encodeURIComponent('$.totalVerified')}&label=Verified&color=success)

## 🗺️ State-wise Breakdown

| State | Status | RTOs | Active | OSM Map |
| :---- | :----- | :--- | :----- | :------ |
${stateRows}

## 🏛️ Union Territory Breakdown

| Union Territory | Status | RTOs | Active | OSM Map |
| :-------------- | :----- | :--- | :----- | :------ |
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
