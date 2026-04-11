type StatusPillProps = {
	label: string;
	active?: boolean;
};

export function StatusPill({ label, active }: StatusPillProps) {
	return (
		<span className={`pill${active ? ' active' : ''}`} data-testid="pill">
			{label}
		</span>
	);
}
