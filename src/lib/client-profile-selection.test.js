import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clientProfileSelectionKey } from "./client-profile-selection.js";

const screenSource = readFileSync(new URL("../screens/CommercialScreens.jsx", import.meta.url), "utf8");

test("client profile key changes with the selected client's identity", () => {
  assert.equal(clientProfileSelectionKey({ id: "client-1" }), "client-profile:client-1");
  assert.notEqual(clientProfileSelectionKey({ id: "client-1" }), clientProfileSelectionKey({ id: "client-2" }));
  assert.notEqual(clientProfileSelectionKey({ email: "one@example.com" }), clientProfileSelectionKey({ email: "two@example.com" }));
});

test("client profile modal is keyed by the selected client so local state cannot leak across clients", () => {
  assert.match(screenSource, /<ClientProfileModal\s+key=\{clientProfileSelectionKey\(selectedItem\)\}/);
});
