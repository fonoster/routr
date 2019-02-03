
try {
  var mine = doNotLeak;
  // should have thrown a reference error
  expect(false).toBe(true);
} catch (err) {
  expect(err instanceof ReferenceError).toBe(true);
}

