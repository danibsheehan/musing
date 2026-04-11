// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusPill } from './StatusPill';

describe('StatusPill', () => {
	it('renders the label', () => {
		render(<StatusPill label="Active roster" />);
		expect(screen.getByTestId('pill')).toHaveTextContent('Active roster');
	});

	it('applies active class when active is true', () => {
		render(<StatusPill label="Live" active />);
		expect(screen.getByTestId('pill').classList.contains('active')).toBe(true);
	});
});
