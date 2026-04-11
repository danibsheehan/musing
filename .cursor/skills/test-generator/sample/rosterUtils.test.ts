import { describe, expect, it } from 'vitest';
import { abbrevName } from './rosterUtils';

describe('abbrevName', () => {
	it('returns empty string for whitespace-only input', () => {
		expect(abbrevName('   ')).toBe('');
	});

	it('abbreviates a single token to three letters', () => {
		expect(abbrevName('shohei')).toBe('SHO');
	});

	it('uses first and last initial for multiple tokens', () => {
		expect(abbrevName('Shohei Ohtani')).toBe('SO');
	});

	it('trims surrounding whitespace', () => {
		expect(abbrevName('  Juan Soto  ')).toBe('JS');
	});
});
