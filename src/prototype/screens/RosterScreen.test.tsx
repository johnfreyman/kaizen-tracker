/** @vitest-environment jsdom */
/**
 * Component-level regressions for F02: the actual Add and Edit Save
 * controls, not just the pure wouldCollide/playerEditIsValid helpers, must
 * reject a duplicate card and must leave the previously valid stored
 * player identity untouched when a rejected edit is attempted.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import RosterScreen from "./RosterScreen";
import { buildScenario } from "../fixtures";
import { PrototypeStoreProvider } from "../store";

// This project does not enable Vitest's `globals` option, so
// @testing-library/react's own afterEach(cleanup) auto-registration never
// fires (it only self-installs when it finds a global `afterEach`). Without
// this, each render below accumulates in the same document instead of
// starting fresh, and duplicate text across tests throws "multiple
// elements found" rather than testing anything.
afterEach(() => cleanup());

function renderRoster() {
  return render(
    <PrototypeStoreProvider initialState={buildScenario("team")}>
      <RosterScreen />
    </PrototypeStoreProvider>,
  );
}

/**
 * Only one row can be in edit mode at a time (RosterScreen keeps a single
 * `editing` id), so once Edit is clicked every subsequent Save/input/error
 * query is unambiguous globally. The only place row-scoping is needed is
 * picking the right Edit button out of many unedited rows: the toggle
 * button and the player's name are both inside the same summary-row
 * container (a sibling of the row's own edit form), so `within` there is
 * enough to disambiguate that one click.
 */
function clickEditFor(name: string) {
  let node: HTMLElement | null = screen.getByText(name);
  while (node) {
    const editButton = within(node).queryByRole("button", { name: "Edit" });
    if (editButton) {
      fireEvent.click(editButton);
      return;
    }
    node = node.parentElement;
  }
  throw new Error(`No Edit button found for "${name}"`);
}

describe("F02: Add rejects a duplicate card and accepts a valid one", () => {
  it("disables Add to roster and explains why for a card that already exists", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));

    // Alex R. · #12 already exists on the roster.
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/Distinguishing label/), { target: { value: "R." } });
    fireEvent.change(screen.getByLabelText(/Jersey number/), { target: { value: "12" } });

    const addButton = screen.getByRole("button", { name: "Add to roster" });
    expect(addButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/A card already reads/)).toBeDefined();
  });

  it("enables and successfully adds once the card is made unique", () => {
    renderRoster();
    fireEvent.click(screen.getByRole("button", { name: "Add player" }));

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText(/Distinguishing label/), { target: { value: "Q." } });
    fireEvent.change(screen.getByLabelText(/Jersey number/), { target: { value: "12" } });

    const addButton = screen.getByRole("button", { name: "Add to roster" });
    expect(addButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(addButton);
    expect(screen.getByText("19 players")).toBeDefined();
    expect(screen.getByText("Alex Q.")).toBeDefined();
  });
});

describe("F02: Edit rejects a duplicate card and preserves the stored identity", () => {
  it("disables Save and leaves the store untouched when the draft would collide", () => {
    renderRoster();
    clickEditFor("Alex M.");

    const labelInput = screen.getByLabelText(/Distinguishing label/) as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: "R." } }); // collides with Alex R. · #12

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/A card already reads/)).toBeDefined();

    // Cancel discards the draft without ever calling Save. Two buttons say
    // "Cancel" while editing (the header toggle and the one by Save); both
    // call the same handler, so either closes the editor.
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);

    // The summary view is back to the original, untouched identity...
    expect(screen.getByText("Alex M.")).toBeDefined();

    // ...and re-opening Edit re-syncs from the store, not the rejected draft.
    clickEditFor("Alex M.");
    const labelInputAgain = screen.getByLabelText(/Distinguishing label/) as HTMLInputElement;
    expect(labelInputAgain.value).toBe("M.");
  });

  it("saves a valid rename once the draft is made unique", () => {
    renderRoster();
    clickEditFor("Alex M.");

    const labelInput = screen.getByLabelText(/Distinguishing label/) as HTMLInputElement;
    fireEvent.change(labelInput, { target: { value: "Q." } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton.hasAttribute("disabled")).toBe(false);
    fireEvent.click(saveButton);

    expect(screen.getByText("Alex Q.")).toBeDefined();
    expect(screen.queryByText("Alex M.")).toBeNull();
  });

  it("rejects a blank first name", () => {
    renderRoster();
    clickEditFor("Alex M.");

    const firstNameInput = screen.getByLabelText("First name") as HTMLInputElement;
    fireEvent.change(firstNameInput, { target: { value: "   " } });

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("First name cannot be empty.")).toBeDefined();
  });
});
