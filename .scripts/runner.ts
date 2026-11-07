#!/usr/bin/env node
// The whole stack from this checkout, one process per component, each with its file in
// config/. Their addresses (dispatcher, location, connect, apiserver, requester) are names
// the machine has to resolve to itself: the dev container does; elsewhere, /etc/hosts.
// For one process, see `npm run start:one`.
import { spawn, ChildProcess } from "child_process"

const root = __dirname + "/.."

const components: Array<[command: string, config: string]> = [
  ["data", "data.yaml"],
  ["location", "location.yaml"],
  ["connect", "connect.yaml"],
  ["dispatcher", "dispatcher.yaml"],
  ["requester", "requester.yaml"],
  ["registry", "registry.yaml"],
  ["edgeport", "edgeport.yaml"],
  ["edgeport", "edgeport.alt.yaml"]
]

const children: ChildProcess[] = components.map(([command, config]) =>
  spawn("go", ["run", `./cmd/${command}`], {
    cwd: root,
    env: {
      ...process.env,
      CONFIG_PATH: `${root}/config/${config}`,
      ROUTR_RESOURCES: `${root}/config/resources`
    },
    stdio: "inherit",
    detached: true
  })
)

const stop = () => {
  // Each child leads its own process group, so this also stops the binary go run started
  children.forEach((child) => {
    try {
      process.kill(-child.pid!, "SIGTERM")
    } catch {
      // already gone
    }
  })
  process.exit(0)
}

process.on("SIGINT", stop)
process.on("SIGTERM", stop)
