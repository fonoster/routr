# Routr 1.0.2

Changes in 1.0.2 include:

- [x] Reduced the size of the cache on FilesStore object https://github.com/fonoster/routr/commit/e88c2ef5b5b90d8b7b1262a1c6303a8a9a7e92c3
- [x] Changed default Registry `Expires` from 3600 to 600 https://github.com/fonoster/routr/commit/f818c984cec5f915f51afe203e162dfaa090ad2f
- [x] Reduced the use of `getConfig` https://github.com/fonoster/routr/commit/792c187c45eb7ed24285ff71f6ec48d91643bb24
- [x] Improved logging https://github.com/fonoster/routr/commit/8d03896efed5fe848c3c0344e92a3b1cd006f20b
- [x] Updated/removed vulnerable dependencies https://github.com/fonoster/routr/commit/792c187c45eb7ed24285ff71f6ec48d91643bb24

Bugfix:  

- [x] Fixed multi-threading conflict caused by the Rest API https://github.com/fonoster/routr/commit/f4263e5c971a3766e7c2b99e6b63025b75747e1a
- [x] Fixed RR configuration (Which caused hangup issues) https://github.com/fonoster/routr/commit/e199327cc5b715a5316c0cd427beddafd89a5a79

Breaking changes:
  - The K8s distro no uses Statefulset instead of Deployment https://github.com/fonoster/routr/commit/1bc3b68edbfa44a19baa86adaf50949cf41eed5a

- None

# Routr 1.0 RC6

Changes in RC6 include:

- [x] Added the ability to change the initial admin password
- [x] Improved environment detection (For Docker containers) - https://github.com/fonoster/routr/commit/0fb5e8018f94d453be8e87dbeeeae9b8c00750f9
- [x] Added max registration feature - https://github.com/fonoster/routr/commit/ee5d339888344013939d06c734385f17f0cd75c2
- [x] Improved support for WebRTC clients
- [x] Improved signaling - https://github.com/fonoster/routr/commit/2e40bab7ce37d8c0f34c67d6cc0fbe7411ae7d50 https://github.com/fonoster/routr/commit/5d574ef0853b24ba8ffbc953f12da47ccb47b7ce
- [x] Added support for RTPEngine (Experimental) - https://github.com/fonoster/routr/commit/9470450c6284d2f989f9daa3681e55ca436d384b

Bugfix:

- [x] Fixed https://github.com/fonoster/routr/issues/113
- [x] Fixed error on configmap - https://github.com/fonoster/routr/commit/6b650d2dd3ebb7643c69809d3679fdc72d6f7d4e 
- [x] Fixed https://github.com/fonoster/routr/issues/112

Breaking changes:
  - None

# Routr 1.0 RC5

Changes in RC5 include:

- [x] Updated `system/config` endpoint to accept PUT method
- [x] Introduce two new endpoint: `system/logs` and `system/logs-ws` (experimental)
- [x] Web Console added a new Logs section
- [x] Web Console assists the user in refreshing for new available versions
- [x] The Command-Line tool added new commands: logout, version, stop, restart, config, ping, logs
- [x] Dropped support for Nashorn

Bugfix:
  - [x] Fixed https://github.com/fonoster/routr/issues/85
  - [x] Fixed https://github.com/fonoster/routr/issues/84
  - [x] Fixed https://github.com/fonoster/routr/issues/70
  - [x] Prevent resource from staying in the cache after removed from db
  - [x] Prevent `transport` parameter from accepting arbitrary values

Breaking changes:
  - Redis user will have to remove the `config` key from the database for it to be re-built

# Routr 1.0 RC4

- Freeze changes in the public API(`apiVersion == v1beta1`)
- Replace the testing tool with Mocha and Istanbul to allow for test coverage
- Bring [`GraalJS`](https://www.graalvm.org) as the default JS engine
- Re-write the `Location` module to improve performance
- Review the architecture to allow for better decoupling and scalability
- Work on bringing the server to the following platforms:
    - Ubuntu Snaps
    - DigitalOcean droplet
    - Docker
    - Kubernetes
    - Google Cloud Shell
    - Custom
- Add experimental support for IPv6
- Bring the [`routr-ui`](https://github.com/fonoster/routr-ui) to a beta version

# Routr 1.0 RC2

Release Highlights:

- Added a new parameter expires. See issue [#27](https://github.com/fonoster/routr/issues/27)
- Improves NAT support
- Updates CTL to the newest version

# Routr 1.0 RC1

This is the first release since we renamed the project as Routr. We'd love to get your feedback to make this project even better.
