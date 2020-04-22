Changes in RC5 are:

- [x] Updated `system/config` endpoint to accept PUT method
- [x] Introduce two new endpoint: `system/logs` and `system/logs-ws` (experimental)
- [x] Web Console added a new Logs section
- [x] Web Console assists the user in refreshing for new available versions
- [x] The Command-Line tool added new commands: logout, version, stop, restart, config, ping, logs
- [ ] Drop support for Nashorn
- [ ] Re-work the testing strategy
- [ ] Convert project to monorepo
- [ ] Implement NAT test scenarios

Bugfix:
  - [x] Fixed https://github.com/fonoster/routr/issues/70
  - [x] Prevent resource from staying in the cache after removed from db
  - [x] Prevent `transport` parameter from accepting arbitrary values

Breaking changes:
  - Redis user will have to remove the `config` key from the database for it to be re-built
