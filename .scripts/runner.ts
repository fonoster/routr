#!/usr/bin/env node
import connectProcessor from "../mods/connect/src/service"
import simpleDataService from "../mods/simpledata/src/service"
import messageDispatcher from "../mods/dispatcher/src/service"
import locationService from "../mods/location/src/service"
import registryService from "../mods/registry/src/service"
import loadResources from '../mods/simpledata/src/utils'
import {getConfig as getDispatcherConfig} from "../mods/dispatcher/src/config/get_config"
import {getConfig as getLocationConfig} from "../mods/location/src/config/get_config"
import {getConfig as getRegistryConfig} from "../mods/registry/src/config/get_config"
import {spawn} from "child_process"
import {Helper as H} from "../mods/common/src"
import {Resource} from '../mods/common/src/connect/types'
import {getLogger} from '@fonoster/logger'

const envcopy = H.deepCopy(process.env);
envcopy.CONFIG_PATH = __dirname + "/../config/edgeport.alt.yaml";

const edgeport = spawn("./mods/edgeport/edgeport.sh")
const edgeportAlt = spawn("./mods/edgeport/edgeport.sh", {env: envcopy})
const requester = spawn("./mods/requester/requester.sh")
const dispatcherConfig = getDispatcherConfig(__dirname + "/../config/dispatcher.yaml")
const locationConfig = getLocationConfig(__dirname + "/../config/location.yaml")
const registryConfig = getRegistryConfig(__dirname + "/../config/registry.yaml")
const logger = getLogger({service: "base", filePath: __filename})

logger.info("routr v2 // connect distribution")

if (dispatcherConfig._tag === 'Right') {
  messageDispatcher(dispatcherConfig.right)
} else {
  logger.error(dispatcherConfig.left)
  process.exit(1)
}

if (locationConfig._tag === 'Right') {
  locationService(locationConfig.right)
} else {
  logger.error(locationConfig.left)
  process.exit(1)
}

if (registryConfig._tag === 'Right') {
  registryService(registryConfig.right)
} else {
  logger.error(registryConfig.left)
  process.exit(1)
}

const resources: Resource[] = loadResources(__dirname + "/../mods/simpledata/etc/schemas",
  __dirname + "/../config/resources")

simpleDataService({bindAddr: "0.0.0.0:51907", resources})

connectProcessor({
  bindAddr: "0.0.0.0:51904",
  locationAddr: "location:51902",
  apiAddr: "simpledata:51907"
})

edgeport.stdout.on("data", (data: any) => {
  process.stdout.write(`${data}`)
});

edgeportAlt.stdout.on("data", (data: any) => {
  process.stdout.write(`${data}`)
});

requester.stdout.on("data", (data: any) => {
  process.stdout.write(`${data}`)
});
