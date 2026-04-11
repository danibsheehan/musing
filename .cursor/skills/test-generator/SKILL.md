---
name: test-generator
description: Generates Vitest unit tests for React (including TypeScript) and plain TypeScript modules. Use this skill whenever the user wants to write tests, generate test files, add test coverage, test a component/hook/context module, or asks anything like "write tests for this", "generate specs", "add unit tests", "test this component", "how do I test this hook", or "improve my test coverage". Trigger even if the user just pastes code and asks broadly how to improve it — testing is often the right answer.
---

# Test Generator — React / TypeScript (Vitest)

Generate thorough, idiomatic **Vitest** tests for **React** (function components, hooks) and plain TypeScript modules.

---

## Prerequisites (component & hook tests)

If the project does not already have them, add dev dependencies:

- **`vitest`** — test runner (often already present with Vite)
- **`jsdom`** — DOM when `environment` is `jsdom`
- **`@testing-library/react`** — `render`, `screen`, `within`, `renderHook`, `waitFor`
- **`@testing-library/jest-dom`** — matchers like `toBeInTheDocument()`, `toHaveClass()` (register via Vitest `setupFiles`)
- **`@testing-library/user-event`** — realistic keyboard/pointer input (preferred over `fireEvent` where it fits)

Pure TypeScript tests can use Vitest’s default **`node`** environment.

### Example Vitest config snippets

In `vitest.config.ts` (or `vite.config.ts` under `test`):

```typescript
test: {
	environment: 'jsdom',
	globals: true,
	setupFiles: ['./src/test/setup.ts'],
},
```

`src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest';
```

(Use the import path your `@testing-library/jest-dom` version documents if it differs.)

---

## Workflow

1. **Understand the code** — Read the file(s) provided. Identify:
   - Type: React component (`.tsx`), hook (`useX`), context provider, plain TS module, or server-side helper
   - Dependencies: `useState` / `useEffect`, Context, React Router, HTTP client, async flows
   - Public API: props, callback props, returned JSX, exported functions

2. **Plan the test suite** — Before writing, outline:
   - Which behaviours need a `describe` block
   - Happy-path cases
   - Edge cases (empty input, `null`/`undefined`, boundary values)
   - Error cases (rejected promises, thrown errors, failed requests)
   - Async flows (`async`/`await`, `waitFor`, `findBy*` queries from Testing Library)

3. **Generate the test file** — Follow the conventions below, then write the full file.

4. **Show tests in chat** — Display the generated test file in a code block so the user can review it.

5. **Save to disk** — Write to the correct path (see Naming below), aligned with the project’s Vitest `include` patterns (e.g. `**/*.{test,spec}.{ts,tsx}`).

---

## Spec / test file conventions

### Naming

| Source file | Test file (common) |
|-------------|-------------------|
| `Foo.tsx` | `Foo.test.tsx` or `Foo.spec.tsx` (next to the component, or under `__tests__/` if the project prefers) |
| `useFoo.ts` | `useFoo.test.ts` |
| `foo.ts` (plain module) | `foo.test.ts` |

Place the test file **next to** the source file unless the user or repo convention says otherwise.

### Imports (typical)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
```

- **Plain TS / hooks with no DOM:** may omit Testing Library UI helpers; use `renderHook` from `@testing-library/react` when testing hooks.
- **React components:** use **`jsdom`** for that file or globally in `vitest.config` / `vite.config` `test.environment`.

### Per-file environment (when the project defaults to `node`)

At the **very top** of a component test file:

```typescript
// @vitest-environment jsdom
```

### Structure template

```typescript
describe('MyModule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should <expected behaviour> when <condition>', () => {
		// ...
	});

	describe('functionName()', () => {
		it('should <happy path>', () => { /* ... */ });
		it('should <edge case>', () => { /* ... */ });
		it('should <error path>', () => { /* ... */ });
	});
});
```

---

## React component patterns

### Basic render and queries

```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MyCard } from './MyCard';

