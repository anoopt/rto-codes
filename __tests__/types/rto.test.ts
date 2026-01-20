import { describe, it, expect } from 'vitest';
import type { RTOCode } from '@/types/rto';

describe('RTOCode Type', () => {
    it('should accept valid RTO code object', () => {
        const validRTO: RTOCode = {
            code: 'KA-01',
            region: 'Koramangala',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: 'KA',
        };

        expect(validRTO.code).toBe('KA-01');
        expect(validRTO.region).toBe('Koramangala');
        expect(validRTO.city).toBe('Bengaluru');
        expect(validRTO.state).toBe('Karnataka');
        expect(validRTO.stateCode).toBe('KA');
    });

    it('should accept RTO with optional fields', () => {
        const rtoWithOptionals: RTOCode = {
            code: 'KA-01',
            region: 'Koramangala',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: 'KA',
            district: 'Bengaluru Urban',
            division: 'Bengaluru Urban Division',
            description: 'RTO Office in Koramangala',
            status: 'active',
            established: '1980',
            address: '123 Main Street',
            pinCode: '560001',
            phone: '+91-80-12345678',
            email: 'ka01@transport.gov.in',
            jurisdictionAreas: ['Koramangala', 'HSR Layout'],
            isDistrictHeadquarter: true,
        };

        expect(rtoWithOptionals.district).toBe('Bengaluru Urban');
        expect(rtoWithOptionals.status).toBe('active');
        expect(rtoWithOptionals.isDistrictHeadquarter).toBe(true);
    });

    it('should accept valid status values', () => {
        const statuses: Array<RTOCode['status']> = ['active', 'not-in-use', 'discontinued', undefined];

        statuses.forEach(status => {
            const rto: RTOCode = {
                code: 'KA-01',
                region: 'Koramangala',
                city: 'Bengaluru',
                state: 'Karnataka',
                stateCode: 'KA',
                status,
            };
            expect(rto.status).toBe(status);
        });
    });

    it('should accept RTO with redirectTo for inactive codes', () => {
        const inactiveRTO: RTOCode = {
            code: 'KA-99',
            region: 'Old Office',
            city: 'Bengaluru',
            state: 'Karnataka',
            stateCode: 'KA',
            status: 'not-in-use',
            redirectTo: 'KA-01',
        };

        expect(inactiveRTO.status).toBe('not-in-use');
        expect(inactiveRTO.redirectTo).toBe('KA-01');
    });
});
