
var mine = doLeak;

expect(mine).toBe("cheddar");

try {
  mine = doNotLeak
  // should have thrown a ref-error
  expect(false).toBe(true);
} catch (err) {
  expect(err instanceof ReferenceError).toBe(true);
}