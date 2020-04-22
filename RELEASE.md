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
- [x] Bugfix: Fixed https://github.com/fonoster/routr/issues/70
- [x] Bugfix: resource will stay in the cache after removed from db
- [x] Bugfix: `transport` parameter from accepting arbitrary values
- [x] Breaking change: If using redis the configuration will be a merge between the config in file and the config in the db where the file is the priority.