describe('MyCard', () => {
	it('renders title from props', () => {
		render(<MyCard title="Rookie" />);
		expect(screen.getByRole('heading', { name: 'Rookie' })).toBeInTheDocument();
	});
});
```

Prefer **roles and accessible names** (`getByRole`, `getByLabelText`) over `getByTestId` unless the UI already relies on stable `data-testid` attributes.

### User interactions

```typescript
it('calls onSave when the button is clicked', async () => {
	const user = userEvent.setup();
	const onSave = vi.fn();
	render(<Editor onSave={onSave} />);
	await user.click(screen.getByRole('button', { name: /save/i }));
	expect(onSave).toHaveBeenCalledTimes(1);
});
```

### Async UI

Use **`waitFor`** or **async queries** (`findByRole`, etc.):

```typescript
it('shows the loaded message', async () => {
	render(<Profile userId="1" />);
	expect(await screen.findByText(/welcome/i)).toBeInTheDocument();
});
```

### Forms and controlled inputs

```typescript
it('updates the field value', async () => {
	const user = userEvent.setup();
	render(<Form />);
	const input = screen.getByRole('textbox', { name: /name/i });
	await user.clear(input);
	await user.type(input, 'hello');
	expect(input).toHaveValue('hello');
});
```

### Callback props instead of Vue emits

Model events as **function props** and assert with **`vi.fn()`**:

```typescript
it('invokes onChange with the new value', async () => {
	const user = userEvent.setup();
	const onChange = vi.fn();
	render(<SearchInput value="" onChange={onChange} />);
	await user.type(screen.getByRole('searchbox'), 'abc');
	expect(onChange).toHaveBeenCalled();
});
```

### Wrapping with providers (Context)

```typescript
import { MyProvider } from './MyContext';

function renderWithProviders(ui: React.ReactElement) {
	return render(<MyProvider value={fakeValue}>{ui}</MyProvider>);
}
```

### React Router

Use **`MemoryRouter`** (and `Routes` / `Route` as needed) with `initialEntries`, or **`createMemoryRouter`** / **`RouterProvider`** for Data Router apps:

```typescript
import { MemoryRouter } from 'react-router-dom';

render(
	<MemoryRouter initialEntries={['/team/1']}>
		<TeamPage />
	</MemoryRouter>
);
```

Alternatively, mock `react-router-dom` hooks (`useNavigate`, `useParams`) with `vi.mock` when isolation is clearer.

### Hooks (`useX`)

```typescript
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

it('increments', () => {
	const { result } = renderHook(() => useCounter(0));
	expect(result.current.count).toBe(0);
	act(() => {
		result.current.inc();
	});
	expect(result.current.count).toBe(1);
});
```

If the hook requires providers, pass a **`wrapper`** option to `renderHook`.

### Mocking HTTP / modules

```typescript
vi.mock('../api/client', () => ({
	getTeams: vi.fn().mockResolvedValue({ data: { teams: [] } }),
}));
```

Prefer mocking the module the component imports, not deep private helpers.

---

## Plain TypeScript patterns

```typescript
import { describe, expect, it } from 'vitest';
import { chunkIds } from './chunkIds';

it('returns empty chunks for empty input', () => {
	expect(chunkIds([], 10)).toEqual([]);
});
```

Use **`vi.fn()`** for callbacks and **`vi.useFakeTimers()`** when testing timers.

---

## Test coverage checklist

- [ ] First render (components) or first `renderHook` call (hooks)
- [ ] Each public function or user-visible behaviour — happy path
- [ ] Edge cases: `null`, `undefined`, empty string/array
- [ ] Async: promises settled; `waitFor` / `findBy*` where needed
- [ ] Callback props and controlled updates (components)
- [ ] Mocks restored (`vi.clearAllMocks` / `vi.restoreAllMocks` in `afterEach` when appropriate)
- [ ] HTTP or external modules: success and failure paths

---

## Quality rules

- **One main assertion focus per `it`** — keep tests easy to diagnose.
- **Descriptive names** — `it('returns an empty list when teams is null')` not `it('works')`.
- **Avoid magic values** — use named constants or clear variables for fixtures.
- **Reset state** — `beforeEach` for fresh mocks, rerender, or new `render`.
- **No `any` unless unavoidable** — keep types in tests.
- **Test behaviour, not implementation details** — prefer public API, user-visible output, and callbacks over internal state or private components.

---

## Output

1. Show the complete test file in a TypeScript / TSX code block in chat.
2. Save the file to disk at the path that matches project conventions.
3. Briefly summarise:
   - Number of `describe` / `it` blocks
   - Mocking strategy (HTTP, router, context)
   - Any gaps where the user should supply real API payloads or routes
